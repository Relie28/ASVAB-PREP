// ASVAB Rules Engine - Formula Recognition Rules
export interface Rule {
  id: string;
  label: string;
  keywords: string[];
  partners: string[];
  exclusions: string[];
  notes: string;
  difficulty: number; // 1-5
  category: "AR" | "MK";
}

export const RULES: Rule[] = [
  // Basic Operations
  { 
    id: "add_simple", 
    label: "Addition (+)", 
    keywords: ["add", "sum", "total", "together", "plus", "combined", "in total", "total of", "altogether"], 
    partners: ["more", "left", "extra"], 
    exclusions: ["difference", "less", "minus"], 
    notes: "basic addition", 
    difficulty: 1,
    category: "AR"
  },
  { 
    id: "subtract_simple", 
    label: "Subtraction (−)", 
    keywords: ["difference", "minus", "left", "less", "decrease", "decreased", "fewer", "remain", "remaining", "subtracted"], 
    partners: ["left", "after"], 
    exclusions: ["total", "sum", "together"], 
    notes: "basic subtraction", 
    difficulty: 1,
    category: "AR"
  },
  { 
    id: "multiply_simple", 
    label: "Multiplication (×)", 
    keywords: ["times", "product", "each", "per", "multiply", "multiplied", "twice", "three times", "double"], 
    partners: ["each", "every"], 
    exclusions: ["divide", "per"], 
    notes: "simple multiplication", 
    difficulty: 1,
    category: "AR"
  },
  { 
    id: "divide_simple", 
    label: "Division (÷)", 
    keywords: ["divide", "shared", "split", "quotient", "per", "out of", "each", "ratio of", "distributed", "divided by"], 
    partners: ["each", "out of", "share"], 
    exclusions: ["times", "product"], 
    notes: "simple division", 
    difficulty: 1,
    category: "AR"
  },

  // Rate and Distance
  { 
    id: "rate_distance", 
    label: "Distance = Rate × Time", 
    keywords: ["speed", "mph", "km/h", "per hour", "per minute", "rate", "velocity", "distance", "travel", "driving", "walked"], 
    partners: ["time", "hours", "minutes", "days", "distance"], 
    exclusions: [], 
    notes: "D = R*T", 
    difficulty: 2,
    category: "AR"
  },
  { 
    id: "work_combined", 
    label: "Work / Combined Rates", 
    keywords: ["together", "working together", "both", "combined", "together can", "together will", "both can"], 
    partners: ["hours", "minutes", "work", "job", "complete"], 
    exclusions: [], 
    notes: "combined rate: 1/t1 + 1/t2", 
    difficulty: 3,
    category: "AR"
  },

  // Percent and Fractions
  { 
    id: "percent_basic", 
    label: "Percent (part = percent × whole)", 
    keywords: ["percent", "%", "what percent", "of the", "percent of", "is what percent", "percent increase", "percent decrease", "discount", "tax", "markup"], 
    partners: ["part", "whole", "price", "cost", "increase", "decrease"], 
    exclusions: [], 
    notes: "percent problems", 
    difficulty: 2,
    category: "AR"
  },
  { 
    id: "percent_change", 
    label: "Percent change (increase/decrease)", 
    keywords: ["increase by", "decrease by", "increase", "decrease", "raised by", "lowered by", "increased"], 
    partners: ["percent", "%", "more than", "less than"], 
    exclusions: [], 
    notes: "final = original*(1±p)", 
    difficulty: 3,
    category: "AR"
  },
  { 
    id: "fraction_basic", 
    label: "Fractions as division", 
    keywords: ["fraction", "numerator", "denominator", "over", "out of", "of a", "half", "third", "quarter", "⅔", "3/4"], 
    partners: ["part", "whole", "ratio"], 
    exclusions: [], 
    notes: "frac operations", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "fraction_addsub", 
    label: "Add/Subtract fractions", 
    keywords: ["add fractions", "add these fractions", "sum of fractions", "difference of fractions"], 
    partners: ["common denominator", "lcd", "least common denominator"], 
    exclusions: [], 
    notes: "find LCD then operate", 
    difficulty: 3,
    category: "MK"
  },
  { 
    id: "fraction_mult", 
    label: "Multiply fractions", 
    keywords: ["fraction multiplied", "multiply fractions", "times a fraction"], 
    partners: ["of", "times"], 
    exclusions: [], 
    notes: "multiply numerators/denominators", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "fraction_divide", 
    label: "Divide fractions", 
    keywords: ["divide fraction", "divided by a fraction", "fraction ÷ fraction", "over"], 
    partners: ["reciprocal", "invert"], 
    exclusions: [], 
    notes: "multiply by reciprocal", 
    difficulty: 3,
    category: "MK"
  },

  // Ratio and Proportion
  { 
    id: "ratio_proportion", 
    label: "Ratio / Proportion", 
    keywords: ["ratio", "in the ratio", "proportion", "proportional", "directly proportional", "scale"], 
    partners: ["parts", "for every", "to"], 
    exclusions: [], 
    notes: "cross-multiply", 
    difficulty: 2,
    category: "AR"
  },

  // Average and Statistics
  { 
    id: "average_mean", 
    label: "Average / Mean", 
    keywords: ["average", "mean", "average of", "mean of", "on average"], 
    partners: ["tests", "scores", "numbers"], 
    exclusions: [], 
    notes: "avg = total / count", 
    difficulty: 2,
    category: "AR"
  },
  { 
    id: "median_mode", 
    label: "Median/Mode (MK minor)", 
    keywords: ["median", "mode", "most frequent"], 
    partners: [], 
    exclusions: [], 
    notes: "rare on ASVAB", 
    difficulty: 3,
    category: "MK"
  },

  // Algebra
  { 
    id: "algebra_linear", 
    label: "Linear equation solving", 
    keywords: ["solve for x", "solve for", "is equal to", "equals", "= x", "is", "let x be", "what is x", "find x"], 
    partners: ["variable", "unknown", "x", "y"], 
    exclusions: [], 
    notes: "basic algebra", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "algebra_two_step", 
    label: "Two-step algebra", 
    keywords: ["first subtract", "then divide", "two steps", "two-step equation"], 
    partners: ["solve", "x"], 
    exclusions: [], 
    notes: "undo in reverse order", 
    difficulty: 3,
    category: "MK"
  },
  { 
    id: "algebra_distributive", 
    label: "Distributive Property", 
    keywords: ["parenthesis", "of", "times", "distribution", "multiply across"], 
    partners: ["distribute"], 
    exclusions: [], 
    notes: "a(bx + c) = d", 
    difficulty: 3,
    category: "MK"
  },

  // Order of Operations
  { 
    id: "order_of_ops", 
    label: "Order of operations (PEMDAS)", 
    keywords: ["parenthesis", "bracket", "exponent", "power", "square root", "order of operations", "evaluate"], 
    partners: ["then", "after"], 
    exclusions: [], 
    notes: "PEMDAS LTR for mult/div", 
    difficulty: 2,
    category: "MK"
  },

  // Exponents and Roots
  { 
    id: "exponents_rules", 
    label: "Exponents rules", 
    keywords: ["square", "squared", "cube", "cubed", "^2", "^3", "exponent", "power of", "raised to"], 
    partners: [], 
    exclusions: [], 
    notes: "basic exponent rules", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "roots", 
    label: "Square / cube roots", 
    keywords: ["square root", "sqrt", "root of"], 
    partners: [], 
    exclusions: [], 
    notes: "radicals", 
    difficulty: 2,
    category: "MK"
  },

  // Geometry
  { 
    id: "pythagorean", 
    label: "Pythagorean theorem", 
    keywords: ["hypotenuse", "right triangle", "legs", "right-angled", "right triangle", "c²", "a² + b²"], 
    partners: ["triangle", "right"], 
    exclusions: [], 
    notes: "a^2 + b^2 = c^2", 
    difficulty: 3,
    category: "MK"
  },
  { 
    id: "area_rectangle", 
    label: "Area rectangle", 
    keywords: ["area of rectangle", "length and width", "area rectangle", "l × w", "length times width"], 
    partners: ["length", "width"], 
    exclusions: [], 
    notes: "L * W", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "area_triangle", 
    label: "Area triangle", 
    keywords: ["area of triangle", "1/2 base height", "triangle area", "base and height"], 
    partners: ["base", "height"], 
    exclusions: [], 
    notes: "1/2*b*h", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "area_circle", 
    label: "Area circle", 
    keywords: ["area of circle", "πr^2", "radius", "diameter"], 
    partners: ["radius", "diameter"], 
    exclusions: [], 
    notes: "πr²", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "circumference", 
    label: "Circumference", 
    keywords: ["circumference", "perimeter of circle", "2πr", "πd", "around"], 
    partners: ["radius", "diameter"], 
    exclusions: [], 
    notes: "2πr", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "perimeter", 
    label: "Perimeter", 
    keywords: ["perimeter", "around", "sum of sides", "border"], 
    partners: ["side", "sides", "length", "width"], 
    exclusions: [], 
    notes: "sum of side lengths", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "volume_rect_prism", 
    label: "Volume rectangular prism", 
    keywords: ["volume", "cubic", "length width height", "v = lwh", "box"], 
    partners: ["length", "width", "height"], 
    exclusions: [], 
    notes: "L*W*H", 
    difficulty: 3,
    category: "MK"
  },

  // Angles
  { 
    id: "angles_basic", 
    label: "Angle sum / basic angles", 
    keywords: ["angle", "degrees", "right angle", "acute", "obtuse", "supplementary", "complementary"], 
    partners: ["triangle", "line", "degrees"], 
    exclusions: [], 
    notes: "angles", 
    difficulty: 2,
    category: "MK"
  },

  // Advanced Percent
  { 
    id: "percent_of", 
    label: "Percent of a number", 
    keywords: ["percent of", "what is % of", "of the"], 
    partners: ["percent", "of"], 
    exclusions: [], 
    notes: "convert to decimal", 
    difficulty: 2,
    category: "AR"
  },
  { 
    id: "percent_find", 
    label: "Find percent (part/whole)", 
    keywords: ["what percent is", "is what percent of"], 
    partners: ["part", "whole"], 
    exclusions: [], 
    notes: "percent = part/whole", 
    difficulty: 3,
    category: "AR"
  },

  // Interest
  { 
    id: "simple_interest", 
    label: "Simple interest", 
    keywords: ["simple interest", "interest per year", "principal", "rate per year", "simple interest formula"], 
    partners: ["principal", "rate", "time", "interest"], 
    exclusions: [], 
    notes: "I = PRT", 
    difficulty: 3,
    category: "AR"
  },
  { 
    id: "compound_interest", 
    label: "Compound interest (MK advanced)", 
    keywords: ["compound interest", "compounded", "compounded annually", "compounded monthly"], 
    partners: ["principal", "rate", "periods", "n"], 
    exclusions: [], 
    notes: "A = P(1+r/n)^{nt}", 
    difficulty: 4,
    category: "MK"
  },

  // Unit Conversions
  { 
    id: "unit_conversion_time", 
    label: "Unit conversion (time)", 
    keywords: ["minutes", "hours", "seconds", "days", "convert to hours", "convert to minutes", "per hour", "per minute"], 
    partners: ["hour", "minute"], 
    exclusions: [], 
    notes: "time conversions", 
    difficulty: 2,
    category: "AR"
  },
  { 
    id: "unit_conversion_length", 
    label: "Unit conversion (length)", 
    keywords: ["inch", "feet", "yards", "miles", "cm", "mm", "convert", "meters", "kilometers"], 
    partners: ["inch", "ft", "m"], 
    exclusions: [], 
    notes: "length conversions", 
    difficulty: 2,
    category: "AR"
  },

  // Money and Mixtures
  { 
    id: "money_currency", 
    label: "Money / Price / Discount", 
    keywords: ["price", "cost", "discount", "sale", "tax", "tip", "subtotal", "total cost", "money", "dollars"], 
    partners: ["discount", "tax", "price"], 
    exclusions: [], 
    notes: "money computations", 
    difficulty: 2,
    category: "AR"
  },
  { 
    id: "mixture", 
    label: "Mixture problems", 
    keywords: ["mixture", "concentrate", "solution", "percent solution", "mixture of", "blend"], 
    partners: ["percent", "parts"], 
    exclusions: [], 
    notes: "weighted averages", 
    difficulty: 4,
    category: "AR"
  },

  // Probability and Counting
  { 
    id: "probability_basic", 
    label: "Basic probability", 
    keywords: ["probability", "chance", "likely", "odds", "possible outcomes", "favorable"], 
    partners: ["outcomes", "chance"], 
    exclusions: [], 
    notes: "simple probability", 
    difficulty: 3,
    category: "AR"
  },
  { 
    id: "combinations_permutations", 
    label: "Counting: combos/perms", 
    keywords: ["combination", "permutation", "arrangements", "how many ways", "order matters"], 
    partners: ["arrangements", "ways"], 
    exclusions: [], 
    notes: "counting problems", 
    difficulty: 4,
    category: "MK"
  },

  // Patterns and Sequences
  { 
    id: "sequence_pattern", 
    label: "Numeric sequences / patterns", 
    keywords: ["sequence", "next number", "pattern", "arithmetic sequence", "geometric sequence", "common difference"], 
    partners: ["next", "previous"], 
    exclusions: [], 
    notes: "find rule", 
    difficulty: 3,
    category: "MK"
  },

  // Rounding and Estimation
  { 
    id: "rounding_significant", 
    label: "Rounding & significant digits", 
    keywords: ["round to", "rounded", "nearest", "significant figures", "sig figs", "decimal place"], 
    partners: ["nearest", "decimal"], 
    exclusions: [], 
    notes: "rounding rules", 
    difficulty: 2,
    category: "MK"
  },
  { 
    id: "estimation", 
    label: "Estimation / approximation", 
    keywords: ["estimate", "approximately", "about", "roughly", "closest to"], 
    partners: ["approx", "estimate"], 
    exclusions: [], 
    notes: "estimation strategies", 
    difficulty: 2,
    category: "AR"
  },

  // Inequalities
  { 
    id: "inequality", 
    label: "Inequalities", 
    keywords: [">", "<", "greater than", "less than", "at least", "at most"], 
    partners: ["x", "y", "solve"], 
    exclusions: [], 
    notes: "inequality solving", 
    difficulty: 3,
    category: "MK"
  },

  // Decimal Operations
  { 
    id: "decimal_ops", 
    label: "Decimal operations", 
    keywords: ["decimal", "point", "0.", ".5", ".25"], 
    partners: ["decimal place"], 
    exclusions: [], 
    notes: "decimal addition/mult/div", 
    difficulty: 2,
    category: "MK"
  },

  // Multi-step Problems
  { 
    id: "percent_multistep", 
    label: "Multi-step percent & fraction mix", 
    keywords: ["after discount then tax", "discount then tax", "increase then decrease", "what is after"], 
    partners: ["discount", "tax"], 
    exclusions: [], 
    notes: "multi-step percent", 
    difficulty: 4,
    category: "AR"
  },

  // Temperature Conversion
  { 
    id: "conversion_temperature", 
    label: "Temperature conversions (C/F)", 
    keywords: ["celsius", "fahrenheit", "convert to c", "convert to f"], 
    partners: ["°c", "°f"], 
    exclusions: [], 
    notes: "C↔F conversion", 
    difficulty: 3,
    category: "AR"
  }
];

// VE Probe for Word Knowledge and Paragraph Comprehension
export interface VEProbeItem {
  id: string;
  type: "WK" | "PC";
  q: string;
  choices: string[];
  answer: number;
  passage?: string;
}

export const VE_PROBE: VEProbeItem[] = [
  // Word Knowledge (1-5)
  { 
    id: "VK1", 
    type: "WK", 
    q: "Choose the word closest in meaning to: ABRupt", 
    choices: ["sudden", "gradual", "polite", "careful"], 
    answer: 0 
  },
  { 
    id: "VK2", 
    type: "WK", 
    q: "Choose the word closest in meaning to: FRAGMENT", 
    choices: ["piece", "whole", "story", "length"], 
    answer: 0 
  },
  { 
    id: "VK3", 
    type: "WK", 
    q: "Choose the word closest in meaning to: CANDID", 
    choices: ["honest", "secretive", "rough", "tiny"], 
    answer: 0 
  },
  { 
    id: "VK4", 
    type: "WK", 
    q: "Choose the word closest in meaning to: MITIGATE", 
    choices: ["lessen", "increase", "validate", "ignore"], 
    answer: 0 
  },
  { 
    id: "VK5", 
    type: "WK", 
    q: "Choose the word closest in meaning to: OBSTACLE", 
    choices: ["barrier", "advantage", "method", "explanation"], 
    answer: 0 
  },

  // Paragraph Comprehension (6-10)
  { 
    id: "PC1", 
    type: "PC", 
    passage: "Most plants require sunlight to perform photosynthesis, the process by which they convert light into chemical energy. Without adequate light, many plants weaken and may die.", 
    q: "Why is sunlight important to plants?", 
    choices: ["It provides chemical energy via photosynthesis", "It makes plants look green", "It cools plants down", "It attracts pollinators"], 
    answer: 0 
  },
  { 
    id: "PC2", 
    type: "PC", 
    passage: "A warranty usually covers defects in manufacturing but not damage caused by misuse or accidents. Customers should read terms to understand coverage limits.", 
    q: "What does a warranty usually NOT cover?", 
    choices: ["Damage from misuse or accidents", "Defects in manufacturing", "Term limits", "Coverage details"], 
    answer: 0 
  },
  { 
    id: "PC3", 
    type: "PC", 
    passage: "Recycling reduces the need for raw materials and saves energy. However, not all items are recyclable in every community because recycling programs vary.", 
    q: "Why might an item not be recyclable in a particular town?", 
    choices: ["Recycling programs vary by community", "There are no items that are recyclable", "Recycling increases raw material use", "All items are recyclable everywhere"], 
    answer: 0 
  },
  { 
    id: "PC4", 
    type: "PC", 
    passage: "A balanced budget requires that expenses do not exceed income. If expenses are higher, adjustments must be made to avoid a deficit.", 
    q: "What must be done if expenses exceed income?", 
    choices: ["Make adjustments to avoid a deficit", "Increase expenses", "Ignore the difference", "Assume income will rise automatically"], 
    answer: 0 
  },
  { 
    id: "PC5", 
    type: "PC", 
    passage: "Regular exercise improves cardiovascular health, strengthens muscles, and helps maintain a healthy weight. Experts recommend at least 150 minutes of moderate activity per week.", 
    q: "How much moderate exercise do experts recommend weekly?", 
    choices: ["150 minutes", "30 minutes", "60 minutes", "300 minutes"], 
    answer: 0 
  }
];

// VE Scoring function
export function scoreVEProbe(responses: boolean[]): { correct: number; total: number; VE_scaled: number } {
  const total = VE_PROBE.length;
  const correct = VE_PROBE.reduce((acc, item, idx) => {
    const resp = responses[idx];
    return acc + (resp ? 1 : 0);
  }, 0);
  const scaled = Math.round((correct / total) * 99);
  return { correct, total, VE_scaled: scaled };
}