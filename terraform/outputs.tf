output "cloud_run_url" {
  value       = google_cloud_run_v2_service.syncdeck_app.uri
  description = "The public HTTPS URL of the deployed Cloud Run service."
}

output "artifact_registry_repo" {
  value       = google_artifact_registry_repository.syncdeck_repo.id
  description = "The Artifact Registry repository ID."
}

output "health_check_url" {
  value       = "${google_cloud_run_v2_service.syncdeck_app.uri}/api/v1/health/ready"
  description = "The readiness health check endpoint for load balancer integration."
}
