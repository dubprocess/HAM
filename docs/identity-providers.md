# Identity Provider Integration

HAM uses OpenID Connect (OIDC) for authentication. Because OIDC is a standard protocol, swapping providers requires minimal code changes — mostly around env var naming and user profile enrichment.

## Currently supported

- **Okta** (`IDP_PROVIDER=okta`) — fully implemented

## Planned / community contributions welcome

- Azure AD / Entra ID (`IDP_PROVIDER=azure`)
- Google Workspace (`IDP_PROVIDER=google`)
- Auth0 (`IDP_PROVIDER=auth0`)
- Ping Identity, Keycloak, etc.

---

## How OIDC works in HAM

HAM's `auth.py` does standard OIDC JWT verification:

1. Fetches the JWKS from `{OIDC_ISSUER}/v1/keys`
2. Verifies the JWT signature, audience, and issuer
3. Extracts `email`, `name`, `sub`, and `groups` claims from the token

Because this is standard OIDC, **the login flow works with any compliant provider** as long as you set the correct issuer, client ID, and client secret.

---

## Provider-specific setup

### Okta

```env
OIDC_ISSUER=https://your-domain.okta.com/oauth2/default
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback
IDP_PROVIDER=okta
```

See [okta.md](okta.md) for full setup including user enrichment and admin groups.

---

### Azure AD / Entra ID

```env
OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
OIDC_CLIENT_ID=your_app_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback
IDP_PROVIDER=azure
```

**Notes for contributors:**
- Azure puts group membership in a `roles` claim or requires a separate Microsoft Graph API call
- User enrichment (department, city) comes from Microsoft Graph: `GET https://graph.microsoft.com/v1.0/me`
- You'll need to add `User.Read` and optionally `Directory.Read.All` permissions to your app registration
- The JWKS endpoint is at `{OIDC_ISSUER}/discovery/v2.0/keys`

---

### Google Workspace

```env
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=your_client_id.apps.googleusercontent.com
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback
IDP_PROVIDER=google
```

**Notes for contributors:**
- Google's OIDC tokens don't include group membership — you'll need the Admin SDK (`admin.googleapis.com`) for that
- User enrichment comes from the Admin SDK Directory API: `GET https://admin.googleapis.com/admin/directory/v1/users/{email}`
- Department and location fields map to `organizations[0].department` and `addresses[0].locality`
- Requires a service account with domain-wide delegation for user profile lookups

---

### Auth0

```env
OIDC_ISSUER=https://your-tenant.auth0.com/
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/callback
IDP_PROVIDER=auth0
```

**Notes for contributors:**
- Auth0 supports custom claims via Rules/Actions — you can add `groups`, `department`, and `location` directly to the token
- If using custom claims, no additional API calls are needed for enrichment
- The Management API can be used for user profile lookups if custom claims aren't set up

---

## How to add a new provider (contributor guide)

### 1. The login flow — probably already works

If your provider is OIDC-compliant, set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` and login should work out of the box. Test it before writing any code.

### 2. Add user enrichment (optional but recommended)

User enrichment populates `department` and `location` on device assignment during MDM sync. This is provider-specific.

Create a new method in `okta_service.py` or a new `{provider}_service.py`:

```python
class AzureUserService:
    def __init__(self, client_id: str, client_secret: str, tenant_id: str):
        ...

    async def get_user_profile(self, email: str) -> dict:
        """Return dict with keys: full_name, department, location"""
        ...
```

Then in `fleet_service.py`, check `IDP_PROVIDER` and instantiate the right service.

### 3. Add admin group support

Update `auth.py`'s `check_admin_role` to handle your provider's group claim format.

### 4. Update `.env.example` and this doc

Add your provider to the supported list above with a config example.

### 5. Open a PR!

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## Env var reference

| Variable | Description |
|---|---|
| `IDP_PROVIDER` | Identity provider (`okta`, `azure`, `google`, `auth0`) |
| `OIDC_ISSUER` | OIDC issuer URL |
| `OIDC_CLIENT_ID` | OAuth2 client ID |
| `OIDC_CLIENT_SECRET` | OAuth2 client secret |
| `OIDC_REDIRECT_URI` | OAuth2 redirect URI |
| `IDP_API_TOKEN` | API token for user enrichment (provider-specific) |
