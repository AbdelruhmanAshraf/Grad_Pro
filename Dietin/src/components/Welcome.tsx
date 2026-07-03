import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/userStore';
import { UserProfile, ActivityLevel, ExperienceLevel, WorkoutDays, Gender, Budget, Goal } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Loader from './Loader';
import {
  ChevronRight,
  ChevronLeft,
  Globe,
  User,
  Scale,
  Activity,
  Calendar,
  AlertCircle,
  Apple,
  CreditCard,
  Sparkles,
  Target,
  LineChart,
  Salad,
  Bot,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  Youtube as YoutubeIcon,
  Tv as TvIcon,
  Users,
  ThumbsDown,
  ThumbsUp,
  BarChart,
  Pizza,
  Drumstick,
  Fish,
  Leaf,
  Sun,
  Dumbbell,
  Heart,
  Check,
  Egg,
  Flame,
  Rabbit,
  Rocket,
  Snail,
  Timer,
  Turtle,
  Zap,
  BicepsFlexed,
  PersonStanding,
  MoreHorizontal
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { weightKg, heightCm } from '@/lib/validation/schemas';
import { Line } from 'react-chartjs-2';
import ProSubscriptionPanel from './ProSubscriptionPanel';
import HealthDisclaimerModal from './HealthDisclaimerModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// Add TikTok and Google icons since they're not in lucide-react
const TikTokIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 015.9 5.82v4.5a4.278 4.278 0 008.5 0v-8.5a7.741 7.741 0 007.7 7.7v-4.5a3.276 3.276 0 01-3.25-3.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.84 8.52c0 3.37-2.36 5.76-5.84 5.76-3.37 0-6.14-2.73-6.14-6.1S7.63 4.08 11 4.08c1.5 0 2.84.54 3.9 1.42l-1.6 1.6c-.45-.42-1.23-.91-2.3-.91-1.96 0-3.58 1.65-3.58 3.63 0 1.98 1.62 3.63 3.58 3.63 2.27 0 3.13-1.64 3.27-2.48h-3.27V8.52h5.84z" fill="currentColor" />
  </svg>
);

const inputClasses = "w-full px-4 py-3 rounded-2xl bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-300 font-['SF Pro Display'] shadow-md";
const selectClasses = "w-full px-4 py-3 rounded-2xl bg-white text-black focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-300 font-['SF Pro Display'] shadow-md";
const buttonClasses = (selected: boolean) => cn(
  "w-full px-4 py-4 rounded-2xl text-center transition-all duration-200 font-['SF Pro Display']",
  selected
    ? "bg-[#3E3E3E] text-white scale-[0.98] shadow-lg [&_*]:text-white"
    : "bg-white text-black hover:bg-black/5 shadow-md"
);
const cardClasses = "bg-white shadow-lg border border-black/5 rounded-2xl p-6 hover:bg-white/95 transition-all duration-300";


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

const IntroStep = ({ onComplete }: { onComplete: () => void }) => {
  const { t, i18n } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  
  const slides = [
    {
      image: '/onboarding/1.png',
      title: t('onboarding.slide1_title', 'Welcome'),
      subtitle: t('onboarding.slide1_subtitle', 'your fitness and nutrition companion'),
      button: t('onboarding.continue', 'Continue'),
      showBack: false
    },
    {
      image: '/onboarding/2.png',
      title: t('onboarding.slide2_title', 'Track progress'),
      subtitle: t('onboarding.slide2_subtitle', 'Work out meals and insights'),
      button: t('onboarding.continue', 'Continue'),
      showBack: true
    },
    {
      image: '/onboarding/3.png',
      title: t('onboarding.slide3_title', 'Personalized plan'),
      subtitle: t('onboarding.slide3_subtitle', 'Customized diet and workout plan'),
      button: t('onboarding.continue', 'Continue'),
      showBack: true
    },
    {
      image: '/onboarding/4.png',
      title: t('onboarding.slide4_title', 'Achieve your goals'),
      subtitle: t('onboarding.slide4_subtitle', 'Stay motivated and achieve your goals'),
      button: t('onboarding.get_started', 'Get Started'),
      showBack: true
    }
  ];

  const handleNext = () => {
    if (stepIndex < slides.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      setIsExiting(true);
      setTimeout(() => {
        onComplete();
      }, 400);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(prev => prev - 1);
    }
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    try {
      localStorage.setItem('app_language', value);
      const isArabic = value.toLowerCase().startsWith('ar');
      document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
      document.documentElement.lang = value;
    } catch {}
  };

  const slide = slides[stepIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-white relative overflow-hidden px-6 py-8">
      {/* Top Bar */}
      <div className="w-full max-w-[1200px] mx-auto flex justify-between items-center z-10 pt-4">
        <div className="w-12 h-12 flex items-center justify-center">
          {slide.showBack && (
            <button onClick={handleBack} className="p-2.5 rounded-full bg-[#f4f4f5] hover:bg-[#e4e4e7] transition-colors">
              <ChevronLeft size={24} className="text-[#1a1f2e]" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2.5 rounded-full bg-[#f4f4f5] hover:bg-[#e4e4e7] transition-colors focus:outline-none">
              <Globe size={24} className="text-[#1a1f2e]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-xl bg-white shadow-lg border border-gray-100">
            <DropdownMenuItem onClick={() => handleLanguageChange('en')} className="cursor-pointer font-medium hover:bg-gray-50 focus:bg-gray-50 text-base py-2">
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange('ar-EG')} className="cursor-pointer font-medium hover:bg-gray-50 focus:bg-gray-50 text-base py-2">
              العربية (مصر)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 w-full max-w-[1200px] mx-auto flex flex-col items-center justify-center text-center mt-8 mb-12"
        >
          <div className="px-4 mb-8">
            <h1 className="text-[2rem] leading-tight font-bold text-[#1a1f2e] mb-3">{slide.title}</h1>
            {slide.subtitle && (
              <p className="text-[#7a7d85] text-lg">{slide.subtitle}</p>
            )}
          </div>
          
          <div className="w-full flex-1 min-h-[300px] relative flex items-center justify-center px-4">
            <img 
              src={slide.image} 
              alt={slide.title} 
              className="w-full h-full max-h-[45vh] object-contain" 
              loading="lazy"
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Section */}
      <div className="w-full max-w-[1200px] mx-auto flex flex-col items-center z-10 pb-4">
        {/* Dots */}
        <div className="flex gap-2 mb-10">
          {slides.map((_, idx) => (
            <div 
              key={idx} 
              className={cn(
                "h-2.5 rounded-full transition-all duration-300",
                idx === stepIndex ? "w-8 bg-[#1a1f2e]" : "w-2.5 bg-[#1a1f2e]/20"
              )} 
            />
          ))}
        </div>

        {/* Button */}
        <button 
          onClick={handleNext}
          className="w-full max-w-md py-4 rounded-full bg-[#1a1f2e] text-white font-bold text-xl shadow-[0_8px_30px_rgb(26,31,46,0.2)] hover:scale-[0.98] transition-transform"
        >
          {slide.button}
        </button>
      </div>
    </div>
  );
};

export function Welcome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { updateUser } = useUserStore();
  const [step, setStep] = useState(-1);
  const [isVisible, setIsVisible] = useState(true);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  // Local state to keep custom region input independent of quick-select buttons
  const [customRegionActive, setCustomRegionActive] = useState(false);
  const [customRegion, setCustomRegion] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showProPanel, setShowProPanel] = useState(false);
  const [aiResult, setAiResult] = useState<{
    bmi: number;
    calories: number;
    metabolism: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStepReady, setAiStepReady] = useState(false);
  const [currentAiText, setCurrentAiText] = useState(0);
  const [isNameValid, setIsNameValid] = useState(false);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);
  const [useMetric, setUseMetric] = useState(true);
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Deterministic, rule-based name validation
  const validateName = (raw: string): boolean => {
    const name = (raw || "").trim();
    if (!name) return false;
    if (name.length < 2 || name.length > 40) return false;
    // Disallow emojis and non-letter basic symbols; allow spaces, apostrophes and hyphens
    if (/[^\p{L}\p{M}\s'’-]/u.test(name)) return false;
    if (/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(name)) return false;
    // No single character repeated 3+ times
    if (/(.)\1{2,}/.test(name)) return false;
    // Token checks
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length > 4) return false;
    if (tokens.some(t => t.length < 2)) return false;
    // Must start with a letter
    if (!/^[\p{L}]/u.test(name)) return false;
    // Basic garbage blacklist
    const lower = name.toLowerCase();
    const blacklist = [
      'asdf', 'qwerty', 'zxcv', 'test', 'name', 'abc', 'unknown', 'n/a', 'na', 'none', 'null', 'user', 'me', 'idk'
    ];
    if (blacklist.some(b => lower === b || lower.includes(b))) return false;
    return true;
  };

  const updateForm = (updates: Partial<UserProfile>) => {
    // Remove rate limiting for form updates
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    const now = Date.now();
    if (now - lastInteractionTime < 1000) return;
    setLastInteractionTime(now);

    setIsVisible(false);

    // Check if we're on the DietinPro step
    if (step === steps.findIndex(s => s.title === "Upgrade to DietinPro")) {
      // Allow moving to next step after DietinPro
      setTimeout(() => {
        setStep(prev => prev + 1); // Move to AI Analysis loader step
        setIsVisible(true);
        // Start local analysis (no external AI)
        setIsAnalyzing(true);

        const result = computeUserAnalysis(formData, useMetric);
        setAiResult(result);

        // Brief loader, then go to final step
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            setStep(steps.length - 1); // Move to final step
            setIsAnalyzing(false);
            setAiStepReady(true);
            setIsVisible(true);
          }, 500);
        }, 2500);
      }, 500);
      return;
    }

    if (step === steps.length - 3) {
      // Move to AI loader, compute locally, then finish
      setIsAnalyzing(true);
      setTimeout(() => {
        setStep(step + 1);
        setIsVisible(true);
        const result = computeUserAnalysis(formData, useMetric);
        setAiResult(result);
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            setStep(steps.length - 1);
            setIsAnalyzing(false);
            setAiStepReady(true);
            setIsVisible(true);
          }, 500);
        }, 2000);
      }, 500);
      return;
    }

    // Normal step transition
    setTimeout(() => {
      // Ensure viewport resets before the next step shows
      scrollToTopImmediate();
      setStep(prev => prev + 1);
      setTimeout(() => {
        setIsVisible(true);
      }, 1500);
    }, 500);
  };

  // Robust scroll-to-top helper
  const scrollToTopImmediate = () => {
    try {
      if (typeof window !== 'undefined') {
        // Instant jump to top
        window.scrollTo(0, 0);
      }
      const de = document?.documentElement as HTMLElement | undefined;
      const b = document?.body as HTMLElement | undefined;
      if (de) de.scrollTop = 0;
      if (b) b.scrollTop = 0;
    } catch { }
  };

  // Ensure scroll resets to top on step change for better UX
  useEffect(() => {
    scrollToTopImmediate();
  }, [step]);

  const prevStep = () => {
    const now = Date.now();
    if (now - lastInteractionTime < 1000) return; // Prevent navigation within 1 second
    setLastInteractionTime(now);

    setIsVisible(false);
    setTimeout(() => {
      scrollToTopImmediate();
      setStep(prev => prev - 1);
      setIsVisible(true);
    }, 500);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (e) {
      console.error(e);
      toast.error(t('auth.signOutFailed', { defaultValue: "We couldn't sign you out. Please try again." }));
    }
  };

  // Deterministic, non-AI recommended target weight calculator
  // Uses widely accepted BMI midpoint (22) to compute a healthy-weight target
  // and nudges toward it based on the user's goal. Never returns the same
  // weight as current, enforcing a minimal delta depending on unit system.
  const computeRecommendedTargetWeight = (
    currentWeight: number,
    heightCm: number | null | undefined,
    goal: Goal | null | undefined,
    useMetricUnits: boolean
  ): number => {
    const MIN_DELTA = useMetricUnits ? 0.5 : 1; // ensure target differs from current
    if (!currentWeight || currentWeight <= 0) return useMetricUnits ? 50 : 110; // sensible fallback

    // Compute recommended (BMI-based) target in kg first
    let recommendedKg: number | null = null;
    if (heightCm && heightCm > 0) {
      const heightM = heightCm / 100;
      const HEALTHY_BMI = 22; // midpoint of 18.5–24.9
      recommendedKg = HEALTHY_BMI * heightM * heightM;
    }

    // Convert recommended target to the user's current unit system
    const recommendedInUserUnits = (() => {
      if (recommendedKg == null) return null;
      return useMetricUnits ? recommendedKg : Math.round(recommendedKg * 2.20462);
    })();

    // Helper to ensure minimal difference from current
    const ensureNotEqual = (val: number): number => {
      if (Math.abs(val - currentWeight) < (useMetricUnits ? 0.0001 : 0.0001)) {
        // Move by minimal delta based on goal direction or toward healthy midpoint
        if (goal === 'LOSE_WEIGHT' || goal === 'LOSE_FAT') return currentWeight - MIN_DELTA;
        if (goal === 'GAIN_WEIGHT' || goal === 'GAIN_MUSCLE') return currentWeight + MIN_DELTA;
        // For MAINTAIN/RECOMPOSITION or unknown, nudge toward midpoint if available
        if (recommendedInUserUnits != null) {
          return recommendedInUserUnits < currentWeight ? currentWeight - MIN_DELTA : currentWeight + MIN_DELTA;
        }
        return currentWeight + MIN_DELTA;
      }
      return val;
    };

    let target = currentWeight;
    if (goal === 'LOSE_WEIGHT' || goal === 'LOSE_FAT') {
      if (recommendedInUserUnits != null) {
        target = Math.min(currentWeight - MIN_DELTA, recommendedInUserUnits);
      } else {
        // Fallback: 10–15% reduction
        target = currentWeight * 0.9;
      }
    } else if (goal === 'GAIN_WEIGHT' || goal === 'GAIN_MUSCLE') {
      if (recommendedInUserUnits != null) {
        target = Math.max(currentWeight + MIN_DELTA, recommendedInUserUnits);
      } else {
        // Fallback: 10–15% increase
        target = currentWeight * 1.1;
      }
    } else if (goal === 'RECOMPOSITION' || goal === 'MAINTAIN_HEALTH' || goal === 'MAINTAIN_ATHLETIC' || !goal) {
      // Move slightly toward healthy midpoint; if already close, still nudge by MIN_DELTA
      if (recommendedInUserUnits != null) {
        target = recommendedInUserUnits < currentWeight ? currentWeight - MIN_DELTA : currentWeight + MIN_DELTA;
      } else {
        // Without height, nudge minimally based on presumed direction (default upward)
        target = currentWeight + MIN_DELTA;
      }
    }

    // Round to UI step
    if (useMetricUnits) {
      target = Math.round(target * 10) / 10; // slider step is 0.1 kg
    } else {
      target = Math.round(target); // slider step is 1 lb
    }

    // Ensure result is not equal to current
    target = ensureNotEqual(target);
    return target;
  };

  const handleGetStarted = async () => {
    const now = Date.now();
    if (now - lastInteractionTime < 1000) return;
    setLastInteractionTime(now);

    setIsLoading(true);

    try {
      // Normalize values and prepare unit metadata
      const unitSystem = useMetric ? 'METRIC' : 'IMPERIAL';
      const heightCm = formData.height ?? null;
      const heightImperial = heightCm ? convertToImperial(heightCm) : null;
      const heightFt = formData.heightFt ?? heightImperial?.feet ?? null;
      const heightIn = formData.heightIn ?? heightImperial?.inches ?? null;
      const rawWeight = formData.weight ?? null; // in current unit
      const weightKg = rawWeight === null ? null : (useMetric ? rawWeight : convertWeight(rawWeight, true));
      const weightLbs = rawWeight === null ? null : (useMetric ? convertWeight(rawWeight, false) : rawWeight);
      // Persist normalized metric values in the numeric fields for consistency
      const persistedHeight = heightCm;
      const persistedWeight = weightKg;
      // Basic user data that can always be updated
      const baseUserData = {
        // Basic info
        name: formData.name || '',
        email: auth.currentUser?.email || '',
        username: formData.name || '',

        // Numeric values with defaults
        age: formData.age || null,
        height: persistedHeight,
        weight: persistedWeight,
        bodyFatPercentage: formData.bodyFatPercentage || null,
        // Unit metadata and denormalized mirrors
        unitSystem,
        heightCm,
        heightFt,
        heightIn,
        weightKg,
        weightLbs,

        // Goals and calculations from AI
        calorieGoal: aiResult?.calories || 2000,
        metabolism: aiResult?.metabolism || 2200,
        proteinGoal: aiResult?.protein || Math.round((aiResult?.calories || 2000) * 0.3 / 4),
        carbsGoal: aiResult?.carbs || Math.round((aiResult?.calories || 2000) * 0.4 / 4),
        fatGoal: aiResult?.fat || Math.round((aiResult?.calories || 2000) * 0.3 / 9),

        // New fields from enhanced onboarding
        birthMonth: formData.birthMonth || null,
        birthDay: formData.birthDay || null,
        birthYear: formData.birthYear || null,
        targetWeight: formData.targetWeight || null,
        weeklyGoal: formData.weeklyGoal || null,
        diet: formData.diet || null,
        regionPreference: formData.regionPreference || null,
        goal: formData.goal || null,
        goals: formData.goals || [],
        obstacles: formData.obstacles || [],
        source: formData.source || null,
        hasTriedOtherApps: formData.hasTriedOtherApps || "NO",

        // Enums and selections
        gender: formData.gender || null,
        activityLevel: formData.activityLevel || null,
        experienceLevel: formData.experienceLevel || 'BEGINNER',
        workoutDays: formData.workoutDays || null,

        // Arrays with empty defaults
        injuries: Array.isArray(formData.injuries) ? formData.injuries : [],
        allergies: Array.isArray(formData.allergies) ? formData.allergies : [],

        // Status and timestamps
        onboardingCompleted: true,
        healthDisclaimerAccepted: true,
        healthDisclaimerAcceptedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),

        // Analytics & Stats
        streak: 0,
        lastLoginDate: new Date().toISOString(),
        totalMealsLogged: 0,
        totalWorkoutsLogged: 0,
        weeklyStats: {},
        monthlyStats: {},
        yearlyStats: {},

        // Preferences
        customTags: [],
        notificationsEnabled: true,
        theme: "dark",
        language: "en"
      };

      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          // For existing users, just update the base data
          // This avoids touching protected fields
          await updateDoc(userRef, baseUserData);
        } else {
          // For new users, include protected fields with default values
          await setDoc(userRef, {
            ...baseUserData,
            // Protected fields - only set during initial creation
            isPro: false,
            proExpiryDate: null,
            dailyImageAnalysis: 0,
            dailyMealAnalysis: 0,
            lastQuotaReset: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });
        }

        // Update localStorage and store
        if (auth.currentUser?.email) {
          localStorage.setItem(`user_${auth.currentUser.email}`, JSON.stringify(baseUserData));
        }
        updateUser(baseUserData);

        // We do NOT navigate to /home here. App.tsx's useEffect will see onboardingCompleted is true
        // and handle rendering the HealthDisclaimerModal automatically over the routes.
      } else {
        throw new Error('No authenticated user found');
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      toast.error(t('profile.saveFailed', { defaultValue: "We couldn't save your profile. Please try again." }));
    } finally {
      setIsLoading(false);
    }
  };

  const getAiText = () => {
    switch (currentAiText) {
      case 0:
        return "Our AI has analyzed your information";
      case 1:
        return `Your metabolism is ${aiResult?.metabolism} cal`;
      case 2:
        return `Your recommended daily calorie intake is ${aiResult?.calories} cal`;
      default:
        return "";
    }
  };

  // Update conversion helpers to be more precise
  const convertToMetric = (ft: number, inches: number) => {
    const totalInches = (ft * 12) + (inches || 0);
    return Math.round(totalInches * 2.54);
  };

  const convertToImperial = (cm: number) => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  };

  const convertWeight = (weight: number, toMetric: boolean) => {
    return toMetric ?
      Math.round(weight * 0.453592) :
      Math.round(weight / 0.453592);
  };

  // Local analysis helper (Mifflin-St Jeor BMR, TDEE, BMI, macros)
  const computeUserAnalysis = (data: Partial<UserProfile>, metric: boolean) => {
    // Resolve weight (kg)
    const weightKg = data.weight ? (metric ? data.weight : convertWeight(data.weight, true)) : 0;
    // Resolve height (cm)
    const heightCm = data.height
      ? (metric ? data.height : convertToMetric(data.heightFt as number, (data.heightIn || 0) as number))
      : 0;

    // Age from birth fields if present
    const getAge = () => {
      if (data.birthYear && data.birthMonth && data.birthDay) {
        const y = Number(data.birthYear);
        const m = Number(data.birthMonth) - 1;
        const d = Number(data.birthDay);
        const dob = new Date(y, m, d);
        if (!isNaN(dob.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const mdiff = today.getMonth() - dob.getMonth();
          if (mdiff < 0 || (mdiff === 0 && today.getDate() < dob.getDate())) age--;
          return Math.max(14, Math.min(90, age));
        }
      }
      return 30;
    };

    const age = getAge();
    const gender = (data.gender || 'male') as 'male' | 'female';

    // BMR (kcal) via Mifflin-St Jeor
    const bmr = gender === 'male'
      ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5
      : (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;

    // Activity multiplier mapping
    const activityId = (data.activityLevel as string) || 'moderate';
    const activityMap: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
      veryActive: 1.9,
    };
    const multiplier = activityMap[activityId] || 1.55;

    // Goal adjustment to TDEE
    const tdee = bmr * multiplier;
    const goal = (data.goal as string) || 'maintain';
    let calories = tdee;
    if (goal === 'lose' || goal === 'lose_weight' || goal === 'fat_loss') calories = tdee * 0.85;
    if (goal === 'gain' || goal === 'muscle_gain') calories = tdee * 1.15;

    // Macros (simple defaults)
    const protein = Math.max(60, Math.round(1.8 * weightKg));
    const fat = Math.max(35, Math.round(0.8 * weightKg));
    const remaining = Math.max(0, Math.round(calories) - protein * 4 - fat * 9);
    const carbs = Math.max(0, Math.round(remaining / 4));

    // BMI
    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? +(weightKg / (heightM * heightM)).toFixed(1) : 0;

    return {
      metabolism: Math.round(bmr),
      calories: Math.round(calories),
      protein,
      carbs,
      fat,
      bmi,
    } as const;
  };

  // Validation helpers — imperative UX bounds (120-220 cm / 30-180 kg) still
  // apply here for the onboarding-step "Continue" gate. Actual persistence to
  // Firestore is re-checked with the shared zod bounds (weightKg 1..500,
  // heightCm 50..300) so DevTools tampering that bypasses these narrower
  // ranges is still caught before write.
  const isHeightValid = () => {
    if (useMetric) {
      if (!formData.height) return false;
      if (!heightCm.safeParse(formData.height).success) return false;
      return formData.height >= 120 && formData.height <= 220;
    } else {
      const heightFt = formData.heightFt || 0;
      const heightIn = formData.heightIn || 0;
      if (heightFt < 4 || heightFt > 7 || heightIn < 0 || heightIn > 11) return false;
      const cm = heightFt * 30.48 + heightIn * 2.54;
      return heightCm.safeParse(cm).success;
    }
  };

  const isWeightValid = () => {
    if (!formData.weight) return false;
    const kg = useMetric ? formData.weight : formData.weight * 0.453592;
    if (!weightKg.safeParse(kg).success) return false;
    return useMetric
      ? formData.weight >= 30 && formData.weight <= 180
      : formData.weight >= 66 && formData.weight <= 400;
  };

  // Update step validation
  const isStepValid = () => {
    if (step === steps.length - 2 && currentAiText < 3) return false;
    if (step === steps.findIndex(s => s.title === "Upgrade to DietinPro")) return true;

    switch (step) {
      case 0: // Name step
        return !!formData.name && formData.name.trim().length > 0 && isNameValid;
      case 1: // Gender step
        return !!formData.gender;
      case 2: // Birth date step
        return (formData.birthMonth !== undefined && formData.birthMonth !== null)
          && (formData.birthDay !== undefined && formData.birthDay !== null)
          && (formData.birthYear !== undefined && formData.birthYear !== null)
          && calculateAge(formData.birthYear, formData.birthMonth, formData.birthDay) >= 12;
      case 3: // Physical Stats (Height & weight) step
        return isHeightValid() && isWeightValid();
      case 4: // Goal step
        return !!formData.goal;
      case 5: // Desired Pace step
        return !!formData.weeklyGoal &&
          formData.weeklyGoal >= 0.2 &&
          formData.weeklyGoal <= 3.0;
      case 6: // Activity Level step
        return !!formData.activityLevel;
      case 7: // Training step
        return !!formData.workoutDays || formData.workoutDays === 0;
      case 8: // Diet Type step
        return !!formData.diet;
      case 9: // Health step
        return true; // Optional step
      case 10: // Upgrade to DietinPro step
        return true; // Always valid
      case 11: // AI Analysis step
        return true; // Handled by AI analysis logic
      case 12: // Final summary step
        return true; // Always valid
      default:
        return true;
    }
  };

  // Add helper function for age calculation (monthIndex: 0-11)
  const calculateAge = (year: number, monthIndex: number, day: number) => {
    const birthDate = new Date(year, monthIndex, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

    const steps = [
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
          <div className="mb-8">
            <Loader size={64} className="text-[#1c2333]" />
          </div>
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

  if (step === -1) {
    return (
      <IntroStep
        onComplete={() => {
          setStep(0);
        }}
      />
    );
  }

  const activityLevels: ActivityLevel[] = ['SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTRA_ACTIVE'] as any;
  const experienceLevels: ExperienceLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const workoutDays: WorkoutDays[] = [0, 2, 3, 4, 5, 6, 7] as any;
  const genders: Gender[] = ['MALE', 'FEMALE'];
  const budgetOptions: Budget[] = ['BASIC', 'STANDARD', 'PREMIUM'];

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;
  const isRTL = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase().startsWith('ar');

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-white text-[#1a1f2e] font-['SF Pro Display'] overflow-y-auto overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      <div className="max-w-md mx-auto px-6 py-6 pb-32 min-h-full relative">
      <div className="flex items-center justify-between mb-8 mt-2">
        <button onClick={prevStep} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#f3f4f6]">
          <ChevronLeft size={20} className="text-[#1a1f2e]" />
        </button>
        <div className="flex-1 mx-4 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
          <div className="h-full bg-[#3b82f6] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[#f3f4f6]">
          <MoreHorizontal size={20} className="text-[#1a1f2e]" />
        </button>
      </div>

      {/* Back Button */}
      {step > 0 && (
        <button
          onClick={prevStep}
          className={cn(
            'absolute top-8 p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors',
            isRTL ? 'right-5' : 'left-5'
          )}
        >
          {isRTL ? (
            <ChevronRight className="w-6 h-6 text-black" />
          ) : (
            <ChevronLeft className="w-6 h-6 text-black" />
          )}
        </button>
      )}

      {/* Main Content */}
      <div className="mt-16 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Title */}
            {steps[step]?.title && (
              <h1 className="text-4xl font-bold mb-2 font-['SF Pro Display'] text-black">
                {steps[step]?.title}
              </h1>
            )}
            {/* Description */}
            {steps[step]?.description && (
              <p className="text-black/60 text-lg mb-8">
                {steps[step]?.description}
              </p>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {steps[step]?.fields}
            </div>

            {/* Next Button */}
            {step !== steps.length - 1 && step !== steps.length - 2 && (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={cn(
                  "w-full px-6 py-4 rounded-2xl font-medium transition-all duration-300",
                  isStepValid()
                    ? "bg-black text-white hover:bg-black/90"
                    : "bg-black/10 text-black/30 cursor-not-allowed"
                )}
              >
                {isStepValid() ? t('welcome.cta.continue', 'Continue') : t('welcome.cta.completeStep', 'Please complete this step')}
              </button>
            )}

            {step === steps.length - 1 && (
              <button
                onClick={() => setShowDisclaimer(true)}
                disabled={isLoading}
                className="w-full px-6 py-4 rounded-2xl font-medium transition-all duration-300 bg-black text-white hover:bg-black/90 flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <Loader size={20} className="w-5 h-5 text-white" />
                ) : (
                  t('welcome.cta.getStarted', 'Get Started')
                )}
              </button>
            )}

            {/* Sign out button only on first step after intro */}
            {step === 1 && (
              <button
                onClick={() => {
                  if (window.confirm(t('welcome.confirmSignOut', 'Are you sure you want to sign out?'))) {
                    handleSignOut();
                  }
                }}
                className="w-full px-6 py-4 rounded-2xl font-medium transition-all duration-300 bg-white text-black hover:bg-black/5 border border-black/10"
              >
                {t('common.logout', 'Sign out')}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ProSubscriptionPanel
        isOpen={isProPanelOpen}
        onClose={() => setIsProPanelOpen(false)}
      />

      <HealthDisclaimerModal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        onAgree={handleGetStarted}
        isLoading={isLoading}
      />
      </div>
    </motion.div>
  );
}


