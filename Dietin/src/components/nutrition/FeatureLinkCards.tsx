import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Droplet, TrendingUp, ArrowRight, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export const FeatureLinkCards = ({ calories, calorieGoal, user }: any) => {
  const { t } = useTranslation();
  
  // Fake mock logic for burn (would normally pull from Burn/Progress store)
  const activeBurned = 350; 
  const netCalories = calories - activeBurned;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      
      {/* Burn Link Card */}
      <Link to="/burn">
        <motion.div 
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
          className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all h-full relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame className="w-20 h-20 text-[#FF3B30]" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#FF3B30]/10 rounded-xl">
              <Flame className="w-5 h-5 text-[#FF3B30]" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Net Calories</h3>
          </div>
          <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
            {netCalories > 0 ? netCalories : 0} <span className="text-sm font-medium text-gray-500">kcal</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[85%]">
            Consumed {Math.round(calories)} - Burned {activeBurned}. 
            <span className="text-[#FF3B30] font-medium ml-1">View Burn &rarr;</span>
          </p>
        </motion.div>
      </Link>

      {/* Hydration Link Card */}
      <Link to="/hydration">
        <motion.div 
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
          className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all h-full relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Droplet className="w-20 h-20 text-[#007AFF]" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#007AFF]/10 rounded-xl">
              <Droplet className="w-5 h-5 text-[#007AFF]" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Hydration Sync</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 leading-relaxed max-w-[85%]">
            Eating salty or heavy meals? Make sure to balance it out with enough water.
          </p>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007AFF] uppercase tracking-wider">
            Track Water <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </motion.div>
      </Link>

      {/* AI Coach Card - spans full width */}
      <Link to="/ai-coach" className="md:col-span-2">
        <motion.div 
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-r from-[#007AFF]/10 to-[#5856D6]/10 border border-[#007AFF]/20 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all relative overflow-hidden"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-2xl shadow-lg shrink-0">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                Nutrition Insights
                <span className="px-2 py-0.5 rounded-full bg-[#007AFF]/20 text-[#007AFF] text-[10px] uppercase font-bold tracking-wider">AI</span>
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                {calories > calorieGoal 
                  ? "You've exceeded your daily calorie goal. Try to focus on lean proteins and hydration for the rest of the day."
                  : calories > calorieGoal * 0.8
                  ? "You're getting close to your goal! A light, high-protein snack would be perfect right now."
                  : "You're on track today! Remember to balance your macros as you plan your next meal."}
              </p>
              <div className="text-xs font-medium text-[#5856D6] flex items-center gap-1 group">
                Ask AI Coach for a recipe <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </motion.div>
      </Link>

    </div>
  );
};
