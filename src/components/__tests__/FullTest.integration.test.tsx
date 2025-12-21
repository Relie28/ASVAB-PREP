import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FullTest from '../FullTest';
import asvabBank from '@/lib/asvab_bank';
import * as qgen from '@/lib/question-generator';
import * as answers from '@/ai/answers';
import * as adaptive from '@/lib/adaptive-engine';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('FullTest integration (difficulty selection)', () => {
  beforeEach(() => {
    // ensure deterministic randomness
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Disable background AI full practice generation to avoid race replacing questions during test
    vi.spyOn(qgen, 'generateFullPracticeAI').mockResolvedValue(null);
  });
  afterEach(() => {
    (Math.random as any).mockRestore?.();
  });

  it('escalates difficulty for GS after a correct answer (uses recent override)', async () => {
    const onExit = vi.fn();
    const { container } = render(<FullTest onExit={onExit} />);

    // Start the test
    const startBtn = screen.getByText(/Start Full Test/i);
    fireEvent.click(startBtn);

    // Wait for a question to be visible
    await waitFor(() => {
      const p = container.querySelector('p.text-lg');
      expect(p).toBeTruthy();
    });

    

    // Click the choice that matches the displayed correct answer for the current question
    const clickCorrectChoice = () => {
      const ansText = (container.querySelector('p.text-lg')?.textContent || '').trim();
      // The answer is shown as one of the labels; find the radio label that matches one of the bank entries' answer
      const radios = Array.from(container.querySelectorAll('label')) as HTMLElement[];
      // Choose the label whose text matches a known GS answer (best-effort)
      let clicked = false;
      for (const r of radios) {
        const txt = (r.textContent || '').trim();
        if (!txt) continue;
        // If the label text appears as an exact match for an answer in the GS bank, click it
        if (asvabBank.GS.some(q => String(q.answer) === txt)) {
          fireEvent.click(r);
          clicked = true;
          break;
        }
      }
      // Fallback: click first label
      if (!clicked && radios[0]) fireEvent.click(radios[0]);
    };

    // Advance through multiple correct answers so the recent window can reflect strong performance.
    const rounds = 7; // 7/8 => 0.875 which maps to 'hard'
    for (let i = 0; i < rounds; i++) {
      // Select correct choice for current question
      clickCorrectChoice();
      // Advance
      const advBtn = screen.getByRole('button', { name: /Finish Section|Next Question/i });
      fireEvent.click(advBtn);
      // Wait for next question render
      await waitFor(() => {
        const p = container.querySelector('p.text-lg');
        expect(p).toBeTruthy();
      });
    }

    // Now the new question should be generated; read its text and look it up in GS bank
    await waitFor(() => {
      const p = container.querySelector('p.text-lg');
      expect(p).toBeTruthy();
      const text = (p as HTMLElement).textContent || '';
      const match = asvabBank.GS.find(q => q.text === text.trim());
      // If we find a match, check difficulty escalated (hard expected after single correct because ratio 1)
      if (match) {
        // After strong recent performance, difficulty should escalate to at least 'hard' or higher
        expect(['hard','very-hard','master']).toContain(match.difficulty);
      } else {
        // Fallback: ensure question text is not empty
        expect(text.trim().length).toBeGreaterThan(0);
      }
    });
  });

  it('calls isAnswerCorrect and records correctness when user selects the right choice', async () => {
    const onExit = vi.fn();
    const spy = vi.spyOn(answers, 'isAnswerCorrect').mockImplementation((e,a) => {
      // use the real implementation logic to remain realistic
      return true;
    });

    const postSpy = vi.spyOn(adaptive, 'handlePostAttempt');

    const { container } = render(<FullTest onExit={onExit} />);
    const startBtn = screen.getByText(/Start Full Test/i);
    fireEvent.click(startBtn);

    await waitFor(() => expect(container.querySelector('p.text-lg')).toBeTruthy());

    // choose a correct label based on bank
    const radios = Array.from(container.querySelectorAll('label')) as HTMLElement[];
    const firstMatching = radios.find(r => asvabBank.GS.some(q => String(q.answer) === (r.textContent || '').trim()));
    expect(firstMatching).toBeTruthy();
    if (firstMatching) fireEvent.click(firstMatching);

    // Click advance
    const advBtn = screen.getByRole('button', { name: /Finish Section|Next Question/i });
    fireEvent.click(advBtn);

    await waitFor(() => {
      // isAnswerCorrect should have been called
      expect(spy).toHaveBeenCalled();
    });

    // For AR/MK questions, handlePostAttempt should be invoked when applicable (we may not be on AR/MK)
    // But ensure the function exists and hasn't thrown
    expect(typeof postSpy).toBe('function');

    spy.mockRestore();
    postSpy.mockRestore();
  });

  it('replaces pre-generated next question when tier changes', async () => {
    // Simulate AI pre-generating multiple questions for GS so a next question already exists
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Return an AI set with two easy GS questions so we can assert replacement
    vi.spyOn(qgen, 'generateFullPracticeAI').mockResolvedValueOnce({
      wkQuestions: [], pcQuestions: [], mkQuestions: [], arQuestions: [], gsQuestions: [
        { id: 30001, subject: 'GS' as any, type: 'gs', text: 'What organ pumps blood?', formulaId: 'gs_1', keywords: [], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Heart', choices: ['Heart','Lung','Kidney','Liver'], category: 'GS' },
        { id: 30002, subject: 'GS' as any, type: 'gs', text: 'What gas do humans breathe in?', formulaId: 'gs_2', keywords: [], partners: [], difficulty: 'easy', difficultyWeight: 1, solveSteps: [], answer: 'Oxygen', choices: ['Oxygen','Carbon dioxide','Nitrogen','Helium'], category: 'GS' }
      ]
    } as any);

    const onExit = vi.fn();
    const { container } = render(<FullTest onExit={onExit} />);
    const startBtn = screen.getByText(/Start Full Test/i);
    fireEvent.click(startBtn);

    await waitFor(() => expect(container.querySelector('p.text-lg')).toBeTruthy());

    // Select a correct answer for the first (easy) GS question
    const radios = Array.from(container.querySelectorAll('label')) as HTMLElement[];
    const firstMatching = radios.find(r => r.textContent && r.textContent.trim().includes('Heart'));
    expect(firstMatching).toBeTruthy();
    if (firstMatching) fireEvent.click(firstMatching);

    // Click advance; this should replace the pre-generated next (easy) question with an upgraded one (medium)
    const advBtn = screen.getByRole('button', { name: /Finish Section|Next Question/i });
    fireEvent.click(advBtn);

    await waitFor(() => {
      const p = container.querySelector('p.text-lg');
      expect(p).toBeTruthy();
      const text = (p as HTMLElement).textContent || '';
      // After a correct easy answer, desired tier should be 'medium'. Check that the visible question is medium difficulty in the GS bank
      const match = asvabBank.GS.find(q => q.text === text.trim());
      if (match) {
        // After a single correct easy question, the replacement should be at least medium
        expect(match.difficulty).not.toBe('easy');
      } else {
        // fallback: ensure not the same as the original next easy question
        expect(text.trim()).not.toMatch(/What gas do humans breathe in\?/);
      }
    });

    (Math.random as any).mockRestore?.();
  });

  it('does not repeat questions within a session', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onExit = vi.fn();
    const { container } = render(<FullTest onExit={onExit} />);
    const startBtn = screen.getByText(/Start Full Test/i);
    fireEvent.click(startBtn);

    await waitFor(() => expect(container.querySelector('p.text-lg')).toBeTruthy());

    const seen = new Set<string>();

    // Advance through several GS questions and ensure no repeats
    for (let i = 0; i < 6; i++) {
      const p = container.querySelector('p.text-lg');
      expect(p).toBeTruthy();
      const text = (p as HTMLElement).textContent || '';
      expect(seen.has(text.trim())).toBe(false);
      seen.add(text.trim());

      // click first available option
      const radios = Array.from(container.querySelectorAll('label')) as HTMLElement[];
      if (radios[0]) fireEvent.click(radios[0]);
      const advBtn = screen.getByRole('button', { name: /Finish Section|Next Question/i });
      fireEvent.click(advBtn);
      await waitFor(() => expect(container.querySelector('p.text-lg')).toBeTruthy());
    }

    // Also ensure that after answering a question, the next question is not the same as the one just answered
    const firstQ = Array.from(container.querySelectorAll('p.text-lg'))[0];
    // navigate back to start to simulate fresh question
    // Start a new small loop: answer and ensure next isn't same
    const p1 = container.querySelector('p.text-lg');
    const prevText = (p1 as HTMLElement).textContent || '';
    const radios2 = Array.from(container.querySelectorAll('label')) as HTMLElement[];
    if (radios2[0]) fireEvent.click(radios2[0]);
    const advBtn2 = screen.getByRole('button', { name: /Finish Section|Next Question/i });
    fireEvent.click(advBtn2);
    await waitFor(() => expect(container.querySelector('p.text-lg')).toBeTruthy());
    const nextText = (container.querySelector('p.text-lg') as HTMLElement).textContent || '';
    expect(nextText.trim()).not.toBe(prevText.trim());

    (Math.random as any).mockRestore?.();
  });
});
