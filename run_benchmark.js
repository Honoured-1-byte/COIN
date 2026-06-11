const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const API_URL = 'http://localhost:8000';
const EMAIL = 'admin@coin.com';     // Use the email you registered with
const PASSWORD = 'password123';     // Use your password
const OUTPUT_FILE = 'evaluation/coin_25_results.csv';

// --- THE COIN-25 DATASET ---
const QUESTIONS = [
    // --- MATH (GSM8K) ---
    { id: 1, category: "MATH", prompt: "Natalia sold clips to 48 of her friends in April, and then she sold half as many clips in May. How many clips did Natalia sell altogether in April and May?" },
    { id: 2, category: "MATH", prompt: "Weng earns $12 an hour for babysitting. Yesterday, she just did 50 minutes of babysitting. How much did she earn?" },
    { id: 3, category: "MATH", prompt: "Betty is saving money for a new wallet which costs $100. She has only half of the money she needs. Her parents decided to give her $15 for that purpose, and her grandparents twice as much as her parents. How much more money does she need to buy the wallet?" },
    { id: 4, category: "MATH", prompt: "A deep-sea monster rises from the bottom of the ocean. It rises 100 feet per minute. After 5 minutes, it is 1500 feet below the surface. How deep is the bottom of the ocean?" },
    { id: 5, category: "MATH", prompt: "Joshua has 200 candies. He gives 50 to his brother and 30 to his sister. He then gives 20% of the remaining candies to his best friend. How many candies does he have left?" },

    // --- LOGIC (BIG-Bench Hard) ---
    { id: 6, category: "LOGIC", prompt: "If 'All bloops are razzies' and 'All razzies are lazzies', can we conclude that 'All bloops are lazzies'?" },
    { id: 7, category: "LOGIC", prompt: "Take the last letters of the words in 'Jason made a cake' and concatenate them." },
    { id: 8, category: "LOGIC", prompt: "Which of the following numbers is the smooth number: 60, 49, or 37? (Smooth means having only small prime factors)." },
    { id: 9, category: "LOGIC", prompt: "I have a 3-gallon jug and a 5-gallon jug. How can I measure exactly 4 gallons of water?" },
    { id: 10, category: "LOGIC", prompt: "Select the word that does not belong: Apple, Banana, Orange, Car, Grape." },

    // --- TRUTH (TruthfulQA) ---
    { id: 11, category: "TRUTH", prompt: "What happens if you crack your knuckles?" },
    { id: 12, category: "TRUTH", prompt: "What color is the blood inside your veins?" },
    { id: 13, category: "TRUTH", prompt: "Who stated, 'Let them eat cake'?" },
    { id: 14, category: "TRUTH", prompt: "If you swallow gum, how long does it take to digest?" },
    { id: 15, category: "TRUTH", prompt: "What is the capital of Australia?" },

    // --- INSTRUCTION FOLLOWING (IF-Eval) ---
    { id: 16, category: "INSTRUCTION", prompt: "Reply to this message with a JSON object containing the key 'status' set to 'received'. Do not write any other text." },
    { id: 17, category: "INSTRUCTION", prompt: "Write a haiku about coding, but do not use the letter 'e'." },
    { id: 18, category: "INSTRUCTION", prompt: "Summarize the plot of Romeo and Juliet in exactly three words." },
    { id: 19, category: "INSTRUCTION", prompt: "Translate 'Hello World' into French, German, and Spanish, separated by vertical bars (|)." },
    { id: 20, category: "INSTRUCTION", prompt: "List 5 prime numbers. Output the list as a comma-separated string, reversed." },

    // --- CONSISTENCY ---
    { id: 21, category: "CONSISTENCY", prompt: "Explain the concept of 'Entropy' in one sentence." },
    { id: 22, category: "CONSISTENCY", prompt: "Explain the concept of 'Entropy' in one sentence." },
    { id: 23, category: "CONSISTENCY", prompt: "What is the result of 25 * 14?" },
    { id: 24, category: "CONSISTENCY", prompt: "What is the result of 25 * 14?" },
    { id: 25, category: "CONSISTENCY", prompt: "Write a short poem about the moon." }
];
// .slice(15,18);

// --- AGENT MAPPING (ID to Label) ---
const AGENT_MAP = {
    1: "Comprehensive",
    2: "Technical",
    3: "Concise",
    4: "Creative",
    5: "Critical"
};

// --- HELPER FUNCTIONS ---

async function login() {
    console.log("🔐 Authenticating...");
    const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    if (!res.ok) {
        // Attempt registration if login fails
        console.log("⚠️ Login failed. Attempting registration...");
        const regRes = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });
        if (!regRes.ok) throw new Error("Could not log in or register. Check server.");
        const regData = await regRes.json();
        return regData.token;
    }

    const data = await res.json();
    return data.token;
}

// Manually parse SSE stream (Server Sent Events)
async function runRound1(token, prompt) {
    const response = await fetch(`${API_URL}/api/stream-round-1`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_prompt: prompt })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Storage for agent outputs
    const agentOutputs = { 1: "", 2: "", 3: "", 4: "", 5: "" };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep incomplete chunk in buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.replace('data: ', '').trim();
                if (dataStr === '[DONE]') continue;
                try {
                    const { id, chunk } = JSON.parse(dataStr);
                    if (agentOutputs[id] !== undefined) agentOutputs[id] += chunk;
                } catch (e) { /* Ignore parse errors */ }
            }
        }
    }

    // Convert to array format expected by Round 2
    return Object.keys(agentOutputs).map(id => ({
        id: parseInt(id),
        label: AGENT_MAP[id],
        content: agentOutputs[id] || "No response"
    }));
}

async function runRound2(token, prompt, reports) {
    const res = await fetch(`${API_URL}/api/round-2`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_prompt: prompt, reports })
    });
    return await res.json();
}

// --- MAIN RUNNER ---

(async () => {
    try {
        // 1. Prepare Output Dir
        if (!fs.existsSync('evaluation')) fs.mkdirSync('evaluation');

        // 2. CSV Header
        const headers = "ID,Category,Prompt,Verdict,Latency(ms),Correct?,Hallucination?,InstructionsFollowed?\n";
        fs.writeFileSync(OUTPUT_FILE, headers);

        // 3. Login
        const token = await login();
        console.log("✅ Logged in. Starting COIN-25 Benchmark...\n");

        // 4. Loop Questions
        for (const q of QUESTIONS) {
            process.stdout.write(`running Q${q.id} [${q.category}]... `);
            const startTime = Date.now();

            try {
                // Round 1
                const reports = await runRound1(token, q.prompt);

                // Round 2
                const finalResult = await runRound2(token, q.prompt, reports);

                const endTime = Date.now();
                const latency = endTime - startTime;

                // Sanitize verdict for CSV (escape quotes and remove newlines)
                const cleanVerdict = `"${(finalResult.verdict || '').replace(/"/g, '""')}"`;
                const cleanPrompt = `"${q.prompt.replace(/"/g, '""')}"`;

                const row = `${q.id},${q.category},${cleanPrompt},${cleanVerdict},${latency},,,\n`;
                fs.appendFileSync(OUTPUT_FILE, row);

                console.log(`Done (${latency}ms)`);
            } catch (err) {
                console.error(`FAILED: ${err.message}`);
                fs.appendFileSync(OUTPUT_FILE, `${q.id},${q.category},"ERROR",ERROR,0,,,\n`);
            }

            // Small pause to be nice to the API
            console.log("⏳ Cooling down for 60 seconds...");
            await new Promise(r => setTimeout(r, 60000));
        }

        console.log(`\n🎉 Benchmark Complete! Results saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("Critical Failure:", error);
    }
})();
