variable "gcp_project_id" {
  type        = string
  description = "The GCP Project ID where resources will be provisioned."
}

variable "gcp_region" {
  type        = string
  default     = "us-central1"
  description = "Primary GCP region for Cloud Run, Cloud SQL, and Memorystore Redis."
}

variable "app_name" {
  type        = string
  default     = "syncdeck"
  description = "Application prefix used for resource naming."
}

variable "app_domain" {
  type        = string
  default     = "https://app.syncdeck.example.com"
  description = "Public domain URL of the deployed application (used for CORS and socket origins)."
}

variable "container_image" {
  type        = string
  description = "Full Artifact Registry URI of the built container image (e.g. us-central1-docker.pkg.dev/PROJECT/repo/syncdeck:latest)."
}

variable "github_repo" {
  type        = string
  description = "GitHub repository in 'owner/repo' format used for Workload Identity Federation. e.g. 'myorg/syncdeck'."
}

variable "ops_alert_email" {
  type        = string
  description = "Email address to send Cloud Monitoring alert notifications to."
}
