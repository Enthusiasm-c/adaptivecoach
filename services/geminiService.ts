
import { Type } from "@google/genai";
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, Exercise, WorkoutSession, ChatResponse, ActivityLevel, StrengthInsightsData, Gender, CompletedExercise } from '../types';

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
    contents: string | {
        role: string;
        parts: {
            text?: string;
            functionCall?: { name: string; args: any };
            functionResponse?: { name: string; response: any };
        }[]
    }[];
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

    // Normalize contents: if it's a string, wrap it in proper format
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
        exerciseType: {
            type: Type.STRING,
            enum: ['strength', 'bodyweight', 'cardio', 'isometric'],
            description: 'strength=weighted exercises (bench, squat), bodyweight=pushups/pullups, cardio=walking/running, isometric=plank/hold'
        },
        description: { type: Type.STRING, description: 'Short instructions on form/technique (1-2 sentences) in Russian' },
        sets: { type: Type.INTEGER },
        reps: { type: Type.STRING, description: 'Range like "8-12" or number "5" or "60" for seconds' },
        weight: { type: Type.NUMBER, description: 'Starting weight in kg. Set 0 for bodyweight/cardio/isometric exercises.' },
        rest: { type: Type.INTEGER, description: 'Rest in seconds' },
    },
    required: ['name', 'exerciseType', 'description', 'sets', 'reps', 'weight', 'rest'],
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

    const knownWeightsStr = profile.knownWeights && profile.knownWeights.length > 0
        ? profile.knownWeights.map(w => `${w.exercise}: ${w.weight}кг`).join(', ')
        : 'Нет данных';

    return `
    Ты опытный "ИИ тренер". Создай персонализированную программу тренировок на основе детального профиля.
    Обращайся к пользователю на "Ты". Будь дружелюбным, но требовательным.
    Программа должна быть структурированной, простой и эффективной.

    Профиль пользователя:
    - Пол: ${profile.gender}
    - Возраст: ${profile.age}
    - Текущий вес: ${profile.weight} кг (BMI: ${bmi})
    - Цель (вес): ${profile.targetWeight ? `${profile.targetWeight} кг` : 'Не указан'} (${goalContext})
    - Уровень активности (вне зала): ${profile.activityLevel}
    - Опыт: ${profile.experience}
    - Последняя тренировка: ${profile.lastWorkout || 'Неизвестно'}
    - Известные рабочие веса: ${knownWeightsStr}
    - Главная цель: ${profile.goals.primary}
    - Планирует тренироваться в дни: ${preferredDaysStr} (Всего ${profile.daysPerWeek} раз в неделю)
    - Время на тренировку: ${profile.timePerWorkout} минут
    - Оборудование: ${profile.location}
    - Травмы/Ограничения: ${profile.hasInjuries ? profile.injuries : 'Нет'}

    ВАЖНО:
    1. Учти выбранные дни недели при составлении сплита.
       - Если дни идут подряд (например, Пн и Вт), используй сплит Верх/Низ или разные группы мышц.
       - Если между днями есть отдых (Пн, Ср, Пт), подойдет Фулбоди.
    2. Если активность "Сидячая", добавь больше упражнений на осанку и core.
    3. Если цель похудение, увеличь плотность тренировки (суперсеты или короткий отдых).
    4. Используй естественный русский язык. Избегай кальки с английского.
    5. Для каждого упражнения добавь поле "description" с коротким описанием техники.
    6. Если указаны "Известные рабочие веса", используй их как ориентир для стартовых весов в похожих упражнениях (например, если Жим лежа 80кг, то Жим гантелей ~30-32кг).
    7. Если "Последняя тренировка" была давно (> 3 месяцев), снизь интенсивность и веса для втягивания (Intro week).

    Правила составления:
    1. Сплит (структура):
        - Адаптируй под указанные дни недели.
        - Названия сессий ("name") НЕ должны содержать дни недели (Пн, Вт, Monday и т.д.).
        - Используй названия типа: "День 1 - Верх тела", "День 2 - Низ тела", "Full Body A".
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
    Обращайся к пользователю на "Ты".
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
    2. ВАЖНО - Боль/Дискомфорт (приоритетное правило):
       - Первичная боль: СНАЧАЛА снизь вес на 15-20% для упражнения на эту мышечную группу
       - Повторная боль (в том же месте): Замени упражнение на более безопасный аналог
       - Если RIR=0 и была боль: Снизь вес на 25% - вес точно слишком тяжелый
       - Если RIR>2 и была боль: Проблема в технике, добавь разминочные подходы
       - Боль в суставе: Замени на упражнение с меньшей амплитудой или свободным весом
    3. Структура:
       - Не меняй название дней без причины, корректируй нагрузку.
    4. Если пользователь увеличил веса вручную в логах, обязательно обнови программу, чтобы следующий раз веса были актуальными.

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
    // Build exercise summary with weights for pain analysis
    const exerciseSummary = log.completedExercises.map(ex => {
        const avgWeight = ex.completedSets.length > 0
            ? Math.round(ex.completedSets.reduce((sum, s) => sum + (s.weight || 0), 0) / ex.completedSets.length)
            : 0;
        const hadFailure = ex.completedSets.some(s => s.rir === 0);
        return `${ex.name}: ${avgWeight}кг (${hadFailure ? 'отказ' : 'запас есть'})`;
    }).join('\n    ');

    return `
    Ты "ИИ тренер" - умный помощник.
    Пользователь закончил тренировку. Дай короткий, живой комментарий (2-4 предложения) на РУССКОМ языке.
    Обращайся на "Ты".

    Контекст:
    - Цель: ${profile.goals.primary}
    - Вес пользователя: ${profile.weight}кг
    - Тренировка: ${log.sessionId}
    - Время тренировки: ${log.duration ? Math.round(log.duration / 60) + ' мин' : 'Неизвестно'}
    - Выполнение: ${log.feedback.completion}
    - Боль/Дискомфорт: ${log.feedback.pain.hasPain ? `ДА - ${log.feedback.pain.details || 'не указано где'}` : 'Нет'}

    Выполненные упражнения:
    ${exerciseSummary}

    Задание:
    1. Сравни План и Факт. Если пользователь поднял больше, чем было в плане - похвали за прогресс.
    2. Если тренировка заняла слишком мало времени (<20 мин) - спроси, не халтурил ли он.
    3. ВАЖНО - Если была боль:
       - Определи какое упражнение скорее всего вызвало боль (по локации боли и списку упражнений)
       - Дай КОНКРЕТНЫЙ план действий: "На следующей тренировке снизим вес на [упражнение] с Xкг до Yкг"
       - Если RIR=0 при боли - вес точно был слишком тяжелый
       - НЕ говори просто "отдохни" - дай конкретную корректировку

    Стиль:
    - Дружелюбный, мотивирующий, как реальный бро-тренер который искренне заботится.
    - Используй эмодзи умеренно (1-2).
    - При боли:
      * Сначала эмпатия и поддержка ("Понимаю, это неприятно...")
      * Затем объясни ПОЧЕМУ это могло произойти
      * И конкретный план что ТЫ (тренер) сделаешь: "Я уже снизил вес на выпадах с 20кг до 15кг"
      * Закончи позитивно
    - НЕ пиши шаблонные фразы типа "береги себя" или "слушай своё тело" - будь конкретным.
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
    Ты адаптивный "ИИ тренер".
    Проанализируй прогресс пользователя и дай одну емкую фразу для главного экрана.

    Данные:
    - Цель: ${profile.goals.primary}
    - Тренировок всего: ${logs.length}
    - Последняя активность: ${recentLogs.length > 0 ? recentLogs[recentLogs.length - 1].date : 'Давно'}
    - Оценка готовности (Readiness): ${recentLogs.length > 0 ? recentLogs[recentLogs.length - 1].feedback.readiness?.score : 'Нет данных'}

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

/**
 * Immediately adjust program when user reports pain
 * This runs right after workout completion, not waiting for regular 3-workout adaptation cycle
 */
export const adjustProgramForPain = async (
    currentProgram: TrainingProgram,
    painDetails: string,
    completedExercises: CompletedExercise[]
): Promise<TrainingProgram | null> => {
    // Build exercise summary for context
    const exerciseSummary = completedExercises.map(ex => {
        const avgWeight = ex.completedSets.length > 0
            ? Math.round(ex.completedSets.reduce((sum, s) => sum + (s.weight || 0), 0) / ex.completedSets.length)
            : 0;
        const hadFailure = ex.completedSets.some(s => s.rir === 0);
        return `${ex.name}: ${avgWeight}кг (RIR: ${hadFailure ? '0 - отказ' : '1+'})`;
    }).join(', ');

    const reason = `Пользователь сообщил о боли/дискомфорте: "${painDetails}"`;
    const instructions = `
    НЕМЕДЛЕННАЯ корректировка программы из-за боли:

    Упражнения на тренировке: ${exerciseSummary}

    Правила:
    1. Найди упражнения на группу мышц, где была боль
    2. Снизь вес на 15-20% для этих упражнений ВО ВСЕХ сессиях программы
    3. Если боль в суставе (колено, плечо, поясница) - замени на более безопасный вариант:
       - Колено: выпады → румынская тяга, присед → жим ногами
       - Плечо: жим стоя → жим лежа, разводки → тяга к лицу
       - Поясница: становая → гиперэкстензия, скручивания → планка
    4. Добавь разминочный подход если его не было
    5. НЕ удаляй упражнения полностью - адаптируй

    Верни обновленную программу с пониженными весами.`;

    try {
        return await modifyPlanWithInstructions(currentProgram, reason, instructions);
    } catch (error) {
        console.error('Failed to adjust program for pain:', error);
        return null;
    }
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
    Обращайся к пользователю на "Ты".

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

// ============================================
// STRENGTH ANALYSIS (Pro Feature)
// ============================================

function buildStrengthInsightsPrompt(
    profile: OnboardingProfile,
    analysisData: Omit<StrengthInsightsData, 'aiInsights'>
): string {
    const genderRu = profile.gender === Gender.Male ? 'мужчина' : 'женщина';

    return `
    Ты опытный AI тренер и эксперт по силовым тренировкам.
    Проанализируй данные пользователя и дай персонализированные рекомендации на РУССКОМ языке.
    Обращайся на "Ты".

    === ПРОФИЛЬ ===
    - Пол: ${genderRu}
    - Возраст: ${profile.age} лет
    - Вес тела: ${profile.weight} кг
    - Опыт: ${profile.experience}
    - Главная цель: ${profile.goals.primary}
    ${profile.hasInjuries ? `- Травмы/ограничения: ${profile.injuries}` : ''}

    === СИЛОВЫЕ ПОКАЗАТЕЛИ ===
    ${analysisData.strengthAnalysis.length > 0
        ? analysisData.strengthAnalysis.map(s =>
            `• ${s.exerciseNameRu}: ${s.e1rm} кг (${s.relativeStrength}x BW) — уровень "${s.level}", тренд: ${s.trend === 'improving' ? 'растёт' : s.trend === 'declining' ? 'падает' : 'стабильно'}`
        ).join('\n    ')
        : 'Недостаточно данных'
    }

    === ВЫЯВЛЕННЫЕ ДИСБАЛАНСЫ ===
    ${analysisData.imbalances.length > 0
        ? analysisData.imbalances.map(i =>
            `• [${i.severity === 'severe' ? 'КРИТИЧНО' : i.severity === 'moderate' ? 'УМЕРЕННО' : 'ЛЕГКО'}] ${i.description}`
        ).join('\n    ')
        : 'Дисбалансов не обнаружено'
    }

    === ПАТТЕРНЫ БОЛИ ===
    ${analysisData.painPatterns.length > 0
        ? analysisData.painPatterns.map(p =>
            `• ${p.location}: ${p.frequency} раз, связано с ${p.movementPattern} движениями (${p.associatedExercises.slice(0, 3).join(', ')})`
        ).join('\n    ')
        : 'Жалоб на боль не зафиксировано'
    }

    === ПЛАТО (ЗАСТОЙ) ===
    ${analysisData.plateaus.length > 0
        ? analysisData.plateaus.map(p =>
            `• ${p.exerciseName}: застой ${p.weeksStuck} недель на ${p.currentE1rm} кг`
        ).join('\n    ')
        : 'Плато не обнаружено'
    }

    === ПАТТЕРНЫ ВОССТАНОВЛЕНИЯ ===
    - Средний сон: ${analysisData.readinessPatterns.averageSleep}/5 ${analysisData.readinessPatterns.chronicLowSleep ? '⚠️ ХРОНИЧЕСКИЙ НЕДОСЫП' : ''}
    - Средний стресс: ${analysisData.readinessPatterns.averageStress}/5 ${analysisData.readinessPatterns.highStress ? '⚠️ ВЫСОКИЙ СТРЕСС' : ''}
    - Средняя усталость мышц: ${analysisData.readinessPatterns.averageSoreness}/5

    ${analysisData.substitutions.length > 0 ? `
    === ЗАМЕНЫ УПРАЖНЕНИЙ ===
    ${analysisData.substitutions.slice(0, 3).map(s =>
        `• "${s.original}" → "${s.replacement}" (${s.count} раз)`
    ).join('\n    ')}
    ` : ''}

    === ОБЩИЙ УРОВЕНЬ ===
    ${analysisData.overallLevel}

    ===========================
    ТВОЯ ЗАДАЧА:
    ===========================

    Напиши развёрнутый анализ для пользователя, включая:

    1. **Оценка уровня** (2-3 предложения)
       - Объясни, где он находится относительно средних показателей
       - Отметь сильные стороны

    2. **Анализ баланса** (если есть дисбалансы)
       - Объясни, почему это важно исправить
       - К каким проблемам может привести (осанка, травмы)

    3. **Предупреждения** (если есть паттерны боли или плато)
       - Конкретные риски
       - Что делать прямо сейчас

    4. **Рекомендации** (3-5 пунктов)
       - Конкретные действия
       - Какие упражнения добавить/убрать
       - Советы по восстановлению если нужно

    5. **Мотивация** (1-2 предложения в конце)
       - Подбодри, отметь прогресс или потенциал

    ФОРМАТ:
    - Используй эмодзи умеренно (1-2 на секцию)
    - Заголовки выдели жирным через **
    - Списки через •
    - Общий объём: 200-300 слов
    - Язык: живой, как настоящий тренер в зале

    Не используй Markdown код-блоки, только простой текст с эмодзи и жирным текстом.
    `;
}

/**
 * Get AI-powered strength analysis insights
 */
export const getStrengthInsights = async (
    profile: OnboardingProfile,
    analysisData: Omit<StrengthInsightsData, 'aiInsights'>
): Promise<string> => {
    const prompt = buildStrengthInsightsPrompt(profile, analysisData);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
    });

    return extractText(response);
};
