import { useRoute } from 'wouter';

export default function TournamentDetail() {
  const [, params] = useRoute('/events/:slug');
  const slug = params?.slug || '';

  const isOpen = slug === 'open-2026';

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">

          <h1
            className="text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {isOpen ? 'OPEN TOURNAMENT 2026' : 'SPECTRUM 2026'}
          </h1>

          <p className="text-xl text-gray-200">
            {isOpen
              ? 'Open to all IISc players • Singles • Doubles • Mixed Doubles'
              : 'Inter-department badminton championship'}
          </p>

        </div>
      </section>

      <section className="container mx-auto px-4 py-16 space-y-10">

        {isOpen ? (
          <>
            {/* Live Matches */}
            <div className="bg-white rounded-3xl shadow-md p-8">
              <h2 className="text-3xl font-bold text-blue-900 mb-6">
                🔴 Live Matches
              </h2>

              <div className="space-y-4 text-lg">
                <div className="border rounded-xl p-4">
                  Court 1 — Krishnendu vs Piyush (MS SF)
                </div>

                <div className="border rounded-xl p-4">
                  Court 2 — Raja/Kaling vs Abhisek/Krishnendu (MD Final)
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-3xl shadow-md p-8">
              <h2 className="text-3xl font-bold text-blue-900 mb-6">
                Events
              </h2>

              <div className="grid md:grid-cols-3 gap-5">
                <div className="border rounded-xl p-5">Men's Singles</div>
                <div className="border rounded-xl p-5">Men's Doubles</div>
                <div className="border rounded-xl p-5">Mixed Doubles</div>
              </div>
            </div>

            {/* Results */}
            <div className="bg-white rounded-3xl shadow-md p-8">
              <h2 className="text-3xl font-bold text-blue-900 mb-6">
                Latest Results
              </h2>

              <div className="space-y-3">
                <div>Tanisha def. Shailli (21-18, 21-16)</div>
                <div>Radhika/Raja def. KD Shaili (22-20, 21-19)</div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Spectrum Old */}
            <div className="bg-white rounded-3xl shadow-md p-8">
              <h2 className="text-3xl font-bold text-blue-900 mb-6">
                Final Standings
              </h2>

              <div className="space-y-3 text-lg">
                <div>1. UG Seniors</div>
                <div>2. CeNSE</div>
                <div>3. ECE</div>
              </div>
            </div>
          </>
        )}

      </section>
    </div>
  );
}