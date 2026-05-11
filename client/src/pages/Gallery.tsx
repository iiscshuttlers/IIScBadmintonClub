import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, X, Youtube, PlayCircle } from 'lucide-react';

export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubfolder, setSelectedSubfolder] = useState('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);

  // Fetch Videos
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
      selectedCategory === 'all' || item.category === selectedCategory;

    const subfolderMatch =
      selectedSubfolder === 'all' || item.subfolder === selectedSubfolder;

    return categoryMatch && subfolderMatch;
  });

  return (
    <div className="min-h-screen font-sans">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-6xl font-bold mb-6"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Gallery
          </h1>
          <p className="text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">
            Relive the intensity of tournaments, the focus of practice, and the 
            vibrant badminton community at IISc.
          </p>
        </div>
      </section>

      {/* Photo Gallery Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          {/* Main Category Filter */}
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedSubfolder('all');
                }}
                className={`px-8 py-2 rounded-full font-bold transition-all duration-300 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sub-folder Filter */}
          {subfolders.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center mb-12 animate-in fade-in slide-in-from-top-4">
              <button
                onClick={() => setSelectedSubfolder('all')}
                className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${
                  selectedSubfolder === 'all'
                    ? 'bg-blue-900 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                All Albums
              </button>
              {subfolders.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubfolder(sub)}
                  className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${
                    selectedSubfolder === sub
                      ? 'bg-blue-900 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer"
                onClick={() => setSelectedImage(item.image)}
              >
                <div className="h-72 overflow-hidden bg-gray-100">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="text-lg font-bold text-blue-900 leading-tight">
                      {item.title}
                    </h3>
                    <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-none shrink-0">
                      {formatText(item.category)}
                    </Badge>
                  </div>
                  {item.subfolder && (
                    <p className="text-gray-500 text-sm italic">
                      {formatText(item.subfolder)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Match Videos Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2
              className="text-5xl font-bold text-blue-900 mb-6"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Match Videos
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              From championship points to training drills, check out the action from our 
              YouTube channel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {videos.map((video) => (
              <div
                key={video.id}
                className="group bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition duration-500"
              >
                <div className="relative aspect-video">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${video.videoId}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-3">
                    <PlayCircle className="w-4 h-4" />
                    {video.category || 'Match Highlight'}
                  </div>
                  <h3 className="text-2xl font-bold text-blue-900 group-hover:text-emerald-600 transition-colors">
                    {video.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 italic text-lg">New videos are being processed. Stay tuned!</p>
            </div>
          )}

          <div className="mt-16 text-center">
             <a 
              href="https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 text-red-600 font-bold hover:text-red-700 transition-colors text-xl"
            >
              <Youtube className="w-8 h-8" />
              Visit our YouTube Channel
            </a>
          </div>
        </div>
      </section>

      {/* Social Media Call-to-Action */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-blue-900 mb-10">Follow the Journey</h2>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
            <a
              href="https://www.instagram.com/iisc.badminton/"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-pink-200 hover:-translate-y-1 transition-all duration-300"
            >
              <Instagram className="w-6 h-6" />
              Instagram
            </a>

            <a
              href="https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-red-600 text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-red-200 hover:-translate-y-1 transition-all duration-300"
            >
              <Youtube className="w-6 h-6" />
              YouTube
            </a>
          </div>
        </div>
      </section>

      {/* Fullscreen Image Overlay */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-all"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white hover:text-emerald-400 transition">
            <X className="w-10 h-10" />
          </button>
          <img
            src={selectedImage}
            className="max-h-[90vh] max-w-full rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            alt="Gallery preview"
          />
        </div>
      )}
    </div>
  );
}