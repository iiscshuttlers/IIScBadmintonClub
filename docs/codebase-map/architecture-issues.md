# Potential Architecture Issues

## Large Files / High Coupling
Files with >20 imports. They might be doing too much:
- `client/src/App.tsx` (64 imports)
- `client/src/pages/PlayerPersonalPage.tsx` (28 imports)
- `client/src/pages/PlayerProfile.tsx` (33 imports)
- `client/src/pages/SiteAdmin.tsx` (28 imports)

