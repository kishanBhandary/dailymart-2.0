# 🚀 Electron Auto-Update Setup Guide

## What's Now Configured

Your DailyMart app now has **automatic updates**! Here's how it works:

### Update Flow
```
1. You push code to GitHub
   ↓
2. GitHub Actions builds the app for Windows, Mac, Linux
   ↓
3. Creates a new Release with installers (on tag push)
   ↓
4. Client app checks for updates on startup
   ↓
5. Shows popup: "New version available!"
   ↓
6. User clicks → Auto-downloads & installs → Restarts with new code ✅
```

---

## ✅ Setup Steps

### 1. **Create Personal Access Token (Required)**

This allows GitHub Actions to create releases.

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `RELEASE_TOKEN`
4. Check these boxes:
   - ✅ `repo` (all)
   - ✅ `workflow`
   - ✅ `write:packages`
5. Copy the token (save it, you won't see it again)

### 2. **Add Token to GitHub Secrets**

1. Go to: https://github.com/kishanBhandary/dailymart-2.0/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `RELEASE_TOKEN`
4. Value: Paste your token
5. Click **"Add secret"**

### 3. **Create a Release**

When you're ready to release:

**Option A: Using Git** (Recommended)
```bash
# In your Linux machine
cd /home/kishan/Documents/dailymart

# Create a tag (increment version: v1.0.0 → v1.0.1)
git tag -a v1.0.1 -m "Release version 1.0.1"

# Push the tag to GitHub
git push origin v1.0.1
```

**Option B: Using GitHub Web UI**
1. Go to: https://github.com/kishanBhandary/dailymart-2.0/releases
2. Click **"Create a new release"**
3. Tag version: `v1.0.1`
4. Release title: `DailyMart v1.0.1`
5. Click **"Publish release"**

### 4. **Monitor Build Progress**

Watch the build:
1. Go to: https://github.com/kishanBhandary/dailymart-2.0/actions
2. See the build running
3. Once done, releases appear here: https://github.com/kishanBhandary/dailymart-2.0/releases

---

## 📱 Client Machine Setup

On your **client machine** where DailyMart is deployed:

### First Time Only:
```bash
# Make sure you're in the software folder
cd dailymart/software

# Install dependencies
npm install

# Start the app (it will check for updates automatically)
npm start
```

### How Updates Work:
- User opens the app ✅
- App checks GitHub for new releases
- If new version exists → Shows popup: **"Update available - v1.0.1?"**
- User clicks **"Update"** → Downloads & installs
- App restarts with new code ✅

---

## 🔄 Typical Workflow

### You on Linux (Development Machine)
```bash
# Make code changes, commit
git add .
git commit -m "feat: add new feature"
git push origin main

# When ready to release
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

### GitHub Actions
- Automatically builds for: Windows, macOS, Linux
- Creates release with all installers
- Takes ~5-10 minutes

### Client Machine
- Next time app starts
- Detects new version
- User can click "Update"
- Gets latest code automatically ✅

---

## 📋 Checklist

- [ ] Created Personal Access Token
- [ ] Added token to GitHub Secrets as `RELEASE_TOKEN`
- [ ] Updated `package.json` version number
- [ ] Pushed code to main branch
- [ ] Created a release tag (`git tag v1.0.1`)
- [ ] Watched build complete on GitHub Actions
- [ ] Test app on client machine (should show "Update available")

---

## 🐛 Troubleshooting

### Build fails on GitHub Actions
- Check: https://github.com/kishanBhandary/dailymart-2.0/actions
- Look at the error message
- Common issues:
  - Missing `RELEASE_TOKEN` secret → Add it
  - Outdated Node.js → Workflows use Node 18
  - Missing dependencies → Run `npm install` locally first

### App not checking for updates
- Make sure app is **packaged** (not running in dev mode)
- Check: `app.isPackaged` in console
- Update check only works in production builds

### Need help?
Let me know the error and I'll fix it!

---

## 📝 Next Steps

1. Create Personal Access Token (5 min)
2. Add it to GitHub Secrets (2 min)
3. Update version in `package.json`
4. Create a release tag
5. Push and watch it build!

Ready to give it a try? 🚀
