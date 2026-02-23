# Contributing to IT Inventory

Thank you for contributing to the IT Inventory! This guide will help you make changes safely and effectively.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-ORG/it-inventory.git
cd it-inventory
```

### 2. Set Up Development Environment

```bash
# Copy environment template
cp backend/.env.example .env

# Edit with your credentials
nano .env

# Start the application
./start.sh
```

### 3. Create a Branch

Always create a new branch for your changes:

```bash
# Create and switch to new branch
git checkout -b feature/your-feature-name

# Examples:
git checkout -b feature/add-monitor-support
git checkout -b fix/fleet-sync-timeout
git checkout -b docs/update-deployment-guide
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding tests

## Making Changes

### Code Style

**Python (Backend):**
- Follow PEP 8
- Use type hints
- Add docstrings to functions
- Keep functions focused and small

```python
from typing import Optional

def get_asset_by_serial(serial_number: str, db: Session) -> Optional[Asset]:
    """
    Retrieve an asset by serial number.
    
    Args:
        serial_number: The device serial number
        db: Database session
        
    Returns:
        Asset object if found, None otherwise
    """
    return db.query(Asset).filter(Asset.serial_number == serial_number).first()
```

**JavaScript/React (Frontend):**
- Use functional components with hooks
- Keep components small and focused
- Use descriptive variable names
- Add comments for complex logic

```javascript
// Good
const AssetList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter assets based on search term
  const filteredAssets = assets.filter(asset => 
    asset.model.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return <div>...</div>;
};
```

### Commit Messages

Write clear, descriptive commit messages:

```bash
# Good examples
git commit -m "Add support for monitor device type"
git commit -m "Fix Fleet sync timeout issue"
git commit -m "Update deployment documentation for AWS"

# Bad examples
git commit -m "fix stuff"
git commit -m "update"
git commit -m "changes"
```

**Format:**
```
<type>: <short description>

<longer description if needed>

Fixes #123
```

Example:
```
feat: Add support for tracking monitors

- Add monitor device type to models
- Update UI to show monitor-specific fields
- Add screen size and resolution tracking

Fixes #45
```

### Testing Your Changes

**Backend:**
```bash
cd backend

# Run tests
pytest

# Run specific test
pytest tests/test_fleet_service.py

# Check test coverage
pytest --cov
```

**Frontend:**
```bash
cd frontend

# Run tests
npm test

# Run in watch mode
npm test -- --watch
```

**Manual Testing:**
1. Start the application locally
2. Test the specific feature you changed
3. Verify existing features still work
4. Check different user scenarios

### Database Changes

If you modify database models:

```bash
cd backend

# Create migration
alembic revision --autogenerate -m "Add monitor fields"

# Review the generated migration
# Edit if needed: alembic/versions/xxxxx_add_monitor_fields.py

# Test migration
alembic upgrade head

# Test rollback
alembic downgrade -1
alembic upgrade head
```

## Submitting Changes

### 1. Push Your Branch

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat: Add monitor tracking support"

# Push to GitHub
git push origin feature/add-monitor-support
```

### 2. Create Pull Request

1. Go to GitHub repository
2. Click "Pull requests" → "New pull request"
3. Select your branch
4. Fill out the PR template (see below)
5. Request review from a team member
6. Wait for approval

### 3. Pull Request Template

Use this template when creating PRs:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

## Changes Made
- Added X feature
- Fixed Y bug
- Updated Z documentation

## Testing
- [ ] Tested locally
- [ ] All tests pass
- [ ] Added new tests if applicable

## Screenshots (if applicable)
Add screenshots showing UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-reviewed my code
- [ ] Commented complex code
- [ ] Updated documentation if needed
- [ ] No sensitive data in commits

## Related Issues
Fixes #123
Relates to #456
```

### 4. Code Review Process

**As Author:**
- Respond to feedback promptly
- Make requested changes
- Re-request review when ready
- Don't take feedback personally!

**As Reviewer:**
- Be constructive and respectful
- Test the changes locally if possible
- Ask questions if unclear
- Approve when satisfied

## Common Tasks

### Adding a New Device Type

1. **Update backend model** (`backend/models.py`):
```python
# No code changes needed - device_type is already a string field
```

2. **Add to frontend dropdown** (`frontend/src/components/AssetCreate.js`):
```javascript
<option value="monitor">Monitor</option>
<option value="keyboard">Keyboard</option>
<option value="new-device-type">New Device Type</option>
```

3. **Update documentation**:
- Add device type to README.md
- Update PROJECT_OVERVIEW.md

### Adding a New API Endpoint

1. **Create endpoint** (`backend/main.py`):
```python
@app.get("/api/assets/warranty-expiring")
async def get_expiring_warranties(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = None  # Temporarily disabled auth
):
    """Get assets with warranties expiring in X days"""
    # Implementation
```

2. **Add to API client** (`frontend/src/utils/api.js`):
```javascript
export const getExpiringWarranties = (days = 30) => 
  apiClient.get('/api/assets/warranty-expiring', { params: { days } });
```

3. **Use in component**:
```javascript
const { data } = useQuery({
  queryKey: ['expiring-warranties'],
  queryFn: () => apiClient.get('/api/assets/warranty-expiring')
});
```

### Updating Dependencies

**Backend:**
```bash
cd backend

# Update specific package
pip install --upgrade package-name

# Update requirements.txt
pip freeze > requirements.txt
```

**Frontend:**
```bash
cd frontend

# Update specific package
npm update package-name

# Check for outdated packages
npm outdated
```

## Debugging

### Backend Issues

**View logs:**
```bash
docker-compose logs -f backend
```

**Access Python shell:**
```bash
docker exec -it asset-tracker-backend python
```

**Debug database:**
```bash
docker exec -it asset-tracker-db psql -U assetuser asset_tracker
```

### Frontend Issues

**View logs:**
```bash
docker-compose logs -f frontend
```

**Browser console:**
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for API errors

**React DevTools:**
- Install React DevTools browser extension
- Inspect component state and props

## Release Process

When ready to deploy a new version:

### 1. Version Bump

Update version in:
- `backend/main.py` (if applicable)
- `frontend/package.json`

### 2. Create Tag

```bash
git tag -a v1.1.0 -m "Release v1.1.0: Add monitor support"
git push origin v1.1.0
```

### 3. Create GitHub Release

1. Go to "Releases" on GitHub
2. Click "Draft a new release"
3. Select tag `v1.1.0`
4. Add release notes:

```markdown
## New Features
- Added support for monitor tracking
- Enhanced Fleet sync performance

## Bug Fixes
- Fixed timeout issue with large Fleet instances
- Corrected warranty date calculation

## Breaking Changes
None

## Upgrade Instructions
1. Pull latest code
2. Run: docker-compose down
3. Run: docker-compose up -d
```

## Getting Help

**Questions about the code:**
- Create a GitHub Discussion
- Ask in #it-tools Slack channel
- Review existing documentation

**Found a bug:**
- Check existing issues first
- Create new issue with reproduction steps
- Include logs and screenshots

**Need architecture guidance:**
- Review ARCHITECTURE.md (if exists)
- Ask senior developer
- Schedule pair programming session

## Resources

- **Flask MDM API Docs:** https://fleetdm.com/docs/rest-api
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **React Docs:** https://react.dev
- **SQLAlchemy Docs:** https://docs.sqlalchemy.org

---

Thank you for contributing! Your work helps the entire IT team manage assets more effectively. 🎉
