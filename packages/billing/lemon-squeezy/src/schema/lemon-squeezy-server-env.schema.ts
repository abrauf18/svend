import { z } from 'zod';

/**
 * @name getLemonSqueezyEnv
 * @description Get the Lemon Squeezy environment variables.
 * It will throw an error if any of the required variables are missing.
 */
export const getLemonSqueezyEnv = () =>
  z
    .object({
      secretKey: z
        .string({
          description: `The secret key you created for your store. Please use the variable LEMON_SQUEEZY_SECRET_KEY to set it.`,
        })
        .min(1),
      webhooksSecret: z
        .string({
          description: `The shared secret you created for your webhook. Please use the variable LEMON_SQUEEZY_SIGNING_SECRET to set it.`,
        })
        .min(1)
        .max(40),
      storeId: z
        .string({
          description: `The ID of your store. Please use the variable LEMON_SQUEEZY_STORE_ID to set it.`,
        })
        .min(1),
    })
    .parse({
      secretKey: process.env.LEMON_SQUEEZY_SECRET_KEY,
      webhooksSecret: process.env.LEMON_SQUEEZY_SIGNING_SECRET,
      storeId: process.env.LEMON_SQUEEZY_STORE_ID,
    });
