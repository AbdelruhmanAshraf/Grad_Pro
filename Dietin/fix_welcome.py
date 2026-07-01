import re

def fix():
    with open('src/components/Welcome.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix imports
    content = re.sub(r"import \{ Activity, Apple, Check, Dumbbell, Egg, Flame, Leaf, Rabbit, Rocket, Snail, Timer, Turtle, Zap, User, Users, Scale, AlertCircle, MoreHorizontal \} from 'lucide-react';\nimport \{ Check as Check_2, Dumbbell as Dumbbell_2, Egg as Egg_2, Flame as Flame_2, Rabbit as Rabbit_2, Rocket as Rocket_2, Snail as Snail_2, Timer as Timer_2, Turtle as Turtle_2, Zap as Zap_2, BicepsFlexed, PersonStanding, MoreHorizontal as MoreHorizontal_2, Apple as Apple_2, Leaf as Leaf_2 \} from 'lucide-react';", 
    "import { Activity, Apple, Check, Dumbbell, Egg, Flame, Leaf, Rabbit, Rocket, Snail, Timer, Turtle, Zap, User, Users, Scale, AlertCircle, MoreHorizontal, BicepsFlexed, PersonStanding, Calendar, Drumstick, Bot } from 'lucide-react';", content)
    
    # Catch any duplicate import lines just in case
    content = re.sub(r"import \{ Activity, Apple, Check, Dumbbell, Egg, Flame, Leaf, Rabbit, Rocket, Snail, Timer, Turtle, Zap, User, Users, Scale, AlertCircle, MoreHorizontal \} from 'lucide-react';\nimport \{ Check, Dumbbell, Egg, Flame, Rabbit, Rocket, Snail, Timer, Turtle, Zap, BicepsFlexed, PersonStanding, MoreHorizontal, Apple, Leaf \} from 'lucide-react';", 
    "import { Activity, Apple, Check, Dumbbell, Egg, Flame, Leaf, Rabbit, Rocket, Snail, Timer, Turtle, Zap, User, Users, Scale, AlertCircle, MoreHorizontal, BicepsFlexed, PersonStanding, Calendar, Drumstick, Bot } from 'lucide-react';", content)

    # Fix aiResult type
    ai_result_old = """  const [aiResult, setAiResult] = useState<{
    goal: string;
    calories: number;
    metabolism: number;
    protein: number;
    carbs: number;
    fat: number;
    estimatedWeeks: number;
  } | null>(null);"""
    ai_result_new = """  const [aiResult, setAiResult] = useState<{
    bmi: number;
    calories: number;
    metabolism: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);"""
    content = content.replace(ai_result_old, ai_result_new)

    # Fix ActivityLevel types
    old_arrays = """  const activityLevels: ActivityLevel[] = ['LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTRA_ACTIVE'];
  const experienceLevels: ExperienceLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const workoutDays: WorkoutDays[] = [2, 3, 4, 5, 6] as const;
  const genders: Gender[] = ['MALE', 'FEMALE'];
  const budgetOptions: Budget[] = ['BASIC', 'STANDARD', 'PREMIUM'];"""
    new_arrays = """  const activityLevels: ActivityLevel[] = ['SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTRA_ACTIVE'] as any;
  const experienceLevels: ExperienceLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const workoutDays: WorkoutDays[] = [0, 2, 3, 4, 5, 6, 7] as any;
  const genders: Gender[] = ['MALE', 'FEMALE'];
  const budgetOptions: Budget[] = ['BASIC', 'STANDARD', 'PREMIUM'];"""
    content = content.replace(old_arrays, new_arrays)

    # Let's fix isStepValid logic
    # In 'isStepValid' there is probably logic depending on formData that might cause errors if values are missing
    
    with open('src/components/Welcome.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
    with open('src/lib/types.ts', 'r', encoding='utf-8') as f:
        t_content = f.read()
    
    t_content = t_content.replace("'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'EXTRA_ACTIVE'", "'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'EXTRA_ACTIVE'")
    t_content = t_content.replace("2 | 3 | 4 | 5 | 6", "0 | 2 | 3 | 4 | 5 | 6 | 7")
    t_content = t_content.replace("'CLASSIC' | 'PESCATARIAN' | 'VEGETARIAN' | 'VEGAN'", "'BALANCED' | 'KETO' | 'VEGAN' | 'CLASSIC' | 'PESCATARIAN' | 'VEGETARIAN'")
    
    with open('src/lib/types.ts', 'w', encoding='utf-8') as f:
        f.write(t_content)

if __name__ == '__main__':
    fix()
