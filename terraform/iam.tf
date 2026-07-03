# -----------------------------------------------------------------------
# terraform/iam.tf
#
# IAM Service Accounts and role bindings for SyncDeck GCP deployment.
# Follows principle of least privilege.
# -----------------------------------------------------------------------

# ─── Cloud Run Runtime Service Account ────────────────────────────────────────
# Dedicated SA for the Cloud Run service (replaces default Compute SA)
resource "google_service_account" "cloud_run_sa" {
  account_id   = "${var.app_name}-run-sa"
  display_name = "SyncDeck Cloud Run Runtime Service Account"
  description  = "Least-privilege SA for the SyncDeck Cloud Run service"
}

# Allow Cloud Run SA to read secrets from Secret Manager
resource "google_project_iam_member" "cloud_run_secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Allow Cloud Run SA to write structured logs
resource "google_project_iam_member" "cloud_run_log_writer" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Allow Cloud Run SA to write metrics
resource "google_project_iam_member" "cloud_run_metric_writer" {
  project = var.gcp_project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Allow Cloud Run SA to connect to Cloud SQL via Cloud SQL Proxy
resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.gcp_project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ─── GitHub Actions Deployer Service Account ──────────────────────────────────
# Dedicated SA for GitHub Actions CI/CD (used with Workload Identity Federation)
resource "google_service_account" "github_deployer_sa" {
  account_id   = "${var.app_name}-github-deployer"
  display_name = "SyncDeck GitHub Actions Deployer"
  description  = "SA used by GitHub Actions to build and deploy SyncDeck"
}

# Allow GitHub SA to push images to Artifact Registry
resource "google_project_iam_member" "github_artifact_writer" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_deployer_sa.email}"
}

# Allow GitHub SA to deploy to Cloud Run
resource "google_project_iam_member" "github_run_developer" {
  project = var.gcp_project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.github_deployer_sa.email}"
}

# Allow GitHub SA to act as Cloud Run runtime SA (to set SA on deploy)
resource "google_service_account_iam_member" "github_sa_user" {
  service_account_id = google_service_account.cloud_run_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deployer_sa.email}"
}

# Allow GitHub SA to execute Cloud Run Jobs (migrations)
resource "google_project_iam_member" "github_run_jobs_runner" {
  project = var.gcp_project_id
  role    = "roles/run.viewer"
  member  = "serviceAccount:${google_service_account.github_deployer_sa.email}"
}

# ─── Workload Identity Federation Pool for GitHub Actions ─────────────────────
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "${var.app_name}-github-pool"
  display_name              = "SyncDeck GitHub Actions Pool"
  description               = "WIF pool for GitHub Actions keyless auth"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "${var.app_name}-github-provider"
  display_name                       = "GitHub OIDC Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Allow GitHub Actions (via WIF) to impersonate the deployer SA
resource "google_service_account_iam_member" "github_wif_binding" {
  service_account_id = google_service_account.github_deployer_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# ─── Outputs ──────────────────────────────────────────────────────────────────
output "cloud_run_service_account_email" {
  value       = google_service_account.cloud_run_sa.email
  description = "Email of the Cloud Run runtime service account"
}

output "github_deployer_service_account_email" {
  value       = google_service_account.github_deployer_sa.email
  description = "Email of the GitHub Actions deployer service account"
}

output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Full WIF provider resource name — use as GCP_WORKLOAD_IDENTITY_PROVIDER secret in GitHub"
  sensitive   = false
}
