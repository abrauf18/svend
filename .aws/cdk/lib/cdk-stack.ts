import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Create a new secret with versioning enabled
    const secret = new cdk.aws_secretsmanager.Secret(this, 'SvendAppLocalEnv', {
      secretName: 'svend-app-local-env',
      secretStringValue: cdk.SecretValue.unsafePlainText('{}'),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      description: 'Secret for Svend App Local Environment'
    });

    // Output the secret ARN
    new cdk.CfnOutput(this, 'SvendAppLocalEnvSecretArn', {
      value: secret.secretArn,
      description: 'The ARN of the secret'
    });
  }
}
