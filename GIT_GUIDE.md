# Git Quick Reference for IT Inventory

Quick reference for common Git operations on this project.

## Daily Workflow

### Starting Work on a New Feature

```bash
# Get latest code
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes...
# ... edit files ...

# Check what changed
git status
git diff

# Stage changes
git add .

# Commit with message
git commit -m "feat: Add your feature description"

# Push to GitHub
git push origin feature/your-feature-name

# Create PR on GitHub
# Go to: https://github.com/YOUR-ORG/it-inventory/pulls
```

## Common Commands

### Viewing Status & History

```bash
# See what files changed
git status

# See what you modified
git diff

# See commit history
git log --oneline

# See who changed what in a file
git blame filename.py
```

### Making Changes

```bash
# Stage specific file
git add filename.py

# Stage all changes
git add .

# Commit staged changes
git commit -m "Your message"

# Commit with detailed message
git commit
# (Opens editor for longer message)

# Amend last commit (before pushing)
git commit --amend
```

### Syncing with Remote

```bash
# Get latest changes
git pull origin main

# Push your changes
git push origin branch-name

# Push new branch first time
git push -u origin branch-name

# Force push (careful!)
git push --force origin branch-name
```

### Branch Management

```bash
# List all branches
git branch -a

# Switch to existing branch
git checkout branch-name

# Create and switch to new branch
git checkout -b new-branch-name

# Delete local branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name

# Rename current branch
git branch -m new-name
```

### Merging & Updating

```bash
# Merge main into your branch
git checkout your-branch
git merge main

# Rebase your branch onto main (alternative to merge)
git checkout your-branch
git rebase main

# Continue after resolving conflicts
git add .
git rebase --continue

# Abort rebase
git rebase --abort
```

### Undoing Changes

```bash
# Discard changes in file (before staging)
git checkout -- filename.py

# Unstage file (after git add)
git reset HEAD filename.py

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) ⚠️
git reset --hard HEAD~1

# Revert a commit (creates new commit)
git revert COMMIT_HASH
```

### Stashing Changes

```bash
# Save changes temporarily
git stash

# Save with description
git stash save "WIP: feature description"

# List stashes
git stash list

# Apply most recent stash
git stash apply

# Apply and remove stash
git stash pop

# Apply specific stash
git stash apply stash@{0}

# Delete stash
git stash drop stash@{0}
```

## Common Scenarios

### Scenario 1: Pull Request Has Conflicts

```bash
# Update your branch with main
git checkout your-branch
git fetch origin
git merge origin/main

# If conflicts occur:
# 1. Open conflicting files
# 2. Look for <<<<<<< markers
# 3. Edit to resolve conflicts
# 4. Remove conflict markers
# 5. Save files

# Stage resolved files
git add .

# Complete merge
git commit -m "Merge main and resolve conflicts"

# Push updated branch
git push origin your-branch
```

### Scenario 2: Accidentally Committed to Main

```bash
# Create branch from current state
git branch feature/my-changes

# Reset main to remote
git checkout main
git reset --hard origin/main

# Continue work on feature branch
git checkout feature/my-changes
```

### Scenario 3: Need to Update Branch with Latest Main

```bash
# On your feature branch
git fetch origin
git merge origin/main

# Or use rebase for cleaner history
git rebase origin/main
```

### Scenario 4: Accidentally Committed .env File

```bash
# Remove from staging (if not yet committed)
git reset HEAD .env

# Remove from last commit
git rm --cached .env
git commit --amend

# Remove from history (if already pushed) ⚠️
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (⚠️ coordinate with team!)
git push --force origin main

# ⚠️ CRITICAL: Rotate all secrets!
# The .env file is now in Git history
```

### Scenario 5: Want to Test Someone Else's Branch

```bash
# Fetch all branches
git fetch origin

# Checkout their branch
git checkout their-branch-name

# Test it...

# Go back to your branch
git checkout your-branch
```

## Working with PRs

### Update PR After Review Feedback

```bash
# Make requested changes
# ... edit files ...

# Stage and commit
git add .
git commit -m "Address review feedback"

# Push to same branch
git push origin your-branch

# PR updates automatically!
```

### Squash Commits Before Merging

```bash
# Interactive rebase last 3 commits
git rebase -i HEAD~3

# In editor, change 'pick' to 'squash' for commits to combine
# Save and close editor
# Edit combined commit message
# Save and close

# Force push
git push --force origin your-branch
```

## Troubleshooting

### "Your branch and 'origin/main' have diverged"

```bash
# If you want to keep your changes
git pull --rebase origin main

# If you want to discard local changes
git reset --hard origin/main
```

### "fatal: refusing to merge unrelated histories"

```bash
# Force merge (rare case)
git pull origin main --allow-unrelated-histories
```

### "Changes not staged for commit"

```bash
# You have uncommitted changes
# Either commit them or stash them
git stash  # Save for later
# or
git add .
git commit -m "Save work"
```

### Large File Too Big to Push

```bash
# Remove from tracking
git rm --cached large-file.zip

# Add to .gitignore
echo "*.zip" >> .gitignore

# Commit removal
git add .gitignore
git commit -m "Remove large files"
```

## Best Practices

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: Add monitor support to asset tracking

- Added monitor device type
- Created monitor-specific fields
- Updated UI components

Fixes #123

---

fix: Correct Fleet sync timeout issue

Increased timeout from 10s to 30s for large instances

Fixes #156

---

docs: Update deployment guide for AWS

Added ECS deployment steps and configuration examples
```

### Before Committing

```bash
# Always check what you're committing
git status
git diff

# Make sure .env isn't included
git status | grep .env
# Should return nothing!

# Run tests
cd backend && pytest
cd frontend && npm test

# Check Docker builds
docker-compose build
```

### Pull Request Checklist

- [ ] Branch is up to date with main
- [ ] All tests pass locally
- [ ] No console errors or warnings
- [ ] Code follows style guidelines
- [ ] Added/updated documentation
- [ ] No sensitive data in commits
- [ ] Meaningful commit messages
- [ ] PR description filled out
- [ ] Requested review from team member

## Git Configuration

### Set Up Git Identity

```bash
# Set your name
git config --global user.name "Your Name"

# Set your email
git config --global user.email "you@company.com"

# Use VS Code as editor
git config --global core.editor "code --wait"
```

### Useful Aliases

Add to `~/.gitconfig`:

```ini
[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    lg = log --oneline --graph --all --decorate
    undo = reset HEAD~1 --soft
    amend = commit --amend --no-edit
    wip = commit -am "WIP"
```

Usage:
```bash
git st      # Instead of git status
git co main # Instead of git checkout main
git lg      # Pretty log graph
```

## Emergency Contacts

**Git Stuck? Get Help:**
1. Check this guide first
2. Ask in #it-tools Slack channel
3. Create GitHub issue with "help wanted" label
4. Pair with senior developer

**Remember:** 
- You can almost always undo Git operations
- When in doubt, ask before force-pushing
- Always pull before pushing
- Commit often, push frequently

---

**Pro Tip:** Keep this file open while working! Most Git tasks fall into these patterns.
