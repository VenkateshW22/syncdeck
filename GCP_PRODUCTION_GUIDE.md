# SyncDeck — GCP Production Deployment Guide

> **Target Audience:** DevOps Engineers, System Administrators, and Core Engineers deploying SyncDeck to Google Cloud Platform (GCP).

---

## Architecture Overview

```
                  ┌─────────────────────────────────────────┐
                  │          Google Cloud Armor             │  (DDoS Protection & WAF)
                  └────────────────────┬────────────────────┘
                                       │
                  ┌────────────────────▼────────────────────┐
                  │    Cloud Load Balancing (HTTPS)         │  (Google-managed SSL / TLS)
                  └────────────────────┬────────────────────┘
                                       │
                  ┌────────────────────▼────────────────────┐
                  │    Google Cloud Run (SyncDeck Engine)  │  (WebSocket Session Affinity enabled)
                  └──────┬─────────────┬─────────────┬──────┘
                         │             │             │
        ┌────────────────┘             │             └────────────────┐
        ▼                              ▼                              ▼
┌──────────────┐             ┌───────────────────┐          ┌──────────────────┐
│  Cloud SQL   │             │    Memorystore    │          │  Cloud Storage   │
│ (PostgreSQL) │             │    for Redis      │          │  (GCS Bucket)    │
└──────────────┘             └───────────────────┘          └──────────────────┘
```

---

## 1. Prerequisites & GCP IAM Permissions

Ensure the operator executing the deployment has the following GCP IAM roles:
- **Cloud Run Admin** (`roles/run.admin`)
- **Secret Manager Admin** (`roles/secretmanager.admin`)
- **Cloud SQL Admin** (`roles/cloudsql.admin`)
- **Redis Admin** (`roles/redis.admin`)
- **Artifact Registry Admin** (`roles/artifactregistry.admin`)
- **Service Account User** (`roles/iam.serviceAccountUser`)

### Authenticate local environment
```bash
gcloud auth login
gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

## 2. Infrastructure Provisioning

### A. Cloud SQL for PostgreSQL 15
Create a production Cloud SQL instance with High Availability (HA) enabled:
```bash
gcloud sql instances create syncdeck-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --storage-auto-increase \
  --backup-start-time=03:00

# Create application database and user
gcloud sql databases create syncdeck --instance=syncdeck-db
gcloud sql users create postgres --instance=syncdeck-db --password="<GENERATE_STRONG_HEX_PASSWORD>"
```

### B. Memorystore for Redis 7
Create a managed Redis instance for Socket.IO RedisAdapter WebSocket pub/sub:
```bash
gcloud redis instances create syncdeck-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=BASIC
```

### C. Secret Manager Configuration
Store production secrets securely in GCP Secret Manager:
```bash
# JWT Secret
python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(48)).decode())" | \
  gcloud secrets create syncdeck-jwt-secret --data-file=-

# Refresh Token Secret
python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(48)).decode())" | \
  gcloud secrets create syncdeck-refresh-secret --data-file=-

# Database Connection String
echo -n "postgresql://postgres:<PASSWORD>@<CLOUD_SQL_IP>:5432/syncdeck" | \
  gcloud secrets create syncdeck-db-url --data-file=-

# Redis Connection String
echo -n "redis://<MEMORYSTORE_IP>:6379" | \
  gcloud secrets create syncdeck-redis-url --data-file=-
```

---

## 3. Deployment Options

### Option A: Automated Script Deployment (gcloud CLI)

Execute the automated GCP production deployment script:

```bash
./scripts/gcp-deploy.sh <YOUR_GCP_PROJECT_ID> us-central1 https://syncdeck.app
```

This automated script performs:
1. Enabling required GCP APIs (`run`, `artifactregistry`, `secretmanager`, `sqladmin`, `redis`).
2. Building and tagging the production container image via Cloud Build.
3. Executing one-shot database schema migrations using **Cloud Run Jobs** (`syncdeck-migrate`).
4. Deploying the application to **Cloud Run** with:
   - **Session Affinity** enabled (essential for WebRTC signaling & WebSocket fallback).
   - **Minimum Instances** set to `1` (eliminates cold starts).
   - Direct environment variable binding for secrets from GCP Secret Manager.

### Option B: Terraform Infrastructure-as-Code (IaC)

For declarative environment management, use the provided Terraform configurations in [terraform/](file:///Users/venkateshk22/Downloads/SyncDeck-main/terraform):

```bash
cd terraform
terraform init
terraform plan \
  -var="gcp_project_id=<YOUR_GCP_PROJECT_ID>" \
  -var="container_image=us-central1-docker.pkg.dev/<YOUR_GCP_PROJECT_ID>/syncdeck-repo/syncdeck:latest"
terraform apply
```

## 4. Post-Deployment Verification

### Verify Readiness Gate
```bash
curl -i https://<YOUR_CLOUD_RUN_URL>/api/v1/health/ready
```
Expected Output:
```json
HTTP/1.1 200 OK
{"status":"ready","checks":{"database":"ok","redis":"ok"}}
```

### Run Playwright Integration Tests Against Production URL
```bash
BASE_URL=https://<YOUR_CLOUD_RUN_URL> npm run test:e2e
```

---

## 5. Operations & Monitoring

- **Cloud Logging**: Filter logs using `resource.type="cloud_run_revision" AND resource.labels.service_name="syncdeck"`.
- **Cloud Monitoring Alerts**: Configure alert policies for:
  - Container Memory utilization > 80%
  - Container CPU utilization > 85%
  - Cloud SQL connection pool saturation
  - Redis memory usage > 75%
