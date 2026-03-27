# Okta Integration

HAM uses Okta for two purposes:

1. **OIDC authentication** — user login via Okta SSO
2. **SCIM user enrichment** — resolving Fleet device assignments to full user profiles

## OIDC Setup (required for login)

### 1. Create an Okta OIDC app

- In your Okta admin console, go to **Applications** → **Create App Integration**
- Choose **OIDC - OpenID Connect** → **Web Application**
- Set the **Sign-in redirect URI** to `http://localhost:3000/callback`
- Note the **Client ID** and **Client Secret**

### 2. Configure environment variables

```env
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=your_client_id
OKTA_CLIENT_SECRET=your_client_secret
OKTA_REDIRECT_URI=http://localhost:3000/callback
```

### 3. Frontend

Also set in `frontend/.env.local`:

```env
REACT_APP_OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
REACT_APP_OKTA_CLIENT_ID=your_client_id
```

## API Token (optional — for user profile enrichment)

If you want HAM to look up full user profiles from Okta during Fleet sync:

```env
OKTA_API_TOKEN=your_okta_api_token
```

With this set, Fleet sync will enrich device assignments with the user's display name, department, and city from Okta.

## Admin groups

```env
ADMIN_GROUPS=IT-Admins,Asset-Managers
```

## Future: pluggable OIDC

HAM is built with `IDP_PROVIDER=okta` as the current implementation. Future versions will support Azure AD, Google Workspace, and other OIDC providers. PRs welcome.
