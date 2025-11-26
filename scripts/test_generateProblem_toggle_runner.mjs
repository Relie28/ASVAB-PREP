// Runner to test generateProblem's respect for ai_enabled toggle
import * as GP from '../src/ai/generateProblem.js';
const generateProblem = (GP.default && (GP.default.generateProblem || GP.default.default)) || GP.generateProblem || GP.default || GP;

// Polyfill a minimal localStorage for Node ESM
global.window = global.window || {};
global.localStorage = global.localStorage || (function () {
    const store = {};
    return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };
})();

function assert(condition, message) {
    if (!condition) { console.error('FAIL', message); process.exitCode = 2; } else console.log('PASS', message);
}

async function run() {
    console.log('Testing generateProblem toggle...');
    global.localStorage.setItem('ai_enabled', 'false');
    console.log('GP keys', Object.keys(GP));
    console.log('GP.default keys', GP.default ? Object.keys(GP.default) : undefined);
    const out = await generateProblem('AR', 1, 2, null);
    const GP_log = GP.getAiEventLog ? (GP.getAiEventLog()) : [];
    console.log('AI event log length:', GP_log.length);
    console.log('AI event log sample', GP_log.slice(-3));
    assert(out && out.problem, 'generateProblem returns a fallback when ai_enabled=false');
    // ensure an ID exists and it looks like fallback object
    assert(out.id && out.id.startsWith('p_'), 'Fallback generated object has id starting with p_');
    console.log('Done');
}

run();
