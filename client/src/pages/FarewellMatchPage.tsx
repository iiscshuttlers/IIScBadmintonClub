import React from "react";

export default function FarewellMatchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-teal-500 text-white py-10 px-4">

      {/* TITLE */}
      <h1 className="text-3xl md:text-5xl font-bold text-center mb-8">
        Farewell Badminton Match Registration 🏸
      </h1>

      {/* QR CODE */}
      <div className="flex flex-col items-center mb-10">
        <img
          src="/iiscshuttlers/farewell-qr.png"   {/* ✅ FIXED path for GitHub Pages */}
          alt="Scan to Register"
          className="w-72 md:w-96 rounded-2xl shadow-lg bg-white p-4"
        />
        <p className="mt-4 text-lg opacity-90">
          Scan to register instantly
        </p>
      </div>

      {/* OR DIVIDER */}
      <div className="text-center text-xl font-semibold mb-6 opacity-80">
        — OR —
      </div>

      {/* EMBED FORM */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl overflow-hidden shadow-xl">
        <iframe
          src="https://forms.office.com/Pages/ResponsePage.aspx?id=l80Vb6f240Gyxa1Bk5dkdjlbEJEXeeNOpPakbLe44QpUME1XNlgyTzYwQThTTEVIWEdKNU03MzlHRC4u&embed=true"
          className="w-full h-[80vh]"
          frameBorder="0"
          title="Farewell Match Registration"
        />
      </div>

      {/* FALLBACK BUTTON */}
      <div className="text-center mt-6">
        <a
          href="https://forms.office.com/Pages/ResponsePage.aspx?id=l80Vb6f240Gyxa1Bk5dkdjlbEJEXeeNOpPakbLe44QpUME1XNlgyTzYwQThTTEVIWEdKNU03MzlHRC4u"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-white text-blue-700 px-6 py-3 rounded-xl font-semibold hover:scale-105 transition"
        >
          Open Form in New Tab
        </a>
      </div>

    </div>
  );
}