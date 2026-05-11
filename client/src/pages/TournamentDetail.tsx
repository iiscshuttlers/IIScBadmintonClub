import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

export default function TournamentDetail() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug || "";

  /* ---------- FAREWELL 2026 ---------- */
  if (slug === "farewell-match") {
    const winners = [
      ["Men Singles", "Jalaj (RBCCPS)"],
      ["Men Doubles", "Kaling Danggen (CES) & Raja Janmejay (AE)"],
      ["Women Singles", "Radhika Dutt (CES)"],
      ["Mixed Doubles", "Radhika Dutt (CES) & Kaling Danggen (CES)"],
    ];

    return (
      <div className="min-h-screen bg-slate-50">
        <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-5xl font-bold mb-4">
              Farewell Badminton Tournament 2026
            </h1>

            <p className="text-xl text-gray-200">
              Archived Results
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 max-w-5xl">
          <Card className="rounded-3xl shadow-md">
            <CardContent className="p-10">
              <h2 className="text-3xl font-bold text-blue-900 mb-10">
                Category Winners
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {winners.map(([category, winner]) => (
                  <div
                    key={category}
                    className="rounded-2xl bg-yellow-50 border border-yellow-200 px-6 py-5"
                  >
                    <h3 className="text-xl font-semibold text-blue-800 mb-2">
                      {category}
                    </h3>
                    <p className="text-lg text-gray-800">🥇 {winner}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  /* ---------- SPECTRUM FIRST ---------- */
  if (slug === "spectrum-2026") {
    return (
      <div className="min-h-screen bg-slate-50">
        <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-5xl font-bold mb-4">
              SPECTRUM 2026
            </h1>

            <p className="text-xl text-gray-200">
              Inter-Department Championship Results
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">

            <Card className="rounded-3xl shadow-md h-full">
          <CardContent className="p-10">
            <h2 className="text-3xl font-bold text-blue-900 mb-8">
              Final Podium
            </h2>

            <div className="space-y-5 text-xl">

              <div className="rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4">
                🥇 UG Seniors
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 px-5 py-4">
                🥈 CeNSE
              </div>

              <div className="rounded-2xl bg-orange-50 border border-orange-200 px-5 py-4">
                🥉 ECE
              </div>

              <div className="rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4">
                4️⃣ AE
              </div>

            </div>
          </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-md h-full">
              <CardContent className="p-10">
                <h2 className="text-3xl font-bold text-blue-900 mb-8">
                  Tournament Highlights
                </h2>

                <div className="space-y-5 text-lg text-gray-700 leading-relaxed">
                  <p>
                    Spectrum 2026 featured strong competition across departments
                    with exciting singles and doubles matches.
                  </p>

                  <p>
                    UG Seniors delivered a dominant campaign to become champions.
                  </p>

                  <p>
                    CeNSE and ECE also impressed with consistent performances.
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>
        </section>
      </div>
    );
  }

  /* ---------- OPEN 2025 ---------- */
  if (slug === "open-2025") {
    return (
      <div className="min-h-screen bg-slate-50">
        <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-5xl font-bold mb-4">
              OPEN TOURNAMENT 2025
            </h1>

            <p className="text-xl text-gray-200">
              Official Results
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 max-w-6xl">
          <Card className="rounded-3xl shadow-md">
            <CardContent className="p-10">
              <h2 className="text-3xl font-bold text-blue-900 mb-10">
                Category Winners
              </h2>

              <div className="grid md:grid-cols-2 gap-8">

                <div className="space-y-8">

                  <div>
                    <h3 className="text-2xl font-semibold text-blue-800 mb-2">
                      Men Singles
                    </h3>
                    <p>🥇 Krishnendu</p>
                    <p>🥈 Piyush</p>
                    <p>🥉 Abhishek Sampath</p>
                    <p>🥉 Manish</p>
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold text-blue-800 mb-2">
                      Women Singles
                    </h3>
                    <p>🥇 Tanisha</p>
                    <p>🥈 Shailli</p>
                    <p>🥉 Radhika</p>
                    <p>🥉 Sharanya Marathe</p>
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold text-blue-800 mb-2">
                      Men Doubles
                    </h3>
                    <p>🥇 Abhisek & Krishnendu</p>
                    <p>🥈 Raja & Kaling</p>
                    <p>🥉 Bhuppi & Piyush</p>
                    <p>🥉 Shiv Pratap & Shubham</p>
                  </div>

                </div>

                <div className="space-y-8">

                  <div>
                    <h3 className="text-2xl font-semibold text-blue-800 mb-2">
                      Women Doubles
                    </h3>
                    <p>🥇 Renu & Shailli</p>
                    <p>🥈 Radhika & Madhuvanti</p>
                    <p>🥉 Sonali & Somili</p>
                    <p>🥉 Shruti & Jefrin</p>
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold text-blue-800 mb-2">
                      Mixed Doubles
                    </h3>
                    <p>🥇 Radhika & Raja</p>
                    <p>🥈 Shailli & Krishnendu</p>
                    <p>🥉 Tanisha & Abhisek</p>
                    <p>🥉 Sayoni & Piyush</p>
                  </div>

                </div>

              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  /* ---------- NOT FOUND ---------- */
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="rounded-3xl shadow-md max-w-xl w-full">
        <CardContent className="p-10 text-center space-y-4">
          <h1 className="text-4xl font-bold text-blue-900">
            Tournament Not Found
          </h1>

          <p className="text-gray-600 text-lg">
            The tournament page you requested does not exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
