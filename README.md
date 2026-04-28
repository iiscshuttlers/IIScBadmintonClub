# IISc Badminton Club Website 🏸

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy)

A modern, dynamic website for the Indian Institute of Science Badminton Club built with React, TypeScript, and Tailwind CSS.

## ✨ Features

- 🎨 **Dynamic Sports Energy Design** - Professional, energetic design with navy blue and emerald green
- 📱 **Fully Responsive** - Works perfectly on all devices
- ⚡ **Fast & Modern** - Built with Vite and React 19
- 🎭 **Smooth Animations** - Powered by Framer Motion
- 📝 **Interactive Forms** - Contact form with validation
- 🖼️ **Gallery** - Showcase club events and activities
- 📅 **Events Calendar** - Display upcoming and past events

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ 
- pnpm 10+ (or npm/yarn)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/iisc-badminton-club.git
cd iisc-badminton-club

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The site will be available at `http://localhost:5173`

## 📦 Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 🌐 Deployment

### Deploy to Netlify (Recommended)

1. **Push to GitHub** (you're already here! ✅)

2. **Connect to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub and select this repository
   - Netlify will auto-detect the build settings from `netlify.toml`
   - Click "Deploy site"

3. **Done!** Your site is live at `https://your-site.netlify.app`

**Auto-deployment**: Every push to `main` branch automatically deploys!

### Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Click "Import Project"
3. Select this GitHub repository
4. Deploy (automatic configuration)

### Deploy to GitHub Pages

```bash
pnpm build
pnpm gh-pages -d dist/public
```

## 🏗️ Project Structure

```
iisc-badminton-club/
├── client/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── hooks/          # Custom hooks
│   └── public/             # Static assets
├── server/                 # Backend (if needed)
├── dist/                   # Production build
└── netlify.toml           # Netlify configuration
```

## 🎨 Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI)
- **Routing**: Wouter
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## 📄 Pages

- **Home** - Hero section, highlights, call-to-action
- **About** - Mission, values, history, leadership
- **Facilities** - Indoor courts information
- **Events** - Upcoming and past events
- **Gallery** - Photo gallery
- **Contact** - Contact form and information

## 🎨 Design System

### Colors
- **Primary**: Deep Navy (`#1a2a4a`)
- **Accent**: Emerald Green (`#10b981`)
- **Secondary**: Bright Orange (`#ff6b35`)

### Typography
- **Display**: Playfair Display (headings)
- **Body**: Inter (body text)

## 🔧 Configuration

### Environment Variables (Optional)

Create a `.env` file in the root:

```env
VITE_CONTACT_EMAIL=badminton@iisc.ac.in
VITE_PHONE=+91 (080) 2293 2000
```

### Netlify Configuration

The `netlify.toml` file handles:
- Build settings
- Redirect rules for SPA routing
- Node version specification

## 📝 Available Scripts

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm preview    # Preview production build
pnpm check      # TypeScript type checking
pnpm format     # Format code with Prettier
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

MIT License - feel free to use this project for your own club website!

## 🙏 Acknowledgments

- Design inspiration: Modern athletic minimalism
- IISc Badminton Club community
- shadcn/ui for beautiful components

## 📞 Contact

**IISc Badminton Club**
- Email: badminton@iisc.ac.in
- Phone: +91 (080) 2293 2000
- Location: IISc Gymkhana, Bangalore - 560012

---

Made with ❤️ for the IISc Badminton Community
