"""
HAM Authentication

Supports two modes controlled by the LOCAL_AUTH env var:

  LOCAL_AUTH=false (default)
    Standard Okta OIDC flow. Requires OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET.
    JWTs are issued by Okta and verified against Okta's JWKS endpoint.

  LOCAL_AUTH=true
    Simple username/password login with no external IdP required.
    JWTs are issued and verified by HAM itself using SECRET_KEY.
    Useful for local development, evaluation, and smaller deployments.
    See /api/auth/local/setup to create the first admin user.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import httpx
from authlib.integrations.starlette_client import OAuth
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from starlette.config import Config

# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=False)

LOCAL_AUTH = os.getenv("LOCAL_AUTH", "false").lower() == "true"
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Local Auth
# ---------------------------------------------------------------------------

class LocalAuth:
    """
    Simple username/password authentication backed by a local_users table.
    Issues and verifies HS256 JWTs signed with SECRET_KEY.
    No external IdP required.
    """

    def create_access_token(self, data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        to_encode.update({"exp": expire, "iss": "ham-local-auth"})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    def verify_password(self, plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def decode_token(self, token: str) -> dict:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    async def get_current_user(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> dict:
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = self.decode_token(credentials.credentials)
        return {
            "email": payload.get("email"),
            "name": payload.get("name"),
            "sub": payload.get("sub"),
            "groups": payload.get("groups", []),
            "auth_mode": "local",
        }


# ---------------------------------------------------------------------------
# Okta OIDC Auth
# ---------------------------------------------------------------------------

class OktaAuth:
    """Okta OIDC Authentication Handler"""

    def __init__(self, issuer: str, client_id: str, client_secret: str, redirect_uri: str):
        self.issuer = issuer.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.jwks_uri = f"{self.issuer}/v1/keys"

        config = Config(environ={
            "OKTA_CLIENT_ID": client_id,
            "OKTA_CLIENT_SECRET": client_secret,
        })

        self.oauth = OAuth(config)
        self.oauth.register(
            name="okta",
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url=f"{self.issuer}/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )

    async def get_jwks(self):
        async with httpx.AsyncClient() as client:
            response = await client.get(self.jwks_uri)
            response.raise_for_status()
            return response.json()

    async def verify_token(self, token: str) -> dict:
        try:
            jwks = await self.get_jwks()
            unverified_header = jwt.get_unverified_header(token)
            key = None
            for jwk in jwks["keys"]:
                if jwk["kid"] == unverified_header["kid"]:
                    key = jwk
                    break
            if not key:
                raise HTTPException(status_code=401, detail="Invalid token - key not found")
            payload = jwt.decode(
                token, key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=self.issuer,
            )
            return payload
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    async def get_current_user(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> dict:
        token = credentials.credentials
        payload = await self.verify_token(token)
        return {
            "email": payload.get("email"),
            "name": payload.get("name"),
            "sub": payload.get("sub"),
            "groups": payload.get("groups", []),
            "auth_mode": "oidc",
        }

    async def get_user_info(self, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.issuer}/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    def check_admin_role(self, user: dict, admin_groups: list) -> bool:
        user_groups = user.get("groups", [])
        return any(group in admin_groups for group in user_groups)


# ---------------------------------------------------------------------------
# Global instances (initialized in main.py on startup)
# ---------------------------------------------------------------------------

okta_auth: Optional[OktaAuth] = None
local_auth: LocalAuth = LocalAuth()


def get_okta_auth() -> OktaAuth:
    if okta_auth is None:
        raise HTTPException(status_code=500, detail="OIDC authentication not configured")
    return okta_auth


# ---------------------------------------------------------------------------
# Unified get_current_user dependency
# Routes to local or OIDC depending on LOCAL_AUTH env var
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    FastAPI dependency that returns the current authenticated user.
    When LOCAL_AUTH=true, verifies a locally-issued JWT.
    When LOCAL_AUTH=false, verifies an Okta OIDC JWT.
    """
    if LOCAL_AUTH:
        return await local_auth.get_current_user(credentials)
    else:
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        auth = get_okta_auth()
        return await auth.get_current_user(credentials)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("email"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
