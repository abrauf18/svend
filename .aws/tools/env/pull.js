import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { writeFileSync } from 'fs';

const envFileName = '.env.aws.local';

async function pullEnv(profile, outputPath) {
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

      writeFileSync(`${outputPath}/${envFileName}`, envContent);
      console.log(`Successfully created ${envFileName} in ${outputPath}`);
    } else {
      console.error('Secret value is not a string');
    }
  } catch (error) {
    console.error('Error retrieving secret:', error);
  }
}

if (process.argv.length < 4) {
  console.error('Usage: node pull.js <aws-profile> <output-path>');
  process.exit(1);
}

const awsProfile = process.argv[2];
const outputPath = process.argv[3];
pullEnv(awsProfile, outputPath);
