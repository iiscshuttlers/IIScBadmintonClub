import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users } from 'lucide-react';

/**
 * Events Page
 * Design: Dynamic Sports Energy - Showcase of upcoming and past events
 */
export default function Events() {
  const [showUpcomingEvents, setShowUpcomingEvents] = useState(true);
  const [showPastEvents, setShowPastEvents] = useState(true);
  const [adminMode, setAdminMode] = useState(false);

  const upcomingEvents = [
    {
      title: 'Weekly Friendly Matches',
      date: 'Every Tuesday & Thursday',
      time: '6:00 PM - 8:00 PM',
      location: 'IISc Gymkhana Courts',
      participants: 'All Levels',
      description: 'Regular friendly matches for all skill levels. A great way to practice and meet fellow players.',
      status: 'ongoing'
    },
    {
      title: 'Beginner Training Camp',
      date: 'April 28 - May 5, 2026',
      time: '6:00 PM - 7:30 PM',
      location: 'IISc Gymkhana Courts',
      participants: 'Beginners',
      description: 'Intensive training program for beginners. Learn fundamentals, footwork, and basic techniques.',
      status: 'upcoming'
    },
    {
      title: 'Inter-Hostel Championship',
      date: 'May 10-12, 2026',
      time: 'All Day',
      location: 'IISc Gymkhana Courts',
      participants: 'IISc Students',
      description: 'Annual championship featuring teams from different hostels. Exciting competition and prizes.',
      status: 'upcoming'
    },
    {
      title: 'Advanced Players Workshop',
      date: 'May 15-17, 2026',
      time: '7:00 PM - 8:30 PM',
      location: 'IISc Gymkhana Courts',
      participants: 'Advanced',
      description: 'Specialized training for advanced players focusing on competitive strategies and techniques.',
      status: 'upcoming'
    },
    {
      title: 'Rhapsody Badminton Tournament',
      date: 'June 2026 (Dates TBD)',
      time: 'To be announced',
      location: 'IISc Gymkhana Courts',
      participants: 'Inter-College',
      description: 'Our flagship inter-college tournament attracting teams from across Bangalore.',
      status: 'upcoming'
    },
  ];

  const pastEvents = [
    {
      title: 'Spring Championship 2025',
      date: 'March 2025',
      winner: 'Priya Sharma',
      description: 'Successful championship with 40+ participants'
    },
    {
      title: 'Doubles Tournament 2025',
      date: 'February 2025',
      winner: 'Arjun & Neha',
      description: 'Exciting doubles competition with great matches'
    },
    {
      title: 'Coaching Clinic 2024',
      date: 'December 2024',
      winner: 'All Participants',
      description: 'Expert coaching session with national-level coach'
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                Club Events
              </h1>
              <p className="text-xl text-gray-200 max-w-2xl">
                Join us for exciting tournaments, training sessions, and friendly matches throughout the year.
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
                  checked={showUpcomingEvents}
                  onChange={(e) => setShowUpcomingEvents(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Show Upcoming Events</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPastEvents}
                  onChange={(e) => setShowPastEvents(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Show Past Events</span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Events */}
      {showUpcomingEvents && (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Upcoming Events
          </h2>
          <div className="space-y-6">
            {upcomingEvents.map((event, idx) => (
              <Card key={idx} className="border-2 border-emerald-200 hover:shadow-lg transition-shadow overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-2xl font-bold text-blue-900">{event.title}</h3>
                      <Badge className={event.status === 'ongoing' ? 'bg-emerald-500' : 'bg-orange-500'}>
                        {event.status === 'ongoing' ? 'Ongoing' : 'Upcoming'}
                      </Badge>
                    </div>
                    <p className="text-gray-700 mb-4">{event.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-sm font-semibold">{event.date}</p>
                          <p className="text-xs">{event.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-5 h-5 text-orange-500" />
                        <p className="text-sm font-semibold">{event.location}</p>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-5 h-5 text-blue-900" />
                        <p className="text-sm font-semibold">{event.participants}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-blue-50 p-6 md:w-40 flex items-center justify-center border-t md:border-t-0 md:border-l border-emerald-200">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">Event Type</p>
                      <p className="text-lg font-bold text-emerald-600">{event.participants}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Event Categories */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Types of Events We Organize
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-600">Friendly Matches</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">
                  Casual matches to practice and improve. Great for building camaraderie and enjoying the sport in a relaxed environment.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-900">
              <CardHeader>
                <CardTitle className="text-blue-900">Tournaments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">
                  Competitive tournaments including inter-college championships. Test your skills against top players and win exciting prizes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Past Events */}
      {showPastEvents && (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Past Events Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pastEvents.map((event, idx) => (
              <Card key={idx} className="border-l-4 border-emerald-500 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-blue-900">{event.title}</CardTitle>
                  <CardDescription>{event.date}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Winner/Achievement</p>
                    <p className="font-semibold text-emerald-600">{event.winner}</p>
                  </div>
                  <p className="text-gray-700 text-sm">{event.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Event Calendar Info */}
      <section className="py-16 bg-gradient-to-r from-emerald-50 to-orange-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-8 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Stay Updated
          </h2>
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border-l-4 border-emerald-500">
            <p className="text-gray-700 mb-4">
              To stay informed about upcoming events and registrations, follow our social media channels and check back regularly. We announce all events through email and our club communication channels.
            </p>
            <p className="text-gray-700 mb-4">
              For event registration and more details, contact us at:
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900">badminton@iisc.ac.in</p>
              <p className="text-gray-600 text-sm mt-2">+91 (080) 2293 2000</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
