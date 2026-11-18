# Potential Architecture Issues

## Large Files / High Coupling
Files with >20 imports. They might be doing too much:
- `client/src/App.tsx` (78 imports)
- `client/src/pages/PlayerProfile.tsx` (36 imports)
- `client/src/pages/SiteAdmin.tsx` (24 imports)
- `client/src/components/admin/TournamentManager.tsx` (22 imports)
- `client/src/components/pulse/LiveTab.tsx` (36 imports)

