# План исправления архитектуры: "Подключаем колёса к двигателю"

## Диагноз

**Проблема**: Отличные сервисы работают изолированно, не передают данные друг другу.

```
Текущее состояние:
┌─────────────────┐
│  WORKOUT LOGS   │
└────────┬────────┘
         │
    ┌────▼────┐     ┌──────────────┐     ┌──────────────┐
    │ Volume  │     │  Strength    │     │  Mesocycle   │
    │ Tracker │     │  Analysis    │     │  Service     │
    └────┬────┘     └──────┬───────┘     └──────┬───────┘
         │                 │                    │
         X                 X                    X
         │                 │                    │
         ▼                 ▼                    ▼
    [Показывает UI]   [Показывает UI]    [НЕ применяется!]
         │                 │                    │
         X ─────────── НЕ ПЕРЕДАЁТСЯ В AI ──────X
```

---

## ФАЗА 1: Критические исправления (P0)

### 1.1 Применить mesocycle multiplier к UI

**Файл**: `App.tsx` строка 746

**Текущий код**:
```typescript
<Dashboard
    program={trainingProgram}  // RAW программа!
    ...
/>
```

**Новый код**:
```typescript
// Перед return, около строки 740:
const displayProgram = useMemo(() => {
    if (!trainingProgram || !mesocycleState) return trainingProgram;
    return getProgramForCurrentPhase(trainingProgram, mesocycleState);
}, [trainingProgram, mesocycleState]);

// В JSX:
<Dashboard
    program={displayProgram}
    ...
/>
```

**Тест**: На 5й неделе мезоцикла (overreaching) упражнение с 3 подходами должно показывать 4 подхода (3 × 1.2 = 3.6 → 4).

---

### 1.2 Добавить volume analysis в AI prompt

**Файл**: `services/geminiService.ts`

**Шаг A**: Добавить import (строка ~15):
```typescript
import { calculateWeeklyVolume, WeeklyVolumeReport } from './volumeTracker';
```

**Шаг B**: Изменить `buildAdaptationPrompt` (строка ~332):

**Текущий код**:
```typescript
function buildAdaptationPrompt(currentProgram: TrainingProgram, logs: WorkoutLog[]): string {
    const recentLogs = logs.slice(-3);
    const exerciseSummary = extractExerciseSummary(recentLogs);
    const painReports = extractPainReports(recentLogs);
    ...
}
```

**Новый код**:
```typescript
function buildAdaptationPrompt(
    currentProgram: TrainingProgram,
    logs: WorkoutLog[],
    profile?: OnboardingProfile  // Добавляем profile для experience level
): string {
    const recentLogs = logs.slice(-6);  // Увеличиваем до 6 для лучшего анализа
    const exerciseSummary = extractExerciseSummary(recentLogs);
    const painReports = extractPainReports(recentLogs);

    // NEW: Добавляем volume analysis
    const experienceLevel = profile?.experience || 'intermediate';
    const volumeReport = calculateWeeklyVolume(recentLogs, experienceLevel);
    const volumeSection = formatVolumeReport(volumeReport);
    ...

    // В prompt добавить секцию:
    === АНАЛИЗ ОБЪЁМА ПО ГРУППАМ МЫШЦ ===
    ${volumeSection}
}

// Новая helper функция:
function formatVolumeReport(report: WeeklyVolumeReport): string {
    if (report.muscles.length === 0) return 'Недостаточно данных';

    const lines: string[] = [];

    if (report.undertrainedMuscles.length > 0) {
        lines.push(`⚠️ Недостаточно нагрузки: ${report.undertrainedMuscles.join(', ')}`);
    }
    if (report.overtrainedMuscles.length > 0) {
        lines.push(`🔴 Перетренировка: ${report.overtrainedMuscles.join(', ')}`);
    }

    // Детали по мышцам
    for (const m of report.muscles) {
        const statusIcon = m.status === 'under' ? '📉' : m.status === 'over' ? '📈' : '✅';
        lines.push(`${statusIcon} ${m.muscleNameRu}: ${m.totalSets} сетов (${m.percentOfOptimal}% от оптимума)`);
    }

    return lines.join('\n    ');
}
```

**Шаг C**: Обновить вызов `adaptPlan` чтобы передавать profile:

В `App.tsx` строка ~537:
```typescript
const adaptedProgram = await adaptPlan(currentProgram, updatedLogs, onboardingProfile);
```

В `geminiService.ts` обновить сигнатуру:
```typescript
export async function adaptPlan(
    currentProgram: TrainingProgram,
    logs: WorkoutLog[],
    profile?: OnboardingProfile
): Promise<TrainingProgram> {
    const prompt = buildAdaptationPrompt(currentProgram, logs, profile);
    ...
}
```

---

### 1.3 Использовать E1RM для предложения весов

**Файл**: `services/programGenerator.ts` функция `calculateInitialWeight`

**Текущий код** (строка ~86-110): Использует только `profile.knownWeights` из онбординга.

**Новый код**:
```typescript
import { calculateE1RM, getBestLiftForExercise } from '../utils/strengthAnalysisUtils';

function calculateInitialWeight(
    exercise: ExerciseDefinition,
    profile: OnboardingProfile,
    logs?: WorkoutLog[]  // NEW: добавляем logs
): number | undefined {
    // For bodyweight exercises, no weight needed
    if (exercise.equipment === 'bodyweight') {
        return undefined;
    }

    // NEW: Сначала проверяем историю тренировок
    if (logs && logs.length > 0) {
        const bestLift = getBestLiftForExercise(exercise.name, logs, profile);
        if (bestLift) {
            // Используем 80% от E1RM для рабочих подходов
            const workingWeight = Math.round(bestLift.e1rm * 0.8 / 2.5) * 2.5;
            return workingWeight;
        }
    }

    // Fallback: существующая логика с profile.knownWeights
    const normalizedName = normalizeExerciseNameForWeight(exercise.name);
    ...
}
```

**Новая helper функция** в `strengthAnalysisUtils.ts`:
```typescript
export function getBestLiftForExercise(
    exerciseName: string,
    logs: WorkoutLog[],
    profile: OnboardingProfile
): { weight: number; reps: number; e1rm: number } | null {
    const normalizedTarget = exerciseName.toLowerCase();

    let bestE1rm = 0;
    let bestLift = null;

    for (const log of logs) {
        for (const ex of log.completedExercises) {
            if (ex.isWarmup) continue;

            const normalizedName = ex.name.toLowerCase();
            // Fuzzy match
            if (normalizedName.includes(normalizedTarget) ||
                normalizedTarget.includes(normalizedName)) {

                for (const set of ex.completedSets) {
                    if (set.weight && set.reps && set.reps > 0) {
                        const e1rm = calculateE1RM(set.weight, set.reps);
                        if (e1rm > bestE1rm) {
                            bestE1rm = e1rm;
                            bestLift = { weight: set.weight, reps: set.reps, e1rm };
                        }
                    }
                }
            }
        }
    }

    return bestLift;
}
```

---

## ФАЗА 2: Важные исправления (P1)

### 2.1 Синхронизировать веса ПЕРЕД адаптацией

**Файл**: `App.tsx`

**Проблема**: `syncWeightsFromLogs` вызывается ПОСЛЕ тренировки, но ПЕРЕД вызовом AI `adaptPlan`.

**Текущий код** (строка ~537):
```typescript
const adaptedProgram = await adaptPlan(currentProgram, updatedLogs);
```

**Новый код**:
```typescript
// Убедиться что используем synced program для адаптации
const syncedForAdaptation = syncWeightsFromLogs(currentProgram, updatedLogs);
const adaptedProgram = await adaptPlan(syncedForAdaptation, updatedLogs, onboardingProfile);
```

---

### 2.2 Добавить объяснение авторегуляции в UI

**Файл**: `App.tsx` строка ~524

**Текущий код**:
```typescript
if (recommendation.warnings.length > 0) {
    setToastMessage(recommendation.warnings[0]);
}
```

**Новый код**:
```typescript
// Формируем понятное сообщение
const adjustmentExplanation = formatAutoregulationMessage(recommendation);
if (adjustmentExplanation) {
    setToastMessage(adjustmentExplanation);
}

// Новая функция:
function formatAutoregulationMessage(rec: AutoregulationRecommendation): string | null {
    if (rec.volumeAdjustment.type === 'maintain') return null;

    const direction = rec.volumeAdjustment.type === 'increase' ? 'Увеличил' : 'Снизил';
    const percent = Math.abs(rec.volumeAdjustment.percent);

    let reason = '';
    if (rec.warnings.length > 0) {
        reason = rec.warnings[0];
    } else if (rec.volumeAdjustment.type === 'decrease') {
        reason = 'Обнаружены признаки накопленной усталости';
    } else {
        reason = 'Ты готов к большей нагрузке!';
    }

    return `${direction} нагрузку на ${percent}%. ${reason}`;
}
```

---

### 2.3 Включить сбор RIR (критично для адаптации)

**Файл**: `components/WorkoutView.tsx`

**Проблема**: RIR input закомментирован (строка ~873).

**Решение**: Вместо степпера использовать компактный dropdown:

```typescript
{/* RIR Selection - Compact dropdown */}
<select
    value={set.rir ?? ''}
    onChange={(e) => handleValueChange(currentExerciseIndex, setIndex, 'rir',
        e.target.value === '' ? undefined : Number(e.target.value))}
    className="w-14 h-8 rounded-lg bg-neutral-800 text-white text-xs text-center border border-white/10"
>
    <option value="">RIR</option>
    <option value="0">0</option>
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3+</option>
</select>
```

---

## ФАЗА 3: Полировка (P2)

### 3.1 Создать единый UserCapabilitiesSnapshot

**Новый файл**: `services/userCapabilities.ts`

```typescript
import { OnboardingProfile, WorkoutLog, TrainingProgram } from '../types';
import { calculateWeeklyVolume } from './volumeTracker';
import { calculateStrengthAnalysis, detectImbalances, analyzePainPatterns } from '../utils/strengthAnalysisUtils';
import { syncWeightsFromLogs } from '../utils/weightSync';

export interface UserCapabilitiesSnapshot {
    profile: OnboardingProfile;
    program: TrainingProgram;
    recentLogs: WorkoutLog[];

    // Calculated capabilities
    volumeReport: WeeklyVolumeReport;
    strengthAnalysis: StrengthAnalysis[];
    imbalances: ImbalanceReport[];
    painPatterns: PainPattern[];
    bestLifts: Map<string, { weight: number; reps: number; e1rm: number }>;

    // Program with actual weights
    syncedProgram: TrainingProgram;
}

export function createCapabilitiesSnapshot(
    profile: OnboardingProfile,
    program: TrainingProgram,
    logs: WorkoutLog[]
): UserCapabilitiesSnapshot {
    const recentLogs = logs.slice(-6);

    return {
        profile,
        program,
        recentLogs,
        volumeReport: calculateWeeklyVolume(recentLogs, profile.experience),
        strengthAnalysis: calculateStrengthAnalysis(logs, profile),
        imbalances: detectImbalances(logs, profile),
        painPatterns: analyzePainPatterns(logs),
        bestLifts: getBestLifts(logs, profile),
        syncedProgram: syncWeightsFromLogs(program, logs),
    };
}
```

**Использование в geminiService.ts**:
```typescript
export async function adaptPlan(
    program: TrainingProgram,
    logs: WorkoutLog[],
    profile: OnboardingProfile
): Promise<TrainingProgram> {
    const capabilities = createCapabilitiesSnapshot(profile, program, logs);
    const prompt = buildAdaptationPromptFromCapabilities(capabilities);
    ...
}
```

---

### 3.2 Добавить интеграционные тесты

**Новый файл**: `services/__tests__/integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createCapabilitiesSnapshot } from '../userCapabilities';
import { adaptPlan } from '../geminiService';
import { mockProfile, mockLogs, mockProgram } from '../../test/fixtures';

describe('User Capabilities Flow', () => {
    it('should include volume report in adaptation prompt', async () => {
        const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, mockLogs);

        expect(snapshot.volumeReport.muscles.length).toBeGreaterThan(0);
        expect(snapshot.strengthAnalysis.length).toBeGreaterThan(0);
    });

    it('should use best lifts for weight suggestions', () => {
        const snapshot = createCapabilitiesSnapshot(mockProfile, mockProgram, mockLogs);

        // User did bench press at 80kg x 8 = E1RM ~100kg
        const benchLift = snapshot.bestLifts.get('жим лежа');
        expect(benchLift).toBeDefined();
        expect(benchLift!.e1rm).toBeGreaterThan(80);
    });

    it('should apply mesocycle multiplier to displayed program', () => {
        const mesocycleState = {
            weekNumber: 5, // overreaching
            mesocycle: { volumeMultiplier: 1.2 }
        };

        const displayProgram = getProgramForCurrentPhase(mockProgram, mesocycleState);
        const originalSets = mockProgram.sessions[0].exercises[0].sets;
        const displayedSets = displayProgram.sessions[0].exercises[0].sets;

        expect(displayedSets).toBe(Math.ceil(originalSets * 1.2));
    });
});
```

---

## Порядок выполнения

| Приоритет | Задача | Файлы | Время |
|-----------|--------|-------|-------|
| P0.1 | Mesocycle → UI | App.tsx | 15 мин |
| P0.2 | Volume → AI prompt | geminiService.ts | 30 мин |
| P0.3 | E1RM → weights | programGenerator.ts, strengthAnalysisUtils.ts | 45 мин |
| P1.1 | Sync before adapt | App.tsx | 10 мин |
| P1.2 | Autoregulation explanation | App.tsx | 20 мин |
| P1.3 | Enable RIR | WorkoutView.tsx | 30 мин |
| P2.1 | UserCapabilitiesSnapshot | Новый файл | 1 час |
| P2.2 | Integration tests | Новый файл | 1 час |

---

## Ожидаемый результат

```
После исправлений:
┌─────────────────┐
│  WORKOUT LOGS   │
└────────┬────────┘
         │
    ┌────▼────────────────────────────────────────┐
    │         UserCapabilitiesSnapshot            │
    │  ┌──────────┬──────────┬──────────┐        │
    │  │ Volume   │ Strength │ Pain     │        │
    │  │ Report   │ Analysis │ Patterns │        │
    │  └────┬─────┴────┬─────┴────┬─────┘        │
    └───────┼──────────┼──────────┼──────────────┘
            │          │          │
            ▼          ▼          ▼
    ┌────────────────────────────────────┐
    │      AI ADAPTATION PROMPT          │
    │   (Получает ВСЕ данные!)           │
    └────────────────┬───────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────┐
    │           NEW PROGRAM              │
    └────────────────┬───────────────────┘
                     │
            getProgramForCurrentPhase()
                     │
                     ▼
    ┌────────────────────────────────────┐
    │   DASHBOARD (с mesocycle volume)   │
    └────────────────────────────────────┘
```

**Двигатель подключён к колёсам. Ferrari едет!**
