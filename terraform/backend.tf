# -----------------------------------------------------------------------
# terraform/backend.tf
#
# Remote Terraform state stored in Google Cloud Storage.
# The GCS bucket must be created BEFORE running terraform init.
#
# Bootstrap command (run once, manually):
#   gcloud storage buckets create gs://<YOUR_PROJECT_ID>-tfstate \
#     --project=<YOUR_PROJECT_ID> \
#     --location=us-central1 \
#     --uniform-bucket-level-access \
#     --public-access-prevention
#
#   gcloud storage buckets update gs://<YOUR_PROJECT_ID>-tfstate \
#     --versioning
#
# Then update the bucket name below and run: terraform init
# -----------------------------------------------------------------------

terraform {
  backend "gcs" {
    # Replace with your GCP project ID + "-tfstate"
    # e.g.  "my-gcp-project-id-tfstate"
    bucket = "YOUR_PROJECT_ID-tfstate"
    prefix = "syncdeck/production"
  }
}
