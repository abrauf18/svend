import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Command } from 'commander';

const DEFAULT_SECRET_NAME = 'svend-app-local-env';
const ENV_FILENAME = '.env.aws.local';

// Set up CLI
const program = new Command();
program
  .name('env-sync')
  .description('Sync environment variables with AWS Secrets Manager')
  .option('--push', 'Push local env to AWS')
  .option('--pull', 'Pull env from AWS')
  .requiredOption('--profile <profile>', 'AWS profile to use')
  .option('--outpath <path>', 'Output path for pulled env file (pull only)')
  .option('--secret-name <name>', 'AWS Secrets Manager secret name', DEFAULT_SECRET_NAME)
  .option('--envname <name>', 'Environment name for the env file (pull only)', 'local')
  .addHelpText('after', `
Examples:
  Pull Operations:
    # Basic pull (will create .env.aws.local):
    $ env-sync --pull --profile myprofile --outpath ./output

    # Pull with custom environment name (will create .env.aws.staging):
    $ env-sync --pull --profile myprofile --outpath ./output --envname staging

    # Pull with custom filename:
    $ env-sync --pull --profile myprofile --outpath ./output/custom.env

    # Pull from custom secret:
    $ env-sync --pull --profile myprofile --outpath ./output --secret-name custom-secret

  Push Operations:
    # Basic push:
    $ env-sync --push --profile myprofile

    # Push to custom secret:
    $ env-sync --push --profile myprofile --secret-name custom-secret

Options Details:
  --push, --pull    One (and only one) of these is required
  --profile         Required. The AWS profile to use
  --secret-name     Optional. Defaults to "${DEFAULT_SECRET_NAME}"
  --outpath         Required for pull only. Specify output directory or full path with filename
  --envname         Optional for pull only. Defaults to "local"
                    Used to generate filename as .env.aws.<envname> when no filename provided in outpath
`)
  .parse(process.argv);

const opts = program.opts();

// Validate commands
if (!opts.push && !opts.pull) {
  console.error('Either --push or --pull must be specified');
  process.exit(1);
}

if (opts.push && opts.pull) {
  console.error('Cannot specify both --push and --pull');
  process.exit(1);
}

// Validate pull-only options when using push
if (opts.push) {
  if (opts.outpath) {
    console.error('--outpath can only be used with pull operation');
    process.exit(1);
  }
  if (opts.envname !== 'local') {
    console.error('--envname can only be used with pull operation');
    process.exit(1);
  }
}

// Validate required options for pull
if (opts.pull && !opts.outpath) {
  console.error('--outpath is required for pull operation');
  process.exit(1);
}

// Configure AWS
process.env.AWS_PROFILE = opts.profile;
const secretsManager = new SecretsManager({});

const getOutputFileName = (outpath, envname) => {
  // Check if outpath ends with a filename (contains a dot)
  const hasFileName = outpath.split('/').pop().includes('.');
  if (hasFileName) {
    // Return just the filename part
    return outpath.split('/').pop();
  }
  return `.env.aws.${envname}`;
};

const getOutputPath = (outpath) => {
  // If outpath ends with a filename, return the directory part
  const hasFileName = outpath.split('/').pop().includes('.');
  if (hasFileName) {
    return outpath.substring(0, outpath.lastIndexOf('/'));
  }
  return outpath;
};

async function pullEnv() {
  try {
    const response = await secretsManager.getSecretValue({ SecretId: opts.secretName });
    if (response.SecretString) {
      const secretJson = JSON.parse(response.SecretString);
      const envContent = Object.entries(secretJson)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const fileName = getOutputFileName(opts.outpath, opts.envname);
      const outputPath = getOutputPath(opts.outpath);
      const fullPath = `${outputPath}/${fileName}`;

      writeFileSync(fullPath, envContent);
      console.log(`Successfully created ${fileName} in ${outputPath}`);
    } else {
      console.error('Secret value is not a string');
    }
  } catch (error) {
    console.error('Error retrieving secret:', error);
  }
}

async function pushEnv() {
  try {
    const fileName = getOutputFileName(opts.outpath, opts.envname);
    const envFilePath = resolve(process.cwd(), 'apps', 'web', fileName);
    const envContent = readFileSync(envFilePath, 'utf8');

    const envJson = envContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, value] = line.split('=');
        acc[key.trim()] = value.trim();
        return acc;
      }, {});

    await secretsManager.putSecretValue({
      SecretId: opts.secretName,
      SecretString: JSON.stringify(envJson),
    });

    console.log(`Successfully updated the secret in AWS Secrets Manager from ${envFilePath}`);
  } catch (error) {
    console.error('Error updating secret:', error);
  }
}

// Execute the appropriate command
if (opts.pull) {
  pullEnv();
} else {
  pushEnv();
} 