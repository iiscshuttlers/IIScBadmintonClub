# IISc Shuttlers - Administrator Guide

Welcome to the IISc Badminton Club website admin guide! This document explains how the website works under the hood, what your specific admin powers are, and exactly how to host and manage a live tournament from start to finish.

---

## 1. How the Website Works

The website uses a hybrid backend approach to get the best of both worlds (security for users, real-time speed for tournaments).

### **Frontend**

- **React & Vite**: The user interface is built with React and bundled using Vite.
- **Hosting**: It is hosted on GitHub Pages (or Vercel/Netlify).

### **Backend 1: Supabase (Persistent Data)**

- Used for: **Authentication, Player Directory, and Match Logging.**
- The `players` table holds all user profiles, ELO ratings, and historical match stats.
- **PostgreSQL** handles security rules (Row Level Security), meaning standard users can only edit their own profiles.

### **Backend 2: Firebase (Real-time Tournament TV)**

- Used for: **Live Tournaments & "Umpire Mode".**
- Firebase's Realtime Database/Firestore is exceptionally fast. It is used exclusively to stream live scores instantly to the `Live Tournament Dashboard` without users needing to refresh the page.

---

## 2. Who are the Admins?

Admin emails are securely stored in **GitHub Secrets** (specifically, the `VITE_ADMIN_EMAILS` environment variable) so they cannot be scraped from the public code.

To add or remove an admin:

1. Go to the GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**
2. Edit the `VITE_ADMIN_EMAILS` secret.
3. Add the email to the comma-separated list (e.g., `...,newadmin@gmail.com`).
4. Run a `git push` or manually trigger a GitHub Action deployment to update the live website.

---

## 3. What Can Admins Do?

As an admin, when you log into the website using one of the authorized Google accounts, you unlock hidden features:

### A. Profile Moderation

When a new user signs up, their profile is **hidden** from the public directory by default.

- **How to approve**: Log in, navigate to the **Players Directory**. You will see unapproved players with a pulsing orange **"Pending"** badge. Click on their card, and click the **"Approve Profile Now"** button in the yellow banner at the top.

### B. Profile Deletion

If someone creates a spam profile or leaves the club:

- **How to delete**: Go to their profile page. As an admin, you will see a red **Trash** icon in the top right corner of their banner. Clicking it performs a "soft-delete", immediately removing them from the public directory and leaderboard.

### C. Umpire Mode (Live Tournament Admin)

Admins have access to the hidden `/tournament/admin` page (accessible via the tiny dot `·` next to the copyright text in the footer). Here, admins can update live scores during tournaments.

---

## 4. Admin Panel Features

The **Site Admin** page (`/admin`) provides tools to manage announcements, events, flyers, and other site-wide content.

### A. Announcements

**Access**: Site Admin → **Announcements** tab

Announcements appear in the status banner at the top of all pages and notify users about important events.

**Fields**:
- **Title**: The announcement headline
- **Publish Date**: When to start showing the announcement
- **Category**: One of `tournament`, `facility`, `general`, or `event`
- **Priority**: 
  - `high` - Shows in status banner and pushes to all users
  - `medium` - Shows in status banner only
  - `low` - Only shown in the Feed
- **Location** (Optional): Where the announcement applies
- **Start/End Date** (Optional): For time-limited announcements
- **Content**: Markdown-supported text, can include images and attachments

**Actions**:
- Click **"Send Push"** to notify all users immediately via push notification
- Announcements marked as `category: tournament` or `priority: high` appear in the status banner

**Important Announcements**: To make an announcement appear at the top of the Feed, set `priority: high`.

### B. Flyers

**Access**: Site Admin → **Flyers** tab

Flyers are scrolling marquee banners that appear at the top of all pages (excluding when closed by users).

**Fields**:
- **Background Color**: CSS gradient class (e.g., `from-violet-600 to-fuchsia-600`)
- **Items**: Text snippets to display in the scrolling marquee
- **Item Color**: Text color class for each item

**Example**: "Tournament Registration Open" or "Facility Closure This Weekend"

**Tips**:
- Keep text short and eye-catching
- Use multiple items for variety (they repeat in a scrolling loop)
- Users can close flyers individually; closed flyers don't re-appear

### C. Events

**Access**: Site Admin → **Events** tab

Display upcoming tournaments, workshops, and special events.

**Fields**:
- **Date**: Event date
- **Title**: Event name
- **Link**: Registration or details URL
- **Registration Deadline**: Last day to register

**Visibility**: Events appear in the Events page (`/events`) and are sorted by date.

### D. Holiday Closures

**Access**: Site Admin → **Holidays** tab

Mark facility closure dates on the calendar.

**Fields**:
- **Date**: Closure date
- **Name**: Reason (e.g., "Diwali Break", "Maintenance")

**Visibility**: Appears on the calendar and in the status banner during closure periods.

### E. Settings

**Access**: Site Admin → **Settings** tab

Configure site-wide settings like logo, color scheme, and emergency notices.

---

## 5. How to Host a Tournament

Hosting a tournament requires moving from Google Forms to Brackets, and finally to Live Scores. Follow these steps:

### Phase 1: Registration

1. Create a Google Form to collect registrations. Ask for: Name, Partner Name (if doubles), Department, Contact Number, and Category (e.g., MS, MD, XD).
2. Export the Google Form responses to a CSV file.

### Phase 2: Generating Brackets

1. Go into the `Bracket_Generator` folder in this repository.
2. Use the provided Python scripts to ingest the CSV and automatically generate the tournament brackets and seedings.
3. The script will output a structured JSON file (e.g., `tournament.json`) containing all the matches, rounds, and formats.

### Phase 3: Pushing Brackets to the Website

1. Open your **Firebase Console**.
2. Go to your Firestore Database.
3. Navigate to the `live_data/tournament` document.
4. Replace the old JSON data with the new JSON data generated in Phase 2.
5. _Instantly_, the `Live Tournament Dashboard` on the website will populate with the new bracket!

### Phase 4: Umpiring & Updating Scores

On the day of the tournament:

1. Have your umpires/admins log into the website.
2. Scroll to the bottom footer and click the tiny blue dot `·` to enter **Tournament Admin** mode.
3. **Select Format**: e.g., Men's Singles (MS).
4. **Select Match**: Choose the specific match happening on court.
5. **Update Scores**: Click the big `+` and `-` buttons as points are scored.
6. **Push to Live TV**: Every time you click "PUSH TO LIVE TV", the new score is instantly beamed to everyone watching the Live Tournament Dashboard on their phones.
7. **Complete Match**: When the match finishes, change the status to "Completed", select the Winner, and push. The system will automatically advance the winner to the next round in the bracket!
