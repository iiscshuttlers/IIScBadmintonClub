import { useParams } from 'react-router-dom';

export default function TournamentDetail() {
  const { slug } = useParams();

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {slug?.replace(/-/g, ' ').toUpperCase()}
          </h1>

          <p className="text-xl text-gray-200">
            Live tournament details, fixtures and standings.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 space-y-10">

        <div className="bg-white rounded-3xl shadow-md p-8">
          <h2 className="text-3xl font-bold text-blue-900 mb-4">
            Fixtures
          </h2>

          <div className="space-y-4 text-lg">
            <div className="border rounded-xl p-4">
              Court 1 — UG Seniors vs CeNSE
            </div>

            <div className="border rounded-xl p-4">
              Court 2 — ECE vs CSA
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-md p-8">
          <h2 className="text-3xl font-bold text-blue-900 mb-4">
            Standings
          </h2>

          <div className="space-y-3 text-lg">
            <div>1. UG Seniors</div>
            <div>2. CeNSE</div>
            <div>3. ECE</div>
          </div>
        </div>

      </section>
    </div>
  );
}