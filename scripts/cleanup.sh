#!/bin/bash
# Cleanup Script - Remove unnecessary files and caches

echo "🧹 Cleaning up unnecessary files..."

# Remove log files
echo "Removing log files..."
find . -name "*.log" -type f -delete
rm -rf .manus-logs/
rm -rf logs/

# Remove temporary files
echo "Removing temporary files..."
find . -name "*.tmp" -type f -delete
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete

# Remove node_modules (will be regenerated)
echo "Removing node_modules..."
rm -rf node_modules/
rm -rf client/node_modules/
rm -rf server/node_modules/

# Remove build outputs
echo "Removing build outputs..."
rm -rf dist/
rm -rf build/
rm -rf android/app/build/
rm -rf android/app/.gradle/
rm -rf android/.gradle/

# Remove IDE caches
echo "Removing IDE caches..."
rm -rf .idea/
rm -rf .vscode/
rm -rf .turbo/
rm -rf .angular/
rm -rf .next/

# Remove OS files
echo "Removing OS files..."
find . -name ".DS_Store" -delete
find . -name "Thumbs.db" -delete
find . -name "desktop.ini" -delete

# Remove pnpm lock if not needed
# rm -f pnpm-lock.yaml  # Uncomment if using npm instead

# Clean git (dry run)
echo ""
echo "📊 Dry run - Git clean (not executed):"
echo "Would remove: $(git clean -fdn | wc -l) items"
echo ""
echo "To actually clean git: git clean -fd"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📁 Size after cleanup:"
du -sh . 2>/dev/null

echo ""
echo "Next steps:"
echo "1. npm install (reinstall dependencies)"
echo "2. npm run build (rebuild)"
echo "3. npm run cap:sync (sync capacitor)"
