import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageMeta } from '@/hooks/usePageMeta';

function CountUpStat({
  target,
  suffix = '',
  label,
  borderClass = 'border-emerald-500',
}: {
  target: number;
  suffix?: string;
  label: string;
  borderClass?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1400;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setCount(Math.round(eased * target));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className={`bg-white p-8 rounded-lg shadow-md border-l-4 ${borderClass}`}>
      <h3 className="text-2xl font-bold text-blue-900 mb-2">
        {count}{suffix}
      </h3>
      <p className="text-gray-600">{label}</p>
    </div>
  );
}

export default function About() {
  usePageMeta({
    title: 'About',
    description: 'Learn about the IISc Badminton Club — our mission, values, history, and leadership team.',
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const teamMembers = [
    { role: 'Convener', name: 'Raja Janmejay', description: 'Leading the club with vision and passion', image: `${import.meta.env.BASE_URL}convener.png` },
    { role: 'Co-Convener', name: 'Aneesh Varla', description: 'Helping members connect, compete, and grow through the sport', image: `${import.meta.env.BASE_URL}co_convener.png` },
];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            About IISc Badminton Club
          </h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            Discover our mission, values, and the vibrant community that makes us thrive.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-blue-900" style={{ fontFamily: 'Playfair Display, serif' }}>
                Our Mission
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed">
                To foster excellence in badminton through competitive play, professional coaching, and community engagement. We aim to develop skilled players while promoting the sport's values of discipline, teamwork, and sportsmanship.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                Our club serves as a hub for badminton enthusiasts at IISc, providing opportunities for players of all levels to grow, compete, and celebrate their passion for the game.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-blue-900" style={{ fontFamily: 'Playfair Display, serif' }}>
                Our Values
              </h2>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-emerald-500 font-bold text-xl">✓</span>
                  <span className="text-gray-700"><strong>Excellence:</strong> Striving for the highest standards in play and conduct</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500 font-bold text-xl">✓</span>
                  <span className="text-gray-700"><strong>Inclusivity:</strong> Welcoming players of all backgrounds and skill levels</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500 font-bold text-xl">✓</span>
                  <span className="text-gray-700"><strong>Integrity:</strong> Maintaining fair play and ethical conduct</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500 font-bold text-xl">✓</span>
                  <span className="text-gray-700"><strong>Community:</strong> Building lasting friendships and camaraderie</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-8 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Our History
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <p className="text-gray-700 text-lg leading-relaxed">
              The IISc Badminton Club has been an integral part of the institute's sporting culture for many years. What began as a small group of enthusiasts has grown into a thriving community with hundreds of active members.
            </p>
            <p className="text-gray-700 text-lg leading-relaxed">
              Over the years, our club has hosted numerous inter-college tournaments, including the prestigious Rhapsody badminton championship. Our players have represented IISc at various national and regional competitions, bringing laurels to the institute.
            </p>
            <p className="text-gray-700 text-lg leading-relaxed">
              Today, we continue to uphold the traditions of excellence while embracing modern coaching techniques and training methodologies. Our facilities, coaching staff, and community make us one of the premier badminton clubs in Bangalore.
            </p>
          </div>
        </div>
      </section>

      {/* Club Leadership */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Club Leadership
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {teamMembers.map((member, idx) => {
              const avatarColors = [
                'from-emerald-500 to-teal-600',
                'from-blue-600 to-indigo-700',
                'from-orange-500 to-red-600',
                'from-purple-500 to-violet-600',
              ];
              const initials = member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              const colorClass = avatarColors[idx % avatarColors.length];
              return (
                <div 
                  key={idx} 
                  className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-6 p-6 sm:p-8 rounded-2xl border-2 border-emerald-100 bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                  onClick={() => 'image' in member && member.image && !imageErrors[member.name] ? setSelectedImage(member.image) : null}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-32 h-32 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-md overflow-hidden border-[3px] border-emerald-50 relative group-hover:scale-105 transition-transform duration-300`}>
                    {'image' in member && member.image && !imageErrors[member.name] ? (
                      <>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors z-10 flex items-center justify-center pointer-events-none">
                          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                        <img loading="lazy" 
                          src={member.image} 
                          alt={member.name} 
                          className="w-full h-full object-cover" 
                          onError={() => setImageErrors(prev => ({ ...prev, [member.name]: true }))}
                        />
                      </>
                    ) : (
                      <span className="text-white text-4xl sm:text-5xl font-black tracking-wide">{initials}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0">
                    <span className="inline-block text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">{member.role}</span>
                    <h3 className="text-xl font-bold text-blue-900 leading-tight">{member.name}</h3>
                    <p className="text-gray-500 text-sm mt-1 leading-relaxed">{member.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="py-16 bg-gradient-to-r from-emerald-50 to-orange-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Notable Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <CountUpStat target={350} suffix="+" label="Active Members" borderClass="border-emerald-500" />
            <CountUpStat target={20} suffix="+" label="Tournaments Hosted" borderClass="border-orange-500" />
            <CountUpStat target={3} label="Professional Courts" borderClass="border-blue-900" />
            <CountUpStat target={10} suffix="+" label="IISM Trophies" borderClass="border-blue-900" />
          </div>
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
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img loading="lazy" 
            src={selectedImage} 
            alt="Leadership Full" 
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
