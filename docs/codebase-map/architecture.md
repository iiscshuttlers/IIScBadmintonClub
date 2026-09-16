# High-Level Architecture

## Overview
This project uses:
- **Frontend Framework**: React 19 + Vite + TypeScript
- **Backend/Database**: Supabase
- **State Management**: Zustand
- **Routing**: Wouter
- **Mobile**: Capacitor
- **Styling**: TailwindCSS

## Project Structure
- `client/src/`: Frontend React application.
  - `components/`: Reusable UI components.
  - `pages/`: Full page views for routing.
  - `lib/`: Utility functions and Supabase clients.
  - `hooks/`: Custom React hooks (React Query, Zustand).
- `server/`: Backend scripts and utilities.
- `android/`: Native capacitor project.
- `supabase/`: Database migrations and Edge functions.
