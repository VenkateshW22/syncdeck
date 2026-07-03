#!/usr/bin/env bash
# =============================================================================
# scripts/setup-iam.sh
#
# ONE-TIME setup script. Run this ONCE from your local machine using YOUR
# own GCP credentials (Owner / Editor role required).
#
# This grants the Cloud Run default compute SA access to read secrets from
# Secret Manager — something the github-deployer SA cannot do itself.
#
# Usage:
#   gcloud auth login                          # login as project owner
#   ./scripts/setup-iam.sh <GCP_PROJECT_ID>
#
# Example:
#   ./scripts/setup-iam.sh my-gcp-project-id
# =============================================================================
set -euo pipefail

PROJ="${1:-}"
if [[ -z "$PROJ" ]]; then
  echo "ERROR: GCP project ID required as first argument."
  echo "Usage: $0 <GCP_PROJECT_ID>"
  exit 1
fi

echo ">>> Fetching project number for: $PROJ"
PROJ_NUM=$(gcloud projects describe "$PROJ" --format="value(projectNumber)")
COMPUTE_SA="${PROJ_NUM}-compute@developer.gserviceaccount.com"

echo ">>> Project number : $PROJ_NUM"
echo ">>> Compute SA     : $COMPUTE_SA"
echo ""

# ── 1. Enable required APIs ──────────────────────────────────────────────────
echo ">>> Enabling required GCP APIs..."
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJ"
echo "    APIs enabled."
echo ""

# ── 2. Grant Secret Accessor at project level ────────────────────────────────
echo ">>> Granting roles/secretmanager.secretAccessor at project level..."
gcloud projects add-iam-policy-binding "$PROJ" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet
echo "    Done."
echo ""

# ── 3. Grant per-secret (defence-in-depth) ───────────────────────────────────
echo ">>> Granting access to each secret individually..."
for SECRET in syncdeck-jwt-secret syncdeck-refresh-secret syncdeck-db-url syncdeck-redis-url; do
  if gcloud secrets describe "$SECRET" --project="$PROJ" &>/dev/null; then
    gcloud secrets add-iam-policy-binding "$SECRET" \
      --project="$PROJ" \
      --member="serviceAccount:${COMPUTE_SA}" \
      --role="roles/secretmanager.secretAccessor" \
      --quiet
    echo "    ✓ $SECRET"
  else
    echo "    ⚠ $SECRET not found — skipping (will be created on first deploy)"
  fi
done
echo ""

echo "✅ IAM setup complete."
echo ""
echo "Next step: push a version tag to trigger deployment:"
echo "  git tag v1.0.x && git push origin v1.0.x"
