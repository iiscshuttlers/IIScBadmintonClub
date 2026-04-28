import { Link } from 'wouter';
import { Mail, MapPin, Phone } from 'lucide-react';

/**
 * Footer Component
 * Design: Dynamic Sports Energy - Deep Navy background with Emerald Green accents
 */
export default function Footer() {
  return (
    <footer className="bg-blue-900 text-white mt-16">
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-orange-500"></div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* About */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-emerald-400">
              IISc Badminton Club
            </h3>

            <p className="text-gray-300 text-sm">
              Promoting excellence in badminton through competitive play,
              training, and community engagement at the Indian Institute of Science.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-emerald-400">
              Quick Links
            </h4>

            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/">
                  <span className="text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer">
                    Home
                  </span>
                </Link>
              </li>

              <li>
                <Link href="/about">
                  <span className="text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer">
                    About
                  </span>
                </Link>
              </li>

              <li>
                <Link href="/events">
                  <span className="text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer">
                    Events
                  </span>
                </Link>
              </li>

              <li>
                <Link href="/announcements">
                  <span className="text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer">
                    Announcements
                  </span>
                </Link>
              </li>

              <li>
                <Link href="/gallery">
                  <span className="text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer">
                    Gallery
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-emerald-400">
              Contact
            </h4>

            <div className="space-y-3 text-sm">

              <div className="flex gap-2 items-start">
                <MapPin className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">
                  IISc Gymkhana, Bangalore, India
                </span>
              </div>

              <div className="flex gap-2 items-center">
                <Mail className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <a
                  href="mailto:office.gym@iisc.ac.in"
                  className="text-gray-300 hover:text-emerald-400 transition-colors"
                >
                  office.gym@iisc.ac.in
                </a>
              </div>

              <div className="flex gap-2 items-center">
                <Phone className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span className="text-gray-300">
                  +91 (080) 2293 xxxx
                </span>
              </div>

            </div>
          </div>

          {/* Facilities */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-emerald-400">
              Facilities
            </h4>

            <ul className="space-y-2 text-sm text-gray-300">
              <li>✓ 3 Indoor Courts</li>
              <li>✓ Tournament Hosting</li>
            </ul>
          </div>

        </div>

        {/* Bottom */}
        <div className="border-t border-blue-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">

            <p className="text-gray-400 text-sm">
              © 2026 IISc Badminton Club. All rights reserved.
            </p>

            <div className="flex gap-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-emerald-400 transition-colors">
                Privacy Policy
              </a>

              <a href="#" className="text-gray-400 hover:text-emerald-400 transition-colors">
                Terms of Service
              </a>
            </div>

          </div>
        </div>
      </div>
    </footer>
  );
}