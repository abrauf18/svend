import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

/**
 * @name PlaidService
 * @description Service for Plaid API operations
 */
class PlaidService {
  private client: PlaidApi;

  constructor() {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });

    this.client = new PlaidApi(configuration);
  }

  getClient(): PlaidApi {
    return this.client;
  }
}

/**
 * Creates an instance of the PlaidService.
 * @returns A Plaid API client instance
 */
export function createPlaidClient(): PlaidApi {
  return new PlaidService().getClient();
} 
