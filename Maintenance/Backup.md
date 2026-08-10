# Automated Supabase Backups - Setup Guide

I've set up a backup script for your Supabase project! This ensures your database and storage buckets are backed up safely on your local machine.

## Local Backups (Windows Task Scheduler)

I've created a PowerShell script at `scripts/backup.ps1` that uses your existing authenticated Supabase session to safely download the database and all storage files.

To schedule this script to run automatically in the background on your Windows machine:

1. Press the `Windows Key`, type **Task Scheduler**, and hit Enter.
2. In the right pane, click **Create Basic Task...**
3. Name it `Supabase Daily Backup` and click Next.
4. Set the trigger to **Daily** and choose your preferred time.
5. Choose **Start a program** as the action.
6. In the **Program/script** box, type: `powershell.exe`
7. In the **Add arguments** box, type (replace with your actual paths):
   ```
   -ExecutionPolicy Bypass -WindowStyle Hidden -File "E:\Github\IIScBadmintonClub\scripts\backup.ps1"
   ```
8. In the **Start in** box, enter the folder path:
   ```
   E:\Github\IIScBadmintonClub
   ```
9. Click **Finish**.

> [!TIP]
> **Backup Retention**
> The local script is configured to automatically compress the backups into `.zip` files and delete any backups older than 30 days to save disk space! Backups will be saved in the `E:\Github\IIScBadmintonClub\backups\` folder.

## Verification

You can test the local backup script right now by running this command in your terminal:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
```
Check the `backups` folder to ensure your `.zip` archive was generated successfully!

---

## 3. How to Restore from a Backup

If you ever need to restore your database or files from one of your `.zip` backups, the process is very straightforward since you own the raw SQL and files.

### Restoring the Database (Schema and Data)
Inside the `.zip` archive, you will find a `database.sql` file. This contains everything needed to reconstruct your database exactly as it was.

**Option A: Supabase Dashboard (Easy, for small fixes)**
1. Open your `.zip` file and extract `database.sql`.
2. Open the file in a text editor (like VS Code).
3. Copy the relevant SQL queries.
4. Go to your [Supabase Dashboard](https://supabase.com/dashboard) > **SQL Editor**, paste the queries, and click **Run**.

**Option B: Command Line (Fast, for full restores)**
To completely restore the entire database from your local machine to the cloud:
1. Open your terminal in the folder where `database.sql` was extracted.
2. Run the following PostgreSQL command (replace the caps with your actual project details):
```powershell
psql -h aws-0-REGION.pooler.supabase.com -p 6543 -d postgres -U postgres.PROJECT_REF -f database.sql
```
*(You will be prompted for your database password).*

### Restoring Storage Buckets (Images and Documents)
Inside the `.zip` archive, there is a `storage/` folder. This contains subfolders exactly matching your Supabase storage buckets (e.g., `profiles`, `find-lost`).

**Option A: Supabase Dashboard (Easy)**
1. Extract the `.zip` archive.
2. Go to your [Supabase Dashboard](https://supabase.com/dashboard) > **Storage**.
3. Select the bucket you want to restore to.
4. Drag and drop the missing files directly from Windows Explorer into your browser!

**Option B: Supabase CLI (Fast, for bulk restores)**
To upload all files from a specific folder back into its respective bucket automatically:
1. Open your terminal where you extracted the backup.
2. Run the storage copy command in reverse (from your local folder to the remote bucket). Example for the `profiles` bucket:
```powershell
npx supabase storage cp -r ./storage/profiles ss:///profiles --linked --experimental
```
