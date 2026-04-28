import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Bell, Pin } from 'lucide-react';

/**
 * Announcements Page
 * Design: Dynamic Sports Energy - Club announcements and news
 */
export default function Announcements() {
  const [showPinnedAnnouncements, setShowPinnedAnnouncements] = useState(true);
  const [showRecentAnnouncements, setShowRecentAnnouncements] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const pinnedAnnouncements = [
    {
      id: 1,
      title: 'Rhapsody 2026 Registration Open',
      date: 'April 25, 2026',
      category: 'tournament',
      priority: 'high',
      content: 'Registration is now open for Rhapsody 2026, our annual inter-college badminton championship. Register your team by May 15th. Limited slots available!'
    },
    {
      id: 2,
      title: 'New Court Timings - Summer Schedule',
      date: 'April 20, 2026',
      category: 'facility',
      priority: 'high',
      content: 'Courts will operate on summer schedule starting May 1st. Morning sessions: 6:00 AM - 10:00 AM. Evening sessions: 5:00 PM - 10:20 PM.'
    },
  ];

  const recentAnnouncements = [
    {
      id: 3,
      title: 'Beginner Training Camp Success',
      date: 'April 18, 2026',
      category: 'training',
      priority: 'normal',
      content: 'Our recent beginner training camp concluded successfully with 30+ participants. Thanks to all coaches and volunteers who made it possible!'
    },
    {
      id: 4,
      title: 'Inter-Hostel Championship Results',
      date: 'April 15, 2026',
      category: 'tournament',
      priority: 'normal',
      content: 'Congratulations to Team Himalaya for winning the Inter-Hostel Championship 2026! Special mention to Team Cauvery for runners-up position.'
    },
    {
      id: 5,
      title: 'Equipment Maintenance Schedule',
      date: 'April 12, 2026',
      category: 'facility',
      priority: 'normal',
      content: 'Court 2 will be closed for maintenance on April 30th from 10:00 AM - 2:00 PM. Courts 1 and 3 will remain open for play.'
    },
    {
      id: 6,
      title: 'New Shuttlecocks Available',
      date: 'April 10, 2026',
      category: 'general',
      priority: 'normal',
      content: 'Premium Yonex Aerosensa shuttlecocks are now available at the club. Members can purchase them at subsidized rates from the front desk.'
    },
    {
      id: 7,
      title: 'Monthly Ladder Tournament - May',
      date: 'April 8, 2026',
      category: 'tournament',
      priority: 'normal',
      content: 'May ladder tournament sign-ups are open! Compete with players at your level and climb the rankings. Register by April 30th.'
    },
    {
      id: 8,
      title: 'Gymkhana Holiday - May 1st',
      date: 'April 5, 2026',
      category: 'general',
      priority: 'normal',
      content: 'All courts will be closed on May 1st (Labour Day) as per Gymkhana holiday schedule. Courts will resume normal operations on May 2nd.'
    },
  ];

  const categories = [
    { id: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
    { id: 'tournament', label: 'Tournaments', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'training', label: 'Training', color: 'bg-orange-100 text-orange-700' },
    { id: 'facility', label: 'Facilities', color: 'bg-blue-100 text-blue-700' },
    { id: 'general', label: 'General', color: 'bg-purple-100 text-purple-700' },
  ];

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.id === category);
    return cat ? cat.color : 'bg-gray-100 text-gray-700';
  };

  const filteredRecentAnnouncements = selectedCategory === 'all'
    ? recentAnnouncements
    : recentAnnouncements.filter(ann => ann.category === selectedCategory);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                Announcements & News
              </h1>
              <p className="text-xl text-gray-200 max-w-2xl">
                Stay updated with the latest news, events, and important information from IISc Badminton Club.
              </p>
            </div>
            <button
              onClick={() => setAdminMode(!adminMode)}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {adminMode ? '🔓 Admin Mode' : '🔒 Admin Mode'}
            </button>
          </div>
          
          {adminMode && (
            <div className="mt-6 flex gap-4 bg-white/10 p-4 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPinnedAnnouncements}
                  onChange={(e) => setShowPinnedAnnouncements(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Show Pinned Announcements</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRecentAnnouncements}
                  onChange={(e) => setShowRecentAnnouncements(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Show Recent Announcements</span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Pinned Announcements */}
      {showPinnedAnnouncements && pinnedAnnouncements.length > 0 && (
        <section className="py-16 bg-gradient-to-r from-orange-50 to-blue-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-blue-900 mb-8 flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Pin className="w-8 h-8 text-orange-500" />
              Pinned Announcements
            </h2>
            <div className="space-y-4">
              {pinnedAnnouncements.map((announcement) => (
                <Card key={announcement.id} className="border-2 border-orange-300 bg-white hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Pin className="w-5 h-5 text-orange-500 flex-shrink-0" />
                          <CardTitle className="text-blue-900 text-xl">{announcement.title}</CardTitle>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-emerald-500" />
                            <span>{announcement.date}</span>
                          </div>
                          <Badge className={getCategoryColor(announcement.category)}>
                            {announcement.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">{announcement.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category Filter */}
      {showRecentAnnouncements && (
        <section className="py-8 bg-white border-b border-gray-200">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap gap-3 justify-center">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : cat.color + ' hover:shadow-md'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent Announcements */}
      {showRecentAnnouncements && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-blue-900 mb-8 flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Bell className="w-8 h-8 text-emerald-500" />
              Recent Announcements
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredRecentAnnouncements.map((announcement) => (
                <Card key={announcement.id} className="border-2 border-emerald-200 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-blue-900 text-lg">{announcement.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        <span>{announcement.date}</span>
                      </div>
                      <Badge className={getCategoryColor(announcement.category)}>
                        {announcement.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm leading-relaxed">{announcement.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Empty State */}
            {filteredRecentAnnouncements.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No announcements found in this category.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Subscribe Section */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-8 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Stay Informed
          </h2>
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border-l-4 border-emerald-500">
            <p className="text-gray-700 mb-4">
              Don't miss important updates! Follow us on Instagram and check back regularly for the latest announcements about events, tournaments, facility updates, and more.
            </p>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <p className="font-semibold text-blue-900 mb-2">📧 For important updates, contact:</p>
              <p className="text-gray-700 text-sm mb-3">badminton@iisc.ac.in</p>
              <p className="font-semibold text-blue-900 mb-2">📱 Follow us on Instagram:</p>
              <p className="text-gray-700 text-sm">@iisc_badminton_club</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
