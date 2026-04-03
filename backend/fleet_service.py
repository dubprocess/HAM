import httpx
import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session
from models import Asset, AssetStatus, FleetSyncLog, AuditLog
import logging

logger = logging.getLogger(__name__)

# Only accept Chrome profile emails from these domains for auto-assignment.
# Configure via ALLOWED_EMAIL_DOMAINS env var (comma-separated), e.g.: example.com,company.org
ALLOWED_EMAIL_DOMAINS = [d.strip() for d in os.getenv('ALLOWED_EMAIL_DOMAINS', 'example.com').split(',') if d.strip()]

class FleetMDMService:
    """Service for integrating with Fleet MDM API"""
    
    def __init__(self, fleet_url: str, api_token: str, okta_service=None):
        self.fleet_url = fleet_url.rstrip('/')
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        self.okta_service = okta_service
    
    @staticmethod
    def _is_corporate_email(email: str) -> bool:
        if not email or '@' not in email:
            return False
        domain = email.split('@')[1].lower()
        return domain in ALLOWED_EMAIL_DOMAINS

    @staticmethod
    def _extract_model_identifier(fleet_host: Dict) -> Optional[str]:
        """Extract the Apple model identifier (e.g. Mac15,12) from Fleet host data.
        
        Fleet exposes this as hardware_model on macOS/darwin hosts.
        Only populated for Apple devices — returns None for Windows/Linux.
        """
        platform = fleet_host.get('platform', '').lower()
        if 'darwin' not in platform:
            return None
        model_id = fleet_host.get('hardware_model', '')
        return model_id if model_id else None

    @staticmethod
    def _is_device_locked(fleet_host: Dict) -> bool:
        """Detect if a Fleet device is pin-locked.
        
        Checks multiple fields for compatibility across Fleet versions:
        - host.mdm.device_status == 'locked'
        - host.mdm.lock_date is present
        - host.mdm.pending_actions contains 'lock'
        - host.mdm.macos_settings.action_required contains 'lock' 
        - host-level status == 'locked'
        - host.mdm.profiles_status contains lock indicators
        - host.mdm.device_lock field presence
        """
        mdm = fleet_host.get('mdm', {}) or {}
        
        # Check mdm.device_status
        device_status = mdm.get('device_status', '').lower()
        if device_status == 'locked':
            return True
        
        # Check mdm.lock_date
        if mdm.get('lock_date'):
            return True
        
        # Check mdm.device_lock (some Fleet versions use this)
        device_lock = mdm.get('device_lock', {}) or {}
        if device_lock:
            lock_status = device_lock.get('status', '').lower()
            if lock_status in ('locked', 'pending', 'acknowledged'):
                return True
        
        # Check mdm.pending_actions
        pending = mdm.get('pending_actions', []) or []
        if any('lock' in str(action).lower() for action in pending):
            return True
        
        # Check mdm.macos_settings for lock-related actions
        macos_settings = mdm.get('macos_settings', {}) or {}
        action_required = macos_settings.get('action_required', '')
        if action_required and 'lock' in str(action_required).lower():
            return True

        # Check mdm.profiles_status
        profiles_status = mdm.get('profiles_status', '').lower()
        if 'lock' in profiles_status:
            return True

        # Check mdm.connected_to_fleet and raw mdm command status
        raw_mdm = mdm.get('raw_decryptable', '')
        if raw_mdm and 'DeviceLock' in str(raw_mdm):
            return True

        # Check host-level status
        host_status = fleet_host.get('status', '').lower()
        if host_status == 'locked':
            return True
        
        return False

    @staticmethod
    def _log_mdm_debug(fleet_host: Dict, serial: str):
        """Log all MDM-related fields for debugging lock detection."""
        mdm = fleet_host.get('mdm', {}) or {}
        host_status = fleet_host.get('status', '')
        hostname = fleet_host.get('hostname', '')
        
        # Find any key in the host that contains 'lock' (case-insensitive)
        lock_keys = {}
        def find_lock_keys(obj, prefix=''):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    path = f"{prefix}.{k}" if prefix else k
                    if 'lock' in k.lower():
                        lock_keys[path] = v
                    if isinstance(v, (dict, list)):
                        find_lock_keys(v, path)
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    find_lock_keys(item, f"{prefix}[{i}]")
        
        find_lock_keys(fleet_host)
        
        logger.warning(
            f"[LOCK DEBUG] {hostname} ({serial}) | "
            f"host.status={host_status} | "
            f"mdm.device_status={mdm.get('device_status', 'N/A')} | "
            f"mdm.lock_date={mdm.get('lock_date', 'N/A')} | "
            f"mdm.device_lock={mdm.get('device_lock', 'N/A')} | "
            f"mdm.pending_actions={mdm.get('pending_actions', 'N/A')} | "
            f"mdm.macos_settings={mdm.get('macos_settings', 'N/A')} | "
            f"mdm.profiles_status={mdm.get('profiles_status', 'N/A')} | "
            f"LOCK KEYS FOUND: {json.dumps(lock_keys) if lock_keys else 'NONE'} | "
            f"ALL MDM KEYS: {list(mdm.keys())}"
        )

    async def get_all_hosts(self) -> List[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.fleet_url}/api/v1/fleet/hosts",
                    headers=self.headers, timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get('hosts', [])
            except Exception as e:
                logger.error(f"Error fetching hosts from Fleet: {str(e)}")
                raise
    
    async def get_host_details(self, host_id: str) -> Dict:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.fleet_url}/api/v1/fleet/hosts/{host_id}",
                    headers=self.headers, timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get('host', {})
            except Exception as e:
                logger.error(f"Error fetching host {host_id} from Fleet: {str(e)}")
                raise

    async def get_device_mapping(self, host_id: str) -> List[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.fleet_url}/api/v1/fleet/hosts/{host_id}/device_mapping",
                    headers=self.headers, timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get('device_mapping', [])
            except Exception as e:
                logger.warning(f"Could not fetch device mapping for host {host_id}: {e}")
                return []
    
    def parse_fleet_device(self, fleet_host: Dict, device_mapping: List[Dict] = None) -> Dict:
        """Parse Fleet host data into our asset format"""
        platform = fleet_host.get('platform', '').lower()
        if 'darwin' in platform:
            os_type = 'macOS'
        elif 'windows' in platform:
            os_type = 'Windows'
        elif 'linux' in platform:
            os_type = 'Linux'
        else:
            os_type = platform.capitalize()
        
        os_version = fleet_host.get('os_version', '')
        if os_type and os_version.lower().startswith(os_type.lower()):
            os_version = os_version[len(os_type):].strip()
        
        assigned_email = ''
        assigned_name = ''
        assigned_username = ''
        assignment_source = ''

        # Try 1: end_users (IdP/SCIM)
        end_users = fleet_host.get('end_users', [])
        if end_users:
            user_info = end_users[0]
            idp_email = user_info.get('idp_username', '')
            if idp_email:
                assigned_email = idp_email
                assigned_name = user_info.get('idp_full_name', '')
                assigned_username = idp_email.split('@')[0]
                assignment_source = 'okta_scim'

        # Try 2: Google Chrome profiles (corporate emails only)
        if not assigned_email and device_mapping:
            for mapping in device_mapping:
                if mapping.get('source') == 'google_chrome_profiles' and mapping.get('email'):
                    chrome_email = mapping['email']
                    if self._is_corporate_email(chrome_email):
                        assigned_email = chrome_email
                        assigned_username = chrome_email.split('@')[0]
                        assigned_name = ''
                        assignment_source = 'chrome_profile'
                        break

        # Try 3: device_mapping embedded in host detail
        if not assigned_email:
            host_device_mapping = fleet_host.get('device_mapping', [])
            if host_device_mapping:
                for mapping in host_device_mapping:
                    if mapping.get('source') == 'google_chrome_profiles' and mapping.get('email'):
                        chrome_email = mapping['email']
                        if self._is_corporate_email(chrome_email):
                            assigned_email = chrome_email
                            assigned_username = chrome_email.split('@')[0]
                            assigned_name = ''
                            assignment_source = 'chrome_profile'
                            break

        # Try 4: primary_user (last resort)
        if not assigned_email:
            primary_user = fleet_host.get('primary_user', {})
            if primary_user:
                assigned_email = primary_user.get('email', '')
                assigned_name = primary_user.get('name', '')
                assigned_username = primary_user.get('username', '')
                if assigned_email:
                    assignment_source = 'primary_user'
        
        serial = fleet_host.get('hardware_serial', '')
        
        # Log MDM debug info for ALL devices during sync
        self._log_mdm_debug(fleet_host, serial)
        
        is_locked = self._is_device_locked(fleet_host)
        
        if is_locked:
            logger.warning(f"[LOCK DETECTED] {fleet_host.get('hostname', '')} ({serial}) detected as LOCKED")
        
        return {
            'fleet_device_id': str(fleet_host.get('id')),
            'serial_number': serial,
            'manufacturer': fleet_host.get('hardware_vendor', 'Unknown'),
            'model': fleet_host.get('hardware_model', 'Unknown'),
            'model_identifier': self._extract_model_identifier(fleet_host),
            'hostname': fleet_host.get('hostname', ''),
            'os_type': os_type,
            'os_version': os_version,
            'processor': fleet_host.get('cpu_brand', ''),
            'ram_gb': fleet_host.get('memory', 0) // (1024 ** 3) if fleet_host.get('memory') else None,
            'storage_gb': int(fleet_host.get('gigs_disk_space_available', 0)) if fleet_host.get('gigs_disk_space_available') else None,
            'fleet_last_seen': datetime.fromisoformat(fleet_host.get('seen_time').replace('Z', '+00:00')) if fleet_host.get('seen_time') else None,
            'fleet_enrolled': True,
            'assigned_email': assigned_email,
            'assigned_username': assigned_username,
            'assigned_to': assigned_name,
            'assignment_source': assignment_source,
            'is_locked': is_locked,
        }
    
    async def _lookup_user_location(self, email: str) -> Optional[str]:
        """Look up a user's location from Okta. Returns location code or None."""
        if not self.okta_service or not email:
            return None
        try:
            return await self.okta_service.get_user_location(email)
        except Exception as e:
            logger.warning(f"Okta location lookup failed for {email}: {e}")
            return None

    async def sync_devices(self, db: Session, user_email: str) -> Dict:
        """Sync all devices from Fleet MDM. Detects locked devices and manages transitions."""
        sync_log = FleetSyncLog(sync_started=datetime.utcnow(), status='running')
        db.add(sync_log)
        db.commit()
        
        # Clear Okta cache at start of each sync
        if self.okta_service:
            self.okta_service.clear_cache()
        
        stats = {
            'processed': 0, 'created': 0, 'updated': 0,
            'auto_assigned': 0, 'chrome_assigned': 0,
            'retired_skipped': 0, 'locked': 0, 'unlocked': 0,
            'status_fixed': 0, 'locations_set': 0, 'errors': []
        }
        
        try:
            fleet_hosts = await self.get_all_hosts()
            
            for fleet_host in fleet_hosts:
                try:
                    stats['processed'] += 1
                    device_data = self.parse_fleet_device(fleet_host)
                    
                    fleet_device_id = fleet_host.get('id')
                    device_mapping = []
                    if fleet_device_id:
                        try:
                            detailed_host = await self.get_host_details(fleet_device_id)
                            end_users = detailed_host.get('end_users', [])
                            has_idp_user = any(u.get('idp_username') for u in end_users) if end_users else False
                            if not has_idp_user:
                                device_mapping = await self.get_device_mapping(fleet_device_id)
                            device_data = self.parse_fleet_device(detailed_host, device_mapping)
                        except Exception as e:
                            logger.warning(f"Could not fetch detail for device {fleet_device_id}: {e}")
                    
                    if not device_data['serial_number']:
                        continue
                    
                    asset = db.query(Asset).filter(Asset.serial_number == device_data['serial_number']).first()
                    
                    if asset:
                        # Skip retired devices
                        if asset.status == AssetStatus.RETIRED:
                            stats['retired_skipped'] += 1
                            continue
                        
                        fleet_says_locked = device_data.get('is_locked', False)
                        
                        # Case 1: Fleet reports locked, HAM doesn't have it locked yet
                        if fleet_says_locked and asset.status != AssetStatus.LOCKED:
                            old_status = asset.status.value if asset.status else 'unknown'
                            old_email = asset.assigned_email
                            asset.status = AssetStatus.LOCKED
                            asset.assigned_email = None
                            asset.assigned_to = None
                            asset.assigned_username = None
                            asset.assignment_date = None
                            asset.assignment_override = False
                            asset.updated_by = 'fleet_auto_sync'
                            audit = AuditLog(
                                asset=asset, action='locked', field_name='status',
                                old_value=f"{old_status} (assigned to: {old_email or 'none'})",
                                new_value='locked (device pin-locked in Fleet, user unassigned)',
                                user_email='system', user_name='Fleet Auto-Sync',
                                timestamp=datetime.utcnow()
                            )
                            db.add(audit)
                            stats['locked'] += 1
                            db.commit()
                            continue
                        
                        # Case 2: Locked in HAM, Fleet says no longer locked + new user detected
                        if not fleet_says_locked and asset.status == AssetStatus.LOCKED:
                            new_email = device_data.get('assigned_email')
                            if new_email:
                                asset.status = AssetStatus.ASSIGNED
                                asset.assigned_email = new_email
                                asset.assigned_to = device_data.get('assigned_to', '')
                                asset.assigned_username = device_data.get('assigned_username', '')
                                asset.assignment_date = datetime.utcnow()
                                asset.assignment_override = False
                                asset.updated_by = 'fleet_auto_sync'
                                
                                # Look up location from Okta
                                location = await self._lookup_user_location(new_email)
                                if location:
                                    asset.location = location
                                    stats['locations_set'] += 1
                                
                                source_label = {
                                    'okta_scim': 'Okta SCIM',
                                    'chrome_profile': 'Chrome Profile',
                                    'primary_user': 'Fleet Primary User',
                                }.get(device_data.get('assignment_source', ''), 'Fleet')
                                audit = AuditLog(
                                    asset=asset, action='unlocked_and_reassigned', field_name='status',
                                    old_value='locked',
                                    new_value=f"assigned to {new_email} (via {source_label} - device no longer locked in Fleet)",
                                    user_email='system', user_name='Fleet Auto-Sync',
                                    timestamp=datetime.utcnow()
                                )
                                db.add(audit)
                                stats['unlocked'] += 1
                                stats['auto_assigned'] += 1
                                db.commit()
                                continue
                            continue  # No new user yet, keep locked
                        
                        # Case 3: Locked in both Fleet and HAM - skip
                        if fleet_says_locked and asset.status == AssetStatus.LOCKED:
                            continue
                        
                        # Normal sync (not locked)
                        updated = self._update_asset_from_fleet(asset, device_data, user_email, db)
                        if updated:
                            stats['updated'] += 1
                    else:
                        asset = self._create_asset_from_fleet(device_data, user_email, db)
                        stats['created'] += 1
                        
                        if device_data.get('is_locked', False):
                            asset.status = AssetStatus.LOCKED
                            audit = AuditLog(
                                asset=asset, action='locked', field_name='status',
                                old_value='available',
                                new_value='locked (device pin-locked in Fleet on first sync)',
                                user_email='system', user_name='Fleet Auto-Sync',
                                timestamp=datetime.utcnow()
                            )
                            db.add(audit)
                            stats['locked'] += 1
                            db.commit()
                            continue
                    
                    # Auto-assign (normal flow)
                    if device_data.get('assigned_email'):
                        result = await self._auto_assign_device(asset, device_data, user_email, db)
                        if result == 'assigned':
                            stats['auto_assigned'] += 1
                            if device_data.get('assignment_source') == 'chrome_profile':
                                stats['chrome_assigned'] += 1
                        elif result == 'override_cleared':
                            stats['auto_assigned'] += 1
                            stats.setdefault('overrides_cleared', 0)
                            stats['overrides_cleared'] += 1
                        
                        # Update location from Okta if we have a user
                        if result in ('assigned', 'override_cleared'):
                            location = await self._lookup_user_location(device_data['assigned_email'])
                            if location and asset.location != location:
                                old_location = asset.location
                                asset.location = location
                                stats['locations_set'] += 1
                                if old_location != location:
                                    audit = AuditLog(
                                        asset=asset, action='location_updated', field_name='location',
                                        old_value=old_location or 'none',
                                        new_value=f"{location} (from Okta user profile)",
                                        user_email='system', user_name='Fleet Auto-Sync',
                                        timestamp=datetime.utcnow()
                                    )
                                    db.add(audit)
                        elif result is None and asset.assigned_email:
                            # User didn't change, but check if location is missing
                            if not asset.location:
                                location = await self._lookup_user_location(asset.assigned_email)
                                if location:
                                    asset.location = location
                                    stats['locations_set'] += 1
                                    audit = AuditLog(
                                        asset=asset, action='location_updated', field_name='location',
                                        old_value='none',
                                        new_value=f"{location} (backfilled from Okta user profile)",
                                        user_email='system', user_name='Fleet Auto-Sync',
                                        timestamp=datetime.utcnow()
                                    )
                                    db.add(audit)
                    
                    db.commit()
                    
                except Exception as e:
                    logger.error(f"Error processing device: {str(e)}")
                    stats['errors'].append(str(e))
                    db.rollback()
                    continue
            
            # Cleanup orphaned ASSIGNED status
            orphaned = db.query(Asset).filter(
                Asset.status == AssetStatus.ASSIGNED,
                or_(Asset.assigned_email == None, Asset.assigned_email == '')
            ).all()
            
            for asset in orphaned:
                asset.status = AssetStatus.AVAILABLE
                asset.assigned_to = None
                asset.assigned_username = None
                asset.assignment_date = None
                asset.updated_by = 'fleet_auto_sync'
                audit = AuditLog(
                    asset=asset, action='status_corrected', field_name='status',
                    old_value='assigned',
                    new_value='available (no assignee found)',
                    user_email='system', user_name='Fleet Auto-Sync',
                    timestamp=datetime.utcnow()
                )
                db.add(audit)
                stats['status_fixed'] += 1
            
            if orphaned:
                db.commit()
            
            sync_log.sync_completed = datetime.utcnow()
            sync_log.status = 'completed'
            sync_log.devices_processed = stats['processed']
            sync_log.devices_created = stats['created']
            sync_log.devices_updated = stats['updated']
            sync_log.errors = '\n'.join(stats['errors']) if stats['errors'] else None
            db.commit()
            
        except Exception as e:
            logger.error(f"Fleet sync failed: {str(e)}")
            sync_log.sync_completed = datetime.utcnow()
            sync_log.status = 'failed'
            sync_log.errors = str(e)
            db.commit()
            raise
        
        return stats
    
    def _create_asset_from_fleet(self, device_data: Dict, user_email: str, db: Session) -> Asset:
        asset = Asset(
            asset_tag=f"AUTO-{device_data['serial_number'][:8]}",
            serial_number=device_data['serial_number'],
            manufacturer=device_data['manufacturer'],
            model=device_data['model'],
            model_identifier=device_data.get('model_identifier'),
            device_type='laptop',
            os_type=device_data['os_type'],
            os_version=device_data['os_version'],
            processor=device_data.get('processor'),
            ram_gb=device_data.get('ram_gb'),
            fleet_device_id=device_data['fleet_device_id'],
            fleet_last_seen=device_data.get('fleet_last_seen'),
            fleet_enrolled=True,
            status=AssetStatus.AVAILABLE,
            created_by=user_email, updated_by=user_email
        )
        db.add(asset)
        audit = AuditLog(asset=asset, action='created_from_fleet', user_email=user_email, timestamp=datetime.utcnow())
        db.add(audit)
        return asset
    
    def _update_asset_from_fleet(self, asset: Asset, device_data: Dict, user_email: str, db: Session) -> bool:
        updated = False
        changes = []
        sync_fields = {
            'os_version': device_data.get('os_version'),
            'hostname': device_data.get('hostname'),
            'manufacturer': device_data.get('manufacturer'),
            'model': device_data.get('model'),
            'model_identifier': device_data.get('model_identifier'),
            'processor': device_data.get('processor'),
            'ram_gb': device_data.get('ram_gb'),
            'storage_gb': device_data.get('storage_gb'),
            'fleet_device_id': device_data.get('fleet_device_id'),
            'fleet_last_seen': device_data.get('fleet_last_seen'),
            'fleet_enrolled': True
        }
        for field, new_value in sync_fields.items():
            if new_value and getattr(asset, field) != new_value:
                old_value = getattr(asset, field)
                setattr(asset, field, new_value)
                changes.append(f"{field}: {old_value} -> {new_value}")
                updated = True
        if updated:
            asset.updated_by = user_email
            audit = AuditLog(
                asset=asset, action='updated_from_fleet',
                new_value='; '.join(changes),
                user_email=user_email, timestamp=datetime.utcnow()
            )
            db.add(audit)
        return updated
    
    async def _auto_assign_device(self, asset: Asset, device_data: Dict, user_email: str, db: Session) -> str:
        new_email = device_data.get('assigned_email')
        new_username = device_data.get('assigned_username')
        new_name = device_data.get('assigned_to')
        assignment_source = device_data.get('assignment_source', '')
        
        if not new_email:
            return None
        if asset.assigned_email == new_email:
            return None
        
        old_email = asset.assigned_email
        override_cleared = False
        
        if asset.assignment_override and old_email and old_email != new_email:
            asset.assignment_override = False
            override_cleared = True
        
        asset.assigned_email = new_email
        asset.assigned_username = new_username
        asset.assigned_to = new_name
        asset.assignment_date = datetime.utcnow()
        asset.status = AssetStatus.ASSIGNED
        asset.updated_by = 'fleet_auto_sync'
        
        action = 'auto_assigned_override_cleared' if override_cleared else 'auto_assigned'
        source_label = {
            'okta_scim': 'Okta SCIM', 'chrome_profile': 'Chrome Profile',
            'primary_user': 'Fleet Primary User',
        }.get(assignment_source, 'Fleet')
        
        audit = AuditLog(
            asset=asset, action=action, field_name='assigned_email',
            old_value=old_email,
            new_value=f"{new_email} (via {source_label})",
            user_email='system', user_name='Fleet Auto-Sync',
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        return 'override_cleared' if override_cleared else 'assigned'
