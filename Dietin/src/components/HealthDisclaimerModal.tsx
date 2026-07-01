import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Sparkles, Activity, Asterisk } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface HealthDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

export default function HealthDisclaimerModal({ isOpen, onClose, onAgree }: HealthDisclaimerModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[99999]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-[100000] bg-white rounded-t-[32px] pt-4 pb-8 px-6 max-h-[90vh] overflow-y-auto font-['SF Pro Display']"
          >
            {/* Header */}
            <div className="relative flex items-center justify-center mb-6">
              <button
                onClick={onClose}
                className="absolute left-0 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={20} className="text-gray-900" />
              </button>
              <h2 className="text-lg font-bold text-gray-900">Health Disclaimer</h2>
            </div>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-blue-50 rounded-[24px] flex items-center justify-center">
                <Asterisk size={40} className="text-blue-500" strokeWidth={3} />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[28px] leading-tight font-extrabold text-[#1a1f2e] text-center mb-8">
              Important Health Notice
            </h1>

            {/* Content box */}
            <div className="bg-gray-50 rounded-[24px] p-6 space-y-8 mb-8">
              {/* Item 1 */}
              <div className="flex gap-4">
                <div className="mt-1">
                  <Activity size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Not Medical Advice</h3>
                  <p className="text-gray-500 text-[15px] leading-snug">
                    Consult a professional before changing your diet. This app is for tracking, not diagnosis.
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex gap-4">
                <div className="mt-1">
                  <Sparkles size={24} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">AI Estimations</h3>
                  <p className="text-gray-500 text-[15px] leading-snug">
                    Nutritional values are estimates and not 100% guaranteed.
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex gap-4">
                <div className="mt-1">
                  <ShieldCheck size={24} className="text-teal-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Verified Sources</h3>
                  <p className="text-gray-500 text-[15px] leading-snug">
                    Calculations follow WHO, USDA, and official health standards.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Links */}
            <div className="flex justify-center gap-3 text-[13px] text-gray-500 font-medium mb-6">
              <button className="underline underline-offset-2">Privacy</button>
              <span>•</span>
              <button className="underline underline-offset-2">Terms</button>
            </div>

            {/* Agree Button */}
            <button
              onClick={onAgree}
              className="w-full bg-[#1a1f2e] text-white rounded-full py-4 text-[17px] font-semibold hover:bg-black transition-colors"
            >
              I Understand & Agree
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
