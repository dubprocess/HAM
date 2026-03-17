# Fleet MDM Integration

HAM integrates with [Fleet](https://fleetdm.com) to automatically import devices, sync user assignments, and track lock/unlock status.

## Setup

### 1. Generate a Fleet API token

In your Fleet instance, go to **My Account** → **API token** and generate a token with read access to hosts.

### 2. Configure environment variables

```env
FLEET_URL=https://your-fleet-instance.com
FLEET_API_TOKEN=your_fleet_api_token
```

### 3. Configure sync schedule

```env
FLEET_SYNC_SCHEDULED=true
FLEET_SYNC_HOUR=21
FLEET_SYNC_MINUTE=0
FLEET_SYNC_TIMEZONE=US/Pacific
```

Or trigger a manual sync from the Fleet Sync page in HAM, or via:

```bash
curl -X POST http://localhost:8000/api/fleet/sync
```

## What syncs

| Fleet field | HAM field |
|---|---|
| Serial number | `serial_number` |
| Hostname | `hostname` |
| OS name + version | `os_type`, `os_version` |
| Hardware model | `model` |
| CPU / RAM / Storage | `processor`, `ram_gb`, `storage_gb` |
| Last seen | `fleet_last_seen` |
| MDM lock status | `status` (→ LOCKED) |
| Assigned user (via Okta SCIM) | `assigned_email`, `assigned_to` |

## Smart override logic

If a device has been manually assigned in HAM, the `assignment_override` flag is set. Fleet sync will not overwrite the manual assignment — unless a different user is detected as logged in, in which case the override is automatically cleared.

## Troubleshooting

- **Sync logs**: check the Fleet Sync page or `/api/fleet/sync-logs`
- **Rate limiting**: in cloud environments, reduce `APPLECARE_CONCURRENCY` to 2
- **Stuck sync logs**: if HAM restarts mid-sync, fix with:
  ```sql
  UPDATE fleet_sync_logs SET status='failed', errors='Pod restart', sync_completed=NOW() WHERE status='running';
  ```
