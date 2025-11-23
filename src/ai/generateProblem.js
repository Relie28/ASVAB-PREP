import { BASE_PROMPT } from './prompts';
import { isDuplicate } from './duplicates';

const STORAGE_GENERATED = 'generatedProblems';
const STORAGE_HISTORY = 'problemHistory';

function randChoice(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

// Local fallback generator - create varied problem text programmatically when no AI endpoint is configured.
function fallbackGenerator(topic, difficulty) {
  // small datasets to vary scenarios
  const names = ['Ava', 'Noah', 'Liam', 'Olivia', 'Ethan', 'Mia', 'Lucas', 'Emma', 'Isabella', 'Jacob'];
  const places = ['farm', 'bakery', 'factory', 'store', 'park', 'construction site', 'classroom', 'garage'];
  const actions = ['sold', 'collected', 'delivered', 'bought', 'assembled', 'measured'];

  const name = randChoice(names);
  const place = randChoice(places);
  const action = randChoice(actions);

  // pick two numbers with different magnitudes as a simple heuristic
  const a = Math.floor(Math.random() * 90) + 5;
  const b = Math.floor(Math.random() * 9) + 1;

  // simple problem types: for AR do ratio, for MK do algebraic
  if (topic === 'AR') {
    const problem = `${name} ${action} ${a * b} items at a ${place}. If each batch contains ${b} items, how many batches did ${name} ${action}?`;
    const answer = String(a);
    const explanation = `Divide total items (${a*b}) by items per batch (${b}) to get ${a}.`;
    return { problem, answer, explanation, difficulty, topic };
  } else if (topic === 'MK') {
    const c = Math.floor(Math.random() * 20) + 2;
    const problem = `${name} needs to fit ${a * b} meters of wire into rolls of length ${c} meters. How many full rolls can ${name} make?`;
    const answer = String(Math.floor((a*b) / c));
    const explanation = `Divide total wire ${a*b} by ${c}, take floor for full rolls.`;
    return { problem, answer, explanation, difficulty, topic };
  }
  // MIXED
  const x = Math.floor(Math.random() * 30) + 1;
  const problem = `${name} went to ${place} and ${action} ${a} items. Later, ${name} gave ${b} of them to a friend and ${x} were returned. How many does ${name} have now?`;
  const answer = String(a - b + x);
  const explanation = `Start with ${a}. After giving away ${b}: ${a-b}. After ${x} returned: ${a-b+x}.`;
  return { problem, answer, explanation, difficulty, topic };
}

async function callAIEndpoint(prompt, endpoint, options = {}) {
  // expecting endpoint that accepts prompt in body and returns JSON
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...options }),
  });
  if (!resp.ok) throw new Error('AI endpoint error: ' + resp.statusText);
  return await resp.json();
}

export async function generateProblem(topic = 'AR', difficulty = 1, maxAttempts = 4) {
  // load recent generated
  const existing = JSON.parse(localStorage.getItem(STORAGE_GENERATED) || '[]');
  const endpoint = localStorage.getItem('ai_endpoint');
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      let out;
      if (endpoint) {
        // call AI fetch; the API is expected to return JSON meeting our spec
        const p = BASE_PROMPT.replace('{{difficulty}}', difficulty).replace(/{{topic}}/g, topic);
        const resp = await callAIEndpoint(p, endpoint, {});
        // resp may be { text: 'json...'} or direct object; try to parse
        let parsed;
        if (typeof resp === 'string') parsed = JSON.parse(resp);
        else if (resp?.text) parsed = JSON.parse(resp.text);
        else parsed = resp;
        out = parsed;
      } else {
        out = fallbackGenerator(topic, difficulty);
      }

      if (!out || !out.problem) throw new Error('No problem returned');

      // Avoid duplicates against existing and history
      const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
      const allExisting = [...existing, ...history];
      if (isDuplicate(allExisting, out, 0.65)) {
        attempt += 1;
        continue; // regenerate
      }

      // store generated and history
      const now = Date.now();
      const wrapped = {
        ...out,
        generatedAt: now,
        id: 'p_' + now + '_' + Math.floor(Math.random() * 10000)
      };
      existing.push(wrapped);
      localStorage.setItem(STORAGE_GENERATED, JSON.stringify(existing));
      history.push(wrapped);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
      return wrapped;
    } catch (e) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        // fallback to local generator robustly
        const fallback = fallbackGenerator(topic, difficulty);
        const now = Date.now();
        const wrapped = { ...fallback, generatedAt: now, id: 'p_' + now + '_' + Math.floor(Math.random() * 10000) };
        const existing2 = JSON.parse(localStorage.getItem(STORAGE_GENERATED) || '[]');
        existing2.push(wrapped); localStorage.setItem(STORAGE_GENERATED, JSON.stringify(existing2));
        const history2 = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
        history2.push(wrapped); localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history2));
        return wrapped;
      }
    }
  }
}

export default generateProblem;
