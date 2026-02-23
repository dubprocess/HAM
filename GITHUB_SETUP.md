# GitHub Repository Setup Instructions

## Quick Setup (5 minutes)

### 1. Create the Repository on GitHub

Go to: https://github.com/organizations/[YOUR-ORG]/repositories/new

**Settings:**
```
Repository name: it-inventory
Description: IT Asset Inventory Tracker with Fleet MDM integration and Okta authentication. Manages hardware assets, automates device assignments, and tracks maintenance history.

Visibility: ☑ Private (recommended for internal tools)

Initialize this repository:
☐ Add a README file (already have comprehensive docs)
☐ Add .gitignore (we have a custom one)
☑ Choose a license: MIT License (or leave unchecked for proprietary)
```

Click **"Create repository"**

---

### 2. Push Your Code to GitHub

After creating the repository, GitHub will show you commands. Use these instead:

```bash
# Navigate to your project
cd it-asset-tracker

# Initialize git (if not already done)
git init

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit: IT Inventory with Fleet MDM integration"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR-ORG/it-inventory.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

### 3. Verify Upload

Go to: `https://github.com/YOUR-ORG/it-inventory`

You should see:
- ✅ All source code files
- ✅ README.md displaying on homepage
- ✅ PROJECT_OVERVIEW.md and DEPLOYMENT.md
- ✅ .gitignore (hiding .env files)
- ✅ MIT License file

---

### 4. Configure Repository Settings (Recommended)

#### A. Protect Secrets

Go to: **Settings → Secrets and variables → Actions**

Add these secrets (for GitHub Actions if you add CI/CD later):
- `OKTA_CLIENT_ID`
- `OKTA_CLIENT_SECRET`
- `FLEET_API_TOKEN`

#### B. Branch Protection

Go to: **Settings → Branches → Add rule**

Branch name pattern: `main`

Enable:
- ☑ Require pull request reviews before merging
- ☑ Require status checks to pass before merging
- ☑ Require branches to be up to date before merging

#### C. Add Repository Topics

Go to: **Settings → (About section)**

Add topics:
```
it-asset-management
fleet-mdm
okta
python
fastapi
react
docker
inventory-tracker
```

This helps your team find the repo.

---

### 5. Set Up Team Access

Go to: **Settings → Collaborators and teams**

Add teams:
- **IT-Admins:** Admin access
- **IT-Team:** Write access
- **Developers:** Read access (if relevant)

---

### 6. Create Initial Issues (Optional but Recommended)

Create issues to track setup tasks:

**Issue #1: Initial Configuration**
```
Title: Configure Okta and Fleet Credentials
Labels: setup, configuration

Tasks:
- [ ] Create Okta OIDC application
- [ ] Configure Okta redirect URIs
- [ ] Generate Fleet API token
- [ ] Update .env file with credentials
- [ ] Test authentication
```

**Issue #2: First Deployment**
```
Title: Deploy to Development Environment
Labels: deployment, devops

Tasks:
- [ ] Set up development server
- [ ] Configure Docker Compose
- [ ] Run database migrations
- [ ] Test Fleet sync
- [ ] Verify authentication
```

**Issue #3: Team Onboarding**
```
Title: Onboard IT Team to Asset Tracker
Labels: documentation, onboarding

Tasks:
- [ ] Share repository access
- [ ] Schedule training session
- [ ] Document internal processes
- [ ] Create user guide
```

---

## Ongoing Git Workflow

### Making Changes

```bash
# Create a feature branch
git checkout -b feature/add-monitors-support

# Make your changes
# ... edit files ...

# Stage and commit
git add .
git commit -m "Add support for monitor tracking"

# Push to GitHub
git push origin feature/add-monitors-support
```

### Creating Pull Request

1. Go to GitHub repository
2. Click "Pull requests" → "New pull request"
3. Select your branch
4. Add description of changes
5. Request review from team member
6. Merge when approved

### Pulling Latest Changes

```bash
# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Update your feature branch
git checkout feature/your-branch
git merge main
```

---

## Security Best Practices

### ⚠️ CRITICAL: Never Commit These Files

The `.gitignore` is configured to prevent these, but double-check:

- ❌ `.env` files (contains secrets)
- ❌ `*.pem`, `*.key` files (certificates)
- ❌ Database files
- ❌ Uploaded attachments

### Verify Before Committing

```bash
# Check what will be committed
git status

# Review changes
git diff

# If .env appears, DO NOT commit!
# It should be blocked by .gitignore
```

### If You Accidentally Commit Secrets

```bash
# Remove from git history
git rm --cached .env

# Commit the removal
git commit -m "Remove .env from repository"

# Push
git push origin main

# IMPORTANT: Also rotate all secrets!
# - Generate new Okta client secret
# - Generate new Fleet API token
# - Update .env with new values
```

---

## Repository Maintenance

### Weekly Tasks
- Review open pull requests
- Check for security alerts
- Update dependencies if needed

### Monthly Tasks
- Review and close stale issues
- Update documentation
- Tag releases (e.g., v1.0.0, v1.1.0)

### Creating Releases

```bash
# Tag a version
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

Then on GitHub:
1. Go to "Releases"
2. Click "Draft a new release"
3. Select tag v1.0.0
4. Add release notes
5. Publish

---

## Troubleshooting

### Large Files Rejected

If git rejects large files:

```bash
# Remove large file from staging
git rm --cached path/to/large/file

# Add to .gitignore
echo "path/to/large/file" >> .gitignore

# Commit
git add .gitignore
git commit -m "Ignore large files"
```

### Merge Conflicts

```bash
# Pull latest changes
git pull origin main

# If conflicts occur, git will mark files
# Edit conflicting files, resolve conflicts

# Stage resolved files
git add .

# Complete merge
git commit -m "Resolve merge conflicts"
```

### Reset to Previous Commit

```bash
# See commit history
git log --oneline

# Reset to specific commit (careful!)
git reset --hard COMMIT_HASH

# Force push if already pushed
git push --force origin main
```

---

## Next Steps

After setting up the repository:

1. ✅ Verify all files uploaded
2. ✅ Configure team access
3. ✅ Set up branch protection
4. ✅ Create initial issues
5. ✅ Share with IT team
6. → **Follow PROJECT_OVERVIEW.md** to configure and run the application

---

**Repository Ready!** 🎉

Your team can now collaborate on the IT Inventory with proper version control and code review processes.
