# Apple Business Manager (ABM) Integration

HAM integrates with Apple Business Manager to pull device procurement data and enrich your inventory automatically.

## Prerequisites

- An Apple Business Manager account with the **Device Manager** role
- An API key created in ABM (requires a `.p8` private key)

## Setup

### 1. Create an ABM API key

1. Log in to [business.apple.com](https://business.apple.com)
2. Go to **Settings** → **API Access**
3. Create a new key — download the `.p8` file and note the **Key ID** and **Client ID**

### 2. Place your private key

```bash
mkdir -p keys
chmod 700 keys
touch keys/abm_private_key.pem && chmod 600 keys/abm_private_key.pem
cp ~/Downloads/AuthKey_XXXXXXXX.p8 keys/abm_private_key.pem
```

> **Key format note**: `.p8` files from Apple may have PKCS#8 content but incorrect PEM headers. HAM's ABM service handles this automatically.

### 3. Configure environment variables

```env
ABM_CLIENT_ID=BUSINESSAPI.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ABM_KEY_ID=your_key_id
ABM_PRIVATE_KEY_PATH=/app/keys/abm_private_key.pem
```

### 4. Configure sync schedule

```env
ABM_SYNC_SCHEDULED=true
ABM_SYNC_HOUR=20
ABM_SYNC_MINUTE=0
```

## Troubleshooting

- **Authentication errors**: verify your `.p8` file and that `ABM_CLIENT_ID` matches `BUSINESSAPI.xxxxxxxx-...`
- **Sync logs**: check `/api/abm/sync-logs` or the ABM Sync page in HAM
