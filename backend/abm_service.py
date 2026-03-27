import httpx
import jwt
import time
import uuid
import os
import asyncio
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models import Asset, AssetStatus, ABMSyncLog, AuditLog
import logging

logger = logging.getLogger(__name__)

# Max concurrent AppleCare lookups to avoid hammering Apple's API
APPLECARE_CONCURRENCY = 10


class ABMService:
    """Service for integrating with Apple Business Manager API"""

    TOKEN_URL = "https://account.apple.com/auth/oauth2/token"
    TOKEN_AUDIENCE = "https://account.apple.com/auth/oauth2/v2/token"
    API_BASE = "https://api-business.apple.com/v1"

    def __init__(
        self,
        client_id: str,
        key_id: str,
        private_key_path: str,
    ):
        self.client_id = client_id
        self.key_id = key_id
        self.private_key_path = private_key_path
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0

        # Load private key
        with open(private_key_path, "r") as f:
            self._private_key = f.read()
        logger.info("ABM private key loaded from %s (%d bytes)", private_key_path, len(self._private_key))

    # ------------------------------------------------------------------
    # Authentication: JWT client assertion + OAuth2 token exchange
    # ------------------------------------------------------------------

    def _build_client_assertion(self) -> str:
        """Build an ES256-signed JWT client assertion for Apple's OAuth endpoint."""
        now = int(time.time())
        payload = {
            "iss": self.client_id,
            "iat": now,
            "exp": now + 86400 * 180,  # 180-day lifetime per Apple docs
            "aud": self.TOKEN_AUDIENCE,
            "sub": self.client_id,
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(
            payload,
            self._private_key,
            algorithm="ES256",
            headers={"kid": self.key_id},
        )
        logger.info("Built client assertion JWT (kid=%s, iss=%s, aud=%s)", self.key_id, self.client_id, self.TOKEN_AUDIENCE)
        return token

    async def _get_access_token(self) -> str:
        """Exchange client assertion for an OAuth2 access token.
        Caches the token until it expires.
        """
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token

        client_assertion = self._build_client_assertion()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    "client_assertion": client_assertion,
                    "scope": "business.api",
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout=30.0,
            )

            # Log the full response for debugging
            logger.info(
                "ABM token response: status=%s body=%s",
                response.status_code,
                response.text[:500],
            )

            if response.status_code != 200:
                logger.error(
                    "ABM token exchange failed: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                response.raise_for_status()

            data = response.json()

        self._access_token = data["access_token"]
        self._token_expiry = time.time() + data.get("expires_in", 3600)
        logger.info("ABM access token acquired, expires in %ss", data.get("expires_in"))
        return self._access_token

    # ------------------------------------------------------------------
    # API helpers
    # ------------------------------------------------------------------

    async def _api_get(self, path: str, params: Optional[dict] = None) -> dict:
        """Make an authenticated GET request to the ABM API."""
        token = await self._get_access_token()
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.API_BASE}{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    # ------------------------------------------------------------------
    # Device fetching with pagination
    # ------------------------------------------------------------------

    async def get_all_devices(self) -> List[Dict]:
        """Fetch all organizational devices from ABM, handling pagination."""
        all_devices = []
        next_url = f"{self.API_BASE}/orgDevices"
        token = await self._get_access_token()

        async with httpx.AsyncClient() as client:
            while next_url:
                response = await client.get(
                    next_url,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                all_devices.extend(data.get("data", []))

                # Link-based pagination
                next_url = data.get("links", {}).get("next")

        logger.info("Fetched %d devices from ABM", len(all_devices))
        return all_devices

    async def get_device(self, device_id: str) -> Dict:
        """Fetch a single device by its ABM ID."""
        data = await self._api_get(f"/orgDevices/{device_id}")
        return data.get("data", {})

    async def get_mdm_servers(self) -> List[Dict]:
        """Fetch all MDM servers registered in ABM."""
        data = await self._api_get("/mdmServers")
        return data.get("data", [])

    async def get_applecare_coverage(self, device_id: str) -> List[Dict]:
        """Fetch AppleCare coverage for a specific device.

        Returns a list of coverage records (a device can have multiple:
        e.g. Limited Warranty + AppleCare+).

        Endpoint: GET /v1/orgDevices/{id}/appleCareCoverage
        """
        try:
            data = await self._api_get(f"/orgDevices/{device_id}/appleCareCoverage")
            coverages = data.get("data", [])
            logger.debug("Got %d AppleCare coverage records for device %s", len(coverages), device_id)
            return coverages
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug("No AppleCare coverage found for device %s", device_id)
                return []
            raise

    async def get_applecare_coverage_batch(self, device_ids: List[str]) -> Dict[str, List[Dict]]:
        """Fetch AppleCare coverage for multiple devices concurrently.

        Uses a semaphore to limit concurrent requests and avoid rate limiting.
        Returns a dict mapping device_id -> coverage records.
        """
        semaphore = asyncio.Semaphore(APPLECARE_CONCURRENCY)
        results: Dict[str, List[Dict]] = {}

        async def fetch_one(device_id: str):
            async with semaphore:
                try:
                    coverage = await self.get_applecare_coverage(device_id)
                    results[device_id] = coverage
                except Exception as e:
                    logger.warning("Failed to fetch AppleCare for %s: %s", device_id, str(e))
                    results[device_id] = []

        await asyncio.gather(*[fetch_one(did) for did in device_ids])
        logger.info(
            "Fetched AppleCare coverage for %d devices (%d with data)",
            len(device_ids),
            sum(1 for v in results.values() if v),
        )
        return results

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def parse_abm_device(self, abm_device: Dict) -> Dict:
        """Parse an ABM device record into our internal format."""
        attrs = abm_device.get("attributes", {})
        return {
            "abm_device_id": abm_device.get("id"),
            "serial_number": attrs.get("serialNumber", ""),
            "abm_device_model": attrs.get("deviceModel", ""),
            "abm_product_family": attrs.get("productFamily", ""),
            "abm_product_type": attrs.get("productType", ""),
            "abm_device_capacity": attrs.get("deviceCapacity", ""),
            "abm_color": attrs.get("color", ""),
            "abm_status": attrs.get("status", ""),  # ASSIGNED / UNASSIGNED
            "abm_order_number": attrs.get("orderNumber", ""),
            "abm_part_number": attrs.get("partNumber", ""),
            "abm_order_date": (
                datetime.fromisoformat(attrs["orderDateTime"].replace("Z", "+00:00"))
                if attrs.get("orderDateTime")
                else None
            ),
            "abm_added_date": (
                datetime.fromisoformat(attrs["addedToOrgDateTime"].replace("Z", "+00:00"))
                if attrs.get("addedToOrgDateTime")
                else None
            ),
            "abm_purchase_source": attrs.get("purchaseSourceType", ""),
        }

    def parse_applecare_coverage(self, coverage_records: List[Dict]) -> Dict:
        """Parse AppleCare coverage records and return the best active coverage.

        A device can have multiple coverage records (Limited Warranty + AppleCare+).
        We prioritize: active AppleCare+ > active AppleCare > active Limited Warranty > any inactive.
        """
        if not coverage_records:
            return {}

        parsed = []
        for record in coverage_records:
            attrs = record.get("attributes", {})
            parsed.append({
                "status": attrs.get("status", ""),  # ACTIVE / INACTIVE
                "description": attrs.get("description", ""),  # Limited Warranty, AppleCare, AppleCare+
                "start_date": (
                    datetime.fromisoformat(attrs["startDateTime"].replace("Z", "+00:00"))
                    if attrs.get("startDateTime")
                    else None
                ),
                "end_date": (
                    datetime.fromisoformat(attrs["endDateTime"].replace("Z", "+00:00"))
                    if attrs.get("endDateTime")
                    else None
                ),
                "agreement_number": attrs.get("agreementNumber"),
                "is_renewable": attrs.get("isRenewable", False),
                "is_canceled": attrs.get("isCanceled", False),
                "payment_type": attrs.get("paymentType", ""),
            })

        # Sort: prioritize active, then by description rank (AppleCare+ > AppleCare > Limited Warranty)
        desc_priority = {"AppleCare+": 3, "AppleCare": 2, "Limited Warranty": 1}
        parsed.sort(
            key=lambda c: (
                1 if c["status"] == "ACTIVE" else 0,
                desc_priority.get(c["description"], 0),
            ),
            reverse=True,
        )

        best = parsed[0]

        # Find the latest end date across ALL coverages for warranty_expiration
        all_end_dates = [c["end_date"] for c in parsed if c["end_date"]]
        latest_end_date = max(all_end_dates) if all_end_dates else None

        return {
            "applecare_status": best["status"],
            "applecare_description": best["description"],
            "applecare_start_date": best["start_date"],
            "applecare_end_date": best["end_date"],
            "applecare_agreement_number": best.get("agreement_number"),
            "applecare_is_renewable": best["is_renewable"],
            "applecare_payment_type": best["payment_type"],
            "warranty_expiration": latest_end_date,  # Auto-populate warranty field
        }

    # ------------------------------------------------------------------
    # Sync logic
    # ------------------------------------------------------------------

    async def sync_devices(self, db: Session, user_email: str) -> Dict:
        """Sync all devices from ABM to the database.
        Matches existing assets by serial number and enriches them
        with ABM data (purchase info, enrollment status, etc.).
        Creates new asset records for devices not yet tracked.
        Fetches AppleCare warranty coverage concurrently for speed.
        """
        sync_log = ABMSyncLog(
            sync_started=datetime.utcnow(),
            status="running",
        )
        db.add(sync_log)
        db.commit()

        stats = {
            "processed": 0,
            "created": 0,
            "updated": 0,
            "enriched": 0,
            "warranty_updated": 0,
            "errors": [],
        }

        try:
            abm_devices = await self.get_all_devices()

            # Phase 1: Sync device data and collect device IDs for warranty lookup
            device_id_to_asset = {}

            for abm_device in abm_devices:
                try:
                    stats["processed"] += 1
                    device_data = self.parse_abm_device(abm_device)

                    if not device_data["serial_number"]:
                        logger.warning(
                            "Skipping ABM device %s — no serial number",
                            device_data.get("abm_device_id"),
                        )
                        continue

                    # Match on serial number
                    asset = (
                        db.query(Asset)
                        .filter(Asset.serial_number == device_data["serial_number"])
                        .first()
                    )

                    if asset:
                        updated = self._update_asset_from_abm(
                            asset, device_data, user_email, db
                        )
                        if updated:
                            stats["enriched"] += 1
                    else:
                        asset = self._create_asset_from_abm(
                            device_data, user_email, db
                        )
                        stats["created"] += 1

                    # Track for warranty lookup
                    abm_device_id = device_data.get("abm_device_id")
                    if abm_device_id:
                        device_id_to_asset[abm_device_id] = asset

                    db.commit()

                except Exception as e:
                    logger.error("Error processing ABM device: %s", str(e))
                    stats["errors"].append(str(e))
                    db.rollback()
                    continue

            # Phase 2: Fetch AppleCare coverage concurrently
            if device_id_to_asset:
                logger.info("Fetching AppleCare coverage for %d devices concurrently...", len(device_id_to_asset))
                coverage_map = await self.get_applecare_coverage_batch(
                    list(device_id_to_asset.keys())
                )

                for device_id, coverage_records in coverage_map.items():
                    if not coverage_records:
                        continue
                    try:
                        asset = device_id_to_asset[device_id]
                        warranty_data = self.parse_applecare_coverage(coverage_records)
                        if warranty_data:
                            warranty_updated = self._update_asset_warranty(
                                asset, warranty_data, user_email, db
                            )
                            if warranty_updated:
                                stats["warranty_updated"] += 1
                        db.commit()
                    except Exception as e:
                        logger.warning("Failed to apply AppleCare for device %s: %s", device_id, str(e))
                        db.rollback()

            sync_log.sync_completed = datetime.utcnow()
            sync_log.status = "completed"
            sync_log.devices_processed = stats["processed"]
            sync_log.devices_created = stats["created"]
            sync_log.devices_enriched = stats["enriched"]
            sync_log.errors = "\n".join(stats["errors"]) if stats["errors"] else None
            db.commit()

        except Exception as e:
            logger.error("ABM sync failed: %s", str(e))
            sync_log.sync_completed = datetime.utcnow()
            sync_log.status = "failed"
            sync_log.errors = str(e)
            db.commit()
            raise

        return stats

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _create_asset_from_abm(self, device_data: Dict, user_email: str, db: Session) -> Asset:
        """Create a new asset from ABM data (device not yet in Fleet/inventory)."""
        # Derive a platform-based device type from product family
        product_family = device_data.get("abm_product_family", "").lower()
        if "mac" in product_family:
            device_type = "mac"
        elif "ipad" in product_family:
            device_type = "ipad"
        elif "iphone" in product_family:
            device_type = "iphone"
        elif "tv" in product_family:
            device_type = "apple_tv"
        else:
            device_type = "other"

        # Derive purchase source label for supplier
        purchase_source = device_data.get("abm_purchase_source", "")
        supplier_label = purchase_source.replace("_", " ").title() if purchase_source else None

        asset = Asset(
            asset_tag=f"ABM-{device_data['serial_number'][:8]}",
            serial_number=device_data["serial_number"],
            manufacturer="Apple",
            model=device_data.get("abm_device_model", "Unknown"),
            device_type=device_type,
            purchase_date=device_data.get("abm_order_date"),
            supplier=supplier_label,
            abm_device_id=device_data["abm_device_id"],
            abm_status=device_data.get("abm_status"),
            abm_order_number=device_data.get("abm_order_number"),
            abm_order_date=device_data.get("abm_order_date"),
            abm_product_family=device_data.get("abm_product_family"),
            abm_product_type=device_data.get("abm_product_type"),
            abm_device_capacity=device_data.get("abm_device_capacity"),
            abm_color=device_data.get("abm_color"),
            abm_part_number=device_data.get("abm_part_number"),
            abm_added_date=device_data.get("abm_added_date"),
            abm_purchase_source=device_data.get("abm_purchase_source"),
            abm_last_synced=datetime.utcnow(),
            status=AssetStatus.AVAILABLE,
            created_by=user_email,
            updated_by=user_email,
        )
        db.add(asset)

        audit = AuditLog(
            asset=asset,
            action="created_from_abm",
            user_email=user_email,
            timestamp=datetime.utcnow(),
        )
        db.add(audit)

        return asset

    def _update_asset_from_abm(
        self, asset: Asset, device_data: Dict, user_email: str, db: Session
    ) -> bool:
        """Enrich an existing asset with ABM data. Returns True if changes were made."""
        updated = False
        changes = []

        abm_fields = {
            "abm_device_id": device_data.get("abm_device_id"),
            "abm_status": device_data.get("abm_status"),
            "abm_order_number": device_data.get("abm_order_number"),
            "abm_order_date": device_data.get("abm_order_date"),
            "abm_product_family": device_data.get("abm_product_family"),
            "abm_product_type": device_data.get("abm_product_type"),
            "abm_device_capacity": device_data.get("abm_device_capacity"),
            "abm_color": device_data.get("abm_color"),
            "abm_part_number": device_data.get("abm_part_number"),
            "abm_added_date": device_data.get("abm_added_date"),
            "abm_purchase_source": device_data.get("abm_purchase_source"),
        }

        for field, new_value in abm_fields.items():
            if new_value and getattr(asset, field, None) != new_value:
                old_value = getattr(asset, field, None)
                setattr(asset, field, new_value)
                changes.append(f"{field}: {old_value} → {new_value}")
                updated = True

        # Auto-populate purchase_date from order_date if not manually set
        order_date = device_data.get("abm_order_date")
        if order_date and not asset.purchase_date:
            asset.purchase_date = order_date
            changes.append(f"purchase_date: None → {order_date}")
            updated = True

        # Auto-populate supplier from purchase_source if not manually set
        purchase_source = device_data.get("abm_purchase_source", "")
        if purchase_source and not asset.supplier:
            supplier_label = purchase_source.replace("_", " ").title()
            asset.supplier = supplier_label
            changes.append(f"supplier: None → {supplier_label}")
            updated = True

        if updated:
            asset.abm_last_synced = datetime.utcnow()
            asset.updated_by = user_email

            audit = AuditLog(
                asset=asset,
                action="enriched_from_abm",
                new_value="; ".join(changes),
                user_email=user_email,
                timestamp=datetime.utcnow(),
            )
            db.add(audit)

        # Always update the last synced timestamp
        asset.abm_last_synced = datetime.utcnow()

        return updated

    def _update_asset_warranty(
        self, asset: Asset, warranty_data: Dict, user_email: str, db: Session
    ) -> bool:
        """Update an asset with AppleCare warranty data. Returns True if changes were made."""
        updated = False
        changes = []

        warranty_fields = {
            "applecare_status": warranty_data.get("applecare_status"),
            "applecare_description": warranty_data.get("applecare_description"),
            "applecare_start_date": warranty_data.get("applecare_start_date"),
            "applecare_end_date": warranty_data.get("applecare_end_date"),
            "applecare_agreement_number": warranty_data.get("applecare_agreement_number"),
            "applecare_is_renewable": warranty_data.get("applecare_is_renewable"),
            "applecare_payment_type": warranty_data.get("applecare_payment_type"),
            "warranty_expiration": warranty_data.get("warranty_expiration"),
        }

        for field, new_value in warranty_fields.items():
            if new_value is not None and getattr(asset, field, None) != new_value:
                old_value = getattr(asset, field, None)
                setattr(asset, field, new_value)
                changes.append(f"{field}: {old_value} → {new_value}")
                updated = True

        if updated:
            asset.updated_by = user_email

            audit = AuditLog(
                asset=asset,
                action="warranty_updated_from_abm",
                new_value="; ".join(changes),
                user_email=user_email,
                timestamp=datetime.utcnow(),
            )
            db.add(audit)

        return updated
