# AdaptiveCoach - Telegram Mini App

## КРИТИЧЕСКИ ВАЖНО: Proxy Architecture

### Проблема
Пользователь работает над фронтендом в своем редакторе и периодически случайно меняет `services/geminiService.ts` с proxy-подхода на SDK-подход. **ВСЕГДА проверяй этот файл при pull и восстанавливай proxy-логику!**

### Правильный подход (PROXY)
```typescript
import { Type } from "@google/genai";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://api.sensei.training';
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY || '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d';
const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGeminiProxy(endpoint: string, body: any): Promise<any> {
    const url = `${PROXY_URL}/api/gemini${endpoint}`;

    // Normalize string contents to proper format
    let normalizedBody = { ...body };
    if (typeof body.contents === 'string') {
        normalizedBody.contents = [{ role: 'user', parts: [{ text: body.contents }] }];
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': CLIENT_API_KEY
        },
        body: JSON.stringify(normalizedBody)
    });
    // ...
}

// Вызовы API:
const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, { ... });
```

### НЕПРАВИЛЬНЫЙ подход (SDK) - НЕ ИСПОЛЬЗОВАТЬ!
```typescript
// НЕ ДЕЛАЙ ТАК:
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI(clientOptions);
const response = await ai.models.generateContent(...);
```

### Почему Proxy?
1. **Безопасность** - API ключ Gemini хранится только на сервере
2. **Контроль** - можно логировать, лимитировать, кэшировать запросы
3. **Telegram Mini App** - прямые запросы к Gemini API блокируются CORS

### Архитектура
```
User (Telegram) → Frontend → api.sensei.training (Nginx) → Docker:3003 → Gemini API
```

### При каждом pull/обновлении
1. Проверь `services/geminiService.ts`
2. Если видишь `GoogleGenAI` или `ai.models.generateContent` - это НЕПРАВИЛЬНО
3. Восстанови `callGeminiProxy()` подход
4. Сохрани любые новые промпты/схемы которые добавил пользователь

### Сервер
- Proxy URL: `https://api.sensei.training`
- Digital Ocean: `178.128.102.253`
- Docker container на порту 3003
- Client API Key: `9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d`

## Telegram Mini App - Отладка
- **НЕ ПРЕДЛАГАЙ DevTools/Console** - Mini App работает внутри Telegram, не в браузере
- Для отладки создавай видимые UI компоненты (debug panels, toast notifications)
- `console.log()` бесполезен - пользователь его не увидит
