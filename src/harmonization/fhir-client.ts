import { GoogleAuth } from 'google-auth-library';
import { FHIRBundle, FHIRBundleResponse } from '../types';

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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR bundle execution failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = (await response.json()) as FHIRBundleResponse;
    return result;
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
