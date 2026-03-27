# HAM — Deployment Guide

This guide covers deploying HAM in various environments. Docker Compose is the recommended starting point for most teams.

## Table of Contents

- [Docker Compose (recommended)](#docker-compose-recommended)
- [Manual / bare metal](#manual--bare-metal)
- [AWS (ECS/Fargate)](#aws-ecsfarga te)
- [Google Cloud (Cloud Run)](#google-cloud-cloud-run)
- [Production checklist](#production-checklist)
- [Backups](#backups)
- [Troubleshooting](#troubleshooting)

---

## Docker Compose (recommended)

The fastest path to a running HAM instance.

### Prerequisites

- Docker + Docker Compose
- An OIDC provider (Okta today — see [docs/okta.md](docs/okta.md))
- A Fleet MDM instance (see [docs/fleet.md](docs/fleet.md))
- (Optional) Apple Business Manager credentials

### Steps

```bash
git clone https://github.com/dubprocess/HAM.git
cd HAM
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials
docker compose up --build -d
```

Or use the Makefile:

```bash
make start
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Minimum required env vars

```env
# Database (auto-configured in Docker Compose)
DATABASE_URL=postgresql://assetuser:changeme123@postgres:5432/asset_tracker

# Application
SECRET_KEY=<generate with: openssl rand -hex 32>
ALLOWED_ORIGINS=http://localhost:3000

# OIDC login
OIDC_ISSUER=https://your-domain.okta.com/oauth2/default
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback

# Fleet MDM
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token
```

See `backend/.env.example` for the full reference including ABM, Slack, and sync schedule options.

---

## Manual / bare metal

For deployment on a VPS or dedicated server without orchestration.

### 1. Install dependencies

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
```

### 2. Clone and configure

```bash
git clone https://github.com/dubprocess/HAM.git
cd HAM
cp backend/.env.example backend/.env
# Edit backend/.env
```

### 3. Start services

```bash
docker compose up -d
```

### 4. Configure nginx reverse proxy

Create `/etc/nginx/sites-available/ham`:

```nginx
server {
    listen 80;
    server_name ham.your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/ham /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL with Let's Encrypt

```bash
sudo certbot --nginx -d ham.your-domain.com
```

### 6. Update your OIDC redirect URI

Once you have a real domain, update your Okta (or other IdP) app:
- Sign-in redirect: `https://ham.your-domain.com/callback`
- Update `OIDC_REDIRECT_URI` and `ALLOWED_ORIGINS` in `backend/.env`
- Restart: `docker compose up -d`

---

## AWS (ECS/Fargate)

### Architecture overview

- **ECS/Fargate** — container hosting for backend + frontend
- **RDS PostgreSQL** — managed database
- **ALB** — load balancing + HTTPS termination
- **ECR** — container registry
- **Secrets Manager** — environment variable secrets (recommended)

### 1. Create RDS PostgreSQL

```bash
aws rds create-db-instance \
    --db-instance-identifier ham-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15 \
    --master-username hamuser \
    --master-user-password YourSecurePassword \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxxxx
```

### 2. Create ECR repositories and push images

```bash
aws ecr create-repository --repository-name ham-backend
aws ecr create-repository --repository-name ham-frontend

# Login
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build + push backend
docker build -t ham-backend ./backend
docker tag ham-backend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ham-backend:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ham-backend:latest

# Build + push frontend
docker build -f frontend/Dockerfile.prod -t ham-frontend ./frontend
docker tag ham-frontend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ham-frontend:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ham-frontend:latest
```

### 3. Create ECS cluster and task definitions

```bash
aws ecs create-cluster --cluster-name ham-cluster
```

Backend task definition (key env vars — use Secrets Manager for sensitive values):

```json
{
  "family": "ham-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "backend",
    "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ham-backend:latest",
    "portMappings": [{"containerPort": 8000}],
    "environment": [
      {"name": "DATABASE_URL", "value": "postgresql://hamuser:password@rds-endpoint:5432/asset_tracker"},
      {"name": "OIDC_ISSUER", "value": "https://your-domain.okta.com/oauth2/default"},
      {"name": "OIDC_CLIENT_ID", "value": "your_client_id"},
      {"name": "OIDC_CLIENT_SECRET", "value": "your_client_secret"},
      {"name": "OIDC_REDIRECT_URI", "value": "https://ham.your-domain.com/callback"},
      {"name": "FLEET_URL", "value": "https://your-fleet-instance.com"},
      {"name": "FLEET_API_TOKEN", "value": "your_fleet_token"},
      {"name": "ALLOWED_ORIGINS", "value": "https://ham.your-domain.com"},
      {"name": "SECRET_KEY", "value": "your-secret-key"},
      {"name": "ASSET_TAG_PREFIX", "value": "HAM"},
      {"name": "LOCATIONS", "value": "HQ,Remote"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/ham-backend",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

### 4. Create ALB and ECS service

```bash
# Create service
aws ecs create-service \
    --cluster ham-cluster \
    --service-name ham-backend \
    --task-definition ham-backend \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=8000"
```

---

## Google Cloud (Cloud Run)

### Architecture overview

- **Cloud Run** — serverless container hosting
- **Cloud SQL** — managed PostgreSQL
- **Secret Manager** — environment variable secrets

### Steps

```bash
# Create Cloud SQL instance
gcloud sql instances create ham-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1

# Build and deploy backend
gcloud builds submit --tag gcr.io/PROJECT_ID/ham-backend backend/
gcloud run deploy ham-backend \
    --image gcr.io/PROJECT_ID/ham-backend \
    --platform managed \
    --region us-central1 \
    --set-env-vars \
        DATABASE_URL=postgresql://...,\
        OIDC_ISSUER=https://your-domain.okta.com/oauth2/default,\
        OIDC_CLIENT_ID=your_client_id,\
        OIDC_CLIENT_SECRET=your_client_secret,\
        OIDC_REDIRECT_URI=https://ham-backend-xxxx.run.app/callback,\
        FLEET_URL=https://your-fleet-instance.com,\
        FLEET_API_TOKEN=your_fleet_token

# Build and deploy frontend
gcloud builds submit --tag gcr.io/PROJECT_ID/ham-frontend frontend/
gcloud run deploy ham-frontend \
    --image gcr.io/PROJECT_ID/ham-frontend \
    --platform managed \
    --region us-central1 \
    --set-env-vars REACT_APP_API_URL=https://ham-backend-xxxx.run.app
```

---

## Production checklist

Before going live:

- [ ] `SECRET_KEY` set to a strong random value (`openssl rand -hex 32`)
- [ ] `POSTGRES_PASSWORD` changed from the default `changeme123`
- [ ] HTTPS configured (nginx + Let's Encrypt, ALB, or Cloud Run)
- [ ] OIDC redirect URI updated to your production domain
- [ ] `ALLOWED_ORIGINS` set to your production frontend URL
- [ ] ABM private key stored securely (not committed to git)
- [ ] `keys/` directory excluded from version control (it's in `.gitignore`)
- [ ] Database backups configured (see below)
- [ ] Slack alerts configured and tested (`make sync-fleet` after deploy)
- [ ] Fleet sync schedule reviewed (`FLEET_SYNC_HOUR`, `FLEET_SYNC_TIMEZONE`)

---

## Backups

### Automated daily backup script

Create `/opt/ham/backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/ham/backups

mkdir -p $BACKUP_DIR
docker exec ham-db pg_dump -U assetuser asset_tracker > $BACKUP_DIR/ham_$DATE.sql

# Keep 14 days of backups
find $BACKUP_DIR -name "ham_*.sql" -mtime +14 -delete

echo "Backup complete: ham_$DATE.sql"
```

Add to crontab:

```bash
chmod +x /opt/ham/backup.sh
echo "0 3 * * * /opt/ham/backup.sh" | crontab -
```

### Restore from backup

```bash
docker exec -i ham-db psql -U assetuser asset_tracker < /opt/ham/backups/ham_20260101_030000.sql
```

---

## Troubleshooting

### Container won't start

```bash
docker compose logs backend     # backend errors
docker compose logs frontend    # frontend errors
docker compose logs postgres    # database errors
```

### Database connection issues

```bash
# Test connectivity from backend container
docker compose exec backend python -c "import psycopg2; psycopg2.connect('$DATABASE_URL'); print('OK')"

# Open a psql shell
make shell-db
```

### Fleet sync fails

```bash
# Trigger a manual sync and watch logs
make sync-fleet
docker compose logs -f backend
```

Check `/api/fleet/sync-logs` in the HAM UI for detailed error messages.

### Reset everything

```bash
docker compose down -v   # removes containers AND volumes (wipes database!)
docker compose up --build -d
```
