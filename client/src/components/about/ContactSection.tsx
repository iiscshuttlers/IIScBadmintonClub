import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Mail, MapPin, Phone, ExternalLink, ChevronDown } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SocialCTA } from "@/components/SocialCTA";

const faqs = [
  {
    question: "How do I join the club?",
    answer:
      "IISc students, faculty and staff can access facilities through Gymkhana membership. Visit the Gymkhana office on the 2nd floor of Janta Bazar, IISc.",
    color: "border-primary",
  },
  {
    question: "Do you offer coaching?",
    answer:
      "We do not provide formal coaching, but we have a vibrant community of experienced players across all levels who are happy to help you improve.",
    color: "border-blue-500",
  },
  {
    question: "Can I play tournaments?",
    answer:
      "Yes! Internal tournaments (Spectrum, Invicta), open events (Gandhi Cup), inter-college (IISM), and friendly club matches are conducted regularly.",
    color: "border-orange-500",
  },
  {
    question: "What are the court timings?",
    answer:
      "Courts are open Monday to Sunday, 6:00 AM to 10:20 PM. Closed on Gymkhana holidays. Check the Facilities page for closure dates.",
    color: "border-purple-500",
  },
  {
    question: "How do I register for tournaments?",
    answer:
      "Registrations are announced on this website under Announcements. You can also follow our Instagram page for updates.",
    color: "border-amber-500",
  },
];

function FAQItem({ faq }: { faq: (typeof faqs)[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-l-4 ${faq.color} border border-gray-100 dark:border-slate-700 overflow-hidden transition-all duration-300 ${open ? "shadow-md" : ""}`}
    >
      <button
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <h3 className="font-bold text-blue-900 dark:text-foreground text-sm md:text-base">
          {faq.question}
        </h3>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5">
              <p className="text-muted-foreground dark:text-muted-foreground text-sm leading-relaxed">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ContactSection() {
  return (
    <div className="w-full">
      {/* Contact Cards */}
      <section className="py-16 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 to-teal-50 dark:from-primary/30 dark:to-teal-950/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
                  <Mail className="w-6 h-6 text-foreground" />
                </div>
                <CardTitle className="text-primary dark:text-primary text-base">
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href="mailto:iiscbadmintonclub@gmail.com"
                  className="font-bold text-foreground dark:text-foreground hover:text-primary transition-colors"
                >
                  iiscbadmintonclub@gmail.com
                </a>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2">
                  Best for membership and official queries.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center mb-2">
                  <Phone className="w-6 h-6 text-foreground" />
                </div>
                <CardTitle className="text-orange-700 dark:text-orange-400 text-base">
                  Phone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-foreground dark:text-foreground">
                  +91 (080) 2293 xxxx
                </p>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2">
                  IISc Gymkhana Office
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-blue-900 flex items-center justify-center mb-2">
                  <MapPin className="w-6 h-6 text-foreground" />
                </div>
                <CardTitle className="text-blue-900 dark:text-blue-400 text-base">
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-foreground dark:text-foreground">
                  Gymkhana Office, 2nd Floor
                </p>
                <p className="text-sm text-muted-foreground dark:text-slate-300">
                  Janta Bazar, IISc
                </p>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                  Bengaluru — 560012, India
                </p>
                <a
                  href="https://maps.app.goo.gl/pBTtJGYEPwnu6qd78"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-900 dark:text-blue-400 font-semibold hover:underline"
                >
                  View on Maps <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2
              className="text-3xl font-black text-blue-900 dark:text-foreground"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              Frequently Asked Questions
            </h2>
            <div className="w-12 h-1 bg-gradient-to-r from-primary to-orange-500 mx-auto mt-3 rounded-full" />
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} faq={faq} />
            ))}
          </div>
        </div>
      </section>

      {/* Social + CTA */}
      <section className="py-16 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <SocialCTA />
          </div>
        </div>
      </section>
    </div>
  );
}
