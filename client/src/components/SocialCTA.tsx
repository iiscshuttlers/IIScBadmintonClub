/**
 * Shared "Follow / Stay Informed" social CTA block.
 * Used on Announcements, Gallery, and Contact pages.
 * Pass variant="compact" for the small inline layout (Gallery bottom).
 */
import { Instagram, Youtube } from 'lucide-react';

interface SocialCTAProps {
  variant?: 'card' | 'compact';
  /** Override the Instagram handle shown (default: @badminton.iisc) */
  instagramHandle?: string;
}

export function SocialCTA({ variant = 'card', instagramHandle = '@badminton.iisc' }: SocialCTAProps) {
  const instagramUrl = 'https://www.instagram.com/badminton.iisc/';
  const youtubeUrl = 'https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7';

  if (variant === 'compact') {
    return (
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-3.5 rounded-full font-bold shadow-lg hover:shadow-pink-200 dark:hover:shadow-pink-900/30 hover:-translate-y-0.5 transition-all duration-300"
        >
          <Instagram className="w-5 h-5" />
          {instagramHandle}
        </a>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-3.5 rounded-full font-bold shadow-lg hover:shadow-red-200 dark:hover:shadow-red-900/30 hover:-translate-y-0.5 transition-all duration-300"
        >
          <Youtube className="w-5 h-5" />
          YouTube
        </a>
      </div>
    );
  }

  // card variant — dark gradient card with hero-pattern
  return (
    <div className="bg-gradient-to-br from-blue-900 to-emerald-900 text-white p-8 md:p-10 rounded-3xl shadow-xl relative overflow-hidden">
      <div className="absolute inset-0 hero-pattern" />
      <div className="relative z-10">
        <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          Stay Informed
        </h2>
        <p className="text-gray-300 text-sm mb-6 max-w-lg">
          Tournament updates, court notices, and club news — don't miss a thing.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 space-y-1.5">
            <p className="font-bold text-white text-sm">📱 WhatsApp</p>
            <p className="text-gray-300 text-xs leading-relaxed">
              Visit the badminton hall notice board to join the official WhatsApp group.
            </p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 space-y-1.5">
            <p className="font-bold text-white text-sm">📸 Instagram</p>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-300 font-bold hover:text-emerald-200 transition-colors text-xs"
            >
              {instagramHandle} →
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-md"
          >
            <Instagram className="w-4 h-4" />
            Follow on Instagram
          </a>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-md"
          >
            <Youtube className="w-4 h-4" />
            YouTube Channel
          </a>
        </div>
      </div>
    </div>
  );
}
