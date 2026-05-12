import { Link } from 'wouter';
import { Mail, MapPin, Phone, Instagram, Youtube } from 'lucide-react';

export default function Footer() {
  const quickLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/events', label: 'Events' },
    { href: '/winners', label: 'Winners Wall' },
    { href: '/announcements', label: 'Announcements' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <footer className="bg-blue-900 text-white mt-16">
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-orange-500" />

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* Brand + Social */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-emerald-400">IISc Badminton Club</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Promoting excellence in badminton through competitive play,
              training, and community engagement at the Indian Institute of Science.
            </p>
            <div className="flex gap-3 pt-1">
              <a
                href="https://www.instagram.com/iisc.badminton/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-pink-500 flex items-center justify-center transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com/@iiscbadmintonclub"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition-colors"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-emerald-400">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {quickLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href}>
                    <span className="text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer">
                      {label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-emerald-400">Contact</h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 items-start">
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-gray-300">IISc Gymkhana, Bangalore, India</span>
              </div>
              <div className="flex gap-2 items-center">
                <Mail className="w-5 h-5 text-emerald-400 shrink-0" />
                <a
                  href="mailto:office.gym@iisc.ac.in"
                  className="text-gray-300 hover:text-emerald-400 transition-colors"
                >
                  office.gym@iisc.ac.in
                </a>
              </div>
              <div className="flex gap-2 items-center">
                <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-gray-300">+91 (080) 2293 xxxx</span>
              </div>
            </div>
          </div>

          {/* Facilities */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-emerald-400">Facilities</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>✓ 3 Indoor Courts</li>
              <li>✓ Synthetic Mat Flooring</li>
              <li>✓ Professional Lighting</li>
              <li>✓ Tournament Hosting</li>
              <li>✓ Open to All Members</li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-blue-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} IISc Badminton Club. All rights reserved.
              {/* Hidden admin doorway */}
              <Link href="/farewell/admin">
                <span className="text-blue-900 ml-1 select-none">·</span>
              </Link>
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-emerald-400 transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-emerald-400 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
