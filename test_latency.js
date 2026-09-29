// Import the built-in Node.js file system module for file operations (not used in this script but standard to include)
const fs = require('fs');
// Import and configure dotenv to load environment variables from the server/.env file, resolving the path relative to the current directory
require('dotenv').config({ path: require('path').resolve(__dirname, 'server/.env') });

// Define the base URL of the local API server
const API_URL = 'http://localhost:8000';
// Define the email address to be used for authentication
const EMAIL = 'admin@coin.com';
// Define the password to be used for authentication
const PASSWORD = 'password123';
// Retrieve the Groq API key from the loaded environment variables
const GROQ_KEY = process.env.groq_api_key;

// Asynchronous function to authenticate and get a JWT token
async function login() {
    // Send a POST request to the /api/login endpoint
    const res = await fetch(`${API_URL}/api/login`, {
        // Specify the HTTP method as POST
        method: 'POST',
        // Set the request headers to indicate the body is JSON
        headers: { 'Content-Type': 'application/json' },
        // Convert the email and password object into a JSON string for the request body
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    // Parse the JSON response body from the server
    const data = await res.json();
    // Return the authentication token from the parsed data
    return data.token;
}

// Asynchronous function to measure Time To First Token (TTFT) and total response time
async function measureTTFT(token, prompt) {
    // Record the current timestamp as the start time of the request
    const startTime = Date.now();
    // Initialize a variable to track the time the first token is received
    let firstTokenTime = null;

    // Send a POST request to the /api/stream-round-1 endpoint
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
        // Convert the user prompt and Groq key into a JSON string for the request body
        body: JSON.stringify({ user_prompt: prompt, groq_key: GROQ_KEY })
    });

    // Obtain a reader from the response body to stream the incoming data chunks
    const reader = response.body.getReader();
    // Initialize a TextDecoder to convert the raw binary chunks into strings
    const decoder = new TextDecoder();

    // Start an infinite loop to process the stream
    while (true) {
        // Read the next chunk from the stream; 'done' indicates completion, 'value' contains the data
        const { done, value } = await reader.read();
        // Check if this is the first chunk received
        if (firstTokenTime === null) {
            // Record the current timestamp as the Time To First Token
            firstTokenTime = Date.now();
        }
        // If the stream is finished, break out of the infinite loop
        if (done) break;
    }
    
    // Record the current timestamp as the end time of the request
    const endTime = Date.now();
    // Return an object containing the latency metrics
    return {
        // Calculate the TTFT by subtracting the start time from the first token time
        ttft: firstTokenTime - startTime,
        // Calculate the total time by subtracting the start time from the end time
        totalTime: endTime - startTime
    };
}

// Immediately Invoked Function Expression (IIFE) to run the main logic asynchronously
(async () => {
    // Start a try-catch block to handle any errors during execution
    try {
        // Log a message indicating that the login process is starting
        console.log("Logging in...");
        // Call the login function and await the token
        const token = await login();
        // Log a success message indicating the token was obtained and tests are starting
        console.log("Token obtained. Running 3 TTFT tests...");

        // Start a loop to run the test 3 times
        for(let i=1; i<=3; i++) {
            // Call the measureTTFT function with the token and a test prompt, and await the results
            const res = await measureTTFT(token, `Test prompt ${i}: Please explain quantum mechanics in exactly 20 words.`);
            // Log the results for the current test iteration, including TTFT and total time
            console.log(`Test ${i}: TTFT = ${res.ttft}ms, Total Time = ${res.totalTime}ms`);
            // Wait for 2000 milliseconds (2 seconds) before running the next test iteration to avoid rate limiting
            await new Promise(r => setTimeout(r, 2000));
        }

    // Catch any errors that occurred in the try block
    } catch (err) {
        // Log the error message to the console
        console.error("Test failed:", err);
    }
// Execute the IIFE
})();
