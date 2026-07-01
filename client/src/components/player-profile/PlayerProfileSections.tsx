import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Target, Dna, Activity, Footprints, Shirt, Star, Zap } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

interface EquipmentArsenalSectionProps {
  player: any;
}

export function EquipmentArsenalSection({
  player,
}: EquipmentArsenalSectionProps) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [isOpen, setIsOpen] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [isInView]);

  const handleBagClick = () => {
    if (isReplaying) return;
    setIsReplaying(true);
    setIsOpen(false);
    setTimeout(() => {
      setIsOpen(true);
      setIsReplaying(false);
    }, 800);
  };

  if (
    !player.racketDetails?.length &&
    !player.shoesList?.length &&
    !player.shoes &&
    !player.apparel
  ) {
    return null;
  }

  // Combine items for stagger animation
  const items: any[] = [];
  
  if (player.racketDetails) {
    player.racketDetails.forEach((r: any) => {
      items.push({ type: 'racket', data: r, isMain: r.name === player.currentRacket });
    });
  }
  
  if (player.shoesList && player.shoesList.length > 0) {
    player.shoesList.forEach((s: any) => items.push({ type: 'shoe', data: s }));
  } else if (player.shoes) {
    items.push({ type: 'shoe', data: { name: player.shoes, primary: true } });
  }

  if (player.apparel) {
    items.push({ type: 'apparel', data: { name: player.apparel } });
  }

  return (
    <section className="py-8 relative" ref={containerRef}>
      <div className="flex items-center gap-3 mb-16 px-4">
        <div className="h-px flex-1 bg-linear-to-r from-transparent to-slate-300 dark:to-white/10" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:text-foreground/35 shrink-0 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-violet-500" /> Equipment Arsenal
          <InfoModal
            title="EQUIPMENT ARSENAL"
            items={[
              { badge: "GEAR", title: "Player Loadout", desc: "A detailed breakdown of the rackets, strings, shoes, and apparel this player uses on court." }
            ]}
          />
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-300 dark:to-white/10" />
      </div>

      {/* The Animated Kitbag */}
      <div className="relative z-20 flex flex-col items-center mb-6 gap-4">

        {/* Tagline — ABOVE the bag, always visible after first view */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : -6 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
        >
          <span className="text-violet-400 text-xs">↺</span>
          <span className="text-violet-300 font-bold text-[11px] tracking-widest uppercase">
            {isOpen ? "tap to zip up" : "tap to unzip"}
          </span>
          <span className="text-violet-400 text-xs">↺</span>
        </motion.button>

        <motion.div
          animate={isInView ? (isOpen ? "open" : "shake") : "closed"}
          variants={{
            closed: { scale: 1, rotate: 0 },
            shake: {
              rotate: [0, -2, 2, -3, 3, -1, 1, 0],
              y: [0, -5, 0, -5, 0],
              transition: { duration: 0.65 }
            },
            open: { scale: 0.9, y: 14, transition: { type: "spring", bounce: 0.5 } }
          }}
          onClick={handleBagClick}
          className="relative cursor-pointer select-none"
          style={{ width: 280, height: 140 }}
          title="Tap to unpack"
        >
          {/* Drop shadow */}
          <motion.div
            animate={isOpen ? { scaleX: 1.1, opacity: 0.3 } : { scaleX: 1, opacity: 0.45 }}
            transition={{ duration: 0.5 }}
            className="absolute -bottom-5 left-10 right-10 h-5 bg-black blur-xl rounded-full"
          />

          {/* ── Single arched carry handle ── */}
          <motion.div
            variants={{
              closed: { y: 0, scaleY: 1, opacity: 1 },
              open:   { y: 10, scaleY: 0.35, opacity: 0.5 }
            }}
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: -28, width: 72, height: 30,
                     border: '4px solid #64748b', borderBottom: 'none',
                     borderRadius: '36px 36px 0 0',
                     boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5), 0 -2px 4px rgba(0,0,0,0.3)' }}
          />

          {/* ── Bag body ── */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden"
               style={{ background: 'linear-gradient(155deg,#1e2438 0%,#141926 50%,#0c1018 100%)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

            {/* Fabric weave texture */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                 style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 5px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 5px)' }} />

            {/* Top highlight rim */}
            <div className="absolute top-0 left-6 right-6 h-px"
                 style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)' }} />

            {/* Violet top accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-3xl"
                 style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7,#ec4899,#a855f7,#6d28d9)' }} />

            {/* Upper panel (above zipper) */}
            <div className="absolute left-0 right-0 top-[3px]" style={{ height: 40,
                 background: 'linear-gradient(180deg,#1b2135 0%,#131825 100%)',
                 borderBottom: '1px dashed rgba(255,255,255,0.07)' }} />

            {/* ── Zipper ── */}
            <div className="absolute left-4 right-4" style={{ top: 40 }}>
              {/* Track */}
              <div className="relative h-[11px] rounded-full overflow-hidden"
                   style={{ background: '#0a0d14', border: '1px solid rgba(100,116,139,0.3)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}>
                {/* Teeth */}
                <div className="absolute inset-0 flex items-center px-1 gap-[3px]">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 rounded-[1px]"
                         style={{ width: 5, height: 7, background: i % 2 === 0 ? '#2d3748' : '#1a202c' }} />
                  ))}
                </div>
                {/* Glow fill */}
                <motion.div
                  variants={{
                    closed: { width: '0%', opacity: 0 },
                    open:   { width: '100%', opacity: 1, transition: { duration: 0.6, ease: 'easeInOut' } }
                  }}
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg,#7c3aed,#c026d3,#7c3aed)',
                           boxShadow: '0 0 14px 3px rgba(167,139,250,0.7)' }}
                />
              </div>
              {/* Zipper slider */}
              <motion.div
                variants={{
                  closed: { x: -95, opacity: 1 },
                  open:   { x: 100, opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }
                }}
                className="absolute -top-[1px]"
                style={{ width: 20, height: 13, borderRadius: 3,
                         background: 'linear-gradient(135deg,#94a3b8,#64748b)',
                         boxShadow: '0 2px 5px rgba(0,0,0,0.7)' }}
              >
                {/* Pull tab */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2"
                     style={{ width: 8, height: 8, background: '#94a3b8',
                              borderRadius: '0 0 3px 3px', border: '1px solid #475569' }} />
              </motion.div>
            </div>

            {/* ── Lower body ── */}
            <div className="absolute left-0 right-0 bottom-0" style={{ top: 53 }}>

              {/* Left front pocket */}
              <div className="absolute left-3 top-3 bottom-3"
                   style={{ width: 52, borderRadius: 10,
                            background: 'linear-gradient(135deg,#161d2b,#0f1520)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)' }}>
                {/* Pocket zipper */}
                <div className="absolute top-2 left-2 right-2 h-1.5 rounded-full"
                     style={{ background: '#0a0d14', border: '0.5px solid rgba(100,116,139,0.2)' }} />
                {/* Pocket pull */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-2 rounded-sm"
                     style={{ background: '#475569' }} />
              </div>

              {/* Right front pocket */}
              <div className="absolute right-3 top-3 bottom-3"
                   style={{ width: 52, borderRadius: 10,
                            background: 'linear-gradient(225deg,#161d2b,#0f1520)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)' }}>
                <div className="absolute top-2 left-2 right-2 h-1.5 rounded-full"
                     style={{ background: '#0a0d14', border: '0.5px solid rgba(100,116,139,0.2)' }} />
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-2 rounded-sm"
                     style={{ background: '#475569' }} />
              </div>

              {/* Centre brand area */}
              <motion.div
                variants={{
                  closed: { opacity: 1 },
                  open:   { opacity: 0.12 }
                }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none"
              >
                <svg width="22" height="26" viewBox="0 0 22 26" fill="none" opacity="0.35">
                  <ellipse cx="11" cy="9" rx="7" ry="8.5" stroke="#a78bfa" strokeWidth="1.4"/>
                  <line x1="11" y1="0.5" x2="11" y2="17.5" stroke="#a78bfa" strokeWidth="0.7" opacity="0.6"/>
                  <line x1="4" y1="9" x2="18" y2="9" stroke="#a78bfa" strokeWidth="0.7" opacity="0.6"/>
                  <line x1="7.5" y1="3" x2="14.5" y2="15" stroke="#a78bfa" strokeWidth="0.5" opacity="0.3"/>
                  <line x1="14.5" y1="3" x2="7.5" y2="15" stroke="#a78bfa" strokeWidth="0.5" opacity="0.3"/>
                  <line x1="11" y1="17.5" x2="11" y2="26" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="text-violet-400/80 font-black tracking-[0.4em] text-[11px] uppercase"
                      style={{ textShadow: '0 0 12px rgba(139,92,246,0.8)' }}>
                  PRO GEAR
                </span>
              </motion.div>

              {/* Bottom accent stripe */}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-3xl"
                   style={{ background: 'linear-gradient(90deg,#6d28d9,#a855f7,#6d28d9)', opacity: 0.6 }} />
            </div>
          </div>
        </motion.div>

      </div>

      {/* Equipment Cards — arc out of the bag */}
      <div className="relative z-10 max-w-3xl mx-auto space-y-4 px-4 mt-4">
        {items.map((item, idx) => {
          // Each item arcs from a slightly different angle for a "pulled out and placed" feel
          const arcX = idx % 2 === 0 ? -18 : 18;
          const arcRotate = idx % 2 === 0 ? -6 : 6;
          return (
            <motion.div
              key={idx}
              custom={idx}
              initial={{ opacity: 0, y: -80, x: arcX, scale: 0.75, rotateZ: arcRotate, rotateX: -30 }}
              animate={isOpen ? {
                opacity: 1, y: 0, x: 0, scale: 1, rotateZ: 0, rotateX: 0,
                transition: {
                  delay: 0.65 + idx * 0.18,
                  type: "spring",
                  stiffness: 140,
                  damping: 16,
                  mass: 1.1,
                }
              } : {}}
              style={{ perspective: "900px", transformOrigin: "top center" }}
              className="w-full relative z-10"
            >
              {item.type === 'racket' && (
                <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 group ${item.isMain ? "bg-slate-50 dark:bg-white/8 shadow-sm dark:shadow-none border-violet-500/40 shadow-lg shadow-violet-900/30" : "bg-white dark:bg-white/5 shadow-sm dark:shadow-none border-slate-200 dark:border-white/8 shadow-md"}`}>
                  {/* Racket string-grid pattern in background */}
                  <div
                    className="absolute inset-0 opacity-[0.06] pointer-events-none"
                    style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0, currentColor 1px, transparent 1px, transparent 12px), repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 12px)", color: item.isMain ? "#8b5cf6" : "#94a3b8" }}
                  />
                  <div className={`absolute top-0 left-0 right-0 h-1 ${item.isMain ? "bg-linear-to-r from-violet-400 via-fuchsia-500 to-violet-400" : "bg-linear-to-r from-white/15 to-slate-300 dark:to-white/10"}`} />
                  <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                      {/* Racket illustration */}
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden ${item.isMain ? "bg-violet-500/15" : "bg-slate-50 dark:bg-white/8 shadow-sm dark:shadow-none"}`}>
                        <svg viewBox="0 0 40 40" className={`w-9 h-9 ${item.isMain ? "text-violet-400" : "text-muted-foreground"}`} fill="none">
                          {/* Racket head */}
                          <ellipse cx="20" cy="15" rx="10" ry="12" stroke="currentColor" strokeWidth="2" />
                          {/* String pattern */}
                          <line x1="20" y1="3" x2="20" y2="27" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
                          <line x1="14" y1="5" x2="14" y2="25" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
                          <line x1="26" y1="5" x2="26" y2="25" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
                          <line x1="10" y1="15" x2="30" y2="15" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
                          <line x1="10" y1="10" x2="30" y2="10" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
                          <line x1="10" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
                          {/* Handle */}
                          <rect x="18" y="27" width="4" height="11" rx="2" fill="currentColor" opacity="0.7" />
                          {/* Grip tape */}
                          <rect x="17.5" y="32" width="5" height="2" rx="1" fill="currentColor" opacity="0.4" />
                        </svg>
                        {item.isMain && <div className="absolute inset-0 bg-violet-400/10 rounded-2xl" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-black text-lg text-slate-800 dark:text-foreground">{item.data.name}</h3>
                          {item.isMain && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-violet-500 text-foreground rounded-lg">Primary</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground dark:text-foreground/45 font-medium">
                          <span className="flex items-center gap-1.5"><Dna className="w-3.5 h-3.5 text-blue-500" /> String: <span className="font-bold text-muted-foreground dark:text-foreground/80">{item.data.string}</span></span>
                          <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-rose-500" /> Tension: <span className="font-bold text-muted-foreground dark:text-foreground/80">{item.data.tension}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {item.type === 'shoe' && (
                <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none backdrop-blur-xl rounded-2xl border border-blue-500/20 shadow-md overflow-hidden relative">
                  {/* Shoe tread dot pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(circle, #3b82f6 1px, transparent 1px)", backgroundSize: "10px 10px" }}
                  />
                  <div className={`absolute top-0 left-0 right-0 h-1 ${item.data.primary ? "bg-linear-to-r from-blue-400 to-cyan-500" : "bg-linear-to-r from-white/15 to-slate-300 dark:to-white/10"}`} />
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Shoe illustration */}
                      <div className="w-12 h-12 rounded-xl bg-blue-500/12 flex items-center justify-center shrink-0 shadow-inner">
                        <svg viewBox="0 0 40 28" className="w-9 h-7 text-blue-500" fill="none">
                          {/* Sole */}
                          <path d="M2 22 Q8 26 20 26 Q34 26 38 22 L36 18 Q28 20 20 20 Q10 20 4 17 Z" fill="currentColor" opacity="0.25" />
                          {/* Upper */}
                          <path d="M4 17 Q8 8 16 6 Q22 4 28 7 L36 14 Q34 18 20 18 Q10 18 4 17Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
                          {/* Toe cap */}
                          <path d="M4 17 Q6 10 12 8 Q8 13 8 17Z" fill="currentColor" opacity="0.3" />
                          {/* Laces */}
                          <line x1="14" y1="9" x2="18" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                          <line x1="18" y1="7.5" x2="22" y2="11.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                          <line x1="22" y1="7" x2="26" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                          {/* Back */}
                          <path d="M28 7 Q34 10 36 14" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-[0.15em] text-blue-400 font-black mb-0.5">Footwear</div>
                        <div className="font-bold text-base text-slate-800 dark:text-foreground/90 truncate">{item.data.name}</div>
                      </div>
                    </div>
                    {item.data.primary && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-500 text-foreground rounded-lg shrink-0">Primary</span>
                    )}
                  </div>
                </div>
              )}

              {item.type === 'apparel' && (
                <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none backdrop-blur-xl rounded-2xl border border-violet-500/20 shadow-md overflow-hidden relative">
                  {/* Fabric weave pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{ backgroundImage: "repeating-linear-gradient(45deg, #8b5cf6 0, #8b5cf6 1px, transparent 1px, transparent 8px), repeating-linear-gradient(-45deg, #8b5cf6 0, #8b5cf6 1px, transparent 1px, transparent 8px)" }}
                  />
                  <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-400 to-purple-500" />
                  <div className="p-4 sm:p-5 flex items-center gap-4 relative z-10">
                    {/* Apparel illustration */}
                    <div className="w-12 h-12 rounded-xl bg-violet-500/12 flex items-center justify-center shadow-inner">
                      <svg viewBox="0 0 40 36" className="w-8 h-8 text-violet-500" fill="none">
                        {/* Jersey shape */}
                        <path d="M8 4 L2 12 L8 14 L8 32 L32 32 L32 14 L38 12 L32 4 L26 8 Q20 10 14 8 Z" stroke="currentColor" strokeWidth="1.8" fill="currentColor" opacity="0.12" />
                        {/* Collar */}
                        <path d="M14 8 Q20 12 26 8" stroke="currentColor" strokeWidth="1.8" fill="none" />
                        {/* Sleeve lines */}
                        <line x1="2" y1="12" x2="8" y2="14" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
                        <line x1="38" y1="12" x2="32" y2="14" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
                        {/* Center stripe */}
                        <line x1="20" y1="12" x2="20" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.15em] text-violet-400 font-black mb-0.5">Apparel</div>
                      <div className="font-bold text-base text-slate-800 dark:text-foreground/90">{item.data.name}</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

const TIMELINE_COLORS = [
  {
    ring: "ring-primary/25",
    bg: "bg-primary/10",
    icon: "text-primary",
  },
  {
    ring: "ring-blue-500/25",
    bg: "bg-blue-500/12",
    icon: "text-blue-400",
  },
  {
    ring: "ring-purple-500/25",
    bg: "bg-purple-500/10",
    icon: "text-purple-400",
  },
  {
    ring: "ring-amber-500/25",
    bg: "bg-amber-500/10",
    icon: "text-amber-400",
  },
  {
    ring: "ring-rose-500/25",
    bg: "bg-rose-500/10",
    icon: "text-rose-400",
  },
];

export function CareerHighlightsSection({ player }: { player: any }) {
  if (!player.careerHighlights || player.careerHighlights.length === 0) {
    return null;
  }

  return (
    <motion.section variants={itemVariants}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-50 dark:bg-white/8 shadow-sm dark:shadow-none" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:text-foreground/35 shrink-0">
          Career Highlights
        </span>
        <div className="h-px flex-1 bg-slate-50 dark:bg-white/8 shadow-sm dark:shadow-none" />
      </div>

      <div className="relative ml-6">
        {/* Vertical timeline line */}
        <div className="absolute left-0 top-3 bottom-3 w-px bg-linear-to-b from-primary/50 via-blue-500/50 to-purple-500/50 rounded-full" />

        <div className="space-y-5">
          {[...player.careerHighlights]
            .sort(
              (a: any, b: any) =>
                parseInt(b.year || "0", 10) - parseInt(a.year || "0", 10),
            )
            .map((h: any, idx: number) => {
              const color = TIMELINE_COLORS[idx % TIMELINE_COLORS.length];
              return (
                <div
                  key={idx}
                  className="relative flex gap-4 items-start group"
                >
                  {/* Timeline dot */}
                  <div
                    className={`relative -ml-4.5 mt-1 shrink-0 w-9 h-9 rounded-full ${color.ring} ring-2 ${color.bg} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Star className={`w-3.5 h-3.5 ${color.icon}`} />
                  </div>
                  {/* Card */}
                  <div className="flex-1 bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-xl p-4 border border-slate-200 dark:border-white/8 hover:border-white/15 hover:bg-slate-50 dark:bg-white/8 shadow-sm dark:shadow-none hover:-translate-y-0.5 transition-all duration-300">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground dark:text-foreground/35 mb-1">
                      {h.year}
                    </div>
                    <div className="text-sm font-black text-slate-800 dark:text-foreground leading-snug">
                      {h.title}
                    </div>
                    {h.description && (
                      <div className="text-xs text-muted-foreground dark:text-foreground/45 mt-1.5 leading-relaxed">
                        {h.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </motion.section>
  );
}

