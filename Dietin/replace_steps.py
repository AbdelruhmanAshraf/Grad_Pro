import re

with open('src/components/Welcome.tsx', 'r') as f:
    content = f.read()

# We need to replace the steps array.
# The steps array starts at `const steps = [` and ends before `  if (step === 0) {`
