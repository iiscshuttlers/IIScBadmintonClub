# 📦 GitHub Deployment Guide

## Step-by-Step: Deploy Your Site in 10 Minutes

### Part 1: Upload to GitHub

#### Option A: Using GitHub Desktop (Easiest - No command line)

1. **Download GitHub Desktop**
   - Go to https://desktop.github.com
   - Install it on your computer

2. **Create a GitHub Account** (if you don't have one)
   - Go to https://github.com/join
   - Sign up (it's free!)

3. **Create New Repository**
   - Open GitHub Desktop
   - Click "File" → "New Repository"
   - Name: `iiscshuttlers`
   - Description: "IISc Badminton Club Website"
   - Check "Initialize with README" (uncheck - we already have one)
   - Click "Create Repository"

4. **Add Your Files**
   - Copy all project files to the repository folder
   - GitHub Desktop will show all changes
   - Write commit message: "Initial commit - IISc Badminton Club website"
   - Click "Commit to main"
   - Click "Publish repository"
   - Choose "Public" or "Private"
   - Click "Publish Repository"

✅ **Done!** Your code is now on GitHub!

---

#### Option B: Using Command Line (For developers)

```bash
# Navigate to your project folder
cd iiscshuttlers

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - IISc Badminton Club website"

# Create repository on GitHub.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/iiscshuttlers.git
git branch -M main
git push -u origin main
```

---

### Part 2: Deploy to Netlify (FREE!)

#### Steps:

1. **Go to Netlify**
   - Visit https://app.netlify.com
   - Click "Sign up" → Choose "GitHub" to sign in

2. **Import Your Project**
   - Click "Add new site" button
   - Select "Import an existing project"
   - Click "GitHub"
   - Authorize Netlify to access your GitHub
   - Select `iiscshuttlers` repository

3. **Configure Build Settings** (Auto-detected from netlify.toml)
   - Build command: `pnpm install && pnpm build`
   - Publish directory: `dist/public`
   - Click "Deploy site"

4. **Wait for Build** (2-3 minutes)
   - Netlify will build your site automatically
   - You'll see a progress bar

5. **Your Site is LIVE! 🎉**
   - You'll get a URL like: `https://random-name-12345.netlify.app`
   - Click on it to see your live site!

---

### Part 3: Customize Your URL (Optional)

1. **In Netlify Dashboard**:
   - Click "Site settings"
   - Click "Change site name"
   - Enter: `iiscshuttlers`
   - Your URL becomes: `https://iiscshuttlers.netlify.app`

2. **Add Custom Domain** (Optional):
   - Click "Domain management"
   - Click "Add custom domain"
   - Enter your domain (e.g., `badminton.iisc.ac.in`)
   - Follow DNS setup instructions

---

### Part 4: Automatic Updates 🚀

**Now the magic happens!**

Every time you make changes:

1. **Edit files** in your project
2. **Commit changes** (via GitHub Desktop or command line)
3. **Push to GitHub**
4. **Netlify automatically rebuilds and deploys!** ✨

No manual deployment needed - it's all automatic!

---

## 🔄 Making Updates

### Using GitHub Desktop:

1. Make changes to your files
2. Open GitHub Desktop
3. You'll see changed files listed
4. Write a commit message (e.g., "Updated contact info")
5. Click "Commit to main"
6. Click "Push origin"
7. Wait 2-3 minutes → Your site is updated!

### Using Command Line:

```bash
# Make your changes, then:
git add .
git commit -m "Your update message"
git push
```

---

## 📊 Build Status Badge

Add this to your README to show build status:

```markdown
[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-SITE-ID/deploy-status)](https://app.netlify.com/sites/YOUR-SITE-NAME/deploys)
```

Get your badge from: Netlify Dashboard → Site Settings → Status badges

---

## 🆘 Troubleshooting

### Build Failed?

**Check Netlify Build Logs:**

1. Go to Netlify Dashboard
2. Click "Deploys"
3. Click on the failed deploy
4. Read the error message
5. Common fixes:
   - Make sure `netlify.toml` is in root directory
   - Check `package.json` for correct scripts
   - Verify all dependencies are in `package.json`

### Site Not Updating?

1. Check GitHub - are your changes pushed?
2. Check Netlify - is the build running?
3. Clear browser cache (Ctrl+Shift+R)

### Need Help?

- Netlify Docs: https://docs.netlify.com
- GitHub Docs: https://docs.github.com
- Stack Overflow: https://stackoverflow.com

---

## ✅ Checklist

- [ ] Create GitHub account
- [ ] Upload code to GitHub
- [ ] Create Netlify account
- [ ] Connect GitHub to Netlify
- [ ] Deploy site
- [ ] Customize URL (optional)
- [ ] Test automatic deployment
- [ ] Share your site! 🎉

---

## 🎯 Next Steps

After deployment:

1. **Share your URL** with club members
2. **Update content** as needed
3. **Add Google Analytics** (optional)
4. **Set up contact form** backend (optional)
5. **Add custom domain** (optional)

---

**Questions?** Open an issue on GitHub or check the docs above!

Happy deploying! 🚀
