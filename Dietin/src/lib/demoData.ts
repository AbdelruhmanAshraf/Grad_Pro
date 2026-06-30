import { useUserStore } from '@/stores/userStore';
import { useMealStore } from '@/stores/mealStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useHydrationStore } from '@/stores/hydrationStore';
import { useProgressStore } from '@/stores/progressStore';
import { CalorieEntry } from '@/types';
import { localDateKey, slugify } from '@/features/progress/lib/dates';
import { toast } from 'sonner';

export const loadDemoData = async () => {
  try {
    const today = new Date();
    
    // 1. Populate User Profile & Health Goals
    useUserStore.getState().setUser({
      name: "Alex Johnson",
      age: 28,
      gender: "Male",
      height: 180,
      weight: 75,
      bmi: 23.1,
      bmiCategory: "Healthy",
      calorieGoal: 2400,
      proteinGoal: 160,
      carbsGoal: 250,
      fatGoal: 80,
      metabolism: 2100,
      experienceLevel: 'INTERMEDIATE',
      isPro: true,
      isMoodTrackerEnabled: true,
      onboardingCompleted: true,
      dietaryPreferences: ["High Protein"],
      allergies: [],
      cuisinePreferences: ["Mediterranean", "Asian"],
      aiPersonalization: "Focus on muscle gain and consistent energy levels throughout the day."
    });

    // 2. Generate Historical Daily Calories & Macros
    const mockDailyCalories: Record<string, any> = {};
    const mockYearlyMeals: Record<number, CalorieEntry[]> = {};
    const currentYear = today.getFullYear();
    mockYearlyMeals[currentYear] = [];

    const mealTags = ["Breakfast", "Lunch", "Dinner", "Snack"];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = localDateKey(d);
      
      const entries: CalorieEntry[] = [];
      let dailyTotalCals = 0, dailyTotalProtein = 0, dailyTotalCarbs = 0, dailyTotalFat = 0;
      
      for (let j = 0; j < 3; j++) {
        const cals = Math.floor(Math.random() * 300) + 400;
        const protein = Math.floor(Math.random() * 20) + 20;
        const carbs = Math.floor(Math.random() * 30) + 30;
        const fat = Math.floor(Math.random() * 10) + 15;
        
        const entry: CalorieEntry = {
          id: `demo-meal-${dateKey}-${j}`,
          foodName: `Healthy ${mealTags[j]} Meal`,
          description: "Demo data meal",
          mealTag: mealTags[j],
          calories: cals,
          protein: protein,
          carbs: carbs,
          fat: fat,
          timestamp: new Date(d.setHours(8 + j * 5)).toISOString(),
          healthScore: 85 + Math.floor(Math.random() * 10),
        };
        entries.push(entry);
        mockYearlyMeals[currentYear].push(entry);
        dailyTotalCals += cals;
        dailyTotalProtein += protein;
        dailyTotalCarbs += carbs;
        dailyTotalFat += fat;
      }
      
      mockDailyCalories[dateKey] = {
        date: dateKey,
        entries,
        totalCalories: dailyTotalCals,
        totalProtein: dailyTotalProtein,
        totalCarbs: dailyTotalCarbs,
        totalFat: dailyTotalFat
      };
    }
    
    // Inject directly into user store
    useUserStore.setState({
      dailyCalories: mockDailyCalories,
      yearlyMeals: mockYearlyMeals
    });

    // 3. Populate Meal Suggestions
    useMealStore.getState().setSuggestions([
      {
        name: "Grilled Chicken Salad",
        type: "Lunch",
        calories: 450,
        protein: 45,
        carbs: 20,
        fat: 15,
        difficulty: "Easy",
        timeToMake: "15 mins",
        budget: "€",
        quickRecipe: "Mix grilled chicken with greens, tomatoes, and olive oil dressing.",
        cuisine: "Mediterranean"
      },
      {
        name: "Oatmeal with Berries",
        type: "Breakfast",
        calories: 350,
        protein: 12,
        carbs: 55,
        fat: 8,
        difficulty: "Easy",
        timeToMake: "10 mins",
        budget: "€",
        quickRecipe: "Boil oats, add fresh berries and a drizzle of honey.",
        cuisine: "Global"
      }
    ]);

    // 4. Populate Hydration Suggestions
    useHydrationStore.getState().setSuggestions([
      {
        name: "Lemon Mint Water",
        type: "Hydration",
        calories: 5,
        protein: 0,
        carbs: 1,
        fat: 0,
        difficulty: "Easy",
        timeToMake: "2 mins",
        budget: "€",
        quickRecipe: "Add fresh lemon slices and mint leaves to cold water."
      },
      {
        name: "Electrolyte Drink",
        type: "Recovery",
        calories: 45,
        protein: 0,
        carbs: 11,
        fat: 0,
        difficulty: "Easy",
        timeToMake: "5 mins",
        budget: "€€",
        quickRecipe: "Mix water, a pinch of salt, lemon juice, and honey."
      }
    ]);

    // 5. Populate Workouts Favorites
    const workoutStore = useWorkoutStore.getState();
    const demoExercises = [
      {
        id: "demo-ex-1",
        name: "Barbell Squat",
        level: "Intermediate",
        primaryMuscles: ["quadriceps", "glutes"],
        secondaryMuscles: ["hamstrings", "calves"],
        instructions: ["Stand with feet shoulder-width apart.", "Lower your body until thighs are parallel to the floor.", "Return to starting position."],
        category: "strength",
        images: []
      },
      {
        id: "demo-ex-2",
        name: "Push-ups",
        level: "Beginner",
        primaryMuscles: ["chest", "triceps"],
        secondaryMuscles: ["shoulders", "core"],
        instructions: ["Start in a plank position.", "Lower your body until your chest nearly touches the floor.", "Push back up."],
        category: "strength",
        images: []
      }
    ];
    demoExercises.forEach(ex => workoutStore.addFavorite(ex));

    // 6. Populate Progress Data
    const progressStore = useProgressStore.getState();
    // Add mock weight entries
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i * 7); // weekly weights
      const dateStr = localDateKey(d);
      await progressStore.addWeight(78 - (6 - i) * 0.5, { date: dateStr, source: 'manual' });
    }
    // Add mock hydration data for today
    await progressStore.recordHydration(2000, { date: localDateKey(today), goalMl: 2500 });

    toast.success("Demo data loaded successfully into all features!");
  } catch (error) {
    console.error("Failed to load demo data:", error);
    toast.error("Failed to load demo data. See console for details.");
  }
};
