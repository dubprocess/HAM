# Security Policy

## Supported versions

Security fixes are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report security issues by emailing the maintainer directly or using [GitHub's private vulnerability reporting](https://github.com/dubprocess/HAM/security/advisories/new).

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix if you have one

You can expect an acknowledgment within 48 hours and a resolution timeline within 7 days for critical issues.

## Security considerations for self-hosted deployments

- **Change default credentials** — update `POSTGRES_PASSWORD` and `SECRET_KEY` before going to production
- **Never commit `.env`** — it's in `.gitignore` but double-check
- **Restrict network access** — the backend API should not be publicly exposed without authentication
- **Rotate tokens regularly** — Fleet API tokens, Okta API tokens, ABM keys
- **Keep the `keys/` directory private** — ABM private keys should never be committed or shared
- **Use HTTPS in production** — put HAM behind a reverse proxy (nginx, Caddy) with TLS
