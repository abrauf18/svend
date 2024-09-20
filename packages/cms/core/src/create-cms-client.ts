import { CmsClient, CmsType } from '@kit/cms-types';

/**
 * The type of CMS client to use.
 */
const CMS_CLIENT = process.env.CMS_CLIENT as CmsType;

/**
 * Creates a CMS client based on the specified type.
 *
 * @param {CmsType} type - The type of CMS client to create. Defaults to the value of the CMS_CLIENT environment variable.
 * @returns {Promise<CmsClient>} A Promise that resolves to the created CMS client.
 * @throws {Error} If the specified CMS type is unknown.
 */
export async function createCmsClient(
  type: CmsType = CMS_CLIENT,
): Promise<CmsClient> {
  return cmsClientFactory(type);
}

/**
 * Creates a CMS client based on the specified type.
 *
 * @param {CmsType} type - The type of CMS client to create.
 * @returns {Promise<CmsClient>} A Promise that resolves to the created CMS client.
 */
async function cmsClientFactory(type: CmsType): Promise<CmsClient> {
  switch (type) {
    case 'wordpress': {
      const { createWordpressClient } = await import('@kit/wordpress');

      return createWordpressClient();
    }

    case 'keystatic': {
      const { createKeystaticClient } = await import('@kit/keystatic');

      return createKeystaticClient();
    }

    default:
      throw new Error(`Unknown CMS type`);
  }
}
