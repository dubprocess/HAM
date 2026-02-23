# IT Inventory - Project Overview

## What You Have

A complete, production-ready IT Asset Management system with:

✅ **Fleet MDM Integration** - Automatic device sync and auto-assignment
✅ **Okta OIDC Authentication** - Secure single sign-on
✅ **Modern Web Interface** - React-based responsive UI
✅ **RESTful API** - FastAPI backend with full documentation
✅ **Docker Ready** - Complete containerization
✅ **Production Deployment Guides** - AWS, GCP, Azure, and manual server

## Quick Start (5 minutes)

1. **Navigate to the project folder:**
   ```bash
   cd it-asset-tracker
   ```

2. **Configure your credentials:**
   ```bash
   cp backend/.env.example .env
   # Edit .env with your Okta and Fleet credentials
   ```

3. **Start the application:**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

4. **Access the app:**
   - Open http://localhost:3000
   - Sign in with Okta
   - Go to "Fleet Sync" → Click "Sync Now"

## File Structure

```
it-asset-tracker/
├── backend/               # Python FastAPI application
│   ├── main.py           # Main API application
│   ├── models.py         # Database models
│   ├── fleet_service.py  # Fleet MDM integration
│   ├── auth.py           # Okta OIDC authentication
│   ├── requirements.txt  # Python dependencies
│   └── Dockerfile        # Backend container
│
├── frontend/             # React application
│   ├── src/
│   │   ├── App.js        # Main app component
│   │   ├── App.css       # Styling
│   │   └── components/   # React components
│   │       ├── Dashboard.js
│   │       ├── AssetList.js
│   │       ├── AssetDetail.js
│   │       ├── AssetCreate.js
│   │       ├── FleetSync.js
│   │       └── Layout.js
│   ├── package.json      # Node dependencies
│   └── Dockerfile        # Frontend container
│
├── docker-compose.yml    # Container orchestration
├── start.sh             # Quick start script
├── README.md            # Full documentation
└── DEPLOYMENT.md        # Production deployment guide
```

## Key Features Explained

### Fleet MDM Auto-Sync
- Automatically pulls device data from Fleet every time you click "Sync Now"
- Updates OS versions, specs, and last seen timestamps
- **Auto-assigns** devices based on the logged-in user in Fleet
- Manual assignments can override auto-sync behavior

### Asset Management
- Track laptops, monitors, and other hardware
- Complete device specifications
- Purchase and warranty tracking
- Maintenance history logging
- File attachments for receipts/warranties

### Authentication & Security
- Okta OIDC integration for enterprise SSO
- JWT-based API authentication
- Role-based access control (via Okta groups)
- Complete audit logging of all changes

## Configuration Required

### 1. Okta Setup
- Create OIDC application in Okta
- Configure redirect URIs: `http://localhost:3000/login/callback`
- Note Client ID and Issuer URL
- Add to `.env` file

### 2. Fleet MDM Setup
- Generate API token in Fleet
- Ensure token has read access to hosts
- Add Fleet URL and token to `.env`

### 3. Environment Variables (.env)
```env
# Required
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=your_client_id
OKTA_CLIENT_SECRET=your_client_secret
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token

# Optional (defaults provided)
DATABASE_URL=postgresql://...
ALLOWED_ORIGINS=http://localhost:3000
```

## How Fleet Auto-Assignment Works

1. **Sync Process:**
   - Fetches all devices from Fleet
   - Reads logged-in user for each device
   - Creates/updates device record

2. **Auto-Assignment:**
   - If device has a user in Fleet → Assigns to that user
   - If assignment has "override" flag → Skips auto-assignment
   - Creates audit log entry for transparency

3. **Manual Override:**
   - Check "Override Fleet Auto-Sync" when assigning
   - Prevents Fleet from changing the assignment
   - Useful for shared devices or loaner equipment

## API Documentation

Once running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Key endpoints:
- `GET /api/assets` - List assets
- `POST /api/assets` - Create asset
- `POST /api/assets/{id}/assign` - Assign to employee
- `POST /api/fleet/sync` - Trigger Fleet sync

## Database Schema

### Assets Table
- Device information (serial, model, specs)
- Assignment details (employee, department)
- Status (available, assigned, in_repair, retired)
- Fleet integration fields
- Purchase and warranty info

### Maintenance Records
- Service history for each asset
- Repair costs and vendors
- Completion tracking

### Audit Logs
- Complete change history
- User tracking
- Timestamp records

## Deployment Options

### Local Development
```bash
./start.sh
```

### Production (Docker)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Platforms
- See `DEPLOYMENT.md` for AWS, GCP, Azure guides
- Includes RDS setup, container registry, load balancing
- Auto-scaling configuration examples

## Common Workflows

### Adding a Device Manually
1. Go to Assets → Add Asset
2. Fill in asset tag, serial, manufacturer, model
3. Add specs and purchase info
4. Save

### Syncing from Fleet
1. Go to Fleet Sync
2. Click "Sync Now"
3. Review sync results
4. Devices automatically appear with assignments

### Assigning a Device
1. Open asset detail page
2. Click "Assign Asset"
3. Enter employee email and name
4. Optionally check "Override Fleet Auto-Sync"
5. Save

### Tracking Maintenance
1. Open asset detail
2. Click "Add Record" in Maintenance section
3. Select type (repair, upgrade, etc.)
4. Enter details and cost
5. Save

## Customization Ideas

### Phase 2 Enhancements
- Apple Business Manager integration
- Email notifications
- Custom fields per device type
- QR code generation
- Bulk CSV import/export

### UI Customization
- Update colors in `App.css` (CSS variables)
- Change fonts by editing `@import` in CSS
- Add company logo in `Layout.js`
- Customize dashboard widgets

### Additional Features
- Scheduled Fleet sync (via Celery)
- Purchase order tracking
- Depreciation calculation
- Asset lifecycle rules
- Mobile app (React Native)

## Testing

```bash
# Run backend tests
cd backend
pytest

# Run frontend tests
cd frontend
npm test

# Test Fleet connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://fleet.example.com/api/v1/fleet/hosts
```

## Troubleshooting

**Can't connect to Fleet?**
- Verify Fleet URL is accessible
- Check API token permissions
- Test with curl command above

**Okta authentication fails?**
- Verify redirect URI matches exactly
- Check client ID and secret
- Ensure issuer URL is correct

**Devices not auto-assigning?**
- Ensure Fleet provides user email/username
- Check that assignment_override is false
- Review audit logs for changes

**Database issues?**
- Verify PostgreSQL is running
- Check connection string format
- Run migrations: `alembic upgrade head`

## Support & Documentation

- **Full README:** See `README.md`
- **Deployment Guide:** See `DEPLOYMENT.md`
- **API Docs:** http://localhost:8000/docs (when running)

## Next Steps

1. **Configure Okta and Fleet credentials** in `.env`
2. **Run the quick start script:** `./start.sh`
3. **Sign in and sync devices** from Fleet
4. **Customize the UI** to match your branding
5. **Deploy to production** using deployment guide

---

**Built specifically for your IT team's needs with Fleet MDM integration and auto-assignment! 🚀**
