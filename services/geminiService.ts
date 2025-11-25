
import { Type } from "@google/genai";
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, Exercise, WorkoutSession, ChatResponse } from '../types';

// =============================================================================
// PROXY CONFIGURATION
// All API requests go through our secure proxy server on Digital Ocean.
// The actual Gemini API key is stored on the proxy server, never exposed to client.
// =============================================================================

// Proxy server URL - all Gemini requests route through here (HTTPS)
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://api.sensei.training';

// Client API key for authenticating with our proxy (NOT the Gemini key)
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY || '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d';

// Model to use
const GEMINI_MODEL = 'gemini-2.5-flash';

// Export for diagnostics
export const currentProxyUrl = PROXY_URL;
export const currentApiKey = '[HIDDEN - stored on proxy server]';

console.log("Gemini Service Init.",
    "Mode: Proxy",
    "Proxy URL:", PROXY_URL
);

// =============================================================================
// PROXY API HELPER
// =============================================================================

interface GenerateContentRequest {
    contents: any;
    generationConfig?: {
        responseMimeType?: string;
        responseSchema?: any;
    };
    systemInstruction?: string;
    tools?: any[];
}

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

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error?.message || error.message || `Proxy error: ${response.status}`);
    }

    return response.json();
}

// Helper to extract text from Gemini response
function extractText(response: any): string {
    return response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Helper to format contents for API
function formatContents(text: string): any {
    return [{ parts: [{ text }] }];
}


const exerciseSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING, description: 'Short instructions on form/technique (1-2 sentences) in Russian' },
        sets: { type: Type.INTEGER },
        reps: { type: Type.STRING, description: 'Range like "8-12" or number "5"' },
        weight: { type: Type.NUMBER, description: 'Starting weight in kg. 0 for bodyweight.' },
        rest: { type: Type.INTEGER, description: 'Rest in seconds' },
    },
    required: ['name', 'description', 'sets', 'reps', 'weight', 'rest'],
};

const exerciseAlternativesSchema = {
    type: Type.OBJECT,
    properties: {
        alternatives: {
            type: Type.ARRAY,
            items: exerciseSchema,
        },
    },
    required: ['alternatives'],
};


const workoutSessionSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: 'e.g., "День 1 - Верх тела"' },
        exercises: {
            type: Type.ARRAY,
            items: exerciseSchema,
        },
    },
    required: ['name', 'exercises'],
};

const trainingProgramSchema = {
    type: Type.OBJECT,
    properties: {
        sessions: {
            type: Type.ARRAY,
            items: workoutSessionSchema,
        },
    },
    required: ['sessions'],
};

// Note: Function declarations for chatbot tools are now inline in getChatbotResponse()

function buildInitialPrompt(profile: OnboardingProfile): string {
    return `
    Ты опытный "ИИ тренер". Создай персонализированную программу тренировок на основе профиля пользователя.
    Программа должна быть структурированной, простой и эффективной.
    
    ВАЖНО: Используй естественный русский язык. Избегай кальки с английского (не пиши "Фулбоди", пиши "Тренировка на все тело" или "Круговая").
    Для каждого упражнения добавь поле "description" с коротким описанием техники (1-2 предложения), чтобы пользователь понял, что делать.
    Ответ должен быть JSON объектом, соответствующим схеме.

    Профиль пользователя:
    - Пол: ${profile.gender}
    - Возраст: ${profile.age}
    - Вес: ${profile.weight} кг
    - Опыт: ${profile.experience}
    - Главная цель: ${profile.goals.primary}
    - Дней в неделю: ${profile.daysPerWeek}
    - Время на тренировку: ${profile.timePerWorkout} минут
    - Оборудование: ${profile.location}
    - Интенсивность: ${profile.intensity}
    - Травмы/Ограничения: ${profile.hasInjuries ? profile.injuries : 'Нет'}

    Правила составления:
    1. Сплит (структура):
        - 2-3 дня: Тренировка на все тело (Full Body) или Круговая.
        - 4 дня: Верх / Низ.
        - 5 дней: Жим / Тяга / Ноги (Push/Pull/Legs) или сплит по группам мышц.
    2. Выбор упражнений:
        - Приоритет базовым многосуставным движениям.
        - Учитывай оборудование (${profile.location}). Если "Дома", используй собственный вес, гантели или резинки.
        - Учитывай травмы (${profile.injuries}). Избегай упражнений, нагружающих больные зоны.
    3. Объем:
        - Новички: 2-3 подхода, 8-12 повторов. Акцент на технику.
        - Продвинутые: 3-5 подходов, периодизация.
    4. Вес:
        - Стартовые веса в КГ (консервативно).

    Сгенерируй программу в формате JSON на русском языке.
    `;
}

function buildAdaptationPrompt(currentProgram: TrainingProgram, logs: WorkoutLog[]): string {
    const recentLogs = logs.slice(-3);
    return `
    Ты эксперт "ИИ тренер". Адаптируй текущую программу пользователя на основе его последних тренировок.
    Используй принцип прогрессивной перегрузки.
    Ответ должен быть JSON объектом (вся обновленная программа) на РУССКОМ языке.
    Не забудь сохранить или обновить поле "description" для упражнений.

    Текущая программа:
    ${JSON.stringify(currentProgram, null, 2)}

    Последние логи (RIR - повторения в запасе):
    ${JSON.stringify(recentLogs, null, 2)}

    Правила адаптации:
    1. Запас повторений (RIR):
        - RIR 3+: Слишком легко -> Увеличь вес на 2.5-5%.
        - RIR 1-2: Оптимально -> Оставь вес или минимальный прогресс.
        - RIR 0 (Отказ): Тяжело -> Снизь вес или оставь тот же.
    2. Дискомфорт:
       - Если пользователь отметил боль, замени упражнение на биомеханически более комфортный аналог.
    3. Структура:
       - Не меняй название дней без причины, корректируй нагрузку.

    Сгенерируй адаптированную программу JSON на русском.
    `;
}

function buildModificationPrompt(currentProgram: TrainingProgram, reason: string, instructions: string): string {
    return `
    Ты "ИИ тренер". Пользователь попросил изменить программу тренировок в чате.
    Причина: "${reason}"
    Инструкции: "${instructions}"

    Текущая программа (JSON):
    ${JSON.stringify(currentProgram, null, 2)}

    ЗАДАЧА:
    1. Измени программу, строго следуя инструкциям пользователя.
    2. Если есть жалоба на боль (например, поясница), замени опасные упражнения на безопасные аналоги (например, убери становую тягу или скручивания, замени на планку или гиперэкстензию без веса).
    3. Обязательно добавь короткое описание техники ("description") для новых упражнений.
    4. Верни ПОЛНЫЙ обновленный JSON объект программы.

    Язык: Русский.
    `;
}


function buildCoachFeedbackPrompt(profile: OnboardingProfile, log: WorkoutLog): string {
    return `
    Ты "ИИ тренер" - умный помощник.
    Пользователь закончил тренировку. Дай короткий, живой комментарий (2-3 предложения) на РУССКОМ языке.
    
    Контекст:
    - Цель: ${profile.goals.primary}
    - Тренировка: ${log.sessionId}
    - Выполнение: ${log.feedback.completion}
    - Боль/Дискомфорт: ${log.feedback.pain.hasPain ? `Да - ${log.feedback.pain.details}` : 'Нет'}
    - Запас сил (RIR): ${log.completedExercises.some(e => e.completedSets.some(s => s.rir === 0)) ? 'Работал в отказ' : 'Остался запас'}

    Стиль:
    - Профессиональный, но дружелюбный.
    - Используй правильную терминологию.
    - Если была боль, посоветуй быть осторожнее и прислушиваться к телу.
    `;
}

function buildExerciseSwapPrompt(exerciseToSwap: Exercise, session: WorkoutSession, profile: OnboardingProfile): string {
    return `
    Ты "ИИ тренер". Пользователь хочет заменить упражнение "${exerciseToSwap.name}".
    Предложи 3-4 альтернативы на РУССКОМ языке.
    Альтернативы должны работать на ту же мышечную группу и подходить под оборудование: ${profile.location}.
    Для каждого варианта добавь короткое описание техники ("description").
    
    Избегай кальки (не "Lat Pulldown", а "Тяга верхнего блока").

    Сгенерируй JSON с альтернативами.
    `;
}

function buildDashboardInsightPrompt(profile: OnboardingProfile, logs: WorkoutLog[]): string {
    const recentLogs = logs.slice(-5);
    return `
    Ты персональный "ИИ тренер".
    Проанализируй прогресс пользователя и дай одну емкую фразу для главного экрана.
    
    Данные:
    - Уровень: ${profile.experience}
    - Тренировок всего: ${logs.length}
    - Последняя активность: ${recentLogs.length > 0 ? recentLogs[recentLogs.length-1].date : 'Давно'}
    - Оценка готовности (Readiness): ${recentLogs.length > 0 ? recentLogs[recentLogs.length-1].feedback.readiness?.score : 'Нет данных'}
    
    Задача:
    1. Если пользователь тренируется регулярно -> Похвали за ритм ("Отличный темп", "Ты в режиме").
    2. Если перерыв -> Мягко позови назад ("Давно не виделись, давай начнем с легкой").
    3. Если только начал -> Подбодри ("Начало положено").
    
    Язык: Естественный русский, 2-3 предложения. Можно 1 эмодзи.
    `;
}

export const getExerciseAlternatives = async (exercise: Exercise, session: WorkoutSession, profile: OnboardingProfile): Promise<Exercise[]> => {
    const prompt = buildExerciseSwapPrompt(exercise, session, profile);
    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: formatContents(prompt),
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: exerciseAlternativesSchema,
        },
    });
    const jsonText = extractText(response).trim();
    const result = JSON.parse(jsonText) as { alternatives: Exercise[] };
    return result.alternatives;
};


export const generateInitialPlan = async (profile: OnboardingProfile): Promise<TrainingProgram> => {
    const prompt = buildInitialPrompt(profile);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: formatContents(prompt),
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response).trim();
    return JSON.parse(jsonText) as TrainingProgram;
};


export const adaptPlan = async (currentProgram: TrainingProgram, logs: WorkoutLog[]): Promise<TrainingProgram> => {
    const prompt = buildAdaptationPrompt(currentProgram, logs);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: formatContents(prompt),
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response).trim();
    return JSON.parse(jsonText) as TrainingProgram;
};

// Internal helper to actually rewrite the JSON
const modifyPlanWithInstructions = async (currentProgram: TrainingProgram, reason: string, instructions: string): Promise<TrainingProgram> => {
    const prompt = buildModificationPrompt(currentProgram, reason, instructions);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: formatContents(prompt),
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response).trim();
    return JSON.parse(jsonText) as TrainingProgram;
};

export const getCoachFeedback = async (profile: OnboardingProfile, log: WorkoutLog): Promise<string> => {
    const prompt = buildCoachFeedbackPrompt(profile, log);
    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: formatContents(prompt),
    });
    return extractText(response);
};

export const getDashboardInsight = async (profile: OnboardingProfile, logs: WorkoutLog[]): Promise<string> => {
    const prompt = buildDashboardInsightPrompt(profile, logs);
    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: formatContents(prompt),
    });
    return extractText(response);
};

export const getChatbotResponse = async (history: ChatMessage[], currentProgram: TrainingProgram): Promise<ChatResponse> => {
    // 1. Extract the new user message (last element)
    const newMessage = history[history.length - 1];

    // 2. Format the previous history for API
    const historyContent = history.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    // 3. System instruction with context awareness
    const systemInstruction = `
    Ты дружелюбный "ИИ тренер". Твоя задача - помогать пользователю с тренировками, питанием и мотивацией.
    Ты имеешь доступ к текущей программе тренировок пользователя.

    ВАЖНО: Если пользователь жалуется на боль, травму (например, "болит спина") или просит изменить упражнения ("убери приседания"),
    ТЫ ОБЯЗАН использовать инструмент 'update_workout_plan'.
    Не просто давай советы, а реально меняй план через этот инструмент.

    Отвечай на естественном РУССКОМ языке.

    Текущая программа пользователя:
    ${JSON.stringify(currentProgram, null, 2)}
    `;

    // 4. Build contents with history + new message
    const contents = [
        ...historyContent,
        { role: 'user', parts: [{ text: newMessage.text }] }
    ];

    // 5. Make API call with tools
    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents,
        systemInstruction,
        tools: [{
            functionDeclarations: [{
                name: "update_workout_plan",
                description: "Call this function when the user wants to modify their workout plan, has an injury (like back pain), or wants to swap/remove exercises.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        reason: { type: "STRING", description: "The reason for the change (e.g., 'lower back pain', 'no gym equipment')." },
                        instructions: { type: "STRING", description: "Specific details on what to change (e.g., 'remove crunches', 'replace squats with leg press')." }
                    },
                    required: ["reason", "instructions"]
                }
            }]
        }]
    });

    // 6. Handle Function Calls
    const candidate = response?.candidates?.[0];
    const functionCall = candidate?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;

    if (functionCall && functionCall.name === 'update_workout_plan') {
        const args = functionCall.args as { reason: string, instructions: string };

        // Perform the actual program modification
        const updatedProgram = await modifyPlanWithInstructions(currentProgram, args.reason, args.instructions);

        // Generate acknowledgment text
        const ackResponse = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
            contents: formatContents(`Ты только что обновил программу тренировок пользователя по причине: "${args.reason}". Кратко (1-2 предложения) подтверди это на русском языке.`),
        });

        return {
            text: extractText(ackResponse) || 'Программа обновлена!',
            updatedProgram: updatedProgram
        };
    }

    return { text: extractText(response) };
}
