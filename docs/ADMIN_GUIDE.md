# IISc Shuttlers Admin Guide

This guide covers all administrative features and operations.

**Access Level**: Admins only (role: `admin`)

---

## Table of Contents

1. [Admin Access](#admin-access)
2. [Dashboard Overview](#dashboard-overview)
3. [User Management](#user-management)
4. [Tournament Management](#tournament-management)
5. [Content Management](#content-management)
6. [Analytics & Reporting](#analytics--reporting)
7. [System Settings](#system-settings)
8. [Moderation](#moderation)
9. [Maintenance](#maintenance)
10. [Admin Logs & Audit](#admin-logs--audit)

---

## Admin Access

### Gaining Admin Access

1. **Database/Backend**: Contact the system administrator
2. **Admin role** must be assigned in Supabase authentication
3. **Verify access**: Log in and see "Admin" tab

### Admin Authentication

- **Requires**: Admin email + password
- **MFA**: Recommended for security
- **Session timeout**: 1 hour of inactivity
- **Logout**: Tap profile → Logout

---

## Dashboard Overview

### Admin Home Screen

**When you log in as admin**, you see:

1. **Quick Stats** (top):
   - Total registered users
   - Active users this month
   - Total matches logged
   - Active tournaments

2. **Recent Activity**:
   - Latest matches
   - New user signups
   - Tournament updates

3. **Alerts**:
   - System issues
   - Pending disputes
   - Low-priority tasks

4. **Navigation Tabs**:
   - Dashboard (current)
   - Users
   - Tournaments
   - Content
   - Analytics
   - Settings

---

## User Management

### View All Users

1. **Tap "Users" tab**
2. **See paginated list** of all registered users
3. **Sort by**:
   - Registration date
   - Last active
   - ELO rating
   - Number of matches

4. **Search** by email, nickname, or ID

### User Details

**Tap any user** to see:
- Profile information
- Email address
- Registration date
- Last login
- ELO ratings (all categories)
- Match history
- Buddy list
- Achievements
- Account status (active/inactive/suspended)
- **Actions**: Edit, Suspend, Delete, Reset Password

### Edit User Profile

1. **Open user details**
2. **Tap "Edit Profile"**
3. **Can modify**:
   - Nickname
   - Gender
   - Level
   - Avatar
   - Email
   - Account status

4. **Tap "Save"**
5. **Confirmation email** sent to user (if email changed)

### Suspend User Account

**When to suspend**:
- Violating terms of service
- Abusive behavior
- Disputed match
- Pending review

**To suspend**:
1. **Open user details**
2. **Tap "Suspend Account"**
3. **Reason**: Select from list
4. **Duration**: Temporary (7/30 days) or permanent
5. **Notify user**: Send notification explaining suspension
6. **Confirm**

**Effects**:
- User cannot log in
- Match history remains visible
- Leaderboard position frozen
- Cannot create new matches

### Delete User Account

**Permanent action** - use with caution!

1. **Open user details**
2. **Scroll down → "Delete Account"**
3. **Confirm twice**:
   - Admin password
   - Type "DELETE"
4. **Effects**:
   - Account permanently deleted
   - Data may be archived for 90 days
   - Cannot be recovered
   - Match history anonymized

### Reset User Password

1. **Open user details**
2. **Tap "Reset Password"**
3. **Temporary password generated**
4. **Sent to user's email**
5. **User must change on first login**

### View User Activity

1. **Open user details**
2. **Tap "Activity Log"**
3. **See**:
   - All matches logged
   - Profile edits
   - Logins
   - Settings changes
   - Reported actions

---

## Tournament Management

### Create Tournament

1. **Tap "Tournaments" tab**
2. **Tap "Create Tournament"**
3. **Enter details**:
   - **Name**: Tournament title (required)
   - **Description**: Rules and details
   - **Format**: Single Elimination, Double Elimination, Round Robin
   - **Start Date & Time**: When tournament begins
   - **End Date & Time**: When tournament ends
   - **Max Participants**: Cap on entries (0 = unlimited)
   - **Registration Deadline**: When signups close
   - **Location**: Court/venue (if applicable)
   - **Entry Fee**: Cost (if applicable)
   - **Prizes**: Prize information (if applicable)

4. **Tap "Create"**
5. **Status**: Defaults to "draft"

### Edit Tournament

1. **Select tournament**
2. **Tap "Edit"**
3. **Modify details** (limited while ongoing)
4. **Note**: Cannot change format or dates once started
5. **Save changes**

### Tournament Lifecycle

**States**:
1. **Draft**: Setup, registration open
2. **Ongoing**: Matches being played
3. **Completed**: Tournament finished

**Status changes**:
1. **Start tournament**: Move from Draft → Ongoing
2. **End tournament**: Move to Completed
3. **Cancel tournament**: Delete if in draft

### Manage Registrations

1. **Open tournament**
2. **Tap "Participants"**
3. **See list** of registered players
4. **Actions**:
   - **Accept**: Confirm registration
   - **Reject**: Remove from tournament
   - **Seed**: Assign bracket position
   - **Remove**: Drop player (removes from bracket)

### View Bracket

1. **Open tournament**
2. **Tap "Bracket"**
3. **See tournament structure**:
   - Rounds (semifinals, finals, etc.)
   - Matchups
   - Winners
   - Pending matches

4. **Edit bracket**:
   - Reassign matches (before match played)
   - Manually advance player
   - Declare forfeit

### Record Match Results

**For matches without live scoring**:
1. **Open tournament → Bracket**
2. **Tap pending match**
3. **Enter score**
4. **Tap "Confirm Result"**
5. **Winner automatically advanced**
6. **Bracket updates**

---

## Content Management

### Create Announcement

1. **Tap "Content" tab**
2. **Tap "Announcements" → "New"**
3. **Enter**:
   - Title
   - Body text
   - Image (optional)
   - Start date
   - End date
   - Notify users (checkbox)

4. **Preview** and confirm
5. **Publish**

**Notifications sent** to all users if "Notify" checked

### Send Push Notifications

**Broadcast to all users**:
1. **Tap "Notifications"**
2. **Tap "Send Broadcast"**
3. **Enter**:
   - Title (max 50 chars)
   - Body (max 240 chars)
   - Action URL (where clicking notification goes)
   - Icon (optional)

4. **Preview on device**
5. **Send**

**Send to specific users**:
1. **Tap "Send to Users"**
2. **Select users** (search/checkboxes)
3. **Enter message**
4. **Send**

### Manage Gallery

1. **Tap "Content" → "Gallery"**
2. **Actions**:
   - **Upload images**: Tap "Upload" or drag-and-drop
   - **Organize**: Drag to reorder
   - **Tag**: Add tournament/event tags
   - **Create album**: Group related images
   - **Delete**: Remove images (archived for 30 days)

3. **Bulk actions**:
   - Select multiple
   - Add tag to all
   - Delete all
   - Download all as zip

---

## Analytics & Reporting

### Dashboard Analytics

**Key metrics**:
- **Total Users**: All-time registered
- **Active Users**: Last 30 days
- **Total Matches**: All-time logged
- **Avg Matches/Month**: Growth rate
- **Tournaments**: Active, completed, upcoming
- **User Retention**: % returning weekly

### Detailed Reports

1. **Tap "Analytics"**
2. **Select report type**:
   - **User Growth**: New signups over time
   - **Match Activity**: Matches logged over time
   - **ELO Distribution**: Histogram of player ratings
   - **Category Performance**: MS/WS/MD/WD/XD activity
   - **Geographic**: Users by location (if available)
   - **Device**: iOS vs Android usage

3. **Customize**:
   - Date range
   - Filters
   - Chart type (line, bar, pie)

4. **Export**: As CSV or PDF

### User Engagement

1. **Tap "Analytics" → "Engagement"**
2. **Metrics**:
   - Daily active users
   - Weekly active users
   - Session duration
   - Feature usage (which features used most)
   - Retention (% returning after 1 day, 7 days, 30 days)

### Match Analytics

1. **Tap "Analytics" → "Matches"**
2. **Breakdown**:
   - By format (MS, WS, MD, WD, XD)
   - By skill level
   - By gender
   - Average match duration
   - Most common opponents

---

## System Settings

### Site Configuration

1. **Tap "Settings"**
2. **Site Name**: Display name of app/club
3. **Logo**: Upload club logo
4. **Contact Email**: Support email
5. **Phone**: Club phone number
6. **Location**: Club address/coordinates
7. **Timezone**: For timestamps

### Feature Flags

**Enable/disable features** for all users:

1. **Tap "Settings" → "Features"**
2. **Available toggles**:
   - [ ] Tournaments enabled
   - [ ] Buddy system enabled
   - [ ] Video upload enabled
   - [ ] Tournament ELO multipliers enabled
   - [ ] Cross-gender singles enabled
   - [ ] Mixed category rankings enabled

3. **Toggle** on/off
4. **Changes apply immediately**

### Maintenance Mode

**When updating server**:
1. **Tap "Settings" → "Maintenance"**
2. **Enable "Maintenance Mode"**
3. **Set message**: "System under maintenance..."
4. **Whitelist admins**: Admins can still access
5. **Disable when done**

**User experience during maintenance**:
- See maintenance message
- Cannot create new matches
- Can view cached data
- Queued matches preserved

### Email Configuration

1. **SMTP server settings** (for sending emails)
2. **From email**: Where notifications come from
3. **Email templates**: Customize notification emails
4. **Test email**: Send test to verify

### Security Settings

1. **Password policy**:
   - Minimum length
   - Special characters required
   - Expiration (if enabled)

2. **Session timeout**: Inactivity logout duration
3. **IP whitelist**: Restrict admin access to IPs
4. **2FA enforcement**: Require multi-factor auth for admins

---

## Moderation

### Dispute Resolution

**When players dispute a match**:
1. **Tap "Moderation" → "Disputes"**
2. **See pending disputes**:
   - Match details
   - Dispute reason
   - Players' statements

3. **Investigate**:
   - View match details
   - Check players' history
   - Review evidence (if provided)

4. **Resolve**:
   - Uphold match
   - Void match (remove ELO changes)
   - Reverse score
   - Warn player
   - Suspend player

5. **Notify parties**: Send resolution explanation

### Flag Inappropriate Content

**Users can flag content**:
- Profiles
- Comments
- Images
- Match records

**To review flags**:
1. **Tap "Moderation" → "Flags"**
2. **Review flagged content**
3. **Take action**:
   - Dismiss flag
   - Delete content
   - Warn user
   - Suspend user

### Player Suspensions

**Review active suspensions**:
1. **Tap "Moderation" → "Suspensions"**
2. **See all suspended accounts**:
   - Reason for suspension
   - Duration remaining
   - Actions taken

3. **Unsuspend** if ready to restore
4. **Extend** suspension if needed
5. **Make permanent** if necessary

---

## Maintenance

### Data Backup

1. **Tap "Settings" → "Backup"**
2. **Backup options**:
   - Full database backup
   - Users only
   - Matches only
   - Analytics only

3. **Frequency**: Set automatic backup schedule
4. **Retention**: How long to keep backups
5. **Download**: Can download any past backup

### Database Maintenance

1. **Tap "Settings" → "Database"**
2. **Available tasks**:
   - **Optimize tables**: Improve query performance
   - **Recalculate ELO**: Recompute all ELO ratings
   - **Cleanup orphaned data**: Remove incomplete records
   - **Rebuild search indexes**: Improve search speed
   - **Vacuum database**: Reclaim space

3. **Schedule**: Typically run during off-hours
4. **Monitor**: See progress and status

### ELO Recalculation

**If ELO calculations are wrong**:
1. **Tap "Settings" → "Database"**
2. **Tap "Recalculate ELO"**
3. **Scope**:
   - All users
   - Specific user
   - Specific time period

4. **Review changes**: Before confirming
5. **Execute**: Start recalculation
6. **Monitor**: See progress
7. **Verify**: Check accuracy after completion

---

## Admin Logs & Audit

### Admin Activity Log

**Track all admin actions**:
1. **Tap "Logs" → "Admin Activity"**
2. **See all admin operations**:
   - User edited/suspended/deleted
   - Matches modified
   - Tournament created/changed
   - Settings changed
   - Reports generated

3. **Filter by**:
   - Admin user
   - Action type
   - Date range
   - Entity (user, match, tournament)

4. **Export** as CSV for audit purposes

### System Logs

**Technical logs for debugging**:
1. **Tap "Logs" → "System"**
2. **See**:
   - Errors and exceptions
   - Performance warnings
   - API errors
   - Database errors

3. **Filter by**:
   - Log level (error, warning, info)
   - Component
   - Time range

4. **Export** for analysis

### User Access Log

**Track user logins**:
1. **Tap "Logs" → "Access"**
2. **See**:
   - User login times
   - Device type
   - IP address
   - Session duration
   - Failed login attempts

3. **Identify suspicious activity**:
   - Multiple failed logins
   - Logins from unusual locations
   - Unusual times

---

## Common Admin Tasks

### Verify a Match

**When score seems wrong**:
1. Go to match details
2. Verify both players agree
3. Check against tournament bracket
4. Review video if available
5. If error found, void match or correct

### Handle Duplicate Accounts

**If user has multiple accounts**:
1. Identify duplicates
2. Verify which is main account
3. Merge data if needed
4. Delete duplicate
5. Notify user

### Fix ELO Error

**If single player's ELO is wrong**:
1. Review their match history
2. Recalculate ELO from scratch
3. Verify scores are correct
4. Notify player of correction
5. Log the correction

### Reset Leaderboard

**For seasonal resets**:
1. Backup current leaderboard data
2. Tap "Settings" → "Reset Leaderboard"
3. Choose:
   - Reset all (clear all ELO)
   - Seasonal soft reset (75% of current ELO)
   - By category
4. Notify all users
5. Verify results

---

## Security Best Practices

1. **Use strong password**: 16+ characters, mixed case, numbers, symbols
2. **Enable 2FA**: Use authenticator app
3. **Regular backups**: Before major operations
4. **Least privilege**: Only give necessary permissions
5. **Audit logs**: Review regularly for suspicious activity
6. **Secure communications**: Use HTTPS always
7. **Don't share credentials**: Personal logins only
8. **Logout when done**: Especially on shared devices

---

## Troubleshooting

### Can't access admin panel?
- Verify admin role assigned in backend
- Check browser cache and cookies
- Try incognito/private window
- Contact system administrator

### ELO calculations seem wrong?
- Run manual recalculation
- Check for recent bug fixes
- Review match dispute logs
- Verify match scores are accurate

### Notifications not sending?
- Check notification system status
- Verify Firebase configuration
- Review notification logs
- Test with broadcast to self

### Slow performance?
- Check database size
- Run "Optimize tables" task
- Review slow query logs
- Consider database scaling

---

## Support & Contact

**For admin support**:
- **Email**: admin-support@iiscshuttlers.github.io
- **Emergency**: urgent@iiscshuttlers.github.io
- **Internal documentation**: /docs/admin-internal.md

