# IISc Badminton Club - Deployment Guide

## 🚀 Quick Deploy to Netlify (Recommended - 5 minutes)

### Option 1: Deploy via Netlify Drop (Easiest - No GitHub needed)

1. **Download your project files** (already prepared below)
2. **Go to Netlify**: https://app.netlify.com/drop
3. **Drag and drop** the `dist/public` folder
4. **Done!** Your site is live in seconds

Your site will get a URL like: `https://random-name-12345.netlify.app`

To get a custom domain:
- Go to Site Settings → Domain Management
- Add your custom domain (free with Netlify)

---

### Option 2: Deploy via GitHub (Better for updates)

1. **Create a GitHub account** (if you don't have one): https://github.com/join

2. **Create a new repository**:
   - Go to https://github.com/new
   - Name: `iiscshuttlers`
   - Make it Public or Private
   - Click "Create repository"

3. **Upload your files**:
   - Download all project files (provided below)
   - On GitHub, click "uploading an existing file"
   - Drag all files and folders
   - Click "Commit changes"

4. **Connect to Netlify**:
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Choose "GitHub"
   - Select your `iiscshuttlers` repository
   - Build settings are already configured in `netlify.toml`
   - Click "Deploy site"

5. **Your site is live!** 🎉
   - Netlify will build and deploy automatically
   - You'll get a URL like: `https://random-name.netlify.app`
   - Every time you push changes to GitHub, the site auto-updates!

---

## 🌐 Alternative Platforms

### Vercel (Also Great for React)
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Import Project"
4. Select your GitHub repo
5. Deploy (automatic configuration)

### Firebase Hosting (Google Product)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## 📁 What's Included

Your deployment package includes:
- ✅ Updated pages (Training/Coaching sections removed)
- ✅ Production build (`dist/public` folder)
- ✅ Netlify configuration (`netlify.toml`)
- ✅ All source code
- ✅ Package configuration

---

## 🔧 Local Development (Optional)

To run the site locally:

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

Development server runs on: http://localhost:5173

---

## 🎨 Customization

After deployment, you can:
1. Update content by editing files in `client/src/pages/`
2. Change colors in Tailwind CSS
3. Add new pages by creating new files in pages folder
4. Update images by replacing URLs

Push changes to GitHub, and Netlify will auto-deploy!

---

## 📞 Need Help?

- Netlify Docs: https://docs.netlify.com
- Vercel Docs: https://vercel.com/docs
- React Docs: https://react.dev

---

## ✅ Current Features

- ✨ Dynamic React application
- 📱 Fully responsive design
- 🎨 Modern UI with Tailwind CSS & shadcn/ui
- ⚡ Fast Vite build system
- 🎭 Smooth animations with Framer Motion
- 📝 Contact form
- 🖼️ Gallery page
- 📅 Events calendar

Enjoy your new website! 🏸
