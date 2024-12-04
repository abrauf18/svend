# Svend

This project is built using the [MakerKit Starter Kit w/NextJS and Turbo](https://makerkit.dev/docs/next-supabase-turbo/introduction) for building SaaS applications using Supabase, Next.js, and Tailwind CSS.  These are searchable docs that can be very useful at times.

This version uses Turborepo to manage multiple packages in a single repository.

A demo of this boilerplate project can be found at [https://next-supabase-saas-kit-turbo-demo-vercel-web.vercel.app](https://next-supabase-saas-kit-turbo-demo-vercel-web.vercel.app). This version contains a tasks functionality that is not present in the original version, multiple languages, and other various modifications.


## Setting up local development environment

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

5. Now you can run the other script in the `.aws` workspace: `env:web:pull:local`.  Breaking down the script name, this command references the `env` tools, targeting the `web` app, and it will `pull` the `local` environment.  You will need to install the dependencies for the `.aws` directory pnpm workspace first (from the `.aws` directory):
    ```
    pnpm i
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
