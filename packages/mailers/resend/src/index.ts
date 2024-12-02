import 'server-only';

import { z } from 'zod';

import { Mailer, MailerSchema } from '@kit/mailers-shared';

type Config = z.infer<typeof MailerSchema>;

const RESEND_API_KEY = z
  .string({
    description: 'The API key for the Resend API',
    required_error: 'Please provide the API key for the Resend API',
  })
  .parse(process.env.RESEND_API_KEY);

export function createResendMailer() {
  return new ResendMailer();
}

/**
 * A class representing a mailer using the Resend HTTP API.
 * @implements {Mailer}
 */
class ResendMailer implements Mailer {
  async sendEmail(config: Config) {
    const contentObject =
      'text' in config
        ? {
            text: config.text,
          }
        : {
            html: config.html,
          };

    console.log(`[Resend] Sending email from ${config.from} to ${config.to} >> Subject: ${config.subject}`);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        to: [config.to],
        from: config.from,
        subject: config.subject,
        ...contentObject,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Resend] Failed to send email:', {
        status: res.status,
        error: data,
        to: config.to,
        from: config.from,
        responseData: data
      });
      throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
    }
  }
}
