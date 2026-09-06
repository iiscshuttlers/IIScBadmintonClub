import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function PrivacyPolicy() {
  usePageMeta({ title: "Privacy Policy", description: "Privacy Policy for the IISc Badminton Club platform" });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-24 pt-4 lg:pt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link href="/">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary dark:text-primary hover:text-primary dark:hover:text-primary/70 transition-colors cursor-pointer mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </span>
        </Link>
        
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground dark:text-foreground">Privacy Policy</h1>
              <p className="text-muted-foreground dark:text-muted-foreground mt-1">Effective Date: June 15, 2026 · Last Updated: September 2026</p>
            </div>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground dark:text-slate-300">
            <p>
              IISc Badminton Club ("we", "our", or "the app") is the official badminton club app for the Indian Institute of Science (IISc) campus community. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
            </p>
            <p>
              By using the app, you agree to the practices described in this policy.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">1. Information We Collect</h3>
            <p>We collect only what is necessary to run the app:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account information:</strong> Your name, email address, and profile photo (if provided).</li>
              <li><strong>Player profile:</strong> Gender, skill level, preferred racket, and other optional sports-related fields you choose to fill in.</li>
              <li><strong>Match data:</strong> Scores, results, and ELO ratings from matches you log or participate in.</li>
              <li><strong>Device push token:</strong> To send you match confirmations, challenge notifications, and club announcements. You can opt out at any time in Settings.</li>
              <li><strong>Location data:</strong> With your explicit permission, we may collect fine and background location data (via geofencing) to determine when you are near the badminton courts. You can disable this at any time in your device settings.</li>
              <li><strong>Usage data:</strong> Anonymous usage and diagnostic information may be collected to improve app performance and reliability.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">2. How We Use Your Information</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Display your profile, match history, and ELO ranking on the leaderboard.</li>
              <li>Send push notifications for match confirmations, challenges, and announcements (opt-out available).</li>
              <li>Use location data (geofencing) to provide location-based features, such as notifying you when you arrive at the courts.</li>
              <li>Calculate and display ELO ratings and statistics.</li>
              <li>Enable club features: Find & Lost board, buddy system, polls, and live scores.</li>
              <li>Allow admins to manage club operations and review disputes.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">3. Data Sharing</h3>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Supabase</strong> — our database and authentication provider (data stored in secure EU/US servers).</li>
              <li><strong>Firebase / Google FCM</strong> — for delivering push notifications (device token only, no personal data).</li>
              <li>No advertising networks. No third-party analytics beyond anonymous usage stats.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">4. Data Retention</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your account data is retained as long as your account exists.</li>
              <li>Match history is kept permanently as part of the club record.</li>
              <li>If you delete your account, your profile and personal data are removed. Match records may be anonymised rather than deleted to preserve historical statistics.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">5. Your Rights (GDPR / Data Subject Rights)</h3>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Access</strong> — request a copy of your personal data.</li>
              <li><strong>Correction</strong> — update your profile at any time in the app.</li>
              <li><strong>Deletion</strong> — delete your account via Settings → Delete Account. This removes your profile and personal data. Alternatively, users may request account deletion by contacting the club administrator.</li>
              <li><strong>Opt-out of notifications</strong> — toggle individual notification types in Settings.</li>
              <li><strong>Data portability</strong> — contact us to request an export of your data.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">6. Push Notifications</h3>
            <p>
              We use Firebase Cloud Messaging (FCM) to send push notifications. Your device token is stored securely and used only to deliver notifications from IISc Badminton Club. You can disable all or specific notification types in the app's Settings at any time.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">7. Health and Fitness Data</h3>
            <p>
              Our app allows users to track badminton matches, game scores, and sports performance metrics. In accordance with Google Play's policies regarding Health and Fitness apps, we want to provide clear disclosures regarding this data:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>What we collect:</strong> We collect sports activity data strictly in the form of manually entered badminton match logs, game scores, and user-provided playing statistics. We <strong>do not</strong> access or collect biometric data, heart rate, step counts, or connect to centralized health APIs (such as Google Fit or Health Connect).</li>
              <li><strong>How we use it:</strong> This sports activity data is used exclusively to calculate Elo ratings, provide match history records, generate leaderboards, and facilitate the core competitive features of the IISc Badminton Club platform.</li>
              <li><strong>Data sharing:</strong> Match logs and calculated ratings are visible to other registered members of the platform as part of our public leaderboard system. We do not sell, trade, or share this data with third-party advertisers, data brokers, or external health organizations.</li>
              <li><strong>Data deletion:</strong> You may request the deletion of your sports activity data at any time by deleting your account or contacting us.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">8. Children's Privacy</h3>
            <p>
              This app is intended for members of the IISc campus community (students, faculty, staff). We do not knowingly collect data from children under 13. If you believe a child has provided us data, contact us and we will delete it promptly.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">9. Security</h3>
            <p>
              All data is transmitted over HTTPS. Supabase enforces Row Level Security (RLS) so users can only access their own data. Passwords are managed by Supabase Auth and never stored in plain text.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">10. Changes to This Policy</h3>
            <p>
              We may update this policy occasionally. Changes will be reflected by updating the "Last updated" date above. Continued use of the app after changes constitutes acceptance.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">11. Contact Us</h3>
            <p>
              For privacy questions, data requests, or to report a concern, contact the IISc Badminton Club administrator at:<br />
              Email: <a href="mailto:iiscbadmintonclub@gmail.com" className="text-primary dark:text-primary hover:underline">iiscbadmintonclub@gmail.com</a>
            </p>

            <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                Also see our <Link href="/terms"><span className="text-primary dark:text-primary font-bold hover:underline cursor-pointer">Terms of Service</span></Link>
                {" "}and <Link href="/delete-account"><span className="text-primary dark:text-primary font-bold hover:underline cursor-pointer">Delete Account</span></Link> pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
