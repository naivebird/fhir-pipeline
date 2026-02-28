import { Router, Request, Response } from 'express';
import { BigQuery } from '@google-cloud/bigquery';

const router = Router();

// Environment variables
const PROJECT_ID = process.env.PROJECT_ID || '';
const BIGQUERY_DATASET = process.env.BIGQUERY_DATASET || 'fhir_analytics';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
});

// GET /analytics/summary - Get summary analytics from BigQuery
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    // Query for patient count
    const patientCountQuery = `
      SELECT COUNT(*) as total_patients
      FROM \`${PROJECT_ID}.${BIGQUERY_DATASET}.Patient\`
    `;

    // Query for observation count by type
    const observationSummaryQuery = `
      SELECT
        code.coding[SAFE_OFFSET(0)].display as observation_type,
        code.coding[SAFE_OFFSET(0)].code as loinc_code,
        COUNT(*) as count,
        AVG(SAFE_CAST(value.quantity.value AS FLOAT64)) as avg_value,
        MIN(SAFE_CAST(value.quantity.value AS FLOAT64)) as min_value,
        MAX(SAFE_CAST(value.quantity.value AS FLOAT64)) as max_value
      FROM \`${PROJECT_ID}.${BIGQUERY_DATASET}.Observation\`
      GROUP BY observation_type, loinc_code
      ORDER BY count DESC
    `;

    // Query for patient demographics
    const demographicsQuery = `
      SELECT
        gender,
        COUNT(*) as count
      FROM \`${PROJECT_ID}.${BIGQUERY_DATASET}.Patient\`
      GROUP BY gender
    `;

    // Execute queries in parallel
    const [patientCountResult, observationResult, demographicsResult] = await Promise.all([
      bigquery.query({ query: patientCountQuery }).catch(() => [[{ total_patients: 0 }]]),
      bigquery.query({ query: observationSummaryQuery }).catch(() => [[]]),
      bigquery.query({ query: demographicsQuery }).catch(() => [[]]),
    ]);

    const summary = {
      timestamp: new Date().toISOString(),
      patients: {
        total: patientCountResult[0]?.[0]?.total_patients || 0,
        byGender: demographicsResult[0] || [],
      },
      observations: {
        byType: observationResult[0] || [],
      },
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching analytics:', error);

    // Return empty analytics if BigQuery tables don't exist yet
    if (error instanceof Error && error.message.includes('Not found')) {
      res.json({
        timestamp: new Date().toISOString(),
        message: 'No analytics data available yet. Upload some data first.',
        patients: {
          total: 0,
          byGender: [],
        },
        observations: {
          byType: [],
        },
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /analytics/observations/:code - Get statistics for a specific observation type
router.get('/observations/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const query = `
      SELECT
        SAFE_CAST(value.quantity.value AS FLOAT64) as value,
        value.quantity.unit as unit,
        effective.dateTime as date,
        subject.patientId as patient_id
      FROM \`${PROJECT_ID}.${BIGQUERY_DATASET}.Observation\`
      WHERE code.coding[SAFE_OFFSET(0)].code = @code
      ORDER BY effective.dateTime DESC
      LIMIT 100
    `;

    const [rows] = await bigquery.query({
      query,
      params: { code },
    });

    res.json({
      loincCode: code,
      observations: rows,
    });
  } catch (error) {
    console.error('Error fetching observation analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
