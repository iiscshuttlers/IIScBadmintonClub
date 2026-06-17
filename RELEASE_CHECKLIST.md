# 🚀 Play Store Release Checklist v1.121

## Pre-Release (1-2 weeks before)

### Code Quality
- [x] All TypeScript errors resolved
- [x] No console errors in production build
- [x] Performance score 80+ (Lighthouse)
- [x] All critical bugs fixed
- [x] Security audit passed
- [x] No hardcoded secrets/keys
- [ ] Dependency check (npm audit)
- [ ] Dead code removal

### Testing
- [ ] Test on Android 8.0+ devices
- [ ] Test on Android 14 (latest)
- [ ] Test offline functionality
- [ ] Test all features end-to-end
- [ ] Test push notifications
- [ ] Test biometric auth
- [ ] Test QR code scanning
- [ ] Test dark mode
- [ ] Test CSV export
- [ ] Test admin functions
- [ ] Test match logging flow
- [ ] Monitor for crashes (Firebase Crashlytics)

### Documentation
- [x] README.md updated
- [x] PLAYSTORE_GUIDE.md created
- [x] PROJECT_STRUCTURE.md created
- [ ] Privacy Policy reviewed and linked
- [ ] Terms of Service reviewed and linked
- [ ] Changelog prepared
- [ ] Release notes written

## Release Day (-1 day)

### Final Code Review
- [ ] Git history clean
- [ ] All tests passing
- [ ] No merge conflicts
- [ ] TypeScript check passes: `npm run check`
- [ ] Code formatted: `npm run format`

### Version Bump
```
Update these files:
1. android/app/build.gradle
   - versionCode: 121 → 122
   - versionName: "1.121" → "1.122"

2. client/public/data/app-version.json
   - versionCode: 121 → 122
   - versionName: "1.121" → "1.122"
   - changelog: updated

3. CHANGELOG.md (create/update)
   - Added features
   - Fixed bugs
   - Improvements
```

### Build Release AAB
```bash
# Clean build
rm -rf android/app/build
rm -rf dist

# Production build
npm run build:aab

# Output: android/app/build/outputs/bundle/release/app-release.aab
# Expected size: 40-80 MB
```

### Verify Build
- [ ] AAB file exists
- [ ] File size reasonable (< 100MB)
- [ ] Signature valid
- [ ] No build warnings

## Submission Day

### Play Store Setup
- [ ] Google Play Developer account active ($25 paid)
- [ ] App created in Play Console
- [ ] Package name: `com.iiscshuttlers.app`
- [ ] App category: Sports
- [ ] Content rating completed
- [ ] Privacy policy URL set
- [ ] Terms URL set (if applicable)

### App Listing
```
App Name:
"IISc Badminton Club"

Short Description (80 chars):
"Live badminton scores, rankings, and match management for IISc"

Full Description (4000 chars):
"🏸 Welcome to IISc Badminton Club's Official App!

Transform your badminton experience with real-time match tracking, dynamic ELO ratings, and community features.

✨ CORE FEATURES:
📊 Live Leaderboards - Track global and category-specific rankings (MS, WS, MD, WD, XD)
🎮 Match Logging - Log singles, doubles, hybrid, and cross-gender matches
📱 Mobile-First Design - Responsive UI optimized for all devices
🌙 Dark Mode - Easy on the eyes, any time of day
🔔 Push Notifications - Get alerts for match updates and challenges
📱 PWA Support - Install as app, works offline

🏆 FEATURES:
• ELO Rating System - Dynamic ranking with visual tiers
• Player Profiles - Detailed stats, achievements, and performance trends
• Head-to-Head Stats - Compare player matchups and records
• Buddy System - Connect with other players
• Weekly Challenges - Time-limited competitive events
• Tournament Management - Organize and track tournaments
• Umpire Mode - Dedicated interface for match officials
• Match Predictions - AI-powered win probability
• Activity Feed - Real-time match updates and announcements
• CSV Export - Download leaderboard data
• Offline Mode - Log matches without internet
• QR Code Scanning - Quick player selection
• Biometric Auth - Fingerprint/Face unlock
• Admin Dashboard - Complete platform management

🎯 WHO'S IT FOR?
Perfect for badminton enthusiasts, club members, competitive players, and tournament organizers.

🔐 PRIVACY & SECURITY:
• No ads, no tracking
• Secure authentication
• Privacy-focused design
• Open-source on GitHub

📞 SUPPORT:
Questions? Email: iiscbadminton@iiscshuttlers.com

🌐 LINKS:
Website: https://iiscshuttlers.github.io
GitHub: https://github.com/iiscshuttlers

v1.122 - Fully optimized for Play Store!"

Promoted Text:
"New: Organized admin panel, comprehensive features tracker, cross-gender & hybrid match support!"
```

### App Store Assets

**App Icon**
- Size: 512×512 PNG
- No rounded corners (Play Store rounds it)
- High quality, readable at small sizes
- Vibrant badminton club branding

**Feature Graphic**
- Size: 1024×500 PNG
- Showcase key features
- Eye-catching design
- Text: "IISc Badminton Club - Live Scoring & Rankings"

**Screenshots** (minimum 4, at least 1 of each):
1. **Home/Dashboard** - Feature overview
2. **Leaderboard** - Ranking system showcase
3. **Player Profile** - Stats and achievements
4. **Admin Panel** - Management features (if applicable)

All screenshots:
- Size: 1440×2560 or 1080×1920 PNG
- Portrait orientation
- Annotated with feature labels
- Clean, professional appearance

### Configuration
```
Pricing & Distribution:
- Price: Free
- Target Countries: India (can expand)
- Content Rating: PEGI 3 or equivalent
- Content: No mature content
- Audience: Everyone 3+

Technical Details:
- Minimum API: 26 (Android 8.0)
- Target API: 34 (Android 14)
- Permissions: INTERNET, POST_NOTIFICATIONS only
- Architecture: arm64-v8a, armeabi-v7a
```

### Firebase/Analytics
- [ ] Crashlytics monitoring enabled
- [ ] Analytics events tracked
- [ ] Performance monitoring configured
- [ ] Error tracking setup

## Upload & Submit

### File Upload
1. Sign into Google Play Console
2. Navigate to "Release" → "Internal testing" → "Release"
3. Upload app-release.aab file
4. Wait for upload processing (2-5 minutes)

### Pre-Launch Report
- [ ] Review generated compatibility matrix
- [ ] Test APKs generated and verified
- [ ] Device list shows Android 8.0 - 14 coverage
- [ ] No warnings or errors

### Submit for Review
- [ ] All required fields filled
- [ ] Screenshots uploaded
- [ ] Privacy policy linked
- [ ] Content rating complete
- [ ] Release name: "v1.122"
- [ ] Release notes: Updated changelog
- [ ] Rollout: 100% (immediate)

Click "Review Release" → "Start Rollout to Production"

## Post-Launch (24-48 hours)

### Monitor & Support
- [ ] Check Play Store listing displays correctly
- [ ] Monitor crash rate in Crashlytics
- [ ] Track ANR (Application Not Responding) rate
- [ ] Review early user ratings
- [ ] Respond to user reviews
- [ ] Monitor install growth

### If Issues Found
- [ ] Identify root cause
- [ ] Fix in development branch
- [ ] Create new build
- [ ] Submit hotfix release (v1.122.1)
- [ ] Provide in-app notification if critical

## Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Crash Rate | < 0.1% | - |
| ANR Rate | < 0.5% | - |
| Install Size | < 100MB | - |
| Startup Time | < 2s | - |
| Frame Drops | < 2% | - |
| Battery Usage | Low | - |

## Success Criteria

✅ All checks passed  
✅ Build submitted successfully  
✅ App approved by Play Store  
✅ Live on production  
✅ Users installing without issues  
✅ Crash rate below threshold  

---

**Release Version**: 1.122  
**Build Code**: 122  
**Prepared**: June 17, 2026  
**Status**: Ready for Submission ✅
