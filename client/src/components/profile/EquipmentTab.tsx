import React from "react";
import { motion } from "framer-motion";

interface EquipmentTabProps {
  rackets: any[];
  setRackets: (val: any[]) => void;
  primaryRacketIndex: number;
  setPrimaryRacketIndex: (val: number) => void;
  shoesList: any[];
  setShoesList: (val: any[]) => void;
  primaryShoeIndex: number;
  setPrimaryShoeIndex: (val: number) => void;
  apparel: string;
  setApparel: (val: string) => void;
}

export function EquipmentTab({
  rackets,
  setRackets,
  primaryRacketIndex,
  setPrimaryRacketIndex,
  shoesList,
  setShoesList,
  primaryShoeIndex,
  setPrimaryShoeIndex,
  apparel,
  setApparel,
}: EquipmentTabProps) {
  return (
    <motion.div
      key="equipment"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Multiple Rackets Arsenal */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300">
            Rackets in your Bag (Equipment Arsenal)
          </label>
          <button
            type="button"
            onClick={() =>
              setRackets([...rackets, { name: "", string: "", tension: "" }])
            }
            className="text-xs font-bold text-primary hover:text-primary dark:text-primary flex items-center gap-1 bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/30 dark:border-primary/30 transition shadow-sm"
          >
            + Add Racket
          </button>
        </div>

        <div className="space-y-4">
          {rackets.map((item, index) => (
            <div
              key={index}
              className={`p-4 border rounded-2xl relative space-y-4 shadow-sm transition-all
              ${
                index === primaryRacketIndex
                  ? "bg-primary/10/30 dark:bg-primary/10 border-primary/50 dark:border-primary/80"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex justify-between items-center pr-12">
                {/* Primary Selection */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="primaryRacket"
                    checked={index === primaryRacketIndex}
                    onChange={() => setPrimaryRacketIndex(index)}
                    className="w-4 h-4 text-primary focus:ring-primary border-slate-300"
                  />
                  <span className="text-xs font-bold text-muted-foreground dark:text-slate-300">
                    Set as Primary Racket
                  </span>
                </label>

                {rackets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRackets(rackets.filter((_, idx) => idx !== index));
                      if (primaryRacketIndex === index) setPrimaryRacketIndex(0);
                      else if (primaryRacketIndex > index)
                        setPrimaryRacketIndex(primaryRacketIndex - 1);
                    }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 transition"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                  Racket Name
                </label>
                <input
                  type="text"
                  required
                  value={item.name}
                  onChange={(e) => {
                    const updated = [...rackets];
                    updated[index].name = e.target.value;
                    setRackets(updated);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Yonex Astrox 99 Pro"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                    String Model
                  </label>
                  <input
                    type="text"
                    value={item.string}
                    onChange={(e) => {
                      const updated = [...rackets];
                      updated[index].string = e.target.value;
                      setRackets(updated);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Yonex BG80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                    Tension (lbs)
                  </label>
                  <input
                    type="number"
                    value={item.tension}
                    onChange={(e) => {
                      const updated = [...rackets];
                      updated[index].tension = e.target.value;
                      setRackets(updated);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. 26"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multiple Shoes Arsenal */}
      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300">
            Footwear / Shoes Arsenal
          </label>
          <button
            type="button"
            onClick={() => setShoesList([...shoesList, { name: "" }])}
            className="text-xs font-bold text-primary hover:text-primary dark:text-primary flex items-center gap-1 bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/30 dark:border-primary/30 transition shadow-sm"
          >
            + Add Shoe
          </button>
        </div>

        <div className="space-y-4">
          {shoesList.map((item, index) => (
            <div
              key={index}
              className={`p-4 border rounded-2xl relative space-y-4 shadow-sm transition-all
              ${
                index === primaryShoeIndex
                  ? "bg-primary/10/30 dark:bg-primary/10 border-primary/50 dark:border-primary/80"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex justify-between items-center pr-12">
                {/* Primary Selection */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="primaryShoe"
                    checked={index === primaryShoeIndex}
                    onChange={() => setPrimaryShoeIndex(index)}
                    className="w-4 h-4 text-primary focus:ring-primary border-slate-300"
                  />
                  <span className="text-xs font-bold text-muted-foreground dark:text-slate-300">
                    Set as Primary Shoe
                  </span>
                </label>

                {shoesList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShoesList(shoesList.filter((_, idx) => idx !== index));
                      if (primaryShoeIndex === index) setPrimaryShoeIndex(0);
                      else if (primaryShoeIndex > index)
                        setPrimaryShoeIndex(primaryShoeIndex - 1);
                    }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 transition"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">
                  Shoe Model Name
                </label>
                <input
                  type="text"
                  required
                  value={item.name}
                  onChange={(e) => {
                    const updated = [...shoesList];
                    updated[index].name = e.target.value;
                    setShoesList(updated);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Yonex Power Cushion 65 Z3"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
          Preferred Apparel / Gear Brand
        </label>
        <input
          type="text"
          value={apparel}
          onChange={(e) => setApparel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none"
          placeholder="e.g. Yonex, Li-Ning"
        />
      </div>
    </motion.div>
  );
}
