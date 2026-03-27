"""
Base MDM Service — Abstract Interface

All MDM provider implementations must extend this class and implement
the abstract methods below. This ensures a consistent interface across
providers so HAM can swap MDM backends via the MDM_PROVIDER env var.

Supported providers:
  - fleet  (FleetMDMService in fleet_service.py)  — fully implemented
  - jamf   (JamfMDMService  in jamf_service.py)   — stub, PRs welcome

To add a new provider:
  1. Create backend/{provider}_service.py
  2. Extend BaseMDMService
  3. Implement all abstract methods
  4. Add routing in main.py _create_mdm_service()
  5. Add env vars to .env.example and docs/{provider}.md

See docs/jamf.md for a full walkthrough.
"""

from abc import ABC, abstractmethod
from sqlalchemy.orm import Session


class BaseMDMService(ABC):
    """
    Abstract base class for MDM provider integrations.
    All provider implementations must inherit from this class.
    """

    @abstractmethod
    async def sync_devices(self, db: Session, triggered_by: str) -> dict:
        """
        Sync all devices from the MDM provider into HAM.

        Returns stats dict:
        {
            'processed': int,   # total devices seen from MDM
            'created':   int,   # new assets created
            'updated':   int,   # existing assets updated
            'locked':    int,   # devices transitioned to LOCKED
            'unlocked':  int,   # devices transitioned out of LOCKED
            'locations_set': int,  # devices whose location was updated
            'errors':    int,   # devices that failed to sync
        }
        """
        ...

    @abstractmethod
    async def get_all_devices(self) -> list:
        """
        Fetch all devices from the MDM provider API.
        Returns list of raw device records (provider-specific shape).
        """
        ...

    @abstractmethod
    def map_device_to_asset(self, device: dict) -> dict:
        """
        Map a raw MDM device record to HAM asset fields.

        Must include at minimum:
            serial_number (str)   — used as the match/dedup key
            fleet_enrolled (bool) — MDM enrollment status
            fleet_last_seen (datetime)

        Common optional fields:
            hostname, manufacturer, model, device_type,
            os_type, os_version, processor, ram_gb, storage_gb,
            assigned_email, assigned_to, department, location
        """
        ...

    @abstractmethod
    def is_device_locked(self, device: dict) -> bool:
        """
        Determine if a device is MDM-locked from the raw device record.
        Returns True if the device is in a locked/pin-locked state.
        """
        ...


class MDMSyncStats:
    """Helper to track and return sync statistics."""

    def __init__(self):
        self.processed = 0
        self.created = 0
        self.updated = 0
        self.locked = 0
        self.unlocked = 0
        self.locations_set = 0
        self.errors = 0

    def to_dict(self) -> dict:
        return {
            'processed': self.processed,
            'created': self.created,
            'updated': self.updated,
            'locked': self.locked,
            'unlocked': self.unlocked,
            'locations_set': self.locations_set,
            'errors': self.errors,
        }
