const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'src/components/MealAnalysis.tsx');
const destFile = path.join(__dirname, 'src/pages/AddMeal.tsx');

let content = fs.readFileSync(srcFile, 'utf8');

// 1. Rename component
content = content.replace(/const MealAnalysis = \(\{ isOpen, onClose, setIsSearchOpen, editEntry \}: MealAnalysisProps\) => \{/g, 
  "import { useNavigate, useLocation } from 'react-router-dom';\n\nconst AddMeal = () => {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const editEntry = location.state?.editEntry;\n  const setIsSearchOpen = (open) => { if(open) navigate('/diet', { state: { openSearch: true } }); };\n  const onClose = () => navigate(-1);");

// 2. Remove Props interface and fix export
content = content.replace(/interface MealAnalysisProps \{[\s\S]*?\}/, '');
content = content.replace(/export default MealAnalysis;/, 'export default AddMeal;');

// 3. Remove framer motion drag stuff
content = content.replace(/const y = useMotionValue\(0\);\n  const opacity = useTransform\(y, \[0, 300\], \[1, 0\]\);/g, '');
content = content.replace(/const \[isDragging, setIsDragging\] = useState\(false\);/g, '');
content = content.replace(/const handleDragEnd = [\s\S]*?setIsDragging\(false\);\n  \};/g, '');

// 4. Remove body overflow locks
content = content.replace(/useEffect\(\(\) => \{\n    if \(isOpen\) \{[\s\S]*?\}\n  \}, \[isOpen\]\);/g, '');

// 5. Replace MealAnalysisAnimate with a div
content = content.replace(/<MealAnalysisAnimate[\s\S]*?>/g, '<div className="min-h-screen bg-[#f5f5f7] dark:bg-[#1c1c1e] pt-6 pb-24 relative z-50">');
content = content.replace(/<\/MealAnalysisAnimate>/g, '</div>');

// 6. Remove imports
content = content.replace(/import MealAnalysisAnimate from "\.\/MealAnalysisAnimate";/g, '');
content = content.replace(/import \{ motion, AnimatePresence, PanInfo, useMotionValue, useTransform \} from "framer-motion";/g, 'import { motion, AnimatePresence } from "framer-motion";');

fs.writeFileSync(destFile, content, 'utf8');
console.log('Transformation complete!');
