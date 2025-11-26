import { generateFullTestAI } from '../src/lib/question-generator';

(async () => {
    try {
        const { arQuestions, mkQuestions } = await generateFullTestAI(null, { timeoutMs: 30000, fastMode: true });
        console.log('AR generated:', arQuestions.length, 'unique signatures:', new Set(arQuestions.map(q => q.structuralSignature || q.text)).size);
        console.log('MK generated:', mkQuestions.length, 'unique signatures:', new Set(mkQuestions.map(q => q.structuralSignature || q.text)).size);
    } catch (e) {
        console.error('Error generating full test AI', e);
        process.exit(1);
    }
})();
