import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function Events() {
  const pastEvents = [
    {
      title: 'Spectrum 2026 (Inter-Department)',
      date: '2026',
      type: 'spectrum',
      description:
        'Highly competitive inter-department championship featuring outstanding performances from teams across IISc.',
    },
    {
      title: 'Open Tournament 2025',
      date: 'November 2025',
      type: 'open',
      description:
        'Successful open badminton tournament featuring singles, doubles, and mixed doubles categories with strong participation across campus.',
    },
  ];

  const renderWinners = (type: string) => {
    if (type === 'spectrum') {
      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span>🥇</span>
            <span className="font-semibold text-yellow-600">UG Seniors</span>
          </div>

          <div className="flex items-center gap-2">
            <span>🥈</span>
            <span className="font-semibold text-gray-600">CeNSE</span>
          </div>

          <div className="flex items-center gap-2">
            <span>🥉</span>
            <span className="font-semibold text-orange-600">ECE</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-sm">

        <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
          <p className="font-bold text-blue-900 mb-1">MS – Men Singles</p>
          <p>🥇 Krishnendu</p>
          <p>🥈 Piyush</p>
        </div>

        <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
          <p className="font-bold text-blue-900 mb-1">WS – Women Singles</p>
          <p>🥇 Tanisha</p>
          <p>🥈 Shailli</p>
        </div>

        <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
          <p className="font-bold text-blue-900 mb-1">MD – Men Doubles</p>
          <p>🥇 Abhisek & Krishnendu</p>
          <p>🥈 Raja & Kaling</p>
        </div>

        <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
          <p className="font-bold text-blue-900 mb-1">WD – Women Doubles</p>
          <p>🥇 Renu & Shailli</p>
          <p>🥈 Radhika & Madhuvanti</p>
        </div>

        <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
          <p className="font-bold text-blue-900 mb-1">XD – Mixed Doubles</p>
          <p>🥇 Radhika & Raja</p>
          <p>🥈 Shailli & Krishnendu</p>
        </div>

      </div>
    );
  };

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">

          <h1
            className="text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Club Events
          </h1>

          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Celebrating competition, sportsmanship, and community through tournaments and badminton activities at IISc.
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

            {pastEvents.map((event, idx) => (
              <Card
                key={idx}
                className="shadow-md hover:shadow-xl transition rounded-2xl border border-emerald-200"
              >
                <CardHeader>
                  <CardTitle className="text-blue-900 text-2xl">
                    {event.title}
                  </CardTitle>

                  <p className="text-sm text-gray-500 mt-1">
                    {event.date}
                  </p>
                </CardHeader>

                <CardContent className="space-y-5">

                  <div>
                    <p className="text-sm uppercase tracking-wide text-gray-500 mb-3">
                      Winners
                    </p>

                    {renderWinners(event.type)}
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

          <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-md border border-emerald-200">

            <p className="text-gray-700 mb-4 leading-relaxed">
              Follow club announcements for upcoming tournaments, internal leagues, coaching camps, and special badminton events.
            </p>

            <p className="text-gray-700 mb-5 leading-relaxed">
              For participation details, registrations, or collaboration inquiries:
            </p>

            <a
              href="mailto:office.gym@iisc.ac.in"
              className="block bg-blue-50 hover:bg-blue-100 transition p-5 rounded-xl border border-blue-200"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-900" />

                <div>
                  <p className="font-semibold text-blue-900">
                    office.gym@iisc.ac.in
                  </p>

                  <p className="text-gray-600 text-sm">
                    IISc Gymkhana Office, Bengaluru
                  </p>
                </div>
              </div>
            </a>

          </div>

        </div>
      </section>

    </div>
  );
}