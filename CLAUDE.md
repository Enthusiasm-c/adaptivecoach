# AdaptiveCoach - Claude Code Instructions

## CRITICAL: Proxy Configuration for Gemini API

**ALWAYS use proxy-based API calls in `services/geminiService.ts`**

The app routes all Gemini API requests through our secure proxy server on Digital Ocean.
The actual Gemini API key is stored on the proxy server, never exposed to client.

### Proxy Architecture

```
User (Telegram Mini App)
    ↓
https://api.sensei.training (Nginx reverse proxy)
    ↓
Docker container (port 3003) - Node.js Express
    ↓
https://generativelanguage.googleapis.com (Gemini API)
```

### Required Code Pattern

When the user updates frontend and accidentally changes `geminiService.ts` to SDK-based approach, **ALWAYS restore the proxy-based pattern**:

```typescript
// CORRECT - Proxy approach (ALWAYS USE THIS)
import { Type } from "@google/genai";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://api.sensei.training';
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY || '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d';
const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGeminiProxy(endpoint: string, body: GenerateContentRequest): Promise<any> {
    const url = `${PROXY_URL}/api/gemini${endpoint}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': CLIENT_API_KEY
        },
        body: JSON.stringify(body)
    });
    // ...
}

// API calls use:
const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, { ... });
```

```typescript
// WRONG - SDK approach (DO NOT USE)
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: ..., baseUrl: ... });
const response = await ai.models.generateContent({ ... });
```

### Why Proxy is Required

1. **Security**: API key hidden on server, not exposed in client bundle
2. **Geo-restrictions**: Bypass regional blocks for Gemini API
3. **Rate limiting**: Server-side control over API usage
4. **Logging**: All requests logged for debugging

### Server Details

- **Proxy Server**: 178.128.102.253
- **Domain**: api.sensei.training
- **SSL**: Let's Encrypt (auto-renewed)
- **Docker**: Port 3003
- **SSH alias**: `ssh adaptivecoach-proxy`

### When User Updates Frontend

1. Pull changes: `git pull`
2. Check if `services/geminiService.ts` was modified
3. If it uses `GoogleGenAI` SDK directly → **restore proxy version**
4. Keep any new prompts/functions the user added
5. Commit and push the fixed version

## Project Structure

- `/services/geminiService.ts` - AI integration (PROXY ONLY!)
- `/components/` - React components (user edits these)
- `/types.ts` - TypeScript types
- `/utils/` - Utility functions

## Prompts

User may update prompts in `geminiService.ts`. When restoring proxy logic, **preserve all prompt functions** (buildInitialPrompt, buildAdaptationPrompt, etc.) - only change the API call mechanism.
