#!/bin/bash
# Play Store Release Build Script

set -e  # Exit on error

echo "🚀 IISc Badminton Club - Play Store Release Build"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get version from package.json
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
BUILD_DATE=$(date +"%Y-%m-%d %H:%M:%S")

echo -e "${BLUE}Version:${NC} $VERSION"
echo -e "${BLUE}Build Date:${NC} $BUILD_DATE"
echo ""

# Step 1: Clean previous builds
echo -e "${BLUE}📝 Step 1: Cleaning previous builds...${NC}"
rm -rf dist/
rm -rf android/app/build/outputs/
echo -e "${GREEN}✓ Cleaned${NC}"
echo ""

# Step 2: Type checking
echo -e "${BLUE}📝 Step 2: Running TypeScript checks...${NC}"
npm run check || { echo -e "${RED}✗ Type check failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Type check passed${NC}"
echo ""

# Step 3: Format code
echo -e "${BLUE}📝 Step 3: Formatting code...${NC}"
npm run format
echo -e "${GREEN}✓ Code formatted${NC}"
echo ""

# Step 4: Build web assets
echo -e "${BLUE}📝 Step 4: Building web assets...${NC}"
npm run build
if [ ! -d "dist" ]; then
    echo -e "${RED}✗ Build failed - dist directory not created${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Web build successful${NC}"
echo ""

# Step 5: Sync Capacitor
echo -e "${BLUE}📝 Step 5: Syncing Capacitor plugins...${NC}"
npx cap sync android
echo -e "${GREEN}✓ Capacitor synced${NC}"
echo ""

# Step 6: Build AAB for Play Store
echo -e "${BLUE}📝 Step 6: Building Release AAB for Play Store...${NC}"
cd android
chmod +x gradlew
./gradlew bundleRelease || { echo -e "${RED}✗ Gradle build failed${NC}"; cd ..; exit 1; }
cd ..
echo -e "${GREEN}✓ AAB build successful${NC}"
echo ""

# Step 7: Verify AAB
echo -e "${BLUE}📝 Step 7: Verifying AAB file...${NC}"
AAB_FILE="android/app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$AAB_FILE" ]; then
    echo -e "${RED}✗ AAB file not found at $AAB_FILE${NC}"
    exit 1
fi

# Check file size
FILE_SIZE=$(du -sh "$AAB_FILE" | cut -f1)
echo -e "File size: ${BLUE}$FILE_SIZE${NC}"

if [ $(stat -f%z "$AAB_FILE" 2>/dev/null || stat -c%s "$AAB_FILE") -gt 157286400 ]; then
    echo -e "${RED}⚠ Warning: AAB larger than 150MB${NC}"
fi

echo -e "${GREEN}✓ AAB verified${NC}"
echo ""

# Step 8: Summary
echo -e "${BLUE}📋 BUILD SUMMARY${NC}"
echo "================="
echo -e "AAB File: ${BLUE}$AAB_FILE${NC}"
echo -e "File Size: ${BLUE}$FILE_SIZE${NC}"
echo -e "Build Date: ${BLUE}$BUILD_DATE${NC}"
echo -e "Version: ${BLUE}$VERSION${NC}"
echo ""

# Step 9: Next steps
echo -e "${GREEN}✅ RELEASE BUILD COMPLETE!${NC}"
echo ""
echo "📱 Next Steps:"
echo "1. Go to Google Play Console"
echo "2. Select your app (shuttlers.iisc.com)"
echo "3. Navigate to Release → Production"
echo "4. Click 'Create new release'"
echo "5. Upload AAB file: $AAB_FILE"
echo "6. Review and submit for production"
echo ""
echo "📊 Monitoring:"
echo "• Check Firebase Crashlytics for crashes"
echo "• Monitor ANR rate (target < 0.5%)"
echo "• Track install growth and ratings"
echo ""
echo "📄 Documentation:"
echo "• Read: PLAYSTORE_GUIDE.md"
echo "• Read: RELEASE_CHECKLIST.md"
echo "• Read: APP_STORE_LISTING.txt"
echo ""
