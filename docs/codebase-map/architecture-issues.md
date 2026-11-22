# Potential Architecture Issues

## Large Files / High Coupling
Files with >20 imports. They might be doing too much:
- `client/src/App.tsx` (78 imports)
- `client/src/pages/PlayerProfile.tsx` (38 imports)
- `client/src/pages/SiteAdmin.tsx` (25 imports)
- `client/src/components/admin/TournamentManager.tsx` (21 imports)
- `client/src/components/tournament/LiveTab.tsx` (39 imports)

