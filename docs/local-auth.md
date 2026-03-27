# Local Auth Mode

HAM supports a simple username/password login mode that requires no external identity provider. This is useful for:

- Local development and evaluation
- Small IT teams without an enterprise IdP
- Contributors who want to run HAM locally without Okta credentials
- Testing HAM before committing to an IdP setup

---

## Setup

### 1. Configure backend

In `backend/.env`:

```env
LOCAL_AUTH=true
LOCAL_AUTH_ADMIN_EMAIL=admin@example.com
LOCAL_AUTH_ADMIN_PASSWORD=changeme   # change this in production!
LOCAL_AUTH_ADMIN_NAME=HAM Admin
SECRET_KEY=your-random-secret-key    # generate: openssl rand -hex 32
```

### 2. Configure frontend

Create (or edit) `frontend/.env.local`:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_LOCAL_AUTH=true
```

### 3. Start HAM

```bash
docker compose up --build
# or: make start
```

On first startup, HAM automatically creates the admin user defined by `LOCAL_AUTH_ADMIN_EMAIL` and `LOCAL_AUTH_ADMIN_PASSWORD`. You'll see this in the backend logs:

```
Local auth: created default admin user admin@example.com
```

### 4. Sign in

Open http://localhost:3000. You'll see a username/password form instead of the OIDC redirect button. Sign in with the credentials you set in `.env`.

---

## Adding more users

Once you're signed in, you can create additional local users via the API:

```bash
curl -s -X POST http://localhost:8000/api/auth/local/users \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "full_name": "Jane Smith"}'
```

Or use the Swagger UI at http://localhost:8000/docs — go to `POST /api/auth/local/users`.

---

## How it works

- Passwords are hashed with bcrypt via `passlib`
- Users are stored in a `local_users` table in PostgreSQL
- On successful login, HAM issues a signed HS256 JWT using `SECRET_KEY`
- The JWT is stored in `localStorage` as `ham-local-token`
- Token expiry is 24 hours
- The `/api/auth/mode` endpoint tells the frontend which login UI to show
- `get_current_user` in `auth.py` routes to local or OIDC verification based on `LOCAL_AUTH`

---

## API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/mode` | GET | Returns `{"local_auth": true/false}` |
| `/api/auth/login` | POST | Login with `{email, password}`, returns JWT |
| `/api/auth/local/setup` | POST | Create first admin user (only works if no users exist) |
| `/api/auth/local/users` | POST | Create additional users (requires auth) |
| `/api/auth/me` | GET | Returns current user info |

---

## Production considerations

Local auth is suitable for small internal deployments but there are a few things to keep in mind:

- **Change the default password** — `LOCAL_AUTH_ADMIN_PASSWORD=changeme` is insecure. Set a strong password before exposing HAM externally.
- **Use a strong `SECRET_KEY`** — generate one with `openssl rand -hex 32`. If this key changes, all existing sessions are invalidated.
- **No SSO, no MFA** — local auth is a simple username/password flow. For production deployments with compliance requirements, use Okta or another OIDC provider instead.
- **Password reset** — there's no self-service password reset in local auth mode. Admins can update passwords directly in the database if needed.

---

## Switching from local auth to OIDC

When you're ready to move to a production IdP:

1. Set `LOCAL_AUTH=false` in `backend/.env`
2. Set `REACT_APP_LOCAL_AUTH=false` (or remove) in `frontend/.env.local`
3. Configure your OIDC provider vars (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, etc.)
4. Restart HAM

The `local_users` table stays intact but is no longer used for authentication.
