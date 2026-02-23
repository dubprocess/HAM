from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, or_, and_, func, case, literal, text
from sqlalchemy.orm import Session, sessionmaker
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from collections import Counter
import os
import csv
import asyncio
import traceback
import logging
from io import StringIO
from dotenv import load_dotenv

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from models import (
    Base, Asset, AssetStatus, AssetCondition, 
    Employee, MaintenanceRecord, MaintenanceType,
    AuditLog, Attachment, FleetSyncLog, ABMSyncLog
)
from fleet_service import FleetMDMService
from okta_service import OktaUserService
from abm_service import ABMService
import auth
from auth import OktaAuth, get_current_user

load_dotenv()

logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/asset_tracker")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

# ------------------------------------------------------------------
# Database migrations — runs once on startup, idempotent
# ------------------------------------------------------------------
def run_migrations():
    """Migrate PostgreSQL enum: add 'LOCKED' value, fix case if needed"""
    dialect = engine.dialect.name
    if dialect != 'postgresql':
        print("Migration: Skipping (not PostgreSQL)")
        return

    # ALTER TYPE ... ADD VALUE must run outside a transaction.
    raw_conn = engine.raw_connection()
    try:
        raw_conn.set_session(autocommit=True)
        cursor = raw_conn.cursor()

        # Check what enum values exist
        cursor.execute(
            "SELECT enumlabel FROM pg_enum "
            "WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'assetstatus') "
            "ORDER BY enumsortorder"
        )
        existing_values = [row[0] for row in cursor.fetchall()]
        print(f"Migration: Current assetstatus values: {existing_values}")

        # Fix: if lowercase 'locked' exists, rename to 'LOCKED'
        if 'locked' in existing_values and 'LOCKED' not in existing_values:
            cursor.execute("ALTER TYPE assetstatus RENAME VALUE 'locked' TO 'LOCKED'")
            print("Migration: Renamed 'locked' to 'LOCKED' in assetstatus enum")
        elif 'LOCKED' not in existing_values and 'locked' not in existing_values:
            cursor.execute("ALTER TYPE assetstatus ADD VALUE 'LOCKED'")
            print("Migration: Added 'LOCKED' to assetstatus enum")
        else:
            print("Migration: 'LOCKED' already exists in assetstatus enum")

        # Migrate any existing 'in_repair' rows to 'AVAILABLE'
        cursor.execute("UPDATE assets SET status = 'AVAILABLE' WHERE status = 'in_repair'")
        rowcount = cursor.rowcount
        if rowcount > 0:
            print(f"Migration: Moved {rowcount} assets from 'in_repair' to 'AVAILABLE'")

        cursor.close()
    except Exception as e:
        print(f"Migration error: {e}")
        traceback.print_exc()
    finally:
        raw_conn.close()

def cleanup_stale_sync_logs():
    """Mark any 'running' sync logs as failed — these are zombies from crashed syncs."""
    db = SessionLocal()
    try:
        stale_fleet = db.query(FleetSyncLog).filter(FleetSyncLog.status == 'running').all()
        for log in stale_fleet:
            log.status = 'failed'
            log.sync_completed = log.sync_started
            log.errors = 'Interrupted — process restarted before sync completed'
        if stale_fleet:
            print(f"Cleanup: Marked {len(stale_fleet)} stale Fleet sync logs as failed")

        stale_abm = db.query(ABMSyncLog).filter(ABMSyncLog.status == 'running').all()
        for log in stale_abm:
            log.status = 'failed'
            log.sync_completed = log.sync_started
            log.errors = 'Interrupted — process restarted before sync completed'
        if stale_abm:
            print(f"Cleanup: Marked {len(stale_abm)} stale ABM sync logs as failed")

        db.commit()
    except Exception as e:
        print(f"Cleanup error: {e}")
        db.rollback()
    finally:
        db.close()

run_migrations()
cleanup_stale_sync_logs()

# FastAPI app
app = FastAPI(
    title="HAM - Hardware Asset Management",
    description="Enterprise IT Asset Management System with Fleet MDM and Apple Business Manager Integration",
    version="1.5.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Helper: create Fleet service with optional Okta location enrichment
# ------------------------------------------------------------------
def _create_fleet_service() -> FleetMDMService:
    """Create a FleetMDMService, optionally with Okta user location lookup."""
    fleet_url = os.getenv("FLEET_URL")
    fleet_token = os.getenv("FLEET_API_TOKEN")
    
    okta_service = None
    okta_api_token = os.getenv("OKTA_API_TOKEN")
    if okta_api_token:
        okta_service = OktaUserService(api_token=okta_api_token)
        logger.info("Okta location enrichment enabled for Fleet sync")
    else:
        logger.info("Okta location enrichment disabled (no OKTA_API_TOKEN)")
    
    return FleetMDMService(fleet_url=fleet_url, api_token=fleet_token, okta_service=okta_service)

# ------------------------------------------------------------------
# Scheduled sync — nightly Fleet sync at 9:00 PM Pacific
# ------------------------------------------------------------------
scheduler = AsyncIOScheduler()

async def scheduled_fleet_sync():
    """Run Fleet sync on schedule. Creates its own DB session."""
    logger.info("Scheduled Fleet sync starting...")
    db = SessionLocal()
    try:
        fleet_service = _create_fleet_service()
        if not os.getenv("FLEET_URL") or not os.getenv("FLEET_API_TOKEN"):
            logger.error("Scheduled sync skipped — FLEET_URL or FLEET_API_TOKEN not configured")
            return
        stats = await fleet_service.sync_devices(db, 'scheduled_sync')
        logger.info(f"Scheduled Fleet sync completed: {stats['processed']} processed, "
                     f"{stats['created']} created, {stats['updated']} updated, "
                     f"{stats['locked']} locked, {stats['unlocked']} unlocked, "
                     f"{stats['locations_set']} locations set")
    except Exception as e:
        logger.error(f"Scheduled Fleet sync failed: {e}")
        traceback.print_exc()
    finally:
        db.close()

# Initialize Okta Auth and start scheduler
@app.on_event("startup")
async def startup_event():
    auth.okta_auth = OktaAuth(
        issuer=os.getenv("OKTA_ISSUER"),
        client_id=os.getenv("OKTA_CLIENT_ID"),
        client_secret=os.getenv("OKTA_CLIENT_SECRET"),
        redirect_uri=os.getenv("OKTA_REDIRECT_URI")
    )

    # Schedule Fleet sync at 9:00 PM Pacific every day
    sync_hour = int(os.getenv("FLEET_SYNC_HOUR", "21"))
    sync_minute = int(os.getenv("FLEET_SYNC_MINUTE", "0"))
    sync_timezone = os.getenv("FLEET_SYNC_TIMEZONE", "US/Pacific")
    sync_enabled = os.getenv("FLEET_SYNC_SCHEDULED", "true").lower() == "true"

    if sync_enabled:
        scheduler.add_job(
            scheduled_fleet_sync,
            CronTrigger(hour=sync_hour, minute=sync_minute, timezone=sync_timezone),
            id="nightly_fleet_sync",
            name="Nightly Fleet MDM Sync",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(f"Scheduler started: Fleet sync at {sync_hour}:{sync_minute:02d} {sync_timezone} daily")
    else:
        logger.info("Scheduled Fleet sync is disabled (FLEET_SYNC_SCHEDULED=false)")

@app.on_event("shutdown")
async def shutdown_event():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------------------------------------------------------
# Platform detection helpers
# ------------------------------------------------------------------

def get_platform_filter(platform: str):
    platform = platform.lower()
    if platform == "macos":
        return or_(
            Asset.os_type.ilike("%macos%"),
            Asset.os_type.ilike("%darwin%"),
            and_(Asset.manufacturer == "Apple", Asset.device_type.in_(["laptop", "mac"])),
            Asset.abm_product_family.ilike("%Mac%"),
        )
    elif platform == "windows":
        return or_(Asset.os_type.ilike("%windows%"), Asset.device_type == "windows")
    elif platform == "ios":
        return or_(
            Asset.os_type.ilike("%ios%"),
            Asset.device_type.in_(["phone", "iphone"]),
            Asset.abm_product_family.ilike("%iPhone%"),
        )
    elif platform == "ipados":
        return or_(
            Asset.os_type.ilike("%ipados%"),
            Asset.device_type.in_(["tablet", "ipad"]),
            Asset.abm_product_family.ilike("%iPad%"),
        )
    elif platform == "tvos":
        return or_(
            Asset.os_type.ilike("%tvos%"),
            Asset.device_type == "apple_tv",
            Asset.abm_product_family.ilike("%AppleTV%"),
            Asset.abm_product_family.ilike("%TV%"),
        )
    else:
        return Asset.device_type == platform


def resolve_platform(asset) -> str:
    os_type = (asset.os_type or "").lower()
    product_family = (asset.abm_product_family or "").lower()
    device_type = (asset.device_type or "").lower()

    if "macos" in os_type or "darwin" in os_type:
        return "macOS"
    if "windows" in os_type:
        return "Windows"
    if "ipados" in os_type:
        return "iPadOS"
    if "ios" in os_type:
        return "iOS"
    if "tvos" in os_type:
        return "tvOS"

    if "mac" in product_family:
        return "macOS"
    if "iphone" in product_family:
        return "iOS"
    if "ipad" in product_family:
        return "iPadOS"
    if "tv" in product_family:
        return "tvOS"

    type_map = {
        "mac": "macOS", "laptop": "macOS", "windows": "Windows",
        "iphone": "iOS", "phone": "iOS", "ipad": "iPadOS",
        "tablet": "iPadOS", "apple_tv": "tvOS",
    }
    return type_map.get(device_type, "Other")


def parse_status_filter(status_str: str) -> Optional[AssetStatus]:
    """Convert a status string to AssetStatus enum, returning None if invalid."""
    try:
        return AssetStatus(status_str)
    except ValueError:
        return None


# Pydantic models for API
class AssetCreate(BaseModel):
    asset_tag: str
    serial_number: str
    manufacturer: str
    model: str
    device_type: str
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    processor: Optional[str] = None
    ram_gb: Optional[int] = None
    storage_gb: Optional[int] = None
    screen_size: Optional[float] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: Optional[float] = None
    supplier: Optional[str] = None
    warranty_expiration: Optional[datetime] = None
    notes: Optional[str] = None

class AssetUpdate(BaseModel):
    asset_tag: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    device_type: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    processor: Optional[str] = None
    ram_gb: Optional[int] = None
    storage_gb: Optional[int] = None
    screen_size: Optional[float] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: Optional[float] = None
    supplier: Optional[str] = None
    warranty_expiration: Optional[datetime] = None
    department: Optional[str] = None
    location: Optional[str] = None
    status: Optional[AssetStatus] = None
    condition: Optional[AssetCondition] = None
    notes: Optional[str] = None

class AssetAssign(BaseModel):
    assigned_email: EmailStr
    assigned_to: str
    assigned_username: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    assignment_override: bool = False

class MaintenanceCreate(BaseModel):
    maintenance_type: MaintenanceType
    title: str
    description: Optional[str] = None
    start_date: datetime
    completion_date: Optional[datetime] = None
    cost: Optional[float] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None

# API Routes

@app.get("/")
async def root():
    return {"message": "HAM - Hardware Asset Management API", "version": "1.5.0"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Scheduler status endpoint
@app.get("/api/scheduler/status")
async def get_scheduler_status():
    if not scheduler.running:
        return {"enabled": False, "message": "Scheduler not running"}
    jobs = scheduler.get_jobs()
    return {
        "enabled": True,
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            }
            for job in jobs
        ]
    }

# Asset endpoints
@app.get("/api/assets")
async def list_assets(
    skip: int = 0, limit: int = 100,
    status: Optional[str] = None, device_type: Optional[str] = None,
    platform: Optional[str] = None, assigned_email: Optional[str] = None,
    search: Optional[str] = None, warranty: Optional[str] = None,
    fleet: Optional[str] = None, location: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = None
):
    try:
        query = db.query(Asset)
        
        if status:
            if status == 'unassigned':
                query = query.filter(or_(Asset.assigned_email == None, Asset.assigned_email == ''))
            else:
                status_enum = parse_status_filter(status)
                if status_enum:
                    query = query.filter(Asset.status == status_enum)
                else:
                    # Unknown status value — return empty result
                    return {"total": 0, "assets": [], "skip": skip, "limit": limit}
        if device_type:
            query = query.filter(Asset.device_type == device_type)
        if platform:
            query = query.filter(get_platform_filter(platform))
        if assigned_email:
            query = query.filter(Asset.assigned_email == assigned_email)
        if location:
            query = query.filter(Asset.location == location)
        if search:
            query = query.filter(or_(
                Asset.asset_tag.ilike(f"%{search}%"),
                Asset.serial_number.ilike(f"%{search}%"),
                Asset.model.ilike(f"%{search}%"),
                Asset.hostname.ilike(f"%{search}%"),
                Asset.assigned_to.ilike(f"%{search}%")
            ))
        if warranty == 'expiring':
            thirty_days = datetime.utcnow() + timedelta(days=30)
            query = query.filter(and_(
                Asset.warranty_expiration <= thirty_days,
                Asset.warranty_expiration >= datetime.utcnow(),
                Asset.status != AssetStatus.RETIRED
            ))
        if fleet == 'enrolled':
            query = query.filter(Asset.fleet_enrolled == True)
        
        total = query.count()
        assets = query.offset(skip).limit(limit).all()
        return {"total": total, "assets": assets, "skip": skip, "limit": limit}
    except Exception as e:
        print(f"Asset list error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to load assets: {str(e)}")

@app.get("/api/assets/{asset_id}")
async def get_asset(asset_id: int, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset

@app.post("/api/assets")
async def create_asset(asset_data: AssetCreate, db: Session = Depends(get_db), current_user: dict = None):
    existing = db.query(Asset).filter(Asset.serial_number == asset_data.serial_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Asset with this serial number already exists")
    asset = Asset(**asset_data.dict(), created_by='system', updated_by='system')
    db.add(asset)
    audit = AuditLog(asset=asset, action='created', user_email='system', user_name='system', timestamp=datetime.utcnow())
    db.add(audit)
    db.commit()
    db.refresh(asset)
    return asset

@app.put("/api/assets/{asset_id}")
async def update_asset(asset_id: int, asset_data: AssetUpdate, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    changes = []
    for field, value in asset_data.dict(exclude_unset=True).items():
        if value is not None and getattr(asset, field) != value:
            old_value = getattr(asset, field)
            setattr(asset, field, value)
            changes.append(f"{field}: {old_value} -> {value}")
    if changes:
        asset.updated_by = 'system'
        audit = AuditLog(asset=asset, action='updated', new_value='; '.join(changes), user_email='system', user_name='system', timestamp=datetime.utcnow())
        db.add(audit)
    db.commit()
    db.refresh(asset)
    return asset

@app.post("/api/assets/{asset_id}/assign")
async def assign_asset(asset_id: int, assignment: AssetAssign, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    old_email = asset.assigned_email
    asset.assigned_email = assignment.assigned_email
    asset.assigned_to = assignment.assigned_to
    asset.assigned_username = assignment.assigned_username
    asset.department = assignment.department
    asset.location = assignment.location
    asset.assignment_date = datetime.utcnow()
    asset.status = AssetStatus.ASSIGNED
    asset.assignment_override = assignment.assignment_override
    asset.updated_by = 'system'
    audit = AuditLog(asset=asset, action='assigned', field_name='assigned_email', old_value=old_email, new_value=assignment.assigned_email, user_email='system', user_name='system', timestamp=datetime.utcnow())
    db.add(audit)
    db.commit()
    db.refresh(asset)
    return asset

@app.post("/api/assets/{asset_id}/return")
async def return_asset(asset_id: int, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    old_email = asset.assigned_email
    asset.assigned_email = None
    asset.assigned_to = None
    asset.assigned_username = None
    asset.assignment_date = None
    asset.status = AssetStatus.AVAILABLE
    asset.assignment_override = False
    asset.updated_by = 'system'
    audit = AuditLog(asset=asset, action='returned', field_name='assigned_email', old_value=old_email, new_value=None, user_email='system', user_name='system', timestamp=datetime.utcnow())
    db.add(audit)
    db.commit()
    db.refresh(asset)
    return asset

@app.delete("/api/assets/{asset_id}")
async def delete_asset(asset_id: int, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.status = AssetStatus.RETIRED
    asset.updated_by = 'system'
    audit = AuditLog(asset=asset, action='retired', user_email='system', user_name='system', timestamp=datetime.utcnow())
    db.add(audit)
    db.commit()
    return {"message": "Asset retired successfully"}

# Maintenance endpoints
@app.get("/api/assets/{asset_id}/maintenance")
async def list_maintenance_records(asset_id: int, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    records = db.query(MaintenanceRecord).filter(MaintenanceRecord.asset_id == asset_id).order_by(MaintenanceRecord.start_date.desc()).all()
    return records

@app.post("/api/assets/{asset_id}/maintenance")
async def create_maintenance_record(asset_id: int, maintenance: MaintenanceCreate, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    record = MaintenanceRecord(asset_id=asset_id, **maintenance.dict(), created_by='system', performed_by='system')
    db.add(record)
    audit = AuditLog(asset=asset, action='maintenance_added', new_value=f"{maintenance.maintenance_type}: {maintenance.title}", user_email='system', user_name='system', timestamp=datetime.utcnow())
    db.add(audit)
    db.commit()
    db.refresh(record)
    return record

# Audit log endpoints
@app.get("/api/assets/{asset_id}/audit")
async def get_audit_log(asset_id: int, db: Session = Depends(get_db), current_user: dict = None):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    logs = db.query(AuditLog).filter(AuditLog.asset_id == asset_id).order_by(AuditLog.timestamp.desc()).all()
    return logs

# Fleet MDM sync endpoints
@app.post("/api/fleet/sync")
async def trigger_fleet_sync(db: Session = Depends(get_db), current_user: dict = None):
    fleet_service = _create_fleet_service()
    stats = await fleet_service.sync_devices(db, 'system')
    return {"message": "Fleet sync completed", "stats": stats}

@app.get("/api/fleet/sync-logs")
async def get_fleet_sync_logs(limit: int = 10, db: Session = Depends(get_db), current_user: dict = None):
    logs = db.query(FleetSyncLog).order_by(FleetSyncLog.sync_started.desc()).limit(limit).all()
    return logs

# Apple Business Manager sync endpoints
@app.post("/api/abm/sync")
async def trigger_abm_sync(db: Session = Depends(get_db), current_user: dict = None):
    abm_client_id = os.getenv("ABM_CLIENT_ID")
    abm_key_id = os.getenv("ABM_KEY_ID")
    abm_key_path = os.getenv("ABM_PRIVATE_KEY_PATH")
    if not all([abm_client_id, abm_key_id, abm_key_path]):
        raise HTTPException(status_code=500, detail="ABM integration is not configured. Set ABM_CLIENT_ID, ABM_KEY_ID, and ABM_PRIVATE_KEY_PATH in .env")
    abm_service = ABMService(client_id=abm_client_id, key_id=abm_key_id, private_key_path=abm_key_path)
    stats = await abm_service.sync_devices(db, "system")
    return {"message": "ABM sync completed", "stats": stats}

@app.get("/api/abm/sync-logs")
async def get_abm_sync_logs(limit: int = 10, db: Session = Depends(get_db), current_user: dict = None):
    logs = db.query(ABMSyncLog).order_by(ABMSyncLog.sync_started.desc()).limit(limit).all()
    return logs

# Dashboard/Stats endpoints
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db), current_user: dict = None):
    try:
        total_assets = db.query(Asset).count()
        assigned_assets = db.query(Asset).filter(Asset.status == AssetStatus.ASSIGNED).count()
        available_assets = db.query(Asset).filter(Asset.status == AssetStatus.AVAILABLE).count()

        try:
            locked_assets = db.query(Asset).filter(Asset.status == AssetStatus.LOCKED).count()
        except Exception:
            locked_assets = 0

        unassigned_assets = db.query(Asset).filter(
            or_(Asset.assigned_email == None, Asset.assigned_email == ''),
            Asset.status != AssetStatus.RETIRED
        ).count()

        thirty_days = datetime.utcnow() + timedelta(days=30)
        warranty_expiring = db.query(Asset).filter(and_(
            Asset.warranty_expiration <= thirty_days,
            Asset.warranty_expiration >= datetime.utcnow(),
            Asset.status != AssetStatus.RETIRED
        )).count()

        fleet_enrolled = db.query(Asset).filter(Asset.fleet_enrolled == True).count()
        abm_enrolled = db.query(Asset).filter(Asset.abm_device_id != None).count()

        all_assets = db.query(Asset).filter(Asset.status != AssetStatus.RETIRED).all()
        platform_counts = Counter(resolve_platform(a) for a in all_assets)
        platform_breakdown = dict(sorted(platform_counts.items(), key=lambda x: -x[1]))

        # Location breakdown
        location_counts = Counter(a.location or 'Unset' for a in all_assets)
        location_breakdown = dict(sorted(location_counts.items(), key=lambda x: -x[1]))

        return {
            "total_assets": total_assets,
            "assigned": assigned_assets,
            "available": available_assets,
            "unassigned": unassigned_assets,
            "locked": locked_assets,
            "warranty_expiring_soon": warranty_expiring,
            "fleet_enrolled": fleet_enrolled,
            "abm_enrolled": abm_enrolled,
            "platform_breakdown": platform_breakdown,
            "location_breakdown": location_breakdown
        }
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to load dashboard stats: {str(e)}")

@app.get("/api/assets/export/csv")
async def export_assets_csv(status: Optional[AssetStatus] = None, device_type: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = None):
    query = db.query(Asset)
    if status:
        query = query.filter(Asset.status == status)
    if device_type:
        query = query.filter(Asset.device_type == device_type)
    assets = query.all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Asset Tag', 'Serial Number', 'Manufacturer', 'Model', 'Platform',
        'Hostname', 'OS Type', 'OS Version', 'Processor', 'RAM (GB)', 'Storage (GB)',
        'Status', 'Condition', 'Assigned To', 'Assigned Email', 'Department', 'Location',
        'Purchase Date', 'Purchase Cost', 'Warranty Expiration',
        'Fleet Enrolled', 'Fleet Last Seen',
        'ABM Status', 'ABM Product Family', 'ABM Order Number', 'ABM Order Date',
        'ABM Color', 'ABM Capacity', 'ABM Added Date', 'Created At'
    ])
    for asset in assets:
        writer.writerow([
            asset.asset_tag, asset.serial_number, asset.manufacturer, asset.model,
            resolve_platform(asset), asset.hostname or '', asset.os_type or '',
            asset.os_version or '', asset.processor or '', asset.ram_gb or '',
            asset.storage_gb or '',
            asset.status.value if asset.status else '',
            asset.condition.value if asset.condition else '',
            asset.assigned_to or '', asset.assigned_email or '', asset.department or '',
            asset.location or '',
            asset.purchase_date.strftime('%Y-%m-%d') if asset.purchase_date else '',
            asset.purchase_cost or '',
            asset.warranty_expiration.strftime('%Y-%m-%d') if asset.warranty_expiration else '',
            'Yes' if asset.fleet_enrolled else 'No',
            asset.fleet_last_seen.strftime('%Y-%m-%d %H:%M') if asset.fleet_last_seen else '',
            asset.abm_status or '', asset.abm_product_family or '',
            asset.abm_order_number or '',
            asset.abm_order_date.strftime('%Y-%m-%d') if asset.abm_order_date else '',
            asset.abm_color or '', asset.abm_device_capacity or '',
            asset.abm_added_date.strftime('%Y-%m-%d') if asset.abm_added_date else '',
            asset.created_at.strftime('%Y-%m-%d') if asset.created_at else ''
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ham-asset-export.csv"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
