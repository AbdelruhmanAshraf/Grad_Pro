const icons = require('lucide-react');
const required = ['Snail', 'Turtle', 'Rabbit', 'Rocket', 'Egg', 'Flame', 'Zap', 'Scale', 'Dumbbell', 'BicepsFlexed', 'PersonStanding', 'Timer', 'Activity', 'Apple', 'Leaf', 'Check', 'MoreHorizontal'];
const available = required.filter(i => icons[i]);
const missing = required.filter(i => !icons[i]);
console.log("Available:", available);
console.log("Missing:", missing);
