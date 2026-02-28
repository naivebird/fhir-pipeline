variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-west2"
}

variable "location" {
  description = "GCP location for Healthcare API (regional)"
  type        = string
  default     = "us-west2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "bucket_name_suffix" {
  description = "Suffix for GCS bucket name (will be prefixed with project ID)"
  type        = string
  default     = "fhir-landing"
}

variable "dataset_id" {
  description = "Healthcare API dataset ID"
  type        = string
  default     = "fhir_dataset"
}

variable "fhir_store_id" {
  description = "FHIR store ID within the dataset"
  type        = string
  default     = "fhir_r4_store"
}

variable "harmonization_service_name" {
  description = "Name of the harmonization Cloud Run service"
  type        = string
  default     = "fhir-harmonization"
}

variable "api_service_name" {
  description = "Name of the API Cloud Run service"
  type        = string
  default     = "fhir-api"
}

variable "api_key" {
  description = "API key for securing the REST API"
  type        = string
  sensitive   = true
  default     = "DEMO_API_KEY_CHANGE_IN_PRODUCTION"
}
