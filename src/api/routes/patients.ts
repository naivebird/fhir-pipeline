import { Router, Request, Response } from 'express';
import { GoogleAuth } from 'google-auth-library';

const router = Router();

// Environment variables
const PROJECT_ID = process.env.PROJECT_ID || '';
const LOCATION = process.env.LOCATION || 'us-west2';
const DATASET_ID = process.env.DATASET_ID || 'fhir_dataset';
const FHIR_STORE_ID = process.env.FHIR_STORE_ID || 'fhir_r4_store';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-healthcare'],
});

const FHIR_BASE_URL = `https://healthcare.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/datasets/${DATASET_ID}/fhirStores/${FHIR_STORE_ID}/fhir`;

// GET /patients - List patients with optional pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const count = req.query._count as string | undefined;
    const pageToken = req.query._page as string | undefined;

    // Build query parameters
    const params = new URLSearchParams();
    if (count) {
      params.set('_count', count);
    }
    if (pageToken) {
      params.set('_page', pageToken);
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const url = `${FHIR_BASE_URL}/Patient${queryString}`;

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/fhir+json',
        Authorization: `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({
        error: 'FHIR API error',
        status: response.status,
        details: errorText,
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /patients/:id - Get a specific patient by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const url = `${FHIR_BASE_URL}/Patient/${id}`;

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/fhir+json',
        Authorization: `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({
        error: 'FHIR API error',
        status: response.status,
        details: errorText,
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
