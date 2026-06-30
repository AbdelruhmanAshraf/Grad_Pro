import re

with open('src/components/PlusButton.tsx', 'r') as f:
    content = f.read()

# Remove setIsMealAnalysisOpen prop
content = re.sub(r'\s*setIsMealAnalysisOpen: \(open: boolean\) => void;\n', '\n', content)
content = re.sub(r'setIsMealAnalysisOpen, ', '', content)

# Change handleMealLoggingClick
content = content.replace(
'''  const handleMealLoggingClick = () => {
    onClose();
    // Keep nav hidden during transition
    setTimeout(() => {
      setIsMealAnalysisOpen(true);
    }, 300);
  };''',
'''  const handleMealLoggingClick = () => {
    onClose();
    navigate('/add-meal');
  };'''
)

with open('src/components/PlusButton.tsx', 'w') as f:
    f.write(content)

print("PlusButton.tsx fixed")
