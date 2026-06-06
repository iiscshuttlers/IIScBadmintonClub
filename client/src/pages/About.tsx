import { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, type Variants } from 'framer-motion';
import { Star, ExternalLink } from 'lucide-react';
import { CountUpNumber } from '@/components/CountUpNumber';
import { ARCHIVED_TOURNAMENTS } from '@/data/tournamentArchive';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};



// Derive tournament milestones from the archive (newest first), limit to 5
const MILESTONES = [...ARCHIVED_TOURNAMENTS]
  .sort((a, b) => b.startDate.localeCompare(a.startDate))
  .slice(0, 5)
  .map((t, i) => {
    const icons = ['🏆', '🥇', '🏅', '🎓', '🔜'];
    const colors = ['border-amber-400', 'border-emerald-500', 'border-blue-500', 'border-purple-500', 'border-orange-400'];
    return {
      year: t.startDate,
      title: t.name,
      desc: t.description,
      icon: icons[i] ?? '🏸',
      color: colors[i] ?? 'border-slate-400',
    };
  });

const VALUES = [
  { title: 'Excellence', desc: 'Striving for the highest standards in play and conduct.', icon: '⭐' },
  { title: 'Inclusivity', desc: 'Welcoming players of all backgrounds and skill levels.', icon: '🤝' },
  { title: 'Integrity', desc: 'Maintaining fair play and ethical conduct on and off court.', icon: '⚖️' },
  { title: 'Community', desc: 'Building lasting friendships across departments and batches.', icon: '🌱' },
];

export default function About() {
  usePageMeta({
    title: 'About',
    description: 'Learn about the IISc Badminton Club — our mission, values, history, and leadership team.',
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const teamMembers = [
    {
      role: 'Convener',
      name: 'Raja Janmejay',
      description: 'Leading the club with vision and passion for the sport',
      image: `${import.meta.env.BASE_URL}convener.png`,
    },
    {
      role: 'Co-Convener',
      name: 'Aneesh Varla',
      description: 'Helping members connect, compete, and grow through badminton',
      image: `${import.meta.env.BASE_URL}co_convener.png`,
    },
  ];

  return (
    <div className="min-h-screen dark:bg-slate-950">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            className="max-w-2xl"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 px-4 py-2 rounded-full text-sm font-semibold mb-5">
              🏸 Our Story
            </div>
            <h1 className="text-5xl md:text-6xl font-black mb-5" style={{ fontFamily: 'Playfair Display, serif' }}>
              About IISc
              <br />
              <span className="text-emerald-400">Badminton Club</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-xl leading-relaxed">
              A thriving community of 350+ badminton enthusiasts at the Indian Institute of Science — competing, connecting, and celebrating the sport year-round.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Mission & Values ─────────────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {/* Mission */}
            <motion.div variants={fadeUp} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full" />
                <h2 className="text-3xl font-black text-blue-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Our Mission
                </h2>
              </div>
              <p className="text-gray-600 dark:text-slate-400 text-lg leading-relaxed">
                To foster excellence in badminton through competitive play and community engagement at IISc. We aim to develop skilled players while promoting discipline, teamwork, and sportsmanship.
              </p>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                The club serves players of all levels — from those picking up a racket for the first time to seasoned competitors representing IISc at IISM and beyond.
              </p>
              <a
                href="https://gymkhana.iisc.ac.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold hover:gap-3 transition-all text-sm"
              >
                IISc Gymkhana <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </motion.div>

            {/* Values grid */}
            <motion.div variants={fadeUp}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
                <h2 className="text-3xl font-black text-blue-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Our Values
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {VALUES.map((v) => (
                  <div
                    key={v.title}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="text-2xl mb-3">{v.icon}</div>
                    <h3 className="font-black text-blue-900 dark:text-white text-sm mb-1">{v.title}</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Club Leadership ───────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
              <h2 className="text-3xl font-black text-blue-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                Club Leadership
              </h2>
            </div>
            <p className="text-gray-500 dark:text-slate-400">The people keeping the shuttles flying</p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {teamMembers.map((member, idx) => {
              const avatarColors = ['from-emerald-500 to-teal-600', 'from-blue-600 to-indigo-700'];
              const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              const colorClass = avatarColors[idx % avatarColors.length];
              return (
                <motion.div
                  key={idx}
                  variants={fadeUp}
                  className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-6 p-7 sm:p-8 rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/50 bg-white dark:bg-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                  onClick={() => member.image && !imageErrors[member.name] ? setSelectedImage(member.image) : null}
                >
                  <div className={`flex-shrink-0 w-28 h-28 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-lg overflow-hidden border-4 border-white dark:border-slate-700 relative group-hover:scale-105 transition-transform duration-300`}>
                    {member.image && !imageErrors[member.name] ? (
                      <>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors z-10 flex items-center justify-center pointer-events-none">
                          <Star className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                        <img
                          loading="lazy"
                          src={member.image}
                          alt={member.name}
                          className="w-full h-full object-cover"
                          onError={() => setImageErrors(prev => ({ ...prev, [member.name]: true }))}
                        />
                      </>
                    ) : (
                      <span className="text-white text-4xl font-black">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">{member.role}</span>
                    <h3 className="text-xl font-black text-blue-900 dark:text-white leading-tight">{member.name}</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">{member.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── Tournament Timeline ───────────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-14"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-2 h-8 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full" />
              <h2 className="text-3xl font-black text-blue-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                Tournament History
              </h2>
            </div>
            <p className="text-gray-500 dark:text-slate-400">Key moments from recent years</p>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-blue-500 to-purple-500 opacity-30" />

              <div className="space-y-8">
                {MILESTONES.map((m, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    className="flex gap-5 relative"
                  >
                    {/* Dot */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border-2 ${m.color} flex items-center justify-center text-xl shadow-sm z-10`}>
                      {m.icon}
                    </div>
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{m.year}</span>
                      </div>
                      <h3 className="font-black text-blue-900 dark:text-white text-base mb-1">{m.title}</h3>
                      <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">{m.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── IISM Achievements ─────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
              <h2 className="text-3xl font-black text-blue-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                Inter IIT Sports Meet
              </h2>
            </div>
            <p className="text-gray-500 dark:text-slate-400 max-w-xl mx-auto">
              IISc competes annually at the IISM, the premier inter-institute sports championship in India.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                icon: '🏆',
                label: 'IISM Trophies',
                value: '10+',
                desc: 'Medals and trophies brought home across years of competition',
                color: 'from-amber-500 to-orange-500',
              },
              {
                icon: '👥',
                label: 'Annual Team',
                value: '~20',
                desc: 'Players selected every year to represent IISc at IISM',
                color: 'from-emerald-500 to-teal-600',
              },
              {
                icon: '📅',
                label: 'Years Competing',
                value: '15+',
                desc: 'Consistent representation at the national level sports meet',
                color: 'from-blue-600 to-indigo-600',
              },
            ].map((item) => (
              <motion.div
                key={item.label}
                variants={fadeUp}
                className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-md border border-slate-100 dark:border-slate-700 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`inline-flex p-4 bg-gradient-to-br ${item.color} rounded-2xl mb-4 shadow-md`}>
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <div className="text-4xl font-black text-blue-900 dark:text-white mb-1">{item.value}</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">{item.label}</div>
                <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-10 text-center"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <p className="text-gray-500 dark:text-slate-400 text-sm max-w-2xl mx-auto">
              IISM eligibility is determined by the Gandhi Cup (Open Tournament Cat 1). Top performers get the opportunity to represent IISc at the national meet.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── By the Numbers ────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-950 to-emerald-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern opacity-40" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            className="text-center mb-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-black text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
              By the Numbers
            </h2>
            <div className="w-12 h-1 bg-gradient-to-r from-emerald-500 to-orange-500 mx-auto mt-3 rounded-full" />
          </motion.div>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { target: 350, suffix: '+', label: 'Active Members' },
              { target: 20, suffix: '+', label: 'Tournaments Hosted' },
              { target: 3, suffix: '', label: 'Professional Courts' },
              { target: 10, suffix: '+', label: 'IISM Trophies' },
            ].map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="text-center p-6 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/15 transition-colors"
              >
                <CountUpNumber target={s.target} suffix={s.suffix} className="text-3xl font-black text-white mb-1" />
                <p className="text-gray-400 text-sm">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            loading="lazy"
            src={selectedImage}
            alt="Leadership"
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
