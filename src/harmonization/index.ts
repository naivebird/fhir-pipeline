import express, { Request, Response } from 'express';
import { GCSClient } from './gcs-client';
import { FHIRClient } from './fhir-client';
import { parseCSV } from './csv-parser';
import { parseHL7v2 } from './hl7v2-parser';
import { createFHIRBundle } from './fhir-mapper';

// Environment variables
const PROJECT_ID = process.env.PROJECT_ID || '';
const LOCATION = process.env.LOCATION || 'us-west2';
const DATASET_ID = process.env.DATASET_ID || 'fhir_dataset';
const FHIR_STORE_ID = process.env.FHIR_STORE_ID || 'fhir_r4_store';
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

const gcsClient = new GCSClient();
const fhirClient = new FHIRClient(PROJECT_ID, LOCATION, DATASET_ID, FHIR_STORE_ID);

// CloudEvent structure from Eventarc GCS trigger
interface CloudEvent {
  specversion: string;
  type: string;
  source: string;
  subject?: string;
  id: string;
  time: string;
  datacontenttype: string;
  data: {
    bucket: string;
    name: string;
    metageneration: string;
    timeCreated: string;
    updated: string;
    contentType?: string;
    size?: string;
  };
}

// Health check endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'fhir-harmonization' });
});

// CloudEvent handler endpoint
app.post('/', async (req: Request, res: Response) => {
  try {
    console.log('Received request headers:', JSON.stringify(req.headers));
    console.log('Received request body:', JSON.stringify(req.body));

    // Extract CloudEvent data - handle different formats
    let bucket: string;
    let fileName: string;

    // Check if it's a direct GCS notification format or CloudEvent wrapped
    if (req.body.bucket && req.body.name) {
      // Direct format
      bucket = req.body.bucket;
      fileName = req.body.name;
    } else if (req.body.data?.bucket && req.body.data?.name) {
      // CloudEvent wrapped format
      bucket = req.body.data.bucket;
      fileName = req.body.data.name;
    } else if (req.body.message?.data) {
      // Pub/Sub wrapped format (base64 encoded)
      const decoded = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString());
      bucket = decoded.bucket;
      fileName = decoded.name;
    } else {
      console.error('Unknown event format:', req.body);
      res.status(400).json({ error: 'Unknown event format' });
      return;
    }

    console.log(`Received event for file: gs://${bucket}/${fileName}`);

    // Check if we should process this file
    if (!gcsClient.shouldProcess(fileName)) {
      console.log(`Skipping file: ${fileName} (not a processable file)`);
      res.status(200).json({ message: 'Skipped - not a processable file' });
      return;
    }

    // Determine file type from path prefix
    const fileType = gcsClient.getFileType(fileName);
    console.log(`Processing ${fileType} file: ${fileName}`);

    // Download file from GCS
    const content = await gcsClient.downloadFile(bucket, fileName);
    console.log(`Downloaded file: ${content.length} bytes`);

    let bundle;
    let responseData: Record<string, unknown>;

    if (fileType === 'synthea') {
      // Synthea files are already FHIR bundles - just parse and POST directly
      bundle = JSON.parse(content);
      console.log(`Loaded Synthea FHIR bundle with ${bundle.entry?.length || 0} entries`);

      // Execute bundle against FHIR store
      const result = await fhirClient.executeBundle(bundle);
      console.log('FHIR bundle executed successfully');

      const successCount = result.entry?.filter((e: { response?: { status?: string } }) =>
        e.response?.status?.startsWith('20')
      ).length || 0;
      const errorCount = (result.entry?.length || 0) - successCount;

      console.log(`Results: ${successCount} succeeded, ${errorCount} failed`);

      responseData = {
        message: 'Synthea bundle processed successfully',
        file: fileName,
        bundleEntriesProcessed: bundle.entry?.length || 0,
        successCount,
        errorCount,
      };
    } else {
      // CSV and HL7v2 need parsing and transformation
      let parsedData;
      if (fileType === 'csv') {
        parsedData = parseCSV(content);
      } else if (fileType === 'hl7v2') {
        parsedData = parseHL7v2(content);
      } else {
        res.status(400).json({ error: 'Unknown file type' });
        return;
      }

      console.log(`Parsed ${parsedData.patients.length} patients and ${parsedData.observations.length} observations`);

      // Create FHIR bundle
      bundle = createFHIRBundle(parsedData);
      console.log(`Created FHIR bundle with ${bundle.entry?.length || 0} entries`);

      // Execute bundle against FHIR store
      const result = await fhirClient.executeBundle(bundle);
      console.log('FHIR bundle executed successfully');

      const successCount = result.entry?.filter((e) =>
        e.response?.status?.startsWith('20')
      ).length || 0;
      const errorCount = (result.entry?.length || 0) - successCount;

      console.log(`Results: ${successCount} succeeded, ${errorCount} failed`);

      responseData = {
        message: 'File processed successfully',
        file: fileName,
        patientsCreated: parsedData.patients.length,
        observationsCreated: parsedData.observations.length,
        bundleEntriesProcessed: bundle.entry?.length || 0,
        successCount,
        errorCount,
      };
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({
      error: 'Failed to process file',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Harmonization service listening on port ${PORT}`);
  console.log(`Project: ${PROJECT_ID}, Location: ${LOCATION}`);
  console.log(`Dataset: ${DATASET_ID}, FHIR Store: ${FHIR_STORE_ID}`);
});
