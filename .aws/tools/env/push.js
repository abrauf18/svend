import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function pushEnv(profile) {
  // Configure AWS SDK to use the specified profile
  process.env.AWS_PROFILE = profile;

  const secretsManager = new SecretsManager({});
  const secretName = 'svend-app-local-env';

  try {
    // Read the .env.aws.local file
    const envFilePath = resolve(process.cwd(), 'apps', 'web', '.env.aws.local');
    const envContent = readFileSync(envFilePath, 'utf8');

    // Convert env file content to JSON, ignoring comments
    const envJson = envContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, value] = line.split('=');
        acc[key.trim()] = value.trim();
        return acc;
      }, {});

    // Update the secret
    await secretsManager.putSecretValue({
      SecretId: secretName,
      SecretString: JSON.stringify(envJson),
    });

    console.log('Successfully updated the secret in AWS Secrets Manager');
  } catch (error) {
    console.error('Error updating secret:', error);
  }
}

// Check if a profile argument is provided
if (process.argv.length < 3) {
  console.error('Please provide an AWS CLI profile as an argument');
  process.exit(1);
}

const awsProfile = process.argv[2];
pushEnv(awsProfile);
