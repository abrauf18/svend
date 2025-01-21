# Svend

This project is built using the [MakerKit Starter Kit w/NextJS and Turbo](https://makerkit.dev/docs/next-supabase-turbo/introduction) for building SaaS applications using Supabase, Next.js, and Tailwind CSS.  These are searchable docs that can be very useful at times.

This version uses Turborepo to manage multiple packages in a single repository.

A demo of this boilerplate project can be found at [https://next-supabase-saas-kit-turbo-demo-vercel-web.vercel.app](https://next-supabase-saas-kit-turbo-demo-vercel-web.vercel.app). This version contains a tasks functionality that is not present in the original version, multiple languages, and other various modifications.


## Setting up local development environment

### Prerequisites

The rest of this section will take you through installation of AWS CLI and `pnpm`.  However, here is a full list of prerequisites:

- Install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html).
- Install [Node.js](https://nodejs.org/en/download/).
- Install [pnpm](https://pnpm.io/installation).
- Install [Docker](https://www.docker.com/products/docker-desktop/).


### Setup Steps

1. To pull the environment variables for local development, you'll need to authenticate to AWS.  We use the AWS CLI to do this.  

    - Install the AWS CLI if you haven't already. You can download it from the [official AWS CLI page](https://aws.amazon.com/cli/).  It's a good idea to install it again anyway just to make sure you have the latest version.  You can also use a package manager for your OS.  For example, on macOS you can install it using Homebrew with `brew install awscli`.

    - At the time of this writing, the latest AWS CLI version is `2.22.10`.  Verify your version by running `aws --version` in your terminal.

2. Open a terminal and run:
    ```
    aws configure sso
    ```

3. Follow the prompts to enter the following info:
    ```
    SSO session name (Recommended): svend
    SSO start URL [None]: https://svend.awsapps.com/start
    Using the account ID 980921716461
    Using the role name "FullStack"
    CLI default client Region [None]: us-east-2
    CLI default output format [None]: json
    CLI profile name: svend-dev
    ```

    - This will create a new profile called `svend-dev` in your `~/.aws/config` file.  The credentials for this profile are short-lived and will need to be refreshed periodically via SSO authentication (see next step).

4. Authenticate your new `svend-dev` AWS profile via SSO by running the pnpm script.  From repo root directory:
    ```
    cd .aws
    pnpm aws:sso
    ```
    - This runs the `aws:sso` script from the root of the nested pnpm workspace specifically for AWS DevOps: [.aws/package.json](.aws/package.json).  This will open a new browser window to complete the SSO login process.

    - For more detailed instructions, refer to the [AWS CLI SSO documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).

5. Now you can run the other script in the `.aws` workspace: `env:web:pull:local`.  Breaking down the script name, this command references the `env` tools, targeting the `web` app, and it will `pull` the `local` environment.  You will need to install the dependencies for the `.aws` directory pnpm workspace first (from the `.aws` directory).

    - To check if you have pnpm installed, run `pnpm -v` in your terminal.  If you don't have it installed, you can install it via `npm` by running:
        ```
        npm i -g pnpm
        ```

    - Now you can run the `env:web:pull:local` script:
        ```
        pnpm env:web:pull:local
        ```
    - By default, this will create a `.env.aws.local` file at `/apps/web/.env.aws.local` - relative to the root of the project - which contains the environment variables for local development.

6. Rename the `.env.aws.local` file to `.env.local` - a gitignored file that is used by Next.js to load local environment variables at runtime.


## Starting the Development Server

There are 3 steps to start the development server after you have completed the steps above (from the root of the project):

1. Install dependencies for all workspace packages:
    ```
    pnpm i
    ```

2. Start Supabase locally (make sure Docker is running):
    ```
    pnpm supabase:web:start
    ```

2. Start the Next.js development server (run in a separate terminal):
    ```
    pnpm dev
    ```

## Upcoming Sprint Planning

### Required Features/Tasks

#### 1. Settings & Account Management
- Account settings interface for managing financial accounts
- Financial account settings
  - Ability to modify account types (in case Plaid categorizes incorrectly)
  - Support for both Plaid and manual accounts
- Basic notification settings
  - Low balance notifications
  - New transaction notifications
  - Webhook support for real-time updates
- Plaid integration improvements
  - Handle transaction sync costs efficiently
  - Support for investment accounts ($0.35/connected account/month + $0.18/month for holdings)
  - Transaction enrichment for manual accounts ($2/1000 transactions)

#### 2. Multi-Budget Support
- Secondary onboarding flow for additional budgets
  - Reuse most of initial onboarding flow
  - Show existing connected accounts with ability to include/exclude
  - Prevent deletion of shared Plaid/manual accounts during onboarding
  - Support for business vs personal budget separation
- Manual and Plaid account management across budgets
  - Separate transaction categorization per budget
  - Maintain original transaction data while allowing budget-specific modifications
- Account management section above all budgets
  - Central place to manage all connected accounts
  - Ability to modify account settings that affect all budgets

#### 3. Transaction Management
- Manual transactions enrichment via Plaid
  - Merchant categorization
  - Recurring transaction detection
  - Enhanced transaction details
- Automatic recurring transaction detection
  - Integration with Plaid's recurrence detection
  - Support for both Plaid and manual accounts
  - Fallback to custom detection logic if needed
- Calendar view for recurring transactions
  - Visual representation of upcoming transactions
  - Ability to see all recurring charges in one view

#### 4. Rules Manager
- Fields to manage:
  - Tags
  - Categories
  - Merchant names
  - Transaction descriptions
- Rule configuration:
  - Per-budget rules (not shared across budgets)
  - Support for multiple conditions
  - Ability to apply rules to existing transactions
- Basic rule application system
  - Automatic application to new transactions
  - Manual application to existing transactions

#### 5. Investment Tracking
- Basic investment account integration
  - Support for Plaid investment accounts
  - Display of current holdings and balances
  - Basic transaction history
- Investment dashboard features:
  - Current holdings view
  - Basic performance tracking
  - Support for multiple investment accounts
- Manual investment tracking
  - Basic support for manually added investments
  - Current value tracking
  - No support for detailed portfolio analysis

#### 6. Goals
- Redesigned goals interface:
  - Four main categories: Save, Debt, Invest, Charity
  - Simplified goal creation flow
  - Support for multiple goals per category
- CRUD operations outside of onboarding
  - Ability to create/edit/delete goals after initial setup
  - Progress tracking
  - Goal-to-account association
- Enhanced onboarding integration
  - Auto-calculation of savings/debt from connected accounts
  - Pre-filled goal suggestions based on account data
  - Simplified goal creation during onboarding

#### 7. Dashboard
- Basic dashboard implementation
  - Overview of connected accounts
  - Goal progress tracking
  - Recent transactions
- Initial dashboard content
  - Account balances
  - Budget status
  - Investment overview (if applicable)

### Notes
- Sprint 4 will focus on delivering an alpha version with core functionality
- Sprint 5 will focus on refinement and completing essential features
- Plaid costs need to be monitored:
  - Transaction sync: $0.12 per successful call
  - Investment accounts: Additional fees per account
  - Manual transaction enrichment: $2 per 1000 transactions


### Sprint Division

#### Sprint 4 (Target: Alpha Release) - 23 points

##### Core Account Management (5 points)
- Account settings interface
- Cross-budget financial account management
- Financial account type modifications (i.e. when Plaid categorizes incorrectly)

##### Multi-Budget Foundation (5 points)
- Secondary onboarding flow

##### Enhanced Transaction Management (5 points)
- Manual transactions CSV uploading: improve validation and add column mapping UI
- Manual transactions enrichment with basic recurring transaction detection

##### Rules Engine (5 points)
- Rules based on tags, categories, merchant names, and transaction descriptions
- Basic budget-specific rule application system

##### Onboarding (3 points)
- New interface with 4 goal types
- Calculations from account balances where possible

#### Sprint 5 (Target: Beta Release) - 21 points

##### Advanced Plaid Account Features (8 points)
- Webhook support
- Notifications & settings (new transactions, low balance)
- Real-time app notifications
- Plaid optimization (edge cases like item update or remote disconnect)

##### Budget Management (13 points)
- Dashboard view
- Goal CRUD operations in budget management tab
- Recurring transaction calendar view
- Investment tracking: holdings and balances, manual entry

#### Key Dependencies & Notes
- Investment tracking depends on Plaid investment API
- Real-time updates require webhook infrastructure
- Calendar view builds on recurring transaction detection

### Sprint Focus
Sprint 4: Core functionality for alpha release
- Core account & settings management
- Multi-budget foundation
- Enhanced transaction management (CSV uploads, enrichment, recurring view)
- Basic rules engine implementation
- Improved onboarding

Sprint 5: Feature completion and refinement
- Advanced Plaid features (webhooks, real-time updates)
- Investment account integration & tracking
- Goal management outside onboarding
- Full dashboard implementation
- Performance optimizations & polish


## Explicitly Skipped/Postponed Features

#### 1. User Roles & Permissions
- Read-only role implementation
  - View-only access to budget data
  - Restricted modification capabilities
- Non-owner user adjustments
  - Different views based on user role
  - Permission management interface
- Note: Making everyone co-owner for now to simplify development

#### 2. Advanced Recurring Transaction Features
- Manual CRUD interface for recurring transactions
  - Custom recurring transaction creation
  - Modification of detected recurring transactions
  - Complex recurrence patterns
- Ability to modify/relink missed recurring transactions
  - Historical correction of missed links
  - Manual override of automatic detection
- Manual recurring transaction management
  - Custom scheduling options
  - Advanced payment tracking
  - Support for variable amounts

#### 3. Mobile Optimization
- Mobile-specific UI improvements
  - Currently partially responsive through Tailwind CSS
  - Works on desktop and tablet views
  - Needs optimization for phone-sized screens
- Responsive design refinements
  - Layout adjustments for narrow screens
  - Touch-friendly interface elements
  - Mobile-specific navigation patterns

#### 4. Advanced Features
- Charity integration
  - Requires partnership program development
  - API integration with charity organizations
  - Automatic donation processing
  - Tax documentation support
- Virtual accounts
  - Delayed due to provider requirements:
    - Minimum $5,000/month in transactions
    - $1,000/month minimum fees
  - Future integration with Dwolla or similar
  - Requires established user base
- Advanced notification settings
  - Custom notification rules
  - Multiple notification channels
  - Frequency controls
- Cross-budget rule sharing
  - Rule templates
  - Global rule management
  - Rule import/export between budgets

#### 5. Plaid Additional Flows
- Some webhook flows
  - Advanced real-time updates
  - Error handling webhooks
  - Status change notifications
- Advanced account management features
  - Complex account linking scenarios
  - Institution-specific optimizations
  - Advanced error recovery flows

#### 6. Design/Theme
- Light/dark theme implementation
  - Currently using basic dark theme
  - OS-specific theme detection
  - Custom theme preferences
- Figma design implementation
  - Full design system integration
  - Custom component styling
  - Consistent visual language
- Advanced UI polish
  - Animation and transitions
  - Loading states
  - Error states
  - Empty states

#### 7. Subscription Management Feature
- Potential future feature for managing subscription fatigue
  - Consolidate multiple subscriptions into single payment date
  - Virtual card management for subscriptions
  - Automatic subscription detection and management
  - Payment date selection
  - Subscription analytics and insights

#### 8. Payment & Monetization
- Stripe integration
  - Subscription management system
  - Payment processing setup
  - Usage-based billing
- Pricing model implementation
  - Free tier definition
  - Premium features identification
  - Subscription tiers planning
- Payment infrastructure
  - Secure payment handling
  - Subscription lifecycle management
  - Payment failure handling
- Multi-budget billing
  - Per-budget pricing options
  - Account level billing
  - Usage tracking and limits

### Technical Considerations
- Plaid sandbox limitations
  - Incomplete test data
  - Missing features in sandbox environment
  - Need for production testing of some features
- Cost considerations
  - Per-call pricing for certain APIs
  - Monthly account fees
  - Transaction volume impacts
- Infrastructure planning
  - Webhook infrastructure
  - Real-time update handling
  - Data synchronization strategies

### Future Considerations
- Mobile app development
  - Native mobile experience
  - React Native investigation
  - Platform-specific features
- Advanced investment features
  - Detailed portfolio analysis
  - Performance tracking
  - Investment recommendations
- International expansion
  - Multi-currency support
  - International banking integrations
  - Localization requirements
