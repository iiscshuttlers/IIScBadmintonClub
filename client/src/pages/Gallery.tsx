import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, X } from 'lucide-react';

export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubfolder, setSelectedSubfolder] = useState('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Videos
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/videos.json`)
      .then((res) => res.json())
      .then((data) => setVideos(data))
      .catch((err) => console.error('Error loading videos:', err));
  }, []);

  // Import gallery images
  const imageModules = import.meta.glob(
    '/src/assets/gallery/**/*.{png,jpg,jpeg,webp}',
    {
      eager: true,
      import: 'default',
    }
  );

  const formatText = (text: string) =>
    text.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const galleryItems = Object.entries(imageModules).map(
    ([path, image], index) => {
      const cleanPath = path.replace('/src/assets/gallery/', '');
      const parts = cleanPath.split('/');

      const category = parts[0];
      const subfolder = parts.length > 2 ? parts[1] : '';
      const filename = parts[parts.length - 1];

      const title = formatText(filename.replace(/\.[^/.]+$/, ''));

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
    ...Array.from(new Set(galleryItems.map((item) => item.category))).map(
      (cat) => ({
        id: cat,
        label: formatText(cat),
      })
    ),
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
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Gallery
          </h1>

          <p className="text-xl text-gray-200 max-w-2xl mx-auto">
            Tournaments, practice sessions, victories and badminton life at IISc.
          </p>
        </div>
      </section>

      {/* Images */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">

          {/* Categories */}
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

          {/* Subfolders */}
          {subfolders.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center mb-12">
              <button
                onClick={() => setSelectedSubfolder('all')}
                className={`px-5 py-2 rounded-full text-sm font-semibold ${
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
                  onClick={() => setSelectedSubfolder(sub)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold ${
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

          {/* Image Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group bg-white rounded-xl shadow-md hover:shadow-xl overflow-hidden cursor-pointer"
                onClick={() => setSelectedImage(item.image)}
              >
                <div className="h-72 overflow-hidden bg-gray-200">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition"
                  />
                </div>

                <div className="p-5">
                  <div className="flex justify-between mb-3">
                    <h3 className="text-lg font-bold text-blue-900">
                      {item.title}
                    </h3>

                    <Badge className="bg-emerald-500 text-white">
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
        </div>
      </section>

      {/* MATCH VIDEOS */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">

          {/* Heading */}
          <div className="text-center mb-14">
            <h2
              className="text-5xl font-bold text-blue-900 mb-4"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Match Videos
            </h2>

            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Watch tournament highlights, intense rallies, finals, and memorable
              moments from IISc badminton.
            </p>
          </div>

          {/* Videos Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

            {videos.map((video) => (
              <div
                key={video.id}
                className="group bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-500"
              >

                {/* Embedded YouTube */}
                <div className="relative aspect-video overflow-hidden">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${video.videoId}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Content */}
                <div className="p-6">

                  {/* Category */}
                  {video.category && (
                    <div className="mb-3">
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                        {video.category}
                      </span>
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-blue-900 leading-snug group-hover:text-emerald-600 transition">
                    {video.title}
                  </h3>

                </div>
              </div>
            ))}

          </div>

          {/* Empty State */}
          {videos.length === 0 && (
            <div className="text-center mt-12">
              <p className="text-gray-500 text-lg">
                Videos will be uploaded soon.
              </p>
            </div>
          )}

        </div>
      </section>

      {/* Instagram */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
        <div className="container mx-auto px-4 text-center">

          <Instagram className="mx-auto w-10 h-10 text-pink-500 mb-4" />

          <h2 className="text-3xl font-bold text-blue-900 mb-4">
            Follow Us on Instagram
          </h2>

          <a
            href="https://www.instagram.com/iisc.badminton/"
            target="_blank"
            rel="noreferrer"
            className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-3 rounded-full"
          >
            @iisc.badminton
          </a>
        </div>
      </section>

      {/* Image Popup */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          <X className="absolute top-5 right-5 text-white w-8 h-8" />

          <img
            src={selectedImage}
            className="max-h-[90vh] rounded-xl"
          />
        </div>
      )}
    </div>
  );
}