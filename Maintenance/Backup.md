# Automated Supabase Backups - Setup Guide

I've set up a dual-backup strategy for your Supabase project! This ensures your database and storage buckets are backed up both in the cloud and locally.

## 1. Cloud Backups (GitHub Actions)

A GitHub Actions workflow has been created in `.github/workflows/supabase-backup.yml`. It will automatically run every day at midnight (UTC) and save the backup as a downloadable `.zip` artifact in your GitHub repository.

> [!IMPORTANT]
> **Required GitHub Secrets**
> To allow the workflow to connect to your Supabase project, you must add the following secrets in your GitHub repository:
> 1. Go to your repository on GitHub.
> 2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
> 3. Add the following **New repository secrets**:
>    - `SUPABASE_DB_URL`: Your Supabase connection string (e.g., `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`).
>    - `SUPABASE_ACCESS_TOKEN`: (Optional) Personal access token for the CLI. Needed if you want to back up Storage buckets.
>    - `SUPABASE_PROJECT_ID`: (Optional) Your project ref string.
>    - `SUPABASE_DB_PASSWORD`: (Optional) Database password required for linking storage.

Once these secrets are set, the workflow will automatically handle daily backups!

---

## 2. Local Backups (Windows Task Scheduler)

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
