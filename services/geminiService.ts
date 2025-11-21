import { GoogleGenAI, Type, Content } from "@google/genai";
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, Exercise, WorkoutSession } from '../types';

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

// Export the resolved key for UI diagnostics
export const currentApiKey = getApiKey();

// Always log the key status to console for debugging deployments
console.log("Gemini Service Init. Key Status:", currentApiKey && !currentApiKey.includes('UNUSED') ? `Loaded (${currentApiKey.substring(0, 6)}...)` : "MISSING/UNUSED");

// Initialize even if empty/placeholder so App.tsx can handle the error gracefully in the UI
const ai = new GoogleGenAI({ apiKey: currentApiKey || "MISSING_KEY" });

const exerciseSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        sets: { type: Type.INTEGER },
        reps: { type: Type.STRING, description: 'Range like "8-12" or number "5"' },
        weight: { type: Type.NUMBER, description: 'Starting weight in kg. 0 for bodyweight.' },
        rest: { type: Type.INTEGER, description: 'Rest in seconds' },
    },
    required: ['name', 'sets', 'reps', 'weight', 'rest'],
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
        name: { type: Type.STRING, description: 'e.g., "День 1 - Фулбоди А"' },
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

function buildInitialPrompt(profile: OnboardingProfile): string {
    return `
    Ты опытный фитнес-тренер. Создай персонализированную программу тренировок на основе профиля пользователя.
    Программа должна быть структурированной, простой и эффективной.
    Весь контент (названия тренировок, упражнений) должен быть на РУССКОМ языке.
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
    - Травмы: ${profile.hasInjuries ? profile.injuries : 'Нет'}

    Правила составления:
    1. Сплит:
        - 2-3 дня: Full Body (Всё тело).
        - 4 дня: Верх/Низ.
        - 5 дней: Push/Pull/Legs (Тяни/Толкай/Ноги).
    2. Выбор упражнений:
        - Приоритет базовым движениям (приседания, тяги, жимы).
        - Учитывай оборудование (${profile.location}). Если "Дома (минимум оборудования)", используй упражнения с собственным весом или резинками.
        - Учитывай травмы (${profile.injuries}). Избегай упражнений, нагружающих больные зоны. Будь консервативен.
    3. Объем:
        - Новички: 2-3 подхода, 8-12 повторов. Акцент на технику.
        - Продвинутые: 3-5 подходов, разные диапазоны повторений.
    4. Вес:
        - Предлагай консервативные стартовые веса в КГ.

    Сгенерируй программу в формате JSON на русском языке.
    `;
}

function buildAdaptationPrompt(currentProgram: TrainingProgram, logs: WorkoutLog[]): string {
    const recentLogs = logs.slice(-3);
    return `
    Ты эксперт-тренер. Адаптируй текущую программу пользователя на основе его последних тренировок.
    Используй принцип прогрессивной перегрузки.
    Ответ должен быть JSON объектом (вся обновленная программа) на РУССКОМ языке.

    Текущая программа:
    ${JSON.stringify(currentProgram, null, 2)}

    Последние логи (RIR - повторения в запасе):
    ${JSON.stringify(recentLogs, null, 2)}

    Правила адаптации:
    1. RIR (Reps in Reserve):
        - RIR 3+: Слишком легко. Увеличь вес на 2.5-5%.
        - RIR 1-2: Оптимально. Оставь вес или увеличь минимально.
        - RIR 0 или отказ: Слишком тяжело. Уменьши вес на 5-10%.
    2. Боль:
       - Если была боль в упражнении, ЗАМЕНИ его на безопасный аналог.
    3. Общие:
       - Изменения применяй к следующей неделе.
       - Не меняй структуру сплита полностью, только нагрузку и упражнения.

    Сгенерируй адаптированную программу JSON на русском.
    `;
}

function buildCoachFeedbackPrompt(profile: OnboardingProfile, log: WorkoutLog): string {
    return `
    Ты дружелюбный и мудрый фитнес-тренер Coach Gemini.
    Пользователь закончил тренировку. Дай короткий, мотивирующий комментарий (2-4 предложения) на РУССКОМ языке.
    Опирайся на RIR (повторения в запасе): низкий RIR = выложился на полную.

    Цель: ${profile.goals.primary}
    Тренировка: ${log.sessionId}
    Обратная связь: ${log.feedback.completion}
    Боль: ${log.feedback.pain.hasPain ? `Да - ${log.feedback.pain.details}` : 'Нет'}

    Правила:
    1. Похвали за усилия.
    2. Если RIR был низкий (0-1): "Ты выложился на максимум, молодец! Отдохни как следует."
    3. Если была боль: "Спасибо, что отметил боль в ${log.feedback.pain.details || 'мышцах'}. Будем следить за этим."
    4. Если не все выполнил: "Главное — регулярность, не переживай из-за пропущенных повторов."
    5. Закончи мотивацией к цели (${profile.goals.primary}).
    `;
}

function buildExerciseSwapPrompt(exerciseToSwap: Exercise, session: WorkoutSession, profile: OnboardingProfile): string {
    return `
    Ты тренер. Пользователь хочет заменить упражнение "${exerciseToSwap.name}".
    Предложи 3-4 альтернативы на РУССКОМ языке.
    Альтернативы должны задействовать те же мышцы и подходить под оборудование: ${profile.location}.

    Сгенерируй JSON с альтернативами.
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

    // Switched to gemini-2.5-flash for better compatibility and stability
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

    // Switched to gemini-2.5-flash for better compatibility
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

export const getChatbotResponse = async (history: ChatMessage[]): Promise<string> => {
    // 1. Extract the new user message (last element)
    const newMessage = history[history.length - 1];
    
    // 2. Format the previous history
    const historyContent: Content[] = history.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    // 3. Initialize chat with history
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: historyContent,
      config: {
        systemInstruction: "Ты дружелюбный фитнес-помощник Coach Gemini. Отвечай на вопросы о тренировках, питании и здоровье на РУССКОМ языке. Помни контекст предыдущих сообщений. Будь краток и мотивируй. Не давай медицинских советов."
      },
    });

    // 4. Send the new message
    const result = await chat.sendMessage({
        message: newMessage.text
    });

    return result.text;
}