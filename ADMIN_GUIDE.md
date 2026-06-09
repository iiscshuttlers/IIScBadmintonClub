# IISc Shuttlers - Administrator Guide

Welcome to the IISc Shuttlers website admin guide! This document explains how the website works under the hood, what your specific admin powers are, and exactly how to host and manage a live tournament from start to finish.

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

## 4. How to Host a Tournament

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
