output "landing_bucket_name" {
  description = "Name of the GCS landing bucket"
  value       = google_storage_bucket.landing_bucket.name
}

output "landing_bucket_url" {
  description = "URL of the GCS landing bucket"
  value       = google_storage_bucket.landing_bucket.url
}

output "fhir_store_path" {
  description = "Full path to the FHIR store"
  value       = google_healthcare_fhir_store.fhir_store.id
}

output "fhir_store_url" {
  description = "FHIR store base URL for API calls"
  value       = "https://healthcare.googleapis.com/v1/${google_healthcare_fhir_store.fhir_store.id}/fhir"
}

output "harmonization_service_url" {
  description = "URL of the harmonization Cloud Run service"
  value       = google_cloud_run_v2_service.harmonization.uri
}

output "api_service_url" {
  description = "URL of the API Cloud Run service"
  value       = google_cloud_run_v2_service.api.uri
}

output "harmonization_sa_email" {
  description = "Email of the harmonization service account"
  value       = google_service_account.harmonization_sa.email
}

output "api_sa_email" {
  description = "Email of the API service account"
  value       = google_service_account.api_sa.email
}

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID for analytics"
  value       = google_bigquery_dataset.fhir_analytics.dataset_id
}

output "upload_csv_command" {
  description = "Example command to upload CSV data"
  value       = "gsutil cp sample-data/patients.csv gs://${google_storage_bucket.landing_bucket.name}/csv-ehr/run_001/patients.csv"
}

output "upload_hl7v2_command" {
  description = "Example command to upload HL7v2 data"
  value       = "gsutil cp sample-data/messages.hl7 gs://${google_storage_bucket.landing_bucket.name}/hl7v2/run_001/messages.hl7"
}
