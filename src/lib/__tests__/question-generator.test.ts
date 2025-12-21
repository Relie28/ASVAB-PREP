import { describe, it, expect } from 'vitest';
import { ensureChoicesIncludeAnswer } from '../question-generator';

describe('question-generator.ensureChoicesIncludeAnswer', () => {
  it('adds missing answer to choices and pads to 4 entries', () => {
    const q: any = { id: 1, subject: 'GS', type: 'gs', text: 'What organ pumps blood?', formulaId: 'g1', keywords: [], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Heart', choices: [], category: 'GS' };
    const out = ensureChoicesIncludeAnswer(q);
    expect(out.choices.length).toBeGreaterThanOrEqual(4);
    expect(out.choices.some((c: any) => String(c) === 'Heart')).toBe(true);
    // Ensure no generic 'Other' placeholders remain
    expect(out.choices.some((c: any) => typeof c === 'string' && /^Other/i.test(c))).toBe(false);
    // Ensure distractors are related (e.g., include other organs) when the question is organ-related
    const organs = ['Lungs','Brain','Kidney','Liver','Eye','Ear','Stomach','Skin'];
    if (String(q.text).toLowerCase().includes('organ')) {
      expect(out.choices.some((c: any) => organs.includes(String(c)))).toBe(true);
    }
  });

  it('keeps numeric answers and padding consistent', () => {
    const q: any = { id: 2, subject: 'AR', type: 'rate_distance', text: 'Q2', formulaId: 'r1', keywords: [], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 42, choices: [40], category: 'AR' };
    const out = ensureChoicesIncludeAnswer(q);
    expect(out.choices.some((c: any) => Number(c) === 42)).toBe(true);
    expect(out.choices.length).toBeGreaterThanOrEqual(4);
  });
  
  it('avoids placing answer at the avoidIndex when provided', () => {
    const q: any = { id: 2, subject: 'WK', type: 'wk_syn', text: 'Happy', formulaId: 'f', keywords: [], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Joyful', choices: ['Joyful','Angry','Large','Cold'] };
    // Try avoiding index 0 multiple times; result index should not be 0
    let saw0 = false;
    for (let i = 0; i < 10; i++) {
      const out = ensureChoicesIncludeAnswer(q, 0);
      const idx = out.choices.findIndex((c: any) => String(c) === String(out.answer));
      if (idx === 0) saw0 = true;
    }
    expect(saw0).toBe(false);
  });
});
