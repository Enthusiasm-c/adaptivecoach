
import { GoogleGenAI, Type, Content, FunctionDeclaration, Tool } from "@google/genai";
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, Exercise, WorkoutSession, ChatResponse } from '../types';

// Robustly retrieve and sanitize the API Key
export const getApiKey = () => {
  // Helper to validate a potential key
  const isValidKey = (k: any) => k && typeof k === 'string' && k.length > 10 && !k.includes('UNUSED');
  
  // Helper to clean a key
  const cleanKey = (key: string) => {
    // Remove non-printable characters
    let cleaned = key.replace(/[^\x20-\x7E]/g, '').trim();
    // Remove quotes if build tool added them
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }
    return cleaned.trim();
  }

  // 1. Check Vite specific env vars (Client side injection) - PRIORITY for Vite Apps
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (isValidKey(import.meta.env.VITE_API_KEY)) return cleanKey(import.meta.env.VITE_API_KEY);
      // @ts-ignore
      if (isValidKey(import.meta.env.API_KEY)) return cleanKey(import.meta.env.API_KEY);
  }

  // 2. Check window.env for runtime injection (Docker patterns)
  // @ts-ignore
  if (typeof window !== 'undefined' && window.env) {
      // @ts-ignore
      if (isValidKey(window.env.API_KEY)) return cleanKey(window.env.API_KEY);
      // @ts-ignore
      if (isValidKey(window.env.VITE_API_KEY)) return cleanKey(window.env.VITE_API_KEY);
  }

  // 3. Check standard Node/Process env (Cloud Run / Build time)
  if (isValidKey(process.env.API_KEY)) return cleanKey(process.env.API_KEY!);

  // 4. Return existing but invalid key (like UNUSED) for error handling, or empty string
  return process.env.API_KEY || "";
};

// Retrieve Proxy URL if available (For bypassing geo-blocks via Digital Ocean, etc.)
export const getProxyUrl = () => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PROXY_URL) {
        // @ts-ignore
        return import.meta.env.VITE_PROXY_URL;
    }
    return undefined;
}

// Export the resolved key for UI diagnostics
export const currentApiKey = getApiKey();
export const currentProxyUrl = getProxyUrl();

// Always log the key status to console for debugging deployments
console.log("Gemini Service Init.", 
    "Key Status:", currentApiKey && !currentApiKey.includes('UNUSED') ? `Loaded (${currentApiKey.substring(0, 6)}...)` : "MISSING/UNUSED",
    "Proxy:", currentProxyUrl ? `Active (${currentProxyUrl})` : "Direct Mode"
);

// Initialize configuration
const clientOptions: any = { 
    apiKey: currentApiKey || "MISSING_KEY" 
};

// If a proxy URL is set (e.g. "https://my-do-server.com"), use it as the baseUrl.
// The SDK will append /v1beta/... to this URL.
if (currentProxyUrl) {
    clientOptions.baseUrl = currentProxyUrl;
}

const ai = new GoogleGenAI(clientOptions);

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

// --- Function Definitions for Chatbot Tools ---
const updatePlanTool: FunctionDeclaration = {
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
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: exerciseAlternativesSchema,
        },
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText) as { alternatives: Exercise[] };
    return result.alternatives;
};


export const generateInitialPlan = async (profile: OnboardingProfile): Promise<TrainingProgram> => {
    const prompt = buildInitialPrompt(profile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as TrainingProgram;
};


export const adaptPlan = async (currentProgram: TrainingProgram, logs: WorkoutLog[]): Promise<TrainingProgram> => {
    const prompt = buildAdaptationPrompt(currentProgram, logs);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as TrainingProgram;
};

// Internal helper to actually rewrite the JSON
const modifyPlanWithInstructions = async (currentProgram: TrainingProgram, reason: string, instructions: string): Promise<TrainingProgram> => {
    const prompt = buildModificationPrompt(currentProgram, reason, instructions);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as TrainingProgram;
};

export const getCoachFeedback = async (profile: OnboardingProfile, log: WorkoutLog): Promise<string> => {
    const prompt = buildCoachFeedbackPrompt(profile, log);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
};

export const getDashboardInsight = async (profile: OnboardingProfile, logs: WorkoutLog[]): Promise<string> => {
    const prompt = buildDashboardInsightPrompt(profile, logs);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
};

export const getChatbotResponse = async (history: ChatMessage[], currentProgram: TrainingProgram): Promise<ChatResponse> => {
    // 1. Extract the new user message (last element)
    const newMessage = history[history.length - 1];
    
    // 2. Format the previous history
    const historyContent: Content[] = history.slice(0, -1).map(msg => ({
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

    // 4. Initialize chat with tool support
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: historyContent,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [updatePlanTool] }]
      },
    });

    // 5. Send message
    const result = await chat.sendMessage({
        message: newMessage.text
    });

    // 6. Handle Function Calls
    const toolCalls = result.functionCalls;
    if (toolCalls && toolCalls.length > 0) {
        const call = toolCalls[0];
        
        if (call.name === 'update_workout_plan') {
            const args = call.args as { reason: string, instructions: string };
            
            // Perform the actual program modification using a separate robust call
            const updatedProgram = await modifyPlanWithInstructions(currentProgram, args.reason, args.instructions);

            // Return a response indicating success + the new object
            // We also want the model to generate a polite text response acknowledging the action.
            // We simulate a tool output back to the model
            const toolResponse = await chat.sendMessage({
               toolResponse: {
                   functionResponses: [{
                       name: 'update_workout_plan',
                       id: call.id,
                       response: { result: 'Program updated successfully.' }
                   }]
               }
            });

            return {
                text: toolResponse.text,
                updatedProgram: updatedProgram
            };
        }
    }

    return { text: result.text };
}
