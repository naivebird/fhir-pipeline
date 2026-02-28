# FHIR Pipeline – README

**Author:** Duc Ho  
**Date:** 2026-02-26

---

## 1. Project Goal

This project demonstrates a minimal but realistic, event-driven healthcare data pipeline on Google Cloud.

The design simulates how diverse healthcare data sources (CSV, HL7v2, etc.) are landed into cloud storage, automatically harmonized into FHIR R4 resources, and exposed securely via a backend API.

Key objectives:

- Ingest synthetic healthcare data from multiple sources (CSV + HL7v2)
- Use **GCS as a landing zone** for batch uploads
- Trigger **serverless harmonization functions** on file upload
- Transform source data into FHIR R4 (Patient + Observation)
- Store resources in Cloud Healthcare API FHIR store
- Provide a secure Node.js API for read-only access
- Deploy infrastructure using Terraform

> This is a 1-week demo project inspired by the Careplicity backend role, focusing on ingestion, harmonization, secure APIs, and GCP infrastructure.

About the Role & Project

We are building a scalable, Google Cloud-powered backend to unify healthcare data for the existing Careplicity application and future projects in the healthcare space. This project includes migrating existing user data from Supabase (Postgres) to GCP, implementing the Cloud Healthcare API, Healthcare Data Engine (HDE), BigQuery, and FHIR stores. A key goal is to harmonize diverse data sources (EHR, HL7v2, unstructured documents, etc.) into FHIR standards and enable Generative AI-powered search and analytics.

As a Backend/Data Developer, you'll focus on data flows, data harmonization pipelines, secure APIs, and infrastructure—laying the compliant foundation for AI-driven insights and personalized care.

Job Responsibilities:

- Design and implement data ingestion (batch/streaming) from sources into Cloud Healthcare API FHIR stores (using MLLP adapter for HL7v2, GCS/BigQuery for batch)
- Build harmonization logic: Use Data Mapper IDE (or Whistle/VS Code) for mapping/transforming CSV/JSON/HL7v2 → FHIR R4; handle reconciliation, terminology alignment
- Develop Node.js backend services/APIs (Express/NestJS) to proxy/authenticate calls from Careplicity frontend to GCP (FHIR CRUD/search, Vertex AI Search)
- Set up de-identification, governance, provenance tracking, and compliance controls (HIPAA/PHIPA)
- Integrate with analytics: Export harmonized FHIR to BigQuery; create flattened views/SQL for Looker dashboards
- Prototype MLOps elements: Pipelines feeding Vertex AI/Gemini for use cases (risk prediction, adherence)
- Manage GCP infrastructure (Terraform/Deployment Manager), monitoring, and CI/CD
- Work with synthetic data (Synthea) for testing; ensure secure handling of PHI

---

## 2. Architecture Overview (Event-Driven Design)

```
User / CLI / External System
        ↓
GCS Landing Bucket (source prefixes)
        ↓ (Object Finalize Event)
Cloud Run / Serverless Harmonization Service
        ↓
Cloud Healthcare API (FHIR R4 Store)
        ↓
Node.js API (Secure Read-Only Proxy)
        ↓
Employer / Postman / Demo Client
        ↓
BigQuery (Analytics)
```

### Design Principles

- **GCS as ingestion boundary**: All sources land as files.
- **Event-driven processing**: File upload automatically triggers transformation.
- **Pluggable ingestion**: Future streaming/API ingestion can write to the same bucket.
- **Decoupled harmonization layer**: Same transformation logic reused regardless of source.

---

## 3. Data Ingestion Design

### 3.1 Landing Bucket Strategy

Single bucket with source-based prefixes:

```
gs://<project>-health-landing/
  ├── csv-ehr/
  ├── hl7v2/
  └── processed/
```

Users can upload data via:

```bash
gsutil cp sample-data/patients.csv gs://<bucket>/csv-ehr/run_001/patients.csv

gsutil cp sample-data/messages.hl7 gs://<bucket>/hl7v2/run_001/messages.hl7
```

Uploading a file triggers the harmonization service.

---

### 3.2 Serverless Harmonization Service

Triggered by GCS object finalize event.

Responsibilities:

- Detect source type from object path
- Parse input file
  - CSV → structured mapping
  - HL7v2 → simplified PID + OBX parsing
- Transform to FHIR R4 resources
- Create FHIR Bundle
- Upload bundle to Cloud Healthcare API
- Optionally write marker file to `/processed/`

This simulates production ingestion architecture without implementing full MLLP streaming.

---

## 4. Backend API (Secure Access Layer)

### Purpose

The Node.js API acts as a secure gateway between clients and GCP healthcare infrastructure.

It prevents direct exposure of the FHIR store and service account credentials.

### Endpoints

- `GET /patients?_count=5`
- `GET /observations?_count=5`
- `GET /analytics/summary`

### Security

- Protected via API key (`x-api-key` header)
- Read-only endpoints
- No direct write access to FHIR store
- Uses service account authentication internally

Example:

```bash
curl -H "x-api-key: DEMO_KEY" https://demo-api-url/patients?_count=5
```

---

## 5. FHIR Store

- Created via Terraform
- Version: R4
- Initially empty
- Populated only via harmonization service
- Stores:
  - Patient
  - Observation

The FHIR store acts as the standardized persistence layer.

---

## 6. Analytics (BigQuery)

- Enable FHIR → BigQuery export
- Create simple aggregation query:
  - Count observations per patient
- Expose via:
  - `GET /analytics/summary`

This demonstrates downstream analytics readiness.

---

## 7. Sample Data

### 7.1 CSV Example (`sample-data/patients.csv`)

| patient_id | first_name | last_name | birth_date | gender | observation_code | observation_value | observation_unit | observation_date |
|------------|------------|-----------|------------|--------|-----------------|------------------|------------------|------------------|
| P001 | John | Smith | 1980-02-15 | male | BP | 120/80 | mmHg | 2026-02-25 |
| P002 | Jane | Doe | 1992-07-09 | female | HR | 72 | bpm | 2026-02-25 |
| P003 | Bob | Lee | 1975-11-30 | male | TEMP | 37.1 | C | 2026-02-25 |

---

### 7.2 HL7v2 Example (`sample-data/messages.hl7`)

```
MSH|^~\&|HIS|Hospital|EMR|Clinic|20260226||ADT^A01|1|P|2.5
PID|1||P001||Smith^John||19800215|M
OBX|1|NM|BP||120/80|mmHg
---
MSH|^~\&|HIS|Hospital|EMR|Clinic|20260226||ADT^A01|2|P|2.5
PID|1||P002||Doe^Jane||19920709|F
OBX|1|NM|TEMP||37.1|C
```

Simplified segments used:

- `PID` → Patient
- `OBX` → Observation

---

## 8. Terraform Deployment

Terraform provisions:

- Cloud Healthcare dataset
- FHIR store (R4)
- GCS landing bucket
- Cloud Run service (harmonization)
- Cloud Run service (API)
- Service account + IAM bindings
- Eventarc trigger (GCS → Cloud Run)

No manual console configuration required.

---

## 9. Folder Structure

```
project-root/
  ├─ src/
  │   ├─ api/
  │   ├─ harmonization/
  │   ├─ ingestion/
  │   └─ gcp/
  ├─ sample-data/
  │   ├─ patients.csv
  │   └─ messages.hl7
  ├─ terraform/
  └─ README.md
```

---

## 10. Out-of-Scope (1-Week Demo)

- Full MLLP adapter
- Streaming HL7 over TCP
- Full de-identification engine
- Healthcare Data Engine
- Complex RBAC
- CI/CD pipeline

---

## 11. Success Criteria

- Uploading file to GCS automatically triggers harmonization
- CSV + HL7v2 successfully transformed to FHIR
- FHIR store populated
- API returns live data
- Analytics endpoint works
- Infrastructure fully provisioned via Terraform

---

## 12. Why This Design Matters

This architecture demonstrates:

- Event-driven ingestion
- Decoupled harmonization layer
- Pluggable data sources
- Secure API proxy pattern
- Cloud-native healthcare backend design

It closely mirrors real healthcare platforms where batch uploads, streaming ingestion, and API feeds can all land in a storage boundary and reuse the same transformation pipeline.

