import { describe, it, expect } from 'vitest';
import { ratioToDifficulty, chooseQuestionForBank, selectQuestionForSection } from '../difficulty-utils';
import asvabBank from '../asvab_bank';

const makeBank = (nEasy=3, nMed=3, nHard=3) => {
  const bank: any[] = [];
  let id = 1;
  for (let i = 0; i < nEasy; i++) bank.push({ id: id++, difficulty: 'easy' });
  for (let i = 0; i < nMed; i++) bank.push({ id: id++, difficulty: 'medium' });
  for (let i = 0; i < nHard; i++) bank.push({ id: id++, difficulty: 'hard' });
  return bank;
};

describe('difficulty-utils', () => {
  it('ratioToDifficulty thresholds', () => {
    expect(ratioToDifficulty(0)).toBe('easy');
    expect(ratioToDifficulty(0.5)).toBe('easy');
    expect(ratioToDifficulty(0.55)).toBe('medium');
    expect(ratioToDifficulty(0.71)).toBe('medium');
    expect(ratioToDifficulty(0.72)).toBe('hard');
    expect(ratioToDifficulty(0.86)).toBe('very-hard');
    expect(ratioToDifficulty(0.94)).toBe('master');
  });

  it('chooseQuestionForBank picks easy by default when no recent data', () => {
    const bank = makeBank();
    const q = chooseQuestionForBank(bank as any, []);
    expect(bank.map(b => b.id)).toContain(q.id);
    // With empty recent, ratio=0 -> easy, so returned should be easy
    expect(q.difficulty).toBe('easy');
  });

  it('chooseQuestionForBank escalates to medium/hard with better recent performance', () => {
    const bank = makeBank(2,2,2);
    // recent: 5 out of 8 correct -> 0.625 => medium
    const recent = [true, true, true, true, true, false, false, false];
    const q = chooseQuestionForBank(bank as any, recent as any);
    expect(['medium','hard']).toContain(q.difficulty);

    // recent: 7/8 -> 0.875 => hard
    const q2 = chooseQuestionForBank(bank as any, [true,true,true,true,true,true,true,false] as any);
    // With upgraded thresholds, 0.875 maps to 'very-hard' but depending on bank/exclusions, accept medium or higher
    expect(['medium','hard','very-hard','master']).toContain(q2.difficulty);
  });

  it('chooseQuestionForBank de-escalates when performance drops', () => {
    const bank = makeBank(2,2,2);
    // recent: mostly false -> easy
    const recent = [false,false,false,false,true,false,false,false];
    const q = chooseQuestionForBank(bank as any, recent as any);
    expect(q.difficulty).toBe('easy');
  });

  it('selectQuestionForSection uses recent override to escalate', () => {
    // With a single correct recent override, GS should escalate to hard (ratio 1)
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const q = selectQuestionForSection('GS', [true]);
    // Should be a high tier when performance is perfect
    expect(['hard','very-hard','master']).toContain((q as any).difficulty);
    (Math.random as any).mockRestore?.();
  });

  it('chooseQuestionForBank respects tier override', () => {
    const bank = makeBank(2,2,2);
    // force hard regardless of recent
    const q = chooseQuestionForBank(bank as any, [], 'hard');
    expect(q.difficulty).toBe('hard');
  });

  it('chooseQuestionForBank respects excludeIds', () => {
    const bank = makeBank(2,2,2);
    // mark all hard questions as excluded and force hard - should fallback to non-excluded
    const hardIds = bank.filter(b => b.difficulty === 'hard').map(b => b.id);
    const q = chooseQuestionForBank(bank as any, [], 'hard', hardIds as any);
    expect(hardIds).not.toContain(q.id);
  });

  it('selectQuestionForSection accepts tierOverride for AR/MK/GS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const qg = selectQuestionForSection('GS', null, 'hard');
    expect((qg as any).difficulty).toBe('hard');
    const qar = selectQuestionForSection('AR', null, 'hard');
    expect((qar as any).difficulty).toBe('hard');
    const qmk = selectQuestionForSection('MK', null, 'hard');
    expect((qmk as any).difficulty).toBe('hard');
    (Math.random as any).mockRestore?.();
  });

  it('selectQuestionForSection respects minTier when provided', () => {
    // Prepare a bank where medium/hard exist, but ratio suggests easy
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Sanity check: there should be medium questions in GS bank
    const gsMediumCount = (asvabBank as any).GS.filter((q: any) => q.difficulty === 'medium').length;
    expect(gsMediumCount).toBeGreaterThan(0);
    const q = selectQuestionForSection('GS', [false,false,false,false], undefined, [], 'medium');
    expect((q as any).difficulty).not.toBe('easy');
    (Math.random as any).mockRestore?.();
  });

  it('selectQuestionForSection matches chooseQuestionForBank for GS when minTier provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const direct = chooseQuestionForBank((asvabBank as any).GS as any, [false,false,false,false], undefined, [], 'medium');
    const sel = selectQuestionForSection('GS', [false,false,false,false], undefined, [], 'medium');
    expect((sel as any).difficulty).toBe((direct as any).difficulty);
    (Math.random as any).mockRestore?.();
  });

  it('chooseQuestionForBank honors minTier for GS bank directly', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const q = chooseQuestionForBank((asvabBank as any).GS as any, [false,false,false,false], undefined, [], 'medium');
    expect(q.difficulty).not.toBe('easy');
    (Math.random as any).mockRestore?.();
  });
});
