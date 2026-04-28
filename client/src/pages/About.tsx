import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, MapPin, Trophy, Users, Shield } from 'lucide-react';

/**
 * Facilities Page
 * Redesigned:
 * - Removes excessive vertical whitespace
 * - Better visual flow
 * - Premium layout
 * - Map + Membership integrated
 */

export default function Facilities() {
  const facilities = [
    {
      title: 'Indoor Courts',
      description:
        'Three professional-grade wooden badminton courts with synthetic mat surface, modern lighting, and spacious playing area.',
      details: [
        'Wooden flooring with synthetic mat',
        'Tournament standard court markings',
        'High-quality LED lighting',
        'Comfortable spectator space',
      ],
    },
  ];

  const schedule = [
    { day: 'Monday - Sunday', hours: '6:00 AM – 10:20 PM' },
    { day: 'Gymkhana Holidays', hours: 'Closed' },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* HERO */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Our Facilities
          </h1>

          <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto">
            Premium badminton infrastructure designed for recreation,
            training, and competitive excellence.
          </p>
        </div>
      </section>

      {/* COURTS + HOURS */}
      <section className="py-14 bg-gray-50">
        <div className="container mx-auto px-4">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

            {/* Courts */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-blue-900 text-2xl flex gap-2 items-center">
                  <Trophy className="w-6 h-6 text-emerald-500" />
                  {facilities[0].title}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <p className="text-gray-700 leading-relaxed">
                  {facilities[0].description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {facilities[0].details.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hours */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-blue-900 text-2xl flex gap-2 items-center">
                  <Clock className="w-6 h-6 text-emerald-500" />
                  Operating Hours
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {schedule.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-emerald-50 px-5 py-4 rounded-xl"
                  >
                    <span className="font-semibold text-blue-900">
                      {slot.day}
                    </span>

                    <span className="text-gray-700 font-medium">
                      {slot.hours}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      {/* LOCATION + MEMBERSHIP */}
      <section className="py-14 bg-gradient-to-r from-emerald-50 to-blue-50">
        <div className="container mx-auto px-4">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

            {/* LOCATION */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-blue-900 text-2xl flex gap-2 items-center">
                  <MapPin className="w-6 h-6 text-emerald-500" />
                  Location
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <div>
                  <h3 className="font-bold text-blue-900 text-lg">
                    IISc Gymkhana Badminton Courts
                  </h3>

                  <p className="text-gray-700 mt-2 leading-relaxed">
                    Indian Institute of Science <br />
                    Bengaluru - 560012 <br />
                    Karnataka, India
                  </p>
                </div>

                <p className="text-gray-600">
                  Centrally located within the IISc campus with convenient access,
                  parking, and nearby academic blocks.
                </p>

                <a
                  href="https://maps.app.goo.gl/pBTtJGYEPwnu6qd78"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  Open in Google Maps
                </a>

                <div className="rounded-xl overflow-hidden shadow">
                  <iframe
                    src="https://www.google.com/maps?q=IISc%20Gymkhana%20Badminton%20Courts&output=embed"
                    className="w-full h-72 border-0"
                    loading="lazy"
                  ></iframe>
                </div>
              </CardContent>
            </Card>

            {/* MEMBERSHIP */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-blue-900 text-2xl flex gap-2 items-center">
                  <Users className="w-6 h-6 text-emerald-500" />
                  Membership & Access
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <h3 className="font-bold text-emerald-700 text-lg mb-2">
                    IISc Members
                  </h3>

                  <p className="text-gray-700 leading-relaxed">
                    Students, faculty, staff, and eligible campus members can
                    access the courts through Gymkhana membership.
                  </p>
                </div>

                <div className="space-y-4">

                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-emerald-500 mt-1" />
                    <span className="text-gray-700">
                      Full access to badminton facilities
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-emerald-500 mt-1" />
                    <span className="text-gray-700">
                      Practice sessions and coaching support
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-emerald-500 mt-1" />
                    <span className="text-gray-700">
                      Participation in tournaments & club events
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-emerald-500 mt-1" />
                    <span className="text-gray-700">
                      Join a vibrant badminton community
                    </span>
                  </div>

                </div>

                <a
                  href="/contact"
                  className="inline-block bg-blue-900 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  Contact for Membership
                </a>

              </CardContent>
            </Card>

          </div>
        </div>
      </section>

    </div>
  );
}