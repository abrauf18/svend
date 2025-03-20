import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { budgetId, redirectType, isOnboarding } = await request.json();

  if (isOnboarding) {
    if (!budgetId || !redirectType) {
      return NextResponse.json({ error: 'Budget ID and redirect type are required' }, { status: 400 });
    }
  }

  const redirectUri = isOnboarding ? `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/${redirectType}` : null;

  const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV ?? 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  const client = new PlaidApi(configuration);

  try {
    const isSandbox = process.env.PLAID_ENV === 'sandbox';

    const createTokenResponse = await client.linkTokenCreate({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      user: { client_user_id: user.id },
      client_name: 'Svend',
      country_codes: [CountryCode.Us],
      language: 'en',
      additional_consented_products: isSandbox ? [
        Products.Auth,
        Products.Identity,
      ] : [],
      optional_products: [
        Products.Investments,
        ...(isSandbox ? [Products.Liabilities] : []),
      ],
      products: [
        Products.Transactions,
        ...(isSandbox ? [Products.Assets] : []),
      ],
      required_if_supported_products: [
      ],
      redirect_uri: redirectUri ?? undefined
    });

    const nextRes = { 
      link_token: createTokenResponse.data.link_token
    };

    // Generate a unique state value
    console.log('Link token route res:', JSON.stringify(nextRes));

    // Return both the link_token and the state
    return NextResponse.json(nextRes);
  } catch (error: any) {
    console.error('Error creating Plaid link token:', error);
    if (error.response) {
      console.error('Plaid API response:', error.response.data);
    }
    return NextResponse.json({ error: 'Failed to create Plaid link token', details: error.message }, { status: 500 });
  }
}