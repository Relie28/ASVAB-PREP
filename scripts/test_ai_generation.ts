/* Test the AI question generation utilities
   Run: npx tsx scripts/test_ai_generation.ts
*/

// Minimal localStorage shim for Node
const createLocalStorageShim = () => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; }
  };
};
(globalThis as any).localStorage = createLocalStorageShim();

import { batchGenerateAI, generateFullTestAI, backgroundRefineFullTest } from '../src/lib/question-generator';
import { loadAdaptiveUserModel } from '../src/lib/adaptive-engine';

(async () => {
  console.log('Starting AI generator tests...');
  const model = loadAdaptiveUserModel();
  const batch = await batchGenerateAI(5, 'AR', model);
  console.log('Generated batch AR count:', batch.length);
  console.log('Sample AR:', batch[0]);
  const batchMk = await batchGenerateAI(5, 'MK', model);
  console.log('Generated batch MK count:', batchMk.length);
  console.log('Sample MK:', batchMk[0]);
    const full = await generateFullTestAI(model, { timeoutMs: 15000, fastMode: true });
    console.log('Initial fast-mode full test loaded');
    const refined = await backgroundRefineFullTest(full.arQuestions, full.mkQuestions, model, { timeoutMs: 30000 });
    console.log('Background refine completed — AR/MK counts:', refined.arQuestions.length, refined.mkQuestions.length);
  const mixed = await batchGenerateAI(5, 'MIXED', model);
  console.log('Generated batch MIXED count:', mixed.length);
  console.log('Sample MIXED:', mixed[0]);
  console.log('Full test counts:', full.arQuestions.length, full.mkQuestions.length);
  console.log('AI generation tests completed successfully');
  process.exit(0);
})();
