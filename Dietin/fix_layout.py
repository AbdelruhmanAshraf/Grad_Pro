import re

with open('src/pages/AddMeal.tsx', 'r') as f:
    content = f.read()

# Replace the top wrapper
old_wrapper_start = r'''  return \(
    <>
      <div className="min-h-screen bg-\[#f5f5f7\] dark:bg-\[#1c1c1e\] pt-safe-top pb-24 relative z-50 overflow-y-auto">
        <motion\.div
          className="bg-\[#f5f5f7\] dark:bg-\[#1c1c1e\] rounded-t-\[20px\] overflow-hidden shadow-2xl mx-auto max-w-\[420px\] relative flex flex-col"
          animate=\{\{.*?\}\}
          transition=\{\{.*?\}\}
        >
          <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 bg-black/10 dark:bg-\[#white/20\] rounded-full" />
          </div>'''

new_wrapper = '''  return (
    <div className="h-full bg-[#f5f5f7] dark:bg-[#1c1c1e]">
      <NavHide isAIOpen={true} />
      <div className="h-full overflow-y-auto -webkit-overflow-scrolling-touch pb-20">
        <div className="container mx-auto max-w-2xl space-y-6 p-6">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleBackClick}
              className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-[#1d1d1f] dark:text-white/90" />
            </button>
            <h1 className="text-[1.75rem] tracking-tight text-black dark:text-white font-sf-display font-sf-bold">
              {t('diet.actions.addFood')}
            </h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
          
          <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10 relative flex flex-col min-h-[60vh] max-h-none">'''

# The regex replacement for wrapper
content = re.sub(r'  return \(\n    <>\n      <div className="min-h-screen.*?(?=<AnimatePresence mode="wait">)', new_wrapper + '\n          ', content, flags=re.DOTALL)

# Also fix the closing tags at the very end
content = content.replace(
'''        </motion.div>
      </div>
    </>
  );
};''',
'''          </div>
        </div>
      </div>
    </div>
  );
};'''
)

with open('src/pages/AddMeal.tsx', 'w') as f:
    f.write(content)

print("Layout replaced")
