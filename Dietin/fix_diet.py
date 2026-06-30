import re

with open('src/pages/Diet.tsx', 'r') as f:
    content = f.read()

# 1. Remove MealAnalysis import
content = re.sub(r'import MealAnalysis from "@/components/MealAnalysis";\n', '', content)

# 2. Add useNavigate from react-router-dom if not there
if 'useNavigate' not in content:
    content = content.replace('import { Link, useLocation } from "react-router-dom";', 'import { Link, useLocation, useNavigate } from "react-router-dom";')

# 3. Add navigate hook near useLocation
if 'const navigate = useNavigate();' not in content:
    content = content.replace('const location = useLocation();', 'const location = useLocation();\n  const navigate = useNavigate();')

# 4. Remove isMealAnalysisOpen state
content = re.sub(r'  const \[isMealAnalysisOpen, setIsMealAnalysisOpen\] = useState\(false\);\n', '', content)

# 5. Replace setIsMealAnalysisOpen(true) when editing
content = content.replace(
'''                              setEditingEntry(entry);
                              setIsMealAnalysisOpen(true);''',
'''                              navigate('/add-meal', { state: { editEntry: entry } });'''
)

# 6. Replace setIsMealAnalysisOpen(true) for add button
content = content.replace(
'''onClick={() => setIsMealAnalysisOpen(true)}''',
'''onClick={() => navigate('/add-meal')}'''
)

# 7. Remove <MealAnalysis ... /> rendering
content = re.sub(r'      <MealAnalysis\s+isOpen=\{isMealAnalysisOpen\}.*?/>\n', '', content, flags=re.DOTALL)

with open('src/pages/Diet.tsx', 'w') as f:
    f.write(content)

print("Diet.tsx fixed")
