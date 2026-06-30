import re

with open('src/pages/AddMeal.tsx', 'r') as f:
    content = f.read()

# Fix the closing tags at the very end
content = content.replace(
'''          </AnimatePresence>
          {/** bottom-only white gradient overlay for popup container */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </motion.div>
      </div>
      <ProSubscriptionPanel isOpen={isProPanelOpen} onClose={() => setIsProPanelOpen(false)} />
    </>
  );
};''',
'''          </AnimatePresence>
          </div>
        </div>
      </div>
      <ProSubscriptionPanel isOpen={isProPanelOpen} onClose={() => setIsProPanelOpen(false)} />
    </div>
  );
};'''
)

with open('src/pages/AddMeal.tsx', 'w') as f:
    f.write(content)

print("Closing layout replaced")
