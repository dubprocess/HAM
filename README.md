# IT Inventory

A comprehensive IT Asset Management system with Fleet MDM integration and Okta OIDC authentication. Track laptops, monitors, and other hardware with automated device sync, assignment tracking, and maintenance history.

## 🌟 Features

### Core Features
- **Asset Inventory Management** - Track all IT hardware (laptops, monitors, peripherals)
- **Fleet MDM Integration** - Automatic device sync with real-time data
- **Auto-Assignment** - Automatically assign devices based on Fleet user data
- **Okta OIDC Authentication** - Secure single sign-on
- **Maintenance Tracking** - Log repairs, upgrades, and service history
- **Warranty Management** - Track warranty expiration dates
- **Audit Logging** - Complete history of all changes
- **File Attachments** - Upload receipts, warranties, and documentation

### Fleet MDM Capabilities
- Automatic device discovery and enrollment detection
- Real-time OS version and spec updates
- User-based auto-assignment with manual override option
- Last seen timestamp tracking
- Change detection and audit logging

### User Interface
- Modern, responsive dashboard
- Advanced search and filtering
- Asset status tracking (Available, Assigned, In Repair, Retired)
- Device breakdown analytics
- Warranty expiration alerts

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Python 3.11
- FastAPI - Modern, fast web framework
- SQLAlchemy - ORM for database operations
- PostgreSQL - Primary database
- Redis - Caching and background jobs
- Authlib - Okta OIDC integration

**Frontend:**
- React 18
- React Router - Navigation
- React Query - API state management
- React Hook Form - Form handling
- Okta React SDK - Authentication
- Lucide React - Icons

**Infrastructure:**
- Docker & Docker Compose
- Nginx (production)
- Celery (background tasks)

## 📋 Prerequisites

- Docker and Docker Compose
- Okta account with OIDC application configured
- Fleet MDM instance with API access
- (Optional) Domain name for production deployment

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd it-asset-tracker
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp backend/.env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql://assetuser:changeme123@postgres:5432/asset_tracker

# Okta OIDC
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=your_okta_client_id
OKTA_CLIENT_SECRET=your_okta_client_secret
OKTA_REDIRECT_URI=http://localhost:3000/callback

# Fleet MDM
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token

# Application
ALLOWED_ORIGINS=http://localhost:3000
SECRET_KEY=generate-a-secure-random-key-here
```

### 3. Start the Application

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### 4. Initial Setup

1. Navigate to http://localhost:3000
2. Click "Sign in with Okta"
3. Authenticate with your Okta credentials
4. Go to "Fleet Sync" and click "Sync Now" to import devices

## 🔧 Configuration

### Okta OIDC Setup

1. **Create an Okta Application:**
   - Log into your Okta Admin Dashboard
   - Applications → Create App Integration
   - Choose "OIDC - OpenID Connect"
   - Choose "Single-Page Application"

2. **Configure Settings:**
   - Sign-in redirect URIs: `http://localhost:3000/login/callback`
   - Sign-out redirect URIs: `http://localhost:3000`
   - Controlled access: Allow everyone or limit to specific groups

3. **Note Your Credentials:**
   - Client ID
   - Issuer URL (usually: `https://your-domain.okta.com/oauth2/default`)

### Fleet MDM Setup

1. **Generate API Token:**
   - Log into Fleet
   - Settings → Integrations → API tokens
   - Generate new token with read permissions

2. **Configure Permissions:**
   - Ensure the API token has access to:
     - Read hosts
     - Read host details
     - Read user information

3. **Test Connection:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-fleet-instance.com/api/v1/fleet/hosts
   ```

## 📚 Usage Guide

### Managing Assets

#### Adding an Asset Manually
1. Navigate to "Assets" → "Add Asset"
2. Fill in required fields:
   - Asset Tag (unique identifier)
   - Serial Number
   - Manufacturer & Model
   - Device Type
3. Optional: Add purchase info, specs, warranty details
4. Click "Create Asset"

#### Syncing from Fleet MDM
1. Navigate to "Fleet Sync"
2. Click "Sync Now"
3. Review sync results and logs
4. New devices automatically appear in your inventory

#### Assigning Devices
1. Open an asset detail page
2. Click "Assign Asset"
3. Enter employee information:
   - Email
   - Name
   - Department/Location
4. Check "Override Fleet Auto-Sync" to prevent Fleet from changing the assignment
5. Click "Assign"

**Note:** Fleet sync will automatically assign devices based on the logged-in user. Manual assignments with override disabled will be updated by Fleet sync.

#### Tracking Maintenance
1. Open asset detail page
2. Click "Add Record" in Maintenance History
3. Select type (Repair, Upgrade, Cleaning, etc.)
4. Enter details and cost
5. Save record

### Fleet MDM Sync Behavior

**Automatic Updates:**
- OS version
- Hardware specifications
- Last seen timestamp
- Enrollment status

**Auto-Assignment:**
- Reads user from Fleet device
- Automatically assigns to that user
- Creates audit log entry
- Can be overridden manually

**Manual Override:**
- Check "Override Fleet Auto-Sync" when assigning
- Prevents Fleet from changing the assignment
- Useful for shared devices, loaners, or IT-owned equipment

### Search and Filtering

Use the asset list page to:
- **Search**: Asset tag, serial number, model, or assignee name
- **Filter by Status**: Available, Assigned, In Repair, Retired
- **Filter by Type**: Laptop, Monitor, Mouse, Keyboard

### Dashboard Analytics

The dashboard shows:
- Total asset count
- Assets by status (Assigned, Available, In Repair)
- Warranties expiring in next 30 days
- Fleet enrollment statistics
- Device type breakdown

## 🔐 Security

### Authentication
- Okta OIDC for secure authentication
- JWT tokens for API access
- Role-based access control (configurable via Okta groups)

### Data Protection
- PostgreSQL with encrypted connections
- Secure password hashing (bcrypt)
- HTTPS in production (via reverse proxy)
- API rate limiting

### Best Practices
- Rotate API tokens regularly
- Use environment variables for secrets
- Enable 2FA on Okta
- Regular security updates

## 🚢 Production Deployment

### Using Docker

1. **Build production images:**
```bash
docker-compose -f docker-compose.prod.yml build
```

2. **Update environment variables:**
```bash
# Use production values
OKTA_REDIRECT_URI=https://your-domain.com/callback
ALLOWED_ORIGINS=https://your-domain.com
```

3. **Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Deployment (AWS Example)

1. **RDS for PostgreSQL:**
   - Create PostgreSQL 15 instance
   - Note connection string

2. **ElastiCache for Redis:**
   - Create Redis instance
   - Note connection endpoint

3. **ECS or EKS:**
   - Deploy backend and frontend containers
   - Configure environment variables
   - Set up load balancer

4. **S3 for File Storage:**
   - Create S3 bucket for attachments
   - Configure IAM permissions

### Environment-Specific Configuration

**Production `.env`:**
```env
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/asset_tracker
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=prod_client_id
OKTA_CLIENT_SECRET=prod_client_secret
OKTA_REDIRECT_URI=https://assets.your-company.com/callback
FLEET_URL=https://fleet.your-company.com
FLEET_API_TOKEN=prod_token
ALLOWED_ORIGINS=https://assets.your-company.com
SECRET_KEY=<generate-secure-key>
```

## 📊 API Documentation

Interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

**Assets:**
- `GET /api/assets` - List all assets
- `POST /api/assets` - Create asset
- `GET /api/assets/{id}` - Get asset details
- `PUT /api/assets/{id}` - Update asset
- `POST /api/assets/{id}/assign` - Assign to employee
- `POST /api/assets/{id}/return` - Return asset
- `DELETE /api/assets/{id}` - Retire asset

**Fleet Sync:**
- `POST /api/fleet/sync` - Trigger manual sync
- `GET /api/fleet/sync-logs` - Get sync history

**Maintenance:**
- `GET /api/assets/{id}/maintenance` - List records
- `POST /api/assets/{id}/maintenance` - Add record

**Dashboard:**
- `GET /api/dashboard/stats` - Get statistics

## 🛠️ Development

### Running Locally

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

### Database Migrations

```bash
cd backend

# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 🔄 Future Enhancements

### Phase 2 Features
- [ ] Apple Business Manager integration
- [ ] Bulk CSV import/export
- [ ] Email notifications (warranty expiring, assignments)
- [ ] Custom fields per device type
- [ ] QR code generation for assets
- [ ] Mobile app (React Native)

### Phase 3 Features
- [ ] Check-in/check-out workflow
- [ ] Asset lifecycle management
- [ ] Depreciation tracking
- [ ] Purchase order integration
- [ ] Advanced reporting and analytics
- [ ] Multi-tenant support

## 🐛 Troubleshooting

### Common Issues

**Fleet Sync Fails:**
- Verify Fleet API token is valid
- Check Fleet URL is accessible
- Review sync error logs in the UI

**Okta Authentication Issues:**
- Verify redirect URIs match exactly
- Check client ID and secret
- Ensure issuer URL is correct

**Database Connection Errors:**
- Verify PostgreSQL is running
- Check connection string format
- Ensure database exists

**Assets Not Auto-Assigning:**
- Verify Fleet provides user data
- Check that `assignment_override` is false
- Review audit logs for changes

### Logs

View application logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📧 Support

For issues and questions:
- GitHub Issues: [Create an issue]
- Documentation: [Link to docs]
- Email: support@your-company.com

## 🙏 Acknowledgments

- Fleet MDM for device management capabilities
- Okta for authentication services
- FastAPI and React communities

---

**Built with ❤️ for IT teams managing hardware at scale**
