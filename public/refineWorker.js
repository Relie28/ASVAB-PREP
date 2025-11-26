// Simple worker that delegates heavy refine job to server side '/api/ai/refine'
self.onmessage = async (e) => {
    const { arQuestions, mkQuestions, timeoutMs, heavy } = e.data || {};
    try {
        const resp = await fetch('/api/ai/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arQuestions, mkQuestions, timeoutMs, heavy: !!heavy })
        });
        if (!resp.ok) throw new Error('Refine endpoint failed: ' + resp.statusText);
        const body = await resp.json();
        self.postMessage({ ok: true, payload: body });
    } catch (err) {
        self.postMessage({ ok: false, error: String(err) });
    }
};
