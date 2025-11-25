
import { Type } from "@google/genai";
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, Exercise, WorkoutSession, ChatResponse, ActivityLevel } from '../types';

// ============================================
// PROXY CONFIGURATION - DO NOT CHANGE TO SDK!
// ============================================
// This app uses a secure proxy server to call Gemini API.
// The proxy hides the real API key and bypasses geo-restrictions.
// NEVER use GoogleGenAI SDK directly - it exposes the API key!

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://api.sensei.training';
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY || '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d';
const GEMINI_MODEL = 'gemini-2.5-flash';

// Export for diagnostics
export const currentApiKey = CLIENT_API_KEY;
export const currentProxyUrl = PROXY_URL;

// Types for Gemini API
interface GenerateContentRequest {
    contents: string | { role: string; parts: { text: string }[] }[];
    generationConfig?: {
        responseMimeType?: string;
        responseSchema?: any;
    };
    systemInstruction?: string | { parts: { text: string }[] };
    tools?: any[];
}

interface GeminiResponse {
    candidates?: {
        content?: {
            parts?: { text?: string; functionCall?: { name: string; args: any } }[];
        };
    }[];
}

/**
 * Call Gemini API through secure proxy
 */
async function callGeminiProxy(endpoint: string, body: GenerateContentRequest): Promise<GeminiResponse> {
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
        const errorText = await response.text();
        throw new Error(`Proxy error ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * Extract text from Gemini response
 */
function extractText(response: GeminiResponse): string {
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Extract function call from Gemini response
 */
function extractFunctionCall(response: GeminiResponse): { name: string; args: any } | null {
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.functionCall) {
        return part.functionCall;
    }
    return null;
}

// ============================================
// SCHEMAS
// ============================================

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
        name: { type: Type.STRING, description: 'Descriptive name (e.g., "День 1 - Верх тела (Грудь/Спина)" or "Full Body: Сила")' },
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

// --- Function Definitions for Chatbot Tools ---
const updatePlanTool = {
    name: "update_workout_plan",
    description: "Call this function when the user wants to modify their workout plan, has an injury (like back pain), or wants to swap/remove exercises.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            reason: { type: Type.STRING, description: "The reason for the change (e.g., 'lower back pain', 'no gym equipment')." },
            instructions: { type: Type.STRING, description: "Specific details on what to change (e.g., 'remove crunches', 'replace squats with leg press')." }
        },
        required: ["reason", "instructions"]
    }
};

function buildInitialPrompt(profile: OnboardingProfile): string {
    const bmi = profile.height ? (profile.weight / ((profile.height / 100) ** 2)).toFixed(1) : "Неизвестно";
    const weightDiff = profile.targetWeight ? (profile.targetWeight - profile.weight) : 0;
    const goalContext = weightDiff < 0
        ? `Пользователь хочет похудеть на ${Math.abs(weightDiff).toFixed(1)} кг.`
        : weightDiff > 0
            ? `Пользователь хочет набрать ${weightDiff.toFixed(1)} кг.`
            : 'Поддержание веса.';

    // Convert day indices to strings
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const preferredDaysStr = (profile.preferredDays || [])
        .sort()
        .map(d => dayNames[d])
        .join(', ');

    return `
    Ты опытный "ИИ тренер". Создай персонализированную программу тренировок на основе детального профиля.
    Программа должна быть структурированной, простой и эффективной, учитывая физические параметры.

    Профиль пользователя:
    - Пол: ${profile.gender}
    - Возраст: ${profile.age}
    - Текущий вес: ${profile.weight} кг (BMI: ${bmi})
    - Цель (вес): ${profile.targetWeight ? `${profile.targetWeight} кг` : 'Не указан'} (${goalContext})
    - Уровень активности (вне зала): ${profile.activityLevel}
    - Опыт: ${profile.experience}
    - Главная цель: ${profile.goals.primary}
    - Планирует тренироваться в дни: ${preferredDaysStr} (Всего ${profile.daysPerWeek} раз в неделю)
    - Время на тренировку: ${profile.timePerWorkout} минут
    - Оборудование: ${profile.location}
    - Травмы/Ограничения: ${profile.hasInjuries ? profile.injuries : 'Нет'}

    ВАЖНО:
    1. Учти выбранные дни недели при составлении сплита.
       - Если дни идут подряд (например, Пн и Вт), используй сплит Верх/Низ или разные группы мышц, чтобы избежать переутомления.
       - Если между днями есть отдых (Пн, Ср, Пт), подойдет Фулбоди.
    2. Если активность "Сидячая", добавь больше упражнений на осанку и core (ядро).
    3. Если цель похудение, увеличь плотность тренировки (суперсеты или короткий отдых).
    4. Используй естественный русский язык. Избегай кальки с английского.
    5. Для каждого упражнения добавь поле "description" с коротким описанием техники.

    Правила составления:
    1. Сплит (структура):
        - Адаптируй под указанные дни недели.
        - Названия сессий ("name") должны быть информативными. ПРИМЕР: "Верх тела (Грудь/Спина)" или "Фулбоди (Акцент на ноги)".
    2. Выбор упражнений:
        - Приоритет базовым движениям.
        - Учитывай оборудование: ${profile.location}.
    3. Объем:
        - Новички: 2-3 подхода, акцент на технику.
        - Если есть лишний вес (BMI > 25), предложи кардио-заминку (ходьба в гору) в конце сессии.

    Сгенерируй программу в формате JSON.
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
    - Вес: ${profile.weight}
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
    - Цель: ${profile.goals.primary}
    - Тренировок всего: ${logs.length}
    - Последняя активность: ${recentLogs.length > 0 ? recentLogs[recentLogs.length-1].date : 'Давно'}
    - Оценка готовности (Readiness): ${recentLogs.length > 0 ? recentLogs[recentLogs.length-1].feedback.readiness?.score : 'Нет данных'}

    Задача:
    1. Если пользователь тренируется регулярно -> Похвали за ритм.
    2. Если перерыв -> Мягко позови назад.
    3. Если только начал -> Подбодри.

    Язык: Естественный русский, 2-3 предложения. Можно 1 эмодзи.
    `;
}

// ============================================
// API FUNCTIONS - Using Proxy
// ============================================

export const getExerciseAlternatives = async (exercise: Exercise, session: WorkoutSession, profile: OnboardingProfile): Promise<Exercise[]> => {
    const prompt = buildExerciseSwapPrompt(exercise, session, profile);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: exerciseAlternativesSchema,
        },
    });

    const jsonText = extractText(response);
    const result = JSON.parse(jsonText) as { alternatives: Exercise[] };
    return result.alternatives;
};


export const generateInitialPlan = async (profile: OnboardingProfile): Promise<TrainingProgram> => {
    const prompt = buildInitialPrompt(profile);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response);
    return JSON.parse(jsonText) as TrainingProgram;
};


export const adaptPlan = async (currentProgram: TrainingProgram, logs: WorkoutLog[]): Promise<TrainingProgram> => {
    const prompt = buildAdaptationPrompt(currentProgram, logs);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response);
    return JSON.parse(jsonText) as TrainingProgram;
};

// Internal helper to actually rewrite the JSON
const modifyPlanWithInstructions = async (currentProgram: TrainingProgram, reason: string, instructions: string): Promise<TrainingProgram> => {
    const prompt = buildModificationPrompt(currentProgram, reason, instructions);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response);
    return JSON.parse(jsonText) as TrainingProgram;
};

export const getCoachFeedback = async (profile: OnboardingProfile, log: WorkoutLog): Promise<string> => {
    const prompt = buildCoachFeedbackPrompt(profile, log);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
    });

    return extractText(response);
};

export const getDashboardInsight = async (profile: OnboardingProfile, logs: WorkoutLog[]): Promise<string> => {
    const prompt = buildDashboardInsightPrompt(profile, logs);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
    });

    return extractText(response);
};

export const getChatbotResponse = async (history: ChatMessage[], currentProgram: TrainingProgram): Promise<ChatResponse> => {
    // 1. Extract the new user message (last element)
    const newMessage = history[history.length - 1];

    // 2. Format the previous history
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
    `;

    // 4. Build contents with history + new message
    const contents = [
        ...historyContent,
        { role: 'user', parts: [{ text: newMessage.text }] }
    ];

    // 5. Make the API call with tools
    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ functionDeclarations: [updatePlanTool] }]
    });

    // 6. Handle Function Calls
    const functionCall = extractFunctionCall(response);
    if (functionCall && functionCall.name === 'update_workout_plan') {
        const args = functionCall.args as { reason: string, instructions: string };

        // Perform the actual program modification using a separate robust call
        const updatedProgram = await modifyPlanWithInstructions(currentProgram, args.reason, args.instructions);

        // Return a response indicating success + the new object
        // Send tool result back for acknowledgment
        const toolResultResponse = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
            contents: [
                ...contents,
                { role: 'model', parts: [{ functionCall: functionCall }] },
                { role: 'user', parts: [{ functionResponse: { name: 'update_workout_plan', response: { result: 'Program updated successfully.' } } }] }
            ],
            systemInstruction: { parts: [{ text: systemInstruction }] },
        });

        return {
            text: extractText(toolResultResponse),
            updatedProgram: updatedProgram
        };
    }

    return { text: extractText(response) };
}
