import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Plus, Search, Filter, Phone, Mail, Clock, Package, MapPin, ExternalLink, Image as ImageIcon } from "lucide-react";
import { CreateListingModal } from "@/components/marketplace/CreateListingModal";
import FindLost from "@/pages/FindLost";

interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  category: string;
  image_url: string;
  status: string;
  created_at: string;
  seller: {
    full_name: string;
    avatar_url: string;
    department: string;
    phone: string;
  };
}

export default function Marketplace() {
  const { session } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"marketplace" | "findlost">(() => {
    return window.location.pathname.includes("find-lost") || window.location.hash.includes("lost") ? "findlost" : "marketplace";
  });

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select(`
          *,
          seller:seller_id (
            full_name,
            avatar_url,
            department,
            phone
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data as Listing[]);
    } catch (err) {
      console.error("Error fetching marketplace:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  usePullToRefresh();

  const categories = ["All", "Racket", "Shoes", "Shuttlecocks", "Accessories", "Other"];
  const filteredListings = filter === "All" ? listings : listings.filter(l => l.category === filter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-safe pb-24">
      {/* Top Tab Bar for Unified Noticeboard */}
      <div className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-center gap-2">
          <button 
            onClick={() => { setActiveTab("marketplace"); window.history.replaceState({}, '', '/exchange#buy-sell'); }} 
            className={`px-5 py-2 rounded-xl font-black text-sm transition-all ${
              activeTab === "marketplace" 
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80"
            }`}
          >
            🛍️ Buy & Sell
          </button>
          <button 
            onClick={() => { setActiveTab("findlost"); window.history.replaceState({}, '', '/exchange#lost-found'); }} 
            className={`px-5 py-2 rounded-xl font-black text-sm transition-all ${
              activeTab === "findlost" 
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80"
            }`}
          >
            🔍 Lost & Found
          </button>
        </div>
      </div>

      {activeTab === "marketplace" ? (
        <>
          {/* Header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-14 z-30 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Store className="w-5 h-5 text-emerald-500" />
                </div>
                <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Exchange</h1>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Post Item
              </button>
            </div>

            {/* Categories Scroller */}
            <div className="max-w-5xl mx-auto px-4 py-3 grid grid-cols-2 md:flex md:flex-wrap items-center gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                    filter === cat 
                      ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

      <div className="max-w-5xl mx-auto px-4 pt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl h-80 animate-pulse border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No items found</h3>
            <p className="text-slate-500 dark:text-slate-400">Be the first to list an item in this category!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredListings.map((item) => {
                const seller = Array.isArray(item.seller) ? item.seller[0] : item.seller;
                if (!seller) return null;
                const safeName = seller.full_name || "Unknown User";

                return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={item.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Image Area */}
                  <div className="h-48 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                    )}
                    <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {item.condition}
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-bold text-slate-800 dark:text-white leading-tight line-clamp-2 text-lg">
                        {item.title}
                      </h3>
                      <div className="font-black text-emerald-600 dark:text-emerald-400 text-lg whitespace-nowrap">
                        {item.price === 0 ? "Giveaway" : `₹${item.price}`}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                      {item.description}
                    </p>

                    {/* Footer / Seller info */}
                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <img 
                            src={seller.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=10b981&color=fff`} 
                            alt={safeName} 
                            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">{safeName}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {session?.user?.id !== item.seller_id ? (
                        <div className="flex gap-2">
                          <a 
                            href={`mailto:${safeName.replace(/\s+/g, '.').toLowerCase()}@iisc.ac.in?subject=Marketplace: ${encodeURIComponent(item.title)}`}
                            className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" /> Contact
                          </a>
                        </div>
                      ) : (
                        <div className="text-center bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 py-2 rounded-xl text-xs font-black uppercase tracking-wider">
                          Your Listing
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {session?.user && (
        <CreateListingModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          sellerId={session.user.id}
          onSuccess={fetchListings}
        />
      )}
      </>
      ) : (
        <FindLost />
      )}
    </div>
  );
}
