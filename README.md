# Svend

This is a Starter Kit for building SaaS applications using Supabase, Next.js, and Tailwind CSS.

This version uses Turborepo to manage multiple packages in a single repository.

**This project is stable but still under development. Please update the repository daily**.

A demo version of this project can be found at [makerkit/next-supabase-saas-kit-turbo-demo](https://github.com/makerkit/next-supabase-saas-kit-turbo-demo). This version contains a tasks functionality that is not present in the original version, multiple languages, and other various modifications.

[Please follow the documentation to get started](https://makerkit.dev/docs/next-supabase-turbo/introduction).


## Setting up AWS CLI with SSO

To set up AWS CLI with SSO:

1. Install the AWS CLI if you haven't already. You can download it from the [official AWS CLI page](https://aws.amazon.com/cli/).

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

4. Now you can authenticate your AWS CLI via SSO by running the npm script:
```
pnpm run aws:sso
```
This will open a new browser window to complete the SSO login process.

5. Now you can pull the environment variables for local development vai the npm script:
```
pnpm run aws:env:local
```
This will create a `.env.aws.local` file at `/apps/web/.env.aws.local` - relative to the root of the project - which contains the environment variables.

For more detailed instructions, refer to the [AWS CLI SSO documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).


## DevOps Utilities

### Local Environment Variables

To simplify the management of local environment variables, we provide a utility script that pulls environment variables from AWS Secrets Manager. This is particularly useful for maintaining consistency across development environments and securely managing sensitive information.

The script is located at [.aws/tools/env/pull.js](.aws/tools/env/pull.js).

To use this utility:

1. Ensure you have the AWS CLI configured with the appropriate profile. For instructions on setting up AWS CLI with SSO, see [Setting up AWS CLI with SSO](#setting-up-aws-cli-with-sso).

2. Run the following command from the root of the project:

```
node .aws/tools/env/pull.js <AWS_CLI_PROFILE>
```
Or if you named your profile `svend-dev` you can use the npm script:
```
pnpm run aws:env:local
```

This will create a `.env.aws.local` file at `/apps/web/.env.aws.local` - relative to the root of the project - which contains the environment variables.

**Note: The AWS CLI profile must point to the dev account.**
**Note: If you wish to change environment variables, please update the secret in the AWS Console.**
**Note: Running the script will overwrite the existing `.env.aws.local` file.**
