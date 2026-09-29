// Import the built-in Node.js file system module for synchronous file operations (like reading/writing CSV)
const fs = require('fs');
// Import the built-in Node.js path module for resolving directory and file paths
const path = require('path');

// --- CONFIGURATION ---
// Define the base URL of the local API server running the backend
const API_URL = 'http://localhost:8000';
// Define the email address used for authenticating with the backend
const EMAIL = 'admin@coin.com';     // Use the email you registered with
// Define the password used for authenticating with the backend
const PASSWORD = 'password123';     // Use your password
// Define the path and filename where the benchmark evaluation results will be saved
const OUTPUT_FILE = 'evaluation/coin_25_results.csv';

// --- THE COIN-25 DATASET ---
// Define an array of objects representing the dataset used for benchmarking the model
const QUESTIONS = [
    // --- MATH (GSM8K) ---
    // Math question 1 from the GSM8K dataset
    { id: 1, category: "MATH", prompt: "Natalia sold clips to 48 of her friends in April, and then she sold half as many clips in May. How many clips did Natalia sell altogether in April and May?" },
    // Math question 2 from the GSM8K dataset
    { id: 2, category: "MATH", prompt: "Weng earns $12 an hour for babysitting. Yesterday, she just did 50 minutes of babysitting. How much did she earn?" },
    // Math question 3 from the GSM8K dataset
    { id: 3, category: "MATH", prompt: "Betty is saving money for a new wallet which costs $100. She has only half of the money she needs. Her parents decided to give her $15 for that purpose, and her grandparents twice as much as her parents. How much more money does she need to buy the wallet?" },
    // Math question 4 from the GSM8K dataset
    { id: 4, category: "MATH", prompt: "A deep-sea monster rises from the bottom of the ocean. It rises 100 feet per minute. After 5 minutes, it is 1500 feet below the surface. How deep is the bottom of the ocean?" },
    // Math question 5 from the GSM8K dataset
    { id: 5, category: "MATH", prompt: "Joshua has 200 candies. He gives 50 to his brother and 30 to his sister. He then gives 20% of the remaining candies to his best friend. How many candies does he have left?" },

    // --- LOGIC (BIG-Bench Hard) ---
    // Logic question 1 from the BIG-Bench Hard dataset
    { id: 6, category: "LOGIC", prompt: "If 'All bloops are razzies' and 'All razzies are lazzies', can we conclude that 'All bloops are lazzies'?" },
    // Logic question 2 from the BIG-Bench Hard dataset
    { id: 7, category: "LOGIC", prompt: "Take the last letters of the words in 'Jason made a cake' and concatenate them." },
    // Logic question 3 from the BIG-Bench Hard dataset
    { id: 8, category: "LOGIC", prompt: "Which of the following numbers is the smooth number: 60, 49, or 37? (Smooth means having only small prime factors)." },
    // Logic question 4 from the BIG-Bench Hard dataset
    { id: 9, category: "LOGIC", prompt: "I have a 3-gallon jug and a 5-gallon jug. How can I measure exactly 4 gallons of water?" },
    // Logic question 5 from the BIG-Bench Hard dataset
    { id: 10, category: "LOGIC", prompt: "Select the word that does not belong: Apple, Banana, Orange, Car, Grape." },

    // --- TRUTH (TruthfulQA) ---
    // Truthfulness question 1 from the TruthfulQA dataset
    { id: 11, category: "TRUTH", prompt: "What happens if you crack your knuckles?" },
    // Truthfulness question 2 from the TruthfulQA dataset
    { id: 12, category: "TRUTH", prompt: "What color is the blood inside your veins?" },
    // Truthfulness question 3 from the TruthfulQA dataset
    { id: 13, category: "TRUTH", prompt: "Who stated, 'Let them eat cake'?" },
    // Truthfulness question 4 from the TruthfulQA dataset
    { id: 14, category: "TRUTH", prompt: "If you swallow gum, how long does it take to digest?" },
    // Truthfulness question 5 from the TruthfulQA dataset
    { id: 15, category: "TRUTH", prompt: "What is the capital of Australia?" },

    // --- INSTRUCTION FOLLOWING (IF-Eval) ---
    // Instruction following question 1 from the IF-Eval dataset
    { id: 16, category: "INSTRUCTION", prompt: "Reply to this message with a JSON object containing the key 'status' set to 'received'. Do not write any other text." },
    // Instruction following question 2 from the IF-Eval dataset
    { id: 17, category: "INSTRUCTION", prompt: "Write a haiku about coding, but do not use the letter 'e'." },
    // Instruction following question 3 from the IF-Eval dataset
    { id: 18, category: "INSTRUCTION", prompt: "Summarize the plot of Romeo and Juliet in exactly three words." },
    // Instruction following question 4 from the IF-Eval dataset
    { id: 19, category: "INSTRUCTION", prompt: "Translate 'Hello World' into French, German, and Spanish, separated by vertical bars (|)." },
    // Instruction following question 5 from the IF-Eval dataset
    { id: 20, category: "INSTRUCTION", prompt: "List 5 prime numbers. Output the list as a comma-separated string, reversed." },

    // --- CONSISTENCY ---
    // Consistency check question 1 (repeated later to test deterministic output)
    { id: 21, category: "CONSISTENCY", prompt: "Explain the concept of 'Entropy' in one sentence." },
    // Consistency check question 2 (repeat of question 1)
    { id: 22, category: "CONSISTENCY", prompt: "Explain the concept of 'Entropy' in one sentence." },
    // Consistency check question 3 (repeated later to test deterministic output)
    { id: 23, category: "CONSISTENCY", prompt: "What is the result of 25 * 14?" },
    // Consistency check question 4 (repeat of question 3)
    { id: 24, category: "CONSISTENCY", prompt: "What is the result of 25 * 14?" },
    // Consistency check question 5
    { id: 25, category: "CONSISTENCY", prompt: "Write a short poem about the moon." }
];
// Optional commented-out code that could be used to slice the array for testing specific subsets
// .slice(15,18);

// --- AGENT MAPPING (ID to Label) ---
// Define a mapping from agent IDs (used by the backend) to human-readable agent labels/personas
const AGENT_MAP = {
    // Agent ID 1 maps to the 'Comprehensive' persona
    1: "Comprehensive",
    // Agent ID 2 maps to the 'Technical' persona
    2: "Technical",
    // Agent ID 3 maps to the 'Concise' persona
    3: "Concise",
    // Agent ID 4 maps to the 'Creative' persona
    4: "Creative",
    // Agent ID 5 maps to the 'Critical' persona
    5: "Critical"
};

// --- HELPER FUNCTIONS ---

// Asynchronous function to handle user authentication
async function login() {
    // Log a message indicating the authentication process has started
    console.log("🔐 Authenticating...");
    // Send a POST request to the /api/login endpoint
    const res = await fetch(`${API_URL}/api/login`, {
        // Specify the HTTP method as POST
        method: 'POST',
        // Set the request headers to indicate the body is JSON
        headers: { 'Content-Type': 'application/json' },
        // Convert the email and password into a JSON string for the request body
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    // Check if the response status is not OK (e.g., 401 Unauthorized)
    if (!res.ok) {
        // Log a warning message indicating login failed and registration will be attempted
        console.log("⚠️ Login failed. Attempting registration...");
        // Send a POST request to the /api/register endpoint as a fallback
        const regRes = await fetch(`${API_URL}/api/register`, {
            // Specify the HTTP method as POST
            method: 'POST',
            // Set the request headers to indicate the body is JSON
            headers: { 'Content-Type': 'application/json' },
            // Convert the email and password into a JSON string for the request body
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });
        // Check if the registration response status is also not OK
        if (!regRes.ok) throw new Error("Could not log in or register. Check server.");
        // Parse the JSON response body from the successful registration
        const regData = await regRes.json();
        // Return the authentication token from the registration response
        return regData.token;
    }

    // Parse the JSON response body from the successful login
    const data = await res.json();
    // Return the authentication token from the login response
    return data.token;
}

// Asynchronous function to execute the first round of the process (agent generation) by parsing Server-Sent Events (SSE)
async function runRound1(token, prompt) {
    // Send a POST request to the /api/stream-round-1 endpoint to initiate the streaming process
    const response = await fetch(`${API_URL}/api/stream-round-1`, {
        // Specify the HTTP method as POST
        method: 'POST',
        // Set the request headers
        headers: {
            // Indicate the body is JSON
            'Content-Type': 'application/json',
            // Provide the JWT token in the Authorization header for access control
            'Authorization': `Bearer ${token}`
        },
        // Convert the user prompt into a JSON string for the request body
        body: JSON.stringify({ user_prompt: prompt })
    });

    // Obtain a reader from the response body to process the incoming SSE stream chunks
    const reader = response.body.getReader();
    // Initialize a TextDecoder to convert the raw binary chunks into strings
    const decoder = new TextDecoder();
    // Initialize an empty buffer to accumulate string chunks for parsing
    let buffer = '';

    // Initialize an object to store the accumulated output from each of the 5 agents
    const agentOutputs = { 1: "", 2: "", 3: "", 4: "", 5: "" };

    // Start an infinite loop to read from the stream until it is finished
    while (true) {
        // Read the next chunk from the stream; 'done' indicates completion, 'value' contains the data
        const { done, value } = await reader.read();
        // Break out of the loop if the stream is complete
        if (done) break;

        // Decode the raw binary value into a string and append it to the buffer; stream: true handles characters split across chunks
        buffer += decoder.decode(value, { stream: true });
        // Split the buffer by double newlines, which delimit individual SSE events
        const lines = buffer.split('\n\n');
        // Remove the last element (which might be an incomplete chunk) and put it back in the buffer for the next iteration
        buffer = lines.pop(); // Keep incomplete chunk in buffer

        // Iterate over each complete line/event extracted from the buffer
        for (const line of lines) {
            // Check if the line starts with the SSE data prefix 'data: '
            if (line.startsWith('data: ')) {
                // Remove the 'data: ' prefix and trim any surrounding whitespace to isolate the payload
                const dataStr = line.replace('data: ', '').trim();
                // Check if the payload indicates the end of the stream '[DONE]', and skip to the next event if so
                if (dataStr === '[DONE]') continue;
                // Start a try-catch block to handle potential JSON parsing errors
                try {
                    // Parse the JSON payload to extract the agent ID and the text chunk
                    const { id, chunk } = JSON.parse(dataStr);
                    // Check if the extracted ID corresponds to a known agent, and if so, append the chunk to that agent's output
                    if (agentOutputs[id] !== undefined) agentOutputs[id] += chunk;
                // Ignore any parsing errors (e.g., malformed JSON chunks)
                } catch (e) { /* Ignore parse errors */ }
            }
        }
    }

    // Convert the object of agent outputs into an array format required for the next round
    return Object.keys(agentOutputs).map(id => ({
        // Convert the string key back to an integer ID
        id: parseInt(id),
        // Map the ID to its corresponding human-readable label
        label: AGENT_MAP[id],
        // Assign the accumulated content, falling back to a default message if empty
        content: agentOutputs[id] || "No response"
    }));
}

// Asynchronous function to execute the second round of the process (chairman aggregation and judgement)
async function runRound2(token, prompt, reports) {
    // Send a POST request to the /api/round-2 endpoint
    const res = await fetch(`${API_URL}/api/round-2`, {
        // Specify the HTTP method as POST
        method: 'POST',
        // Set the request headers
        headers: {
            // Indicate the body is JSON
            'Content-Type': 'application/json',
            // Provide the JWT token in the Authorization header for access control
            'Authorization': `Bearer ${token}`
        },
        // Convert the user prompt and the array of agent reports into a JSON string for the request body
        body: JSON.stringify({ user_prompt: prompt, reports })
    });
    // Parse and return the JSON response body representing the final verdict
    return await res.json();
}

// --- MAIN RUNNER ---

// Immediately Invoked Function Expression (IIFE) to execute the main benchmark script asynchronously
(async () => {
    // Start a try-catch block to handle global errors during the benchmark execution
    try {
        // 1. Prepare Output Dir
        // Check if the 'evaluation' directory exists, and if not, create it synchronously
        if (!fs.existsSync('evaluation')) fs.mkdirSync('evaluation');

        // 2. CSV Header
        // Define the header row for the CSV output file
        const headers = "ID,Category,Prompt,Verdict,Latency(ms),Correct?,Hallucination?,InstructionsFollowed?\n";
        // Write the header row to the output file synchronously (overwriting if it exists)
        fs.writeFileSync(OUTPUT_FILE, headers);

        // 3. Login
        // Call the login function and await the authentication token
        const token = await login();
        // Log a success message indicating the benchmark process is starting
        console.log("✅ Logged in. Starting COIN-25 Benchmark...\n");

        // 4. Loop Questions
        // Iterate over each question object in the QUESTIONS array
        for (const q of QUESTIONS) {
            // Print a message indicating which question is currently being processed without adding a newline
            process.stdout.write(`running Q${q.id} [${q.category}]... `);
            // Record the current timestamp as the start time for latency measurement
            const startTime = Date.now();

            // Start a try-catch block to handle errors specific to the current question
            try {
                // Round 1
                // Execute round 1 (agent generation) with the token and the current question prompt, awaiting the reports
                const reports = await runRound1(token, q.prompt);

                // Round 2
                // Execute round 2 (chairman judgement) with the token, prompt, and the generated reports, awaiting the final result
                const finalResult = await runRound2(token, q.prompt, reports);

                // Record the current timestamp as the end time
                const endTime = Date.now();
                // Calculate the total latency for the complete process
                const latency = endTime - startTime;

                // Sanitize verdict for CSV (escape quotes and remove newlines)
                // Replace all double quotes with double-double quotes for CSV escaping, and wrap the entire string in double quotes
                const cleanVerdict = `"${(finalResult.verdict || '').replace(/"/g, '""')}"`;
                // Replace all double quotes with double-double quotes for CSV escaping, and wrap the entire prompt string in double quotes
                const cleanPrompt = `"${q.prompt.replace(/"/g, '""')}"`;

                // Construct a CSV row string combining the ID, category, sanitized prompt, sanitized verdict, and latency, leaving the manual grading columns blank
                const row = `${q.id},${q.category},${cleanPrompt},${cleanVerdict},${latency},,,\n`;
                // Append the constructed row to the output file synchronously
                fs.appendFileSync(OUTPUT_FILE, row);

                // Log a success message with the recorded latency for the current question
                console.log(`Done (${latency}ms)`);
            // Catch any errors that occurred while processing the current question
            } catch (err) {
                // Log the error message
                console.error(`FAILED: ${err.message}`);
                // Append an error row to the CSV output file to indicate the failure
                fs.appendFileSync(OUTPUT_FILE, `${q.id},${q.category},"ERROR",ERROR,0,,,\n`);
            }

            // Small pause to be nice to the API
            // Log a message indicating a cooldown period
            console.log("⏳ Cooling down for 60 seconds...");
            // Pause execution for 60,000 milliseconds (60 seconds) to avoid rate limiting or overloading the server
            await new Promise(r => setTimeout(r, 60000));
        }

        // Log a final success message indicating the benchmark is complete and where the results are saved
        console.log(`\n🎉 Benchmark Complete! Results saved to ${OUTPUT_FILE}`);

    // Catch any critical errors that occurred in the outer try block
    } catch (error) {
        // Log the critical failure message along with the error object
        console.error("Critical Failure:", error);
    }
// Execute the IIFE
})();
