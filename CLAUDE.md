# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FHIR Pipeline is an event-driven healthcare data pipeline on Google Cloud Platform that:
- Ingests synthetic healthcare data from multiple sources (CSV and HL7v2)
- Automatically harmonizes data into FHIR R4 format via serverless functions
- Stores standardized data in Cloud Healthcare API FHIR stores
- Exposes data via a secure Node.js REST API
- Enables downstream analytics via BigQuery

## Architecture

```
Data Sources (CSV, HL7v2)
         ↓
GCS Landing Bucket (source prefixes: csv-ehr/, hl7v2/)
         ↓ [Object Finalize Event via Eventarc]
Cloud Run Harmonization Service
         ↓
Cloud Healthcare API (FHIR R4 Store)
         ↓
Node.js API (Secure Read-Only Proxy)
         ↓
BigQuery (Analytics)
```

**Key Design Principles:**
- GCS as ingestion boundary (all sources land as files)
- Event-driven processing (file uploads trigger transformation)
- Decoupled harmonization layer (source-agnostic transformation logic)

## Planned Project Structure

```
src/
  api/              # Node.js REST API (Express/NestJS)
  harmonization/    # Data transformation logic (CSV/HL7v2 → FHIR R4)
  ingestion/        # Source parsers for CSV and HL7v2
  gcp/              # GCP client libraries
sample-data/        # Sample patients.csv and messages.hl7
terraform/          # Infrastructure as Code for all GCP resources
```

## Technology Stack

- **Runtime:** Node.js
- **Cloud:** GCP (Cloud Run, Cloud Storage, Cloud Healthcare API, BigQuery, Eventarc)
- **Infrastructure:** Terraform
- **Data Formats:** CSV, HL7v2 (input) → FHIR R4 (output)

## API Endpoints

- `GET /patients?_count=5` - List patients with limit
- `GET /observations?_count=5` - List observations with limit
- `GET /analytics/summary` - Analytics aggregations from BigQuery

API secured via `x-api-key` header, read-only access only.

## FHIR Resources

The pipeline creates these FHIR R4 resources:
- **Patient** - Demographics from CSV or HL7v2 PID segment
- **Observation** - Clinical data from CSV or HL7v2 OBX segment

## Data Upload

```bash
# CSV upload
gsutil cp sample-data/patients.csv gs://<bucket>/csv-ehr/run_001/patients.csv

# HL7v2 upload
gsutil cp sample-data/messages.hl7 gs://<bucket>/hl7v2/run_001/messages.hl7
```

File uploads automatically trigger the harmonization service.
