import React from "react";
import { BookOpen } from "lucide-react";

export function AdminFeaturesGuide() {
  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#101B16] text-slate-800 dark:text-[#EFEAD9] font-sans p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 dark:border-[#2A3830]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase text-xs mb-2">
            <BookOpen className="w-4 h-4" /> Documentation
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Admin Features Dashboard Guide</h1>
          <p className="text-slate-600 dark:text-[#A9B6AC] leading-relaxed text-lg">
            I have successfully updated the hardcoded data structures powering these first 4 features to ensure they now include our recently built capabilities (like the <strong>Shuttlecock Optical Tracking</strong> and <strong>Acoustic String Tuner</strong>).
          </p>
          <p className="text-slate-600 dark:text-[#A9B6AC] leading-relaxed mt-2 text-lg">
            Here is a comprehensive breakdown of how to use these 4 features, how they work under the hood, and the logic powering them.
          </p>
        </div>

        <div className="space-y-12 mt-10">
          
          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 border-b border-slate-200 dark:border-[#2A3830] pb-2">
              <span className="bg-primary/20 text-primary w-8 h-8 rounded-lg flex items-center justify-center text-sm">1</span>
              App Architecture (AppArchitectureMap.tsx)
            </h2>
            <div className="space-y-3">
              <p><strong>How to use:</strong> Click the "App Architecture" button. This opens a visual accordion menu that maps out the exact navigational flow of the app (e.g., what pages are nested under the "Pulse" tab vs the "Hub" tab).</p>
              <p><strong>How it works:</strong> It acts as a static blueprint of the frontend route tree. It does not dynamically read the <code>wouter</code> router; rather, it provides a human-readable conceptual map of the app's structure.</p>
              <div>
                <strong>Logics used:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600 dark:text-[#A9B6AC]">
                  <li>Uses a deeply nested JSON object (<code>MAP_DATA</code>) containing <code>children</code> arrays.</li>
                  <li>Employs Recursive React Rendering: A component calls itself to render nested sub-menus indefinitely.</li>
                  <li>Uses <code>framer-motion</code> to smoothly animate the expansion and collapse of the architecture tree.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 border-b border-slate-200 dark:border-[#2A3830] pb-2">
              <span className="bg-primary/20 text-primary w-8 h-8 rounded-lg flex items-center justify-center text-sm">2</span>
              Codebase Survey (FeatureMapDashboard.tsx)
            </h2>
            <div className="space-y-3">
              <p><strong>How to use:</strong> Click the "Codebase Survey" button to view a high-level statistical breakdown of all the features in the application, categorized by domain (e.g., "Predictions &amp; Analytics", "Admin Tools").</p>
              <p><strong>How it works:</strong> It reads directly from <code>client/src/data/featureMapData.ts</code>, which is our central "Feature Registry". Whenever we build a new feature (like Shuttlecock Tracking), we add it to this registry so the app stays self-documented.</p>
              <div>
                <strong>Logics used:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600 dark:text-[#A9B6AC]">
                  <li>Array Reduction: It runs <code>.reduce()</code> over the feature arrays to calculate the top-line statistics (e.g., total features, total native Android modules).</li>
                  <li>Maps through the categorized data to render clean, responsive CSS Grid cards.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 border-b border-slate-200 dark:border-[#2A3830] pb-2">
              <span className="bg-primary/20 text-primary w-8 h-8 rounded-lg flex items-center justify-center text-sm">3</span>
              Database Schema (DatabaseSchemaDashboard.tsx)
            </h2>
            <div className="space-y-3">
              <p><strong>How to use:</strong> Click the "Database Schema" button. This renders a comprehensive, human-readable layout of all your Postgres tables, their columns, and their Row Level Security (RLS) policies.</p>
              <p><strong>How it works:</strong> Rather than making an expensive live API call to Supabase's <code>information_schema</code> on every page load, it reads from a pre-generated static JSON file (<code>client/src/data/dbSchemaData.json</code>).</p>
              <div>
                <strong>Logics used:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600 dark:text-[#A9B6AC]">
                  <li>Uses <code>Object.entries(dbSchema)</code> to iterate over the keys (table names) and values (table definitions).</li>
                  <li>For each table, it iterates over the <code>columns</code> array to display the data types, and the <code>policies</code> array to display the security rules protecting that table.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 border-b border-slate-200 dark:border-[#2A3830] pb-2">
              <span className="bg-primary/20 text-primary w-8 h-8 rounded-lg flex items-center justify-center text-sm">4</span>
              Architecture Graph (ArchitectureNeuralGraph.tsx)
            </h2>
            <div className="space-y-3">
              <p><strong>How to use:</strong> Click the "Architecture Graph" button. This opens an interactive, neural-network-style web graph. You can click and drag nodes to watch the physics engine react, and zoom in/out to explore relationships.</p>
              <p><strong>How it works:</strong> It visually maps how Frontend Features are connected to Backend Database Tables. It uses the <code>react-force-graph-2d</code> package to render this on an HTML5 <code>&lt;canvas&gt;</code>.</p>
              <div>
                <strong>Logics used:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600 dark:text-[#A9B6AC]">
                  <li>Data Transformation: It takes a simple mapping dictionary (<code>TABLE_TO_FEATURES</code>) and transforms it into two distinct arrays: <code>nodes</code> (the individual dots representing either a table or a feature) and <code>links</code> (the lines connecting them).</li>
                  <li>Physics Simulation: Under the hood, it uses the <code>d3-force</code> physics engine. It applies a repelling force (like magnets of the same polarity) to all nodes so they spread out, and an attracting spring force to the links so connected items pull towards each other. This creates the organic, self-organizing "neural" web effect!</li>
                </ul>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
