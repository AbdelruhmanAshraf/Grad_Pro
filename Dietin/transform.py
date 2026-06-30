import re

with open('src/components/MealAnalysis.tsx', 'r') as f:
    content = f.read()

# 1. Rename component
content = re.sub(
    r'const MealAnalysis = \(\{ isOpen, onClose, setIsSearchOpen, editEntry \}: MealAnalysisProps\) => \{',
    "import { useNavigate, useLocation } from 'react-router-dom';\n\nconst AddMeal = () => {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const editEntry = location.state?.editEntry;\n  const setIsSearchOpen = (open: boolean) => { if(open) navigate('/diet', { state: { openSearch: true } }); };\n  const onClose = () => navigate(-1);",
    content
)

# 2. Remove Props interface and fix export
content = re.sub(r'interface MealAnalysisProps \{.*?\n\}\n', '', content, flags=re.DOTALL)
content = content.replace('export default MealAnalysis;', 'export default AddMeal;')

# 3. Remove framer motion drag stuff
content = re.sub(r'  const y = useMotionValue\(0\);\n  const opacity = useTransform\(y, \[0, 300\], \[1, 0\]\);\n', '', content)
content = re.sub(r'  const \[isDragging, setIsDragging\] = useState\(false\);\n', '', content)
content = re.sub(r'  const handleDragEnd = .*?setIsDragging\(false\);\n  \};\n', '', content, flags=re.DOTALL)

# 4. Remove body overflow locks
content = re.sub(r'  // Prevent scrolling on the main page when popup is open\n  useEffect\(\(\) => \{.*?\}, \[isOpen\]\);\n', '', content, flags=re.DOTALL)

# 5. Replace MealAnalysisAnimate with a div
content = re.sub(r'<MealAnalysisAnimate[^>]*>', '<div className="min-h-screen bg-[#f5f5f7] dark:bg-[#1c1c1e] pt-safe-top pb-24 relative z-50 overflow-y-auto">', content)
content = content.replace('</MealAnalysisAnimate>', '</div>')

# 6. Remove imports
content = content.replace('import MealAnalysisAnimate from "./MealAnalysisAnimate";\n', '')
content = content.replace('import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";', 'import { motion, AnimatePresence } from "framer-motion";')

with open('src/pages/AddMeal.tsx', 'w') as f:
    f.write(content)

print('Transformation complete!')
