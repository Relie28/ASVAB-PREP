export const BASE_PROMPT = `Generate a completely new ASVAB-style problem.
Difficulty: {{difficulty}}
Topic: {{topic}} (AR, MK, or MIXED)

Rules:
- Use a brand new scenario unrelated to any previous data.
- Avoid reused sentence structures, templates, or similar contexts.
- Use different numbers, names, and settings each time.
- Keep the problem solvable without a calculator.
- Output must be strict JSON:

{
 "problem": "...",
 "answer": "...",
 "explanation": "...",
 "difficulty": {{difficulty}},
 "topic": "{{topic}}"
}
`;
