# FHIR Pipeline

A cloud-native, event-driven healthcare data pipeline on Google Cloud Platform. Ingests data from multiple formats (CSV, HL7v2, Synthea), harmonizes to FHIR R4, and exposes via a secure REST API.

## Architecture
![FHIR-pipeline](https://github.com/user-attachments/assets/00da22f9-8480-4407-819d-9e6fda8dba66)


## Quick Start

### Prerequisites

- GCP project with billing enabled
- `gcloud` CLI authenticated
- `terraform` >= 1.0
- Node.js >= 18

### 1. Deploy Infrastructure

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id and api_key

terraform init
terraform apply
```

### 2. Deploy Services

```bash
npm install
npm run build

export PROJECT_ID=your-project-id
./scripts/deploy-harmonization.sh
./scripts/deploy-api.sh
```

### 3. Test the Pipeline

```bash
# Upload sample data (triggers harmonization automatically)
gsutil cp sample-data/patients.csv gs://YOUR_BUCKET/csv-ehr/patients.csv
gsutil cp sample-data/messages.hl7 gs://YOUR_BUCKET/hl7v2/messages.hl7
```

## API Reference

Base URL: `https://fhir-api-xxxxx.run.app`

| Endpoint | Description |
|----------|-------------|
| `GET /patients?_count=N` | List patients |
| `GET /patients/:id` | Get patient by ID |
| `GET /observations?_count=N` | List observations |
| `GET /observations/:id` | Get observation by ID |
| `GET /analytics/summary` | Aggregated statistics |

**Authentication:** Pass `api_key` as query parameter or `x-api-key` header.

**Example:**
```bash
# Set your API endpoint and key
export API=https://YOUR_API_URL
export KEY=YOUR_API_KEY

# Query endpoints
curl "$API/patients?_count=5&api_key=$KEY"
curl "$API/observations?_count=10&api_key=$KEY"
curl "$API/analytics/summary?api_key=$KEY"
```

## Supported Data Formats

| Format | GCS Prefix | Processing |
|--------|------------|------------|
| CSV | `csv-ehr/` | Parse columns → Map to FHIR Patient/Observation |
| HL7v2 | `hl7v2/` | Parse PID/OBX segments → Map to FHIR |
| Synthea | `synthea/` | Direct passthrough (native FHIR bundles) |

## Testing with Synthea

[Synthea](https://github.com/synthetichealth/synthea) generates realistic synthetic patient data in FHIR format. This is useful for testing the pipeline with comprehensive clinical data.

### Prerequisites

```bash
# Install Java 17 (required for Synthea)
brew install openjdk@17
```

### Install Synthea

```bash
git clone https://github.com/synthetichealth/synthea.git
cd synthea
```

### Generate Synthetic Patients

```bash
# Generate 10 patients
./run_synthea -p 10

# Output location: ./output/fhir/
# Each patient generates a separate JSON bundle (500-3000+ FHIR resources each)
```

### Upload to Pipeline

```bash
# Upload all patient bundles
gcloud storage cp output/fhir/*.json gs://YOUR_BUCKET/synthea/
```

Then query via the API (see [API Reference](#api-reference)).

### Synthea Output Contents

Each Synthea bundle includes:
- **Patient** - Demographics, identifiers
- **Encounter** - Hospital visits, appointments
- **Condition** - Diagnoses (ICD-10, SNOMED)
- **Observation** - Vitals, lab results (LOINC)
- **Procedure** - Surgeries, treatments
- **MedicationRequest** - Prescriptions
- **Immunization** - Vaccination records
- **CarePlan** - Treatment plans
- **Claim/ExplanationOfBenefit** - Insurance data

All resources are stored in the FHIR store and queryable via the API.

## Project Structure

```
├── src/
│   ├── api/                  # REST API (Express)
│   │   ├── middleware/       # Auth middleware
│   │   └── routes/           # Endpoint handlers
│   ├── harmonization/        # Data transformation service
│   │   ├── csv-parser.ts     # CSV → intermediate format
│   │   ├── hl7v2-parser.ts   # HL7v2 → intermediate format
│   │   ├── fhir-mapper.ts    # Intermediate → FHIR R4
│   │   └── fhir-client.ts    # Healthcare API client
│   └── types/                # TypeScript definitions
├── terraform/                # Infrastructure as Code
├── sample-data/              # Test data (CSV, HL7v2)
└── scripts/                  # Deployment scripts
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage
```

**Test coverage includes:**
- CSV parser (parsing, gender normalization, observation extraction)
- HL7v2 parser (PID/OBX segment parsing, LOINC code mapping)
- FHIR mapper (Patient/Observation resource creation, bundle generation)
- Auth middleware (API key validation via header and query parameter)
- GCS client (file type detection, path filtering)

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **GCS as ingestion boundary** | Unified interface for batch/streaming; built-in audit trail; decouples sources from processing |
| **Event-driven processing** | Scales automatically; no polling; immediate processing on upload |
| **Single harmonization service** | Source-agnostic transformation; easy to add new formats |
| **API proxy pattern** | Hides service account credentials; enables rate limiting, caching, custom auth |
| **FHIR R4 standard** | Industry standard; interoperable; supported by Cloud Healthcare API |
| **Transaction bundles** | Atomic operations; Patient + Observations created together |

## Production Roadmap

This demo establishes the core architecture. For production deployment, consider:

### Reliability & Error Handling
- **Dead Letter Queue (DLQ)**: Route failed transformations to a separate queue for retry/inspection
- **Idempotency**: Track processed files to prevent duplicate resource creation on retries
- **Circuit breakers**: Graceful degradation when Healthcare API is unavailable

### Streaming Ingestion
- **MLLP Adapter**: Cloud Healthcare API's MLLP adapter for real-time HL7v2 from hospital systems
- **Pub/Sub ingestion**: Direct message publishing for real-time data sources
- **Change Data Capture**: Stream database changes via Datastream

### Security & Compliance
- **De-identification**: Cloud Healthcare API de-identification for PHI protection
- **VPC Service Controls**: Network-level isolation for healthcare data
- **Audit logging**: Cloud Audit Logs for compliance (HIPAA, PHIPA)
- **IAM refinement**: Least-privilege service accounts per function

### Data Quality
- **FHIR validation**: Validate resources against profiles before storage
- **Terminology binding**: LOINC, SNOMED CT, ICD-10 code validation
- **Data reconciliation**: Detect and merge duplicate patients (MPI)

### Operations
- **CI/CD**: Cloud Build pipelines for automated testing and deployment
- **Monitoring**: Custom metrics, alerting on error rates, latency SLOs
- **Schema evolution**: Versioned transformations for backward compatibility

### Analytics & AI
- **Looker dashboards**: Visual analytics on BigQuery exports
- **Vertex AI integration**: Risk prediction, care gap identification
- **Vector search**: Embeddings for semantic search across clinical notes

## Tech Stack

- **Runtime**: Node.js 20, TypeScript
- **Cloud**: GCP (Cloud Run, Cloud Storage, Cloud Healthcare API, BigQuery, Eventarc)
- **Infrastructure**: Terraform
- **Data Standards**: FHIR R4, LOINC

## License

MIT
