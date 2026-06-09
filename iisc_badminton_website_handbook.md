# IISc Badminton Club Website Handbook

## Overview

This document explains how the IISc Badminton Club website works, how content is managed, and how a new coordinator can maintain it without needing to understand all of the code.

---

## Website Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Hosting:** GitHub Pages
- **Dynamic Content:** Firebase Firestore (for tournaments/events)
- **Source Control:** GitHub repository

Project folder (local machine):
`E:\Github\iiscshuttlers\client`

---

## Main Website Sections

- Home
- About
- Facilities
- Events / Championships
- Announcements
- Gallery
- Contact

---

## How Website Works

### Static Pages

Most pages are normal React pages inside:
`client/src/pages/`

Examples:

- `Home.tsx`
- `About.tsx`
- `Facilities.tsx`
- `Gallery.tsx`
- `Contact.tsx`

### Routing

Managed in:
`client/src/App.tsx`

Routes include:

- `/`
- `/about`
- `/facilities`
- `/events`
- `/events/:slug`
- `/announcements`
- `/gallery`
- `/contact`

---

## Events / Tournament System

### Events Page

File:
`client/src/pages/Events.tsx`

This page reads tournament data from Firebase and shows:

- Live tournaments
- Upcoming tournaments
- Completed tournaments

### Tournament Detail Page

File:
`client/src/pages/TournamentDetail.tsx`

Example URLs:

- `/events/open-2026`
- `/events/spectrum-2026`

### Tournament Data Source

Firebase Firestore collection:
`tournaments`

Each tournament document has fields like:

- `name`
- `slug`
- `type`
- `status`
- `startDate`
- `endDate`
- `description`

### Status Values

Use one of:

- `live`
- `upcoming`
- `completed`

Changing status updates placement automatically on Events page.

---

## Announcements System

### File Location

`client/public/data/announcements.json`

### Purpose

Used for club notices such as:

- court maintenance
- registrations open
- tournament dates
- Instagram updates

### How to Edit

Open the JSON file and edit entries.

Example:

```json
{
  "pinned": [],
  "recent": [
    {
      "title": "Court Closed",
      "date": "2026-05-10",
      "category": "facility",
      "content": "Court closed for maintenance."
    }
  ]
}
```

### Categories

Use:

- `tournament`
- `facility`
- `general`
- `others`

---

## How to Add Images

## Option 1: For Gallery Page

Place images inside:
`client/public/images/`

Example:

- `client/public/images/tournament1.jpg`
- `client/public/images/teamphoto.png`

Then reference in code:

```tsx
<img src="/iiscshuttlers/images/tournament1.jpg" />
```

(For GitHub Pages deployment use `/iiscshuttlers/` base path.)

## Option 2: Replace Existing Images

Find image references in page files and change filename.

---

## How to Add New Tournament

### Firebase Console

1. Open Firebase project.
2. Firestore Database.
3. Open collection: `tournaments`
4. Add new document.

Example document id:
`open-2027`

Fields:

- `name`: Open Tournament 2027
- `slug`: open-2027
- `type`: open
- `status`: upcoming
- `startDate`: 2027-01-10
- `endDate`: 2027-01-15
- `description`: Open to all IISc players.

After saving, it appears automatically on website.

---

## How to Update Tournament Visibility

Change Firestore field:

- `status = upcoming`
- `status = live`
- `status = completed`

This controls where it appears.

---

## How to Run Website Locally

Open terminal:

```powershell
cd E:\Github\iiscshuttlers\client
npm install
npm run dev
```

Then open:
`http://localhost:3000/`

---

## How to Publish Changes to GitHub Pages

```powershell
git add .
git commit -m "Update website"
git push
```

GitHub Actions will deploy automatically.

Live site:
`https://rajajanmejay.github.io/iiscshuttlers/`

---

## Where Important Files Are

### Pages

`client/src/pages/`

### Navigation Bar

`client/src/components/Navigation.tsx`

### Footer

`client/src/components/Footer.tsx`

### Firebase Config

`client/src/lib/firebase.ts`

### Tournament Loader

`client/src/lib/tournaments.ts`

### Announcements Data

`client/public/data/announcements.json`

---

## If Something Breaks

### Site not updating

- Hard refresh browser (Ctrl+Shift+R)
- Wait for GitHub deploy

### Build fails

Check GitHub Actions logs.

### Firebase data not showing

Check internet + Firestore document fields.

---

## Recommended Workflow for New Coordinator

### Weekly

- Update announcements
- Add photos
- Check broken links

### Before Tournament

- Add event in Firebase
- Set status = upcoming
- Add registration info

### During Tournament

- Set status = live
- Update tournament page content

### After Tournament

- Set status = completed
- Upload photos
- Add winners/results

---

## Final Advice

Keep the website simple, updated, and accurate. Fresh content matters more than fancy features.
