# Council of Intelligence Network (C.O.I.N.) - Technical Execution Guide

This document is the definitive "source-of-truth" execution guide for the C.O.I.N. project. It is structured to help you master the project's internal execution flow, defend your architectural decisions, and excel in technical interviews.

---

## 1. True Entry Points

### Client-Side Entry Point
**File:** `client/src/main.jsx`
* **Purpose:** Bootstraps the React application and attaches it to the HTML DOM.
* **Important Statements:** `ReactDOM.createRoot(...).render(<App />)`
* **Next Execution:** Control moves immediately to `client/src/App.jsx`.

### Server-Side Entry Point
**File:** `server/index.js`
* **Purpose:** Bootstraps the Express server, connects to MongoDB, sets up rate-limiting, defines Mongoose schemas, and exposes REST endpoints.
* **Important Statements:** 
  * `mongoose.connect(process.env.MONGO_URI)`: Establishes the database connection.
  * `app.use(attachApiKey)`: Custom middleware to decrypt the Groq API key from cookies for protected requests.
  * `app.listen(PORT)`: Starts the HTTP server.
* **Next Execution:** The server idles, waiting for HTTP requests from the React client.

---

## 2. Complete Call Graph & Execution Flow

This tree illustrates the exact execution sequence when a user interacts with the system, starting from the Landing page to a complete Council Session.

```text
client/src/main.jsx
└── client/src/App.jsx (Router)
    ├── Route: "/" -> Landing.jsx
    │   ├── Form Submission (Email/Password + API Key)
    │   ├── fetch POST /api/login OR /api/register (server/index.js)
    │   └── fetch POST /api/settings/key (Encrypts and sets API Key in HTTP-Only Cookie)
    │
    ├── Route: "/dashboard" -> Dashboard.jsx
    │   ├── fetch GET /api/history (Retrieves past sessions)
    │   └── Click "New Session" -> Navigates to "/council"
    │
    └── Route: "/council" -> CouncilRoom.jsx
        ├── Renders Background.jsx & FibonacciAnimation.jsx (UI Canvas)
        ├── Renders ControlPanel.jsx
        └── User Submits Prompt in ControlPanel.jsx
            │
            ├── Stage 1: Generation
            │   ├── fetch POST /api/stream-round-1 (server/index.js)
            │   │   ├── Server Validates Auth Token & API Key Cookie
            │   │   ├── Parallel Groq API Calls (Strategist, Technical, Concise, Creative, Critical)
            │   │   └── Server-Sent Events (SSE) streams chunks back to client
            │   └── Client parses SSE chunks and updates HoloCard.jsx state in real-time
            │
            └── Stage 2: Synthesis (Automatically triggered after Stage 1)
                ├── fetch POST /api/round-2 (server/index.js)
                │   ├── classifyPrompt() -> Categorizes query (MATH, CODING, CREATIVE, etc.)
                │   ├── judgeAgent() -> Llama-8B models rank the 5 reports concurrently
                │   ├── getChairmanModel() -> Dynamically selects Chairman based on category
                │   ├── Chairman LLM synthesizes final answer based on rankings & drafts
                │   ├── Session.create() -> Saves result to MongoDB
                │   └── Returns Final Verdict + Metrics to Client
                │
                └── Client updates CouncilRoom.jsx state
                    ├── ControlPanel minimizes.
                    ├── UI shifts to "Retracted Workstation" mode (isRound2 = true)
                    ├── VerdictDisplay.jsx shows Chairman's final synthesized answer
                    ├── CouncilScoreboard.jsx shows agent voting metrics
                    └── User can click "Interrogate" -> Opens DebriefInterface.jsx (calls /api/chat)
```

---

## 3. File-by-File Breakdown (Execution Order)

### `server/index.js`
* **File Purpose:** The monolithic backend server. It handles authentication, database connections, and orchestrates the complex multi-agent LLM logic.
* **Execution Context:** Booted on server start. Handles all incoming `/api/*` traffic.
* **Line-by-Line Breakdown (Important Fragments):**
  ```javascript
  // Middleware: Extract & Decrypt API Key
  const attachApiKey = (req, res, next) => {
    const encryptedKey = req.cookies.groq_vault ? decodeURIComponent(req.cookies.groq_vault) : null;
    if (encryptedKey && req.user && req.user.userId) {
      req.userApiKey = decrypt(encryptedKey, req.user.userId);
    }
    next();
  };
  ```
  * **Runtime Behavior:** Middleware that executes only on *protected* routes (after JWT verification). It looks for the `groq_vault` cookie, and uses the authenticated `userId` to dynamically derive the correct decryption key to unlock the AES-256 payload.
  * **Interview Point:** Discuss this as a major security architecture decision. The system uses a dedicated `ENCRYPTION_SECRET`, generates a random `salt` for every single encryption, and hashes it against the `userId` (`ENCRYPTION_SECRET + userId`). This guarantees **Cryptographic User Isolation**—no two users share a key, and a stolen cookie cannot be decrypted without the correct user context.

  ```javascript
  const completion = await Promise.race([apiPromise, timeoutPromise]);
  ```
  * **Runtime Behavior:** Inside `callGroq()`, this executes the primary LLM call but races it against a 15-second `setTimeout`. 
  * **Interview Point:** This is a **Circuit Breaker / Timeout pattern**. Third-party APIs (like Groq/OpenAI) can hang indefinitely. By racing a timeout, we guarantee the server doesn't freeze, allowing it to gracefully fallback to a backup model if the primary fails.

  ```javascript
  // Stage 1 Batching
  for (let i = 0; i < councilConfig.length; i += BATCH_SIZE) {
      await Promise.all(batch.map(agent => streamAgent(agent)));
  }
  ```
  * **Runtime Behavior:** Loops through the 5 agents, but executes them in controlled batches. 
  * **Interview Point:** This is a **Rate Limiting / Concurrency Control mechanism**. Blasting 5 massive LLM requests concurrently could hit Groq's Rate Limits (HTTP 429). Batching ensures system stability under load.

### `client/src/App.jsx`
* **File Purpose:** Main client router.
* **Execution Context:** Executed immediately after `main.jsx`.
* **Interview Point:** It uses `react-router-dom` to map URL paths to React components. Mention that state here is localized; global state management (like Redux/Zustand) was skipped in favor of localized prop-drilling since the app relies heavily on the server for state persistence.

### `client/src/pages/Landing.jsx`
* **File Purpose:** Authentication gateway.
* **Execution Context:** Displayed when user hits `/`.
* **Important Behavior:** Calls `/api/login` or `/api/register`. Expects a JWT token, which it saves to `localStorage`.
* **Interview Point:** Discuss the separation of auth vs session configuration. The JWT token is in `localStorage` (used for API Authorization header), while the API Key is passed via a separate endpoint (`/api/settings/key`) to be encrypted into an HTTP-Only cookie.

### `client/src/pages/Dashboard.jsx`
* **File Purpose:** User's home screen, showing past history.
* **Execution Context:** Renders after successful login. Mounts `useEffect` to fetch history.
* **Interview Point:** Uses conditional rendering to handle empty states vs populated states.

### `client/src/pages/CouncilRoom.jsx`
* **File Purpose:** The core interaction UI. Manages the visual state of the 5 agents, the layout animations, and the display of the final verdict.
* **Execution Context:** Navigated to from the Dashboard.
* **Important Behavior:** Contains complex conditional rendering (`isRound2` state) that completely transforms the UI from 5 distinct cards (idle/generation) to a retracted sidebar with a focused central text area (synthesis complete).
* **Interview Point:** The component acts as the "Smart Component" (Container Pattern), passing state down to "Dumb Components" like `HoloCard`, `CouncilScoreboard`, and `VerdictDisplay`.

### `client/src/components/ControlPanel.jsx`
* **File Purpose:** The user input terminal. Orchestrates the 2-stage execution flow.
* **Execution Context:** Fixed at the bottom of the `CouncilRoom`.
* **Line-by-Line Breakdown (Important Fragments):**
  ```javascript
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // ... parse chunks
  }
  ```
  * **Runtime Behavior:** Connects to the server's SSE endpoint and reads binary data streams, decoding them to text in real-time.
  * **Interview Point:** This is a fantastic topic. Standard HTTP calls wait for the entire response before returning. SSE (Server-Sent Events) allows the server to push chunks of text as the LLMs generate them. This reduces perceived latency from ~10 seconds to ~0.5 seconds, massively improving UX.

---

## 4. Architectural Decisions & Interview Defenses

### Multi-Agent Architecture (Mixture of Experts)
1. **What it is:** Instead of asking one model (e.g., GPT-4) a question, the system asks 5 smaller, specialized models (Strategist, Technical, Concise, Creative, Critical).
2. **Why chosen:** Reduces single-model bias and hallucination. The "Critical" agent specifically audits the others.
3. **Trade-offs:** Increases latency and API costs.
4. **Interview Defense:** "By using a Mixture of Experts pattern, I decoupled the reasoning process. Even if the 'Creative' model hallucinates, the 'Critical' model and the final 'Chairman' synthesis catch the error, resulting in a much higher quality output than a single zero-shot prompt."

### Two-Stage Synthesis (Map-Reduce)
1. **What it is:** Stage 1: Generate 5 drafts (Map). Stage 2: Rank them and synthesize a final answer (Reduce).
2. **Why chosen:** Required to filter out noise.
3. **Interview Defense:** "I essentially built a Map-Reduce pipeline for LLMs. Stage 1 is parallel generation. Stage 2 is aggregation and ranking. I even added an OCR-Relay where the Technical Agent can override the system if it detects a Math problem, swapping the Chairman to a specialized math model."

### Security: Cryptographic Isolation (Dynamic Salting + HTTP-Only Cookies)
1. **What it is:** User identity is verified via JWT. The API key is then encrypted via AES-256 using a dynamically salted key mathematically bound to the user's ID, and stored in an HTTP-Only cookie.
2. **Why chosen:** Protects against XSS attacks, rainbow table attacks, and cross-user cookie hijacking.
3. **Interview Defense:** "I treated the Groq API key like financial data. If a malicious script gained access to localStorage, they could steal the user's key. By tying it to an HTTP-Only cookie, the client never touches the raw key. More importantly, I enforce strict cryptographic isolation: by hashing a master secret mixed with the user's unique ID and a dynamically generated salt for every transaction, I guarantee that no two users ever share an encryption key. Even if the master database is compromised, the attacker still needs the user's specific context to attempt decryption."

### Fallback/Redundancy Mechanism
1. **What it is:** If a primary LLM (like `moonshotai/kimi`) times out or returns a 5xx error, the `callGroq` wrapper immediately executes a backup model (like `qwen/qwen3-32b`).
2. **Interview Defense:** "System resiliency was a top priority. I implemented a Timeout Promise Race and a Fallback mechanism. In the worst-case scenario where both primary and backup models fail, the system degrades gracefully by returning a 'Procedural Outcome: Dismissed' string, rather than crashing the Express server."

---

## 5. Coverage Validation

### Files Fully Covered
* `server/index.js`
* `client/src/main.jsx`
* `client/src/App.jsx`
* `client/src/pages/Landing.jsx`
* `client/src/pages/Dashboard.jsx`
* `client/src/pages/CouncilRoom.jsx`
* `client/src/components/ControlPanel.jsx`

### Files Skipped (With Justification)
* **File:** `client/src/components/Background.jsx`, `FibonacciAnimation.jsx`, `Hologram.jsx`, `SmartText.jsx`
  * **Reason:** Purely visual presentation/UI components. They do not dictate business logic or runtime execution flow.
* **File:** `client/src/components/HoloCard.jsx`, `VerdictDisplay.jsx`, `CouncilScoreboard.jsx`
  * **Reason:** "Dumb" stateless presentation components that purely render props passed down by `CouncilRoom.jsx`.
* **File:** `client/src/components/DebriefInterface.jsx`, `HistorySidebar.jsx`
  * **Reason:** Secondary UI modals/sidebars. While they execute API calls (`/api/chat` and `/api/history`), they operate on the periphery of the main Council execution flow.
* **File:** `server/package.json`, `client/package.json`, `vite.config.js`
  * **Reason:** Build configuration and dependency lists. Not part of runtime logic.
* **File:** `run_benchmark.js`
  * **Reason:** Development/Testing script, not used in the production execution flow.

---
### Final Advice for the Interview
* **Lead with the Architecture:** When asked "Walk me through the project," don't start with React components. Start with: *"C.O.I.N. is a real-time, multi-agent LLM orchestration engine utilizing a Map-Reduce evaluation pattern, built on an Express backend with a React frontend utilizing Server-Sent Events."*
* **Emphasize Resiliency:** Focus on your custom `callGroq` wrapper, the timeout race conditions, and the backup models. This shows senior-level foresight.
* **Understand the Security:** Be prepared to explain exactly why you used `crypto` to AES-encrypt the API key and why it lives in a cookie. Interviewers love security consciousness.
