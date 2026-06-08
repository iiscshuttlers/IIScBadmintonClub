import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationAuth } from '@/hooks/useNavigationAuth';
import { optimizeImage } from '@/lib/imageUtils';

const CATEGORIES = [
  { id: 'MS', label: "Men's Singles", price: 150 },
  { id: 'WS', label: "Women's Singles", price: 150 },
  { id: 'MD', label: "Men's Doubles", price: 300 },
  { id: 'WD', label: "Women's Doubles", price: 300 },
  { id: 'XD', label: "Mixed Doubles", price: 300 },
];

export default function InvictaRegistrationForm({ onClose }: { onClose?: () => void }) {
  const { session } = useAuth();
  const { myPlayerId, userName } = useNavigationAuth();
  
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [partnerNames, setPartnerNames] = useState<Record<string, string>>({});
  const [transactionId, setTransactionId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const totalAmount = selectedCats.reduce((sum, catId) => sum + CATEGORIES.find(c => c.id === catId)!.price, 0);

  const toggleCat = (catId: string) => {
    setSelectedCats(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handlePartnerChange = (catId: string, val: string) => {
    setPartnerNames(prev => ({ ...prev, [catId]: val }));
  };

  const submitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return setError("You must be logged in to register.");
    if (selectedCats.length === 0) return setError("Please select at least one category.");
    if (!transactionId.trim()) return setError("Transaction ID is required.");
    if (!receiptFile) return setError("Payment screenshot is required.");

    setLoading(true);
    setError(null);

    try {
      // Optimize receipt image (converts HEIC -> JPEG -> WebP)
      const optimizedFile = await optimizeImage(receiptFile, 1200, 0.85);

      // 1. Upload receipt
      const fileName = `${session.user.id}_${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('invicta_receipts')
        .upload(fileName, optimizedFile, { contentType: 'image/webp' });
        
      if (uploadError) throw new Error("Receipt upload failed: " + uploadError.message);

      // 2. Save registration data
      const { error: dbError } = await supabase.from('tournament_registrations').insert({
        player_id: myPlayerId,
        user_id: session.user.id,
        full_name: userName || session.user.email,
        email: session.user.email,
        categories: selectedCats,
        partner_names: partnerNames,
        transaction_id: transactionId,
        receipt_path: fileName,
        status: 'pending'
      });

      if (dbError) throw new Error("Failed to submit entry: " + dbError.message);

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center">
        <h3 className="text-2xl font-black mb-2 text-slate-800 dark:text-white">Sign In Required</h3>
        <p className="text-slate-500 mb-6">You must be logged in to register for Invicta.</p>
        <button onClick={() => window.location.href = '/join'} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-500/20">
          Sign In Now
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500 rounded-3xl p-10 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-emerald-500/10 blur-3xl rounded-full" />
        <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-6 relative z-10" />
        <h3 className="text-3xl font-black mb-3 text-emerald-900 dark:text-emerald-400 relative z-10">Registration Received!</h3>
        <p className="text-emerald-700 dark:text-emerald-500 mb-8 max-w-sm mx-auto relative z-10">
          Your payment is being verified by our team. You will be notified once your entry is confirmed.
        </p>
        {onClose && (
          <button onClick={onClose} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg relative z-10">
            Close Form
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <form onSubmit={submitRegistration} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl relative text-left">
      {onClose && (
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition">
          <X className="w-5 h-5" />
        </button>
      )}

      <h2 className="text-3xl font-black mb-2 text-slate-900 dark:text-white">Tournament Registration</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Select your events and upload payment details below.</p>

      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* 1. Categories */}
      <div className="space-y-4 mb-8">
        <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">1. Select Events</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map(cat => {
            const isSelected = selectedCats.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCat(cat.id)}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                  isSelected 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400' 
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-emerald-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                    {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <span className="font-bold text-sm">{cat.label}</span>
                </div>
                <span className="font-bold text-sm">₹{cat.price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Partner Details (conditionally rendered) */}
      <AnimatePresence>
        {selectedCats.some(c => c.endsWith('D')) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 mb-8 overflow-hidden">
            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Partner Details</label>
            {selectedCats.filter(c => c.endsWith('D')).map(catId => (
              <div key={catId} className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{CATEGORIES.find(c => c.id === catId)?.label} Partner</span>
                <input 
                  required
                  value={partnerNames[catId] || ''}
                  onChange={e => handlePartnerChange(catId, e.target.value)}
                  placeholder="Enter partner's full name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Payment Section */}
      {selectedCats.length > 0 && (
        <div className="space-y-6 mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-600 dark:text-slate-400">Total Amount to Pay:</span>
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">₹{totalAmount}</span>
          </div>
          
          <div className="space-y-4">
            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">2. Payment Details</label>
            <p className="text-sm text-slate-600 dark:text-slate-400">Please UPI <strong>₹{totalAmount}</strong> to <strong className="text-slate-900 dark:text-white">invicta@upi</strong> and upload the receipt below.</p>
            
            <input 
              required
              value={transactionId}
              onChange={e => setTransactionId(e.target.value)}
              placeholder="UPI Transaction ID / UTR"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition cursor-pointer">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {receiptFile ? receiptFile.name : 'Click to upload payment screenshot'}
              </span>
              <input type="file" required accept="image/*,.pdf" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading || selectedCats.length === 0}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Complete Registration <ArrowRight className="w-5 h-5" /></>}
      </button>
    </form>
  );
}
