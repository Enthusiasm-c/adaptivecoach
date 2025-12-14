
import { Type } from "@google/genai";
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, Exercise, WorkoutSession, ChatResponse, StrengthInsightsData, Gender, CompletedExercise, Location } from '../types';
import { calculateStreaks, calculateLevel, calculateWeekComparison, calculateWorkoutVolume } from '../utils/progressUtils';

// Import new scientific training system
import { generateProgram, convertToLegacyFormat } from './programGenerator';
import { validateProgram, getValidationSummary, getMissingMuscles } from './programValidator';

// ФИТКУБ equipment description for AI prompts
const FITCUBE_EQUIPMENT = `
Оборудование ФИТКУБ (микро-фитнес студия):
- Силовая рама с турником (встроенный)
- Регулируемая скамья (наклон/плоская)
- Олимпийский гриф 20 кг + гриф 15 кг
- Диски олимпийские: 2.5 / 5 / 10 / 15 / 20 кг
- Гантельный ряд 2.5–20 кг (максимум 20 кг!)
- Гири: 8 / 12 / 16 / 24 / 32 кг
- TRX / функциональные петли
- Резиновые петли разной жёсткости
- Медбол 6–10 кг
- Сайкл (кардио-велосипед)
- Коврики для йоги/растяжки
`;

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
            description: 'REQUIRED! strength=штанга/гантели/гири, bodyweight=отжимания/подтягивания/подъём ног в висе/пресс, cardio=бег/ходьба/велосипед/сайкл/дорожка, isometric=планка/удержание'
        },
        description: { type: Type.STRING, description: 'Short instructions on form/technique (1-2 sentences) in Russian' },
        sets: { type: Type.INTEGER },
        reps: { type: Type.STRING, description: 'КОНКРЕТНОЕ число повторений (например "10", "12", "8") или минут для кардио ("15"). НЕ ИСПОЛЬЗУЙ ДИАПАЗОНЫ вроде "8-12"!' },
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
    - Оборудование: ${profile.location === Location.FitCube ? FITCUBE_EQUIPMENT : profile.location}
    - Травмы/Ограничения: ${profile.hasInjuries ? profile.injuries : 'Нет'}
    ${profile.location === Location.FitCube ? `
    СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ ФИТКУБ:
    - Используй ТОЛЬКО оборудование из списка ФИТКУБ выше!
    - Максимальный вес гантелей 20 кг - не назначай больше!
    - Максимальный вес гирь 32 кг
    - Включай разнообразие: штанга, гантели, гири, TRX
    - Сайкл можно использовать для разминки (5 мин) или кардио-заминки
    - Турник использовать для подтягиваний, висов, подъёмов ног
    ` : ''}

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

    КРИТИЧЕСКИ ВАЖНО - exerciseType:
    Обязательно указывай exerciseType для КАЖДОГО упражнения:
    - 'strength' - ТОЛЬКО если используется отягощение (штанга, гантели, гири, тросовые тренажёры)
    - 'bodyweight' - отжимания, подтягивания, подъём ног в висе, скручивания, гиперэкстензия без веса
    - 'cardio' - бег, ходьба, велосипед, сайкл, дорожка, степпер, эллипс, скакалка, прыжки
    - 'isometric' - планка, удержание, статика, вис

    КРИТИЧЕСКИ ВАЖНО - reps:
    - Указывай КОНКРЕТНЫЕ числа повторений: "10", "12", "8"
    - НЕ ИСПОЛЬЗУЙ ДИАПАЗОНЫ вроде "8-12" или "10-15"!
    - Для кардио указывай конкретное время в минутах: "10", "15", "5"

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


// Helper: detect new personal records
function detectNewPRs(currentLog: WorkoutLog, allLogs: WorkoutLog[]): { exercise: string, weight: number, previousBest: number }[] {
    const prs: { exercise: string, weight: number, previousBest: number }[] = [];

    for (const ex of currentLog.completedExercises) {
        const maxWeightToday = Math.max(...ex.completedSets.map(s => s.weight || 0));
        if (maxWeightToday <= 0) continue;

        let previousBest = 0;
        for (const prevLog of allLogs) {
            if (prevLog.date === currentLog.date) continue;
            const prevEx = prevLog.completedExercises?.find(e => e.name === ex.name);
            if (prevEx) {
                const prevMax = Math.max(...prevEx.completedSets.map(s => s.weight || 0));
                if (prevMax > previousBest) previousBest = prevMax;
            }
        }

        if (maxWeightToday > previousBest && previousBest > 0) {
            prs.push({ exercise: ex.name, weight: maxWeightToday, previousBest });
        }
    }

    return prs;
}

// Helper: compare two workouts by volume
function compareWorkoutVolumes(prev: WorkoutLog, current: WorkoutLog): { diff: number, prevVolume: number, currentVolume: number } {
    const prevVolume = prev.completedExercises?.reduce((sum, ex) =>
        sum + ex.completedSets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0), 0) || 0;
    const currentVolume = current.completedExercises?.reduce((sum, ex) =>
        sum + ex.completedSets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0), 0) || 0;

    const diff = prevVolume > 0 ? Math.round(((currentVolume - prevVolume) / prevVolume) * 100) : 0;
    return { diff, prevVolume, currentVolume };
}

function buildCoachFeedbackPrompt(profile: OnboardingProfile, log: WorkoutLog, allLogs: WorkoutLog[]): string {
    // Exercise summary with weights
    const exerciseSummary = log.completedExercises.map(ex => {
        const avgWeight = ex.completedSets.length > 0
            ? Math.round(ex.completedSets.reduce((sum, s) => sum + (s.weight || 0), 0) / ex.completedSets.length)
            : 0;
        const hadFailure = ex.completedSets.some(s => s.rir === 0);
        return `- ${ex.name}: ${avgWeight}кг (${hadFailure ? 'отказ' : 'запас есть'})`;
    }).join('\n');

    // Calculate personalized insights
    const workoutNumber = allLogs.length + 1;
    const { currentStreak } = calculateStreaks(allLogs, undefined, profile.preferredDays);
    const userLevel = calculateLevel(allLogs);
    const weekComparison = calculateWeekComparison(allLogs);

    // Find previous same workout
    const previousSameWorkout = allLogs
        .filter(l => l.sessionId === log.sessionId && l.date !== log.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    // Detect PRs
    const newPRs = detectNewPRs(log, allLogs);

    // Volume comparison with previous same workout
    let volumeComparison = '';
    if (previousSameWorkout) {
        const { diff } = compareWorkoutVolumes(previousSameWorkout, log);
        if (diff > 5) volumeComparison = `Объём +${diff}% по сравнению с прошлым "${log.sessionId}"`;
        else if (diff < -5) volumeComparison = `Объём ${diff}% (меньше прошлого раза)`;
        else volumeComparison = `Объём примерно такой же как в прошлый раз`;
    }

    // Build context sections
    const prsSection = newPRs.length > 0 ? `
🏆 НОВЫЕ РЕКОРДЫ:
${newPRs.map(pr => `- ${pr.exercise}: ${pr.weight}кг (было ${pr.previousBest}кг, +${pr.weight - pr.previousBest}кг)`).join('\n')}
` : '';

    const comparisonSection = previousSameWorkout ? `
СРАВНЕНИЕ С ПРОШЛОЙ "${log.sessionId}":
- Прошлый раз: ${new Date(previousSameWorkout.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
- ${volumeComparison}
` : '(Это первая тренировка такого типа)';

    return `
Ты "ИИ тренер" Sensei. Пользователь закончил тренировку. Дай персональный комментарий (3-5 предложений).

═══════════════════════════════════════
ПЕРСОНАЛЬНЫЙ КОНТЕКСТ:
- Это тренировка #${workoutNumber}
- Стрик: ${currentStreak} ${currentStreak === 1 ? 'день' : currentStreak < 5 ? 'дня' : 'дней'} подряд
- Уровень: ${userLevel.level} (${userLevel.title})
- Объём за неделю: ${Math.round(weekComparison.currentWeekVolume / 1000)}т ${weekComparison.changePercent !== 0 ? `(${weekComparison.changePercent > 0 ? '+' : ''}${weekComparison.changePercent}% к прошлой неделе)` : ''}
${prsSection}
${comparisonSection}
═══════════════════════════════════════

ТЕКУЩАЯ ТРЕНИРОВКА:
- Название: ${log.sessionId}
- Время: ${log.duration ? Math.round(log.duration / 60) + ' мин' : 'Неизвестно'}
- Выполнение: ${log.feedback.completion}
- Боль: ${log.feedback.pain.hasPain ? `ДА - ${log.feedback.pain.details || 'не указано где'}` : 'Нет'}

Упражнения:
${exerciseSummary}

═══════════════════════════════════════

ТВОЁ ЗАДАНИЕ:
1. Если есть PR (новый рекорд) — ОБЯЗАТЕЛЬНО поздравь! Это главное достижение.
2. Если стрик — упомяни количество ТРЕНИРОВОК подряд (не дней!), это важно для мотивации.
3. Сравни с прошлой такой же тренировкой (прогресс/регресс по объёму).
4. Если была боль — посчитай конкретное снижение веса (-15%) и напиши РЕАЛЬНЫЕ ЦИФРЫ. Пример: "Снизим вес жима с 80кг до 68кг (-15%)". НЕ используй переменные X, Y, Z — только конкретные числа из контекста!
5. Используй КОНКРЕТНЫЕ цифры из контекста — не общие фразы!

СТИЛЬ:
- 3-5 предложений максимум
- Персональный: используй цифры (кг, %, тренировки)
- 1-2 эмодзи
- НЕ ПИШИ: "молодец", "отлично", "продолжай", "береги себя" — это пустые фразы
- ПИШИ: факты и цифры, конкретику
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
    // Use new scientific training system (V2)
    return generateInitialPlanV2(profile);
};

/**
 * Build prompt for AI to personalize weights in template-based program
 */
function buildWeightPersonalizationPrompt(
    profile: OnboardingProfile,
    program: TrainingProgram
): string {
    const knownWeightsStr = profile.knownWeights && profile.knownWeights.length > 0
        ? profile.knownWeights.map(w => `${w.exercise}: ${w.weight}кг`).join(', ')
        : 'Нет данных';

    return `
    Ты опытный тренер. Персонализируй веса в программе на основе профиля пользователя.

    ПРОФИЛЬ:
    - Пол: ${profile.gender}
    - Возраст: ${profile.age}
    - Вес тела: ${profile.weight} кг
    - Опыт: ${profile.experience}
    - Цель: ${profile.goals.primary}
    - Известные рабочие веса: ${knownWeightsStr}
    - Последняя тренировка: ${profile.lastWorkout || 'Неизвестно'}

    ПРОГРАММА (уже подобраны упражнения по мышечным группам):
    ${JSON.stringify(program, null, 2)}

    ЗАДАЧА:
    1. Установи стартовые веса (поле "weight") для КАЖДОГО упражнения с exerciseType="strength"
    2. Используй известные рабочие веса как ориентир:
       - Если есть жим лёжа 80кг → жим гантелей ~30-32кг, жим на наклонной ~60-65кг
       - Если есть присед 100кг → жим ногами ~120кг, выпады ~40кг
       - Если есть тяга штанги 80кг → тяга гантели ~30кг, подтягивания с весом ~5-10кг
    3. Для новичков без данных: начни с лёгких весов (20-30кг жим, 40-50кг присед)
    4. Если последняя тренировка > 3 месяцев назад: снизь веса на 20-30%
    5. Для bodyweight/cardio/isometric упражнений оставь weight: 0

    КРИТИЧЕСКИ ВАЖНО:
    - Верни ПОЛНУЮ программу в том же JSON формате
    - Не меняй названия упражнений и структуру
    - Только добавь/скорректируй поле "weight" в числовом формате (кг)
    - Для кардио (бег, ходьба) weight = 0

    Язык: Русский.
    `;
}

/**
 * NEW: Generate training program using scientific templates + AI personalization
 * Uses template-based slots for guaranteed muscle coverage, AI only fills weights
 */
export const generateInitialPlanV2 = async (profile: OnboardingProfile): Promise<TrainingProgram> => {
    console.log('[ProgramGen V2] Starting scientific program generation...');

    // 1. Generate program from templates
    const generationResult = generateProgram(profile);
    console.log('[ProgramGen V2] Template-based generation complete:', {
        success: generationResult.success,
        warnings: generationResult.warnings,
        validation: generationResult.validation,
    });

    // 2. Convert to legacy format
    let program = convertToLegacyFormat(generationResult, profile);
    console.log('[ProgramGen V2] Converted to legacy format, sessions:', program.sessions.length);

    // 3. Validate the program
    const validationResult = validateProgram(program, profile);
    console.log('[ProgramGen V2] Validation:', getValidationSummary(validationResult));

    // 4. If critical muscles are missing, try to add them via AI fallback
    const missingMuscles = getMissingMuscles(program);
    if (missingMuscles.length > 0) {
        console.log('[ProgramGen V2] Missing muscles detected:', missingMuscles);
        // Use AI to fill gaps (fallback)
        program = await fillMissingMusclesWithAI(program, profile, missingMuscles);
    }

    // 5. Use AI to personalize weights (ALWAYS - even for beginners without knownWeights)
    // AI prompt already has instructions for beginners: "начни с лёгких весов (20-30кг жим, 40-50кг присед)"
    console.log('[ProgramGen V2] Personalizing weights with AI...');
    try {
        program = await personalizeWeightsWithAI(program, profile);
    } catch (error) {
        console.error('[ProgramGen V2] Weight personalization failed, using defaults:', error);
    }

    console.log('[ProgramGen V2] Final program generated successfully');
    return program;
};

/**
 * Use AI to personalize weights in the program
 */
async function personalizeWeightsWithAI(
    program: TrainingProgram,
    profile: OnboardingProfile
): Promise<TrainingProgram> {
    const prompt = buildWeightPersonalizationPrompt(profile, program);

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response);
    return JSON.parse(jsonText) as TrainingProgram;
}

/**
 * Fallback: Use AI to add exercises for missing muscle groups
 */
async function fillMissingMusclesWithAI(
    program: TrainingProgram,
    profile: OnboardingProfile,
    missingMuscles: string[]
): Promise<TrainingProgram> {
    const prompt = `
    Ты опытный тренер. В программе не хватает упражнений на некоторые мышечные группы.

    ТЕКУЩАЯ ПРОГРАММА:
    ${JSON.stringify(program, null, 2)}

    НЕДОСТАЮЩИЕ МЫШЕЧНЫЕ ГРУППЫ:
    ${missingMuscles.join(', ')}

    ПРОФИЛЬ:
    - Оборудование: ${profile.location}
    - Опыт: ${profile.experience}
    - Дней в неделю: ${program.sessions.length}

    ЗАДАЧА:
    1. Добавь 1-2 упражнения на каждую недостающую группу мышц
    2. Распредели равномерно по сессиям
    3. Для бицепса: сгибания со штангой/гантелями
    4. Для трицепса: разгибания на блоке/французский жим
    5. Для задних дельт: махи в наклоне/тяга к лицу
    6. Учитывай оборудование: ${profile.location}

    Верни ПОЛНУЮ обновлённую программу в JSON формате.
    `;

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: trainingProgramSchema,
        },
    });

    const jsonText = extractText(response);
    return JSON.parse(jsonText) as TrainingProgram;
}

/**
 * LEGACY: Original AI-only program generation (kept as fallback)
 */
export const generateInitialPlanLegacy = async (profile: OnboardingProfile): Promise<TrainingProgram> => {
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

export const getCoachFeedback = async (
    profile: OnboardingProfile,
    log: WorkoutLog,
    allLogs: WorkoutLog[] = []
): Promise<string> => {
    const prompt = buildCoachFeedbackPrompt(profile, log, allLogs);

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

// ============================================
// LOCATION ADAPTATION
// ============================================

// Equipment available at each location
const LOCATION_EQUIPMENT_MAP: { [key in Location]: string[] } = {
    [Location.CommercialGym]: ['штанга', 'гантели', 'тренажёры', 'кабели', 'гири', 'EZ-гриф', 'собственный вес'],
    [Location.Bodyweight]: ['собственный вес', 'резиновые петли'],
    [Location.FitCube]: ['гантели до 20кг', 'гири', 'резиновые петли', 'TRX', 'турник', 'медбол', 'собственный вес'],
};

/**
 * Adapt existing training program for a new location
 * Replaces incompatible exercises with suitable alternatives
 */
export const adaptProgramForLocation = async (
    program: TrainingProgram,
    newLocation: Location,
    profile: OnboardingProfile
): Promise<TrainingProgram> => {
    const availableEquipment = LOCATION_EQUIPMENT_MAP[newLocation];

    // Build prompt for AI to adapt exercises
    const exerciseList = program.sessions.flatMap(session =>
        session.exercises.map(ex => ({
            sessionName: session.name,
            exercise: ex
        }))
    );

    const equipmentDescription = newLocation === Location.FitCube ? FITCUBE_EQUIPMENT : '';

    const prompt = `
Ты — опытный фитнес-тренер. Пользователь меняет место тренировок.

НОВОЕ МЕСТО: ${newLocation}
ДОСТУПНОЕ ОБОРУДОВАНИЕ: ${availableEquipment.join(', ')}
${equipmentDescription}

ТЕКУЩИЕ УПРАЖНЕНИЯ В ПРОГРАММЕ:
${JSON.stringify(exerciseList.map(e => ({
    session: e.sessionName,
    name: e.exercise.name,
    sets: e.exercise.sets,
    reps: e.exercise.reps,
    weight: e.exercise.weight
})), null, 2)}

ЗАДАЧА:
Проверь каждое упражнение. Если оно НЕ подходит для нового места (нужно недоступное оборудование), замени его на подходящую альтернативу.

ПРАВИЛА ЗАМЕНЫ:
1. Сохраняй целевую мышечную группу
2. Сохраняй примерный уровень сложности
3. Если возможно, сохраняй веса (или адаптируй под новое оборудование)
4. Для ФИТКУБ: гантели максимум 20 кг!
5. Для домашних тренировок без оборудования: используй вариации с собственным весом

ВАЖНО: Верни ПОЛНЫЙ список упражнений в JSON формате, включая те которые не менялись.
`;

    const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        contents: prompt,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    adaptedExercises: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                sessionName: { type: Type.STRING },
                                originalName: { type: Type.STRING },
                                newName: { type: Type.STRING },
                                newDescription: { type: Type.STRING },
                                sets: { type: Type.INTEGER },
                                reps: { type: Type.STRING },
                                weight: { type: Type.NUMBER },
                                rest: { type: Type.INTEGER },
                                exerciseType: { type: Type.STRING },
                                wasChanged: { type: Type.BOOLEAN }
                            },
                            required: ['sessionName', 'originalName', 'newName', 'sets', 'reps', 'weight', 'wasChanged']
                        }
                    }
                },
                required: ['adaptedExercises']
            }
        }
    });

    const text = extractText(response);
    let adaptedData: { adaptedExercises: Array<{
        sessionName: string;
        originalName: string;
        newName: string;
        newDescription?: string;
        sets: number;
        reps: string;
        weight: number;
        rest?: number;
        exerciseType?: string;
        wasChanged: boolean;
    }> };

    try {
        adaptedData = JSON.parse(text);
    } catch (e) {
        console.error('Failed to parse adaptation response:', e);
        // Return original program if parsing fails
        return program;
    }

    // Apply adaptations to program
    const adaptedSessions = program.sessions.map(session => {
        const adaptedExercises = session.exercises.map(exercise => {
            const adaptation = adaptedData.adaptedExercises.find(
                a => a.sessionName === session.name && a.originalName === exercise.name
            );

            if (adaptation && adaptation.wasChanged) {
                return {
                    ...exercise,
                    name: adaptation.newName,
                    description: adaptation.newDescription || exercise.description,
                    sets: adaptation.sets,
                    reps: adaptation.reps,
                    weight: adaptation.weight,
                    rest: adaptation.rest || exercise.rest,
                    exerciseType: (adaptation.exerciseType as Exercise['exerciseType']) || exercise.exerciseType
                };
            }

            return exercise;
        });

        return {
            ...session,
            exercises: adaptedExercises
        };
    });

    return {
        ...program,
        sessions: adaptedSessions
    };
};

// Интерфейс для результата анализа боли
export interface PainAnalysisResult {
    zones: Array<{
        bodyPart: string;
        count: number;
        severity: 'low' | 'medium' | 'high';
    }>;
    patterns: string[];
    recommendation: string;
}

// Анализ паттернов боли через Gemini
export const analyzePainPatterns = async (painLogs: WorkoutLog[]): Promise<PainAnalysisResult> => {
    if (!painLogs || painLogs.length === 0) {
        return { zones: [], patterns: [], recommendation: '' };
    }

    // Подготовка данных о боли для анализа
    const painData = painLogs.map(log => ({
        date: log.date,
        session: log.sessionId || 'Неизвестно',
        exercises: log.completedExercises?.map(e => e.name).join(', ') || '',
        painDetails: log.feedback?.pain?.details || '',
        painLocation: log.feedback?.pain?.location || ''
    }));

    const prompt = [
        {
            role: 'user',
            parts: [{
                text: `Проанализируй записи о боли после тренировок и выяви паттерны.

ДАННЫЕ О БОЛИ:
${JSON.stringify(painData, null, 2)}

ЗАДАЧА:
1. Определи части тела, которые болят чаще всего
2. Найди связь между упражнениями и болью
3. Дай краткую рекомендацию (1-2 предложения)

ФОРМАТ ОТВЕТА (строго JSON):
{
  "zones": [
    {"bodyPart": "Плечо", "count": 2, "severity": "medium"},
    {"bodyPart": "Колено", "count": 1, "severity": "low"}
  ],
  "patterns": [
    "Боль в плече связана с жимовыми упражнениями",
    "Колено болит после выпадов"
  ],
  "recommendation": "Рекомендую снизить нагрузку на жимы и добавить разминку плечевого пояса."
}

ПРАВИЛА:
- bodyPart: название части тела на русском с большой буквы
- count: сколько раз упоминалась боль в этой зоне
- severity: low (лёгкая), medium (умеренная), high (сильная/частая)
- patterns: краткие выводы о связях (максимум 3)
- recommendation: одно короткое практичное предложение`
            }]
        }
    ];

    try {
        const response = await callGeminiProxy(`/v1beta/models/${GEMINI_MODEL}:generateContent`, {
            contents: prompt,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        zones: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    bodyPart: { type: Type.STRING },
                                    count: { type: Type.INTEGER },
                                    severity: { type: Type.STRING }
                                },
                                required: ['bodyPart', 'count', 'severity']
                            }
                        },
                        patterns: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        recommendation: { type: Type.STRING }
                    },
                    required: ['zones', 'patterns', 'recommendation']
                }
            }
        });

        const text = extractText(response);
        const result = JSON.parse(text);
        return result as PainAnalysisResult;
    } catch (error) {
        console.error('Error analyzing pain patterns:', error);
        return { zones: [], patterns: [], recommendation: '' };
    }
};
