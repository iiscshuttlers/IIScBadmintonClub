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
              <p className="text-muted-foreground dark:text-muted-foreground mt-1">Effective Date: June 15, 2026 · Last Updated: June 16, 2026</p>
            </div>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground dark:text-slate-300">
            <p>
              Welcome to the IISc Badminton Club ("we", "us", or "our") Platform. We are committed to protecting your personal 
              information and your right to privacy. This Privacy Policy explains what information we collect, how we use it, and what rights 
              you have in relation to it.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">1. Information We Collect</h3>
            <p>
              We collect personal information that you voluntarily provide to us when you register on the platform. This may include:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Personal Details:</strong> Name, email address, department, profile picture (avatar), and gender.</li>
              <li><strong>Badminton Profile:</strong> Playing level, dominant hand, playing style, favorite shots, racket details, and match statistics.</li>
              <li><strong>Activity Data:</strong> Match logs, scores, Elo rating changes, and interaction with other players (e.g., following, buddies).</li>
              <li><strong>Device Information:</strong> Device type, operating system version, and push notification tokens (only when you opt into notifications).</li>
              <li><strong>Usage Analytics:</strong> Pages visited and feature usage via Google Analytics (anonymized, no personally identifiable information).</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">2. How We Use Your Information</h3>
            <p>We use the information we collect or receive to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Facilitate account creation and authentication via Supabase Auth and email/password sign-in.</li>
              <li>Calculate competitive statistics, Elo ratings, leaderboard rankings, and match history.</li>
              <li>Provide personalized experiences, such as "Buddy" matchmaking, rivalry analytics, and player comparisons.</li>
              <li>Communicate with you regarding your matches, buddy requests, and platform updates via push notifications (with your explicit opt-in consent).</li>
              <li>Improve the platform based on aggregated, anonymized usage data.</li>
              <li>Enforce our <Link href="/terms"><span className="text-primary dark:text-primary font-bold hover:underline cursor-pointer">Terms of Service</span></Link> and prevent misuse.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">3. Third-Party Services & SDKs</h3>
            <p>
              Our platform integrates with the following third-party services. Each has its own privacy policy governing your data:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Supabase</strong> — Database hosting, authentication, and real-time data. Your account data (email, profile) is stored on Supabase servers. <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" className="text-primary dark:text-primary hover:underline">Supabase Privacy Policy</a></li>
              <li><strong>Google Analytics</strong> — Anonymized usage tracking to understand how our platform is used. No personally identifiable information is sent. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-primary dark:text-primary hover:underline">Google Privacy Policy</a></li>
              <li><strong>Firebase</strong> — Used for real-time tournament bracket updates. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noreferrer" className="text-primary dark:text-primary hover:underline">Firebase Privacy Policy</a></li>
              <li><strong>Capacitor (Ionic)</strong> — Framework for native mobile app features like haptics and sharing. No user data is sent to Ionic. <a href="https://ionic.io/privacy" target="_blank" rel="noreferrer" className="text-primary dark:text-primary hover:underline">Ionic Privacy Policy</a></li>
              <li><strong>YouTube (Embedded)</strong> — Match videos are embedded from YouTube. YouTube's privacy policy applies when you view videos. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-primary dark:text-primary hover:underline">Google Privacy Policy</a></li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">4. Data Sharing and Disclosure</h3>
            <p>We do not sell, trade, or rent your personal data to third parties. We may share your data only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Service Providers:</strong> With third-party service providers (listed above) solely to perform functions necessary for operating our application.</li>
              <li><strong>Public Profile:</strong> Your badminton profile (name, stats, match history, avatar) is visible to other registered users of the platform. This is a core feature of the competitive tracking system.</li>
              <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental authority, we may disclose your information to comply with legal obligations.</li>
              <li><strong>Platform Administrators:</strong> Club administrators may access user data for moderation and dispute resolution purposes.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">5. Data Security</h3>
            <p>
              We implement reasonable technical and organizational measures to protect your personal data, including:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>All data is transmitted over HTTPS (TLS encryption).</li>
              <li>Authentication is managed by Supabase Auth with industry-standard security practices including bcrypt password hashing.</li>
              <li>Row-Level Security (RLS) is enforced at the database level to ensure users can only access data they are authorized to see.</li>
              <li>The Android app enforces HTTPS-only communication via network security configuration.</li>
              <li>Sensitive credentials are not stored in client-side code.</li>
            </ul>
            <p>
              However, no method of electronic storage or transmission over the internet is 100% secure. While we strive to protect your data, 
              we cannot guarantee its absolute security.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">6. Local Storage & Cookies</h3>
            <p>
              Our platform uses browser local storage and session storage to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Maintain your authentication session.</li>
              <li>Store your theme preference (light/dark mode) and accent color choice.</li>
              <li>Remember notification preferences.</li>
            </ul>
            <p>We do not use third-party tracking cookies. Google Analytics uses its own cookies as described in their privacy policy.</p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">7. Push Notifications</h3>
            <p>
              Push notifications are entirely optional. You must explicitly opt in to receive them. You can manage your notification 
              preferences at any time from the app settings. Your device push token is stored securely and used solely for delivering 
              notifications you have consented to receive. You can revoke notification permissions at any time through your device settings.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">8. Children's Privacy</h3>
            <p>
              Our Service is not directed to children under the age of 13. We do not knowingly collect personal information from children 
              under 13. If you are a parent or guardian and believe your child has provided us with personal data, please contact us and we 
              will take steps to delete such information from our systems.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">9. Your Rights</h3>
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data stored on our platform.</li>
              <li><strong>Correction:</strong> Update or correct inaccurate personal data via your profile settings.</li>
              <li><strong>Deletion:</strong> Request permanent deletion of your account and personal data at any time via the <Link href="/delete-account"><span className="text-primary dark:text-primary font-bold hover:underline cursor-pointer">Delete Account</span></Link> page, or by contacting us directly.</li>
              <li><strong>Portability:</strong> Request your data in a machine-readable format by contacting our administrators.</li>
              <li><strong>Withdrawal of Consent:</strong> Withdraw consent for data processing at any time (this may limit your ability to use certain features).</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">10. Data Retention</h3>
            <p>
              We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, or as required by law. 
              Upon account deletion:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>30-Day Grace Period:</strong> When you delete your account, it is first "soft-deleted" and hidden from the public directory. Your data is retained securely for 30 days, allowing you to easily restore your profile if you change your mind.</li>
              <li><strong>Permanent Deletion:</strong> After the 30-day grace period, your player profile, avatar, and personal details are permanently and irreversibly deleted from our active databases.</li>
              <li>Your match history records may be retained in an anonymized form for statistical integrity of the platform's competitive data.</li>
              <li>Your push notification tokens are immediately deleted upon your initial deletion request.</li>
              <li>Deletion logs are retained for administrative audit purposes.</li>
            </ul>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">11. International Data Transfers</h3>
            <p>
              Your data may be stored and processed on servers located outside of India (Supabase infrastructure). By using the Service, 
              you consent to the transfer of your information to these servers, which maintain appropriate security measures.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">12. Changes to This Policy</h3>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy 
              on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically.
            </p>

            <h3 className="text-xl font-bold text-foreground dark:text-foreground mt-8 mb-4">13. Contact Us</h3>
            <p>
              If you have questions or comments about this policy, your privacy rights, or wish to exercise your data rights, please contact us at:
              <br /><br />
              <strong>IISc Badminton Club</strong><br />
              Indian Institute of Science, Bangalore 560012, India<br />
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
