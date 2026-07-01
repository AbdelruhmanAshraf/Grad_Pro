import re

with open('src/pages/Diet.tsx', 'r') as f:
    content = f.read()

# 1. Import MealAnalysis
if 'import MealAnalysis' not in content:
    content = content.replace(
        'import { Link, useLocation, useNavigate } from "react-router-dom";',
        'import { Link, useLocation, useNavigate } from "react-router-dom";\nimport MealAnalysis from "../components/MealAnalysis";'
    )

# 2. Add isMealAnalysisOpen state
if 'const [isMealAnalysisOpen' not in content:
    content = content.replace(
        'const [dailyData, setDailyData] = useState(getDailyCalories(today));',
        'const [dailyData, setDailyData] = useState(getDailyCalories(today));\n  const [isMealAnalysisOpen, setIsMealAnalysisOpen] = useState(false);'
    )

# 3. Change onClick
content = content.replace(
    "onClick={() => navigate('/add-meal')}",
    "onClick={() => setIsMealAnalysisOpen(true)}"
)

# 4. Add MealAnalysis to JSX
if '<MealAnalysis' not in content:
    content = content.replace(
        '      </AnimatePresence>\n    </div>\n  );\n};\n\nexport default Diet;',
        '      </AnimatePresence>\n      <MealAnalysis isOpen={isMealAnalysisOpen} onClose={() => setIsMealAnalysisOpen(false)} setIsSearchOpen={setIsSearchOpen} />\n    </div>\n  );\n};\n\nexport default Diet;'
    )

with open('src/pages/Diet.tsx', 'w') as f:
    f.write(content)

print("Diet.tsx updated successfully.")
