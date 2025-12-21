// Question Generator for ASVAB AR and MK questions
import { Rule, RULES } from './rules';
import { normalizeText, isDuplicate, structuralSignature, tokenFingerprint } from '@/ai/duplicates';
// NOTE: canonicalStore performs server-side file I/O and must not be imported
// at top-level into client bundles. We lazy-load it only in server-executed
// async functions to avoid bundler and lint issues.
let _canonicalStore: any | null = null;
async function getCanonicalStore() {
  if (_canonicalStore) return _canonicalStore;
  if (typeof window !== 'undefined') return null;
  try {
    // Use a dynamic path string to prevent static analyzers/bundlers from
    // eagerly including the server-only `canonical-store` module in client builds.
    const mod = await import('./' + 'canonical-store');
    _canonicalStore = (mod && (mod.default || mod));
    return _canonicalStore;
  } catch (e) {
    return null;
  }
}
import generateProblem, { generateQuestionObject, purgeSessionCache } from '@/ai/generateProblem';
import asvabBank from './asvab_bank';
import { getRecommendedDifficultyForCategory, registerQuestion, saveAdaptiveUserModel } from './adaptive-engine';

export interface Question {
  id: number;
  subject: 'AR' | 'MK' | 'GS' | 'WK' | 'PC' | 'MIXED';
  type: string;
  text: string;
  formulaId: string;
  keywords: string[];
  partners: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'very-hard' | 'master';
  difficultyWeight: number;
  solveSteps: string[];
  answer: number | string;
  choices: (number | string)[];
  category: 'AR' | 'MK' | 'GS' | 'WK' | 'PC' | 'MIXED';
}

// Difficulty to weight mapping (extended)
const DIFFICULTY_WEIGHT: Record<string, number> = { easy: 1, medium: 2, hard: 3, 'very-hard': 4, master: 5 };

const rankDifficulty = (d: string) => (d === 'easy' ? 0 : (d === 'medium' ? 1 : (d === 'hard' ? 2 : (d === 'very-hard' ? 3 : 4))));

// Small deterministic id counter
let _qid = 1000;
function nextId(): number { return ++_qid; }

// Helper: pick random element (deterministic if seeded)
function pick<T>(arr: T[], i = 0): T { return arr[i % arr.length]; }

// light-weight yield to keep long runs cooperative with UI thread
async function maybeYield(i: number) { if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); }

// AR generator: returns question object
export function generateARQuestion(type: string, difficulty: 'easy' | 'medium' | 'hard' | 'very-hard' | 'master' = 'easy'): Question {
  const w = DIFFICULTY_WEIGHT[difficulty];
  const id = nextId();
  
  switch (type) {
    case "reading_table": {
      const names = ['John', 'Amy', 'Sam', 'Lily', 'Kate', 'Bob'];
      const items = ['apples', 'bananas', 'oranges', 'pears'];
      const rows = 3;
      const cols = 3;
      const table: number[][] = [];
      for (let r = 0; r < rows; r++) {
        const row: number[] = [];
        for (let c = 0; c < cols; c++) row.push(1 + Math.floor(Math.random() * 9));
        table.push(row);
      }
      const qtype = Math.random() < 0.4 ? 'row' : (Math.random() < 0.7 ? 'col' : 'cell');
      let text = 'The table below shows items sold by different people.\\n';
      for (let r = 0; r < rows; r++) { text += `${names[r]}: ${table[r].join(', ')}\\n`; }
      let answer = 0; let question = '';
      if (qtype === 'row') {
        const r = Math.floor(Math.random() * rows);
        question = `How many items did ${names[r]} sell in total?`;
        answer = table[r].reduce((s, x) => s + x, 0);
      } else if (qtype === 'col') {
        const c = Math.floor(Math.random() * cols);
        question = `How many items were sold in column ${c + 1} in total?`;
        answer = table.reduce((s, row) => s + row[c], 0);
      } else {
        const r = Math.floor(Math.random() * rows); const c = Math.floor(Math.random() * cols);
        question = `How many ${items[c]} did ${names[r]} sell?`;
        answer = table[r][c];
      }
      const textFull = `${text}\\n${question}`;
      const qobj = { id, subject: 'AR', type: 'reading_table', text: textFull, formulaId: 'reading_table', keywords: ['table', 'read'], partners: [], difficulty, difficultyWeight: w, solveSteps: ['Read values from the table'], answer, choices: [answer, answer + 1, Math.max(0, answer - 1), answer + 2], category: 'AR' } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }
    case "rate_distance": {
  const r = rankDifficulty(difficulty) === 2 ? (50 + Math.floor(Math.random()*21)) : (rankDifficulty(difficulty) === 3 ? (70 + Math.floor(Math.random()*31)) : (rankDifficulty(difficulty) === 4 ? (100 + Math.floor(Math.random()*51)) : (20 + Math.floor(Math.random()*21)))); // ranges scale by tier
  const t = rankDifficulty(difficulty) >= 2 ? (2 + Math.floor(Math.random()*3)) : (1 + Math.floor(Math.random()*2)); // hours
  const text = `A car travels at ${r} miles per hour for ${t} hours. How far does it travel?`;
  const answer = r * t;
        const qobj = {
          id, subject: "AR", type, text, formulaId: "rate_distance" as any,
        keywords: ["miles per hour", "hours", "travels"],
        partners: ["speed", "time"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Distance = Rate × Time`, `Distance = ${r} × ${t} = ${answer}`],
        answer, choices: [answer, answer - 10, answer + 10, answer + 20],
        category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
    return qobj as any;
  }

    case "work_combined": {
      const t1 = rankDifficulty(difficulty) === 2 ? (10 + Math.floor(Math.random()*8)) : (rankDifficulty(difficulty) === 3 ? (14 + Math.floor(Math.random()*8)) : (rankDifficulty(difficulty) === 4 ? (18 + Math.floor(Math.random()*12)) : (4 + Math.floor(Math.random()*6))));
      const t2 = rankDifficulty(difficulty) === 2 ? (6 + Math.floor(Math.random()*6)) : (rankDifficulty(difficulty) === 3 ? (8 + Math.floor(Math.random()*6)) : (rankDifficulty(difficulty) === 4 ? (12 + Math.floor(Math.random()*8)) : (5 + Math.floor(Math.random()*7))));
      const text = `Worker A can finish a job in ${t1} hours and Worker B in ${t2} hours. Working together, how long will they take (in hours)?`;
      const rate = 1/t1 + 1/t2;
      const answer = +(1 / rate).toFixed(2);
        const qobj = {
          id, subject: "AR", type, text, formulaId: "work_combined" as any,
        keywords: ["working together", "together", "hours"],
        partners: ["work", "job", "combined"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Combined rate = 1/${t1} + 1/${t2}`, `Time = 1 / combinedRate = ${answer}`],
        answer, choices: [answer, +(answer + 1).toFixed(2), +(answer - 2).toFixed(2), +(answer + 3).toFixed(2)],
        category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
    return qobj as any;
  }

    case "percent_basic": {
      const whole = rankDifficulty(difficulty) === 2 ? (200 + Math.floor(Math.random()*201)) : (rankDifficulty(difficulty) === 3 ? (500 + Math.floor(Math.random()*501)) : (rankDifficulty(difficulty) === 4 ? (1000 + Math.floor(Math.random()*2001)) : (30 + Math.floor(Math.random()*71))));
      const pct = rankDifficulty(difficulty) >= 2 ? (10 + Math.floor(Math.random()*41)) : (5 + Math.floor(Math.random()*26)); // %
      const text = `${pct}% of ${whole} is what number?`;
      const answer = +(whole * (pct/100)).toFixed(2);
        const qobj = {
          id, subject: "AR", type, text, formulaId: "percent_basic" as any,
        keywords: ["%", "percent", "of"], partners: ["part", "whole"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Part = Percent × Whole`, `Part = ${pct}% × ${whole} = ${answer}`],
        answer, choices: [answer, +(answer + 5).toFixed(2), +(answer - 10).toFixed(2), +(answer * 2).toFixed(2)],
        category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
    return qobj as any;
  }

    case "ratio_proportion": {
      const total = rankDifficulty(difficulty) === 2 ? (60 + Math.floor(Math.random()*121)) : (rankDifficulty(difficulty) === 3 ? (150 + Math.floor(Math.random()*201)) : (rankDifficulty(difficulty) === 4 ? (300 + Math.floor(Math.random()*501)) : (20 + Math.floor(Math.random()*51))));
      const ratio = rankDifficulty(difficulty) >= 2 ? [3, 7] : [2, 3]; // vary ratios
      const text = `A quantity is divided in the ratio ${ratio[0]}:${ratio[1]}. If total is ${total}, what is the larger share?`;
      const share = total * (ratio[1]/(ratio[0] + ratio[1]));
      const answer = +(share).toFixed(2);
        const qobj = {
          id, subject: "AR", type, text, formulaId: "ratio_proportion" as any,
        keywords: ["ratio", "in the ratio", "share"],
        partners: ["parts", "total"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Total parts = ${ratio[0]}+${ratio[1]} = ${ratio[0]+ratio[1]}`, `Larger share = total * ${ratio[1]}/${ratio[0]+ratio[1]} = ${answer}`],
        answer, choices: [answer, +(answer - 5).toFixed(2), +(answer + 4).toFixed(2), +(answer * 0.5).toFixed(2)],
        category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
    return qobj as any;
  }

    case "average_mean": {
      const scores = rankDifficulty(difficulty) >= 2 ? [85, 92, 78, 96, 88].map(x => x + Math.floor(Math.random()*5)) : [80, 85, 90].map(x => x + Math.floor(Math.random()*3));
      const text = `Find the average of these scores: ${scores.join(', ')}`;
      const answer = scores.reduce((a, b) => a + b, 0) / scores.length;
        const qobj = {
          id, subject: "AR", type, text, formulaId: "average_mean" as any,
        keywords: ["average", "scores"], partners: ["mean"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Sum = ${scores.join(' + ')} = ${scores.reduce((a, b) => a + b, 0)}`, `Average = Sum ÷ Count = ${answer}`],
        answer, choices: [answer, answer - 2, answer + 2, answer + 5],
        category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
    return qobj as any;
  }

    case "mode_of_set": {
      const size = rankDifficulty(difficulty) >= 2 ? 7 : 5;
      const base = 2 + Math.floor(Math.random() * 5);
      const mode = base + Math.floor(Math.random() * 3);
  const arr: number[] = [];
      for (let i = 0; i < size; i++) arr.push(base + Math.floor(Math.random() * 6));
      // inject multiple copies of mode
      const copies = Math.max(2, Math.floor(size / 3));
      for (let i = 0; i < copies; i++) arr[Math.floor(Math.random()*size)] = mode;
      const text = `Find the mode of the following numbers: ${arr.join(', ')}`;
      const answer = mode;
        const qobj = {
          id, subject: "AR", type, text, formulaId: "mode_of_set" as any,
        keywords: ["mode", "statistics"], partners: ["mode"], difficulty, difficultyWeight: w,
        solveSteps: [`Mode is the most frequent value in the list = ${mode}`],
        answer, choices: [answer, answer+1, (answer-1) < 0 ? 0 : (answer-1), answer+2], category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "percent_multistep": {
      // Discount then tax or tax then discount
      const price = rankDifficulty(difficulty) === 2 ? (200 + Math.floor(Math.random()*300)) : (rankDifficulty(difficulty) === 3 ? (400 + Math.floor(Math.random()*600)) : (rankDifficulty(difficulty) === 4 ? (800 + Math.floor(Math.random()*1200)) : (30 + Math.floor(Math.random()*120))));
      const disc = rankDifficulty(difficulty) >= 2 ? (15 + Math.floor(Math.random()*20)) : (5 + Math.floor(Math.random()*10));
      const tax = rankDifficulty(difficulty) >= 2 ? (8 + Math.floor(Math.random()*10)) : (2 + Math.floor(Math.random()*5));
      const afterDisc = +(price * (1 - disc/100)).toFixed(2);
      const afterTax = +((afterDisc) * (1 + tax/100)).toFixed(2);
      const text = `An item costs $${price}. It is first discounted by ${disc}%, and then a sales tax of ${tax}% is applied to the discounted price. What is the final price?`;
      const answer = afterTax;
      const qobj = { id, subject: 'AR', type: 'percent_multistep', text, formulaId: 'percent_multistep', keywords: ['discount', 'tax', 'percent'], partners: ['price'], difficulty, difficultyWeight: w, solveSteps: [`After discount: ${afterDisc}`, `After tax: ${afterTax}`], answer, choices: [answer, +(answer + 2).toFixed(2), +(answer - 3).toFixed(2), +(answer + 10).toFixed(2)], category: 'AR' } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "divide_simple": {
      const a = 12 + Math.floor(Math.random()*50);
      const b = 2 + Math.floor(Math.random()*10);
      const text = `${a} items are shared equally among ${b} people. How many items does each person receive?`;
      const answer = Math.floor(a / b);
      const qobj = { id, subject: 'AR', type: 'divide_simple', text, formulaId: 'divide_simple', keywords: ['divide', 'shared', 'each'], partners: ['people'], difficulty, difficultyWeight: w, solveSteps: [`${a} ÷ ${b} = ${answer}`], answer, choices: [answer, answer + 1, Math.max(0, answer - 1), answer + 2], category: 'AR' } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "mixture": {
      const total = rankDifficulty(difficulty) >= 2 ? 120 : 40;
      const ratioA = 1 + Math.floor(Math.random()*3);
      const ratioB = 1 + Math.floor(Math.random()*3);
      const a = Math.round(total * (ratioA / (ratioA + ratioB)));
      const text = `A ${total}g solution is a mixture in the ratio ${ratioA}:${ratioB} of substance A to B. How many grams of substance A are in the mixture?`;
      const answer = a;
      const qobj = { id, subject: 'AR', type: 'mixture', text, formulaId: 'mixture', keywords: ['mixture', 'ratio', 'parts'], partners: ['ratio'], difficulty, difficultyWeight: w, solveSteps: [`A grams = total × ${ratioA}/${ratioA + ratioB} = ${answer}`], answer, choices: [answer, answer + 5, Math.max(0, answer - 3), answer + 10], category: 'AR' } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "probability_basic": {
      const total = rankDifficulty(difficulty) >= 2 ? 12 : 6;
      const favourable = 1 + Math.floor(Math.random() * Math.min(3, total - 1));
      const text = `A bag contains ${total} marbles, ${favourable} of which are red. If one marble is drawn at random, what is the probability it is red?`;
      const answer = +(favourable / total).toFixed(3);
      const qobj = { id, subject: 'AR', type: 'probability_basic', text, formulaId: 'probability_basic', keywords: ['probability', 'chance'], partners: ['outcomes'], difficulty, difficultyWeight: w, solveSteps: [`P = favourable / total = ${favourable}/${total} = ${answer}`], answer, choices: [answer, +(answer + 0.1).toFixed(3), Math.max(0, +(answer - 0.05).toFixed(3)), 0], category: 'AR' } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "next_in_sequence": {
      // patterns: arithmetic, geometric, alternating; build simple pattern
      const seqType = Math.random() < 0.6 ? 'arith' : (Math.random() < 0.5 ? 'geom' : 'alt');
  let seq: number[] = [];
      let ans = 0;
      if (seqType === 'arith') {
        const d = 1 + Math.floor(Math.random() * 5);
        const start = 1 + Math.floor(Math.random()*5);
        seq = [start, start + d, start + d*2, start + d*3];
        ans = start + d*4;
      } else if (seqType === 'geom') {
        const r = 2 + Math.floor(Math.random()*3);
        const start = 1 + Math.floor(Math.random()*3);
        seq = [start, start * r, start * r * r, start * r * r * r];
        ans = start * Math.pow(r, 4);
      } else {
        // alternating: +2, +3, +2, +3
        const start = 1 + Math.floor(Math.random()*5);
        seq = [start, start + 2, start + 5, start + 7];
        ans = start + 10;
      }
      const text = `What number is next in the sequence: ${seq.join(', ')} ?`;
      const answer = ans;
        const qobj = {
          id, subject: "AR", type, text, formulaId: "next_in_sequence" as any,
        keywords: ["sequence", "pattern"], partners: ["sequence"], difficulty, difficultyWeight: w,
        solveSteps: [`Pattern detected: ${seqType}, next = ${ans}`], answer, choices: [answer, answer+1, answer-1, answer+2], category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
  return qobj as any;
    }

    case "simple_interest": {
      const principal = rankDifficulty(difficulty) === 2 ? (3000 + Math.floor(Math.random()*7001)) : (rankDifficulty(difficulty) === 3 ? (6000 + Math.floor(Math.random()*9001)) : (rankDifficulty(difficulty) === 4 ? (15000 + Math.floor(Math.random()*20001)) : (500 + Math.floor(Math.random()*3001))));
      const rate = rankDifficulty(difficulty) >= 2 ? (3 + Math.random()*6) : (4 + Math.random()*3); // %
      const time = rankDifficulty(difficulty) >= 2 ? (3 + Math.floor(Math.random()*4)) : (1 + Math.floor(Math.random()*3)); // years
      const text = `What is the simple interest on $${principal} at ${rate}% for ${time} years?`;
      const answer = +(principal * (rate/100) * time).toFixed(2);
        const qobj = {
          id, subject: "AR", type, text, formulaId: "simple_interest" as any,
        keywords: ["simple interest", "principal", "rate"], partners: ["interest", "years"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Interest = Principal × Rate × Time`, `Interest = ${principal} × ${rate}% × ${time} = $${answer}`],
        answer, choices: [answer, answer + 50, answer - 50, answer * 2],
        category: "AR"
      };
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
  return qobj as any;
    }

    default: {
      // Fallback add/sub with randomized values
      const a = 8 + Math.floor(Math.random()*24), b = 1 + Math.floor(Math.random()*7);
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
export function generateMKQuestion(type: string, difficulty: 'easy' | 'medium' | 'hard' | 'very-hard' | 'master' = 'easy'): Question {
  const w = DIFFICULTY_WEIGHT[difficulty];
  const id = nextId();
  
  switch (type) {
    case "algebra_linear": {
      const a = 2 + Math.floor(Math.random()*7); const b = 1 + Math.floor(Math.random()*15); // solve ax + b = 0
      const templates = [
        `Solve for x: ${a}x + ${b} = 0`,
        `What is x if ${a}x + ${b} = 0?`,
        `If ${a}x = -${b}, what is the value of x?`,
        `Find x in the equation ${a}x + ${b} = 0`,
      ];
      const text = pick(templates, Math.floor(Math.random() * templates.length));
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
      const d1 = 2 + Math.floor(Math.random()*6); const d2 = 2 + Math.floor(Math.random()*6); const n1 = 1 + Math.floor(Math.random()*Math.max(1,d1-1)); const n2 = 1 + Math.floor(Math.random()*Math.max(1,d2-1));
      const textTemplates = [
        `Compute: ${n1}/${d1} + ${n2}/${d2}`,
        `What is ${n1}/${d1} plus ${n2}/${d2}?`,
        `Add the fractions ${n1}/${d1} and ${n2}/${d2}`
      ];
      const text = pick(textTemplates, Math.floor(Math.random() * textTemplates.length));
      const answer = n1/d1 + n2/d2;
      const qobj = {
        id, subject: "MK", type, text, formulaId: "fraction_addsub",
        keywords: ["fraction", "add", "sum"],
        partners: ["numerator", "denominator"],
        difficulty, difficultyWeight: w,
        solveSteps: [`LCD = 6`, `1/2 = 3/6, 1/3 = 2/6`, `Sum = 5/6 = ${answer}`],
        answer, choices: [+(answer).toFixed(4), 0.5, 1, 0.75],
        category: "MK"
      } as Question;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
  return qobj as any;
    }

  case "pythagorean": {
      const a = 3 + Math.floor(Math.random()*6); const b = 4 + Math.floor(Math.random()*6);
      const templatesP = [
        `A right triangle has legs ${a} and ${b}. What is the hypotenuse?`,
        `Find the hypotenuse of a right triangle with legs ${a} and ${b}.`,
        `A triangle has sides ${a} and ${b} as perpendicular legs; compute the hypotenuse.`
      ];
      const text = pick(templatesP, Math.floor(Math.random() * templatesP.length));
      const answer = Math.sqrt(a*a + b*b);
      const qobj = {
        id, subject: "MK", type, text, formulaId: "pythagorean",
        keywords: ["right triangle", "hypotenuse", "legs"],
        partners: ["triangle"],
        difficulty, difficultyWeight: w,
        solveSteps: [`c = sqrt(a^2 + b^2) = sqrt(${a*a}+${b*b}) = ${answer}`],
        answer, choices: [answer, answer + 1, answer - 1, 6],
        category: "MK"
      } as Question;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
  return qobj as any;
    }

  case "volume_rect_prism": {
      const l = rankDifficulty(difficulty) >= 2 ? (5 + Math.floor(Math.random()*8)) : (2 + Math.floor(Math.random()*4));
      const w2 = 1 + Math.floor(Math.random()*8); const h = 1 + Math.floor(Math.random()*6);
      const text = `Find the volume of a rectangular prism with length ${l}, width ${w2}, and height ${h}.`;
      const answer = l * w2 * h;
      const qobj = {
  id, subject: "MK", type, text, formulaId: "volume_rect_prism",
        keywords: ["volume", "rectangular prism", "lwh"],
        partners: ["length", "width", "height"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Volume = length × width × height = ${l} × ${w2} × ${h} = ${answer}`],
        answer, choices: [answer, answer + 10, Math.max(1, answer - 10), answer + 20],
        category: "MK"
      } as Question;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
  return qobj as any;
    }
    case "systems_two_eqs": {
      // Build simple system with integer solutions
      const x = 1 + Math.floor(Math.random()*5); const y = 1 + Math.floor(Math.random()*5);
      const a = 1 + Math.floor(Math.random()*4); const b = 1 + Math.floor(Math.random()*4);
      const c = a * x + b * y;
      const d = (1 + Math.floor(Math.random()*4)) * x + (1 + Math.floor(Math.random()*4)) * y;
      const text = `Solve the system: ${a}x + ${b}y = ${c} and ${d}x + ${d + 1}y = ${d * x + (d + 1) * y}. What is the value of x + y?`;
      const answer = x + y;
      const qobj = { id, subject: "MK", type, text, formulaId: "systems_two_eqs", keywords: ["system of equations", "simultaneous"], partners: ["x", "y"], difficulty, difficultyWeight: w, solveSteps: [`Solve the system via substitution/elimination: x=${x}, y=${y}`], answer, choices: [answer, answer + 1, answer - 1, answer + 2], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }
    case "polynomial_factor": {
      // Simple trinomial factoring x^2 + bx + c
      const b = 3 + Math.floor(Math.random()*6); const c = 2 + Math.floor(Math.random()*8);
      const text = `Factor: x^2 + ${b}x + ${c}`;
      // For simplicity choose b,c that factor nicely (we won't check algebraic decomposition rigorously)
      const choices = [`(x + ${b}) (x + ${c})`, `(x - ${b}) (x + ${c})`, `(x + ${b}) (x - ${c})`, `(x - ${b}) (x - ${c})`];
      const answer = choices[0];
      const qobj = { id, subject: "MK", type, text, formulaId: "polynomial_factor", keywords: ["factor", "trinomial"], partners: [], difficulty, difficultyWeight: w, solveSteps: [`Find two numbers that multiply to ${c} and add to ${b}`], answer, choices, category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }
    case "area_circle": {
      const r = rankDifficulty(difficulty) >= 2 ? (5 + Math.floor(Math.random()*8)) : (2 + Math.floor(Math.random()*4));
      const text = `What is the area of a circle with radius ${r}? (Use π ≈ 3.1416)`;
      const answer = +(Math.PI * r * r).toFixed(3);
      const qobj = {
        id, subject: "MK", type, text, formulaId: "area_circle",
        keywords: ["area of circle", "radius", "πr^2"],
        partners: ["radius"],
        difficulty, difficultyWeight: w,
        solveSteps: [`Area = πr^2 = π*${r}^2 = ${answer}`],
        answer, choices: [answer, +(answer + 10).toFixed(3), +(answer - 5).toFixed(3), +(r * r).toFixed(3)],
        category: "MK"
      } as Question;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

  case "decimal_ops": {
      const a = parseFloat((1 + Math.random()*4).toFixed(2)), b = parseFloat((0.5 + Math.random()*3).toFixed(2));
      const textVariants = [
        `Compute: ${a} + ${b}`,
        `What is ${a} plus ${b}?`,
        `Add ${a} and ${b}`
      ];
      const text = pick(textVariants, Math.floor(Math.random() * textVariants.length));
      const answer = +(a + b).toFixed(2);
      const qobj = {
        id, subject: "MK", type, text, formulaId: "decimal_ops",
        keywords: ["decimal", "compute"], partners: ["+"],
        difficulty, difficultyWeight: w,
        solveSteps: [`${a} + ${b} = ${answer}`],
        answer, choices: [answer, +(answer + 0.5).toFixed(2), +(answer - 0.3).toFixed(2), 4],
        category: "MK"
      } as Question;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
  return qobj as any;
    }

    case "exponents_rules": {
      const base = rankDifficulty(difficulty) >= 2 ? (3 + Math.floor(Math.random()*4)) : (2 + Math.floor(Math.random()*2));
      const exp = rankDifficulty(difficulty) >= 2 ? (3 + Math.floor(Math.random()*4)) : (2 + Math.floor(Math.random()*3));
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

    case "perimeter": {
      const sides = 3 + Math.floor(Math.random()*3); // triangle to pentagon
      const sideLength = 2 + Math.floor(Math.random()*7);
      const text = `A regular polygon has ${sides} sides each of length ${sideLength}. What is its perimeter?`;
      const answer = sides * sideLength;
      const qobj = { id, subject: "MK", type, text, formulaId: "perimeter", keywords: ["perimeter", "sides"], partners: ["side"], difficulty, difficultyWeight: w, solveSteps: [`Perimeter = number of sides × side length = ${sides} × ${sideLength} = ${answer}`], answer, choices: [answer, answer + 2, Math.max(0, answer - 1), answer + 5], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }
    case "angles_basic": {
      const a = 30 + Math.floor(Math.random()*61); // 30-90
      const text = `If one angle of a triangle is ${a}°, and another is 60°, what is the third angle?`;
      const answer = 180 - a - 60;
      const qobj = { id, subject: "MK", type, text, formulaId: "angles_basic", keywords: ["angle", "degrees", "triangle"], partners: ["triangle"], difficulty, difficultyWeight: w, solveSteps: [`Sum of triangle angles = 180°, third = 180 - ${a} - 60 = ${answer}`], answer, choices: [answer, answer + 10, Math.max(0, answer - 10), answer + 5], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "algebra_two_step": {
      const a = 2 + Math.floor(Math.random()*6), b = 1 + Math.floor(Math.random()*10), c = 10 + Math.floor(Math.random()*40); // solve ax + b = c
      const templates2 = [
        `Solve for x: ${a}x + ${b} = ${c}`,
        `If ${a}x + ${b} = ${c}, what is x?`,
        `Find the value of x when ${a}x + ${b} equals ${c}`
      ];
      const text = pick(templates2, Math.floor(Math.random() * templates2.length));
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

    case "algebra_distributive": {
      const a = 2 + Math.floor(Math.random()*5); const b = 1 + Math.floor(Math.random()*8); const c = 1 + Math.floor(Math.random()*8);
      const text = `Simplify: ${a}(${b}x + ${c})`;
      const answer = `${a*b}x + ${a*c}`;
      const qobj = { id, subject: "MK", type, text, formulaId: "algebra_distributive", keywords: ["distributive", "parenthesis", "multiply"], partners: ["x"], difficulty, difficultyWeight: w, solveSteps: [`Distribute ${a}: ${a}×${b}x + ${a}×${c} = ${answer}`], answer, choices: [answer, `${a*b}x + ${a*c + 1}`, `${(a*b)+1}x + ${a*c}`, `${a*b}x + ${a*c - 1}`], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "algebra_linear_word": {
      // Create a simple contextual algebra linear: x + b = c style
      const b = 1 + Math.floor(Math.random() * 10);
      const c = 10 + Math.floor(Math.random() * 40);
      const text = `A store had x items. After receiving ${b} more, the inventory became ${c}. What is x?`;
      const answer = c - b;
      const qobj = { id, subject: "MK", type, text, formulaId: "algebra_linear_word", keywords: ["solve for x", "equation"], partners: ["variable"], difficulty, difficultyWeight: w, solveSteps: [`x + ${b} = ${c}`, `x = ${c} - ${b} = ${answer}`], answer, choices: [answer, answer + 1, answer - 1, answer + 2], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "compound_interest": {
      const principal = 500 + Math.floor(Math.random()*4500);
      const rate = (3 + Math.floor(Math.random()*6)); // % per annum
      const n = (Math.random() < 0.5) ? 1 : (Math.random() < 0.5 ? 12 : 4); // comp periods per year
      const t = 1 + Math.floor(Math.random()*4);
      const amount = +(principal * Math.pow(1 + (rate/100)/n, n * t)).toFixed(2);
      const text = `What is the amount after ${t} years on $${principal} at ${rate}% compounded ${n} times per year?`;
      const qobj = { id, subject: "MK", type, text, formulaId: "compound_interest", keywords: ["compound interest", "compounded"], partners: ["principal", "rate"], difficulty, difficultyWeight: w, solveSteps: [`A = P(1 + r/n)^{nt} = ${amount}`], answer: amount, choices: [amount, +(amount+10).toFixed(2), +(amount-10).toFixed(2), amount * 1.1], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "median_mode": {
      const arrSize = rankDifficulty(difficulty) >= 2 ? 9 : 5;
      const base = 1 + Math.floor(Math.random()*8);
      const arr = Array.from({ length: arrSize }, (_, i) => base + Math.floor(Math.random()*10));
      arr.sort((a,b)=>a-b);
      const median = arr[Math.floor(arr.length/2)];
      const text = `Find the median of the following numbers: ${arr.join(', ')}`;
      const qobj = { id, subject: "MK", type, text, formulaId: "median_mode", keywords: ["median", "mode"], partners: [], difficulty, difficultyWeight: w, solveSteps: [`Sorted list: ${arr.join(', ')}; median = ${median}`], answer: median, choices: [median, median+1, median-1, Math.max(1, median-2)], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "percentage_change": {
      const original = 50 + Math.floor(Math.random() * 151);
      const change = 10 + Math.floor(Math.random() * 30);
      const finalVal = original + Math.round(original * (change / 100));
      const text = `A price increases from ${original} to ${finalVal}. What is the percent increase?`;
      const answer = Math.round((finalVal - original) / original * 100);
      const qobj = { id, subject: "MK", type, text, formulaId: "percentage_change", keywords: ["percent", "increase"], partners: ["percent"], difficulty, difficultyWeight: w, solveSteps: [`Increase = ${finalVal} - ${original}`, `Percent = Increase / Original × 100 = ${answer}%`], answer, choices: [answer, answer + 2, Math.max(1, answer - 1), answer + 5], category: "MK" } as any;
      (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
      (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
      return qobj as any;
    }

    case "unit_conversion": {
      // Convert miles to feet or yards to inches etc
      const choice = Math.random() < 0.5 ? 'miles_to_feet' : 'yards_to_inches';
      if (choice === 'miles_to_feet') {
        const miles = 1 + Math.floor(Math.random() * 10);
        const text = `Convert ${miles} miles to feet.`;
        const answer = miles * 5280;
        const qobj = { id, subject: "MK", type, text, formulaId: "unit_conversion_miles_feet", keywords: ["convert", "miles"], partners: ["feet"], difficulty, difficultyWeight: w, solveSteps: [`1 mile = 5280 feet`, `${miles} × 5280 = ${answer}`], answer, choices: [answer, answer - 100, answer + 100, Math.max(0, answer - 400)], category: "MK" } as any;
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
        return qobj as any;
      } else {
        const yards = 1 + Math.floor(Math.random() * 10);
        const text = `Convert ${yards} yards to inches.`;
        const answer = yards * 36;
        const qobj = { id, subject: "MK", type, text, formulaId: "unit_conversion_yards_inches", keywords: ["convert", "yards"], partners: ["inches"], difficulty, difficultyWeight: w, solveSteps: [`1 yard = 36 inches`, `${yards} × 36 = ${answer}`], answer, choices: [answer, answer - 6, answer + 12, Math.max(0, answer - 18)], category: "MK" } as any;
        (qobj as any).structuralSignature = structuralSignature(qobj.text || '');
        (qobj as any).tokenFingerprint = tokenFingerprint(qobj.text || '');
        return qobj as any;
      }

          
    }

    default: {
      const a = 2 + Math.floor(Math.random()*10), b = 2 + Math.floor(Math.random()*10);
      const product = a * b;
      const text = `What is ${a} × ${b}?`;
      // generate reasonable distractors
      const distractor1 = Math.max(1, product - Math.floor(Math.random() * 4 + 1));
      const distractor2 = product + Math.floor(Math.random() * 5 + 1);
      const distractor3 = (a + 1) * b; // common off-by-one mistake
      return {
        id, subject: "MK", type: "multiply_simple", text,
        formulaId: "multiply_simple",
        keywords: ["times", "multiply"], partners: [],
        difficulty: "easy", difficultyWeight: 1,
        solveSteps: [`${a} × ${b} = ${product}`],
        answer: product, choices: [product, distractor1, distractor2, distractor3],
        category: "MK"
      };
    }
  }
}

// Ensure the question has a choices array that includes the correct answer.
export function ensureChoicesIncludeAnswer(q: Question, avoidIndex?: number | null): Question {
  try {
    const out = { ...q } as Question;
    out.choices = Array.isArray(out.choices) ? out.choices.slice() : [];
    const ansStr = String(out.answer);
    // If answer already present (loose equality), accept it
    if (!out.choices.some(c => String(c) === ansStr)) {
      out.choices.push(out.answer);
    }
    // Replace generic placeholder distractors (e.g., 'Other', 'Other1') with
    // plausible distractors drawn from the same category bank or generated
    // using context-aware heuristics where possible.
    const placeholders = out.choices.map(c => typeof c === 'string' && /^Other/i.test(c));
    const needs = Math.max(0, 4 - out.choices.length);

    // Create distractor candidates using a context-aware generator
    const generateDistractorsForQuestion = (qobj: Question, needed: number) => {
      const res: any[] = [];
      const cat = qobj.category;
      const qtext = String(qobj.text || '').toLowerCase();

      // Helper: sample from bank answers, excluding the correct answer and existing choices
      const sampleFromBank = (count: number) => {
        const bankAnswers = ((asvabBank as any)[cat] || []).map((x: any) => x.answer).filter((a: any) => String(a) !== ansStr && !out.choices.some(c => String(c) === String(a)));
        while (res.length < count && bankAnswers.length) {
          const pick = bankAnswers.splice(Math.floor(Math.random() * bankAnswers.length), 1)[0];
          res.push(pick);
        }
      };

      // Domain-specific heuristics
      if (cat === 'GS') {
        // If question mentions 'organ' or 'body', prefer organ-related distractors
        const organs = ['Heart','Lungs','Brain','Kidney','Liver','Eye','Ear','Stomach','Skin'];
        if (qtext.includes('organ') || qtext.includes('body') || qtext.includes('heart') || qtext.includes('lungs')) {
          const orgs = organs.filter(o => String(o) !== ansStr && !out.choices.some(c => String(c) === String(o)));
          while (res.length < needed && orgs.length) res.push(orgs.splice(Math.floor(Math.random() * orgs.length),1)[0]);
        }
        // Fill remaining from bank
        sampleFromBank(needed);
      } else if (cat === 'WK') {
        // Vocabulary: use other WK answers as distractors
        sampleFromBank(needed);
      } else if (cat === 'PC') {
        // Paragraph comprehension: use other passage answers or similar sentences
        sampleFromBank(needed);
      } else if (cat === 'AR' || cat === 'MK') {
        // Numeric heuristics based on type
        const n = Number(qobj.answer);
        if (!Number.isNaN(n)) {
          // Off-by-one, swapped digits, percent mistakes
          const candSet = new Set<any>();
          candSet.add(n + 1);
          candSet.add(n - 1);
          candSet.add(n + Math.max(2, Math.round(n * 0.1)));
          // swapped digit heuristic
          const s = String(Math.abs(n));
          if (s.length >= 2) {
            const swapped = Number(s.split('').reverse().join('')) * (n < 0 ? -1 : 1);
            if (!Number.isNaN(swapped)) candSet.add(swapped);
          }
          candSet.delete(n);
          const arr = Array.from(candSet).slice(0, needed);
          while (res.length < needed && arr.length) res.push(arr.shift());
        }
        // If still short, sample from bank (answers that are numeric-like)
        sampleFromBank(needed);
      } else {
        sampleFromBank(needed);
      }

      return res.slice(0, needed);
    };

    // Replace placeholders
    for (let i = 0; i < out.choices.length; i++) {
      if (typeof out.choices[i] === 'string' && /^Other/i.test(out.choices[i])) {
        // Try to fill with a context-aware distractor
        const candArr = generateDistractorsForQuestion(out, 1);
        out.choices[i] = candArr[0] != null ? candArr[0] : `Option ${i + 1}`;
      }
    }

    // Add additional choices if still short
    const needed = Math.max(0, 4 - out.choices.length);
    if (needed > 0) {
      const more = generateDistractorsForQuestion(out, needed);
      out.choices.push(...more);
    }

    // Ensure we only return 4 choices and that the correct answer is not placed
    // at the avoidIndex if provided. We'll deterministically place the correct
    // answer at a random index excluding avoidIndex and fill remaining slots
    // with shuffled distractors.
    const finalChoices = out.choices.slice(0, 4).map(c => c);
    // Ensure uniqueness and preserve string/number types
    const uniqueChoices: any[] = [];
    for (const c of finalChoices) {
      const s = String(c);
      if (!uniqueChoices.some(u => String(u) === s)) uniqueChoices.push(c);
    }
    // If we have less than 4 unique, pad with generated distractors
    let padIdx = 0;
    const fallback = ['None of the above', 'Not applicable', 'All of the above', 'Unknown'];
    while (uniqueChoices.length < 4) {
      const more = generateDistractorsForQuestion(out, 1)[0] || fallback[padIdx % fallback.length];
      padIdx++;
      if (!uniqueChoices.some(u => String(u) === String(more))) uniqueChoices.push(more);
    }

    const answerVal = out.answer;
    const distractors = uniqueChoices.filter(c => String(c) !== String(answerVal));

    // Choose target index for the correct answer (0..3) excluding avoidIndex
    const indices = [0,1,2,3].filter(i => (avoidIndex == null) || i !== avoidIndex);
    const targetIndex = indices[Math.floor(Math.random() * indices.length)];

    const arranged = new Array(4).fill(null);
    arranged[targetIndex] = answerVal;

    // Shuffle distractors and fill other positions
    for (let i = distractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = distractors[i]; distractors[i] = distractors[j]; distractors[j] = tmp;
    }
    let di = 0;
    for (let i = 0; i < 4; i++) {
      if (arranged[i] == null) {
        arranged[i] = distractors[di++] ?? fallback[(di - 1) % fallback.length];
      }
    }

    out.choices = arranged;
    return out;
  } catch (e) { return q; }
}

// Batch generator
export function batchGenerate(n: number = 10, subject: "AR" | "MK" | "GS" | "WK" | "PC" = "AR"): Question[] {
  const out: Question[] = [];
  // If subject corresponds to a predefined ASVAB bank, return the first n items in order (easiest→hardest)
  if (subject === 'AR' || subject === 'MK' || subject === 'GS' || subject === 'WK' || subject === 'PC') {
    let bank: Question[] = [];
    if (subject === 'AR') bank = asvabBank.AR;
    else if (subject === 'MK') bank = asvabBank.MK;
    else if (subject === 'GS') bank = asvabBank.GS;
    else if (subject === 'WK') bank = asvabBank.WK;
    else bank = asvabBank.PC;
    for (let i = 0; i < n; i++) {
      out.push(bank[i % bank.length]);
    }
    return out;
  }
  // Fallback: previous randomized generation for AR/MK
  const arTypes = ["rate_distance", "work_combined", "percent_basic", "ratio_proportion", "average_mean", "simple_interest", "reading_table", "percent_multistep", "divide_simple", "mixture", "probability_basic"];
  const mkTypes = ["algebra_linear", "algebra_linear_word", "algebra_two_step", "algebra_distributive", "fraction_addsub", "fraction_mult", "fraction_divide", "pythagorean", "area_circle", "volume_rect_prism", "perimeter", "angles_basic", "decimal_ops", "exponents_rules", "algebra_two_step", "percentage_change", "unit_conversion", "systems_two_eqs", "polynomial_factor", "compound_interest", "median_mode"];

  for (let i = 0; i < n; i++) {
    const difficulty = (i % 3 === 0) ? 'easy' : ((i % 3 === 1) ? 'medium' : 'hard');
    if (subject === "AR") {
      out.push(generateARQuestion(pick(arTypes, Math.floor(Math.random() * arTypes.length)), difficulty));
    } else {
      out.push(generateMKQuestion(pick(mkTypes, Math.floor(Math.random() * mkTypes.length)), difficulty));
    }
  }
  return out;
}

// Shuffle choices for a question while ensuring that the answer's index is not equal to 'preventIndex' (if provided)
export function shuffleChoicesForQuestion(q: Question, preventIndex?: number): Question {
  const choices = [...q.choices];
  const ans = q.answer;
  function shuffle(arr: (number | string)[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  let attempts = 0;
  let idx = -1;
  do {
    shuffle(choices);
    idx = choices.findIndex(c => String(c) === String(ans));
    attempts++;
  } while (preventIndex !== undefined && idx === preventIndex && attempts < 12);
  return { ...q, choices } as Question;
}

// Async batch generator using AI for unique, adaptive questions
export async function batchGenerateAI(n: number = 10, subject: "AR" | "MK" | "MIXED" | "GS" | "WK" | "PC" = "AR", model: any = null, curriculum: { targetRatio?: number; reinforceRatio?: number; mixedRatio?: number } = {}, globalExclusion: string[] = [], opts: { signal?: AbortSignal; deadlineMs?: number; fastMode?: boolean; persist?: boolean; forceParaphrase?: boolean } = {}): Promise<Question[]> {
  if (opts.deadlineMs) (opts as any)._startTime = Date.now();
  const out: Question[] = [];
  const { targetRatio = 0.5, reinforceRatio = 0.3, mixedRatio = 0.2 } = curriculum;
  // If AI is disabled via localStorage toggle, fallback to the synchronous generator
  try {
    if (typeof window !== 'undefined') {
      // if model explicitly enabled/disabled, honor that
      if (model && model.preferences && typeof model.preferences.aiEnabled === 'boolean') {
        if (!model.preferences.aiEnabled) return batchGenerate(n, subject === 'MIXED' ? 'AR' : (subject as 'AR' | 'MK'));
      } else {
        const aiEnabled = localStorage.getItem('ai_enabled');
        if (aiEnabled === 'false') {
          // Return synchronous batch directly
          return batchGenerate(n, subject === 'MIXED' ? 'AR' : (subject as 'AR' | 'MK' | 'GS' | 'WK' | 'PC'));
        }
      }
    }
  } catch (e) {}
  // If asking for a predefined bank, return ordered slice (easiest→hardest)
  if (subject === 'AR' || subject === 'MK' || subject === 'GS' || subject === 'WK' || subject === 'PC') {
    const bank = subject === 'AR' ? asvabBank.AR : (subject === 'MK' ? asvabBank.MK : (subject === 'GS' ? asvabBank.GS : (subject === 'WK' ? asvabBank.WK : asvabBank.PC)));
    return bank.slice(0, n);
  }
  const seen = new Set<string>();
  const seenSigs = new Set<string>();
  const seenFingers = new Set<string>();
  const canonicalStore = await getCanonicalStore();
  // helper to yield occasionally so long-running loops don't block main thread
  async function maybeYield(i: number) { if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); }
  for (let i = 0; i < n; i++) {
    await maybeYield(i);
    // check for deadline or abort
    if (opts.signal && (opts.signal as any).aborted) {
      // abort if requested
      break;
    }
    if (opts.deadlineMs && Date.now() - (opts as any)._startTime > opts.deadlineMs) {
      break;
    }
    // compute difficulty per category using model
    // For mixed subject, ask the engine for each individual subject's difficulty and pick the one we just chose
    let recomm = 'easy';
    let mode: 'targeted' | 'reinforce' | 'mixed' = 'targeted';
    try {
      // Choose generation mode: targeted, reinforce, or mixed
      const r = Math.random();
      if (r < targetRatio) mode = 'targeted';
      else if (r < targetRatio + reinforceRatio) mode = 'reinforce';
      else mode = 'mixed';
      if (subject === 'MIXED') {
        // pick for the currently computed 'effectiveSubject' later
        recomm = getRecommendedDifficultyForCategory(model, 'AR');
      } else {
        recomm = getRecommendedDifficultyForCategory(model, subject as 'AR' | 'MK');
      }
    } catch (e) { recomm = 'easy'; }
    // map to numeric difficulty used by generateProblem (1..5)
    const diff = recomm === 'easy' ? 1 : (recomm === 'medium' ? 2 : (recomm === 'hard' ? 3 : (recomm === 'very-hard' ? 4 : 5)));
      // normalize subject to string to satisfy TypeScript narrowing in mixed unions
      const subj = subject as string;
    try {
      // pick a target formula to prioritize, based on mastery/weights
  let targetFormula: string | null = null;
      try {
        const candidates = (RULES || []).filter(r => (r as any).category === subject).map(r => r.id);
        let bestScore = 0;
        for (const c of candidates) {
          const s = (model && model.statsByFormula && model.statsByFormula[c]) || { attempts: 0, correct: 0 };
          const attempts = (s.attempts || 0);
          const mastery = attempts ? (s.correct / attempts) : 0;
          const weight = (model && model.questionWeights && model.questionWeights[c]) || 1.0;
          const score = (1 - mastery) * weight; // higher score -> more need
          if (score > bestScore) { bestScore = score; targetFormula = c; }
        }
      } catch (e) { /* ignore analysis errors */ }
  // Occasionally or per mode, ask AI to produce a longer scenario problem (multi-step) to capture mixed scenario flows
  // Favor more scenario variation for MK questions to discourage short template-based MK items
  const scenarioInterval = subj === 'MK' ? 6 : 12;
  let scenario = (i % scenarioInterval === 0) || subject === 'MIXED';
  if (mode === 'mixed') scenario = true;
  // For mixed sessions, randomly choose AR or MK as a primary topic per problem
  let effectiveSubject = subject === 'MIXED' ? (i % 2 === 0 ? 'AR' : 'MK') : subject;
  if (mode === 'reinforce') {
    effectiveSubject = subject === 'MIXED' ? (i % 2 === 0 ? 'AR' : 'MK') : subject;
  }
      // Based on mode, adjust inputs to generateQuestionObject
      let formulaHint = targetFormula as any;
      if (mode === 'reinforce') {
        // choose a formula which has moderate mastery (e.g., 0.5 - 0.8)
        try {
          const candidates = (RULES || []).filter(r => (r as any).category === effectiveSubject).map(r => r.id);
          const filtered = candidates.filter(c => {
            const s = (model && model.statsByFormula && model.statsByFormula[c]) || { attempts: 0, correct: 0 };
            const attempts = s.attempts || 0;
            const mastery = attempts ? (s.correct / attempts) : 0;
            return mastery >= 0.4 && mastery <= 0.8;
          });
          if (filtered.length) formulaHint = pick(filtered, i % filtered.length);
        } catch (e) {}
      } else if (mode === 'mixed') {
        // hint to produce scenario/mixed problems — we'll rely on scenario flag
        formulaHint = undefined;
      }

      // Attempt to generate a non-duplicate question within this batch
  let exclusionList = out.map(x => normalizeText(x.text || '')).concat(Array.from(seen)).concat(globalExclusion);
  let q = await generateQuestionObject(effectiveSubject, diff, 20, scenario, formulaHint as any, exclusionList, { signal: opts.signal, fastMode: opts.fastMode, persist: typeof opts.persist === 'undefined' ? true : !!opts.persist });
    let genAttempts = 0;
    const outProblems = out.map(x => ({ problem: (x.text || '').toString(), structuralSignature: (x as any).structuralSignature, tokenFingerprint: (x as any).tokenFingerprint, embedding: (x as any).embedding, numbers: (x as any).numbers }));
  let qSig = '';
  let qFinger = '';
  if (q) {
    qSig = (q as any).structuralSignature || structuralSignature(q.text || '');
    qFinger = (q as any).tokenFingerprint || tokenFingerprint(q.text || '');
  }
  const duplicateThreshold = opts.fastMode ? 0.85 : 0.75;
  const maxGenAttempts = opts.fastMode ? 3 : 20;
  while (q && (seen.has(normalizeText(q.text || '')) || seenSigs.has(qSig) || seenFingers.has(qFinger) || seen.has((q as any).structuralSignature) || seen.has((q as any).tokenFingerprint) || isDuplicate(outProblems, { problem: q.text, structuralSignature: (q as any).structuralSignature, tokenFingerprint: (q as any).tokenFingerprint, embedding: (q as any).embedding, numbers: (q as any).numbers }, duplicateThreshold)) && genAttempts < maxGenAttempts) {
    if (opts.signal && (opts.signal as any).aborted) break;
    if (opts.deadlineMs && Date.now() - (opts as any)._startTime > opts.deadlineMs) break;
        // try re-generation with slightly different hints
        genAttempts += 1;
  exclusionList = out.map(x => normalizeText(x.text || '')).concat(Array.from(seen)).concat(globalExclusion);
  q = await generateQuestionObject(effectiveSubject, diff, 20, scenario || genAttempts > 1, formulaHint as any, exclusionList, { signal: opts.signal, fastMode: opts.fastMode, persist: typeof opts.persist === 'undefined' ? true : !!opts.persist });
      }
      if (q) {
  out.push(q as Question);
        const norm = normalizeText(q.text || '');
  if (seen.has(norm) && genAttempts >= 19) {
          // If maximum attempts are reached and we still see duplicates, pick a different fallback
          const types = effectiveSubject === 'AR' ? ["rate_distance","work_combined","percent_basic","ratio_proportion","average_mean","simple_interest","reading_table","percent_multistep","divide_simple","mixture","probability_basic","mode_of_set","next_in_sequence"] : ["algebra_linear","fraction_addsub","fraction_mult","fraction_divide","pythagorean","area_circle","volume_rect_prism","perimeter","angles_basic","decimal_ops","exponents_rules","algebra_two_step","algebra_distributive","percentage_change","unit_conversion","systems_two_eqs","polynomial_factor","compound_interest","median_mode"];
          let alt: Question | null = null;
          for (const t of types) {
            const candidate = effectiveSubject === 'AR' ? generateARQuestion(t, (diff === 1 ? 'easy' : (diff === 2 ? 'medium' : (diff === 3 ? 'hard' : (diff === 4 ? 'very-hard' : 'master'))))) : generateMKQuestion(t, (diff === 1 ? 'easy' : (diff === 2 ? 'medium' : (diff === 3 ? 'hard' : (diff === 4 ? 'very-hard' : 'master')))));
            const csig = structuralSignature(candidate.text || '');
            if (!seenSigs.has(csig)) { alt = candidate; break; }
          }
          if (alt) {
            q = alt as any;
          } else {
            // final fallback: mutate text strongly
            q.text = (q.text || '') + ` (alt ${Math.floor(Math.random() * 100000)})`;
          }
        }
        if (q) {
          seen.add(normalizeText(q.text || ''));
          if (qSig) seenSigs.add(qSig);
          if (qFinger) seenFingers.add(qFinger);
        }
  if (qSig) seenSigs.add(qSig);
  if (qFinger) seenFingers.add(qFinger);
  // also add structural signature and fingerprint to exclusion via seen set
  if ((q as any).structuralSignature) seen.add((q as any).structuralSignature);
  if ((q as any).tokenFingerprint) seen.add((q as any).tokenFingerprint);
        try {
          // register generated question into adaptive model so engine can schedule reviews and track times
          if (model) {
            registerQuestion(model, q as any);
          }
        } catch (e) {}
  } else {
  const types = effectiveSubject === 'AR' ? ["rate_distance","work_combined","percent_basic","ratio_proportion","average_mean","simple_interest","reading_table","percent_multistep","divide_simple","mixture","probability_basic"] : ["algebra_linear","fraction_addsub","fraction_mult","fraction_divide","pythagorean","area_circle","volume_rect_prism","perimeter","decimal_ops","exponents_rules","algebra_two_step","algebra_distributive","percentage_change","unit_conversion","systems_two_eqs","polynomial_factor","compound_interest","median_mode"];
        const fallbackType = types[i % types.length];
        const fallbackQ = effectiveSubject === 'AR' ? generateARQuestion(fallbackType, (diff === 1 ? 'easy' : (diff === 2 ? 'medium' : (diff === 3 ? 'hard' : (diff === 4 ? 'very-hard' : 'master'))))) : generateMKQuestion(fallbackType, (diff === 1 ? 'easy' : (diff === 2 ? 'medium' : (diff === 3 ? 'hard' : (diff === 4 ? 'very-hard' : 'master')))));
        out.push(fallbackQ as Question);
        seen.add(normalizeText(fallbackQ.text || ''));
      }
    } catch (e) {
      // fallback to synchronous generator if AI fails
      const difficulty = recomm;
    const types = subj === 'AR' ? ["rate_distance","work_combined","percent_basic","ratio_proportion","average_mean","simple_interest","reading_table","percent_multistep","divide_simple","mixture","probability_basic"] : ["algebra_linear","fraction_addsub","fraction_mult","fraction_divide","pythagorean","area_circle","volume_rect_prism","perimeter","decimal_ops","exponents_rules","algebra_two_step","algebra_distributive","percentage_change","unit_conversion","systems_two_eqs","polynomial_factor","compound_interest","median_mode"];
      const type = types[i % types.length];
      const fallback = subj === 'AR' ? generateARQuestion(type, difficulty as any) : generateMKQuestion(type, difficulty as any);
      out.push(fallback);
    }
  }
  try { if (model) saveAdaptiveUserModel(model); } catch (e) {}
  return out;
}

// Generate a full 240-question test (120 AR + 120 MK)
export function generateFullTest(): { arQuestions: Question[]; mkQuestions: Question[] } {
  const arQuestions = batchGenerate(120, "AR");
  const mkQuestions = batchGenerate(120, "MK");
    try { purgeSessionCache({ keepUniqueCount: 1000 }); } catch (e) {}
  return { arQuestions, mkQuestions };
}

// New: Generate the ASVAB Full Practice sections (WK -> PC -> GS -> MK -> AR)
export function generateFullPractice() {
  const wkQuestions = batchGenerate(40, 'WK');
  const pcQuestions = batchGenerate(20, 'PC');
  const gsQuestions = batchGenerate(30, 'GS');
  const mkQuestions = batchGenerate(30, 'MK');
  const arQuestions = batchGenerate(35, 'AR');
  try { purgeSessionCache({ keepUniqueCount: 1000 }); } catch (e) {}
  return { wkQuestions, pcQuestions, gsQuestions, mkQuestions, arQuestions };
}

export async function generateFullPracticeAI(model: any = null) {
  // For now, return the predefined banks as the AI generation; placeholder for future AI-enhanced variants
  return {
    wkQuestions: batchGenerate(40, 'WK'),
    pcQuestions: batchGenerate(20, 'PC'),
    gsQuestions: batchGenerate(30, 'GS'),
    mkQuestions: batchGenerate(30, 'MK'),
    arQuestions: batchGenerate(35, 'AR')
  };
}

// Async full test using AI generation — generates AR & MK via AI while alternating topics and ensuring mix
export async function generateFullTestAI(model: any = null, opts: { timeoutMs?: number; signal?: AbortSignal; fastMode?: boolean } = {}): Promise<{ arQuestions: Question[]; mkQuestions: Question[] }> {
  // Generate mostly AR/MK questions but insert a small portion of MIXED scenario problems
  // derive curriculum settings from model weaknesses
  let curriculum: { targetRatio?: number; reinforceRatio?: number; mixedRatio?: number } = { targetRatio: 0.5, reinforceRatio: 0.3, mixedRatio: 0.2 };
  try {
    if (model && model.statsByFormula) {
      const candidates = Object.keys(model.statsByFormula || {});
      const total = candidates.length || 1;
      let weak = 0;
      for (const c of candidates) {
        const s = model.statsByFormula[c] || { attempts: 0, correct: 0 };
        const attempts = s.attempts || 0;
        const mastery = attempts ? (s.correct / attempts) : 0;
        if (mastery < 0.55) weak += 1;
      }
      const weakRatio = weak / total; // percent of formulas that are weak
      // increase targeting if many weak formulas
      curriculum.targetRatio = Math.min(0.75, 0.4 + weakRatio * 0.6);
      curriculum.reinforceRatio = Math.max(0.15, 0.3 - (weakRatio * 0.2));
      curriculum.mixedRatio = Math.max(0.05, 1 - (curriculum.targetRatio + curriculum.reinforceRatio));
    }
  } catch (e) {}
  const canonicalStore = await getCanonicalStore();

  const globalExclusion: string[] = [];
  let controller: AbortController | null = null;
  let signal: AbortSignal | undefined = opts.signal;
  if (!signal && opts.timeoutMs) {
    controller = new AbortController();
    signal = controller.signal;
    setTimeout(() => controller!.abort(), opts.timeoutMs);
  }
  const arPrimary = await batchGenerateAI(108, 'AR', model, curriculum, globalExclusion, { signal, deadlineMs: opts.timeoutMs, fastMode: !!opts.fastMode, persist: false });
  const arMixed = await batchGenerateAI(12, 'MIXED', model, curriculum, globalExclusion, { signal, deadlineMs: opts.timeoutMs, fastMode: !!opts.fastMode, persist: false });
  const arQuestions = [...arPrimary, ...arMixed];
  while (arQuestions.length < 120) {
  const types = ["rate_distance","work_combined","percent_basic","ratio_proportion","average_mean","simple_interest","reading_table","percent_multistep","divide_simple","mixture","probability_basic"];
    const t = types[arQuestions.length % types.length];
    const difficulty = 'medium';
    arQuestions.push(generateARQuestion(t, difficulty as any));
  }
  const mkPrimary = await batchGenerateAI(108, 'MK', model, curriculum, globalExclusion, { signal, deadlineMs: opts.timeoutMs, fastMode: !!opts.fastMode, persist: false });
  const mkMixed = await batchGenerateAI(12, 'MIXED', model, curriculum, globalExclusion, { signal, deadlineMs: opts.timeoutMs, fastMode: !!opts.fastMode, persist: false });
  let mkQuestions = [...mkPrimary, ...mkMixed];

  // In fast mode we're skipping heavy dedup and returning quickly. When fastMode is false, do heavier dedupe.
  if (opts.fastMode) {
    const arQuestions = [...arPrimary, ...arMixed];
    const mkQuestions = [...mkPrimary, ...mkMixed];
    try { purgeSessionCache({ keepUniqueCount: 1000 }); } catch (e) {}
    return { arQuestions, mkQuestions };
  }

  // Ensure uniqueness strictly across AR and MK by deduping and regenerating replacements
  async function dedupeAndRefill(targetCount: number, arr: Question[], subject: 'AR'|'MK', opts2: { signal?: AbortSignal; deadlineMs?: number } = {}) {
    let attempts = 0;
  const maxAttempts = 12;
  let uniqueSet = new Set<string>();
    let uniqueArr: Question[] = [];
    // Build initial unique set by structural signature + tokenFingerprint
      for (const q of arr) {
        await maybeYield(0);
      const sig = (q as any).structuralSignature || normalizeText(q.text || '');
  const key = sig;
  const finger = (q as any).tokenFingerprint || normalizeText(q.text || '').substring(0, 40);
  const textNorm = normalizeText(q.text || '');
  // Skip if signature exists in canonical store for exact text or fingerprint matches (but allow structural reuse)
  if (canonicalStore && canonicalStore.hasSignature && (canonicalStore.hasSignature(finger, 'fingerprint') || canonicalStore.hasSignature(textNorm, 'text'))) continue;
        if (!uniqueSet.has(key)) {
        uniqueSet.add(key);
        uniqueArr.push(q);
      }
    }
      while (uniqueArr.length < targetCount && attempts < maxAttempts) {
        await maybeYield(attempts);
      if (opts2.signal && (opts2.signal as any).aborted) break;
      if (opts2.deadlineMs && Date.now() - (opts2 as any)._startTime > opts2.deadlineMs) break;
      const toGet = targetCount - uniqueArr.length;
      attempts += 1;
      // Add current signatures to globalExclusion to avoid repeats
  for (const q of uniqueArr) {
    const sig = (q as any).structuralSignature || normalizeText(q.text || '');
  const finger = (q as any).tokenFingerprint || normalizeText(q.text || '').substring(0, 40);
  const textNorm = normalizeText(q.text || '');
  globalExclusion.push(textNorm);
  globalExclusion.push(finger);
      }
  const replacements = await batchGenerateAI(toGet, subject, model, curriculum, globalExclusion, { signal: opts2.signal, deadlineMs: opts2.deadlineMs, persist: false });
      for (const r of replacements) {
        await maybeYield(0);
        const sig = (r as any).structuralSignature || normalizeText(r.text || '');
  const fingerR = (r as any).tokenFingerprint || normalizeText(r.text || '').substring(0, 40);
  const key = sig; const textNormR = normalizeText(r.text || '');
        // compute embedding for candidate and reject if canonical store has a similar embedding
        try { (r as any).embedding = (r as any).embedding || await (await import('@/ai/duplicates')).computeEmbedding(r.text || '', { endpoint: process.env.NEXT_PUBLIC_AI_ENDPOINT || (process.env.AI_ENDPOINT as any) }); } catch (e) { (r as any).embedding = null; }
        if (canonicalStore && canonicalStore.hasSignature && (canonicalStore.hasSignature(fingerR, 'fingerprint') || canonicalStore.hasSignature(textNormR, 'text'))) continue;
        if (canonicalStore && canonicalStore.hasSimilarEmbedding && (r as any).embedding && canonicalStore.hasSimilarEmbedding((r as any).embedding, 0.92)) continue;
        if (!uniqueSet.has(key)) {
          uniqueSet.add(key);
          uniqueArr.push(r);
        }
      }
    }
    // If still not enough, fill with deterministic unique fallbacks
  const fallbackTypes = subject === 'AR' ? ["rate_distance","work_combined","percent_basic","ratio_proportion","average_mean","simple_interest","reading_table","percent_multistep","divide_simple","mixture","probability_basic","mode_of_set","next_in_sequence"] : ["algebra_linear","fraction_addsub","fraction_mult","fraction_divide","pythagorean","area_circle","volume_rect_prism","perimeter","decimal_ops","exponents_rules","algebra_two_step","algebra_distributive","percentage_change","unit_conversion","systems_two_eqs","polynomial_factor","compound_interest","median_mode"];
    let idx = 0;
    while (uniqueArr.length < targetCount && idx < 100) {
      const t = fallbackTypes[uniqueArr.length % fallbackTypes.length];
      const alt = subject === 'AR' ? generateARQuestion(t, 'medium') : generateMKQuestion(t, 'medium');
      const sig = (alt as any).structuralSignature || structuralSignature(alt.text || '');
      const finger = (alt as any).tokenFingerprint || tokenFingerprint(alt.text || '');
  const key = sig;
      if (!uniqueSet.has(key)) { uniqueSet.add(key); uniqueArr.push(alt); }
      idx += 1;
    }
    return uniqueArr.slice(0, targetCount);
  }
  // Apply dedupe and refill to AR then MK
  const finalAr = await dedupeAndRefill(120, arQuestions, 'AR', { signal, deadlineMs: opts.timeoutMs });
  // Add AR signatures to exclusion before MK generation so MK is different
  for (const q of finalAr) {
    const tn = normalizeText(q.text || '');
    if (tn) globalExclusion.push(tn);
    if ((q as any).tokenFingerprint) globalExclusion.push((q as any).tokenFingerprint);
  }
  const finalMk = await dedupeAndRefill(120, mkQuestions, 'MK', { signal, deadlineMs: opts.timeoutMs });

  // Cross-dedupe: ensure MK is not similar to any AR questions. Regenerate replacements until unique.
  // (only in heavy mode — fastMode=false). Already handled above by returning early.
  const arSigs = new Set(finalAr.map(q => (q as any).structuralSignature || structuralSignature(q.text || '')));
  const arFps = new Set(finalAr.map(q => (q as any).tokenFingerprint || tokenFingerprint(q.text || '')));
  // Exclude AR questions' normalized text and fingerprints from MK generation attempts
  globalExclusion.push(...finalAr.map(q => normalizeText(q.text || '')));
  globalExclusion.push(...Array.from(arFps));
  let mkUnique = finalMk.slice();
  let crossAttempts = 0;
    while (crossAttempts < 18) {
      if (opts.timeoutMs && Date.now() - (opts as any)._startTime > opts.timeoutMs) break;
      if (signal && (signal as any).aborted) break;
    const duplicatesIdx: number[] = [];
    for (let i = 0; i < mkUnique.length; i++) {
      await maybeYield(i);
      const mq = mkUnique[i];
      const sig = (mq as any).structuralSignature || structuralSignature(mq.text || '');
      const fp = (mq as any).tokenFingerprint || tokenFingerprint(mq.text || '');
      if (arSigs.has(sig) || arFps.has(fp) || finalAr.some(aq => isDuplicate([{ problem: aq.text, structuralSignature: (aq as any).structuralSignature, tokenFingerprint: (aq as any).tokenFingerprint, embedding: (aq as any).embedding }], { problem: mq.text, structuralSignature: sig, tokenFingerprint: fp, embedding: (mq as any).embedding }, 0.75))) {
        duplicatesIdx.push(i);
      }
    }
    if (!duplicatesIdx.length) break;
    crossAttempts++;
  const replacements = await batchGenerateAI(duplicatesIdx.length, 'MK', model, { targetRatio: 0.5, reinforceRatio: 0.3, mixedRatio: 0.2 }, globalExclusion, { signal, deadlineMs: opts.timeoutMs, persist: false });
    // replace duplicates with unique replacements
    const newUnique: Question[] = [];
    let replIx = 0;
    for (let i = 0; i < mkUnique.length; i++) {
      if (duplicatesIdx.includes(i)) {
        // attempt to find a replacement that is unique vs AR and current MK
        let repFound: Question | null = null;
        while (replIx < replacements.length && !repFound) {
          const candidate = replacements[replIx++];
          const sig = (candidate as any).structuralSignature || structuralSignature(candidate.text || '');
          const fp = (candidate as any).tokenFingerprint || tokenFingerprint(candidate.text || '');
          if (!arSigs.has(sig) && !arFps.has(fp) && !newUnique.some(u => isDuplicate([{ problem: u.text, structuralSignature: (u as any).structuralSignature, tokenFingerprint: (u as any).tokenFingerprint, embedding: (u as any).embedding }], { problem: candidate.text, structuralSignature: sig, tokenFingerprint: fp, embedding: (candidate as any).embedding }, 0.75))) {
            repFound = candidate;
          }
        }
        if (repFound) newUnique.push(repFound); else {
          // fallback deterministic unique gen
          const types = ["algebra_linear","fraction_addsub","pythagorean","area_circle","decimal_ops","exponents_rules","algebra_two_step"];
          let alt: Question | null = null;
          for (const t of types) {
            const candidate = generateMKQuestion(t, 'medium');
            const sig = structuralSignature(candidate.text || '');
            const fp = tokenFingerprint(candidate.text || '');
            if (!arSigs.has(sig) && !arFps.has(fp) && !newUnique.some(u => (u as any).structuralSignature === sig)) { alt = candidate; break; }
          }
          if (alt) newUnique.push(alt); else newUnique.push(mkUnique[i]);
        }
      } else newUnique.push(mkUnique[i]);
    }
    mkUnique = newUnique;
  }
  // final padding if necessary
  const mkFinal: Question[] = mkUnique.slice(0,120);
  while (mkFinal.length < 120) {
    const types = ["algebra_linear","fraction_addsub","pythagorean","area_circle","decimal_ops","exponents_rules","algebra_two_step"];
    const t = types[mkFinal.length % types.length];
    const difficulty = 'medium';
    const g = generateMKQuestion(t, difficulty as any);
    const sig = structuralSignature(g.text || '');
    const fp = tokenFingerprint(g.text || '');
    if (!arSigs.has(sig) && !arFps.has(fp) && !mkFinal.some(m => (m as any).structuralSignature === sig)) mkFinal.push(g);
  }
  // Final cross-unique pass: ensure no structural signature duplicates across AR/MK combined
  const combinedSigs = new Set<string>();
  const finalA = finalAr.slice(0, 120);
  const finalM: Question[] = [];
  for (const q of finalA) combinedSigs.add((q as any).structuralSignature || structuralSignature(q.text || ''));
  for (let i = 0; i < mkFinal.length; i++) {
    const mq = mkFinal[i];
    const sig = (mq as any).structuralSignature || structuralSignature(mq.text || '');
    if (!combinedSigs.has(sig)) { combinedSigs.add(sig); finalM.push(mq); } else {
      // try to replace with a unique mk
  const replacements = await batchGenerateAI(1, 'MK', model, curriculum, globalExclusion, { signal, deadlineMs: opts.timeoutMs, persist: false });
      let rep = replacements[0] || null;
      let repSig = rep ? ((rep as any).structuralSignature || structuralSignature(rep.text || '')) : '';
      let tries = 0;
      while (rep && combinedSigs.has(repSig) && tries < 6) {
  const more = await batchGenerateAI(1, 'MK', model, curriculum, globalExclusion, { signal, deadlineMs: opts.timeoutMs, persist: false });
        rep = more[0] || null;
        repSig = rep ? ((rep as any).structuralSignature || structuralSignature(rep.text || '')) : '';
        tries++;
      }
      if (rep && !combinedSigs.has(repSig)) { combinedSigs.add(repSig); finalM.push(rep); } else {
        // fallback deterministic unique generator
        const types = ["algebra_linear","fraction_addsub","pythagorean","area_circle","decimal_ops","exponents_rules","algebra_two_step"];
        let added = false;
        for (const t of types) {
          const alt = generateMKQuestion(t, 'medium' as any);
          const altSig = structuralSignature(alt.text || '');
          if (!combinedSigs.has(altSig)) { combinedSigs.add(altSig); finalM.push(alt); added = true; break; }
        }
        if (!added) finalM.push(mq);
      }
    }
  }
  const finalMk2 = finalM.slice(0, 120);
  try { purgeSessionCache({ keepUniqueCount: 1000 }); } catch (e) {}
  // Persist any computed embeddings for AR/MK into canonical store to avoid repeats in future runs
  try {
    const embeddings: number[][] = [];
    for (const q of finalAr.concat(finalMk2)) { if ((q as any).embedding && Array.isArray((q as any).embedding)) embeddings.push((q as any).embedding); }
    if (embeddings.length && canonicalStore && canonicalStore.addEmbeddings) canonicalStore.addEmbeddings(embeddings);
  } catch (e) {}
  return { arQuestions: finalAr, mkQuestions: finalMk2 };
}

// Background refine function: try to improve uniqueness for an already-loaded full test.
export async function backgroundRefineFullTest(arQuestions: Question[], mkQuestions: Question[], model: any = null, opts: { timeoutMs?: number; signal?: AbortSignal; heavy?: boolean } = {}): Promise<{ arQuestions: Question[]; mkQuestions: Question[] }> {
  // Lightweight refinement: quick deterministic replacements to remove structural duplicates,
  // without calling heavy AI endpoints. Runs cooperatively and returns quickly.
  try {
  const canonicalStore = await getCanonicalStore();
  const maxAttemptsPerReplacement = 12;
    const start = Date.now();
    const deadline = opts.timeoutMs ? (start + opts.timeoutMs) : (start + 30000);
  const combined = [...arQuestions, ...mkQuestions];
  const maxReplacements = Math.max(48, combined.length); // allow more replacements during heavy refine
    const sigCounts = new Map<string, number>();
    for (const q of combined) {
      const sig = (q as any).structuralSignature || structuralSignature(q.text || '');
      sigCounts.set(sig, (sigCounts.get(sig) || 0) + 1);
    }

    const needsFix = new Set<string>();
  for (const [sig, cnt] of sigCounts.entries()) if ((cnt || 0) > 1) needsFix.add(sig);
    // Debugging info
    try { console.log(`backgroundRefineFullTest: found ${Array.from(needsFix).length} duplicate signatures to fix (heavy=${!!opts.heavy})`); } catch(e) {}
    if (!needsFix.size) return { arQuestions, mkQuestions };

  // Fix duplicates by replacing later occurrences (prefer deterministic fallback or AI-generated replacements)
    let replacements = 0;
    const fixQueue: Array<{ idx: number; subject: 'AR' | 'MK' }> = [];
    // Build queue by preserving the first occurrence and marking all subsequent duplicates for replacement
    const seenSig = new Set<string>();
    combined.forEach((q, i) => {
      const sig = (q as any).structuralSignature || structuralSignature(q.text || '');
      if (seenSig.has(sig)) {
        // this is a duplicate occurrence beyond the first one — add for replacement
        fixQueue.push({ idx: i, subject: i < arQuestions.length ? 'AR' : 'MK' });
      } else {
        seenSig.add(sig);
      }
    });

    // Helper to generate a unique deterministic candidate
    function genUniqueDeterministic(subject: 'AR' | 'MK', existingSigs: Set<string>) {
      const types = subject === 'AR'
  ? ["rate_distance","work_combined","percent_basic","ratio_proportion","average_mean","simple_interest","reading_table","percent_multistep","divide_simple","mixture","probability_basic","mode_of_set","next_in_sequence"]
        : ["algebra_linear","fraction_addsub","pythagorean","area_circle","decimal_ops","exponents_rules","algebra_two_step"];
      for (let attempt = 0; attempt < maxAttemptsPerReplacement; attempt++) {
        const t = types[Math.floor(Math.random() * types.length)];
  const candidate = subject === 'AR' ? generateARQuestion(t, 'medium') : generateMKQuestion(t, 'medium');
  const csig = (candidate as any).structuralSignature || structuralSignature(candidate.text || '');
  const cfp = (candidate as any).tokenFingerprint || tokenFingerprint(candidate.text || '');
  const ctext = normalizeText(candidate.text || '');
  if (canonicalStore && canonicalStore.hasSignature && (canonicalStore.hasSignature(cfp, 'fingerprint') || canonicalStore.hasSignature(ctext, 'text'))) continue;
  if (!existingSigs.has(csig)) return candidate;
      }
      return null;
    }

    const existingSigs = new Set<string>(combined.map(q => (q as any).structuralSignature || structuralSignature(q.text || '')));
    // If heavy option requested, compute embeddings for stronger semantic dedupe and prefer AI re-generation
  const acceptedEmbeddings: number[][] = [];
  if (opts.heavy) {
      // compute embeddings for all combined questions in parallel (but keep it cooperative)
      for (let i = 0; i < combined.length; i++) {
        const q = combined[i] as any;
        if (!q.embedding) {
          try { q.embedding = await (await import('@/ai/duplicates')).computeEmbedding(q.text || '', { endpoint: process.env.NEXT_PUBLIC_AI_ENDPOINT || (process.env.AI_ENDPOINT as any) }); } catch (e) { q.embedding = null; }
        }
        await maybeYield(i);
        if (opts.signal && (opts.signal as any).aborted) break;
      }
    }
  // Iterate the queue and attempt replacements
  try { console.log('backgroundRefineFullTest: fixQueue len:', fixQueue.length); } catch(e) {}
  while (fixQueue.length && replacements < maxReplacements && Date.now() < deadline) {
      const entry = fixQueue.shift(); if (!entry) break;
      const idx = entry.idx;
      const subject = entry.subject;
    // MK-specific tuning: larger candidate sample, more attempts, and more lenient duplicate/embedding thresholds
    const isMK = subject === 'MK';
    const sampleCount = isMK ? 12 : 6;
    const maxAttemptsForSubject = isMK ? 12 : 8;
    const canonicalEmbeddingThreshold = isMK ? 0.95 : 0.92;
    const duplicateThresholdForSubject = isMK ? 0.72 : 0.78;
      // Try find a unique replacement. Prefer AI-generated heavy replacements when heavy flag is set.
  let cand: any = null;
  if (opts.heavy) {
        try {
          let attempts = 0;
            while (attempts < maxAttemptsForSubject && !cand) {
            const repSet = await batchGenerateAI(sampleCount, subject, model, { targetRatio: 0.5, reinforceRatio: 0.3, mixedRatio: 0.2 }, Array.from(existingSigs), { signal: opts.signal, deadlineMs: opts.timeoutMs, fastMode: false, persist: false });
            if (!repSet || !repSet.length) { attempts++; break; }
            // select the candidate from repSet with lowest max similarity to existing embeddings
            if (!repSet || !repSet.length) { attempts++; continue; }
            let candidate2: any = repSet[0] || null;
            try {
              // compute embeddings for all candidates
              for (let ii=0; ii < repSet.length; ii++) {
                const c = repSet[ii] as any;
                try { c.embedding = c.embedding || await (await import('@/ai/duplicates')).computeEmbedding(c.text || '', { endpoint: process.env.NEXT_PUBLIC_AI_ENDPOINT || (process.env.AI_ENDPOINT as any) }); } catch (e) { c.embedding = null; }
              }
              // precompute existing embeddings and formula frequency counts
              const existingEmbeddings = [...combined].map(x => (x as any).embedding).filter(Boolean);
              const formulaCounts = new Map<string, number>();
              for (const ex of combined) {
                const fid = (ex as any).formulaId as string || '';
                formulaCounts.set(fid, (formulaCounts.get(fid) || 0) + 1);
              }
                if (existingEmbeddings.length && repSet.length) {
                const { cosineSimilarity } = await import('@/ai/duplicates');
                let best: any = null; let bestScore = Infinity;
                for (const c0 of repSet) {
                  const c = c0 as any;
                  if (!c || !c.embedding) continue;
                  let maxSim = 0;
                  for (const e of existingEmbeddings) {
                    const cs = cosineSimilarity(e, c.embedding);
                    if (cs > maxSim) maxSim = cs;
                  }
                  // prefer candidates that are semantically distinct (low maxSim) and also from less frequent formulaIds
                  const fid = (c as any).formulaId || '';
                  const fc = formulaCounts.get(fid) || 0;
                  const score = maxSim + (fc * 0.02);
                  if (score < bestScore) { bestScore = score; best = c; }
                }
                if (best) candidate2 = best;
              }
            } catch (e) { /* ignore selection errors */ }
            try { console.log('backgroundRefineFullTest: candidate2 sig', (candidate2 as any).structuralSignature || structuralSignature(candidate2.text || '')); } catch(e) {}
            const csig2 = (candidate2 as any).structuralSignature || structuralSignature((candidate2 as any).text || '');
            const cfp2 = (candidate2 as any).tokenFingerprint || tokenFingerprint((candidate2 as any).text || '');
            const ctext2 = normalizeText((candidate2 as any).text || '');
            // If the candidate exact text appears in the canonical store, reject outright.
            // However fingerprint collisions (common numeric substitutions) should only be rejected
            // if the embedding indicates the semantic is also extremely similar; this gives MK a chance
            // to reword the same fingerprint into a different scenario.
            if (canonicalStore && canonicalStore.hasSignature) {
              const hasFp = canonicalStore.hasSignature(cfp2, 'fingerprint');
              const hasText = canonicalStore.hasSignature(ctext2, 'text');
              if (hasText) { try { console.log('backgroundRefineFullTest: candidate2 rejected canonical store by exact text', cfp2, ctext2); } catch(e) {} attempts++; continue; }
              if (hasFp) {
                // only reject if embedding is too similar to canonical embeddings (already stored)
                if ((candidate2 as any).embedding && canonicalStore.hasSimilarEmbedding && canonicalStore.hasSimilarEmbedding((candidate2 as any).embedding, canonicalEmbeddingThreshold)) { try { console.log('backgroundRefineFullTest: candidate2 rejected canonical store by fingerprint+embedding', cfp2, ctext2); } catch (e) {} attempts++; continue; }
              }
            }
            // compute embedding for candidate2 if needed
                try { (candidate2 as any).embedding = (candidate2 as any).embedding || await (await import('@/ai/duplicates')).computeEmbedding((candidate2 as any).text || '', { endpoint: process.env.NEXT_PUBLIC_AI_ENDPOINT || (process.env.AI_ENDPOINT as any) }); } catch (e) { (candidate2 as any).embedding = null; }
                // if a canonical embedding exists that's too similar, reject candidate
                if ((candidate2 as any).embedding && canonicalStore && canonicalStore.hasSimilarEmbedding && canonicalStore.hasSimilarEmbedding((candidate2 as any).embedding, canonicalEmbeddingThreshold)) {
                  try { console.log('backgroundRefineFullTest: candidate2 rejected by canonical embedding similarity'); } catch (e) {}
                  attempts++; continue;
                }
            const isDup = (opts.signal && (opts.signal as any).aborted) ? true : isDuplicate([...combined].map(x => ({ problem: x.text, structuralSignature: (x as any).structuralSignature, tokenFingerprint: (x as any).tokenFingerprint, embedding: (x as any).embedding })), { problem: candidate2.text, structuralSignature: csig2, tokenFingerprint: (candidate2 as any).tokenFingerprint, embedding: (candidate2 as any).embedding }, duplicateThresholdForSubject);
            if (!isDup) { try { console.log('backgroundRefineFullTest: candidate2 accepted for replacement', csig2); } catch(e) {} cand = candidate2; }
            attempts++;
            // If repeated attempts keep failing and the generator keeps giving same structural templates, try a forced paraphrase 
            if (!cand && attempts >= (isMK ? 2 : 5)) {
              try {
                // map difficulty on the original question to numeric
                const orig = combined[idx] as any;
                const diffNum = (orig && orig.difficulty === 'hard') ? 3 : ((orig && orig.difficulty === 'medium') ? 2 : 1);
                const par = await generateQuestionObject(subject, diffNum, 12, true, undefined, [normalizeText(orig.text || '')].concat(Array.from(existingSigs || [])), { signal: opts.signal, fastMode: false, forceParaphrase: true, persist: false });
                if (par) {
                  const pcsig = (par as any).structuralSignature || structuralSignature(par.text || '');
                  const pcfp = (par as any).tokenFingerprint || tokenFingerprint(par.text || '');
                  const ptext = normalizeText(par.text || '');
                  try { (par as any).embedding = (par as any).embedding || await (await import('@/ai/duplicates')).computeEmbedding(par.text || '', { endpoint: process.env.NEXT_PUBLIC_AI_ENDPOINT || (process.env.AI_ENDPOINT as any) }); } catch (e) { (par as any).embedding = null; }
                  if (canonicalStore && canonicalStore.hasSignature && (canonicalStore.hasSignature(pcfp, 'fingerprint') || canonicalStore.hasSignature(ptext, 'text'))) {
                    // skip
                  } else if (canonicalStore && canonicalStore.hasSimilarEmbedding && (par as any).embedding && canonicalStore.hasSimilarEmbedding((par as any).embedding, 0.92)) {
                    // skip
                  } else {
                    const isDupPar = isDuplicate([...combined].map(x => ({ problem: x.text, structuralSignature: (x as any).structuralSignature, tokenFingerprint: (x as any).tokenFingerprint, embedding: (x as any).embedding })), { problem: par.text, structuralSignature: pcsig, tokenFingerprint: pcfp, embedding: (par as any).embedding }, 0.78);
                    if (!isDupPar) {
                      cand = par;
                      try { console.log('backgroundRefineFullTest: paraphrased candidate accepted', pcsig); } catch (e) {}
                    }
                  }
                }
              } catch (e) {
                // ignore paraphrase errors
              }
            }
          }
        } catch (e) {
          cand = null;
        }
      }
      if (!cand) {
        cand = genUniqueDeterministic(subject, existingSigs);
        if (cand) { try { console.log('backgroundRefineFullTest: deterministic candidate', (cand as any).structuralSignature || structuralSignature(cand.text || '')); } catch(e) {} }
      }
        if (cand) {
        existingSigs.delete((combined[idx] as any).structuralSignature || structuralSignature((combined[idx] as any).text || ''));
        combined[idx] = cand as any;
        existingSigs.add((cand as any).structuralSignature);
        // if candidate has embedding, add to acceptedEmbeddings to persist later
        if ((cand as any).embedding && Array.isArray((cand as any).embedding)) acceptedEmbeddings.push((cand as any).embedding);
        replacements++;
      }
    }
    // Split back into ar/mk arrays
    const ar = combined.slice(0, arQuestions.length).map(q => q as Question);
    const mk = combined.slice(arQuestions.length).map(q => q as Question);
  // Persist created signatures to canonical store to avoid future repeats across tests
    try {
  try { console.log(`backgroundRefineFullTest: replacementsMade=${replacements}`); } catch (e) {}
  const add = [...ar.map(q => (q as any).structuralSignature || structuralSignature(q.text || '')), ...mk.map(q => (q as any).structuralSignature || structuralSignature(q.text || ''))];
  canonicalStore.addSignatures(add);
  // persist embeddings for this run - only if we have some to add
  if (acceptedEmbeddings.length) canonicalStore.addEmbeddings(acceptedEmbeddings);
    } catch (e) {}
    return { arQuestions: ar, mkQuestions: mk };
  } catch (e) {
    return { arQuestions, mkQuestions };
  }
}