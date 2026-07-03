terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# -----------------------------------------------------------------------------
# Artifact Registry Repository
# -----------------------------------------------------------------------------
resource "google_artifact_registry_repository" "syncdeck_repo" {
  location      = var.gcp_region
  repository_id = "${var.app_name}-repo"
  description   = "Docker container repository for SyncDeck"
  format        = "DOCKER"
}

# -----------------------------------------------------------------------------
# Secret Manager Secrets
# -----------------------------------------------------------------------------
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "refresh_secret" {
  length  = 64
  special = false
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${var.app_name}-jwt-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret_val" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

resource "google_secret_manager_secret" "refresh_secret" {
  secret_id = "${var.app_name}-refresh-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "refresh_secret_val" {
  secret      = google_secret_manager_secret.refresh_secret.id
  secret_data = random_password.refresh_secret.result
}

# -----------------------------------------------------------------------------
# Cloud Run Service (Production App)
# -----------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "syncdeck_app" {
  name     = var.app_name
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    session_affinity = true

    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = "2000m"
          memory = "2Gi"
        }
      }

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "APP_ORIGIN"
        value = var.app_domain
      }

      env {
        name  = "APP_URL"
        value = var.app_domain
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "REFRESH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.refresh_secret.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/v1/health"
          port = 3000
        }
        initial_delay_seconds = 10
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/api/v1/health"
          port = 3000
        }
        period_seconds = 30
      }
    }
  }
}

# Allow unauthenticated invocation (public traffic through Cloud Run / Load Balancer)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.syncdeck_app.location
  name     = google_cloud_run_v2_service.syncdeck_app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
