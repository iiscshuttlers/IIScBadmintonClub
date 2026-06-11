
import {
  ShieldCheck,
  Users,
  Activity,
  Trophy,
  Sparkles,
  Smartphone,
  BarChart3,
  BookOpen,
  PlayCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { InfoModal } from "@/components/InfoModal";
export function GlossarySection() {

  const features = [
    {
      category: "Social & Networking",
      icon: <Users className="w-8 h-8 text-blue-500" />,
      color: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50",
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
          desc: "Swipe right on any match in the feed to instantly give Kudos to your friends.",
        },
      ],
    },
    {
      category: "Site Architecture & Navigation",
      icon: <BookOpen className="w-8 h-8 text-cyan-500" />,
      color: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-900/50",
      items: [
        {
          title: "Tiered Events Megahub",
          desc: "Centralized tournament calendar, live broadcasts, and brackets all neatly nested within the unified Events directory.",
        },
        {
          title: "Unified Media Gallery",
          desc: "Seamlessly browse beautiful photo albums and match videos. Video highlights feature glowing tournament tags for easy sorting.",
        },
        {
          title: "Global Quick-Actions",
          desc: "Log new matches from anywhere on the platform with the persistent '+ Log Match' utility.",
        },
      ],
    },
    {
      category: "Player Analytics",
      icon: <BarChart3 className="w-8 h-8 text-emerald-500" />,
      color: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50",
      items: [
        {
          title: "Doubles Synergy",
          desc: "Advanced algorithm calculating your mathematically best doubles partner.",
          modal: {
            title: "DOUBLES SYNERGY EXPLAINED",
            mainIcon: <Activity className="w-5 h-5" />,
            items: [
              { badge: "CALC", title: "Synergy Score", desc: "A score from 0-100 based on your win-rate when playing alongside a specific partner." },
              { badge: "REQ", title: "Threshold", desc: "You must play at least 3 matches with the same partner before a synergy score is generated." },
            ],
            footer: <p className="text-xs text-slate-500">Find your best partner and dominate the courts!</p>
          }
        },
        {
          title: "Head-to-Head",
          desc: "Deep point-differential tracking and dynamic rivalry taunts between opponents.",
        },
        {
          title: "Elo Ranking",
          desc: "Global and dynamic player ranking system with 'Unranked' calibration phases.",
          modal: {
            title: "HOW ELO RANKING WORKS",
            mainIcon: <BarChart3 className="w-5 h-5" />,
            items: [
              { badge: "SYS", title: "The Elo System", desc: "A method used to calculate relative skill. Beating a high-ranked player grants you significantly more points than beating a low-ranked one." },
              { badge: "CAL", title: "Calibration Phase", desc: "New players remain 'Unranked' for their first 5 matches to determine their true baseline." },
              { badge: "VOL", title: "Volatility", desc: "Your rank fluctuates wildly in your first 20 matches. It stabilizes as you play more." },
              { badge: "PTS", title: "Point Difference", desc: "Winning 21-5 rewards slightly more ELO than winning 21-19. Every point matters!" }
            ]
          }
        },
      ],
    },
    {
      category: "Gamification",
      icon: <Trophy className="w-8 h-8 text-amber-500" />,
      color: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50",
      items: [
        {
          title: "Monthly Leaderboards",
          desc: "Compete for the Highest Elo and Most Active Player each month.",
        },
        {
          title: "Dynamic Badges",
          desc: "Unlock exclusive profile badges like Giant Slayer, Clean Sweep, and Ironman.",
          modal: {
            title: "ACHIEVEMENT BADGES",
            mainIcon: <Trophy className="w-5 h-5" />,
            items: [
              { badge: "IRON", title: "Ironman Endurance", desc: "Awarded for playing an exceptionally high number of matches in a single month (usually 50+)." },
              { badge: "SLAY", title: "Giant Slayer", desc: "Awarded when you defeat an opponent whose Elo ranking is significantly higher than yours." },
              { badge: "SWP", title: "Clean Sweep", desc: "Awarded for winning a match without letting the opponent score more than 5 points." }
            ]
          }
        },
        {
          title: "Profile Customization",
          desc: "Showcase your identity with Discord-style profile banners and walkout Anthems.",
        },
      ],
    },
    {
      category: "Video Analysis Tools",
      icon: <PlayCircle className="w-8 h-8 text-indigo-500" />,
      color: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/50",
      items: [
        {
          title: "Telestrator Draw Mode",
          desc: "Hold two fingers to pause and draw lines directly on the video for coaching and analysis.",
        },
        {
          title: "Pinch & Pan",
          desc: "Pinch with two fingers to zoom in on tight line calls or footwork, then drag to pan.",
        },
        {
          title: "Precision Scrubbing",
          desc: "Swipe horizontally anywhere to smoothly scrub through the timeline frame-by-frame.",
        },
        {
          title: "A-B Loop Repeat",
          desc: "Double tap with two fingers to instantly set a 10-second repeating loop for studying specific rallies.",
        },
      ],
    },
    {
      category: "Match Playback Controls",
      icon: <PlayCircle className="w-8 h-8 text-sky-500" />,
      color: "bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-900/50",
      items: [
        {
          title: "Speed Dial",
          desc: "Rotate two fingers on the video to smoothly adjust playback speed from 0.25x to 2x.",
        },
        {
          title: "Chapter Skipping",
          desc: "Tap the extreme left or right edge of the video to jump to the next match chapter.",
        },
        {
          title: "Instant Timestamp Share",
          desc: "Swipe diagonally to automatically copy the current timestamp link.",
        },
        {
          title: "Swipe to Close",
          desc: "A quick, long swipe straight down dismisses the player instantly.",
        },
        {
          title: "Boss Mode",
          desc: "Swipe down with three fingers to instantly drop brightness and mute the audio.",
        },
      ],
    },
    {
      category: "Mobile Native (PWA)",
      icon: <Smartphone className="w-8 h-8 text-purple-500" />,
      color: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/50",
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
          desc: "Instantly generate and share 'Spotify Wrapped' style Match Recap cards.",
        },
      ],
    },
    {
      category: "Platform Moderation",
      icon: <ShieldCheck className="w-8 h-8 text-rose-500" />,
      color: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/50",
      items: [
        {
          title: "Overwatch Tribunal",
          desc: "Automated flagging of highly suspicious match scores or massive Elo upsets.",
          modal: {
            title: "OVERWATCH TRIBUNAL",
            mainIcon: <ShieldCheck className="w-5 h-5" />,
            items: [
              { badge: "FLAG", title: "Suspicious Activity", desc: "If a low-ranked player suddenly beats a top 5 player 21-0, the system automatically flags the match." },
              { badge: "REV", title: "Admin Review", desc: "Flagged matches do not affect global rankings until verified by a club administrator." }
            ]
          }
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
    <div className="w-full bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-5xl pb-24 md:pb-8">

      <div className="columns-1 lg:columns-2 gap-6">
        {features.map((section, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={section.category}
            className={`p-6 md:p-8 rounded-3xl border shadow-sm break-inside-avoid mb-6 inline-block w-full ${section.color}`}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                {section.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {section.category}
              </h2>
            </div>
            
            <div className="space-y-6">
              {section.items.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                        {item.title}
                      </h4>
                      {item.modal && (
                        <InfoModal
                          title={item.modal.title}
                          items={item.modal.items}
                          mainIcon={item.modal.mainIcon}
                          footer={item.modal.footer}
                        />
                      )}
                    </div>
                    <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
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
    </div>
  );
}
