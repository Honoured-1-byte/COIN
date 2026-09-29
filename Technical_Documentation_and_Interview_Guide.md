# Council of Intelligence Networks (C.O.I.N.)
## Absolute Source of Truth & Technical Interview Guide

---

## 1. High-Level Architecture & Design Patterns

### System Architecture: Client-Server Multi-Agent Orchestration
The C.O.I.N. application utilizes a decentralized-concept but structurally **Client-Server architecture** with a **Multi-Agent Orchestration Engine** at its core. 
- **The Client (React/Vite):** Manages local state, handles Server-Sent Events (SSE) for real-time stream ingestion, and dynamically renders the UI based on continuous data streams.
- **The Server (Node.js/Express):** Acts as a centralized Orchestrator and API Gateway. It does not generate AI responses locally; instead, it orchestrates requests to the Groq API, delegating tasks to 5 distinct specialized LLMs simultaneously.
- **The Database (MongoDB):** Acts as the persistent storage layer for user authentication data and a chronological history of all complete "Council Sessions."

### Design Patterns Implemented
1. **Multi-Agent Orchestration / Strategy Pattern:** The server dynamically selects configurations (Models, System Prompts, Temperature) based on an agent's assigned role (e.g., Strategist, Technical, Creative). When a query arrives, the Orchestrator applies the exact strategy parameters mapped to that specific LLM entity.
2. **Middleware Pattern:** Heavily utilized in the Express backend. Requests flow through pipeline functions like `authenticateToken` (JWT validation), `attachApiKey` (AES-256 decryption of API keys), and `rateLimiter` before hitting the controller logic.
3. **Observer / Pub-Sub (Streaming Data Pattern):** Using Server-Sent Events (SSE), the backend maintains an open connection to the client during "Round 1", publishing chunks of AI-generated text as they arrive from Groq. The React client observes these events and updates local state iteratively.
4. **Circuit Breaker / Fallback Pattern:** The backend encapsulates API calls within a `Promise.race()` timeout wrapper. If a primary Groq model fails or times out (15s limit), the system breaks the circuit for that model and seamlessly falls back to a designated backup model to ensure high availability.

---

## 2. Exhaustive Tech Stack Dissection (The "Why")

| Technology | Layer | Justification: "Why this over the alternative?" |
| :--- | :--- | :--- |
| **React (v18)** | Frontend UI | Chosen over Vanilla JS or Vue for its unidirectional data flow and highly efficient reconciliation algorithm (Virtual DOM). Perfect for handling the massive, rapid state changes triggered by 5 simultaneous SSE text streams. |
| **Vite** | Build Tool / Bundler | Chosen over Create React App (Webpack) because Vite uses native ES modules during development, resulting in near-instant Cold Server Starts and Lightning-Fast Hot Module Replacement (HMR). |
| **Tailwind CSS** | Styling | Chosen over styled-components or SCSS for utility-first styling. It eliminates context-switching between JS and CSS files, heavily reduces CSS bundle size in production (via PurgeCSS), and enables rapid prototyping of the sci-fi interface. |
| **Node.js & Express** | Backend | Chosen over Python/Django or Go for full-stack JavaScript uniformity. Express provides a minimalist, unopinionated framework that makes setting up middleware (JWT, encryption, rate-limiting) and SSE streaming extremely straightforward. |
| **MongoDB & Mongoose** | Database | Chosen over PostgreSQL. The application stores highly unstructured, dynamic JSON data (AI Agent Reports, variable peer rankings, unpredictable math arrays). A NoSQL document store provides the schema flexibility required without rigid migrations. |
| **Groq SDK** | AI Inference | Chosen over OpenAI API direct due to Groq's LPU (Language Processing Unit) architecture. Groq offers exponentially faster Time-To-First-Token (TTFT) and throughput, which is strictly mandatory when running 5 heavy LLMs in parallel. |
| **Framer Motion** | Animations | Chosen over standard CSS transitions for complex, physics-based UI orchestrations (e.g., the Retractable Workstation in Round 2, HoloCards). Provides granular control over enter/exit animations tied to React state. |

---

## 3. Directory Structure & Module Breakdown

```ascii
Council_of_Intelligence/
├── client/                     # Frontend Workspace
│   ├── package.json
│   ├── vite.config.js          
│   └── src/
│       ├── main.jsx            # React Entry Point
│       ├── App.jsx             # React Router Configuration
│       ├── index.css           # Global Tailwind Directives
│       ├── components/         # Reusable UI Modules
│       │   ├── ControlPanel.jsx       # User input & stream initiation
│       │   ├── FibonacciAnimation.jsx # Global background visualization
│       │   ├── HoloCard.jsx           # Individual Agent visualization
│       │   ├── VerdictDisplay.jsx     # Chairman's synthesized output
│       │   └── ...
│       └── pages/              # Route-Level Components
│           ├── Landing.jsx     # Authentication / Key Vault
│           ├── Dashboard.jsx   # History and Session management
│           └── CouncilRoom.jsx # Core orchestration and SSE handling
└── server/                     # Backend Workspace
    ├── package.json
    ├── .env                    # Secrets & Config
    └── index.js                # Core Server & Orchestration Logic
```

### Module Responsibilities
- **`/client/src/pages`**: Holds the macro-level views. They are responsible for route-level data fetching, macro layout, and passing state down to components.
- **`/client/src/components`**: Holds highly decoupled, pure (where possible) UI components. E.g., `HoloCard` only cares about displaying whatever `data` prop it is given, knowing nothing about how the AI generated it.
- **`server/index.js`**: A monolith entry point. Contains the Express app setup, MongoDB schemas (`User`, `Session`), cryptographic utilities for secure cookie management, and the core routing logic (`/api/stream-round-1`, `/api/round-2`).

---

## 4. View, Routing & User Flows (Page-by-Page)

### `/` (Landing.jsx)
- **Purpose:** Gateway to the application. Handles User Registration, Authentication, and Secure API Key injection.
- **State Management:** Local React state for form inputs. Uses `localStorage` to save the JWT token, but uses an HTTP-Only secure cookie to store the user's AES-encrypted Groq API Key.
- **Triggered Actions:** Submits `POST /api/login` or `POST /api/register`. On success, sets local storage and navigates to the Dashboard.

### `/dashboard` (Dashboard.jsx)
- **Purpose:** Displays the user's past Council Sessions.
- **State Management:** Local `history` array containing fetched sessions.
- **Triggered Actions:** On mount, triggers `GET /api/history` with the JWT in the Authorization header. Clicking a session routes to `/council` and passes the full session JSON via React Router state.

### `/council` (CouncilRoom.jsx)
- **Purpose:** The core interactive UI. Handles the two-round orchestration.
- **State Management:** Highly complex local state. `results` object tracks incoming SSE streams. `sessionData` tracks the finalized Round 2 verdict. `hasKey` tracks security status.
- **Triggered Actions:**
  - *Round 1:* Submits prompt. Opens an `EventSource`/Fetch reader to `POST /api/stream-round-1`. Streams data continuously into local state.
  - *Round 2:* Submits Round 1 `results` to `POST /api/round-2`. Awaits heavy JSON response containing Peer Rankings and the Chairman Verdict. Updates UI to the "Retractable Workstation" view.

---

## 5. End-to-End Data Flow & Controller Logic

**Scenario: A user submits a query to the Council.**

1. **Client Initiation:** User types a query in `ControlPanel.jsx` and hits Submit.
2. **Round 1 Request:** Frontend makes a `POST` request to `/api/stream-round-1` containing the prompt and optional image.
3. **Backend Authentication (Middleware):** 
   - `authenticateToken` verifies the JWT.
   - `attachApiKey` intercepts the `groq_vault` cookie, decrypts the AES-256 payload using the server's master `ENCRYPTION_KEY`, and attaches `req.userApiKey`.
4. **Agent Dispatch (Controller):** The server iterates over the 5 agent configurations. It fires off 5 asynchronous calls to the Groq API simultaneously using `stream: true`.
5. **Streaming Loop:** As chunks return from Groq, the backend writes them directly to the `res` object as Server-Sent Events (`data: {...}\n\n`).
6. **Client Assembly:** `CouncilRoom.jsx` reads the stream chunks and appends them to the specific Agent's HoloCard state in real-time.
7. **Round 2 Initialization:** Once Round 1 finishes, the frontend immediately fires `POST /api/round-2`, passing all 5 completed Agent Reports.
8. **Routing & Classification:** The backend queries an LLM router to classify the prompt (e.g., MATH, CODING, CREATIVE). Based on this, a "Chairman" model is dynamically selected (e.g., Qwen for Math).
9. **Peer Review (Voting):** The backend maps the 5 reports and asks 5 LLM Judges to evaluate and rank the reports in strict JSON.
10. **Synthesis:** The backend compiles the reports and the judges' rankings, sending them to the Chairman Model to synthesize the `finalVerdict`.
11. **Persistence:** The backend aggregates the prompt, category, reports, votes, and verdict, saving it to MongoDB via the `Session` schema.
12. **Resolution:** Backend returns the massive JSON payload to the client, which shifts the UI to the Verdict Display.

---

## 6. Exception, Error Handling & Resiliency

### Global Error Handling & Rate Limiting
- **Rate Limiters:** Utilizing `express-rate-limit`. 
  - `apiLimiter`: 100 requests / 15 mins for general APIs.
  - `heavyLimiter`: Strict 50 requests / 1 hour for expensive LLM orchestration routes to protect wallet/compute.
- **Graceful Failure:** If an API endpoint fails, it returns a standard JSON error `{ error: "Message" }`, which the frontend catches and displays as UI toasts/alerts.

### Edge Cases & Data Validation
- **JSON Parsing Safeguards:** In Round 2, models are asked to return JSON. A custom regex-based parser `cleanReviewJSON()` attempts to extract valid JSON even if the model hallucinates surrounding text/markdown (e.g., extracting from ` ```json ... ``` `).
- **Silent Fail-safes:** If user uploads an image but forgets the text prompt, the backend intercepts and injects: `"Analyze the attached image in detail."` to prevent API crash.

### Resiliency (The Triple Fallback System)
The `callGroq` helper function is engineered for maximum availability:
1. **Timeouts:** A `Promise.race` enforces a strict 15-second timeout on the primary model.
2. **Model Fallback:** If the primary fails or times out, it automatically triggers a smaller, faster `backupModel` (e.g., switching from Llama-70B to Llama-8B).
3. **Emergency Verdict:** If both models completely fail, the system does not crash. It returns a hardcoded emergency string (`## procedural_outcome: DISMISSED`) ensuring the frontend UI never hangs indefinitely.

---

## 7. The Interviewer’s Grilling Room (Crucial Placement Prep)

**1. Question:** "You are managing 5 heavy LLM streams over HTTP. How do you prevent the Node.js event loop from blocking?"
> **Answer:** "Node.js is single-threaded, but network I/O is offloaded to the OS via libuv. Since I am acting as an API gateway proxying streams from Groq, the heavy compute is not happening on my server. I am simply receiving chunks and piping them directly to the client via `res.write()`. The event loop only handles the lightweight routing of these TCP packets, making it highly non-blocking."

**2. Question:** "Why use Server-Sent Events (SSE) instead of WebSockets for Round 1?"
> **Answer:** "WebSockets provide full-duplex, bi-directional communication, which is overkill here. In Round 1, the client sends a single HTTP request, and the server needs to push a unidirectional stream of text chunks. SSE is built over standard HTTP, easier to scale through load balancers, has built-in reconnection logic, and maps perfectly to the one-way nature of LLM token streaming."

**3. Question:** "You store a user API key. If your MongoDB is compromised, are those keys leaked?"
> **Answer:** "No. I do not store the API keys in MongoDB at all. When a user submits their key, the server immediately encrypts it using `crypto.createCipheriv` (AES-256-CBC) with a server-side secret, and stores the encrypted payload inside an HTTP-Only, SameSite cookie on the user's browser. The database never sees it. If the DB is breached, the keys are completely safe."

**4. Question:** "What happens if Groq's API goes down during Round 2? Does the user just see a spinner forever?"
> **Answer:** "Absolutely not. I implemented a Circuit Breaker pattern wrapped in a `Promise.race`. If the primary model doesn't respond within 15 seconds, the promise rejects, catching the error, and immediately rerouting the request to a secondary backup model. If the backup also fails, it returns a hardcoded 'Indeterminate' fallback string. The client is guaranteed a response."

**5. Question:** "How do you guarantee your 'Judges' return valid JSON for the voting metrics?"
> **Answer:** "LLMs are notoriously bad at strict schema adherence. First, I prompt them aggressively to return *only* JSON. Second, I lower the temperature to `0.1` to reduce creative hallucinations. Third, I implemented a robust `cleanReviewJSON` utility that uses Regex to scrape the output string for `{ ... }` boundaries, effectively stripping out any conversational filler before attempting `JSON.parse`."

**6. Question:** "Your architecture calls 5 LLMs in parallel. What if you scale to 1,000 users? Won't you hit Groq API rate limits instantly?"
> **Answer:** "Yes, naive `Promise.all` across a large user base will trigger HTTP 429s. To mitigate this locally, I implemented an application-level Rate Limiter restricting users to 50 sessions per hour. Architecturally, the agent calls are grouped into a `BATCH_SIZE`. Currently set to 1, it allows sequential execution of agents if needed to throttle burst requests, while still streaming effectively. If scaling globally, we would implement a Redis queue to manage token concurrency across the server fleet."

**7. Question:** "Why React 18 for this? Why not something lighter?"
> **Answer:** "React 18 introduced automatic batching and concurrent rendering features. Because 5 different SSE streams are aggressively firing state updates every few milliseconds, older frameworks might suffer from layout thrashing or blocked main threads. React 18 batches these rapid `setResults` calls, minimizing DOM repaints and keeping the Sci-Fi UI animations butter-smooth."

**8. Question:** "Explain how you manage state across the Round 1 streaming phase to the Round 2 UI transition."
> **Answer:** "In Round 1, state is ephemeral; it lives in the `results` object mapping agent IDs to string chunks. Once the streams terminate, I bundle that `results` object and POST it to Round 2. When the Round 2 response arrives, I set `sessionData`. The `CouncilRoom` component observes this: if `sessionData` is null, it renders the 5 HoloCards; if `sessionData` exists, it immediately triggers the conditional rendering logic to display the Retractable Workstation UI."

**9. Question:** "What's the purpose of the 'Chairman Router' in Round 2?"
> **Answer:** "It's an implementation of the Strategy Pattern. Not all final synthesis tasks are equal. If the prompt involves heavy calculation, a creative LLM will fail as Chairman. I use a fast classifier LLM to categorize the prompt (e.g., 'MATH'). The router then dynamically swaps the Chairman model to Qwen-32b for logic, or Llama-70B for general tasks, ensuring the final output is generated by the most capable tool for that specific domain."

**10. Question:** "If I run a Cross-Site Scripting (XSS) attack on your Chairman Verdict output, how are you protected?"
> **Answer:** "React inherently sanitizes text by escaping it when rendering variables in JSX. However, because I use `react-markdown` to render the Chairman's output, I also use plugins like `remark-gfm`. If we were rendering raw HTML (`dangerouslySetInnerHTML`), we would use DOMPurify. Currently, by rendering strictly parsed markdown through React's Virtual DOM, any malicious `<script>` tags injected by the LLM are rendered as raw text, not executed code."
