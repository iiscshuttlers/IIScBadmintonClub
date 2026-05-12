import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, MapPin, Trophy, Users } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Facilities() {
  usePageMeta({ title: 'Facilities', description: '3 professional indoor badminton courts at IISc Gymkhana with synthetic mat flooring and modern lighting.' });

  const [holidays, setHolidays] = useState<any[]>([]);
  const [nextHoliday, setNextHoliday] = useState<any>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/holidays.json`)
      .then(res => res.json())
      .then(data => {
        setHolidays(data);

        // 🔥 Find next upcoming holiday
        const today = new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });

        const upcoming = data.find((h: any) => h.date >= today);
        setNextHoliday(upcoming);
      })
      .catch(err => console.error("Error loading holidays:", err));
  }, []);

  const facilities = [
    {
      title: 'Indoor Courts',
      description:
        'Three professional-grade wooden courts with synthetic mat flooring and modern lighting designed for training and competitive play.',
      details: [
        'Wooden flooring with synthetic mat',
        'Professional court markings',
        'Bright LED lighting',
        'Tournament-ready environment',
      ],
    },
  ];

  const schedule = [
    { day: 'Monday - Sunday', hours: '6:00 AM - 10:20 PM' },
    { day: 'Gymkhana Holidays', hours: 'Closed' },
  ];

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Our Facilities
          </h1>

          <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto">
            Premium badminton facilities designed to support players at every level.
          </p>
        </div>
      </section>

      {/* Courts + Hours Combined */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

            {/* Courts */}
            <Card className="border-2 border-emerald-100 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2 text-2xl">
                  <Trophy className="w-6 h-6 text-emerald-500" />
                  {facilities[0].title}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <p className="text-gray-700 leading-relaxed">
                  {facilities[0].description}
                </p>

                <ul className="space-y-3">
                  {facilities[0].details.map((detail, i) => (
                    <li key={i} className="flex gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                      <span className="text-gray-700">{detail}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Hours */}
            <Card className="border-2 border-blue-100 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2 text-2xl">
                  <Clock className="w-6 h-6 text-emerald-500" />
                  Operating Hours
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {schedule.map((slot, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-r from-blue-50 to-emerald-50 p-5 rounded-xl"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-blue-900">
                        {slot.day}
                      </span>

                      <span className="text-gray-700 font-medium">
                        {slot.hours}
                      </span>
                    </div>
                  </div>
                ))}

                <p className="text-sm text-red-500">
                  Closed on Gymkhana holidays (see below)
                </p>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      {/* 🔥 COURT CLOSURE DAYS */}
      <section className="py-14 bg-gray-50">
        <div className="container mx-auto px-4 max-w-6xl">

          <h2 className="text-3xl font-bold text-center text-blue-900 mb-10">
            Court Closure Days – 2026
          </h2>

          {/* 🔥 NEW: Next Holiday Highlight */}
          {nextHoliday && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center mb-8 shadow-sm">
              <span className="font-semibold text-blue-900">
                Next Closure:
              </span>{" "}
              {nextHoliday.name} ({nextHoliday.date})
            </div>
          )}

          {/* Existing Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">

            {holidays.map((h, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition p-6 text-center"
              >
                <div className="text-sm text-gray-500">
                  {h.date}
                </div>

                <div className="text-sm font-semibold text-blue-900 mt-2">
                  {h.name}
                </div>
              </div>
            ))}

          </div>

          <div className="mt-8 text-center text-sm text-gray-600">
            * Dates may change as per Government announcements
          </div>

        </div>
      </section>

      {/* Location + Membership Combined */}
      <section className="py-14 bg-gradient-to-r from-emerald-50 to-orange-50">
        <div className="container mx-auto px-4">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

            {/* Location */}
            <Card className="shadow-md border-0">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2 text-2xl">
                  <MapPin className="w-6 h-6 text-emerald-500" />
                  Location
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <div>
                  <h3 className="font-bold text-blue-900 text-lg mb-2">
                    IISc Gymkhana Badminton Courts
                  </h3>

                  <p className="text-gray-700 leading-relaxed">
                    Indian Institute of Science <br />
                    Bangalore - 560012 <br />
                    India
                  </p>
                </div>

                <p className="text-gray-600">
                  Located within the IISc campus with easy access, ample parking,
                  and excellent connectivity.
                </p>

                <a
                  href="https://maps.app.goo.gl/pBTtJGYEPwnu6qd78"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-lg font-semibold transition"
                >
                  Open in Google Maps
                </a>
              </CardContent>
            </Card>

            {/* Membership */}
            <Card className="shadow-md border-0">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2 text-2xl">
                  <Users className="w-6 h-6 text-emerald-500" />
                  Membership & Access
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <h3 className="font-bold text-emerald-700 text-lg mb-2">
                    IISc Members
                  </h3>

                  <p className="text-gray-700 leading-relaxed">
                    Students, faculty, staff, and eligible members can access
                    the badminton facilities through Gymkhana membership.
                  </p>
                </div>

                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <span className="text-gray-700">Full facility access</span>
                  </li>

                  <li className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <span className="text-gray-700">Coaching and training support</span>
                  </li>

                  <li className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <span className="text-gray-700">Tournament participation</span>
                  </li>

                  <li className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <span className="text-gray-700">Join IISc badminton community</span>
                  </li>
                </ul>

              </CardContent>
            </Card>

          </div>
        </div>
      </section>

    </div>
  );
}