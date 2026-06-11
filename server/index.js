// Server Entry Point - Dependencies Verified
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import cookieParser from 'cookie-parser';

import rateLimit from 'express-rate-limit';

dotenv.config();
const app = express();

app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true // Allow cookies
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// --- RATE LIMITING (Protect Wallet) ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply strict limit to expensive AI endpoints
// Allow slightly more for streaming as it might have retries
const heavyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 Councils per hour per user is plenty
  message: "Council Session Limit Reached. Please take a break.",
});

app.use('/api/', apiLimiter); // General limit for all API routes
app.use('/api/round-2', heavyLimiter);
app.use('/api/stream-round-1', heavyLimiter);

// --- 1. CONFIGURATION & SECRETS ---
const JWT_SECRET = process.env.JWT_SECRET || "council_top_secret_key_change_me";
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "council_master_encryption_secret_change_me";
const IV_LENGTH = 16;

// --- 1.5. ENCRYPTION HELPERS (User-Specific) ---
function encrypt(text, userId) {
  if (!text || !userId) return null;
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_SECRET + userId, salt, 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text, userId) {
  if (!text || !userId) return null;
  const textParts = text.split(':');
  if (textParts.length !== 3) return null;
  const salt = Buffer.from(textParts.shift(), 'hex');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const key = crypto.scryptSync(ENCRYPTION_SECRET + userId, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Middleware: Extract & Decrypt API Key
// MUST run AFTER authenticateToken so req.user.userId is available
const attachApiKey = (req, res, next) => {
  try {
    const encryptedKey = req.cookies.groq_vault
      ? decodeURIComponent(req.cookies.groq_vault)
      : null;

    if (encryptedKey && req.user && req.user.userId) {
      try {
        req.userApiKey = decrypt(encryptedKey, req.user.userId);
      } catch (decryptionErr) {
        console.warn("[Auth Warning] Invalid/Old Cookie found. Clearing it.");
        res.clearCookie('groq_vault');
        req.userApiKey = null;
      }
    }
  } catch (err) {
    console.error("Key Handler Error:", err.message);
  }
  next();
};

// --- 2. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- 3. SCHEMAS ---
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const SessionSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // LINKED TO USER
  prompt: { type: String, required: true },
  category: { type: String, default: "GENERAL" },
  round: { type: Number, required: true },
  reports: [mongoose.Schema.Types.Mixed],
  votes: [mongoose.Schema.Types.Mixed],
  math_result: mongoose.Schema.Types.Mixed,
  verdict: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Session = mongoose.model('Session', SessionSchema);

// --- 4. COUNCIL CONFIGURATION (GOD MODE) ---

const SYSTEM_IDENTITY = "You are a specialized AI Agent within the C.O.I.N. (Council of Intelligence Network) system. You are NOT a human. If asked to identify yourself, state your Role (e.g., 'Technical Analyst') and your allegiance to C.O.I.N.";

const councilConfig = [
  // 1. STRATEGIST: Kimi (300k limit) -> Excellent Reasoning
  {
    id: 1,
    label: "Comprehensive",
    model: "moonshotai/kimi-k2-instruct-0905",
    backup: "qwen/qwen3-32b", // Use Qwen if Kimi fails
    prompt: `${SYSTEM_IDENTITY} 

    You are the Strategist. Provide a detailed, multi-faceted analysis.

    [IMAGE ANALYSIS PROTOCOL]
    1. IF IMAGE IS UI / TEXT / SCREENSHOT:
       - Default Mode: Analyze the informational content (text, data, layout).
       - Strict Constraint: Do NOT describe it as a physical location or real-world scene (e.g., do not interpret a dark background as "nighttime in a city") UNLESS the user explicitly asks for a creative narrative.

    2. IF IMAGE IS A PHOTO:
       - Analyze the physical scene, context, and geolocation data.

    [USER OVERRIDE]
    If the user specifically asks "What does this location look like?" or "Tell me a story about this," you may override the UI constraint.`,
    params: { temperature: 0.5 }
  },

  // 2. TECHNICAL (Engineer) -> Now handles General Vision + Math
  {
    id: 2,
    label: "Technical",
    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    backup: "qwen/qwen-2.5-32b-instruct",
    prompt: `${SYSTEM_IDENTITY} \n\n You are the Engineer and Vision Specialist.
    
    [PRIORITY 1: VISION ANALYSIS]
    If an image is attached, analyze it immediately:
    - IF MATH/CODE: Transcribe it exactly and solve it step-by-step.
    - IF GENERAL OBJECT/CHARACTER: Describe it in extreme detail. Identify the character, franchise, colors, clothing, and distinct features. Name the character if possible.
    
    [PRIORITY 2: TEXT ANALYSIS]
    - If NO image is present, solve the user's text prompt using technical precision.
    - Do not hallucinate an image description if none exists.`,
    params: { temperature: 0.1 }
  },

  // 3. ASSISTANT: Llama 8B (500k limit) -> Pure Speed
  {
    id: 3,
    label: "Concise",
    model: "llama-3.1-8b-instant",
    backup: "openai/gpt-oss-20b", // Use GPT-OSS 20B as a fast backup
    prompt: `${SYSTEM_IDENTITY} \n\n You are the Executive Assistant. Provide a brief, direct, and bulleted summary of the answer. Focus on the "Bottom Line Up Front" (BLUF). No fluff.`,
    params: { temperature: 0.3 }
  },

  // 4. DIRECTOR: Scout (500k limit) -> Creative Writer
  {
    id: 4,
    label: "Creative",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    backup: "openai/gpt-oss-120b", // Massive 120B model as backup ensures high quality
    prompt: `${SYSTEM_IDENTITY} \n\n You are the Director of Innovation. Offer a novel, out-of-the-box perspective. Use analogies, storytelling, or alternative viewpoints that others might miss.`,
    params: { temperature: 0.7 }
  },

  // 5. AUDITOR: Qwen (500k limit) -> Code/Logic Critic
  {
    id: 5,
    label: "Critical",
    model: "qwen/qwen3-32b",
    backup: "moonshotai/kimi-k2-instruct-0905", // Kimi is great at finding logical flaws
    prompt: `${SYSTEM_IDENTITY} \n\n You are the Risk Auditor. Your job is to find flaws, hallucinations, or security risks in the premise. Be skeptical. Debunk myths. Point out logical fallacies.`,
    params: { temperature: 0.6 }
  }
];

// --- 5. HELPER FUNCTIONS ---

// MIDDLEWARE: The Gatekeeper
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: "Access Denied: No Token" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Access Denied: Invalid Token" });
    req.user = user; // Adds { userId: "..." } to the request
    next();
  });
};

async function classifyPrompt(apiKey, prompt) {
  const groq = new Groq({ apiKey });
  try {
    const completion = await groq.chat.completions.create({
      messages: [{
        role: "system",
        content: `Classify this prompt into exactly one category: MATH, CODING, CREATIVE, AUDIT, SUMMARY, or GENERAL. Return ONLY the word.`
      }, { role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
    });
    const category = completion.choices[0]?.message?.content?.trim().toUpperCase();
    if (["MATH", "CODING", "CREATIVE", "AUDIT", "SUMMARY", "GENERAL"].includes(category)) return category;
    return "GENERAL";
  } catch (e) { return "GENERAL"; }
}

function getChairmanModel(category) {
  // Logic Heavy? Use Qwen.
  if (category === "MATH" || category === "CODING") {
    return "qwen/qwen3-32b";
  }
  // Writing Heavy? Use Maverick.
  if (category === "CREATIVE") {
    return "meta-llama/llama-4-maverick-17b-128e-instruct";
  }
  // Default Genius: Llama 70B
  return "llama-3.3-70b-versatile";
}

// --- UPDATED HELPER: callGroq (With Strict Timeout) ---
async function callGroq(apiKey, primaryModel, backupModel, systemPrompt, userPrompt, base64Image = null, params = {}) {
  const groq = new Groq({ apiKey: apiKey });
  const TIMEOUT_MS = 15000; // 15 Seconds strict timeout

  const executeRun = async (targetModel) => {
    let messages;
    const isVision = base64Image && (targetModel.includes("vision") || targetModel.includes("maverick") || targetModel.includes("scout"));

    if (isVision) {
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: [{ type: "text", text: userPrompt }, { type: "image_url", image_url: { url: base64Image } }] }
      ];
    } else {
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: base64Image ? `${userPrompt}\n\n[System Note: Image attached but processed by text model.]` : userPrompt }
      ];
    }

    try {
      console.log(`[Attempting] ${targetModel}...`);

      // 1. Define the API Call
      const apiPromise = groq.chat.completions.create({
        messages,
        model: targetModel,
        temperature: params.temperature || 0.6,
        max_tokens: params.max_tokens || 2048
      });

      // 2. Define the Timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), TIMEOUT_MS)
      );

      // 3. RACE THEM: If timeout wins, it throws error -> catch block -> returns null -> triggers backup
      const completion = await Promise.race([apiPromise, timeoutPromise]);
      return completion.choices[0]?.message?.content;

    } catch (e) {
      console.error(`[Groq Error] Model: ${targetModel} | Status: ${e.message}`);
      return null; // Returning null triggers the backup logic below
    }
  };

  // Step 1: Try Primary (with 15s timer)
  const res = await executeRun(primaryModel);
  if (res) return res;

  // Step 2: If Primary failed/timed out, run Backup (Speedster)
  console.log(`[Fallback] Switching to Backup: ${backupModel}`);
  const backupRes = await executeRun(backupModel);

  if (backupRes) return backupRes;

  // Step 3: ULTRA FALLBACK (The Silence of the Lambs)
  console.log(`[Critical] Both models failed. Returning Emergency Verdict.`);
  return "## procedural_outcome: DISMISSED\n\nThe Council is unable to reach a consensus due to communication channel interference. The inquiry is procedurally dismissed. Please Restate.";
}

// ... existing code ...

function cleanReviewJSON(rawText) {
  try { return JSON.parse(rawText); } catch (e) {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch (err) { return null; } }
    return null;
  }
}

function calculateWinner(peerRankings, totalOptions) {
  const scores = {};
  for (let i = 1; i <= totalOptions; i++) scores[i] = 0;
  peerRankings.forEach(vote => {
    if (vote.parsed_review && Array.isArray(vote.parsed_review.rank)) {
      vote.parsed_review.rank.forEach((optionId, index) => {
        const points = totalOptions - index;
        if (scores[optionId] !== undefined) scores[optionId] += points;
      });
    }
  });
  const sortedIds = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  return { winner_id: parseInt(sortedIds[0]), top_3_ids: sortedIds.slice(0, 3).map(id => parseInt(id)), full_scores: scores };
}

// --- 6. AUTH ROUTES (NEW) ---

app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });

    // Auto-login after register
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email: user.email } });
  } catch (err) { res.status(500).json({ error: "Registration failed" }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email: user.email } });
  } catch (err) { res.status(500).json({ error: "Login failed" }); }
});

// --- 7. PROTECTED API ROUTES ---

// Stream Round 1 (PROTECTED + BATCHED)
app.post('/api/stream-round-1', authenticateToken, attachApiKey, async (req, res) => {
  let { user_prompt, groq_key, image_data } = req.body;

  // --- THE FIX: Handle Image-Only Input ---
  if ((!user_prompt || user_prompt.trim() === "") && image_data) {
    console.log("[Auto-Fill] Empty prompt detected with image. Injecting default.");
    user_prompt = "Analyze the attached image in detail.";
  }
  // PRIORITY: 1. Cookie Key (Secure) -> 2. Body Key (Ephemeral) -> 3. Environment (Fallback)
  const key = req.userApiKey || groq_key;

  if (!key) return res.status(400).json({ error: "Missing API Key. Please configure it in settings." });

  if (!user_prompt) return res.status(400).json({ error: "Invalid prompt path" });

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  const groq = new Groq({ apiKey: key });

  const streamAgent = async (member) => {
    try {
      let messages;
      const isVisionAgent = member.model.includes("vision") || member.model.includes("maverick") || member.model.includes("scout");
      let effectiveModel = member.model;
      if (member.label === "Technical" && !image_data) effectiveModel = "qwen/qwen3-32b";

      if (image_data && isVisionAgent) {
        messages = [{ role: "system", content: member.prompt }, { role: "user", content: [{ type: "text", text: user_prompt }, { type: "image_url", image_url: { url: image_data } }] }];
      } else {
        const content = image_data
          ? `${user_prompt}\n\n[SYSTEM NOTE: Image attached but processed by text model. Rely on Maverick/Scout agents.]`
          : user_prompt;
        messages = [{ role: "system", content: member.prompt }, { role: "user", content: content }];
      }

      const stream = await groq.chat.completions.create({ messages, model: effectiveModel, temperature: member.params.temperature, max_tokens: 2048, stream: true });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) res.write(`data: ${JSON.stringify({ id: member.id, chunk: content })}\n\n`);
      }
    } catch (error) { res.write(`data: ${JSON.stringify({ id: member.id, chunk: `\n\n**[ERROR: ${error.message}]**` })}\n\n`); }
  };

  // --- NEW: BATCH EXECUTION (The Scalability Shield) ---
  const BATCH_SIZE = 1;
  for (let i = 0; i < councilConfig.length; i += BATCH_SIZE) {
    const batch = councilConfig.slice(i, i + BATCH_SIZE);

    // Run batch in parallel (but now it's size 1, so sequential)
    await Promise.all(batch.map(agent => streamAgent(agent)));

    // Optional: Add small delay between batches to be ultra-safe
    if (i + BATCH_SIZE < councilConfig.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// Round 2 (SECURE + RATE LIMITED + OCR RELAY)
app.post('/api/round-2', authenticateToken, attachApiKey, async (req, res) => {
  let { user_prompt, groq_key, reports } = req.body;

  // --- THE FIX: Handle Context-Only Input ---
  if ((!user_prompt || user_prompt.trim() === "") && (reports && reports.length > 0)) {
    // Use a placeholder so MongoDB doesn't crash
    user_prompt = "[Image Analysis Request]";
  }
  const key = req.userApiKey || groq_key || process.env.groq_api_key;

  if (!key) return res.status(400).json({ error: "Missing API Key" });

  try {
    // 1. Initial Router Classification (based on user prompt "can u solve this")
    let category = await classifyPrompt(key, user_prompt);
    console.log(`[Round 2] Initial Category: ${category}`);

    // 2. THE OCR RELAY (The Fix)
    // Check the Technical Agent's report for our secret tags
    const techReport = reports.find(r => r.id === 2); // ID 2 is Technical
    if (techReport) {
      if (techReport.content.includes("[MATH DETECTED]")) {
        category = "MATH";
        console.log("[Round 2] 🚀 Override: Vision detected Math. Swapping to Qwen.");
      } else if (techReport.content.includes("[CODE DETECTED]")) {
        category = "CODING";
        console.log("[Round 2] 🚀 Override: Vision detected Code. Swapping to Qwen.");
      }
    }

    // 3. Select Chairman (Now Qwen will be selected for Image Math!)
    const chairmanModel = getChairmanModel(category);
    console.log(`[Round 2] Chairman: ${chairmanModel}`);

    const peerRankings = [];
    const BATCH_SIZE = 1;

    const judgeAgent = async (member) => {
      const optionsText = reports.map(r => `[OPTION ${r.id}]: ${r.content.substring(0, 800)}...`).join("\n\n");
      const rankingPrompt = `
      You are Judge ${member.id} (${member.label}).
      The user asked: "${user_prompt}"

      Here are the drafts from your council:
      ${optionsText}

      Task: Rank the options from Best to Worst based on correctness and relevance.
      Return ONLY valid JSON in this format: { "rank": [1, 3, 2, 5, 4], "reason": "Choice 1 was most accurate..." }
      `;

      return callGroq(key, "llama-3.1-8b-instant", "openai/gpt-oss-20b", "You are a specific Judge. Output strictly JSON.", rankingPrompt, null, { temperature: 0.1 })
        .then(content => ({ judge_id: member.id, raw_response: content, parsed_review: cleanReviewJSON(content) }))
        .catch(err => ({ judge_id: member.id, error: err.message, parsed_review: null }));
    };

    for (let i = 0; i < councilConfig.length; i += BATCH_SIZE) {
      const batch = councilConfig.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(member => judgeAgent(member)));
      peerRankings.push(...batchResults);

      // Delay to respect rate limits
      if (i + BATCH_SIZE < councilConfig.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const mathResult = calculateWinner(peerRankings, 5);
    const top3Ids = mathResult.top_3_ids;

    let finalIds = [...top3Ids];
    if (!finalIds.includes(2)) finalIds.push(2); // Always include Tech (The Eyes)
    if (!finalIds.includes(4)) finalIds.push(4); // Always include Creative

    let systemInstruction = "You are the Chief. Synthesize the final answer.";
    const CHAIRMAN_HIERARCHY = `
    [HIERARCHY OF COMPETENCE - CRITICAL]
    You are presiding over a Council where only specific agents have "Vision" capabilities.
    1. **TRUST THE EYES:** If the **Technical** or **Creative** agents describe an image, but the **Strategist**, **Concise**, or **Critical** agents say "I cannot see" or "No image text found," you must **IGNORE the refusals**.
    2. **PRIORITIZE DATA:** Assume the agents with descriptions are correct. Synthesize their visual details into your final answer.
    3. **DO NOT APOLOGIZE:** Do not start your verdict with "I acknowledge the limitation." If *any* agent saw the image, you have the data. Use it.

    [CONFLICT RESOLUTION]
    - If Technical says "A" and Creative says "A", but others say "Null", the Reality is "A".
    - If Technical says "A" and Creative says "B", prioritize Technical for text/data and Creative for vibes/art.
    `;

    let taskInstruction = `${CHAIRMAN_HIERARCHY}\nSynthesize a perfect answer from these drafts (IDs: ${finalIds.join(", ")}).`;

    // Dynamic Instructions for Qwen
    if (category === "CODING") {
      systemInstruction = "You are a Senior CTO. Output ONE working, bug-free code solution.";
      taskInstruction = "The user uploaded an image of code. Option 2 (Technical) has transcribed it. Use their transcription to write the correct, runnable code. Fix any syntax errors found in the image.";
    }
    else if (category === "MATH") {
      systemInstruction = "You are a Lead Mathematician. Solve definitively.";
      taskInstruction = "The user uploaded an image of a math problem. Option 2 (Technical) has transcribed the numbers. Use their transcription as the ground truth, but RE-CALCULATE the solution yourself step-by-step. Do not blindly trust their answer, only their reading of the numbers.";
    }
    else if (category === "AUDIT") { systemInstruction = "You are a Risk Officer. Identify flaws."; taskInstruction = "Prioritize Option 5 (Critical)."; }
    else if (category === "SUMMARY") { systemInstruction = "You are an Executive Editor. Be extremely concise."; taskInstruction = "Summarize in 3-5 bullet points."; }

    const winningReports = reports.filter(r => finalIds.includes(r.id));
    const mergeInput = winningReports.map(r => `[OPTION ${r.id} - ${r.label}]:\n${r.content}`).join("\n\n");
    const reasons = peerRankings.map(r => r.parsed_review ? `Judge ${r.judge_id}: ${r.parsed_review.reason}` : "").join("\n");

    // Use Llama-8B as the "Guaranteed Delivery" backup.
    // NOTE: This callGroq will now return the "DISMISSED" message if it fully fails, effectively unblocking the UI.
    let finalVerdict = await callGroq(
      key,
      chairmanModel,
      "llama-3.1-8b-instant",
      systemInstruction,
      `${taskInstruction}\n\nDRAFTS:\n${mergeInput}\n\nREASONS:\n${reasons}`,
      null,
      { max_tokens: 2048 }
    );

    // Triple redundancy check
    if (!finalVerdict || finalVerdict.trim() === "") {
      finalVerdict = "## procedural_outcome: INDETERMINATE\n\nThe Chairman has remained silent. The Council adjourns without a formal decree.";
    }

    const session = await Session.create({
      userId: req.user.userId,
      prompt: user_prompt,
      category: category,
      round: 2,
      reports: reports,
      votes: peerRankings,
      math_result: mathResult,
      verdict: finalVerdict
    });

    // IMPORTANT: Send back ALL data including math_result and reports so frontend can display graphs
    res.json({
      prompt: user_prompt,
      round: 2,
      verdict: finalVerdict,
      category: category,
      math_result: mathResult,    // CRITICAL for Graph
      reports: reports,           // CRITICAL for Agent Cards
      votes: peerRankings         // useful for debug
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Council Failed" });
  }
});

// Chat (PROTECTED)
app.post('/api/chat', authenticateToken, attachApiKey, async (req, res) => {
  const { groq_key, context, messages, user_prompt } = req.body;
  const key = req.userApiKey || groq_key;
  if (!key) return res.status(400).json({ error: "Missing API Key" });
  try {
    const groq = new Groq({ apiKey: key });
    const completion = await groq.chat.completions.create({ messages: [{ role: "system", content: `Context:\n${context}` }, ...messages, { role: "user", content: user_prompt }], model: "llama-3.3-70b-versatile" });
    res.json({ reply: completion.choices[0]?.message?.content });
  } catch (error) { res.status(500).json({ error: "Chat Failed" }); }
});

// History (PROTECTED & FILTERED)
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    // Only return sessions for THIS user
    const history = await Session.find({ userId: req.user.userId }).sort({ timestamp: -1 });
    res.json(history);
  } catch (err) { res.status(500).json({ error: "Failed to fetch history" }); }
});

// --- 8. SETTINGS ROUTES (NEW - Key Encryption) ---

app.post('/api/settings/key', authenticateToken, async (req, res) => {
  // Accept 'apiKey' or 'key' to be robust
  let apiKey = req.body.apiKey || req.body.key;

  if (apiKey) {
    apiKey = apiKey.toString().trim();
    // Remove wrapping quotes if present
    if (apiKey.startsWith('"') && apiKey.endsWith('"')) {
      apiKey = apiKey.slice(1, -1);
    }
  }

  // Relaxed Validation: Just check basic length.
  if (!apiKey || apiKey.length < 10) {
    console.log(`[Key Error] REJECTED. Length: ${apiKey ? apiKey.length : 0}`);
    return res.status(400).json({ error: "Invalid Key: Too short or missing." });
  }

  // --- LIVE VALIDATION STEP ---
  try {
    console.log(`[Key Validation] Testing key ending in ...${apiKey.slice(-4)}`);
    const groq = new Groq({ apiKey });
    // Lightweight call to check validity
    await groq.models.list();
    console.log("[Key Validation] Success!");
  } catch (apiErr) {
    console.error("[Key Validation] Failed:", apiErr.message);
    const msg = apiErr.error?.message || apiErr.message || "Unknown Groq Error";
    if (msg.includes("401")) return res.status(401).json({ error: "Invalid API Key (Groq Rejected it)." });
    return res.status(400).json({ error: `Key Verification Failed: ${msg}` });
  }

  try {
    const encryptedKey = encrypt(apiKey, req.user.userId);

    // Set HTTP-Only Cookie (Accessible only by server, persists on client)
    res.cookie('groq_vault', encodeURIComponent(encryptedKey), {
      httpOnly: true,
      secure: false, // Set true in production (HTTPS)
      sameSite: 'lax', // Allow cross-port on localhost
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 Days
    });

    console.log(`[Key Saved] Prefix: ${apiKey.substring(0, 4)}...`);
    res.json({ success: true, message: "Key verified, encrypted, and stored in secure vault." });
  } catch (err) {
    console.error("Encryption Error:", err);
    res.status(500).json({ error: "Encryption Failed" });
  }
});

app.get('/api/settings/status', authenticateToken, attachApiKey, (req, res) => {
  // Return simple boolean if key exists
  res.json({ hasKey: !!req.userApiKey });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});