import { z } from 'zod';

const MAILER_PROVIDER = z
  .enum(['nodemailer', 'resend'])
  .default('nodemailer')
  .parse(process.env.MAILER_PROVIDER);

/**
 * @description Get the mailer based on the environment variable.
 */
export async function getMailer() {
  switch (MAILER_PROVIDER) {
    case 'nodemailer':
      return getNodemailer();

    case 'resend': {
      const { createResendMailer } = await import('@kit/resend');

      return createResendMailer();
    }

    default:
      throw new Error(`Invalid mailer: ${MAILER_PROVIDER as string}`);
  }
}

async function getNodemailer() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { createNodemailerService } = await import('@kit/nodemailer');

    return createNodemailerService();
  } else {
    throw new Error(
      'Nodemailer is not available on the edge runtime. Please use another mailer.',
    );
  }
}