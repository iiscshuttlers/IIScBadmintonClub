# Play Store Release Guide - IISc Badminton Club App

## 📋 Pre-Release Checklist

### Version Management
- [x] Version Code: 121 (must be incremented for each release)
- [x] Version Name: 1.121 (semantic versioning)
- [ ] Changelog updated in `app-version.json`

### Code Quality
- [x] TypeScript checks pass (`npm run check`)
- [x] No console errors in production build
- [x] All critical bugs fixed
- [ ] Performance optimized (lighthouse score 80+)

### Security
- [x] HTTPS enforced
- [x] No hardcoded secrets
- [x] Permissions minimized
- [x] Network security config set
- [ ] Privacy Policy linked and accessible
- [ ] Terms of Service linked and accessible

### App Metadata
- [x] App name: "IISc Badminton Club"
- [x] Package name: "com.iiscshuttlers.app"
- [x] Signing configured with release keystore
- [ ] App icon (512x512px, high quality)
- [ ] Feature graphic (1024x500px)
- [ ] Screenshots (4-5, various devices)
- [ ] Short description (80 chars max)
- [ ] Full description (4000 chars max)

### Testing
- [ ] Tested on Android 8.0+ (API 26+)
- [ ] Tested on various screen sizes (4.5", 5.5", 6.5")
- [ ] Tested offline functionality
- [ ] Push notifications working
- [ ] Biometric auth working
- [ ] QR code scanning working
- [ ] All features accessible without errors

### Play Store Configuration
- [ ] Create Google Play Developer account ($25 one-time)
- [ ] Set up app listing
- [ ] Configure privacy policy URL
- [ ] Set up pricing (free)
- [ ] Configure target audience
- [ ] Add content rating
- [ ] Set up release management

## 🔧 Build Commands

### Development APK
```bash
npm run build:apk
# Creates: android/app/build/outputs/apk/debug/*.apk
```

### Release AAB (Recommended for Play Store)
```bash
npm run build:aab
# Creates: android/app/build/outputs/bundle/release/app-release.aab
```

### Manual Signing (if needed)
```bash
# Create keystore
keytool -genkey -v -keystore release.keystore -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore release.keystore app-release.apk alias_name

# Verify signature
jarsigner -verify -verbose -certs app-release.apk
```

## 📱 Permissions Summary

Current permissions requested:
- `INTERNET` - API calls and push notifications
- `POST_NOTIFICATIONS` - Push notification support

No dangerous permissions needed - good for Play Store approval!

## 🎨 App Store Assets Needed

### Icons
- **App Icon** (512×512 PNG, no rounded corners)
- **Feature Graphic** (1024×500 PNG)
- **Screenshots** (4-5 min, 1440×2560 or 1080×1920 PNG)

### Text Content
- **App Name**: IISc Badminton Club (50 chars max)
- **Short Description**: "Live badminton scores, ELO rankings, and match management for IISc" (80 chars max)
- **Full Description**: 
  - Features overview (4000 chars max)
  - Key features list
  - How to use guide
  - Support contact info

## 🔐 Privacy & Legal

### Privacy Policy
- Must be accessible in-app (Settings → Privacy Policy)
- Should cover: data collection, usage, retention, user rights
- URL format: `https://iiscshuttlers.github.io/privacy`

### Terms of Service
- Must be accessible in-app (Settings → Terms)
- Should cover: acceptable use, liability limitations, dispute resolution
- URL format: `https://iiscshuttlers.github.io/terms`

## 📊 Analytics & Monitoring

### Firebase Setup
- [x] Firebase project configured
- [x] Crashlytics enabled
- [x] Analytics tracking
- [x] Performance monitoring

### Key Metrics to Monitor
- Crash rate (should be < 0.1%)
- ANR rate (should be < 0.5%)
- User sessions
- Feature usage
- Error frequencies

## 🚀 Release Process

### Step 1: Prepare Build
```bash
# Update version
# Edit: android/app/build.gradle
# Edit: client/public/data/app-version.json

# Build AAB
npm run build:aab

# Verify build size (should be < 100MB)
# Verify icon presence
```

### Step 2: Test Release Build
```bash
# Install and test locally
adb install app-release.aab

# Test all features:
# - Match logging
# - Offline sync
# - Push notifications
# - QR scanning
# - Biometric auth
# - Dark mode
# - All admin functions
```

### Step 3: Upload to Play Store
1. Create app in Google Play Console
2. Fill out app listing
3. Upload AAB file
4. Set pricing and distribution
5. Review and submit for review

### Step 4: Post-Launch
- Monitor crash reports
- Respond to user reviews
- Track install metrics
- Plan next release

## ⚠️ Common Issues & Solutions

### Issue: App size too large
**Solution**: Enable ProGuard, remove unused dependencies

### Issue: Crashes on specific devices
**Solution**: Check Firebase Crashlytics, test on emulator

### Issue: Slow permissions approval
**Solution**: Request only necessary permissions, update privacy policy

### Issue: Low ratings
**Solution**: Fix reported issues, improve UI/UX

## 📞 Support & Feedback

- **Email**: iiscbadminton@iiscshutllers.com
- **Website**: https://iiscshuttlers.github.io
- **GitHub**: https://github.com/iiscshuttlers

---

**Last Updated**: June 17, 2026
**Status**: Ready for Play Store submission ✅
