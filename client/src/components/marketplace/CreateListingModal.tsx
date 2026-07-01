import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Tag, MapPin, IndianRupee, Image as ImageIcon, CheckCircle, Package } from "lucide-react";

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerId: string;
  onSuccess: () => void;
}

export function CreateListingModal({ isOpen, onClose, sellerId, onSuccess }: CreateListingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGiveaway, setIsGiveaway] = useState(false);
  const [listingType, setListingType] = useState<'sell' | 'buy'>('sell');
  const { register, handleSubmit, formState: { errors }, reset, getValues } = useForm();

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const priceVal = isGiveaway ? 0 : Math.max(0, parseFloat(data.price) || 0);
      
      const { error } = await supabase.from('marketplace_listings').insert({
        seller_id: sellerId,
        title: data.title,
        description: data.description,
        price: priceVal,
        condition: data.condition,
        category: data.category,
        image_url: data.image_url || null,
        status: 'active',
        listing_type: listingType
      });

      if (error) throw error;
      
      toast.success("Item listed successfully!");
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to list item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-xl">
            <Package className={`w-5 h-5 ${listingType === 'sell' ? 'text-primary' : 'text-indigo-500'}`} />
            {listingType === 'sell' ? 'Sell Equipment' : 'Request Equipment'}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setListingType('sell')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${listingType === 'sell' ? 'bg-white dark:bg-slate-700 text-primary dark:text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Selling an Item
          </button>
          <button
            type="button"
            onClick={() => setListingType('buy')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${listingType === 'buy' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Looking to Buy
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
              {listingType === 'sell' ? 'Item Name' : 'What are you looking for?'}
            </label>
            <input 
              {...register("title", { required: true })} 
              placeholder={listingType === 'sell' ? "e.g. Yonex Astrox 99 Pro" : "e.g. Size 9 Yonex Shoes"}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.title && <span className="text-xs text-rose-500 mt-1 block">Title is required</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  {listingType === 'sell' ? 'Price (₹)' : 'Max Budget (₹)'}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className={`rounded ${listingType === 'sell' ? 'text-primary focus:ring-primary' : 'text-indigo-500 focus:ring-indigo-500'} border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800`} onChange={(e) => {
                    const isFree = e.target.checked;
                    setIsGiveaway(isFree);
                    if (isFree) reset({ ...getValues(), price: 0 });
                  }} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {listingType === 'sell' ? 'Giveaway' : 'Negotiable'}
                  </span>
                </label>
              </div>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="number"
                  disabled={isGiveaway}
                  {...register("price", { required: !isGiveaway, min: { value: 0, message: "Price cannot be negative" } })} 
                  placeholder={isGiveaway ? "0 (Free)" : "2500"}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
              {errors.price && <span className="text-xs text-rose-500 mt-1 block">{(errors.price as any).message || "Invalid price"}</span>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
                {listingType === 'sell' ? 'Condition' : 'Desired Condition'}
              </label>
              <select 
                {...register("condition", { required: true })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
              >
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Used">Used</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {['Racket', 'Shoes', 'Shuttlecocks', 'Accessories', 'Other'].map(cat => (
                <label key={cat} className="cursor-pointer">
                  <input type="radio" value={cat} {...register("category", { required: true })} className="peer sr-only" defaultChecked={cat === 'Racket'} />
                  <div className={`px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 ${listingType === 'sell' ? 'peer-checked:bg-primary peer-checked:border-primary' : 'peer-checked:bg-indigo-500 peer-checked:border-indigo-500'} peer-checked:text-white transition-all`}>
                    {cat}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Description</label>
            <textarea 
              {...register("description", { required: true })} 
              placeholder="Describe the item (age, any stringing details, exact condition, why selling...)"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Image URL (Optional)</label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                {...register("image_url")} 
                placeholder="https://example.com/image.jpg"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full mt-4 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${listingType === 'sell' ? 'bg-primary hover:bg-primary shadow-primary/25' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/25'}`}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" /> {listingType === 'sell' ? 'Post Listing' : 'Post Request'}
              </>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
