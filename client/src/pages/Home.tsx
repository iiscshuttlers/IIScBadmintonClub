import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowRight, Trophy, Users } from 'lucide-react';
import iiscTeam from "@/assets/iisc-team.jpg";

/**
 * Home Page
 * Design: Dynamic Sports Energy - Hero section with action shot, asymmetric layout
 * Features: Hero banner, key highlights, call-to-action sections
 */
export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-900 text-white">
        {/* Diagonal divider at bottom */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 1200 600" preserveAspectRatio="none">
            <polygon points="0,0 1200,0 1200,400 0,600" fill="white" />
          </svg>
        </div>

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
              <div className="inline-block">
                <span className="bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  Welcome to Excellence
                </span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                IISc Badminton Club
              </h1>
              <p className="text-xl text-gray-200 leading-relaxed">
                Experience the thrill of competitive badminton. Join our vibrant community of players, from beginners to champions, all united by passion for the sport.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/about">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg font-semibold flex items-center gap-2 w-full sm:w-auto justify-center">
                    Learn More <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold w-full sm:w-auto">
                    Get In Touch
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Image / Animated Logo */}
            <div className="relative animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
              <div className="relative rounded-lg overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-300 bg-slate-800 aspect-square flex items-center justify-center">
                
                {/* Inserted Animated Logo Component */}
                <AnimatedLogo />

                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"></div>
              </div>
              {/* Accent element */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-500 rounded-full opacity-20 blur-3xl z-[-1]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Highlight 1 */}
            <div className="text-center p-8 rounded-lg bg-gradient-to-br from-emerald-50 to-blue-50 hover:shadow-lg transition-shadow duration-300 border border-emerald-200">
              <div className="inline-block p-4 bg-emerald-500 rounded-full mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-blue-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                Championships
              </h3>
              <p className="text-gray-600">
                Host and participate in inter-college tournaments and national championships throughout the year.
              </p>
            </div>

            {/* Highlight 2 */}
            <div className="text-center p-8 rounded-lg bg-gradient-to-br from-blue-50 to-orange-50 hover:shadow-lg transition-shadow duration-300 border border-blue-200">
              <div className="inline-block p-4 bg-blue-900 rounded-full mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-blue-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                Community
              </h3>
              <p className="text-gray-600">
                Join a diverse community of badminton enthusiasts and build lasting friendships.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-20 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-blue-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Why Join Us?
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-emerald-500 to-orange-500 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-emerald-500 text-white">
                    <span className="text-xl">✓</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-blue-900">State-of-the-Art Facilities</h4>
                  <p className="text-gray-600 mt-2">
                    Access to 3 professional indoor courts with synthetic mat on wooden floors and modern lighting.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-900 text-white">
                    <span className="text-xl">✓</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-blue-900">Regular Events</h4>
                  <p className="text-gray-600 mt-2">
                    Participate in friendly matches, tournaments, and inter-college competitions.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative rounded-lg overflow-hidden shadow-xl">
              <img
                src={iiscTeam}
                alt="IISc Badminton Team"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            Ready to Join Our Club?
          </h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Whether you're a seasoned player or just starting out, there's a place for you in the IISc Badminton Club.
          </p>
          <Link href="/contact">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-6 text-lg font-semibold">
              Get Started Today
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}


// ==========================================
// The Animated Logo Component
// ==========================================
function AnimatedLogo() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible">

      {/* Scaling wrapper */}
      <div className="relative w-[420px] h-[420px] transform scale-[0.7] sm:scale-[0.8] md:scale-90 lg:scale-100 flex-shrink-0 transition-transform">

        {/* ONLY Circle Logo (black box removed) */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-950 to-slate-900 shadow-2xl border-[8px] border-slate-950 flex flex-col items-center justify-center overflow-hidden ring-[6px] ring-amber-500 z-0">

          {/* Subtle Grid */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f59e0b" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* IISc text */}
          <div className="absolute top-16 left-0 right-0 text-center z-10">
            <h1 className="text-7xl font-black text-white tracking-wider">
              IIS<span className="text-amber-400">c</span>
            </h1>
          </div>

          {/* Center Logo Area */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <img
              src={`${import.meta.env.BASE_URL}iisc-logo.png`}
              alt="IISc Club Logo"
              className="w-[220px] h-[220px] object-contain"
            />
          </div>

          {/* Bottom Text */}
          <div className="absolute bottom-14 left-0 right-0 text-center z-10">
            <h2 className="text-2xl font-bold text-amber-500 tracking-[0.25em] uppercase">
              Badminton
            </h2>

            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="w-8 h-[2px] bg-white/40"></div>
              <h3 className="text-lg font-semibold text-slate-100 tracking-[0.4em] uppercase">
                Club
              </h3>
              <div className="w-8 h-[2px] bg-white/40"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}