# Client Integration Guide

## How to Update AdaptiveCoach to Use the Proxy

### 1. Environment Variables

Add to your `.env.local`:

```env
VITE_PROXY_URL=https://api.adaptivecoach.app
# or for direct IP access (no SSL):
# VITE_PROXY_URL=http://209.38.85.196:3001

VITE_CLIENT_API_KEY=your_client_api_key_from_server
```

### 2. Update geminiService.ts

Replace direct Gemini API calls with proxy calls:

```typescript
// OLD: Direct to Gemini
const API_KEY = import.meta.env.VITE_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

// NEW: Through your proxy
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://209.38.85.196:3001';
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY;

const url = `${PROXY_URL}/api/gemini/v1beta/models/gemini-pro:generateContent`;

// Add authentication header
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': CLIENT_API_KEY  // Authenticate with proxy
  },
  body: JSON.stringify(requestBody)
});
```

### 3. Full Example - Updated API Helper

```typescript
// src/services/apiClient.ts

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://209.38.85.196:3001';
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY;

interface ApiOptions {
  method?: 'GET' | 'POST';
  body?: object;
}

export async function callGeminiAPI(endpoint: string, options: ApiOptions = {}) {
  const url = `${PROXY_URL}/api/gemini${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CLIENT_API_KEY
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

export async function callOpenAIAPI(endpoint: string, options: ApiOptions = {}) {
  const url = `${PROXY_URL}/api/openai${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CLIENT_API_KEY
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}
```

### 4. Usage Example

```typescript
// Generate content through proxy
const result = await callGeminiAPI('/v1beta/models/gemini-pro:generateContent', {
  body: {
    contents: [{
      parts: [{
        text: "Create a workout plan for a beginner"
      }]
    }]
  }
});
```

## Security Benefits

1. **API Keys Hidden**: Gemini/OpenAI keys stay on your server, never exposed to client
2. **Rate Limiting**: Prevents abuse with 30 req/min per IP
3. **Request Logging**: All requests logged for monitoring
4. **CORS Protection**: Only allows requests from your app domain
5. **Client Authentication**: X-API-Key header validates legitimate requests

## Endpoint Mapping

| Original Endpoint | Proxy Endpoint |
|-------------------|----------------|
| `https://generativelanguage.googleapis.com/v1beta/...` | `https://api.adaptivecoach.app/api/gemini/v1beta/...` |
| `https://api.openai.com/v1/...` | `https://api.adaptivecoach.app/api/openai/v1/...` |
