import express from 'express';
import { apiKeyAuth } from './middleware/auth';
import patientsRouter from './routes/patients';
import observationsRouter from './routes/observations';
import analyticsRouter from './routes/analytics';

const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

// Health check endpoint (no auth required)
app.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'fhir-api',
    version: '1.0.0',
    endpoints: {
      patients: '/patients',
      observations: '/observations',
      analytics: '/analytics/summary',
    },
  });
});

// Health check for Cloud Run
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Apply API key auth to all /patients, /observations, and /analytics routes
app.use('/patients', apiKeyAuth, patientsRouter);
app.use('/observations', apiKeyAuth, observationsRouter);
app.use('/analytics', apiKeyAuth, analyticsRouter);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`FHIR API server listening on port ${PORT}`);
  console.log(`Project: ${process.env.PROJECT_ID || '(not set)'}`);
  console.log(`FHIR Store: ${process.env.DATASET_ID || 'fhir_dataset'}/${process.env.FHIR_STORE_ID || 'fhir_r4_store'}`);
});
