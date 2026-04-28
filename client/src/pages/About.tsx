import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * About Page
 * Design: Dynamic Sports Energy - Information-rich layout with team highlights
 */
export default function About() {
  const teamMembers = [
    { role: 'Convener', name: 'Raja Janmejay', description: 'Leading the club with vision and passion' },
    { role: 'Co-Convener', name: 'Aneesh Varla', description: 'Helping members connect, compete, and grow through the sport' },
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
            {teamMembers.map((member, idx) => (
              <Card key={idx} className="border-2 border-emerald-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-emerald-600">{member.role}</CardTitle>
                  <CardDescription className="text-blue-900 font-semibold">{member.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm">{member.description}</p>
                </CardContent>
              </Card>
            ))}
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
            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-emerald-500">
              <h3 className="text-2xl font-bold text-blue-900 mb-2">350+</h3>
              <p className="text-gray-600">Active Members</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-orange-500">
              <h3 className="text-2xl font-bold text-blue-900 mb-2">20+</h3>
              <p className="text-gray-600">Tournaments Hosted</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-blue-900">
              <h3 className="text-2xl font-bold text-blue-900 mb-2">3</h3>
              <p className="text-gray-600">Professional Courts</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-blue-900">
              <h3 className="text-2xl font-bold text-blue-900 mb-2">10+</h3>
              <p className="text-gray-600">IISM Trophies</p>
            </div>            
          </div>
        </div>
      </section>
    </div>
  );
}
