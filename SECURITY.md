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
- **Generate a strong SECRET_KEY** — run `openssl rand -hex 32` and never reuse across environments
- **Never commit `.env`** — it's in `.gitignore` but double-check before every commit
- **Restrict network access** — the backend API should not be publicly exposed without authentication
- **Use HTTPS in production** — put HAM behind a reverse proxy (nginx, Caddy) with TLS
- **Rotate tokens regularly** — Fleet API tokens, IdP API tokens (Okta/Azure/Google), ABM keys
- **Keep the `keys/` directory private** — ABM private keys should never be committed or shared
- **Use secrets management in production** — prefer AWS Secrets Manager, GCP Secret Manager, or Vault over plain `.env` files for production deployments
- **Scope API tokens narrowly** — Fleet tokens should be read-only, IdP tokens should have only the permissions HAM needs
