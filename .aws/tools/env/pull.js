import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { writeFileSync } from 'fs';

const envFileName = '.env.aws.local';

async function pullEnv(profile) {
  // Configure AWS SDK to use the specified profile
  process.env.AWS_PROFILE = profile;

  const secretsManager = new SecretsManager({});
  const secretName = 'svend-app-local-env';

  try {
    const response = await secretsManager.getSecretValue({ SecretId: secretName });
    if (response.SecretString) {
      const secretJson = JSON.parse(response.SecretString);
      const envContent = Object.entries(secretJson)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      writeFileSync(`apps/web/${envFileName}`, envContent);
      console.log(`Successfully created ${envFileName}`);
    } else {
      console.error('Secret value is not a string');
    }
  } catch (error) {
    console.error('Error retrieving secret:', error);
  }
}

// Check if a profile argument is provided
if (process.argv.length < 3) {
  console.error('Please provide an AWS CLI profile as an argument');
  process.exit(1);
}

const awsProfile = process.argv[2];
pullEnv(awsProfile);
