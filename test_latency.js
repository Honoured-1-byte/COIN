// Load API credentials and optional test settings from server/.env.
const path = require('path');
const { createRequire } = require('module');
const serverRequire = createRequire(path.join(__dirname, 'server', 'package.json'));
serverRequire('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });

const API_URL = process.env.LATENCY_API_URL || 'http://localhost:8000';
const EMAIL = process.env.LATENCY_TEST_EMAIL || 'admin@coin.com';
const PASSWORD = process.env.LATENCY_TEST_PASSWORD || 'password123';
const GROQ_KEY = process.env.groq_api_key;
const RUNS = Math.max(1, Number.parseInt(process.env.LATENCY_TEST_RUNS || '10', 10));
const GAP_MS = Math.max(0, Number.parseInt(process.env.LATENCY_TEST_GAP_MS || '60000', 10));

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function percentile(values, fraction) {
    const sorted = [...values].sort((a, b) => a - b);
    const position = (sorted.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(label, values) {
    if (!values.length) {
        console.log(`${label}: no successful samples`);
        return;
    }
    console.log(`${label}: p50 = ${percentile(values, 0.50).toFixed(1)}ms, p95 = ${percentile(values, 0.95).toFixed(1)}ms`);
}

async function login() {
    const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    if (!res.ok) {
        throw new Error(`Login failed with HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    if (!data.token) throw new Error('Login response did not include a token');
    return data.token;
}

async function measureTTFT(token, prompt) {
    const startTime = Date.now();
    let firstTokenTime = null;

    const response = await fetch(`${API_URL}/api/stream-round-1`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_prompt: prompt, groq_key: GROQ_KEY }),
        signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
        const error = new Error(`Latency request failed with HTTP ${response.status}: ${await response.text()}`);
        error.status = response.status;
        throw error;
    }
    if (!response.body) throw new Error('Latency response did not include a stream');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (value && value.length > 0) {
            if (firstTokenTime === null) {
                firstTokenTime = Date.now();
            }
            streamText += decoder.decode(value, { stream: true });
        }
        if (done) break;
    }

    if (/\[ERROR:.*(?:429|rate.?limit|too many requests)/is.test(streamText)) {
        const error = new Error('Groq rate limit detected in the streamed response; stopping to avoid additional requests');
        error.status = 429;
        throw error;
    }
    if (firstTokenTime === null) {
        throw new Error('The stream completed without returning any data');
    }

    const endTime = Date.now();
    return {
        ttft: firstTokenTime - startTime,
        totalTime: endTime - startTime
    };
}

(async () => {
    const results = [];
    try {
        if (!GROQ_KEY) throw new Error('Missing groq_api_key in server/.env');

        console.log(`Logging in to ${API_URL}...`);
        const token = await login();
        console.log(`Running ${RUNS} sequential TTFT tests with ${GAP_MS}ms between requests.`);

        for (let run = 1; run <= RUNS; run++) {
            try {
                const result = await measureTTFT(token, `Latency sample ${run}: Reply with one short sentence.`);
                results.push(result);
                console.log(`Test ${run}/${RUNS}: TTFT = ${result.ttft}ms, Total Time = ${result.totalTime}ms`);
            } catch (error) {
                console.error(`Test ${run}/${RUNS} failed: ${error.message}`);
                if (error.status === 429) {
                    console.error('Stopping the run after a rate limit response.');
                    break;
                }
                throw error;
            }

            if (run < RUNS) {
                console.log(`Waiting ${GAP_MS}ms before the next sample...`);
                await sleep(GAP_MS);
            }
        }

        console.log(`\nCompleted ${results.length}/${RUNS} samples.`);
        summarize('TTFT', results.map(result => result.ttft));
        summarize('Total time', results.map(result => result.totalTime));
    } catch (error) {
        console.error('Latency test stopped:', error.message);
        process.exitCode = 1;
    }
})();
