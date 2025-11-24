
/**
 * GEMINI API PROXY SERVER
 * 
 * Deploy this file to your Digital Ocean / VPS server.
 * Requires: npm install express cors node-fetch dotenv
 * 
 * Usage:
 * 1. Set environment variable API_KEY with your Google Gemini Key.
 * 2. Start server (node index.js).
 * 3. Point your frontend VITE_PROXY_URL to this server.
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Ensure you use node-fetch v2 or v3
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com';

// Enable CORS for your frontend
app.use(cors());

// Parse JSON bodies (Gemini API sends JSON)
app.use(express.json({ limit: '10mb' }));

// Middleware to inject API Key
const injectApiKey = (req, res, next) => {
    // We assume the real API key is stored on the server environment
    const serverKey = process.env.API_KEY;
    if (!serverKey) {
        console.error("Server API_KEY is missing");
        return res.status(500).json({ error: "Server configuration error: API Key missing" });
    }
    req.apiKey = serverKey;
    next();
};

// Proxy Handler
app.use('/', injectApiKey, async (req, res) => {
    try {
        const targetUrl = new URL(req.path, GOOGLE_BASE_URL);
        
        // Append the API Key to the query parameters
        targetUrl.searchParams.append('key', req.apiKey);
        
        // Forward any existing query params from the client (except key if they sent one)
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== 'key') {
                targetUrl.searchParams.append(key, value);
            }
        }

        console.log(`[Proxy] Forwarding ${req.method} to ${targetUrl.pathname}`);

        const response = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                // Don't forward host headers
            },
            body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
        });

        // Copy status
        res.status(response.status);

        // Forward headers (content-type is important for streams)
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }

        // Handle streaming response vs regular JSON
        if (contentType && contentType.includes('text/event-stream')) {
            response.body.pipe(res);
        } else {
            const data = await response.json();
            res.json(data);
        }

    } catch (error) {
        console.error("[Proxy Error]", error);
        res.status(500).json({ error: "Proxy request failed", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Targeting: ${GOOGLE_BASE_URL}`);
});
