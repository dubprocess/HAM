from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional
import httpx

security = HTTPBearer()

class OktaAuth:
    """Okta OIDC Authentication Handler"""
    
    def __init__(self, issuer: str, client_id: str, client_secret: str, redirect_uri: str):
        self.issuer = issuer.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.jwks_uri = f"{self.issuer}/v1/keys"
        
        config = Config(environ={
            'OKTA_CLIENT_ID': client_id,
            'OKTA_CLIENT_SECRET': client_secret,
        })
        
        self.oauth = OAuth(config)
        self.oauth.register(
            name='okta',
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url=f"{self.issuer}/.well-known/openid-configuration",
            client_kwargs={'scope': 'openid email profile'}
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
            for jwk in jwks['keys']:
                if jwk['kid'] == unverified_header['kid']:
                    key = jwk
                    break
            if not key:
                raise HTTPException(status_code=401, detail="Invalid token - key not found")
            payload = jwt.decode(
                token, key,
                algorithms=['RS256'],
                audience=self.client_id,
                issuer=self.issuer
            )
            return payload
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    async def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
        token = credentials.credentials
        payload = await self.verify_token(token)
        return {
            'email': payload.get('email'),
            'name': payload.get('name'),
            'sub': payload.get('sub'),
            'groups': payload.get('groups', [])
        }
    
    async def get_user_info(self, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.issuer}/v1/userinfo",
                headers={'Authorization': f'Bearer {access_token}'}
            )
            response.raise_for_status()
            return response.json()
    
    def check_admin_role(self, user: dict, admin_groups: list) -> bool:
        user_groups = user.get('groups', [])
        return any(group in admin_groups for group in user_groups)

# Global auth instance (initialized in main.py on startup)
okta_auth: Optional[OktaAuth] = None

def get_okta_auth() -> OktaAuth:
    if okta_auth is None:
        raise HTTPException(status_code=500, detail="Authentication not configured")
    return okta_auth

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    auth = get_okta_auth()
    return await auth.get_current_user(credentials)

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    auth = get_okta_auth()
    if not user.get('email'):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
