import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { Award, Handshake, Target, Sprout } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import iiscTeam from "@/assets/iisc-team.jpg";
import { fetchSiteData } from "@/lib/siteData";
import { CONVENER_ROLES, loadConveners, type ResolvedConveners } from "@/lib/conveners";
import { CLUB_STAT_FIELDS } from "@/lib/clubStats";

/**
 * The club's "about" content: mission, history, values, team photo and
 * leadership. Lived on Home until the Home simplification; now the top of
 * Club → About & Contact, which signed-out visitors can open.
 */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const VALUES = [
  { title: "Excellence", desc: "Striving for the highest standards in play and conduct.", Icon: Award },
  { title: "Inclusivity", desc: "Welcoming players of all backgrounds and skill levels.", Icon: Handshake },
  { title: "Integrity", desc: "Maintaining fair play and ethical conduct on and off court.", Icon: Target },
  { title: "Community", desc: "Building lasting friendships across departments and batches.", Icon: Sprout },
];

export function ClubAbout() {
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [conveners, setConveners] = useState<ResolvedConveners | null>(null);
  const [zoomSrc, setZoomSrc] = useState<{ src: string; alt: string } | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSiteData("club_settings", null)
      .then((data) => { if (data) setConfig(data); })
      .catch(console.error);
    let cancelled = false;
    loadConveners().then((c) => { if (!cancelled) setConveners(c); });
    return () => { cancelled = true; };
  }, []);

  const teamMembers = conveners ? CONVENER_ROLES.map(({ key }) => conveners[key]) : [];
  // "Club at a glance" numbers, set in admin Content → Club page; empty ones are skipped.
  const stats = CLUB_STAT_FIELDS.map((f) => ({
    label: f.label,
    value: typeof config?.stats?.[f.key] === "string" ? config.stats[f.key].trim() : "",
  })).filter((s) => s.value);

  return (
    <div className="space-y-8 mb-10">
      {/* Mission & history */}
      <motion.section aria-labelledby="club-mission" variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
        <h2 id="club-mission" className="text-xl font-black text-foreground flex items-center gap-3 font-display">
          <span className="w-1.5 h-6 bg-gradient-to-b from-primary to-team rounded-full inline-block" aria-hidden />
          Our Mission
        </h2>
        <p className="text-soft leading-relaxed whitespace-pre-wrap">
          {config?.about?.mission ||
            "To foster excellence in badminton through competitive play and community engagement at IISc. We aim to develop skilled players while promoting discipline, teamwork, and sportsmanship."}
        </p>
        {config?.about?.history && (
          <div className="pt-2 space-y-2">
            <h3 className="text-lg font-black text-foreground flex items-center gap-3 font-display">
              <span className="w-1.5 h-6 bg-gradient-to-b from-info to-info rounded-full inline-block" aria-hidden />
              Our History
            </h3>
            <p className="text-soft leading-relaxed whitespace-pre-wrap">{config.about.history}</p>
          </div>
        )}
      </motion.section>

      {stats.length > 0 && (
        <section aria-label="Club at a glance" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border-strong/50 bg-muted/60 p-3 text-center">
              <p className="text-2xl font-black text-foreground font-display tabular-nums">{s.value}</p>
              <p className="mt-0.5 text-xs font-bold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>
      )}

      {/* Values */}
      <motion.section aria-labelledby="club-values" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <h2 id="club-values" className="text-xl font-black text-foreground mb-3 flex items-center gap-3 font-display">
          <span className="w-1.5 h-6 bg-gradient-to-b from-secondary to-warning rounded-full inline-block" aria-hidden />
          Our Values
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {VALUES.map(({ title, desc, Icon }) => (
            <div key={title} className="rounded-2xl p-3 bg-muted/60 border border-border-strong/50">
              <div className="w-8 h-8 rounded-xl bg-primary/40 flex items-center justify-center mb-2">
                <Icon className="w-4 h-4 text-primary" aria-hidden />
              </div>
              <h3 className="font-black text-foreground text-sm mb-1">{title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Team photo */}
      <motion.button
        type="button"
        className="block w-full relative rounded-3xl overflow-hidden shadow-xl group border border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
        onClick={() => setZoomSrc({ src: iiscTeam, alt: "IISc Badminton Team" })}
        aria-label="Open the team photo"
      >
        <img
          src={iiscTeam}
          alt="IISc Badminton Team"
          loading="lazy"
          width={800}
          height={600}
          className="w-full aspect-[4/3] object-cover group-hover:scale-[1.03] transition-transform duration-700"
        />
      </motion.button>

      {/* Leadership */}
      <motion.section aria-labelledby="club-leadership" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <div className="text-center mb-3">
          <h2 id="club-leadership" className="text-xl font-black text-foreground font-display">Club Leadership</h2>
          <p className="text-muted-foreground text-xs mt-0.5">The people keeping the shuttles flying</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {!conveners && CONVENER_ROLES.map(({ key }) => (
            <div key={key} aria-hidden className="h-[124px] sm:h-[180px] rounded-3xl bg-muted/80 border border-border-strong/60 animate-pulse" />
          ))}
          {teamMembers.map((member, idx) => {
            const gradient = idx % 2 === 0 ? "from-primary to-team" : "from-info to-info";
            const initials = member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            const hasPhoto = !!member.photoUrl && !imageErrors[member.role];
            const nameCls = "block text-sm sm:text-xl font-black text-foreground leading-tight truncate px-1";
            return (
              <div
                key={member.role}
                className="flex flex-col items-center text-center gap-2 md:gap-4 p-3 md:p-5 rounded-3xl bg-muted/80 border border-border-strong/60 hover:shadow-xl transition-shadow"
              >
                <button
                  type="button"
                  disabled={!hasPhoto}
                  onClick={() => hasPhoto && setZoomSrc({ src: member.photoUrl, alt: member.name })}
                  aria-label={hasPhoto ? `Open ${member.name}'s photo` : undefined}
                  className={`flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg overflow-hidden ring-4 ring-border-strong focus:outline-none focus-visible:ring-primary`}
                >
                  {hasPhoto ? (
                    <img
                      loading="lazy"
                      src={member.photoUrl}
                      alt={member.name}
                      className="w-full h-full object-cover"
                      onError={() => setImageErrors((prev) => ({ ...prev, [member.role]: true }))}
                    />
                  ) : (
                    <span className="text-foreground text-xl font-black">{initials}</span>
                  )}
                </button>
                <div className="min-w-0 w-full">
                  <span className="inline-block text-[9px] font-black text-primary uppercase tracking-widest mb-1 px-2 py-0.5 bg-primary/20 rounded-full border border-primary/20">
                    {member.title}
                  </span>
                  {member.playerId ? (
                    <Link
                      href={`/player/${member.playerId}`}
                      className={`${nameCls} hover:text-primary hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md`}
                    >
                      {member.name}
                    </Link>
                  ) : (
                    <p className={nameCls}>{member.name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {zoomSrc && <ImageModal src={zoomSrc.src} alt={zoomSrc.alt} onClose={() => setZoomSrc(null)} />}
    </div>
  );
}

/* ── Image modal: pinch/zoom, closes on Esc, backdrop tap or Back ─────────── */
function ImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.history.pushState({ imageModalOpen: true }, "");
    const handlePopState = () => onClose();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.imageModalOpen) {
        window.history.back();
      }
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-media/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-5 right-5 z-[60] text-on-media/80 hover:text-on-media bg-on-media/10 hover:bg-on-media/20 rounded-full p-2.5 transition-all cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="w-full h-full flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit>
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <img loading="lazy" src={src} alt={alt} className="w-full h-full max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl" />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}
