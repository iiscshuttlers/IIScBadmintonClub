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
    color: "border-info",
  },
  {
    question: "Can I play tournaments?",
    answer:
      "Yes! Internal tournaments (Spectrum, Invicta), open events (Gandhi Cup), inter-college (IISM), and friendly club matches are conducted regularly.",
    color: "border-secondary",
  },
  {
    question: "What are the court timings?",
    answer:
      "Courts are open Monday to Sunday, 6:00 AM to 10:20 PM. Closed on Gymkhana holidays. Check the Facilities page for closure dates.",
    color: "border-individual",
  },
  {
    question: "How do I register for tournaments?",
    answer:
      "Registrations are announced on this website under Announcements. You can also follow our Instagram page for updates.",
    color: "border-warning",
  },
];

function FAQItem({ faq }: { faq: (typeof faqs)[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-muted rounded-2xl shadow-sm border-l-4 ${faq.color} border border-border-strong overflow-hidden transition-all duration-300 ${open ? "shadow-md" : ""}`}
    >
      <button
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-muted-strong/50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <h3 className="font-bold text-foreground text-sm md:text-base">
          {faq.question}
        </h3>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
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
              <p className="text-muted-foreground text-sm leading-relaxed">
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
      <section className="py-8 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="border-0 shadow-md bg-gradient-to-br from-primary/30 to-team/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-1">
                  <Mail className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle className="text-primary text-base">
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href="mailto:iiscbadmintonclub@gmail.com"
                  className="font-bold text-foreground hover:text-primary transition-colors break-all"
                >
                  iiscbadmintonclub@gmail.com
                </a>
                <p className="text-sm text-muted-foreground mt-1">
                  Best for membership and official queries.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-gradient-to-br from-secondary/10 to-warning/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-1">
                  <Phone className="w-6 h-6 text-foreground" />
                </div>
                <CardTitle className="text-secondary text-base">
                  Phone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-foreground">
                  +91 (080) 2293 xxxx
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  IISc Gymkhana Office
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-gradient-to-br from-info/10 to-info/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center mb-1">
                  <MapPin className="w-6 h-6 text-foreground" />
                </div>
                <CardTitle className="text-info text-base">
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-foreground">
                  Gymkhana Office, 2nd Floor
                </p>
                <p className="text-sm text-soft">
                  Janta Bazar, IISc
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bengaluru — 560012, India
                </p>
                <a
                  href="https://maps.app.goo.gl/pBTtJGYEPwnu6qd78"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm text-info font-semibold hover:underline"
                >
                  View on Maps <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2
              className="text-3xl font-black text-foreground"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              Frequently Asked Questions
            </h2>
            <div className="w-12 h-1 bg-gradient-to-r from-primary to-secondary mx-auto mt-3 rounded-full" />
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} faq={faq} />
            ))}
          </div>
        </div>
      </section>

      {/* Social + CTA */}
      <section className="py-8 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <SocialCTA />
          </div>
        </div>
      </section>
    </div>
  );
}
