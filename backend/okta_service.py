import httpx
import json
import os
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Mapping of Okta city values to HAM location codes.
# Configure via LOCATION_MAPPING env var as JSON, e.g.:
# LOCATION_MAPPING={"new york": "NYC", "san francisco": "SFO", "chicago": "ORD", "remote": "Remote"}
_default_mapping = {}
try:
    _default_mapping = json.loads(os.getenv('LOCATION_MAPPING', '{}'))
except (json.JSONDecodeError, TypeError):
    _default_mapping = {}

CITY_TO_LOCATION: Dict[str, str] = _default_mapping


class OktaUserService:
    """Service for looking up user profile data from Okta API."""

    def __init__(self, okta_domain: str = None, api_token: str = None):
        # Derive domain from OKTA_ISSUER (e.g. https://your-company.okta.com/oauth2/default -> https://your-company.okta.com)
        if not okta_domain:
            issuer = os.getenv('OKTA_ISSUER', '')
            # Strip /oauth2/... suffix to get base domain
            if '/oauth2' in issuer:
                okta_domain = issuer.split('/oauth2')[0]
            else:
                okta_domain = issuer
        self.okta_domain = okta_domain.rstrip('/')
        self.api_token = api_token or os.getenv('OKTA_API_TOKEN', '')
        self.headers = {
            'Authorization': f'SSWS {self.api_token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }
        # In-memory cache: email -> {city, location, department}
        # Cleared each sync run to avoid stale data across days
        self._cache: Dict[str, Optional[Dict]] = {}

    def clear_cache(self):
        """Clear the user cache. Call at the start of each sync."""
        self._cache.clear()

    async def get_user_location(self, email: str) -> Optional[str]:
        """Look up a user's HAM location code from Okta.
        
        Returns location code or None if not found.
        """
        profile = await self.get_user_profile(email)
        if not profile:
            return None
        city = (profile.get('city') or '').strip().lower()
        return CITY_TO_LOCATION.get(city)

    async def get_user_profile(self, email: str) -> Optional[Dict]:
        """Fetch user profile from Okta by email. Results are cached per sync run."""
        if not self.api_token or not self.okta_domain:
            return None

        if email in self._cache:
            return self._cache[email]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f'{self.okta_domain}/api/v1/users/{email}',
                    headers=self.headers,
                    timeout=10.0,
                )
                if response.status_code == 404:
                    logger.debug(f'Okta user not found: {email}')
                    self._cache[email] = None
                    return None
                response.raise_for_status()
                data = response.json()
                profile = data.get('profile', {})
                result = {
                    'city': profile.get('city', ''),
                    'state': profile.get('state', ''),
                    'country_code': profile.get('countryCode', ''),
                    'department': profile.get('department', ''),
                    'street_address': profile.get('streetAddress', ''),
                }
                self._cache[email] = result
                return result
        except httpx.HTTPStatusError as e:
            logger.warning(f'Okta API error for {email}: {e.response.status_code}')
            self._cache[email] = None
            return None
        except Exception as e:
            logger.warning(f'Okta lookup failed for {email}: {e}')
            # Don't cache errors — allow retry
            return None

    @staticmethod
    def map_city_to_location(city: str) -> Optional[str]:
        """Convert an Okta city value to a HAM location code."""
        if not city:
            return None
        return CITY_TO_LOCATION.get(city.strip().lower())
