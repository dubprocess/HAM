# Jamf MDM Integration

This guide is for contributors looking to add Jamf Pro support to HAM. Fleet MDM is the only fully implemented MDM provider today, but HAM is architected to support additional providers via the `MDM_PROVIDER` env var.

## Overview of differences from Fleet

| | Fleet | Jamf Pro |
|---|---|---|
| API style | REST + JSON | Classic XML API + newer JSON API (`/api/v1/`) |
| Auth | Bearer token | Basic Auth or Bearer token via `/api/v1/auth/token` |
| Devices endpoint | `/api/v1/fleet/hosts` | `/api/v1/computers-inventory` (JSON) or `/JSSResource/computers` (XML) |
| User assignment | `end_users` / `primary_user` on host | `location` block on computer record |
| MDM lock status | `mdm.enrollment_status` + MDM command fields | `general.managed` + MDM command history |
| Mobile devices | Same endpoint | Separate `/api/v1/mobile-devices` endpoint |
| Pagination | `page` + `per_page` | `page` + `page-size` (JSON API) |

---

## Environment variables

```env
MDM_PROVIDER=jamf
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your_api_client_id
JAMF_CLIENT_SECRET=your_api_client_secret
```

> **Note**: Jamf Pro 10.49+ supports OAuth2 client credentials (`/api/oauth/token`). For older versions, use Basic Auth with a dedicated service account.

---

## Setup in Jamf Pro

### 1. Create an API client (Jamf Pro 10.49+)

1. Go to **Settings** → **System** → **API Roles and Clients**
2. Create a new **API Role** with these permissions:
   - `Read Computers`
   - `Read Mobile Devices`
   - `Read Users`
3. Create a new **API Client** assigned to that role
4. Note the **Client ID** and generate a **Client Secret**

### 2. For older Jamf Pro versions

Create a dedicated service account with read-only access and use Basic Auth:

```env
JAMF_USERNAME=ham-service-account
JAMF_PASSWORD=your_password
```

---

## What to implement

A Jamf contributor needs to create `backend/jamf_service.py` implementing the same interface as `fleet_service.py`.

The key method signature HAM expects:

```python
async def sync_devices(self, db: Session, triggered_by: str) -> dict:
    """
    Sync devices from Jamf Pro into HAM.

    Returns:
        {
            'processed': int,
            'created': int,
            'updated': int,
            'locked': int,
            'unlocked': int,
            'locations_set': int,
            'errors': int
        }
    """
```

See `backend/jamf_service.py` for a starter stub with field mappings.

---

## Jamf field mappings

### Computer inventory (`/api/v1/computers-inventory`)

| Jamf field | HAM field |
|---|---|
| `hardware.serialNumber` | `serial_number` |
| `general.name` | `hostname` |
| `operatingSystem.name` + `operatingSystem.version` | `os_type`, `os_version` |
| `hardware.model` | `model` |
| `hardware.processorType` | `processor` |
| `hardware.totalRamMegabytes` / 1024 | `ram_gb` |
| `storage[0].diskSizeGigabytes` | `storage_gb` |
| `general.lastContactTime` | `fleet_last_seen` |
| `userAndLocation.email` | `assigned_email` |
| `userAndLocation.realname` | `assigned_to` |
| `userAndLocation.department` | `department` |
| `userAndLocation.building` | `location` (requires mapping) |
| `general.managed` | used to derive lock status |

### Deriving lock status

Jamf doesn't have a single "locked" field. You need to check:

```python
def is_device_locked(computer: dict) -> bool:
    # Check MDM command history for pending/completed lock commands
    mdm = computer.get('general', {}).get('mdmCapable', {})
    # Or check managementId and cross-reference MDM command history
    # This requires an additional API call to /api/v1/mdm/commands
    ...
```

---

## Pagination example

```python
async def get_all_computers(self) -> list:
    computers = []
    page = 0
    page_size = 100
    while True:
        resp = await self.client.get(
            f"{self.jamf_url}/api/v1/computers-inventory",
            params={"page": page, "page-size": page_size,
                    "section": ["GENERAL", "HARDWARE", "USER_AND_LOCATION",
                                "OPERATING_SYSTEM", "STORAGE"]},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        data = resp.json()
        results = data.get("results", [])
        computers.extend(results)
        if len(results) < page_size:
            break
        page += 1
    return computers
```

---

## Routing in main.py

Once `jamf_service.py` is implemented, update `main.py` to route based on `MDM_PROVIDER`:

```python
def _create_mdm_service():
    provider = os.getenv("MDM_PROVIDER", "fleet")
    if provider == "jamf":
        from jamf_service import JamfMDMService
        return JamfMDMService(
            jamf_url=os.getenv("JAMF_URL"),
            client_id=os.getenv("JAMF_CLIENT_ID"),
            client_secret=os.getenv("JAMF_CLIENT_SECRET")
        )
    else:  # default: fleet
        return FleetMDMService(
            fleet_url=os.getenv("FLEET_URL"),
            api_token=os.getenv("FLEET_API_TOKEN"),
            okta_service=_create_okta_service()
        )
```

---

## Contributing

If you're a Jamf shop and want to contribute support:

1. Fork the repo
2. Implement `backend/jamf_service.py` using the stub as a starting point
3. Test against a Jamf Pro sandbox or trial instance
4. Open a PR with your implementation + any new env vars documented in `.env.example`

See [CONTRIBUTING.md](../CONTRIBUTING.md) for general guidelines.
