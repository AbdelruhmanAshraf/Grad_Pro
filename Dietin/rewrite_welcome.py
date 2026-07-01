import re
import sys

def rewrite_welcome():
    with open('src/components/Welcome.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Inject imports
    imports_to_add = "import { Check, Dumbbell, Egg, Flame, Rabbit, Rocket, Snail, Timer, Turtle, Zap, BicepsFlexed, PersonStanding, MoreHorizontal, Apple, Leaf } from 'lucide-react';\n"
    content = content.replace("import { AnimatePresence, motion } from 'framer-motion';", imports_to_add + "import { AnimatePresence, motion } from 'framer-motion';")
    
    # 2. Add OptionCard component before IntroStep
    option_card = """
const OptionCard = ({ title, subtitle, icon, isSelected, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "relative flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all duration-200 min-h-[160px] w-full",
      isSelected 
        ? "border-[#1c2333] bg-[#1c2333] text-white" 
        : "border-transparent bg-white shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] text-[#1a1f2e]"
    )}
  >
    {isSelected && (
      <div className="absolute top-4 right-4 bg-white text-[#1c2333] rounded-full p-0.5">
        <Check size={14} strokeWidth={3} />
      </div>
    )}
    <div className={cn("mb-4", isSelected ? "text-white" : "text-[#1a1f2e]")}>
      {icon}
    </div>
    <div className="font-bold text-lg mb-1 text-center leading-tight">{title}</div>
    {subtitle && <div className={cn("text-xs text-center leading-tight mt-1", isSelected ? "text-white/80" : "text-[#7a7d85]")}>{subtitle}</div>}
  </button>
);
"""
    content = content.replace("const IntroStep =", option_card + "\nconst IntroStep =")
    
    # 3. Replace steps array
    # The steps array starts at `const steps = [` and ends before `  if (step === 0) {`
    
    # We will build the new steps array inside a separate string
    new_steps = """  const steps = [
    {
      title: "Your Name",
      description: "This is how the app will address you.",
      fields: (
        <div className="space-y-4 pt-4">
          <div className="text-xs font-bold text-[#7a7d85] tracking-wider uppercase mb-2">FULL NAME</div>
          <input
            type="text"
            placeholder="Enter your name"
            className="w-full px-6 py-4 rounded-full bg-white text-[#1a1f2e] placeholder:text-[#1a1f2e]/40 focus:outline-none focus:ring-2 focus:ring-[#1a1f2e]/20 transition-all duration-300 font-bold text-lg shadow-[0_4px_20px_rgb(0,0,0,0.04)]"
            value={formData.name || ''}
            onChange={(e) => {
              const newName = e.target.value;
              setIsNameValid(validateName(newName));
              updateForm({ name: newName });
            }}
          />
          {formData.name && !isNameValid && (
            <p className="text-red-500 text-sm pl-4">Please enter a valid real name.</p>
          )}
        </div>
      )
    },
    {
      title: "Gender",
      description: "Biological sex.",
      fields: (
        <div className="grid grid-cols-2 gap-4 pt-4">
          <OptionCard
            title="Male"
            icon={<User size={32} />}
            isSelected={formData.gender === 'MALE'}
            onClick={() => updateForm({ gender: 'MALE' })}
          />
          <OptionCard
            title="Female"
            icon={<User size={32} />}
            isSelected={formData.gender === 'FEMALE'}
            onClick={() => updateForm({ gender: 'FEMALE' })}
          />
        </div>
      )
    },
    {
      title: "Birth Date",
      description: "Required to accurately calculate your age and metabolism.",
      fields: (
        <div className="grid grid-cols-3 gap-3 pt-4">
          <select
            className="w-full px-4 py-4 rounded-2xl bg-white text-[#1a1f2e] font-bold shadow-[0_4px_20px_rgb(0,0,0,0.04)] appearance-none text-center"
            onChange={(e) => updateForm({ birthMonth: parseInt(e.target.value) })}
            value={(formData as any).birthMonth !== undefined ? String((formData as any).birthMonth) : ''}
          >
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => i).map((i) => (
              <option key={i} value={String(i)}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>
            ))}
          </select>
          <select
            className="w-full px-4 py-4 rounded-2xl bg-white text-[#1a1f2e] font-bold shadow-[0_4px_20px_rgb(0,0,0,0.04)] appearance-none text-center"
            onChange={(e) => updateForm({ birthDay: parseInt(e.target.value) })}
            value={(formData as any).birthDay !== undefined ? String((formData as any).birthDay) : ''}
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <option key={day} value={String(day)}>{day}</option>
            ))}
          </select>
          <select
            className="w-full px-4 py-4 rounded-2xl bg-white text-[#1a1f2e] font-bold shadow-[0_4px_20px_rgb(0,0,0,0.04)] appearance-none text-center"
            onChange={(e) => updateForm({ birthYear: parseInt(e.target.value) })}
            value={(formData as any).birthYear !== undefined ? String((formData as any).birthYear) : ''}
          >
            <option value="">Year</option>
            {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        </div>
      )
    },
    {
      title: "Physical Stats",
      description: "Height and Weight are essential for calculating your BMI and energy needs.",
      fields: (
        <div className="flex flex-col items-center pt-4">
          <div className="flex justify-around w-full mb-8">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-[#7a7d85] tracking-wider uppercase mb-4">HEIGHT</span>
              <div className="flex items-end gap-1">
                {useMetric ? (
                  <input
                    type="number"
                    value={formData.height || ''}
                    onChange={(e) => updateForm({ height: parseFloat(e.target.value) })}
                    className="text-5xl font-extrabold text-[#1a1f2e] w-24 text-center bg-transparent border-b-2 border-[#1a1f2e]/20 focus:outline-none focus:border-[#1a1f2e]"
                    placeholder="175"
                  />
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.heightFt || ''}
                      onChange={(e) => updateForm({ heightFt: parseFloat(e.target.value) })}
                      className="text-5xl font-extrabold text-[#1a1f2e] w-16 text-center bg-transparent border-b-2 border-[#1a1f2e]/20 focus:outline-none focus:border-[#1a1f2e]"
                      placeholder="5"
                    />
                    <input
                      type="number"
                      value={formData.heightIn || ''}
                      onChange={(e) => updateForm({ heightIn: parseFloat(e.target.value) })}
                      className="text-5xl font-extrabold text-[#1a1f2e] w-16 text-center bg-transparent border-b-2 border-[#1a1f2e]/20 focus:outline-none focus:border-[#1a1f2e]"
                      placeholder="9"
                    />
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-[#1a1f2e] mt-2">{useMetric ? 'CM' : 'FT / IN'}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-[#7a7d85] tracking-wider uppercase mb-4">WEIGHT</span>
              <div className="flex items-end gap-1">
                <input
                  type="number"
                  value={formData.weight || ''}
                  onChange={(e) => updateForm({ weight: parseFloat(e.target.value) })}
                  className="text-5xl font-extrabold text-[#1a1f2e] w-24 text-center bg-transparent border-b-2 border-[#1a1f2e]/20 focus:outline-none focus:border-[#1a1f2e]"
                  placeholder={useMetric ? "70" : "154"}
                />
              </div>
              <span className="text-sm font-bold text-[#1a1f2e] mt-2">{useMetric ? 'KG' : 'LBS'}</span>
            </div>
          </div>
          
          <div className="bg-[#f3f4f6] p-1 rounded-full flex gap-1 mt-8">
            <button
              onClick={() => setUseMetric(true)}
              className={cn("px-6 py-2 rounded-full font-bold text-sm transition-all", useMetric ? "bg-white text-[#1a1f2e] shadow-sm" : "text-[#7a7d85] hover:text-[#1a1f2e]")}
            >
              Metric
            </button>
            <button
              onClick={() => setUseMetric(false)}
              className={cn("px-6 py-2 rounded-full font-bold text-sm transition-all", !useMetric ? "bg-white text-[#1a1f2e] shadow-sm" : "text-[#7a7d85] hover:text-[#1a1f2e]")}
            >
              Imperial
            </button>
          </div>
        </div>
      )
    },
    {
      title: "Goal",
      description: "Choose a target.",
      fields: (
        <div className="grid grid-cols-2 gap-4 pt-4">
          <OptionCard
            title="Cutting (Fat Loss)"
            icon={<Flame size={32} />}
            isSelected={formData.goal === 'LOSE_FAT'}
            onClick={() => updateForm({ goal: 'LOSE_FAT' })}
          />
          <OptionCard
            title="Rapid Weight Loss"
            icon={<Zap size={32} />}
            isSelected={formData.goal === 'LOSE_WEIGHT'}
            onClick={() => updateForm({ goal: 'LOSE_WEIGHT' })}
          />
          <OptionCard
            title="Maintenance"
            icon={<Scale size={32} />}
            isSelected={formData.goal === 'MAINTAIN_HEALTH'}
            onClick={() => updateForm({ goal: 'MAINTAIN_HEALTH' })}
          />
          <OptionCard
            title="Bulking (Muscle Gain)"
            icon={<BicepsFlexed size={32} />}
            isSelected={formData.goal === 'GAIN_MUSCLE'}
            onClick={() => updateForm({ goal: 'GAIN_MUSCLE' })}
          />
          <OptionCard
            title="Lean Bulking"
            icon={<Drumstick size={32} />}
            isSelected={formData.goal === 'GAIN_WEIGHT'}
            onClick={() => updateForm({ goal: 'GAIN_WEIGHT' })}
          />
          <OptionCard
            title="Body Recomposition"
            icon={<PersonStanding size={32} />}
            isSelected={formData.goal === 'RECOMPOSITION'}
            onClick={() => updateForm({ goal: 'RECOMPOSITION' })}
          />
        </div>
      )
    },
    {
      title: "Desired Pace",
      description: "Weekly progress goal.",
      fields: (
        <div className="grid grid-cols-2 gap-4 pt-4">
          <OptionCard
            title="0.25"
            subtitle="kg / week"
            icon={<Turtle size={32} />}
            isSelected={formData.weeklyGoal === 0.25}
            onClick={() => updateForm({ weeklyGoal: 0.25 })}
          />
          <OptionCard
            title="0.5"
            subtitle="kg / week"
            icon={<Rabbit size={32} />}
            isSelected={formData.weeklyGoal === 0.5}
            onClick={() => updateForm({ weeklyGoal: 0.5 })}
          />
          <OptionCard
            title="0.75"
            subtitle="kg / week"
            icon={<Timer size={32} />}
            isSelected={formData.weeklyGoal === 0.75}
            onClick={() => updateForm({ weeklyGoal: 0.75 })}
          />
          <OptionCard
            title="1"
            subtitle="kg / week"
            icon={<Rocket size={32} />}
            isSelected={formData.weeklyGoal === 1.0}
            onClick={() => updateForm({ weeklyGoal: 1.0 })}
          />
        </div>
      )
    },
    {
      title: "Activity Level",
      description: "How active are you?",
      fields: (
        <div className="grid grid-cols-2 gap-4 pt-4">
          <OptionCard
            title="Sedentary"
            subtitle="Little or no exercise"
            icon={<User size={32} />}
            isSelected={formData.activityLevel === 'SEDENTARY'}
            onClick={() => updateForm({ activityLevel: 'SEDENTARY' })}
          />
          <OptionCard
            title="Light"
            subtitle="1-3 days/week"
            icon={<Activity size={32} />}
            isSelected={formData.activityLevel === 'LIGHTLY_ACTIVE'}
            onClick={() => updateForm({ activityLevel: 'LIGHTLY_ACTIVE' })}
          />
          <OptionCard
            title="Moderate"
            subtitle="3-5 days/week"
            icon={<Activity size={32} />}
            isSelected={formData.activityLevel === 'MODERATELY_ACTIVE'}
            onClick={() => updateForm({ activityLevel: 'MODERATELY_ACTIVE' })}
          />
          <OptionCard
            title="Very"
            subtitle="6-7 days/week"
            icon={<Dumbbell size={32} />}
            isSelected={formData.activityLevel === 'VERY_ACTIVE'}
            onClick={() => updateForm({ activityLevel: 'VERY_ACTIVE' })}
          />
          <div className="col-span-2 flex justify-center">
             <div className="w-1/2">
               <OptionCard
                 title="Extra"
                 subtitle="Hard physical job/training"
                 icon={<Flame size={32} />}
                 isSelected={formData.activityLevel === 'EXTRA_ACTIVE'}
                 onClick={() => updateForm({ activityLevel: 'EXTRA_ACTIVE' })}
               />
             </div>
          </div>
        </div>
      )
    },
    {
      title: "Training",
      description: "Weekly workouts?",
      fields: (
        <div className="grid grid-cols-2 gap-4 pt-4">
          <OptionCard
            title="None"
            icon={<User size={32} />}
            isSelected={formData.workoutDays === 0}
            onClick={() => updateForm({ workoutDays: 0 })}
          />
          <OptionCard
            title="1-2"
            subtitle="/ week"
            icon={<Calendar size={32} />}
            isSelected={formData.workoutDays === 2}
            onClick={() => updateForm({ workoutDays: 2 })}
          />
          <OptionCard
            title="3-4"
            subtitle="/ week"
            icon={<Calendar size={32} />}
            isSelected={formData.workoutDays === 4}
            onClick={() => updateForm({ workoutDays: 4 })}
          />
          <OptionCard
            title="5+"
            subtitle="/ week"
            icon={<Calendar size={32} />}
            isSelected={formData.workoutDays === 5}
            onClick={() => updateForm({ workoutDays: 5 })}
          />
          <div className="col-span-2 flex justify-center">
             <div className="w-1/2">
               <OptionCard
                 title="Daily"
                 icon={<Calendar size={32} />}
                 isSelected={formData.workoutDays === 7}
                 onClick={() => updateForm({ workoutDays: 7 })}
               />
             </div>
          </div>
        </div>
      )
    },
    {
      title: "Diet Type",
      description: "Restrictions?",
      fields: (
        <div className="grid grid-cols-2 gap-4 pt-4">
          <OptionCard
            title="Balanced"
            icon={<Apple size={32} />}
            isSelected={formData.diet === 'BALANCED'}
            onClick={() => updateForm({ diet: 'BALANCED' })}
          />
          <OptionCard
            title="Keto"
            icon={<Egg size={32} />}
            isSelected={formData.diet === 'KETO'}
            onClick={() => updateForm({ diet: 'KETO' })}
          />
          <div className="col-span-2 flex justify-center">
             <div className="w-1/2">
               <OptionCard
                 title="Vegan"
                 icon={<Leaf size={32} />}
                 isSelected={formData.diet === 'VEGAN'}
                 onClick={() => updateForm({ diet: 'VEGAN' })}
               />
             </div>
          </div>
        </div>
      )
    },
    {
      title: "Health",
      description: "Any injuries?",
      fields: (
        <div className="grid grid-cols-2 gap-4 pt-4">
          <OptionCard
            title="None"
            icon={<Check size={32} />}
            isSelected={formData.injuries?.length === 0}
            onClick={() => updateForm({ injuries: [] })}
          />
          <OptionCard
            title="Knee Issue"
            icon={<PersonStanding size={32} />}
            isSelected={formData.injuries?.includes('KNEE')}
            onClick={() => {
               const inj = formData.injuries || [];
               updateForm({ injuries: inj.includes('KNEE') ? inj.filter((i:any) => i !== 'KNEE') : [...inj, 'KNEE'] });
            }}
          />
          <OptionCard
            title="Back Issue"
            icon={<Users size={32} />}
            isSelected={formData.injuries?.includes('BACK')}
            onClick={() => {
               const inj = formData.injuries || [];
               updateForm({ injuries: inj.includes('BACK') ? inj.filter((i:any) => i !== 'BACK') : [...inj, 'BACK'] });
            }}
          />
          <OptionCard
            title="Other"
            icon={<MoreHorizontal size={32} />}
            isSelected={formData.injuries?.includes('OTHER')}
            onClick={() => {
               const inj = formData.injuries || [];
               updateForm({ injuries: inj.includes('OTHER') ? inj.filter((i:any) => i !== 'OTHER') : [...inj, 'OTHER'] });
            }}
          />
        </div>
      )
    },
    {
      title: "Upgrade to DietinPro",
      description: "Unlock premium AI features and advanced tracking.",
      fields: (
        <div className="mt-4">
          <ProSubscriptionPanel />
          <button 
            className="w-full text-center text-[#7a7d85] font-bold mt-4 py-2 hover:text-[#1a1f2e] transition-colors"
            onClick={handleNext}
          >
            Skip for now
          </button>
        </div>
      )
    },
    {
      title: "",
      description: "",
      fields: (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="mb-8"
          >
            <Bot size={64} className="text-[#1c2333]" />
          </motion.div>
          <motion.p
            key={currentAiText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-2xl font-bold text-[#1a1f2e]"
          >
            {getAiText()}
          </motion.p>
          <div className="mt-12 flex space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: currentAiText === i ? 1.5 : 1, opacity: currentAiText >= i ? 1 : 0.3 }}
                className="w-2 h-2 rounded-full bg-[#1c2333]"
              />
            ))}
          </div>
        </div>
      )
    },
    {
      title: "Summary",
      description: "Your personalized plan:",
      fields: (
        <div className="space-y-4 pt-4">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center">
            <div className="flex items-center gap-2 text-[#7a7d85] font-bold text-xs tracking-wider mb-2">
              <Flame size={16} className="text-blue-500" /> DAILY CALORIES
            </div>
            <div className="text-5xl font-extrabold text-[#1a1f2e] mb-1">
              {aiResult?.calories || 2000} <span className="text-xl font-bold text-[#7a7d85]">kcal</span>
            </div>
            <div className="h-[1px] w-full bg-gray-100 my-4" />
            <div className="text-center text-sm text-[#7a7d85]">
              Based on your {formData.goal?.replace('_', ' ').toLowerCase() || 'Maintenance'} goal and {formData.activityLevel?.replace('_', ' ').toLowerCase() || 'Moderate'} activity.
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center justify-center">
              <div className="text-[#7a7d85] font-bold text-xs tracking-wider mb-1">BMI</div>
              <div className="text-2xl font-extrabold text-[#1a1f2e]">{aiResult?.bmi || 22.7}</div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center justify-center">
              <div className="text-[#7a7d85] font-bold text-xs tracking-wider mb-1">BMR</div>
              <div className="text-2xl font-extrabold text-[#1a1f2e]">{aiResult?.metabolism || 1659}</div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center justify-center">
              <div className="text-[#7a7d85] font-bold text-xs tracking-wider mb-1">TDEE</div>
              <div className="text-2xl font-extrabold text-[#1a1f2e]">{aiResult?.calories || 3152}</div>
            </div>
            <div className="bg-pink-50 rounded-3xl p-6 flex flex-col items-center justify-center border border-pink-100">
              <div className="flex items-center gap-1 text-blue-500 font-bold text-xs tracking-wider mb-1">
                <Flame size={14} /> DAILY BURN
              </div>
              <div className="text-2xl font-extrabold text-blue-500">{Math.round((aiResult?.calories || 3152) - (aiResult?.metabolism || 1659))} <span className="text-sm">cal</span></div>
            </div>
          </div>
        </div>
      )
    }
  ];
"""
    
    # Extract before, after and replace
    parts = re.split(r'const steps = \[', content)
    before_steps = parts[0]
    
    # Find end of steps array
    after_steps = parts[1].split('  if (step === 0) {', 1)[1]
    
    # We also need to fix the return statement for the wrapper to match the new UI
    # Replace the return block starting from <motion.div to the end of <div className="fixed top-0 left-0...
    wrapper_regex = r'<motion\.div\s+initial=\{\{ opacity: 1 \}\}\s+animate=\{\{ opacity: isFadingOut \? 0 : 1 \}\}\s+transition=\{\{ duration: 0\.5 \}\}\s+className="fixed inset-0 bg-gradient-[^"]+"\s+style=\{\{ overscrollBehavior: \'none\' \}\}\s+>'
    
    new_wrapper = """<motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-white text-[#1a1f2e] font-['SF Pro Display'] overflow-y-auto overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      <div className="max-w-md mx-auto px-6 py-6 pb-32 min-h-full relative">"""
    
    content = before_steps + new_steps + '\n  if (step === 0) {' + after_steps
    content = re.sub(wrapper_regex, new_wrapper, content)
    
    # Replace Language Switcher and Progress Bar
    header_regex = r'\{/\* Language Switcher [^\}]+\}\s*<div[^>]+>\s*<LanguageSwitcher />\s*</div>\s*\{/\* Top Progress Bar \*/\}\s*<div className="fixed top-0 left-0 right-0 h-1 bg-black/5">\s*<div\s*className="h-full bg-black transition-all duration-300"\s*style=\{\{ width: `\$\{progress\}%` \}\}\s*/>\s*</div>'
    
    new_header = """<div className="flex items-center justify-between mb-8 mt-2">
        <button onClick={prevStep} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#f3f4f6]">
          <ChevronLeft size={20} className="text-[#1a1f2e]" />
        </button>
        <div className="flex-1 mx-4 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
          <div className="h-full bg-[#3b82f6] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[#f3f4f6]">
          <MoreHorizontal size={20} className="text-[#1a1f2e]" />
        </button>
      </div>"""
    
    content = re.sub(header_regex, new_header, content)
    
    # Replace step title/description rendering
    step_header_regex = r'<motion\.div[^>]+>\s*<div className="flex items-center justify-center mb-6">\s*<div className="w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center text-black rotate-3 hover:rotate-6 transition-all duration-300">\s*<currentStep\.icon size=\{32\} />\s*</div>\s*</div>\s*<h2 className="text-3xl font-extrabold text-black text-center mb-3">\s*\{currentStep\.title\}\s*</h2>\s*<p className="text-black/60 text-center mb-10 text-lg max-w-\[280px\] mx-auto leading-relaxed">\s*\{currentStep\.description\}\s*</p>\s*</motion\.div>'
    
    new_step_header = """<motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-extrabold text-[#1a1f2e] mb-2">
              {currentStep.title}
            </h2>
            <p className="text-[#7a7d85] text-[15px]">
              {currentStep.description}
            </p>
          </motion.div>"""
    
    content = re.sub(step_header_regex, new_step_header, content)
    
    # Update the bottom navigation buttons
    bottom_buttons_regex = r'<motion\.div\s+initial=\{\{ opacity: 0, y: 20 \}\}\s+animate=\{\{ opacity: 1, y: 0 \}\}\s+transition=\{\{ delay: 0\.3 \}\}\s+className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-\[#F0F0F0\] via-\[#F0F0F0\] to-transparent pointer-events-none"\s+>\s+<div className="max-w-md mx-auto flex gap-3 pointer-events-auto">\s*\{step > 0 && \(\s*<button\s*onClick=\{prevStep\}\s*className="flex-1 px-4 py-4 rounded-2xl bg-white text-black font-semibold shadow-lg hover:bg-black/5 transition-all duration-300 flex items-center justify-center gap-2"\s*>\s*<ChevronLeft size=\{20\} />\s*Back\s*</button>\s*\)\}\s*<button\s*onClick=\{step === steps\.length - 1 \? handleGetStarted : handleNext\}\s*disabled=\{!isStepValid\(\) \|\| isLoading\}\s*className="flex-\[2\] px-4 py-4 rounded-2xl bg-black text-white font-semibold shadow-xl hover:scale-\[1\.02\] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"\s*>\s*\{isLoading \?\s*<div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />\s*:\s*step === steps\.length - 1 \? \'Get Started\' : \'Continue\'\s*\}\s*<ChevronRight size=\{20\} />\s*</button>\s*</div>\s*</motion\.div>'

    new_bottom_buttons = """<motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pointer-events-none z-10"
        >
          <div className="max-w-md mx-auto pointer-events-auto pb-4">
            <button
              onClick={step === steps.length - 1 ? handleGetStarted : handleNext}
              disabled={!isStepValid() || isLoading}
              className="w-full py-4 rounded-full bg-[#1c2333] text-white font-bold text-lg shadow-[0_8px_30px_rgb(28,35,51,0.2)] active:scale-95 transition-all duration-300 disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                step === steps.length - 1 ? 'Finish' : 'Continue'
              )}
            </button>
          </div>
        </motion.div>"""
        
    content = re.sub(bottom_buttons_regex, new_bottom_buttons, content)
    
    # Fix the missing closing div for max-w-md wrapper
    end_div_regex = r'</AnimatePresence>\s*</motion\.div>\s*\);\s*\}'
    new_end_div = r'</AnimatePresence>\n      </div>\n    </motion.div>\n  );\n}'
    content = re.sub(end_div_regex, new_end_div, content)

    with open('src/components/Welcome.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    rewrite_welcome()
