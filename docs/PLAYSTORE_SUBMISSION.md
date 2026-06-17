# Google Play Store Submission Guide

**Current Version**: 1.122  
**Target Status**: Ready for submission  
**Estimated Timeline**: 1-2 weeks for review and approval

---

## Pre-Submission Checklist

### ✅ App Requirements

**Functional Requirements**:
- [ ] App launches without crashes
- [ ] All core features working (matches, leaderboard, tournaments)
- [ ] Offline mode functional
- [ ] Push notifications working
- [ ] ELO calculations accurate
- [ ] No critical bugs
- [ ] Data persistence working
- [ ] Network sync functional

**Technical Requirements**:
- [ ] Minimum SDK: Android 8.0 (API 26)
- [ ] Target SDK: Android 14+ (latest)
- [ ] 64-bit support enabled
- [ ] Build type: Release (not debug)
- [ ] ProGuard/R8 minification enabled
- [ ] Signing key properly configured
- [ ] App version incremented (currently 1.122)
- [ ] Bundle ID matches intended package

**Compliance Requirements**:
- [ ] Privacy Policy added
- [ ] Terms of Service added
- [ ] Permissions justified
- [ ] No suspicious permissions
- [ ] GDPR compliant (if EU users)
- [ ] No misleading claims
- [ ] Appropriate content rating

---

## App Assets

### Required Assets

#### 1. App Icon
- **Size**: 512 x 512 pixels (PNG, RGB, no alpha)
- **Format**: PNG with transparent background
- **Safe zone**: 48 dp padding
- **File**: `icon-512.png`
- **Notes**: Must be distinctive, not blurry

**Current status**: ❓ Create if not exists

#### 2. Feature Graphics
- **Size**: 1024 x 500 pixels (minimum)
- **Format**: PNG or JPEG
- **Count**: At least 1, up to 5 recommended
- **Content**: Show key features
- **Files**: 
  - `feature-graphic-1.png` - Overview
  - `feature-graphic-2.png` - Leaderboard
  - `feature-graphic-3.png` - Tournaments
  - `feature-graphic-4.png` - ELO System
  - `feature-graphic-5.png` - Social Features

#### 3. Screenshots
- **Size**: Landscape or portrait (min 1080 x 1920 for phones)
- **Format**: PNG or JPEG
- **Count**: 2-8 screenshots recommended
- **Resolution**: At least 1080 x 1920 for phones
- **Localization**: English (required)

**Essential screenshots**:
- [ ] Home/Feed screen
- [ ] Player profile screen
- [ ] Leaderboard screen
- [ ] Match creation screen
- [ ] Tournament bracket screen
- [ ] Settings/About screen

#### 4. Video Preview
- **Duration**: 15-30 seconds
- **Format**: MP4, WebM, or MOV
- **Resolution**: Up to 3840 x 2160
- **File size**: Max 500 MB
- **Optional but recommended**: Creates higher conversion rates

### Asset Creation Checklist

- [ ] Icon designed and exported
- [ ] Feature graphics created
- [ ] Screenshots captured (from device, not emulator)
- [ ] Text visible and readable on small screens
- [ ] No personal information in screenshots
- [ ] Consistent branding across assets
- [ ] All images properly sized
- [ ] Files named consistently
- [ ] Assets saved in high quality

---

## App Information

### 1. App Title
**Current**: "IISc Shuttlers"
- [ ] Clear and descriptive
- [ ] Under 50 characters
- [ ] No promotional keywords
- [ ] Matches app branding

### 2. Short Description
**Max**: 80 characters

```
Badminton tournament & player rating platform for IISc Badminton Club
```

- [ ] Concise
- [ ] Includes main function
- [ ] Includes target audience
- [ ] No promotional language

### 3. Full Description
**Max**: 4000 characters

```
Welcome to the IISc Badminton Club platform - your ultimate companion 
for badminton competition, player ranking, and community engagement.

KEY FEATURES:
• Player Leaderboard - Real-time ELO-based rankings across multiple formats
• Tournament Management - Create, join, and track tournaments with live brackets
• Match Tracking - Log matches instantly, auto-calculate ELO ratings
• Social Features - Find buddies, track rivalries, follow top players
• Offline Support - Queue matches and sync when back online
• Analytics - View your stats, progression, and head-to-head records
• Admin Tools - Tournament management, player moderation, analytics

FORMATS SUPPORTED:
• Men's Singles (MS)
• Women's Singles (WS)
• Men's Doubles (MD)
• Women's Doubles (WD)
• Mixed Doubles (XD)

ELO RATING SYSTEM:
Track your skill improvement with our accurate ELO rating system. 
Compete in tournaments or friendly matches, view your progression, 
and climb the leaderboard.

TOURNAMENT FEATURES:
• Single/Double elimination brackets
• Round-robin support
• Live bracket updates
• Automated winner announcements
• Dispute resolution system

COMMUNITY:
Join the vibrant badminton community, connect with fellow players, 
and stay updated with club news and events.

PRIVACY:
Your data is secure and private. We respect your privacy with 
HTTPS encryption, secure authentication, and transparent data practices.

REQUIREMENTS:
• Android 8.0 or higher
• Internet connection (optional - offline mode available)
• ~100 MB storage space

For support, contact: support@iiscshuttlers.github.io
```

**Checklist**:
- [ ] Describes app clearly
- [ ] Lists all major features
- [ ] Honest about functionality
- [ ] No exaggeration or false claims
- [ ] Explains target audience
- [ ] Professional tone
- [ ] Includes contact info

---

## Privacy & Security

### Privacy Policy
- [ ] Policy document created
- [ ] Covers data collection
- [ ] Explains third-party services used
- [ ] Details user rights
- [ ] Accessible in app (link in settings)
- [ ] Links provided in Play Store

**Key sections to include**:
- What data is collected
- How data is used
- Third-party services (Supabase, Firebase)
- User rights and deletion
- Cookie policy
- Changes to policy
- Contact for privacy concerns

### Terms of Service
- [ ] Terms document created
- [ ] Covers acceptable use
- [ ] Details intellectual property
- [ ] Includes liability disclaimer
- [ ] Explains account termination
- [ ] Accessible in app
- [ ] Links provided in Play Store

### Permissions Justification
**Permissions requested and why**:

```
INTERNET
→ Required for server communication, authentication, real-time updates

CAMERA
→ Optional: For profile picture upload via device camera

PHOTO_LIBRARY
→ Optional: For selecting profile pictures from gallery

NOTIFICATIONS
→ Optional: For push notifications about matches and tournaments

LOCATION (if applicable)
→ Optional: For geolocation-based features (courts nearby)

STORAGE
→ Required for offline caching and data sync
```

---

## Building Release APK/AAB

### Create Signing Key

**If you don't have a signing key yet**:

```bash
# Windows PowerShell
$alias = "playstore-key"
$keystore = "playstore.jks"
$keypass = "YOUR_SECURE_PASSWORD"

# Run keytool (Java must be installed)
keytool -genkey -v -keystore $keystore `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -alias $alias
```

**Save key location and passwords securely!**

### Create Keystore Properties File

Create `android/keystore.properties`:

```properties
storeFile=PATH_TO_KEYSTORE/playstore.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=playstore-key
keyPassword=YOUR_KEY_PASSWORD
```

**⚠️ Add to .gitignore - NEVER commit!**

### Build Release Bundle

```bash
# Build AAB (recommended for Play Store)
npm run build:aab

# Or build signed APK
npm run build:apk

# Output location:
# AAB: android/app/build/outputs/bundle/release/app-release.aab
# APK: android/app/build/outputs/apk/release/app-release.apk
```

### Verify Build

```bash
# Check file exists
ls -l android/app/build/outputs/bundle/release/app-release.aab

# Check file size (should be 50-200 MB)
# Check signature
jarsigner -verify -verbose -certs app-release.aab
```

---

## Google Play Console Setup

### 1. Developer Account
- [ ] Google Play Developer account created
- [ ] Payment method added ($25 registration fee)
- [ ] Account verified

### 2. Create App

**In Google Play Console**:

1. Click "Create app"
2. Enter app details:
   - **App name**: "IISc Shuttlers"
   - **Default language**: English
   - **App or game**: App
   - **Free or paid**: Free
   - **Category**: Sport
   - **Content rating**: See below

3. Click "Create"

### 3. Content Rating

**Answer Google Play's content rating questionnaire**:

- **Violence**: None/Minimal
- **Sexual content**: None
- **Language**: None
- **Drugs**: None
- **Alcohol**: None
- **Gambling**: None
- **Other restricted content**: None

**Expected rating**: Everyone (ESRB), General Audiences (IARC)

---

## Listing Setup

In Google Play Console → Store listing:

### 1. Basic Information
- [ ] App name
- [ ] Short description (80 chars)
- [ ] Full description
- [ ] Application category: "Sport"
- [ ] Content rating: Fill questionnaire

### 2. Graphic Assets
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (phone):
  - Portrait: 1080x1920 (recommended)
  - Landscape: 2560x1440 (optional)
  - Tablet: 1600x2560 (optional)
- [ ] Video preview (optional but recommended)

### 3. Contact Details
- [ ] Developer email
- [ ] Developer website
- [ ] Support email

### 4. Links
- [ ] Privacy policy URL
- [ ] Terms & conditions URL
- [ ] Website URL (if applicable)

---

## Release Management

### Release Notes

**Create for version 1.122**:

```
Version 1.122 - Initial Release

🎉 Welcome to IISc Shuttlers!

Key Features:
✓ Real-time ELO ratings (5 formats)
✓ Tournament management with live brackets
✓ Match logging and history
✓ Player leaderboard and rankings
✓ Social features (buddies, following, rivalries)
✓ Offline mode with sync
✓ Push notifications
✓ Admin tools for tournament management
✓ Data export (CSV, PDF)

Formats Supported:
• Men's Singles (MS)
• Women's Singles (WS)
• Men's Doubles (MD)
• Women's Doubles (WD)
• Mixed Doubles (XD)

Bug fixes and performance improvements.

Visit: https://iiscshuttlers.github.io
Support: support@iiscshuttlers.github.io
```

---

## Testing Before Submission

### Pre-Submission Testing

- [ ] Test on Android 8.0 device
- [ ] Test on Android 14+ device
- [ ] Test on tablet
- [ ] Test on large phone (6.5"+)
- [ ] Test on small phone (4.5")
- [ ] Portrait orientation
- [ ] Landscape orientation
- [ ] Test with slow internet
- [ ] Test offline mode
- [ ] Test all navigation paths
- [ ] Test all forms
- [ ] Verify no crashes
- [ ] Check data privacy
- [ ] Verify permissions work correctly
- [ ] Test with multiple user accounts

### Beta Testing (Optional but Recommended)

1. Create closed beta test group
2. Add 10-20 testers
3. Run for 1-2 weeks
4. Collect feedback
5. Fix critical issues
6. Progress to staged rollout

---

## Submission Checklist

### Before Uploading AAB

- [ ] Version code incremented
- [ ] Version name matches intended release
- [ ] All assets prepared and sized
- [ ] Privacy policy written and accessible
- [ ] Terms of service written
- [ ] Content rating questionnaire completed
- [ ] Permissions all justified
- [ ] No debug builds
- [ ] No test accounts in code
- [ ] Proper signing key used
- [ ] AAB file generated successfully
- [ ] File size reasonable

### In Google Play Console

- [ ] App created in console
- [ ] Store listing complete
- [ ] Screenshots uploaded (at least 2)
- [ ] Feature graphics uploaded
- [ ] Privacy policy URL set
- [ ] Content rating selected
- [ ] Category set to "Sport"
- [ ] Age rating confirmed
- [ ] Contact details added
- [ ] AAB uploaded
- [ ] Build tested in console

---

## Submission Process

### Step 1: Upload Build

1. Go to **Release → Production**
2. Click **"Create new release"**
3. Upload `app-release.aab`
4. Review app bundle contents
5. Accept warnings (if any)

### Step 2: Review Release

1. Add release notes
2. Set rollout percentage (start 10%)
3. Review all information
4. Confirm you meet policies

### Step 3: Submit for Review

1. Click **"Send for review"**
2. Confirm submission
3. **Review starts automatically**

### Step 4: Wait for Approval

- **Typical review time**: 2-24 hours
- **Max wait**: 7 days
- Check Play Console for status updates
- Email notifications sent on status change

---

## After Approval

### 1. Monitor Launch

- [ ] Check console dashboard
- [ ] Monitor user feedback
- [ ] Watch for crashes in Android Vitals
- [ ] Check analytics

### 2. Rollout Strategy

For v1.122 Initial Release:
```
Day 1: 10% rollout
Day 2: 25% rollout
Day 3: 50% rollout
Day 4: 100% rollout (if no critical issues)
```

### 3. Handle Issues

If critical bugs found:
- Immediate pause rollout
- Fix bug
- Revert to previous version
- Build new release
- Submit for review again

---

## Promotion Strategy

### After App Goes Live

1. **Announce on social media**
   - Post in club groups
   - Share with badminton community
   - Include Play Store link

2. **Email campaign**
   - Send to club members
   - Include install instructions
   - Highlight key features

3. **In-app feedback**
   - Ask users to rate/review
   - Encourage feedback
   - Respond to reviews

4. **Monitor reviews**
   - Respond to all reviews
   - Address concerns
   - Thank positive reviewers

---

## Troubleshooting Submission

### "App not optimized for Android version X"
- Update targetSdk to latest
- Test on that Android version
- Resubmit

### "Failing on core functionality test"
- Review crash logs in console
- Test manually on actual device
- Check permissions
- Resubmit after fix

### "Contains private APIs"
- Review code for private Android API usage
- Use only public APIs
- Resubmit

### "Unsafe data transmission"
- Ensure HTTPS only
- No HTTP connections
- Use secure token storage
- Resubmit

---

## Version Updates

After initial launch, for subsequent versions:

1. Update version code + name
2. Add to changelog.json
3. Update app-version.json
4. Build new AAB
5. Upload to console (new release)
6. Add release notes
7. Submit for review
8. Monitor for approval

---

## Key Dates & Deadlines

- **v1.122 Initial Release**: Ready now
- **Estimated Approval**: 2-5 days after submission
- **First Launch**: Within 1 week
- **Marketing Kickoff**: Same day as launch

---

## Support & Escalation

**If submission is rejected**:
1. Read rejection reasons carefully
2. Check policy violations
3. Make necessary changes
4. Resubmit with explanation

**Contact Google Support**:
- Google Play Developer Help: support.google.com/googleplay
- Policy team: specific email in rejection notice

**Internal escalation**:
- Admin contact: admin@iiscshuttlers.github.io
- Project manager: (add your contact)

---

## Final Checklist Before Hitting "Submit"

- [ ] AAB successfully built
- [ ] All assets uploaded (icon, screenshots, feature graphics)
- [ ] Store listing complete with description
- [ ] Privacy policy and terms available
- [ ] Content rating completed
- [ ] Permissions justified
- [ ] No test/debug content in build
- [ ] Release notes written
- [ ] Rollout strategy decided
- [ ] Team notified
- [ ] Marketing materials ready

---

**Ready to submit!** 🚀

When approved, the app will be available at:
```
https://play.google.com/store/apps/details?id=com.iiscshuttlers.app
```

