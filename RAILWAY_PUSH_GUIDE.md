# How to Push All Source Code to GitHub

## Step 1: Open Terminal in Your Project Folder

Open PowerShell or Command Prompt and navigate to your project:

```powershell
cd C:\RemoteAdminApp
```

## Step 2: Check What Git Sees

```powershell
git status
```

If `server/` and `dashboard/` are NOT listed, they may be gitignored or you may have uploaded only certain files via GitHub's web interface.

## Step 3: Add ALL Files

```powershell
git add .
```

## Step 4: Verify server/ and dashboard/ Are Included

```powershell
git status
```

Look for these in the output:
```
new file:   server/package.json
new file:   server/src/server.js
new file:   server/Dockerfile
new file:   dashboard/package.json
new file:   dashboard/src/App.js
new file:   dashboard/Dockerfile
```

If you DON'T see them, something is blocking them.

## Step 5: Commit and Force Push

```powershell
git commit -m "Add all source code for server and dashboard"
git push -f origin main
```

## Step 6: Verify on GitHub

Go to https://github.com/YOUR_USERNAME/RemoteAdminApp and confirm:
- `server/` folder exists with package.json and src/
- `dashboard/` folder exists with package.json and src/
- `android/` folder exists

## Step 7: Redeploy on Railway

Once GitHub has all files, Railway will auto-redeploy. If not, click Deploy manually.

Set these environment variables in Railway:
- JWT_SECRET = any-random-string-here
- ADMIN_PASSWORD = your-password
- CORS_ORIGIN = *

## Step 8: Test

Visit: https://your-service.up.railway.app/api/health

Should return: {"status":"ok","devices":0,"sessions":0}
