import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Events Page
 * Clean Professional Version
 * - Removed Admin Mode
 * - Removed fake upcoming events
 * - Added real tournament highlights
 */

export default function Events() {
  const pastEvents = [
    {
      title: 'Spectrum 2026 (Inter-Department)',
      date: '2026',
      winner: 'Gold: UG Seniors | Silver: CeNSE | Bronze: ECE',
      description:
        'Highly competitive inter-department championship featuring outstanding performances from teams across IISc.',
    },
    {
      title: 'Open Tournament 2025',
      date: 'November 2025',
      winner:
        'MS, MD, XD, WS, WD Categories – Gold & Silver awarded in each division',
      description:
        'Successful open badminton tournament conducted across multiple categories with strong participation.',
    },
  ];

  return (
    <div className="min-h-screen">

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Club Events
          </h1>

          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Celebrating competition, sportsmanship, and community through
            tournaments and badminton activities at IISc.
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">

          <h2
            className="text-3xl font-bold text-blue-900 mb-12 text-center"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Tournament Highlights
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">

            {pastEvents.map((event, idx) => (
              <Card
                key={idx}
                className="border-l-4 border-emerald-500 shadow-md hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="text-blue-900 text-xl">
                    {event.title}
                  </CardTitle>

                  <p className="text-sm text-gray-500 mt-2">{event.date}</p>
                </CardHeader>

                <CardContent className="space-y-4">

                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Results / Winners
                    </p>

                    <p className="font-semibold text-emerald-600 leading-relaxed">
                      {event.winner}
                    </p>
                  </div>

                  <p className="text-gray-700 leading-relaxed">
                    {event.description}
                  </p>

                </CardContent>
              </Card>
            ))}

          </div>
        </div>
      </section>

      {/* Stay Updated */}
      <section className="py-16 bg-gradient-to-r from-emerald-50 to-orange-50">
        <div className="container mx-auto px-4">

          <h2
            className="text-3xl font-bold text-blue-900 mb-8 text-center"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Stay Updated
          </h2>

          <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md border-l-4 border-emerald-500">

            <p className="text-gray-700 mb-4 leading-relaxed">
              Follow club announcements for upcoming tournaments, internal
              leagues, coaching camps, and special badminton events.
            </p>

            <p className="text-gray-700 mb-4 leading-relaxed">
              For participation details, registrations, or collaboration
              inquiries, contact:
            </p>

            <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900">
                badminton@iisc.ac.in
              </p>

              <p className="text-gray-600 text-sm mt-2">
                Indian Institute of Science, Bengaluru
              </p>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}