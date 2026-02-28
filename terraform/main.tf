terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "healthcare.googleapis.com",
    "run.googleapis.com",
    "eventarc.googleapis.com",
    "storage.googleapis.com",
    "cloudbuild.googleapis.com",
    "bigquery.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# -------------------------------------------------------------------
# GCS Landing Bucket
# -------------------------------------------------------------------
resource "google_storage_bucket" "landing_bucket" {
  name          = "${var.project_id}-${var.bucket_name_suffix}"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  versioning {
    enabled = false
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Create placeholder objects to establish prefix structure
resource "google_storage_bucket_object" "csv_prefix" {
  name    = "csv-ehr/.gitkeep"
  content = " "
  bucket  = google_storage_bucket.landing_bucket.name
}

resource "google_storage_bucket_object" "hl7v2_prefix" {
  name    = "hl7v2/.gitkeep"
  content = " "
  bucket  = google_storage_bucket.landing_bucket.name
}

resource "google_storage_bucket_object" "processed_prefix" {
  name    = "processed/.gitkeep"
  content = " "
  bucket  = google_storage_bucket.landing_bucket.name
}

resource "google_storage_bucket_object" "synthea_prefix" {
  name    = "synthea/.gitkeep"
  content = " "
  bucket  = google_storage_bucket.landing_bucket.name
}

# -------------------------------------------------------------------
# Service Account for Harmonization Service
# -------------------------------------------------------------------
resource "google_service_account" "harmonization_sa" {
  account_id   = "fhir-harmonization-sa"
  display_name = "FHIR Harmonization Service Account"
  description  = "Service account for the harmonization Cloud Run service"

  depends_on = [google_project_service.required_apis]
}

# Grant FHIR Resource Editor role
resource "google_project_iam_member" "harmonization_fhir_editor" {
  project = var.project_id
  role    = "roles/healthcare.fhirResourceEditor"
  member  = "serviceAccount:${google_service_account.harmonization_sa.email}"
}

# Grant GCS Object Viewer role for reading uploaded files
resource "google_project_iam_member" "harmonization_gcs_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.harmonization_sa.email}"
}

# Grant GCS Object Creator role for moving processed files
resource "google_project_iam_member" "harmonization_gcs_creator" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.harmonization_sa.email}"
}

# Grant Eventarc Event Receiver role
resource "google_project_iam_member" "harmonization_eventarc_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.harmonization_sa.email}"
}

# -------------------------------------------------------------------
# Service Account for API Service
# -------------------------------------------------------------------
resource "google_service_account" "api_sa" {
  account_id   = "fhir-api-sa"
  display_name = "FHIR API Service Account"
  description  = "Service account for the API Cloud Run service"

  depends_on = [google_project_service.required_apis]
}

# Grant FHIR Resource Reader role for API
resource "google_project_iam_member" "api_fhir_reader" {
  project = var.project_id
  role    = "roles/healthcare.fhirResourceReader"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

# Grant BigQuery Data Viewer role for analytics
resource "google_project_iam_member" "api_bigquery_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

# Grant BigQuery Job User role for running queries
resource "google_project_iam_member" "api_bigquery_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

# -------------------------------------------------------------------
# Cloud Healthcare API Dataset and FHIR Store
# -------------------------------------------------------------------
resource "google_healthcare_dataset" "fhir_dataset" {
  name     = var.dataset_id
  location = var.location

  depends_on = [google_project_service.required_apis]
}

resource "google_healthcare_fhir_store" "fhir_store" {
  name    = var.fhir_store_id
  dataset = google_healthcare_dataset.fhir_dataset.id
  version = "R4"

  enable_update_create          = true
  disable_referential_integrity = false

  # Enable BigQuery streaming for analytics
  stream_configs {
    bigquery_destination {
      dataset_uri = "bq://${var.project_id}.${google_bigquery_dataset.fhir_analytics.dataset_id}"
      schema_config {
        recursive_structure_depth = 3
        schema_type              = "ANALYTICS_V2"
      }
    }
  }

  depends_on = [
    google_healthcare_dataset.fhir_dataset,
    google_bigquery_dataset.fhir_analytics,
    google_project_iam_member.healthcare_bigquery_editor,
    google_project_iam_member.healthcare_bigquery_user
  ]
}

# -------------------------------------------------------------------
# BigQuery Dataset for Analytics
# -------------------------------------------------------------------
resource "google_bigquery_dataset" "fhir_analytics" {
  dataset_id  = "fhir_analytics"
  location    = var.region
  description = "BigQuery dataset for FHIR analytics data"

  delete_contents_on_destroy = true

  depends_on = [google_project_service.required_apis]
}

# Grant Healthcare Service Agent access to BigQuery for FHIR streaming
data "google_project" "project" {
}

resource "google_project_iam_member" "healthcare_bigquery_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-healthcare.iam.gserviceaccount.com"

  depends_on = [google_project_service.required_apis]
}

resource "google_project_iam_member" "healthcare_bigquery_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-healthcare.iam.gserviceaccount.com"

  depends_on = [google_project_service.required_apis]
}

# -------------------------------------------------------------------
# Cloud Run - Harmonization Service
# -------------------------------------------------------------------
resource "google_cloud_run_v2_service" "harmonization" {
  name     = var.harmonization_service_name
  location = var.region

  template {
    service_account = google_service_account.harmonization_sa.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "LOCATION"
        value = var.location
      }
      env {
        name  = "DATASET_ID"
        value = var.dataset_id
      }
      env {
        name  = "FHIR_STORE_ID"
        value = var.fhir_store_id
      }
      env {
        name  = "BUCKET_NAME"
        value = google_storage_bucket.landing_bucket.name
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_service_account.harmonization_sa
  ]
}

# -------------------------------------------------------------------
# Cloud Run - API Service
# -------------------------------------------------------------------
resource "google_cloud_run_v2_service" "api" {
  name     = var.api_service_name
  location = var.region

  template {
    service_account = google_service_account.api_sa.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "LOCATION"
        value = var.location
      }
      env {
        name  = "DATASET_ID"
        value = var.dataset_id
      }
      env {
        name  = "FHIR_STORE_ID"
        value = var.fhir_store_id
      }
      env {
        name  = "API_KEY"
        value = var.api_key
      }
      env {
        name  = "BIGQUERY_DATASET"
        value = google_bigquery_dataset.fhir_analytics.dataset_id
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 8080
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_service_account.api_sa
  ]
}

# Allow unauthenticated access to API (protected by API key)
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -------------------------------------------------------------------
# Eventarc Trigger - GCS to Harmonization Service
# -------------------------------------------------------------------

# Grant GCS service account permission to publish events
data "google_storage_project_service_account" "gcs_account" {
}

resource "google_project_iam_member" "gcs_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}

resource "google_eventarc_trigger" "gcs_trigger" {
  name     = "fhir-gcs-trigger"
  location = var.region

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.storage.object.v1.finalized"
  }

  matching_criteria {
    attribute = "bucket"
    value     = google_storage_bucket.landing_bucket.name
  }

  destination {
    cloud_run_service {
      service = google_cloud_run_v2_service.harmonization.name
      region  = var.region
    }
  }

  service_account = google_service_account.harmonization_sa.email

  depends_on = [
    google_project_iam_member.gcs_pubsub_publisher,
    google_project_iam_member.harmonization_eventarc_receiver,
    google_cloud_run_v2_service.harmonization
  ]
}
