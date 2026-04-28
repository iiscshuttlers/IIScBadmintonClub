import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * Gallery Page
 * Design: Dynamic Sports Energy - Image showcase with categories
 */
export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const galleryItems = [
    {
      id: 1,
      title: 'Action Shot - Tournament Finals',
      category: 'tournaments',
      image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663599308526/gNpXTnoVpJySU9dHBtuTYc/hero-badminton-action-fqF3hY8hxUgCHg7HmSd8Fa.webp',
      description: 'Intense moment from the championship finals'
    },
    {
      id: 2,
      title: 'Team Photo - 2025',
      category: 'team',
      image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663599308526/gNpXTnoVpJySU9dHBtuTYc/hero-badminton-team-d4ccsphQvw2mwH8wLsZujy.webp',
      description: 'Our amazing club members'
    },
    {
      id: 3,
      title: 'Court Detail',
      category: 'facilities',
      image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663599308526/gNpXTnoVpJySU9dHBtuTYc/badminton-court-detail-jPorFkvkixqNypw4VeAVft.webp',
      description: 'Professional court setup'
    },
    {
      id: 4,
      title: 'Championship Celebration',
      category: 'tournaments',
      image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663599308526/gNpXTnoVpJySU9dHBtuTYc/badminton-trophy-celebration-feziDn7eEmHFtPqNAHD8o3.webp',
      description: 'Winners celebrating their victory'
    },
  ];

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'tournaments', label: 'Tournaments' },
    { id: 'team', label: 'Team' },
    { id: 'facilities', label: 'Facilities' },
  ];

  const filteredItems = selectedCategory === 'all'
    ? galleryItems
    : galleryItems.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Gallery
          </h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            Moments from our tournaments, training sessions, and community events.
          </p>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-3 justify-center mb-12">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer"
              >
                {/* Image */}
                <div className="relative h-96 overflow-hidden bg-gray-200">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-200 text-sm">{item.description}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-blue-900">{item.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                    </div>
                    <Badge className="bg-emerald-500 text-white capitalize">
                      {item.category}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No images found in this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* Share Section */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-8 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
            Share Your Moments
          </h2>
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border-l-4 border-emerald-500">
            <p className="text-gray-700 mb-4">
              Have amazing photos from our events? We'd love to feature them in our gallery! Share your best shots with us on social media or send them directly to our email.
            </p>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <p className="font-semibold text-blue-900 mb-2">📸 Tag us on social media:</p>
              <p className="text-gray-700 text-sm mb-3">#IIScBadmintonClub #BadmintonLife</p>
              <p className="font-semibold text-blue-900 mb-2">📧 Or email photos to:</p>
              <p className="text-gray-700 text-sm">badminton@iisc.ac.in</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
