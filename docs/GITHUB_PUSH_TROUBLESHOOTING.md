# GitHub Push Troubleshooting + Emergency Backup Guide

## Status

- ✅ **3 Critical Commits Ready Locally**:
  - `45f58ea6` build(android): Android hardening + env-driven signing
  - `612f9d6b` feat(telemetry): Client error ingest endpoint
  - `4b098a21` fix(auth): Session timeout + telemetry dispatch
  - All on `main` branch, all tests pass

- ✅ **Build Outputs Safe**:
  - `npm run build` → `dist/` (production web)
  - `./gradlew.bat bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`
  - Both can be uploaded manually to Play Console if push fails

- ❌ **Current Blocker**: GitHub Push fails
  - Error: `fatal: repository 'https://github.com/oficaz/oficaz.git/' not found`
  - Possible causes: token expired, repo private, URL typo, no access

---

## Solution Workflow (Priority Order)

### Option 1: Fix GitHub Authentication (Recommended)

#### Step 1.1: Check GitHub Token/Credentials

```powershell
# Check if Git credential helper has GitHub token cached
git credential-manager-core get
# OR if using Windows Credential Manager directly:
# Control Panel → Credential Manager → Windows Credentials → github.com

# If nothing shows, OR token looks very old → proceed to 1.2
```

#### Step 1.2: Regenerate GitHub Token

1. Go to **GitHub.com** → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Create a new token with scopes:
   - `repo` (full control of private repos)
   - `admin:repo_hook` (if needed for webhooks)
3. Copy token (you'll only see it once!)
4. In terminal, run:

```powershell
# Remove old credential if exists
git credential-manager-core erase
# OR use Windows Credential Manager GUI to delete github.com entry

# Git will prompt for username/token on next push
git push origin main

# When prompted:
# Username: your_github_username
# Password: (paste your NEW token here, NOT your GitHub password)
```

#### Step 1.3: Verify Push Succeeds

```powershell
# Test push after updating token
git push origin main --force-with-lease  # NO FORCE! Use only if absolutely needed

# Check status
git log --oneline -3
git remote -v
```

---

### Option 2: Verify Repository Access

If token is recent but still fails:

```powershell
# A) Check if repo exists and you have access
# Visit: https://github.com/oficaz/oficaz
# (If 404 → repo doesn't exist or is private and you have no access)

# B) Check current remotes
git remote -v

# C) If repo is on different platform (GitLab, Gitea, etc.):
git remote set-url origin <correct-url>
git push origin main

# D) If repo uses SSH instead of HTTPS:
git remote set-url origin git@github.com:oficaz/oficaz.git
git push origin main
# (Requires SSH keys configured)
```

---

### Option 3: Manual Backup (Safe Failsafe)

If GitHub remains unreachable but you want changes preserved:

```powershell
# Create local backup of commits
cd "c:\Users\Practicas2\Dropbox\Oficaz\App\Oficaz"

# Export all 3 commits as patch files
git format-patch 9f27780b^..45f58ea6 --output-directory ".\backup-patches"
# Output: 
#   - backup-patches/0001-fix-auth-use-session-timeout-config.patch
#   - backup-patches/0002-feat-telemetry-add-client-error-ingest-endpoint.patch
#   - backup-patches/0003-build-android-harden-release-script.patch

# Also save AABs
Copy-Item -Path ".\android\app\build\outputs\bundle\release\app-release.aab" `
          -Destination ".\backup\app-release.aab"

# Store patches + AAB in Dropbox (already in path!)
# Patches are text files, easily versioned and mergeable later
```

---

### Option 4: Use Alternative Git Host Temporarily

If GitHub is permanently inaccessible:

```powershell
# Push to GitLab as backup
git remote add gitlab https://gitlab.com/oficaz/oficaz.git
git push -u gitlab main

# Or Gitea (self-hosted)
git remote add gitea https://git.ejemplo.com/oficaz/oficaz.git
git push -u gitea main
```

---

## Recommended Action Right Now

1. **Copy these commands** into a new terminal:

```powershell
# Check local commits are safe
git log --oneline -3

# Attempt push with fresh attempt
$env:GIT_TRACE=1  # Enable verbose logging
git push -v origin main

# If error shows auth issue → follow Step 1.2 above
# If error shows "Repository not found" → the repo URL/access is wrong
```

2. **If push succeeds** → All Done! 🎉  
3. **If still fails** → Reply with full error output from step above, and we'll try Option 2/3

---

## Safe State Verification

All critical code is committed locally and NOT at risk:

```powershell
# Verify commits exist locally
git log --oneline -5
# Should show: 45f58ea6, 612f9d6b, 4b098a21, 9f27780b, ...

# Verify no uncommitted work was lost
git status
# Should show clean, or list only expected tracked changes

# Verify Android AAB is built and ready
Test-Path ".\android\app\build\outputs\bundle\release\app-release.aab"

# Verify web dist is built
Test-Path ".\dist"
```

---

## Manual Google Play Upload (If Push Remains Blocked)

Even without GitHub push, you can upload directly:

1. **Get AAB file**:  
   - Located: `c:\Users\Practicas2\Dropbox\Oficaz\App\Oficaz\android\app\build\outputs\bundle\release\app-release.aab`
   - This is ready NOW

2. **Go to Google Play Console**  
   - App → Release → Internal Testing
   - Click "Create Release"
   - Upload AAB file
   - (You can reference git commits in release notes even if they haven't pushed yet)

3. **GitHub commits remain local**  
   - They're not lost! 
   - Can push later when auth is fixed
   - Or export as patches (see Option 3 above)

---

**Next Step**: Try Option 1.2 (refresh GitHub token) and report back with result.  
**No rush**: App is safe, builds are working, Play submission can proceed in parallel.
