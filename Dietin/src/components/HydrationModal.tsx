import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassWater, Plus, Minus, X } from 'lucide-react';
import { useProgressStore } from '@/stores/progressStore';
import { toast } from 'sonner';
import { hydrationSchema } from '@/lib/validation/schemas';

interface HydrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HydrationModal: React.FC<HydrationModalProps> = ({ isOpen, onClose }) => {
  const { hydrationDaily, recordHydration } = useProgressStore();
  const todayKey = new Date().toISOString().split('T')[0];
  
  // Initialize from store if available
  const [currentWater, setCurrentWater] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const dailyGoal = 2500;

  useEffect(() => {
    if (isOpen) {
      setCurrentWater(hydrationDaily[todayKey] || 0);
    }
  }, [isOpen, hydrationDaily, todayKey]);

  const updateWater = async (amount: number) => {
    const newWater = Math.max(0, currentWater + amount);
    setCurrentWater(newWater);
    await recordHydration(newWater, { goalMl: dailyGoal });
  };

  const handleSave = async () => {
    try {
      await recordHydration(currentWater, { goalMl: dailyGoal });
      toast.success('Hydration updated');
      onClose();
    } catch (error) {
      toast.error('Failed to update hydration');
    }
  };

  const handleCustomAdd = () => {
    const parsed = hydrationSchema.safeParse({ amountMl: Number(customAmount) });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Enter an amount between 1 and 10000 ml');
      return;
    }
    updateWater(parsed.data.amountMl);
    setCustomAmount('');
  };

  const progress = Math.min(100, Math.round((currentWater / dailyGoal) * 100));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200, duration: 0.25 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl z-[10000] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Handle bar for bottom sheet */}
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            <div className="px-6 pb-8 pt-2 overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2"
                >
                  <X className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 absolute left-1/2 -translate-x-1/2">
                  Hydration
                </h2>
                <div className="w-10" /> {/* Spacer for alignment */}
              </div>

              {/* Summary Section */}
              <div className="flex flex-col items-center mb-10 relative">
                {/* Live Hydration Ring */}
                <div className="relative w-32 h-32 mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#f3f4f6"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <motion.circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={351.86}
                      initial={{ strokeDashoffset: 351.86 }}
                      animate={{ strokeDashoffset: 351.86 * (1 - progress / 100) }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center">
                      <GlassWater className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">Today's Intake</p>
                  <div className="text-4xl font-bold text-gray-900 tracking-tight flex items-baseline justify-center gap-1">
                    {currentWater}
                    <span className="text-xl text-gray-500">/ {dailyGoal} ml</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full">
                    <span className="text-sm font-semibold text-blue-600">{progress}%</span>
                    <span className="text-xs text-blue-500 font-medium">Goal</span>
                  </div>
                </div>
              </div>

              {/* Quick Adjust */}
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Quick Adjust</h3>
                
                {/* 250ml Option */}
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                  <button
                    onClick={() => updateWater(-250)}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                  >
                    <Minus className="w-5 h-5 text-gray-900" />
                  </button>
                  <span className="text-lg font-semibold text-gray-900">250 ml</span>
                  <button
                    onClick={() => updateWater(250)}
                    className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* 500ml Option */}
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                  <button
                    onClick={() => updateWater(-500)}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                  >
                    <Minus className="w-5 h-5 text-gray-900" />
                  </button>
                  <span className="text-lg font-semibold text-gray-900">500 ml</span>
                  <button
                    onClick={() => updateWater(500)}
                    className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Custom Amount */}
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Custom Amount</h3>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Enter ml"
                      className="w-full h-14 bg-gray-50 rounded-2xl px-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleCustomAdd}
                    disabled={!customAmount || parseInt(customAmount) <= 0}
                    className="h-14 px-8 bg-gray-900 text-white rounded-2xl font-semibold disabled:opacity-50 active:scale-95 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Footer CTA */}
              <button
                onClick={handleSave}
                className="w-full h-14 bg-blue-500 text-white rounded-2xl text-lg font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-transform"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default HydrationModal;
