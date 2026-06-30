import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Dumbbell, Wheat, Droplet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface DynamicMacroRingProps {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
}

export const DynamicMacroRing = ({
  calories, calorieGoal,
  protein, proteinGoal,
  carbs, carbsGoal,
  fat, fatGoal
}: DynamicMacroRingProps) => {
  const { t } = useTranslation();
  
  const calPercent = Math.min((calories / (calorieGoal || 1)) * 100, 100);
  const proPercent = Math.min((protein / (proteinGoal || 1)) * 100, 100);
  const carbPercent = Math.min((carbs / (carbsGoal || 1)) * 100, 100);
  const fatPercent = Math.min((fat / (fatGoal || 1)) * 100, 100);

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (calPercent / 100) * circumference;

  return (
    <div className="relative w-full max-w-sm mx-auto flex flex-col items-center">
      <div className="relative flex justify-center items-center w-[240px] h-[240px] drop-shadow-xl">
        {/* Background ring */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100" cy="100" r={radius}
            className="stroke-gray-100 dark:stroke-white/5"
            strokeWidth="12" fill="none"
          />
          <motion.circle
            cx="100" cy="100" r={radius}
            className="stroke-[#007AFF] drop-shadow-md"
            strokeWidth="12" fill="none"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1 text-gray-500 dark:text-gray-400">
              <Flame className="w-4 h-4 text-[#FF3B30]" />
              <span className="text-xs font-medium uppercase tracking-wider">{t('diet.calories')}</span>
            </div>
            <div className="text-4xl font-bold tracking-tighter text-gray-900 dark:text-white flex items-baseline justify-center gap-1">
              {Math.round(calories)}
              <span className="text-lg font-medium text-gray-400">/ {Math.round(calorieGoal)}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Macros breakdown row */}
      <div className="w-full grid grid-cols-3 gap-3 mt-6">
        <MacroCard 
          icon={<Dumbbell className="w-4 h-4 text-emerald-500" />} 
          label={t('diet.protein')} 
          value={protein} 
          goal={proteinGoal} 
          percent={proPercent} 
          colorClass="bg-emerald-500"
          bgClass="bg-emerald-50 dark:bg-emerald-500/10"
        />
        <MacroCard 
          icon={<Wheat className="w-4 h-4 text-amber-500" />} 
          label={t('diet.carbs')} 
          value={carbs} 
          goal={carbsGoal} 
          percent={carbPercent} 
          colorClass="bg-amber-500"
          bgClass="bg-amber-50 dark:bg-amber-500/10"
        />
        <MacroCard 
          icon={<Droplet className="w-4 h-4 text-sky-500" />} 
          label={t('diet.fat')} 
          value={fat} 
          goal={fatGoal} 
          percent={fatPercent} 
          colorClass="bg-sky-500"
          bgClass="bg-sky-50 dark:bg-sky-500/10"
        />
      </div>
    </div>
  );
};

const MacroCard = ({ icon, label, value, goal, percent, colorClass, bgClass }: any) => (
  <div className={cn("p-3 rounded-2xl border border-gray-100 dark:border-white/10 flex flex-col items-center gap-2", bgClass)}>
    <div className="flex items-center gap-1.5 w-full justify-center opacity-80">
      {icon}
      <span className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 tracking-wider">{label}</span>
    </div>
    <div className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-none">
      {Math.round(value)}<span className="text-xs font-medium text-gray-500 dark:text-gray-400">g</span>
    </div>
    <div className="w-full bg-white/50 dark:bg-black/20 h-1.5 rounded-full overflow-hidden mt-1 shadow-inner">
      <motion.div 
        className={cn("h-full rounded-full", colorClass)}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 1, delay: 0.5 }}
      />
    </div>
  </div>
);
