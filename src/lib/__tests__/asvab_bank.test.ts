import { describe, it, expect } from 'vitest';
import asvabBank from '../asvab_bank';

describe('asvab bank integrity', () => {
  const banks = ['WK','PC','GS','MK','AR'] as const;

  it('all questions have 4 non-empty choices and include the answer', () => {
    for (const b of banks) {
      const arr = (asvabBank as any)[b];
      expect(Array.isArray(arr)).toBe(true);
      for (const q of arr) {
        expect(Array.isArray(q.choices)).toBe(true);
        expect(q.choices.length).toBeGreaterThanOrEqual(4);
        for (const c of q.choices.slice(0,4)) {
          expect(String(c).trim().length).toBeGreaterThan(0);
          // reject generic placeholders like 'Other', 'Other1', or 'Other*'
          expect(String(c)).not.toMatch(/^\s*Other\d*\*?\s*$/i);
        }
        // ensure answer is included among choices (best-effort: string compare)
        const answers = q.choices.map((x: any) => String(x).trim());
        expect(answers).toContain(String(q.answer).trim());
      }
    }
  });

  it('AR questions are coherent and human-readable', () => {
    const ar = (asvabBank as any).AR as any[];
    expect(Array.isArray(ar)).toBe(true);
    for (const q of ar) {
      const text = String(q.text || '');
      // should be reasonably long
      expect(text.trim().length).toBeGreaterThan(10);
      // avoid inline tabular colon lists like "John: 5, 8, 8"
      expect(text).not.toMatch(/\b[A-Za-z]+:\s*\d+(?:\s*,\s*\d+)+/);
      // require that the prompt reads like a question or an equation to solve
      // allow common imperative forms used in math prompts (Solve, Convert, Compute, Calculate, Evaluate, What is, How many, How much, Find)
      expect(/\?|\b(Solve|Convert|Compute|Calculate|Evaluate|What is|How many|How much|Find)\b/i.test(text)).toBe(true);
    }
  });

  it('sanitizeARText converts inline colon tables into readable sentences', () => {
    const bad = `The table below shows items sold by different people.\nJohn: 8, 9, 7\nAmy: 2, 4, 1\nSam: 5, 7, 7\n\nHow many items did Amy sell in total?`;
    // import the function dynamically from the bank module
    const { sanitizeARText } = require('../asvab_bank');
    const fixed = sanitizeARText(bad);
    expect(fixed).not.toMatch(/\b[A-Za-z]+:\s*\d+(?:\s*,\s*\d+)+/);
    // should still contain the question
    expect(/How many items did Amy sell in total\?/i.test(fixed) || /How many/i.test(fixed)).toBe(true);
    // and now include a readable phrase about Amy
    expect(/Amy sold\s+2(?:,\s*4)?(?:,\s*and\s*1)?|Amy sold\s+2,\s*4,\s*and\s*1/i.test(fixed)).toBe(true);
  });
});
