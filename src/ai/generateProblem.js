import { BASE_PROMPT } from './prompts';
import { isDuplicate, structuralSignature, extractNumbers, computeEmbedding, tokenFingerprint } from './duplicates';
import { loadUserModel } from '@/lib/decision-engine';

const STORAGE_GENERATED = 'generatedProblems';
const STORAGE_HISTORY = 'problemHistory';

function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Local fallback generator - create varied problem text programmatically when no AI endpoint is configured.
function fallbackGenerator(topic, difficulty, formulaId = null) {
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

    // support formulaId targeted generation for fallback
    if (formulaId) {
        const fid = (formulaId || '').toLowerCase();
        if (fid.includes('rate') || fid.includes('distance')) {
            const problem = `${name} ${action} ${a * b} items at a ${place}. If each batch contains ${b} items, how many batches did ${name} ${action}?`;
            const answer = String(a);
            const explanation = `Divide total items (${a * b}) by items per batch (${b}) to get ${a}.`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('percent')) {
            const whole = difficulty === 'hard' ? 250 : 80;
            const pct = difficulty === 'hard' ? 27 : 15; // %
            const problem = `${pct}% of ${whole} is what number?`;
            const answer = String(+(whole * (pct / 100)).toFixed(2));
            const explanation = `Part = Percent × Whole -> ${answer}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('pythag') || fid.includes('hypotenuse')) {
            const a2 = 3, b2 = 4;
            const problem = `A right triangle has legs ${a2} and ${b2}. What is the hypotenuse?`;
            const answer = String(Math.sqrt(a2 * a2 + b2 * b2));
            const explanation = `Use Pythagorean theorem: sqrt(${a2 * a2}+${b2 * b2})`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('reading_table') || fid.includes('table')) {
            const names = ['John', 'Amy', 'Sam'];
            const table = [[1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9)], [1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9)], [1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9)]];
            const text = `Table:\n${names[0]}: ${table[0].join(', ')}\n${names[1]}: ${table[1].join(', ')}\n${names[2]}: ${table[2].join(', ')}\nWhat is the total sold by ${names[1]}?`;
            const answer = String(table[1].reduce((s, x) => s + x, 0));
            const explanation = `Sum row ${names[1]} = ${answer}`;
            return { problem: text, answer, explanation, difficulty, topic };
        }
        if (fid.includes('mixture')) {
            const total = difficulty === 'hard' ? 120 : 40;
            const ratioA = 1 + Math.floor(Math.random() * 3);
            const ratioB = 1 + Math.floor(Math.random() * 3);
            const aAmt = Math.round(total * (ratioA / (ratioA + ratioB)));
            const problem = `A ${total}g solution is a mixture in the ratio ${ratioA}:${ratioB} of A to B. How many grams of A?`;
            return { problem, answer: String(aAmt), explanation: `A = total × ${ratioA}/${ratioA + ratioB} = ${aAmt}`, difficulty, topic };
        }
        if (fid.includes('probability')) {
            const total = difficulty === 'hard' ? 12 : 6;
            const fav = 1 + Math.floor(Math.random() * Math.min(3, total - 1));
            const probText = `A bag contains ${total} marbles, ${fav} red. One is drawn at random. What is the probability it's red?`;
            const probAns = String((fav / total).toFixed(3));
            return { problem: probText, answer: probAns, explanation: `P = fav / total = ${fav}/${total} = ${probAns}`, difficulty, topic };
        }
        if (fid.includes('percent_multistep')) {
            const price = difficulty === 'hard' ? (200 + Math.floor(Math.random() * 300)) : (30 + Math.floor(Math.random() * 120));
            const disc = difficulty === 'hard' ? (15 + Math.floor(Math.random() * 20)) : (5 + Math.floor(Math.random() * 10));
            const tax = difficulty === 'hard' ? (8 + Math.floor(Math.random() * 10)) : (2 + Math.floor(Math.random() * 5));
            const afterDisc = +(price * (1 - disc / 100)).toFixed(2);
            const afterTax = +((afterDisc) * (1 + tax / 100)).toFixed(2);
            const t = `An item costs $${price}. It is first discounted by ${disc}%, then a sales tax of ${tax}% is applied. What is the final price?`;
            return { problem: t, answer: String(afterTax), explanation: `Price after discount then tax = ${afterTax}`, difficulty, topic };
        }
        if (fid.includes('fraction_mult')) {
            const n1 = 1 + Math.floor(Math.random() * 6); const d1 = 2 + Math.floor(Math.random() * 6);
            const n2 = 1 + Math.floor(Math.random() * 6); const d2 = 2 + Math.floor(Math.random() * 6);
            const problem = `Compute ${n1}/${d1} × ${n2}/${d2}`;
            const answer = String((n1 / d1) * (n2 / d2));
            const explanation = `Multiply numerators and denominators: ${n1}/${d1} × ${n2}/${d2} = ${answer}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('fraction_divide')) {
            const n1 = 1 + Math.floor(Math.random() * 6); const d1 = 2 + Math.floor(Math.random() * 6);
            const n2 = 1 + Math.floor(Math.random() * 6); const d2 = 2 + Math.floor(Math.random() * 6);
            const problem = `Compute ${n1}/${d1} ÷ ${n2}/${d2}`;
            const answer = String((n1 / d1) / (n2 / d2));
            const explanation = `Invert second fraction and multiply: (${n1}/${d1}) × (${d2}/${n2}) = ${answer}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('volume_rect_prism') || fid.includes('volume') || fid.includes('rectangular prism')) {
            const l = 2 + Math.floor(Math.random() * 6); const w = 1 + Math.floor(Math.random() * 6); const h = 1 + Math.floor(Math.random() * 5);
            const problem = `Find the volume of a rectangular prism with dimensions ${l} by ${w} by ${h}.`;
            const answer = String(l * w * h);
            const explanation = `Volume = l*w*h = ${answer}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('systems') || fid.includes('system of equations')) {
            const x = 1 + Math.floor(Math.random() * 5); const y = 1 + Math.floor(Math.random() * 5);
            const a = 1 + Math.floor(Math.random() * 4); const b = 1 + Math.floor(Math.random() * 4);
            const c = a * x + b * y; const d = (1 + Math.floor(Math.random() * 4)) * x + (1 + Math.floor(Math.random() * 4)) * y;
            const problem = `Solve the system: ${a}x + ${b}y = ${c} and ${d}x + ${d + 1}y = ${d * x + (d + 1) * y}. What is x + y?`;
            const answer = String(x + y);
            const explanation = `x=${x}, y=${y}, so x+y=${answer}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('polynomial_factor') || fid.includes('factor')) {
            const b = 3 + Math.floor(Math.random() * 6); const c = 2 + Math.floor(Math.random() * 8);
            const problem = `Factor x^2 + ${b}x + ${c}`;
            const answer = `(x + ${b}) (x + ${c})`;
            const explanation = `Find factors that multiply to ${c} and add to ${b}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('compound_interest') || fid.includes('compound')) {
            const P = 500 + Math.floor(Math.random() * 4500);
            const r = 3 + Math.floor(Math.random() * 6);
            const n = Math.random() < 0.5 ? 1 : 12;
            const t = 1 + Math.floor(Math.random() * 3);
            const amt = +(P * Math.pow(1 + (r / 100) / n, n * t)).toFixed(2);
            const problem = `What is the amount after ${t} years on $${P} at ${r}% compounded ${n} times per year?`;
            const answer = String(amt);
            const explanation = `A = P(1 + r/n)^{nt} = ${answer}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('angles') || fid.includes('angle')) {
            const a = 30 + Math.floor(Math.random() * 61);
            const problem = `If one angle of a triangle is ${a}°, and another is 60°, what is the third angle?`;
            const answer = String(180 - a - 60);
            const explanation = `Sum of triangle angles is 180°, third angle = ${answer}`;
            return { problem, answer, explanation, difficulty, topic };
        }
        if (fid.includes('median') || fid.includes('median_mode')) {
            const arrSize = difficulty === 'hard' ? 9 : 5;
            const base = 1 + Math.floor(Math.random() * 8);
            const arr = Array.from({ length: arrSize }, () => base + Math.floor(Math.random() * 10));
            arr.sort((a, b) => a - b);
            const median = arr[Math.floor(arr.length / 2)];
            const problem = `Find the median of the following numbers: ${arr.join(', ')}`;
            const answer = String(median);
            const explanation = `Sorted list: ${arr.join(', ')}; median = ${median}`;
            return { problem, answer, explanation, difficulty, topic };
        }
    }
    // simple problem types: for AR do ratio, for MK do algebraic
    if (topic === 'AR') {
        const problem = `${name} ${action} ${a * b} items at a ${place}. If each batch contains ${b} items, how many batches did ${name} ${action}?`;
        const answer = String(a);
        const explanation = `Divide total items (${a * b}) by items per batch (${b}) to get ${a}.`;
        return { problem, answer, explanation, difficulty, topic };
    } else if (topic === 'MK') {
        const c = Math.floor(Math.random() * 20) + 2;
        const problem = `${name} needs to fit ${a * b} meters of wire into rolls of length ${c} meters. How many full rolls can ${name} make?`;
        const answer = String(Math.floor((a * b) / c));
        const explanation = `Divide total wire ${a * b} by ${c}, take floor for full rolls.`;
        return { problem, answer, explanation, difficulty, topic };
    }
    // MIXED
    const x = Math.floor(Math.random() * 30) + 1;
    const problem = `${name} went to ${place} and ${action} ${a} items. Later, ${name} gave ${b} of them to a friend and ${x} were returned. How many does ${name} have now?`;
    const answer = String(a - b + x);
    const explanation = `Start with ${a}. After giving away ${b}: ${a - b}. After ${x} returned: ${a - b + x}.`;
    return { problem, answer, explanation, difficulty, topic };
}

async function callAIEndpoint(prompt, endpoint, options = {}) {
    // expecting endpoint that accepts prompt in body and returns JSON
    const fetchOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, ...options }) };
    if (options.signal) fetchOptions.signal = options.signal;
    const resp = await fetch(endpoint, fetchOptions);
    if (!resp.ok) throw new Error('AI endpoint error: ' + resp.statusText);
    return await resp.json();
}

// Try to use the bundled Grok SDK if available (client-side). This keeps requests clientonly
// and uses the free Grok tier when possible. The SDK import is dynamic to avoid server-side bundling issues.
async function callGrokSDKPrompt(prompt, opts = {}) {
    try {
        // Dynamic import of the SDK in a way that avoids bundlers statically including server-only modules.
        // This code only executes client-side (window check) and uses eval-import to avoid static analysis.
        if (typeof window === 'undefined') throw new Error('Grok SDK is client-side only');
        if (opts.signal && opts.signal.aborted) throw new Error('callGrokSDKPrompt aborted');
        const mod = await eval('import("z-ai-web-dev-sdk")');
        // Try a few common shapes from the SDK in defensive order
        if (mod && typeof mod.createCompletion === 'function') {
            // SDK vX shape
            const out = await mod.createCompletion({ model: 'grok', prompt });
            if (opts.signal && opts.signal.aborted) throw new Error('callGrokSDKPrompt aborted');
            return out;
        }
        if (mod && typeof mod.create === 'function') {
            const out = await mod.create({ model: 'grok', prompt });
            if (opts.signal && opts.signal.aborted) throw new Error('callGrokSDKPrompt aborted');
            return out;
        }
        // Older SDKs might export a default class
        if (mod && mod.default && typeof mod.default === 'function') {
            const client = new mod.default();
            if (typeof client.generate === 'function') {
                const out = await client.generate({ model: 'grok', prompt });
                if (opts.signal && opts.signal.aborted) throw new Error('callGrokSDKPrompt aborted');
                return out;
            }
        }
    } catch (e) {
        // If no SDK available or API changed, just raise and fall back to endpoint fetch or local generator
        throw e;
    }
    throw new Error('No usable Grok SDK interface found');
}

function recordAiEvent(type, reason, details = {}) {
    try {
        const key = 'ai_event_log';
        const raw = localStorage.getItem(key);
        const events = raw ? JSON.parse(raw) : [];
        events.push({ ts: Date.now(), type, reason, details });
        // keep only last 200 events
        if (events.length > 200) events.splice(0, events.length - 200);
        localStorage.setItem(key, JSON.stringify(events));
    } catch (e) {
        // ignore
    }
}

export function getAiEventLog() {
    try { return JSON.parse(localStorage.getItem('ai_event_log') || '[]'); } catch (e) { return []; }
}

export async function getAiStatus() {
    try {
        const endpoint = localStorage.getItem('ai_endpoint') || null;
        let sdkAvailable = false;
        if (typeof window !== 'undefined') {
            try {
                // dynamic import attempt (no bundling at build time)
                const mod = await eval('import("z-ai-web-dev-sdk")');
                sdkAvailable = !!mod;
            } catch (e) { sdkAvailable = false; }
        }
        const log = getAiEventLog();
        const fallbackCount = (log || []).length;
        return { sdkAvailable, endpoint, fallbackCount };
    } catch (e) { return { sdkAvailable: false, endpoint: null, fallbackCount: 0 }; }
}

export async function generateProblem(topic = 'AR', difficulty = 1, maxAttempts = 20, formulaId = null, exclusionList = [], opts = {}) {
    // load recent generated. If persistence disabled by caller (opts.persist === false), avoid using and writing localStorage.
    const shouldPersist = opts && typeof opts.persist !== 'undefined' ? !!opts.persist : true;
    const existing = shouldPersist ? JSON.parse(localStorage.getItem(STORAGE_GENERATED) || '[]') : [];
    // Respect the AI toggle if present: if AI disabled, return a fallback immediately
    try {
        if (typeof window !== 'undefined') {
            const userModel = loadUserModel();
            const userPref = userModel && userModel.preferences && typeof userModel.preferences.aiEnabled === 'boolean' ? userModel.preferences.aiEnabled : null;
            const aiEnabledRaw = localStorage.getItem('ai_enabled');
            const aiEnabled = userPref === null ? (aiEnabledRaw === null ? true : aiEnabledRaw === 'true') : userPref;
            if (!aiEnabled) {
                const fallback = fallbackGenerator(topic, difficulty, formulaId);
                const wrapped = { ...fallback, generatedAt: Date.now(), id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 10000) };
                recordAiEvent('fallback', 'ai_disabled', { topic, difficulty, formulaId });
                return wrapped;
            }
        }
    } catch (e) {
        // ignore - if anything goes wrong, allow AI to attempt
    }
    const endpoint = localStorage.getItem('ai_endpoint');
    let attempt = 0;
    // In fastMode, reduce attempts to avoid blocking
    const maxAttemptsLocal = (opts && opts.fastMode) ? Math.min(maxAttempts, 3) : maxAttempts;
    while (attempt < maxAttemptsLocal) {
        if (opts.signal && opts.signal.aborted) {
            throw new Error('generateProblem aborted');
        }
        try {
            let out;
            if (endpoint) {
                // call AI fetch; the API is expected to return JSON meeting our spec
                let p = BASE_PROMPT.replace('{{difficulty}}', difficulty).replace(/{{topic}}/g, topic);
                // On subsequent attempts, nudge the model to change numbers and wording more aggressively
                if (attempt > 0) {
                    p += `\n\nIf you are producing something similar to previously generated examples, please paraphrase the question and change the numeric values so it is effectively unique.`;
                }
                // forced paraphrase option (stronger paraphrase) is set by opts.forceParaphrase
                if (opts && opts.forceParaphrase) {
                    p += `\n\nIMPORTANT: Paraphrase strongly. Change wording, context, names, and numeric values where possible while preserving the problem's solution pattern. Avoid templates like 'car travels' or 'John has' when alternatives are available.`;
                    // Extra instructions specifically for Mathematics Knowledge (MK) to reduce formulaic structure
                    if (topic === 'MK') {
                        p += `\n\nFor MK problems: Prefer re-framing as a contextual scenario (e.g., construction, recipes, shopping, sports, or inventory situations). Use multi-sentence descriptions where possible (short scenario + clear question). Change units and numeric scales, and avoid direct one-line algebraic templates; instead present a real-world scenario to solve.`;
                    }
                }
                // Provide an exclusion list to the model to avoid duplicates in the prompt
                if (Array.isArray(exclusionList) && exclusionList.length) {
                    // include only a short list to keep prompts manageable
                    const samp = exclusionList.slice(-30).map(s => `- ${s}`).join('\n');
                    p += `\n\nAvoid generating a problem similar to any of the following examples:\n${samp}`;
                }
                if (formulaId) p += `\nPreferredFormula: ${formulaId}`;
                let resp;
                try {
                    resp = await callAIEndpoint(p, endpoint, { signal: opts.signal });
                } catch (errEndpoint) {
                    recordAiEvent('fallback', 'endpoint_error', { message: String(errEndpoint), endpoint });
                    throw errEndpoint;
                }
                // resp may be { text: 'json...'} or direct object; try to parse
                let parsed;
                if (typeof resp === 'string') parsed = JSON.parse(resp);
                else if (resp?.text) parsed = JSON.parse(resp.text);
                else parsed = resp;
                out = parsed;
            } else {
                // Try Grok SDK client-side first
                try {
                    const p = BASE_PROMPT.replace('{{difficulty}}', difficulty).replace(/{{topic}}/g, topic);
                    if (formulaId) {
                        p += `\nPreferredFormula: ${formulaId}`;
                    }
                    const sdkResp = await callGrokSDKPrompt(p, { signal: opts.signal });
                    let parsed;
                    if (typeof sdkResp === 'string') parsed = JSON.parse(sdkResp);
                    else if (sdkResp?.text) parsed = JSON.parse(sdkResp.text);
                    else parsed = sdkResp;
                    out = parsed;
                } catch (err) {
                    // Fallback to local generator if SDK not available or returns invalid results
                    recordAiEvent('fallback', 'sdk_error', { message: String(err) });
                    out = fallbackGenerator(topic, difficulty, formulaId);
                }
            }

            if (!out || !out.problem) throw new Error('No problem returned');

            // Compute derived metadata for the problem
            try {
                out.structuralSignature = structuralSignature(out.problem);
                out.numbers = extractNumbers(out.problem);
                out.tokenFingerprint = tokenFingerprint(out.problem);
                // In fast mode, skip embeddings to save time
                if (!opts.fastMode) {
                    try { out.embedding = await computeEmbedding(out.problem); } catch (ee) { out.embedding = null; }
                } else {
                    out.embedding = null;
                }
            } catch (metaErr) {
                // ignore metadata errors but log
                recordAiEvent('meta', 'compute_meta_error', { error: String(metaErr) });
            }

            // Avoid duplicates against existing and history
            const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
            const attemptLog = JSON.parse(localStorage.getItem('asvab_attempt_log_v1') || '[]');
            // Combine generated list, history, and attempt log question texts for duplicate detection
            const allExisting = [...existing, ...history, ...(attemptLog || [])];
            // Fast mode uses a slightly quicker duplicate check threshold and skip some signals
            const dupThreshold = opts.fastMode ? 0.85 : 0.75;
            if (isDuplicate(allExisting, out, dupThreshold)) {
                attempt += 1;
                recordAiEvent('duplicate', 'rejected_duplicate', { attempt, problem: out.problem });
                continue; // regenerate
            }

            // store generated and history
            const now = Date.now();
            const wrapped = {
                ...out,
                generatedAt: now,
                id: 'p_' + now + '_' + Math.floor(Math.random() * 10000)
            };
            if (shouldPersist) {
                existing.push(wrapped);
                localStorage.setItem(STORAGE_GENERATED, JSON.stringify(existing));
                history.push(wrapped);
                localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
            }
            return wrapped;
        } catch (e) {
            attempt += 1;
            if (attempt >= maxAttempts) {
                // fallback to local generator robustly
                const fallback = fallbackGenerator(topic, difficulty, formulaId);
                const now = Date.now();
                const wrapped = { ...fallback, generatedAt: now, id: 'p_' + now + '_' + Math.floor(Math.random() * 10000) };
                recordAiEvent('fallback', 'max_attempts', { attempts: attempt });
                if (shouldPersist) {
                    const existing2 = JSON.parse(localStorage.getItem(STORAGE_GENERATED) || '[]');
                    existing2.push(wrapped); localStorage.setItem(STORAGE_GENERATED, JSON.stringify(existing2));
                    const history2 = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
                    history2.push(wrapped); localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history2));
                }
                return wrapped;
            }
        }
    }
}

// Session purge: removes rejected/non-unique cached items and trims the cache to a limit
export function purgeSessionCache(opts = { keepUniqueCount: 500 }) {
    try {
        const gen = JSON.parse(localStorage.getItem(STORAGE_GENERATED) || '[]');
        const seenSigs = new Set();
        const unique = [];
        for (const item of gen) {
            const sig = item.structuralSignature || structuralSignature(item.problem || '');
            const finger = item.tokenFingerprint || tokenFingerprint(item.problem || '');
            const key = `${sig}::${finger}`;
            if (!seenSigs.has(key)) {
                seenSigs.add(key);
                unique.push(item);
            }
        }
        // keep last n unique
        const trimmed = unique.slice(-opts.keepUniqueCount);
        localStorage.setItem(STORAGE_GENERATED, JSON.stringify(trimmed));
        // For history, we keep the same trimming
        const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
        const trimmedHistory = history.filter(h => trimmed.some(t => t.id === h.id));
        localStorage.setItem(STORAGE_HISTORY, JSON.stringify(trimmedHistory));
        recordAiEvent('purge', 'session_purge', { kept: trimmed.length });
        return { kept: trimmed.length };
    } catch (e) {
        recordAiEvent('purge', 'error', { error: String(e) });
        return { kept: 0 };
    }
}

// Map AI/fallback output to the Question shape used across app
export async function generateQuestionObject(topic = 'AR', difficulty = 1, maxAttempts = 20, scenario = false, formulaId = null, exclusionList = [], opts = {}) {
    const gen = await generateProblem(topic, difficulty, maxAttempts, formulaId, exclusionList, opts || {});
    if (!gen) return null;
    // Create numeric ID from timestamp + random to avoid collisions
    const id = Date.now() + Math.floor(Math.random() * 1000);
    // Basic choices generation (for numeric answers only). If answer not numeric, provide generic choices.
    const asNum = Number(gen.answer);
    const choices = [];
    if (!isNaN(asNum)) {
        // make 4 options with answer and nearby distractors
        const delta = Math.max(1, Math.round(Math.abs(asNum) * 0.05) || 1);
        choices.push(asNum);
        choices.push(asNum + delta);
        choices.push(asNum - delta);
        choices.push(asNum + delta * 2);
    } else {
        // text answer: include answer + simple variants
        choices.push(gen.answer);
        choices.push((gen.answer + 's') || gen.answer);
        choices.push('Not sure');
        choices.push('None of the above');
    }
    const text = scenario ? `${gen.problem}\n\n(Note: this is a scenario-style, multi-step problem.)` : gen.problem;
    const q = {
        id,
        subject: topic,
        type: 'ai_generated',
        text,
        formulaId: formulaId || `ai_generated_${topic}`,
        keywords: gen.keywords || [],
        partners: gen.partners || [],
        difficulty: difficulty === 1 ? 'easy' : (difficulty === 2 ? 'medium' : 'hard'),
        difficultyWeight: difficulty === 1 ? 1 : (difficulty === 2 ? 2 : 3),
        solveSteps: [gen.explanation || ''],
        answer: gen.answer,
        choices,
        category: topic
    };
    // copy metadata from generation if present
    if (gen.structuralSignature) q.structuralSignature = gen.structuralSignature;
    if (gen.numbers) q.numbers = gen.numbers;
    if (gen.tokenFingerprint) q.tokenFingerprint = gen.tokenFingerprint;
    if (gen.embedding) q.embedding = gen.embedding;
    return q;
}

export default generateProblem;
