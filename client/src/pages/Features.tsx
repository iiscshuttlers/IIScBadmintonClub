import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ShieldCheck,
  Users,
  Activity,
  Trophy,
  Sparkles,
  Smartphone,
  BarChart3,
  Medal,
  Sword,
  Heart,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Features() {
  usePageMeta({
    title: "Platform Features",
    description: "Explore all the features of the IISc Shuttlers platform.",
  });

  const features = [
    {
      category: "Social & Networking",
      icon: <Users className="w-8 h-8 text-blue-500" />,
      color:
        "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50",
      items: [
        {
          title: "Following Feed",
          desc: "Filter your match feed to only see activity from players you follow.",
        },
        {
          title: "Buddy System",
          desc: "Mark close friends as Buddies. See who's online and looking to play.",
        },
        {
          title: "Match Kudos",
          desc: "Swipe right on any match in the feed to instantly give Kudos.",
        },
      ],
    },
    {
      category: "Player Analytics",
      icon: <BarChart3 className="w-8 h-8 text-emerald-500" />,
      color:
        "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50",
      items: [
        {
          title: "Doubles Synergy",
          desc: "Advanced algorithm calculating your mathematically best doubles partner.",
        },
        {
          title: "Head-to-Head",
          desc: "Deep point-differential tracking and dynamic rivalry taunts.",
        },
        {
          title: "Elo Ranking",
          desc: "Global and dynamic player ranking system with 'Unranked' calibration phases.",
        },
      ],
    },
    {
      category: "Gamification",
      icon: <Trophy className="w-8 h-8 text-amber-500" />,
      color:
        "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50",
      items: [
        {
          title: "Monthly Leaderboards",
          desc: "Compete for the Highest Elo and Most Active Player each month.",
        },
        {
          title: "Dynamic Badges",
          desc: "Unlock exclusive profile badges like Giant Slayer, Clean Sweep, and Ironman.",
        },
        {
          title: "Profile Customization",
          desc: "Showcase your identity with Discord-style profile banners and walkout Anthems.",
        },
      ],
    },
    {
      category: "Mobile Native (PWA & APK)",
      icon: <Smartphone className="w-8 h-8 text-purple-500" />,
      color:
        "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/50",
      items: [
        {
          title: "Offline Capabilities",
          desc: "Install the app to your home screen for blazing fast access.",
        },
        {
          title: "Native Haptics",
          desc: "Tactile vibrations when logging matches or swiping.",
        },
        {
          title: "Share Intents",
          desc: "Instantly generate and share 'Spotify Wrapped' style Match Recap cards to Instagram/WhatsApp.",
        },
      ],
    },
    {
      category: "Platform Moderation",
      icon: <ShieldCheck className="w-8 h-8 text-rose-500" />,
      color:
        "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/50",
      items: [
        {
          title: "Overwatch Tribunal",
          desc: "Automated flagging of highly suspicious match scores or massive Elo upsets.",
        },
        {
          title: "Admin Audit Logs",
          desc: "Transparent tracking of all administrative actions taken on the platform.",
        },
        {
          title: "Verified Matches",
          desc: "Strict RLS database rules preventing fake score logging.",
        },
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 md:pb-8">
      <div className="text-center mb-12 mt-8">
        <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 mb-4 tracking-tight">
          Platform Features
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
          Discover everything the IISc Shuttlers platform has to offer, from
          deep analytics to native mobile integrations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {features.map((section, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={section.category}
            className={`p-6 rounded-3xl border shadow-sm ${section.color}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                {section.icon}
              </div>
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                {section.category}
              </h2>
            </div>
            <div className="space-y-4">
              {section.items.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-1">
                    <Sparkles className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">
                      {item.title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
