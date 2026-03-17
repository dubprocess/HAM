"""
Jamf Pro MDM Service — STUB

This file is a starting point for contributors adding Jamf Pro support to HAM.
See docs/jamf.md for full implementation guidance and field mappings.

To activate: set MDM_PROVIDER=jamf in your .env file and update
_create_mdm_service() in main.py to instantiate this class.

Current status: STUB — not yet implemented.
"""

import os
import logging
from typing import Optional
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from models import (
    Asset, AssetStatus, AssetCondition,
    FleetSyncLog, AuditLog
)

logger = logging.getLogger(__name__)


class JamfMDMService:
    """
    Jamf Pro MDM integration for HAM.

    Implements the same sync_devices() interface as FleetMDMService
    so it can be used as a drop-in replacement when MDM_PROVIDER=jamf.

    Supports:
    - OAuth2 client credentials (Jamf Pro 10.49+) via client_id + client_secret
    - Basic Auth (older versions) via username + password

    See docs/jamf.md for setup instructions and field mappings.
    """

    def __init__(
        self,
        jamf_url: str,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self.jamf_url = jamf_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret
        self.username = username
        self.password = password
        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    async def _get_token(self) -> str:
        """
        Obtain a Bearer token from Jamf Pro.

        Uses OAuth2 client credentials if client_id/secret are set,
        otherwise falls back to Basic Auth token exchange.
        """
        # TODO: implement token caching + refresh logic
        async with httpx.AsyncClient() as client:
            if self.client_id and self.client_secret:
                # OAuth2 client credentials (Jamf Pro 10.49+)
                resp = await client.post(
                    f"{self.jamf_url}/api/oauth/token",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    }
                )
                resp.raise_for_status()
                return resp.json()["access_token"]
            else:
                # Basic Auth token exchange (older Jamf Pro)
                resp = await client.post(
                    f"{self.jamf_url}/api/v1/auth/token",
                    auth=(self.username, self.password)
                )
                resp.raise_for_status()
                return resp.json()["token"]

    # ------------------------------------------------------------------
    # Device fetching
    # ------------------------------------------------------------------

    async def get_all_computers(self) -> list:
        """
        Fetch all computers from Jamf Pro with relevant inventory sections.

        Uses the Jamf Pro JSON API (/api/v1/computers-inventory).
        Falls back to classic XML API (/JSSResource/computers) if needed.
        """
        # TODO: implement with pagination
        # Example sections to request:
        # GENERAL, HARDWARE, USER_AND_LOCATION, OPERATING_SYSTEM, STORAGE
        raise NotImplementedError(
            "JamfMDMService.get_all_computers() not yet implemented. "
            "See docs/jamf.md for field mappings and pagination example."
        )

    async def get_all_mobile_devices(self) -> list:
        """
        Fetch all mobile devices (iPhones, iPads) from Jamf Pro.

        Uses /api/v1/mobile-devices (separate from computers).
        """
        # TODO: implement
        raise NotImplementedError(
            "JamfMDMService.get_all_mobile_devices() not yet implemented."
        )

    # ------------------------------------------------------------------
    # Field mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def map_computer_to_asset(computer: dict) -> dict:
        """
        Map a Jamf Pro computer inventory record to HAM asset fields.

        Input shape (Jamf Pro JSON API):
        {
            "id": "1",
            "general": {
                "name": "hostname",
                "lastContactTime": "2024-01-01T00:00:00Z",
                "managed": true
            },
            "hardware": {
                "serialNumber": "XXXXXXXXXX",
                "model": "MacBook Pro (14-inch, 2023)",
                "processorType": "Apple M3 Pro",
                "totalRamMegabytes": 18432,
                ...
            },
            "operatingSystem": {
                "name": "macOS",
                "version": "14.3.1"
            },
            "userAndLocation": {
                "email": "user@example.com",
                "realname": "First Last",
                "department": "Engineering",
                "building": "HQ"
            }
        }
        """
        hardware = computer.get("hardware", {})
        general = computer.get("general", {})
        os_info = computer.get("operatingSystem", {})
        user_loc = computer.get("userAndLocation", {})

        return {
            # Identity
            "serial_number": hardware.get("serialNumber"),
            "hostname": general.get("name"),
            "manufacturer": "Apple",  # Jamf is Apple-only
            "model": hardware.get("model"),
            "device_type": "laptop",  # TODO: derive from model name

            # OS
            "os_type": os_info.get("name"),
            "os_version": os_info.get("version"),

            # Specs
            "processor": hardware.get("processorType"),
            "ram_gb": (
                hardware["totalRamMegabytes"] // 1024
                if hardware.get("totalRamMegabytes") else None
            ),
            # storage_gb: derive from storage[0].diskSizeGigabytes

            # Assignment
            "assigned_email": user_loc.get("email") or None,
            "assigned_to": user_loc.get("realname") or None,
            "department": user_loc.get("department") or None,
            "location": user_loc.get("building") or None,  # map to LOCATIONS

            # MDM
            "fleet_last_seen": general.get("lastContactTime"),  # parse to datetime
            "fleet_enrolled": general.get("managed", False),
        }

    @staticmethod
    def is_device_locked(computer: dict) -> bool:
        """
        Determine if a device is MDM-locked.

        Jamf doesn't have a single lock field. This requires checking
        MDM command history via /api/v1/mdm/commands or checking the
        managementId for pending lock commands.

        TODO: implement lock detection logic.
        See docs/jamf.md for guidance.
        """
        # Placeholder: return False until implemented
        return False

    # ------------------------------------------------------------------
    # Main sync entry point
    # ------------------------------------------------------------------

    async def sync_devices(self, db: Session, triggered_by: str) -> dict:
        """
        Sync all devices from Jamf Pro into HAM.

        This is the main entry point called by main.py for both
        scheduled and manual syncs. Must return a stats dict.

        TODO: implement full sync logic.
        See fleet_service.py for reference implementation.
        """
        stats = {
            "processed": 0,
            "created": 0,
            "updated": 0,
            "locked": 0,
            "unlocked": 0,
            "locations_set": 0,
            "errors": 0,
        }

        # Log sync start
        sync_log = FleetSyncLog(
            sync_started=datetime.utcnow(),
            status="running",
            devices_processed=0,
        )
        db.add(sync_log)
        db.commit()

        try:
            raise NotImplementedError(
                "JamfMDMService.sync_devices() not yet implemented. "
                "See docs/jamf.md and fleet_service.py for reference."
            )
        except Exception as e:
            sync_log.status = "failed"
            sync_log.errors = str(e)
            sync_log.sync_completed = datetime.utcnow()
            db.commit()
            raise

        return stats
