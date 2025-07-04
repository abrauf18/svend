import type { NextRequest } from 'next/server';
import { NextResponse, URLPattern } from 'next/server';

import { CsrfError, createCsrfProtect } from '@edge-csrf/nextjs';

import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';
import { createMiddlewareClient } from '@kit/supabase/middleware-client';

import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';
import { AccountOnboardingStepContextKey } from '~/lib/model/onboarding.types';

const CSRF_SECRET_COOKIE = 'csrfSecret';
const NEXT_ACTION_HEADER = 'next-action';

export const config = {
  matcher: ['/((?!_next/static|_next/image|images|locales|assets|api/*|\\..*).*)'],
};

const getUser = (request: NextRequest, response: NextResponse) => {
  const supabase = createMiddlewareClient(request, response);

  return supabase.auth.getUser();
};

export async function middleware(request: NextRequest) {
  console.log('Middleware triggered for:', request.nextUrl.pathname);
  
  // Skip middleware for any path containing a dot (files)
  if (request.nextUrl.pathname.includes('.')) {
    console.log('Skipping file path:', request.nextUrl.pathname);
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // set a unique request ID for each request
  // this helps us log and trace requests
  setRequestId(request);

  // apply CSRF protection for mutating requests
  const csrfResponse = await withCsrfMiddleware(request, response);

  // handle patterns for specific routes
  const handlePattern = matchUrlPattern(request.url);

  // if a pattern handler exists, call it
  if (handlePattern) {
    const patternHandlerResponse = await handlePattern(request, csrfResponse);

    // if a pattern handler returns a response, return it
    if (patternHandlerResponse) {
      return patternHandlerResponse;
    }
  }

  // append the action path to the request headers
  // which is useful for knowing the action path in server actions
  if (isServerAction(request)) {
    csrfResponse.headers.set('x-action-path', request.nextUrl.pathname);
  }

  // Check for account onboarding redirect from /home or /home/(user)
  if (request.nextUrl.pathname === '/home' || request.nextUrl.pathname.startsWith('/home/')) {
    const supabase = createMiddlewareClient(request, response);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // First check account onboarding
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('state->account')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching onboarding state:', error);
        throw error;
      }

      const account = data?.account as { contextKey: AccountOnboardingStepContextKey };
      
      // Redirect to /onboarding/account if onboarding is not complete
      if (account?.contextKey as AccountOnboardingStepContextKey != 'end') {
        console.log(`redirecting to account onboarding for user ${user.id} with onboarding context ${account.contextKey}`)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/account`);
      }

      // Only check budget onboarding if we're on a budget route
      const budgetSlug = request.nextUrl.pathname.split('/')[2];
      if (budgetSlug) {
        console.log('Querying budget in /home/ handler for slug:', budgetSlug);
        const { data: budget, error: budgetError } = await supabase
          .from('budgets')
          .select('id, current_onboarding_step, team_account_id, accounts!inner(slug)')
          .eq('accounts.slug', budgetSlug)
          .single();

        if (budgetError || !budget) {
          console.log('Budget not found or error for slug:', budgetSlug);
          console.error('Budget not found or error:', budgetError);
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/home`);
        }

        if (!['invite_members', 'end'].includes(budget.current_onboarding_step)) {
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/budget/${budget.accounts.slug}`);
        }
      }
    }
  }

  // Check for account onboarding redirect from /onboarding/account
  if (request.nextUrl.pathname.startsWith('/onboarding/account')) {
    const supabase = createMiddlewareClient(request, response);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('state->account')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching onboarding state:', error);
        throw error;
      }

      const account = data?.account as { contextKey: AccountOnboardingStepContextKey };
      
      // Redirect to /onboarding/account if onboarding is not complete
      console.log('middleware redirect to /home if contextKey == end >> contextKey:', account?.contextKey);
      if (account?.contextKey as AccountOnboardingStepContextKey == 'end') {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/home`);
      }
    }
  }

  // Check for budget onboarding redirect from /onboarding/budget/:budgetSlug
  if (request.nextUrl.pathname.startsWith('/onboarding/budget/')) {
    const supabase = createMiddlewareClient(request, response);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const budgetSlug = request.nextUrl.pathname.split('/')[3];
      
      if (!budgetSlug) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/home`);
      }

      console.log('Querying budget in /onboarding/budget/ handler for slug:', budgetSlug);
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .select('current_onboarding_step, accounts!inner(slug)')
        .eq('accounts.slug', budgetSlug)
        .single();

      if (budgetError || !budget) {
        console.log('Budget not found or error for slug:', budgetSlug);
        console.error('Budget not found or error:', budgetError);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/home`);
      }

      // Redirect to budget home if onboarding is complete
      if (['invite_members', 'end'].includes(budget.current_onboarding_step)) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/home/${budget.accounts.slug}`);
      }
    }
  }

  // if no pattern handler returned a response,
  // return the session response
  return csrfResponse;
}

async function withCsrfMiddleware(
  request: NextRequest,
  response = new NextResponse(),
) {
  // set up CSRF protection
  const csrfProtect = createCsrfProtect({
    cookie: {
      secure: appConfig.production,
      name: CSRF_SECRET_COOKIE,
    },
    // ignore CSRF errors for server actions since protection is built-in
    ignoreMethods: isServerAction(request)
      ? ['POST']
      : // always ignore GET, HEAD, and OPTIONS requests
        ['GET', 'HEAD', 'OPTIONS'],
  });

  try {
    await csrfProtect(request, response);

    return response;
  } catch (error) {
    // if there is a CSRF error, return a 403 response
    if (error instanceof CsrfError) {
      return NextResponse.json('Invalid CSRF token', {
        status: 401,
      });
    }

    throw error;
  }
}

function isServerAction(request: NextRequest) {
  const headers = new Headers(request.headers);

  return headers.has(NEXT_ACTION_HEADER);
}

async function adminMiddleware(request: NextRequest, response: NextResponse) {
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');

  if (!isAdminPath) {
    return response;
  }

  const {
    data: { user },
    error,
  } = await getUser(request, response);

  // If user is not logged in, redirect to sign in page.
  // This should never happen, but just in case.
  if (!user || error) {
    return NextResponse.redirect(
      new URL(pathsConfig.auth.signIn, request.nextUrl.origin).href,
    );
  }

  const role = user?.app_metadata.role;

  // If user is not an admin, redirect to 404 page.
  if (!role || role !== 'super-admin') {
    return NextResponse.redirect(new URL('/404', request.nextUrl.origin).href);
  }

  // in all other cases, return the response
  return response;
}

/**
 * Define URL patterns and their corresponding handlers.
 */
function getPatterns() {
  return [
    {
      pattern: new URLPattern({ pathname: '/admin/*?' }),
      handler: adminMiddleware,
    },
    {
      pattern: new URLPattern({ pathname: '/auth/*?' }),
      handler: async (req: NextRequest, res: NextResponse) => {
        const {
          data: { user },
        } = await getUser(req, res);

        // the user is logged out, so we don't need to do anything
        if (!user) {
          return;
        }

        // check if we need to verify MFA (user is authenticated but needs to verify MFA)
        const isVerifyMfa = req.nextUrl.pathname === pathsConfig.auth.verifyMfa;

        // If user is logged in and does not need to verify MFA,
        // redirect to home page.
        if (!isVerifyMfa) {
          return NextResponse.redirect(
            new URL(pathsConfig.app.home, req.nextUrl.origin).href,
          );
        }
      },
    },
    {
      pattern: new URLPattern({ pathname: '/home/*?' }),
      handler: async (req: NextRequest, res: NextResponse) => {
        const {
          data: { user },
        } = await getUser(req, res);

        const origin = req.nextUrl.origin;
        const next = req.nextUrl.pathname;

        // If user is not logged in, redirect to sign in page.
        if (!user) {
          const signIn = pathsConfig.auth.signIn;
          const redirectPath = `${signIn}?next=${next}`;

          return NextResponse.redirect(new URL(redirectPath, origin).href);
        }

        const supabase = createMiddlewareClient(req, res);

        const requiresMultiFactorAuthentication =
          await checkRequiresMultiFactorAuthentication(supabase);

        // If user requires multi-factor authentication, redirect to MFA page.
        if (requiresMultiFactorAuthentication) {
          return NextResponse.redirect(
            new URL(pathsConfig.auth.verifyMfa, origin).href,
          );
        }
      },
    },
  ];
}

/**
 * Match URL patterns to specific handlers.
 * @param url
 */
function matchUrlPattern(url: string) {
  const patterns = getPatterns();
  const input = url.split('?')[0];

  for (const pattern of patterns) {
    const patternResult = pattern.pattern.exec(input);

    if (patternResult !== null && 'pathname' in patternResult) {
      return (req: NextRequest, res: NextResponse) => pattern.handler(req, res);
    }
  }
}

/**
 * Set a unique request ID for each request.
 * @param request
 */
function setRequestId(request: Request) {
  request.headers.set('x-correlation-id', crypto.randomUUID());
}
