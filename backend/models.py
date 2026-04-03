from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class AssetStatus(str, enum.Enum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    LOCKED = "locked"
    RETIRED = "retired"
    LOST = "lost"

class AssetCondition(str, enum.Enum):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"

class MaintenanceType(str, enum.Enum):
    REPAIR = "repair"
    UPGRADE = "upgrade"
    CLEANING = "cleaning"
    INSPECTION = "inspection"
    OTHER = "other"


class LocalUser(Base):
    """
    Local user account for LOCAL_AUTH=true mode.
    Stores bcrypt-hashed passwords. Not used when LOCAL_AUTH=false.
    """
    __tablename__ = "local_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    hashed_password = Column(String(500), nullable=False)
    is_admin = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(100), unique=True, index=True, nullable=False)
    serial_number = Column(String(200), unique=True, index=True, nullable=False)
    
    # Device Info
    manufacturer = Column(String(100), nullable=False)
    model = Column(String(200), nullable=False)
    model_identifier = Column(String(100))  # e.g. Mac15,12 — Apple devices only
    device_type = Column(String(50), nullable=False)
    hostname = Column(String(200))
    os_type = Column(String(50))
    os_version = Column(String(100))
    
    # Specs
    processor = Column(String(200))
    ram_gb = Column(Integer)
    storage_gb = Column(Integer)
    screen_size = Column(Float)
    
    # Purchase Info
    purchase_date = Column(DateTime)
    purchase_cost = Column(Float)
    supplier = Column(String(200))
    warranty_expiration = Column(DateTime)
    
    # Assignment Info
    assigned_to = Column(String(200))
    assigned_email = Column(String(200), index=True)
    assigned_username = Column(String(200))
    department = Column(String(200))
    location = Column(String(200))
    location_override = Column(Boolean, default=False)
    storage_location = Column(String(200))
    assignment_date = Column(DateTime)
    assignment_override = Column(Boolean, default=False)
    
    # Status
    status = Column(Enum(AssetStatus), default=AssetStatus.AVAILABLE, nullable=False)
    condition = Column(Enum(AssetCondition), default=AssetCondition.GOOD)
    notes = Column(Text)
    
    # Fleet MDM Integration
    fleet_device_id = Column(String(200), unique=True, index=True)
    fleet_last_seen = Column(DateTime)
    fleet_enrolled = Column(Boolean, default=False)
    fleet_sync_enabled = Column(Boolean, default=True)
    
    # Apple Business Manager Integration
    abm_device_id = Column(String(200), unique=True, index=True)
    abm_status = Column(String(50))
    abm_order_number = Column(String(200))
    abm_order_date = Column(DateTime)
    abm_product_family = Column(String(100))
    abm_product_type = Column(String(100))
    abm_device_capacity = Column(String(50))
    abm_color = Column(String(50))
    abm_part_number = Column(String(100))
    abm_added_date = Column(DateTime)
    abm_purchase_source = Column(String(100))
    abm_last_synced = Column(DateTime)
    
    # AppleCare / Warranty (from ABM API)
    applecare_status = Column(String(50))
    applecare_description = Column(String(200))
    applecare_start_date = Column(DateTime)
    applecare_end_date = Column(DateTime)
    applecare_agreement_number = Column(String(200))
    applecare_is_renewable = Column(Boolean)
    applecare_payment_type = Column(String(100))
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(200))
    updated_by = Column(String(200))
    
    # Relationships
    maintenance_records = relationship("MaintenanceRecord", back_populates="asset", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="asset", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="asset", cascade="all, delete-orphan")

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, index=True, nullable=False)
    username = Column(String(200), unique=True, index=True)
    full_name = Column(String(200), nullable=False)
    department = Column(String(200))
    location = Column(String(200))
    employee_id = Column(String(100), unique=True)
    active = Column(Boolean, default=True)
    
    okta_user_id = Column(String(200), unique=True)
    last_synced = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    
    maintenance_type = Column(Enum(MaintenanceType), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    start_date = Column(DateTime, nullable=False)
    completion_date = Column(DateTime)
    cost = Column(Float)
    vendor = Column(String(200))
    
    performed_by = Column(String(200))
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(200))
    
    asset = relationship("Asset", back_populates="maintenance_records")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    
    action = Column(String(100), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    
    user_email = Column(String(200), nullable=False)
    user_name = Column(String(200))
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    asset = relationship("Asset", back_populates="audit_logs")

class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(100))
    file_size = Column(Integer)
    description = Column(Text)
    
    uploaded_by = Column(String(200))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    asset = relationship("Asset", back_populates="attachments")

class FleetSyncLog(Base):
    __tablename__ = "fleet_sync_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    sync_started = Column(DateTime, nullable=False)
    sync_completed = Column(DateTime)
    devices_processed = Column(Integer, default=0)
    devices_created = Column(Integer, default=0)
    devices_updated = Column(Integer, default=0)
    errors = Column(Text)
    status = Column(String(50))
    
    created_at = Column(DateTime, default=datetime.utcnow)

class ABMSyncLog(Base):
    __tablename__ = "abm_sync_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    sync_started = Column(DateTime, nullable=False)
    sync_completed = Column(DateTime)
    devices_processed = Column(Integer, default=0)
    devices_created = Column(Integer, default=0)
    devices_enriched = Column(Integer, default=0)
    errors = Column(Text)
    status = Column(String(50))
    
    created_at = Column(DateTime, default=datetime.utcnow)

class AlertSetting(Base):
    """Key-value store for alert configuration."""
    __tablename__ = "alert_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(String(500), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
