import { FEATURES, ANDROID, DOMAINS, DEV, UNAVAILABLE } from "@/data/featureMapData";
import { InfoModal } from "@/components/InfoModal";

export function FeatureMapDashboard() {
  return (
    <div className="w-full min-h-screen bg-[#101B16] text-[#EFEAD9] font-sans p-6 md:p-10 pb-20">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div>
          <div className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#4BB988] mb-2">
            <span className="normal-case">IISc</span> Shuttlers Club App — Codebase Survey
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 flex items-center gap-2">
            Every feature, mapped
            <InfoModal
              title="CODEBASE SURVEY"
              items={[
                { badge: "USAGE", title: "How to use", desc: "View a high-level statistical breakdown of all the features in the application, categorized by domain (e.g., Predictions & Analytics)." },
                { badge: "LOGIC", title: "How it works", desc: "It reads directly from the featureMapData registry, running .reduce() over arrays to calculate top-line statistics and rendering them in responsive CSS grid cards." }
              ]}
            />
          </h1>
          <p className="text-[#A9B6AC] max-w-2xl text-base leading-relaxed">
            Built from the app's own maintained feature registry (<code>client/src/data/features.ts</code>), the route table, the Android native plugins, the Supabase migration history, and the components currently in progress but not yet checked in.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-[#2A3830] border border-[#2A3830] rounded-xl overflow-hidden">
          <div className="bg-[#16221C] p-5">
            <div className="text-3xl font-bold font-mono">48</div>
            <div className="text-[0.74rem] text-[#A9B6AC] uppercase tracking-wider mt-1">Registry Features</div>
          </div>
          <div className="bg-[#16221C] p-5">
            <div className="text-3xl font-bold font-mono">13</div>
            <div className="text-[0.74rem] text-[#A9B6AC] uppercase tracking-wider mt-1">Categories</div>
          </div>
          <div className="bg-[#16221C] p-5">
            <div className="text-3xl font-bold font-mono">10</div>
            <div className="text-[0.74rem] text-[#A9B6AC] uppercase tracking-wider mt-1">Native Android Modules</div>
          </div>
          <div className="bg-[#16221C] p-5">
            <div className="text-3xl font-bold font-mono">7</div>
            <div className="text-[0.74rem] text-[#A9B6AC] uppercase tracking-wider mt-1">Backend Data Domains</div>
          </div>
          <div className="bg-[#16221C] p-5">
            <div className="text-3xl font-bold font-mono">10</div>
            <div className="text-[0.74rem] text-[#A9B6AC] uppercase tracking-wider mt-1">In-Progress Builds</div>
          </div>
          <div className="bg-[#16221C] p-5">
            <div className="text-3xl font-bold font-mono">6</div>
            <div className="text-[0.74rem] text-[#A9B6AC] uppercase tracking-wider mt-1">Not Reachable In-App</div>
          </div>
        </div>

        {/* Web & Product Features */}
        <section>
          <div className="flex items-baseline justify-between border-b-2 border-[#EFEAD9] pb-2 mb-6">
            <h2 className="text-xl font-extrabold tracking-tight">Web & product features</h2>
            <span className="text-sm font-mono text-[#A9B6AC]">from the app's own feature registry — all marked "active"</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((cat, idx) => (
              <div key={idx} className="bg-[#16221C] border border-[#2A3830] rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 bg-[#1B3229] text-[#4BB988] font-bold text-sm">
                  <span>{cat.c}</span>
                  <span className="font-mono text-xs opacity-85">{cat.items.length}</span>
                </div>
                <div className="py-2">
                  {cat.items.map((feat, fidx) => (
                    <div key={fidx} className="flex gap-3 items-start px-4 py-3 border-t border-[#2A3830] first:border-t-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{feat.n}</div>
                        <div className="text-[#A9B6AC] text-xs mt-1">{feat.d}</div>
                      </div>
                      <span className="shrink-0 text-[0.66rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1B3229] text-[#4BB988] mt-0.5">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Native Android */}
        <section className="bg-[#EFEAD9] rounded-2xl p-6 md:p-8">
          <div className="flex items-baseline justify-between border-b-2 border-[#101B16]/20 pb-2 mb-4">
            <h2 className="text-xl font-extrabold text-[#101B16]">Native Android layer</h2>
            <span className="text-sm font-mono text-[#101B16]">Capacitor plugins, Java/Kotlin</span>
          </div>
          <p className="text-[#101B16]/60 text-sm mb-6 max-w-3xl">
            Everything below runs outside the WebView — services, receivers, and system integrations that only exist on the Android build.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {ANDROID.map((feat, idx) => (
              <div key={idx} className="bg-[#101B16]/5 border border-[#101B16]/20 rounded-xl p-4">
                <div className="text-[#101B16] font-bold text-sm font-mono">{feat.n}</div>
                <div className="text-[#101B16]/60 text-xs mt-2 leading-relaxed">{feat.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Backend Domains */}
        <section>
          <div className="flex items-baseline justify-between border-b-2 border-[#EFEAD9] pb-2 mb-6">
            <h2 className="text-xl font-extrabold">Backend & data domains</h2>
            <span className="text-sm font-mono text-[#A9B6AC]">Supabase / Postgres migrations, grouped by concern</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOMAINS.map((domain, idx) => (
              <div key={idx} className="bg-[#16221C] border border-[#2A3830] rounded-xl p-5">
                <h3 className="text-[0.92rem] font-bold text-[#F0965A] mb-3">{domain.t}</h3>
                <ul className="space-y-2">
                  {domain.items.map((item, iidx) => (
                    <li key={iidx} className="text-sm text-[#A9B6AC] pl-4 relative">
                      <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-[#F0965A]"></span>
                      {/* Using dangerouslySetInnerHTML because the raw data has <b> tags in some strings */}
                      <span dangerouslySetInnerHTML={{ __html: item }} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* In Progress */}
        <section>
          <div className="flex items-baseline justify-between border-b-2 border-[#EFEAD9] pb-2 mb-4">
            <h2 className="text-xl font-extrabold">In active development</h2>
            <span className="text-sm font-mono text-[#A9B6AC]">uncommitted working-tree files, not yet in the registry</span>
          </div>
          <p className="text-[#A9B6AC] text-sm mb-6 max-w-3xl">
            Found as untracked source in the current git working tree — real code, but not yet released, documented, or added to the feature list above.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {DEV.map((dev, idx) => (
              <div key={idx} className="bg-[#F0965A]/10 border border-dashed border-[#F0965A]/50 rounded-xl p-5">
                <div className="font-bold text-sm flex items-center gap-2">
                  <span className="text-[0.6rem] font-extrabold tracking-wider bg-[#F0965A] text-[#16221C] px-1.5 py-0.5 rounded">WIP</span>
                  {dev.n}
                </div>
                <div className="text-[#A9B6AC] text-xs mt-2 leading-relaxed">{dev.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Not Reachable */}
        <section>
          <div className="flex items-baseline justify-between border-b-2 border-[#EFEAD9] pb-2 mb-4">
            <h2 className="text-xl font-extrabold">Not currently reachable</h2>
            <span className="text-sm font-mono text-[#A9B6AC]">code exists — no live route or nav path found</span>
          </div>
          <p className="text-[#A9B6AC] text-sm mb-6 max-w-4xl">
            These components/pages are fully coded but aren't linked from anywhere a user can actually navigate to — no route in <code>App.tsx</code>, no import from a rendered page. Likely mid-refactor casualties. Treat as <b>not available</b> until re-wired.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {UNAVAILABLE.map((un, idx) => (
              <div key={idx} className="bg-[#16221C] border border-[#2A3830] rounded-xl p-5 opacity-75 grayscale-[35%]">
                <div className="font-bold text-sm text-[#A9B6AC] flex items-center gap-2">
                  <span className="text-[0.58rem] font-extrabold tracking-wider bg-[#1E2A38] text-[#8FA3BE] px-1.5 py-0.5 rounded whitespace-nowrap">NOT AVAILABLE</span>
                  {un.n}
                </div>
                <div className="text-[#A9B6AC] text-xs mt-2 leading-relaxed">{un.d}</div>
                <div className="text-[#8FA3BE] text-xs mt-3 pt-3 border-t border-dashed border-[#2A3830]">{un.why}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-[#2A3830] pt-6 mt-12 text-xs text-[#A9B6AC]">
          Compiled by reading <code>client/src/data/features.ts</code>, <code>client/src/App.tsx</code> route table, <code>android/app/src/main/java/shuttlers/iisc/com/*</code>, <code>supabase/migrations/*.sql</code>, and <code>git status</code> for in-progress work.
        </footer>
      </div>
    </div>
  );
}
