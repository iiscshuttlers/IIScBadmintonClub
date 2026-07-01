/**
 * Shared "Follow / Stay Informed" social CTA block.
 * Used on Announcements, Gallery, and Contact pages.
 * Pass variant="compact" for the small inline layout (Gallery bottom).
 */
import { Instagram, Youtube } from "lucide-react";

interface SocialCTAProps {
  variant?: "card" | "compact";
  /** Override the Instagram handle shown (default: @badminton.iisc) */
  instagramHandle?: string;
}

export function SocialCTA({
  variant = "card",
  instagramHandle = "@badminton.iisc",
}: SocialCTAProps) {
  const instagramUrl = "https://www.instagram.com/badminton.iisc/";
  const youtubeUrl =
    "https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7";

  if (variant === "compact") {
    return (
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-pink-500 to-orange-500 text-foreground px-6 py-3.5 rounded-full font-bold shadow-lg hover:shadow-pink-200 dark:hover:shadow-pink-900/30 hover:-translate-y-0.5 transition-all duration-300"
        >
          <Instagram className="w-5 h-5" />
          {instagramHandle}
        </a>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-foreground px-6 py-3.5 rounded-full font-bold shadow-lg hover:shadow-red-200 dark:hover:shadow-red-900/30 hover:-translate-y-0.5 transition-all duration-300"
        >
          <Youtube className="w-5 h-5" />
          YouTube
        </a>
      </div>
    );
  }

  // card variant — dark gradient card with hero-pattern
  return (
    <div className="bg-gradient-to-br from-blue-900 to-primary/80 text-foreground p-6 md:p-10 rounded-3xl shadow-xl relative overflow-hidden">
      <div className="absolute inset-0 hero-pattern" />
      <div className="relative z-10">
        <h2
          className="text-2xl font-black mb-2"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Follow Our Journey
        </h2>
        <p className="text-gray-300 text-sm mb-6 max-w-lg">
          Catch the latest match highlights, event photos, and community moments
          on our social channels.
        </p>

        <div className="flex flex-wrap gap-3">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-md"
          >
            <Instagram className="w-4 h-4" />
            Follow on Instagram
          </a>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-md"
          >
            <Youtube className="w-4 h-4" />
            YouTube Channel
          </a>
        </div>
      </div>
    </div>
  );
}
