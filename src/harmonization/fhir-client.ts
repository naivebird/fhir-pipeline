import { GoogleAuth } from 'google-auth-library';
import { FHIRBundle, FHIRBundleResponse } from '../types';

const MAX_BUNDLE_SIZE = 2000; // Keep well under 4500 API limit and 11k/min quota
const CHUNK_DELAY_MS = 30000; // 30s delay between chunks to respect rate limits
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 60000; // 60s base delay for retry on 429

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FHIRClient {
  private auth: GoogleAuth;
  private fhirStoreUrl: string;

  constructor(projectId: string, location: string, datasetId: string, fhirStoreId: string) {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-healthcare'],
    });

    this.fhirStoreUrl = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${datasetId}/fhirStores/${fhirStoreId}/fhir`;
  }

  async executeBundle(bundle: FHIRBundle): Promise<FHIRBundleResponse> {
    const entries = bundle.entry || [];

    // Split into chunks if bundle exceeds max size
    if (entries.length <= MAX_BUNDLE_SIZE) {
      return this.executeSingleBundle(bundle);
    }

    console.log(`Bundle has ${entries.length} entries, splitting into chunks of ${MAX_BUNDLE_SIZE}`);
    const allResponseEntries: FHIRBundleResponse['entry'] = [];

    for (let i = 0; i < entries.length; i += MAX_BUNDLE_SIZE) {
      const chunk = entries.slice(i, i + MAX_BUNDLE_SIZE);
      const chunkBundle: FHIRBundle = {
        resourceType: 'Bundle',
        type: bundle.type,
        entry: chunk,
      };

      const chunkNum = Math.floor(i / MAX_BUNDLE_SIZE) + 1;
      const totalChunks = Math.ceil(entries.length / MAX_BUNDLE_SIZE);

      // Wait between chunks to avoid rate limiting
      if (i > 0) {
        console.log(`Waiting ${CHUNK_DELAY_MS / 1000}s before next chunk...`);
        await delay(CHUNK_DELAY_MS);
      }

      console.log(`Executing chunk ${chunkNum}/${totalChunks} (${chunk.length} entries)`);
      const result = await this.executeSingleBundle(chunkBundle);

      if (result.entry) {
        allResponseEntries.push(...result.entry);
      }
    }

    return {
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: allResponseEntries,
    } as FHIRBundleResponse;
  }

  private async executeSingleBundle(bundle: FHIRBundle): Promise<FHIRBundleResponse> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();

      const response = await fetch(this.fhirStoreUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
          Authorization: `Bearer ${accessToken.token}`,
        },
        body: JSON.stringify(bundle),
      });

      if (response.ok) {
        return (await response.json()) as FHIRBundleResponse;
      }

      // Retry on 429 (rate limit) with exponential backoff
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Rate limited (429). Retrying in ${retryDelay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await delay(retryDelay);
        continue;
      }

      const errorText = await response.text();
      throw new Error(`FHIR bundle execution failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    throw new Error('Max retries exceeded');
  }

  async searchResource(resourceType: string, params?: Record<string, string>): Promise<FHIRBundle> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();

    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';

    const response = await fetch(`${this.fhirStoreUrl}/${resourceType}${queryString}`, {
      method: 'GET',
      headers: {
        Accept: 'application/fhir+json',
        Authorization: `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR search failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = (await response.json()) as FHIRBundle;
    return result;
  }
}
