// Question Generator for ASVAB AR and MK questions
import { Rule, RULES } from './rules';

export interface Question {
  id: number;
  subject: 'AR' | 'MK';
  type: string;
  text: string;
  formulaId: string;
  keywords: string[];
  partners: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyWeight: number;
  solveSteps: string[];
  answer: number | string;
  choices: (number | string)[];
  category: 'AR' | 'MK';
}

// Difficulty to weight mapping
const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

// Small deterministic id counter
let _qid = 1000;
function nextId(): number { return ++_qid; }

// Helper: pick random element (deterministic if seeded)
function pick<T>(arr: T[], i = 0): T { return arr[i % arr.length]; }

// AR generator: returns question object
export function generateARQuestion(type: string, difficulty: 'easy' | 'medium' | 'hard' = 'easy'): Question {
  const w = DIFFICULTY_WEIGHT[difficulty];
  const id = nextId();
  
  switch (type) {
    case "rate_distance": {
      const r = difficulty === 'hard' ? 65 : 30; // mph
      const t = difficulty === 'hard' ? 2.5 : 2; // hours
      const text = `A car travels at ${r} miles per hour for ${t} hours. How far does it travel?`;
      const answer = r * t;
      return {
        id, subject: "AR", type, text, formulaId: "rate_distance",
        keywords: ["miles per hour", "hours", "travels"],
        partners: ["speed", "time"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Distance = Rate × Time`, `Distance = ${r} × ${t} = ${answer}`],
        answer, choices: [answer, answer - 10, answer + 10, answer + 20],
        category: "AR"
      };
    }

    case "work_combined": {
      const t1 = difficulty === 'hard' ? 12 : 6;
      const t2 = difficulty === 'hard' ? 8 : 9;
      const text = `Worker A can finish a job in ${t1} hours and Worker B in ${t2} hours. Working together, how long will they take (in hours)?`;
      const rate = 1/t1 + 1/t2;
      const answer = +(1 / rate).toFixed(2);
      return {
        id, subject: "AR", type, text, formulaId: "work_combined",
        keywords: ["working together", "together", "hours"],
        partners: ["work", "job", "combined"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Combined rate = 1/${t1} + 1/${t2}`, `Time = 1 / combinedRate = ${answer}`],
        answer, choices: [answer, +(answer + 1).toFixed(2), +(answer - 2).toFixed(2), +(answer + 3).toFixed(2)],
        category: "AR"
      };
    }

    case "percent_basic": {
      const whole = difficulty === 'hard' ? 250 : 80;
      const pct = difficulty === 'hard' ? 27 : 15; // %
      const text = `${pct}% of ${whole} is what number?`;
      const answer = +(whole * (pct/100)).toFixed(2);
      return {
        id, subject: "AR", type, text, formulaId: "percent_basic",
        keywords: ["%", "percent", "of"], partners: ["part", "whole"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Part = Percent × Whole`, `Part = ${pct}% × ${whole} = ${answer}`],
        answer, choices: [answer, +(answer + 5).toFixed(2), +(answer - 10).toFixed(2), +(answer * 2).toFixed(2)],
        category: "AR"
      };
    }

    case "ratio_proportion": {
      const total = difficulty === 'hard' ? 84 : 36;
      const ratio = [2, 3]; // 2:3
      const text = `A quantity is divided in the ratio ${ratio[0]}:${ratio[1]}. If total is ${total}, what is the larger share?`;
      const share = total * (ratio[1]/(ratio[0] + ratio[1]));
      const answer = +(share).toFixed(2);
      return {
        id, subject: "AR", type, text, formulaId: "ratio_proportion",
        keywords: ["ratio", "in the ratio", "share"],
        partners: ["parts", "total"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Total parts = ${ratio[0]}+${ratio[1]} = ${ratio[0]+ratio[1]}`, `Larger share = total * ${ratio[1]}/${ratio[0]+ratio[1]} = ${answer}`],
        answer, choices: [answer, +(answer - 5).toFixed(2), +(answer + 4).toFixed(2), +(answer * 0.5).toFixed(2)],
        category: "AR"
      };
    }

    case "average_mean": {
      const scores = difficulty === 'hard' ? [85, 92, 78, 96, 88] : [80, 85, 90];
      const text = `Find the average of these scores: ${scores.join(', ')}`;
      const answer = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        id, subject: "AR", type, text, formulaId: "average_mean",
        keywords: ["average", "scores"], partners: ["mean"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Sum = ${scores.join(' + ')} = ${scores.reduce((a, b) => a + b, 0)}`, `Average = Sum ÷ Count = ${answer}`],
        answer, choices: [answer, answer - 2, answer + 2, answer + 5],
        category: "AR"
      };
    }

    case "simple_interest": {
      const principal = difficulty === 'hard' ? 5000 : 1000;
      const rate = difficulty === 'hard' ? 4.5 : 5; // %
      const time = difficulty === 'hard' ? 3 : 2; // years
      const text = `What is the simple interest on $${principal} at ${rate}% for ${time} years?`;
      const answer = +(principal * (rate/100) * time).toFixed(2);
      return {
        id, subject: "AR", type, text, formulaId: "simple_interest",
        keywords: ["simple interest", "principal", "rate"], partners: ["interest", "years"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Interest = Principal × Rate × Time`, `Interest = ${principal} × ${rate}% × ${time} = $${answer}`],
        answer, choices: [answer, answer + 50, answer - 50, answer * 2],
        category: "AR"
      };
    }

    default: {
      // Fallback basic add/sub
      const a = 12, b = 7;
      const text = `John has ${a} apples and gives ${b} away. How many left?`;
      return {
        id, subject: "AR", type: "add_subtract", text,
        formulaId: "subtract_simple",
        keywords: ["gives away", "left", "remaining"],
        partners: ["apples"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Subtraction: ${a} - ${b} = ${a - b}`],
        answer: a - b, choices: [a - b, a - b + 1, a - b - 1, a - b + 5],
        category: "AR"
      };
    }
  }
}

// MK generator: produces algebra, fractions, geometry, etc.
export function generateMKQuestion(type: string, difficulty: 'easy' | 'medium' | 'hard' = 'easy'): Question {
  const w = DIFFICULTY_WEIGHT[difficulty];
  const id = nextId();
  
  switch (type) {
    case "algebra_linear": {
      const a = 4, b = 7; // solve ax + b = 0
      const text = `Solve for x: ${a}x + ${b} = 0`;
      const answer = -b / a;
      return {
        id, subject: "MK", type, text, formulaId: "algebra_linear",
        keywords: ["solve for x", "=", "solve"],
        partners: ["variable", "x"],
        difficulty, difficultyWeight: w,
        solveSteps: [`${a}x = -${b}`, `x = -${b}/${a} = ${answer}`],
        answer, choices: [answer, answer + 1, answer - 1, answer * 2],
        category: "MK"
      };
    }

    case "fraction_addsub": {
      const n1 = 1, d1 = 2, n2 = 1, d2 = 3;
      const text = `Compute: ${n1}/${d1} + ${n2}/${d2}`;
      const answer = n1/d1 + n2/d2;
      return {
        id, subject: "MK", type, text, formulaId: "fraction_addsub",
        keywords: ["fraction", "add", "sum"],
        partners: ["numerator", "denominator"],
        difficulty, difficultyWeight: w,
        solveSteps: [`LCD = 6`, `1/2 = 3/6, 1/3 = 2/6`, `Sum = 5/6 = ${answer}`],
        answer, choices: [+(answer).toFixed(4), 0.5, 1, 0.75],
        category: "MK"
      };
    }

    case "pythagorean": {
      const a = 3, b = 4;
      const text = `A right triangle has legs ${a} and ${b}. What is the hypotenuse?`;
      const answer = Math.sqrt(a*a + b*b);
      return {
        id, subject: "MK", type, text, formulaId: "pythagorean",
        keywords: ["right triangle", "hypotenuse", "legs"],
        partners: ["triangle"],
        difficulty, difficultyWeight: w,
        solveSteps: [`c = sqrt(a^2 + b^2) = sqrt(${a*a}+${b*b}) = ${answer}`],
        answer, choices: [answer, answer + 1, answer - 1, 6],
        category: "MK"
      };
    }

    case "area_circle": {
      const r = difficulty === 'hard' ? 7 : 3;
      const text = `What is the area of a circle with radius ${r}? (Use π ≈ 3.1416)`;
      const answer = +(Math.PI * r * r).toFixed(3);
      return {
        id, subject: "MK", type, text, formulaId: "area_circle",
        keywords: ["area of circle", "radius", "πr^2"],
        partners: ["radius"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Area = πr^2 = π*${r}^2 = ${answer}`],
        answer, choices: [answer, +(answer + 10).toFixed(3), +(answer - 5).toFixed(3), +(r * r).toFixed(3)],
        category: "MK"
      };
    }

    case "decimal_ops": {
      const a = 2.5, b = 1.2;
      const text = `Compute: ${a} + ${b}`;
      const answer = +(a + b).toFixed(2);
      return {
        id, subject: "MK", type, text, formulaId: "decimal_ops",
        keywords: ["decimal", "compute"], partners: ["+"],
        difficulty, difficultyWeight: w,
        solveSteps: [`${a} + ${b} = ${answer}`],
        answer, choices: [answer, +(answer + 0.5).toFixed(2), +(answer - 0.3).toFixed(2), 4],
        category: "MK"
      };
    }

    case "exponents_rules": {
      const base = difficulty === 'hard' ? 4 : 2;
      const exp = difficulty === 'hard' ? 3 : 4;
      const text = `What is ${base} raised to the power of ${exp}?`;
      const answer = Math.pow(base, exp);
      return {
        id, subject: "MK", type, text, formulaId: "exponents_rules",
        keywords: ["raised to", "power", "exponent"],
        partners: [],
        difficulty, difficultyWeight: w,
        solveSteps: [`${base}^${exp} = ${base} × ${base} × ${base}${exp > 3 ? ' × ' + base : ''} = ${answer}`],
        answer, choices: [answer, base * exp, base + exp, base - exp],
        category: "MK"
      };
    }

    case "algebra_two_step": {
      const a = 3, b = 8, c = 20; // solve ax + b = c
      const text = `Solve for x: ${a}x + ${b} = ${c}`;
      const answer = (c - b) / a;
      return {
        id, subject: "MK", type, text, formulaId: "algebra_two_step",
        keywords: ["solve for x", "two step"],
        partners: ["variable", "x"],
        difficulty, difficultyWeight: w,
        solveSteps: [`${a}x = ${c} - ${b}`, `${a}x = ${c - b}`, `x = ${c - b} ÷ ${a} = ${answer}`],
        answer, choices: [answer, answer + 1, answer - 1, answer * 2],
        category: "MK"
      };
    }

    default: {
      const text = `What is 7 × 6?`;
      return {
        id, subject: "MK", type: "multiply_simple", text,
        formulaId: "multiply_simple",
        keywords: ["times", "multiply"], partners: [],
        difficulty: "easy", difficultyWeight: 1,
        solveSteps: [`7×6=42`],
        answer: 42, choices: [42, 36, 48, 40],
        category: "MK"
      };
    }
  }
}

// Batch generator
export function batchGenerate(n: number = 10, subject: "AR" | "MK" = "AR"): Question[] {
  const out: Question[] = [];
  const arTypes = ["rate_distance", "work_combined", "percent_basic", "ratio_proportion", "average_mean", "simple_interest"];
  const mkTypes = ["algebra_linear", "fraction_addsub", "pythagorean", "area_circle", "decimal_ops", "exponents_rules", "algebra_two_step"];
  
  for (let i = 0; i < n; i++) {
    const difficulty = (i % 3 === 0) ? 'easy' : ((i % 3 === 1) ? 'medium' : 'hard');
    if (subject === "AR") {
      out.push(generateARQuestion(pick(arTypes, i), difficulty));
    } else {
      out.push(generateMKQuestion(pick(mkTypes, i), difficulty));
    }
  }
  return out;
}

// Generate a full 240-question test (120 AR + 120 MK)
export function generateFullTest(): { arQuestions: Question[]; mkQuestions: Question[] } {
  const arQuestions = batchGenerate(120, "AR");
  const mkQuestions = batchGenerate(120, "MK");
  return { arQuestions, mkQuestions };
}