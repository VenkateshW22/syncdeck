#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# SyncDeck — Automated GCP Production Deployment Script
# -----------------------------------------------------------------------------
# Usage:
#   chmod +x scripts/gcp-deploy.sh
#   ./scripts/gcp-deploy.sh <GCP_PROJECT_ID> [REGION] [APP_DOMAIN]
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (`gcloud auth login`)
#   - Active GCP Billing Account attached to the project
# -----------------------------------------------------------------------------

set -euo pipefail

PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
REGION="${2:-us-central1}"
APP_DOMAIN="${3:-https://syncdeck.app}"
REPO_NAME="syncdeck-repo"
SERVICE_NAME="syncdeck"
JOB_NAME="syncdeck-migrate"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: GCP Project ID is required."
  echo "Usage: ./scripts/gcp-deploy.sh <GCP_PROJECT_ID> [REGION] [APP_DOMAIN]"
  exit 1
fi

echo "============================================================"
echo "🚀 SyncDeck GCP Production Deployment"
echo "   Project ID : $PROJECT_ID"
echo "   Region     : $REGION"
echo "   App Domain : $APP_DOMAIN"
echo "   Image Tag  : $IMAGE_TAG"
echo "============================================================"

# 1. Set active project
gcloud config set project "$PROJECT_ID"

# 2. Enable Required APIs
echo "📡 Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  compute.googleapis.com \
  vhc.googleapis.com \
  servicenetworking.googleapis.com

# 3. Create Artifact Registry Repository (if it doesn't exist)
echo "📦 Ensuring Artifact Registry repository '$REPO_NAME' exists..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="SyncDeck production container images"
fi

IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:$IMAGE_TAG"
IMAGE_LATEST="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:latest"

# 4. Build & Push Image via Cloud Build
echo "🏗 Building container image via Cloud Build..."
gcloud builds submit --tag "$IMAGE_URI" .
gcloud container images add-tag "$IMAGE_URI" "$IMAGE_LATEST" --quiet

# 5. Helper function to ensure Secret Manager Secret exists
create_secret_if_missing() {
  local secret_name="$1"
  if ! gcloud secrets describe "$secret_name" &>/dev/null; then
    echo "🔑 Secret '$secret_name' missing in Secret Manager. Generating high-entropy secret..."
    local val
    val=$(python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(48)).decode())")
    printf "%s" "$val" | gcloud secrets create "$secret_name" --data-file=-
  else
    echo "✅ Secret '$secret_name' exists in Secret Manager."
  fi
}

echo "🔐 Checking Secret Manager secrets..."
create_secret_if_missing "syncdeck-jwt-secret"
create_secret_if_missing "syncdeck-refresh-secret"

# 6. Check for DATABASE_URL and REDIS_URL secrets
if ! gcloud secrets describe "syncdeck-db-url" &>/dev/null; then
  echo "⚠️ Secret 'syncdeck-db-url' is missing."
  echo "   Please create it using your Cloud SQL connection string:"
  echo "   echo -n 'postgresql://user:pass@IP:5432/syncdeck' | gcloud secrets create syncdeck-db-url --data-file=-"
fi

if ! gcloud secrets describe "syncdeck-redis-url" &>/dev/null; then
  echo "⚠️ Secret 'syncdeck-redis-url' is missing."
  echo "   Please create it using your Memorystore Redis connection string:"
  echo "   echo -n 'redis://IP:6379' | gcloud secrets create syncdeck-redis-url --data-file=-"
fi

# 7. Run One-shot Database Migration Job
echo "⚡ Deploying & Running Cloud Run Migration Job..."
gcloud run jobs deploy "$JOB_NAME" \
  --image="$IMAGE_URI" \
  --region="$REGION" \
  --command="node" \
  --args="dist/scripts/migrate.cjs" \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="DATABASE_URL=syncdeck-db-url:latest" \
  --max-retries=1 \
  --task-timeout=10m \
  --quiet || true

echo "🔄 Executing Database Migrations..."
gcloud run jobs execute "$JOB_NAME" --region="$REGION" --wait

# 8. Deploy Cloud Run Service
echo "🚀 Deploying SyncDeck to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_URI" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=2 \
  --memory=2Gi \
  --min-instances=1 \
  --max-instances=20 \
  --session-affinity \
  --set-env-vars="NODE_ENV=production,APP_ORIGIN=$APP_DOMAIN,APP_URL=$APP_DOMAIN" \
  --set-secrets="JWT_SECRET=syncdeck-jwt-secret:latest,REFRESH_SECRET=syncdeck-refresh-secret:latest,DATABASE_URL=syncdeck-db-url:latest,REDIS_URL=syncdeck-redis-url:latest"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)')

echo "============================================================"
echo "🎉 SyncDeck GCP Production Deployment Complete!"
echo "   Public URL : $SERVICE_URL"
echo "   Health URL : $SERVICE_URL/api/v1/health/ready"
echo "============================================================"
