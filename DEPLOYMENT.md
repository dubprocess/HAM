# Deployment Guide

This guide covers deploying the IT Inventory to various cloud platforms.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [AWS Deployment](#aws-deployment)
- [Google Cloud Deployment](#google-cloud-deployment)
- [Azure Deployment](#azure-deployment)
- [Manual Server Deployment](#manual-server-deployment)

## Prerequisites

All deployments require:
- Okta account with OIDC app configured
- Fleet MDM instance with API access
- PostgreSQL 15+ database
- Redis instance (for background jobs)

## Local Development

The easiest way to get started:

```bash
# 1. Copy environment example
cp backend/.env.example .env

# 2. Edit .env with your configuration
nano .env

# 3. Run quick start script
chmod +x start.sh
./start.sh
```

Access at http://localhost:3000

## AWS Deployment

### Architecture
- **ECS/Fargate** - Container hosting
- **RDS PostgreSQL** - Database
- **ElastiCache Redis** - Caching
- **S3** - File storage
- **CloudFront** - CDN for frontend
- **ALB** - Load balancing
- **Route 53** - DNS

### Step-by-Step

#### 1. Create RDS PostgreSQL Instance

```bash
aws rds create-db-instance \
    --db-instance-identifier asset-tracker-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username admin \
    --master-user-password YourSecurePassword \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxxxx
```

Note the endpoint URL.

#### 2. Create ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
    --cache-cluster-id asset-tracker-redis \
    --cache-node-type cache.t3.micro \
    --engine redis \
    --num-cache-nodes 1
```

#### 3. Create ECR Repositories

```bash
# Backend repository
aws ecr create-repository --repository-name asset-tracker-backend

# Frontend repository
aws ecr create-repository --repository-name asset-tracker-frontend
```

#### 4. Build and Push Images

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
cd backend
docker build -t asset-tracker-backend .
docker tag asset-tracker-backend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/asset-tracker-backend:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/asset-tracker-backend:latest

# Build and push frontend
cd ../frontend
docker build -t asset-tracker-frontend .
docker tag asset-tracker-frontend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/asset-tracker-frontend:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/asset-tracker-frontend:latest
```

#### 5. Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name asset-tracker-cluster
```

#### 6. Create Task Definitions

Create `backend-task-definition.json`:

```json
{
  "family": "asset-tracker-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/asset-tracker-backend:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "DATABASE_URL", "value": "postgresql://admin:password@rds-endpoint:5432/asset_tracker"},
        {"name": "OKTA_ISSUER", "value": "https://your-domain.okta.com/oauth2/default"},
        {"name": "OKTA_CLIENT_ID", "value": "your_client_id"},
        {"name": "OKTA_CLIENT_SECRET", "value": "your_client_secret"},
        {"name": "FLEET_URL", "value": "https://fleet.example.com"},
        {"name": "FLEET_API_TOKEN", "value": "your_fleet_token"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/asset-tracker-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

Register task definition:

```bash
aws ecs register-task-definition --cli-input-json file://backend-task-definition.json
```

#### 7. Create Load Balancer

```bash
aws elbv2 create-load-balancer \
    --name asset-tracker-alb \
    --subnets subnet-xxxxx subnet-yyyyy \
    --security-groups sg-xxxxx
```

#### 8. Create ECS Service

```bash
aws ecs create-service \
    --cluster asset-tracker-cluster \
    --service-name asset-tracker-backend \
    --task-definition asset-tracker-backend \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=8000"
```

#### 9. Update Okta Redirect URIs

Update your Okta app configuration:
- Sign-in redirect: `https://your-domain.com/login/callback`
- Sign-out redirect: `https://your-domain.com`

### Environment Variables for Production

```env
DATABASE_URL=postgresql://admin:password@rds-endpoint.us-east-1.rds.amazonaws.com:5432/asset_tracker
REDIS_URL=redis://redis-endpoint.cache.amazonaws.com:6379
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=production_client_id
OKTA_CLIENT_SECRET=production_client_secret
OKTA_REDIRECT_URI=https://assets.your-company.com/callback
FLEET_URL=https://fleet.your-company.com
FLEET_API_TOKEN=production_token
ALLOWED_ORIGINS=https://assets.your-company.com
SECRET_KEY=<generate-with-openssl-rand-hex-32>
AWS_S3_BUCKET=asset-tracker-uploads
AWS_REGION=us-east-1
```

## Google Cloud Deployment

### Architecture
- **Cloud Run** - Container hosting
- **Cloud SQL** - PostgreSQL
- **Memorystore** - Redis
- **Cloud Storage** - File storage
- **Cloud CDN** - Content delivery

### Steps

1. **Create Cloud SQL Instance:**
```bash
gcloud sql instances create asset-tracker-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1
```

2. **Build and Deploy with Cloud Run:**
```bash
# Backend
gcloud builds submit --tag gcr.io/PROJECT_ID/asset-tracker-backend backend/
gcloud run deploy asset-tracker-backend \
    --image gcr.io/PROJECT_ID/asset-tracker-backend \
    --platform managed \
    --region us-central1 \
    --set-env-vars DATABASE_URL=...,OKTA_ISSUER=...,FLEET_URL=...

# Frontend
gcloud builds submit --tag gcr.io/PROJECT_ID/asset-tracker-frontend frontend/
gcloud run deploy asset-tracker-frontend \
    --image gcr.io/PROJECT_ID/asset-tracker-frontend \
    --platform managed \
    --region us-central1
```

## Manual Server Deployment

For deployment on a VPS or dedicated server:

### 1. Install Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker docker-compose nginx certbot python3-certbot-nginx
```

### 2. Clone Repository

```bash
git clone <your-repo-url>
cd it-asset-tracker
```

### 3. Configure Environment

```bash
cp backend/.env.example .env
nano .env  # Edit with your values
```

### 4. Start Services

```bash
docker-compose up -d
```

### 5. Configure Nginx

Create `/etc/nginx/sites-available/asset-tracker`:

```nginx
server {
    listen 80;
    server_name assets.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/asset-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Setup SSL

```bash
sudo certbot --nginx -d assets.your-domain.com
```

### 7. Setup Automatic Backups

Create `/home/ubuntu/backup-db.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec asset-tracker-db pg_dump -U assetuser asset_tracker > /backups/db_$DATE.sql
find /backups -name "db_*.sql" -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /home/ubuntu/backup-db.sh
```

## Monitoring

### Health Checks

```bash
# Backend health
curl https://assets.your-domain.com/api/health

# Database connection
docker exec asset-tracker-db pg_isready
```

### Logging

```bash
# View all logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Export logs
docker-compose logs --no-color > logs.txt
```

## Scaling

### Horizontal Scaling (AWS ECS)

```bash
aws ecs update-service \
    --cluster asset-tracker-cluster \
    --service asset-tracker-backend \
    --desired-count 4
```

### Auto-Scaling

Create auto-scaling policy based on CPU:

```bash
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/asset-tracker-cluster/asset-tracker-backend \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 10
```

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
docker exec -it asset-tracker-backend psql $DATABASE_URL

# Check connectivity
nc -zv rds-endpoint 5432
```

### Container Issues
```bash
# Restart all services
docker-compose restart

# Rebuild specific service
docker-compose up -d --build backend

# Clear volumes and restart
docker-compose down -v
docker-compose up -d
```

## Cost Optimization

### AWS
- Use Reserved Instances for predictable workloads
- Enable auto-scaling to match demand
- Use S3 lifecycle policies for old files
- Use CloudFront caching

### Resource Sizing
- **Small Teams (<50 users):** t3.small instances
- **Medium Teams (50-200 users):** t3.medium instances
- **Large Teams (200+ users):** t3.large+ with auto-scaling

## Security Checklist

- [ ] SSL/TLS certificates configured
- [ ] Database encryption at rest enabled
- [ ] VPC security groups properly configured
- [ ] Secrets stored in environment variables or secrets manager
- [ ] Regular security updates scheduled
- [ ] Database backups automated
- [ ] Okta 2FA enabled for all users
- [ ] API rate limiting configured
- [ ] Logs monitored for suspicious activity

---

For additional support or questions, please open an issue on GitHub.
