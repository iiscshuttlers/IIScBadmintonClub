import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function TermsOfService() {
  usePageMeta({ title: "Terms of Service", description: "Terms and Conditions for the IISc Badminton Club platform" });

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
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">Terms of Service</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Effective Date: June 2026</p>
            </div>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-slate-600 dark:text-slate-300">
            <p>
              Welcome to the IISc Badminton Club ("we", "us", or "our") platform. By accessing or using our application and website 
              (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, 
              please do not use the Service.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">1. Eligibility</h3>
            <p>
              The Service is intended for members and associates of the Indian Institute of Science (IISc), Bangalore badminton community. 
              You must be at least 13 years of age to create an account. By using the Service, you represent and warrant that you meet 
              these eligibility requirements.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">2. Account Registration</h3>
            <p>To access certain features of the Service, you must register for an account. When you register, you agree to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide accurate, current, and complete information during the registration process.</li>
              <li>Maintain and promptly update your account information to keep it accurate and complete.</li>
              <li>Maintain the security and confidentiality of your login credentials.</li>
              <li>Accept responsibility for all activities that occur under your account.</li>
              <li>Notify us immediately of any unauthorized use of your account.</li>
            </ul>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">3. Acceptable Use</h3>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Violate any applicable laws, regulations, or third-party rights.</li>
              <li>Submit false or misleading match scores, statistics, or player information.</li>
              <li>Harass, abuse, or threaten other users of the platform.</li>
              <li>Impersonate any person or entity, or falsely claim an affiliation.</li>
              <li>Attempt to gain unauthorized access to any portion of the Service or its systems.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Upload content that is unlawful, defamatory, obscene, or otherwise objectionable.</li>
            </ul>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">4. User-Generated Content</h3>
            <p>
              By submitting content to the Service (including match scores, profile information, photos, and "Find & Lost" posts), 
              you grant us a non-exclusive, royalty-free, worldwide license to use, display, and distribute such content within 
              the platform for the purpose of operating the Service. You retain ownership of your content but are responsible for ensuring 
              you have the right to share it.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">5. ELO Ratings & Match Data</h3>
            <p>
              The ELO rating system and match statistics provided by the Service are for informational and recreational purposes only. 
              While we strive for accuracy, we make no guarantees regarding the precision of ratings, rankings, or statistical calculations. 
              Match results are subject to dispute resolution processes managed by platform administrators.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">6. Intellectual Property</h3>
            <p>
              The Service, including its design, code, logos, and branding, is the intellectual property of the IISc Badminton Club and its contributors. 
              You may not reproduce, distribute, or create derivative works from the Service without our prior written consent.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">7. Account Termination</h3>
            <p>
              You may delete your account at any time through the app's "Delete Account" feature or by contacting us. We reserve the right to 
              suspend or terminate your account if we reasonably believe you have violated these Terms. Upon termination, your right to use the 
              Service will immediately cease, and your data will be handled in accordance with our{" "}
              <Link href="/privacy"><span className="text-primary dark:text-primary font-bold hover:underline cursor-pointer">Privacy Policy</span></Link>.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">8. Disclaimers</h3>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. 
              WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. TO THE MAXIMUM EXTENT PERMITTED BY LAW, 
              WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">9. Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE IISC BADMINTON CLUB, ITS VOLUNTEERS, OR CONTRIBUTORS 
              BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO YOUR USE OF 
              OR INABILITY TO USE THE SERVICE. This is a community-operated, non-commercial platform.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">10. Privacy</h3>
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy"><span className="text-primary dark:text-primary font-bold hover:underline cursor-pointer">Privacy Policy</span></Link>, 
              which is incorporated into these Terms by reference.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">11. Modifications to Terms</h3>
            <p>
              We reserve the right to modify these Terms at any time. If we make material changes, we will notify users through the platform. 
              Your continued use of the Service after such modifications constitutes your acceptance of the revised Terms.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">12. Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms 
              shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">13. Contact Us</h3>
            <p>
              If you have any questions about these Terms, please contact us at:
              <br /><br />
              <strong>IISc Badminton Club</strong><br />
              Indian Institute of Science, Bangalore 560012<br />
              Email: <a href="mailto:iiscbadmintonclub@gmail.com" className="text-primary dark:text-primary hover:underline">iiscbadmintonclub@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
