const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
require('dotenv').config({path: path.join(__dirname, '.env')});

const groq = new Groq({ apiKey: process.env.groq_api_key });

async function commentFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const systemPrompt = `You are an expert coder. Add a brief, 1-line inline comment explaining EVERY SINGLE line of code in the following file. Do not change the original code, only add comments above every line. Return ONLY the fully commented code, no markdown blocks. Do not wrap in markdown or anything. Start directly with the code.`;
    
    console.log('Commenting ' + filePath + '...');
    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: code }],
            model: 'llama-3.1-8b-instant',
            temperature: 0.1
        });
        
        let res = completion.choices[0].message.content;
        if(res.startsWith('```')) {
            res = res.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
        }
        fs.writeFileSync(filePath, res);
        console.log('Done: ' + filePath);
    } catch (err) {
        console.error('Failed on ' + filePath + ': ' + err.message);
    }
}

async function run() {
    // We are in server/
    const pages = ['Landing.jsx', 'Dashboard.jsx', 'CouncilRoom.jsx'];
    for(const p of pages) {
        await commentFile(path.join(__dirname, '../client/src/pages', p));
    }
    
    // Components
    const componentsDir = path.join(__dirname, '../client/src/components');
    const files = fs.readdirSync(componentsDir);
    for (const file of files) {
        if (file.endsWith('.jsx')) {
            await commentFile(path.join(componentsDir, file));
        }
    }

    // Server
    const serverPath = path.join(__dirname, 'index.js');
    await commentFile(serverPath);
}

run().catch(console.error);
