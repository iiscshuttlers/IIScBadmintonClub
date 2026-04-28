import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, X } from 'lucide-react';

export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubfolder, setSelectedSubfolder] = useState('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const imageModules = import.meta.glob(
    '/src/assets/gallery/**/*.{png,jpg,jpeg,webp}',
    {
      eager: true,
      import: 'default',
    }
  );

  const formatText = (text: string) =>
    text
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const galleryItems = Object.entries(imageModules).map(
    ([path, image], index) => {
      const cleanPath = path.replace('/src/assets/gallery/', '');
      const parts = cleanPath.split('/');

      const category = parts[0];
      const subfolder = parts.length > 2 ? parts[1] : '';
      const filename = parts[parts.length - 1];

      const title = formatText(
        filename.replace(/\.[^/.]+$/, '')
      );

      return {
        id: index + 1,
        title,
        category,
        subfolder,
        image: image as string,
      };
    }
  );

  const categories = [
    { id: 'all', label: 'All' },
    ...Array.from(
      new Set(galleryItems.map((item) => item.category))
    ).map((cat) => ({
      id: cat,
      label: formatText(cat),
    })),
  ];

  const subfolders =
    selectedCategory === 'all'
      ? []
      : Array.from(
          new Set(
            galleryItems
              .filter(
                (item) =>
                  item.category === selectedCategory &&
                  item.subfolder !== ''
              )
              .map((item) => item.subfolder)
          )
        );

  const filteredItems = galleryItems.filter((item) => {
    const categoryMatch =
      selectedCategory === 'all' ||
      item.category === selectedCategory;

    const subfolderMatch =
      selectedSubfolder === 'all' ||
      item.subfolder === selectedSubfolder;

    return categoryMatch && subfolderMatch;
  });

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">

          <h1
            className="text-5xl font-bold mb-4"
            style={{
              fontFamily:
                'Playfair Display, serif',
            }}
          >
            Gallery
          </h1>

          <p className="text-xl text-gray-200 max-w-2xl mx-auto">
            Tournaments, practice sessions,
            victories and badminton life at IISc.
          </p>

        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">

          {/* Main Category Buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedSubfolder('all');
                }}
                className={`px-6 py-2 rounded-full font-semibold transition ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Subfolder Buttons */}
          {subfolders.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center mb-12">
              <button
                onClick={() =>
                  setSelectedSubfolder('all')
                }
                className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                  selectedSubfolder === 'all'
                    ? 'bg-blue-900 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                All
              </button>

              {subfolders.map((sub) => (
                <button
                  key={sub}
                  onClick={() =>
                    setSelectedSubfolder(sub)
                  }
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                    selectedSubfolder === sub
                      ? 'bg-blue-900 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {formatText(sub)}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group bg-white rounded-xl shadow-md hover:shadow-xl overflow-hidden transition cursor-pointer"
                onClick={() =>
                  setSelectedImage(item.image)
                }
              >
                <div className="h-72 overflow-hidden bg-gray-200">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>

                <div className="p-5">

                  <div className="flex justify-between items-start gap-3 mb-3">

                    <h3 className="text-lg font-bold text-blue-900">
                      {item.title}
                    </h3>

                    <Badge className="bg-emerald-500 text-white capitalize">
                      {formatText(item.category)}
                    </Badge>

                  </div>

                  {item.subfolder && (
                    <p className="text-gray-600 text-sm">
                      {formatText(item.subfolder)}
                    </p>
                  )}

                </div>
              </div>
            ))}

          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              No images found.
            </div>
          )}

        </div>
      </section>

      {/* Instagram */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4">

          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-md p-10 text-center">

            <Instagram className="mx-auto w-10 h-10 text-pink-500 mb-4" />

            <h2
              className="text-3xl font-bold text-blue-900 mb-4"
              style={{
                fontFamily:
                  'Playfair Display, serif',
              }}
            >
              Follow Us on Instagram
            </h2>

            <p className="text-gray-600 mb-6">
              Photos, tournaments, updates and reels.
            </p>

            <a
              href="https://www.instagram.com/iisc.badminton/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-3 rounded-full font-semibold hover:scale-105 transition"
            >
              @iisc.badminton
            </a>

          </div>

        </div>
      </section>

      {/* Popup Enlarged Image */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-5 right-5 text-white">
            <X className="w-8 h-8" />
          </button>

          <img
            src={selectedImage}
            className="max-h-[90vh] max-w-[95vw] rounded-xl shadow-2xl"
          />
        </div>
      )}

    </div>
  );
}