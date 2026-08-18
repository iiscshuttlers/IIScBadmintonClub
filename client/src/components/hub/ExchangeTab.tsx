import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Plus, Search, Filter, Phone, Mail, Clock, Package, MapPin, ExternalLink, Image as ImageIcon, MoreVertical, CheckCircle2, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { CreateListingModal } from "@/components/marketplace/CreateListingModal";
import { InfoModal } from "@/components/InfoModal";
import { safeReplaceState, safeGetSearchParams, safeGetHash, isCapacitor } from "@/lib/navUtils";

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
  listing_type: 'sell' | 'buy';
  fulfilled_by_id: string | null;
  fulfilled_by_name: string | null;
  created_at: string;
  seller: {
    full_name: string;
    avatar_url: string;
    department: string;
    phone: string;
  };
}

export default function ExchangeTab() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("cat") || "All";
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'sell' | 'buy'>(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    if (type === "sell" || type === "buy") return type;
    return 'all';
  });


  const [showSold, setShowSold] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("showSold") === "true";
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setFilter(params.get("cat") || "All");
      const type = params.get("type");
      setTypeFilter(type === "sell" || type === "buy" ? type : "all");
      setShowSold(params.get("showSold") === "true");
    };
    window.addEventListener("popstate", handlePopState);

    const params = safeGetSearchParams();
    
    if (filter === "All") params.delete("cat");
    else params.set("cat", filter);

    if (typeFilter === "all") params.delete("type");
    else params.set("type", typeFilter);

    if (!showSold) params.delete("showSold");
    else params.set("showSold", "true");

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${isCapacitor ? "" : window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    
    if (newUrl !== currentUrl) {
      import("@/lib/navUtils").then(({ safePushState }) => safePushState(newUrl));
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, [filter, typeFilter, showSold]);
  
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const reportListing = async (id: string, title: string) => {
    if (reportedIds.has(id)) { toast.info("Already reported."); return; }
    await supabase.from("admin_logs").insert({
      admin_email: session?.user?.email ?? "anonymous",
      action: "report_listing",
      details: `Reported marketplace listing: "${title}" (id: ${id})`,
    });
    setReportedIds(prev => new Set(prev).add(id));
    toast.success("Listing reported. Our team will review it.");
  };
  const menuRef = useRef<HTMLDivElement>(null);
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
            department
          )
        `)
        .in('status', ['active', 'sold'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data as unknown as Listing[]);
    } catch (err) {
      console.error("Error fetching marketplace:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const logAction = async (action: string) => {
    await supabase.from("admin_logs").insert({
      admin_email: session?.user?.email || "user",
      action,
      created_at: new Date().toISOString(),
    });
  };

  const markAsSold = async (id: string) => {
    setBusyId(id);
    setMenuOpenId(null);
    const listing = listings.find(l => l.id === id);
    const { error } = await supabase.from('marketplace_listings').update({ status: 'sold' }).eq('id', id);
    if (error) { toast.error("Failed to mark as sold"); } else {
      toast.success("Listing marked as sold!");
      setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'sold' } : l));
      if (listing) logAction(`Marked marketplace item sold: ${listing.title}`);
    }
    setBusyId(null);
  };

  const fulfillRequest = async (id: string) => {
    setBusyId(id);
    try {
      const { data: profile } = await supabase.from('players').select('id, full_name').eq('id', session?.user?.id).single();
      if (!profile) throw new Error("Could not fetch your profile.");
      
      const { error } = await supabase.rpc("fulfill_marketplace_request", {
        listing_uuid: id,
        claimer_id: profile.id,
        claimer_name: profile.full_name
      });
      if (error) throw error;
      
      toast.success("Request fulfilled! You have claimed this request.");
      setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'sold', fulfilled_by_id: profile.id, fulfilled_by_name: profile.full_name } : l));
    } catch (err: any) {
      toast.error(err.message || "Failed to fulfill request");
    } finally {
      setBusyId(null);
    }
  };

  const deleteListing = async (id: string) => {
    setMenuOpenId(null);
    if (!confirm("Delete this listing permanently?")) return;
    setBusyId(id);
    const listing = listings.find(l => l.id === id);
    const { error } = await supabase.from('marketplace_listings').delete().eq('id', id);
    if (error) { toast.error("Failed to delete listing"); } else {
      toast.success("Listing deleted.");
      setListings(prev => prev.filter(l => l.id !== id));
      if (listing) await logAction(`Deleted marketplace listing "${listing.title}"`);
    }
    setBusyId(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    fetchListings();
  }, []);

  usePullToRefresh();

  const categories = ["All", "Racket", "Shoes", "Shuttlecocks", "Accessories", "Other"];
  const filteredListings = listings
    .filter(l => showSold ? true : l.status === 'active')
    .filter(l => filter === "All" ? true : l.category === filter)
    .filter(l => typeFilter === 'all' ? true : l.listing_type === typeFilter);
  return (
    <div className="w-full">
      {!session ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-sm m-4 mt-8">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            <Store className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">Sign in to view Marketplace</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            You must be logged in to buy, sell, or view items in this section.
          </p>
          <button 
            onClick={() => setLocation('/join')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-6 h-11 transition"
          >
            Sign In / Join
          </button>
        </div>
      ) : (
        <>
      {/* Header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-14 z-30 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-lg font-black text-slate-800 dark:text-foreground tracking-tight">Marketplace</h1>
                <InfoModal
                  title="MARKETPLACE EXCHANGE"
                  items={[
                    { badge: "SELL", title: "Selling Gear", desc: "List your old rackets, shoes, or shuttles. Buyers will contact you directly via phone or email." },
                    { badge: "BUY", title: "Requesting Gear", desc: "Post what you are looking for. Anyone who has it can click 'I Have This' to fulfill your request." },
                    { badge: "SAFETY", title: "Safe Exchange", desc: "We recommend exchanging items and payment in person at the badminton courts." }
                  ]}
                />
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-sm shadow-primary/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Create Listing
              </button>
            </div>

            {/* Categories and Filters */}
            <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3">
              {/* Top Row: Type Filter & Sold Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full shrink-0">
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={`px-3 py-1 text-xs font-black rounded-full transition-all ${typeFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow-sm' : 'text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTypeFilter('sell')}
                    className={`px-3 py-1 text-xs font-black rounded-full transition-all ${typeFilter === 'sell' ? 'bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary shadow-sm' : 'text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300'}`}
                  >
                    Selling
                  </button>
                  <button
                    onClick={() => setTypeFilter('buy')}
                    className={`px-3 py-1 text-xs font-black rounded-full transition-all ${typeFilter === 'buy' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300'}`}
                  >
                    Requests
                  </button>
                </div>
                
                {/* Toggle Sold Items */}
                <button
                  onClick={() => setShowSold(s => !s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                    showSold
                      ? 'bg-slate-500 text-on-accent shadow-sm'
                      : 'bg-slate-100 text-muted-foreground hover:bg-slate-200 dark:bg-slate-800 dark:text-muted-foreground dark:hover:bg-slate-700'
                  }`}
                >
                  {showSold ? "✓ Showing Sold" : "Show Sold"}
                </button>
              </div>

              {/* Bottom Row: Category Filters */}
              <div className="grid grid-cols-3 md:flex md:flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`px-1 sm:px-4 py-1.5 rounded-full text-xs font-black transition-all truncate text-center ${
                      filter === cat
                        ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 text-muted-foreground hover:bg-slate-200 dark:bg-slate-800 dark:text-muted-foreground dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
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
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-slate-300 dark:text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-foreground mb-2">No items found</h3>
            <p className="text-muted-foreground dark:text-muted-foreground">Be the first to list an item in this category!</p>
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
                  className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group hover:shadow-md transition-shadow flex flex-col relative ${item.status === 'sold' ? 'opacity-60' : ''}`}
                >
                  {/* SOLD stamp */}
                  {item.status === 'sold' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                      <div className="rotate-[-20deg] border-4 border-rose-500 text-rose-500 text-3xl font-black px-4 py-1 rounded-lg opacity-80 tracking-widest">
                        SOLD
                      </div>
                    </div>
                  )}

                  {/* Image Area */}
                  <div className="h-48 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
                    )}
                    <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-slate-300 z-20">
                      {item.condition}
                    </div>
                    {item.listing_type === 'buy' && (
                      <div className="absolute inset-0 z-10 bg-indigo-900/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <div className="bg-indigo-600 text-on-accent text-lg font-black px-4 py-1.5 rounded-lg shadow-lg rotate-[-10deg] tracking-widest border-2 border-white/20">
                          WANT TO BUY
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-bold text-slate-800 dark:text-foreground leading-tight line-clamp-2 text-lg">
                        {item.title}
                      </h3>
                      <div className="font-black text-primary dark:text-primary text-lg whitespace-nowrap">
                        {item.listing_type === 'buy' 
                          ? (item.price === 0 ? "Open Budget" : `Max ₹${item.price}`) 
                          : (item.price === 0 ? "Giveaway" : `₹${item.price}`)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground line-clamp-2 mb-4 flex-1">
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
                            <p className="text-xs font-bold text-slate-800 dark:text-foreground">{safeName}</p>
                            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground font-medium">
                              {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {session?.user?.id !== item.seller_id ? (
                        item.status !== 'sold' ? (
                          item.listing_type === 'sell' ? (
                            <div className="flex gap-2">
                              <a
                                href={`mailto:${safeName.replace(/\s+/g, '.').toLowerCase()}@iisc.ac.in?subject=Marketplace: ${encodeURIComponent(item.title)}`}
                                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors"
                              >
                                <Mail className="w-3.5 h-3.5" /> Contact
                              </a>
                              <button
                                onClick={() => reportListing(item.id, item.title)}
                                title="Report this listing"
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center transition-colors ${reportedIds.has(item.id) ? "bg-slate-100 dark:bg-slate-800 text-muted-foreground cursor-default" : "bg-rose-50 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50"}`}
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => fulfillRequest(item.id)}
                                disabled={busyId === item.id}
                                className="flex-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                              >
                                {busyId === item.id ? <Package className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                I Have This
                              </button>
                              <button
                                onClick={() => reportListing(item.id, item.title)}
                                title="Report this listing"
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center transition-colors ${reportedIds.has(item.id) ? "bg-slate-100 dark:bg-slate-800 text-muted-foreground cursor-default" : "bg-rose-50 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50"}`}
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        ) : (
                          item.listing_type === 'buy' && item.fulfilled_by_name && (
                            <div className="flex gap-2">
                              <span
                                title={`Offered by ${item.fulfilled_by_name}`}
                                className="flex-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-default truncate px-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Offered by {item.fulfilled_by_name}
                              </span>
                            </div>
                          )
                        )
                      ) : (
                        <div className="relative" ref={menuOpenId === item.id ? menuRef : undefined}>
                          <button
                            disabled={busyId === item.id}
                            onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                            className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 py-2 rounded-xl text-xs font-black transition disabled:opacity-50"
                          >
                            <MoreVertical className="w-3.5 h-3.5" /> Manage Listing
                          </button>
                          {menuOpenId === item.id && (
                            <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-20 overflow-hidden">
                              {item.status !== 'sold' && (
                                <button
                                  onClick={() => markAsSold(item.id)}
                                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10 dark:hover:bg-primary/80/20 transition"
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Mark as Sold
                                </button>
                              )}
                              <button
                                onClick={() => deleteListing(item.id)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                              >
                                <Trash2 className="w-4 h-4" /> Delete Listing
                              </button>
                            </div>
                          )}
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
        </>
      )}

      {session?.user && (
        <CreateListingModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          sellerId={session.user.id}
          onSuccess={fetchListings}
        />
      )}

    </div>
  );
}
