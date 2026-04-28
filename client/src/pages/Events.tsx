import { Card, CardContent } from '@/components/ui/card';
import { Mail, Trophy, Calendar, Sparkles } from 'lucide-react';

export default function Events() {
  const pastEvents = [
    {
      title: 'Spectrum 2026',
      subtitle: 'Inter-Department Championship',
      date: '2026',
      type: 'spectrum',
      description:
        'Highly competitive inter-department championship featuring outstanding performances from teams across IISc.',
      badge: 'Flagship Event',
    },
    {
      title: 'Open Tournament 2025',
      subtitle: 'Campus Open Championship',
      date: 'November 2025',
      type: 'open',
      description:
        'Successful open badminton tournament featuring singles, doubles, and mixed doubles categories with strong participation across campus.',
      badge: 'Completed',
    },
  ];

  const renderWinners = (type: string) => {
    if (type === 'spectrum') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
            <span className="font-semibold text-gray-800">🥇 UG Seniors</span>
            <span className="text-yellow-700 font-bold">Champions</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <span className="font-semibold text-gray-800">🥈 CeNSE</span>
            <span className="text-gray-700 font-bold">Runner-up</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
            <span className="font-semibold text-gray-800">🥉 ECE</span>
            <span className="text-orange-700 font-bold">3rd Place</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3 text-sm">
        {[
          ['MS – Men Singles', '🥇 Krishnendu', '🥈 Piyush'],
          ['WS – Women Singles', '🥇 Tanisha', '🥈 Shailli'],
          ['MD – Men Doubles', '🥇 Abhisek & Krishnendu', '🥈 Raja & Kaling'],
          ['WD – Women Doubles', '🥇 Renu & Shailli', '🥈 Radhika & Madhuvanti'],
          ['XD – Mixed Doubles', '🥇 Radhika & Raja', '🥈 Shailli & Krishnendu'],
        ].map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl bg-emerald-50 border border-emerald-100 p-4"
          >
            <p className="font-bold text-blue-900 mb-2">{item[0]}</p>
            <p>{item[1]}</p>
            <p>{item[2]}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <p className="uppercase tracking-[0.25em] text-emerald-200 text-sm mb-4">
            IISc Badminton Club
          </p>

          <h1
            className="text-5xl md:text-6xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Events & Championships
          </h1>

          <p className="text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
            Celebrating competition, sportsmanship, and community through
            flagship badminton tournaments at IISc Bengaluru.
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-20 bg-gradient-to-b from-white to-emerald-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2
              className="text-4xl font-bold text-blue-900 mb-3"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Championship Highlights
            </h2>

            <p className="text-gray-600 max-w-2xl mx-auto">
              Showcasing our most memorable recent tournaments and outstanding
              performances.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-7xl mx-auto">
            {pastEvents.map((event, idx) => (
              <Card
                key={idx}
                className="rounded-3xl border border-emerald-200 shadow-md hover:shadow-2xl hover:-translate-y-1 transition duration-300 h-fit bg-white"
              >
                <CardContent className="p-8 space-y-6">
                  {/* Header */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        {event.badge}
                      </span>

                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {event.date}
                      </div>
                    </div>

                    <h3 className="text-3xl font-bold text-blue-900 leading-tight">
                      {event.title}
                    </h3>

                    <p className="text-gray-500 font-medium">{event.subtitle}</p>
                  </div>

                  {/* Winners */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="w-5 h-5 text-orange-500" />
                      <p className="uppercase text-sm tracking-wide text-gray-500 font-semibold">
                        Winners
                      </p>
                    </div>

                    {renderWinners(event.type)}
                  </div>

                  {/* Description */}
                  <p className="text-gray-700 leading-relaxed text-lg">
                    {event.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stay Updated */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto rounded-3xl border border-blue-100 shadow-lg bg-gradient-to-r from-blue-50 to-emerald-50 p-10">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <Sparkles className="w-7 h-7 text-emerald-600" />
              </div>

              <h2
                className="text-4xl font-bold text-blue-900 mb-3"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Stay Updated
              </h2>

              <p className="text-gray-700 text-lg leading-relaxed">
                Follow club announcements for upcoming tournaments, internal
                leagues, coaching camps, and special badminton events.
              </p>
            </div>

            <a
              href="mailto:office.gym@iisc.ac.in"
              className="block bg-white hover:shadow-md transition rounded-2xl border border-blue-200 p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-blue-900" />
                </div>

                <div>
                  <p className="font-bold text-blue-900 text-lg">
                    office.gym@iisc.ac.in
                  </p>

                  <p className="text-gray-600">
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