/**
 * Exercise Database
 *
 * Comprehensive database of exercises categorized by:
 * - Primary muscle group
 * - Movement pattern
 * - Equipment required
 * - Difficulty level
 *
 * Each muscle group has 5-8 exercises to allow for rotation.
 */

import {
  ExerciseDefinition,
  MovementPattern,
  EquipmentType,
  ExerciseDifficulty,
  ExerciseSlot,
  Location,
  LOCATION_EQUIPMENT,
} from '../types/training';

// ==========================================
// CHEST EXERCISES
// ==========================================

const CHEST_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'bench_press_barbell',
    name: 'Жим штанги лёжа',
    nameEn: 'Barbell Bench Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'beginner',
    repRanges: { strength: '3-5', hypertrophy: '6-12', endurance: '12-15' },
    notes: 'Лягте на скамью, стопы плотно на полу. Опускайте штангу до груди и выжимайте вверх, держа локти под углом 45 градусов к корпусу.',
  },
  {
    id: 'bench_press_dumbbell',
    name: 'Жим гантелей лёжа',
    nameEn: 'Dumbbell Bench Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Гантели держите по бокам груди, локти под 45 градусов. Выжимайте гантели вверх, сводя их в верхней точке над центром груди.',
  },
  {
    id: 'incline_bench_barbell',
    name: 'Жим штанги на наклонной скамье',
    nameEn: 'Incline Barbell Bench Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '4-6', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Наклон скамьи 30-45 градусов. Опускайте штангу на верх груди, выжимайте строго вертикально вверх.',
  },
  {
    id: 'incline_bench_dumbbell',
    name: 'Жим гантелей на наклонной скамье',
    nameEn: 'Incline Dumbbell Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Скамья под углом 30-45 градусов. Жмите гантели вверх, сводя их над верхом груди для максимального сокращения.',
  },
  {
    id: 'dumbbell_flyes',
    name: 'Разводка гантелей лёжа',
    nameEn: 'Dumbbell Flyes',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Разводите гантели в стороны с небольшим сгибом в локтях. Опускайте до растяжения груди, сводите по широкой дуге.',
  },
  {
    id: 'cable_crossover',
    name: 'Сведение рук в кроссовере',
    nameEn: 'Cable Crossover',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'intermediate',
    repRanges: { strength: '8-10', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Встаньте в центре кроссовера, слегка наклонитесь вперёд. Сводите руки перед собой по дуге, фокусируясь на сжатии грудных.',
  },
  {
    id: 'push_ups',
    name: 'Отжимания от пола',
    nameEn: 'Push-ups',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders', 'core'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '5-10', hypertrophy: '10-20', endurance: '20-30' },
    notes: 'Руки чуть шире плеч, тело прямое от головы до пят. Опускайтесь до касания грудью пола, держите локти под 45 градусов.',
  },
  {
    id: 'chest_press_machine',
    name: 'Жим в тренажёре на грудь',
    nameEn: 'Chest Press Machine',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '10-12', endurance: '12-15' },
    notes: 'Отрегулируйте высоту сиденья так, чтобы ручки были на уровне середины груди. Выжимайте плавно, не разгибая локти полностью.',
  },
];

// ==========================================
// BACK EXERCISES
// ==========================================

const BACK_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'barbell_row',
    name: 'Тяга штанги в наклоне',
    nameEn: 'Barbell Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rear_delts'],
    movementPattern: 'horizontal_pull',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '4-6', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Наклонитесь вперёд с прямой спиной, угол 45 градусов. Тяните штангу к низу живота, сводя лопатки в верхней точке.',
  },
  {
    id: 'dumbbell_row',
    name: 'Тяга гантели в наклоне',
    nameEn: 'One-Arm Dumbbell Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rear_delts'],
    movementPattern: 'horizontal_pull',
    isCompound: true,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Упритесь коленом и рукой в скамью, спина параллельна полу. Тяните гантель к поясу, не вращая корпус.',
  },
  {
    id: 'pull_ups',
    name: 'Подтягивания',
    nameEn: 'Pull-ups',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    movementPattern: 'vertical_pull',
    isCompound: true,
    equipment: ['bodyweight'],
    difficulty: 'intermediate',
    repRanges: { strength: '3-6', hypertrophy: '6-12', endurance: '12-15' },
    notes: 'Хват чуть шире плеч, подтягивайтесь до подбородка выше перекладины. Опускайтесь до полного распрямления рук.',
  },
  {
    id: 'lat_pulldown',
    name: 'Тяга верхнего блока',
    nameEn: 'Lat Pulldown',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    movementPattern: 'vertical_pull',
    isCompound: true,
    equipment: ['cable', 'machine'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Тяните рукоять к верху груди, отклоняясь слегка назад. Концентрируйтесь на работе широчайших, не тяните руками.',
  },
  {
    id: 'seated_cable_row',
    name: 'Тяга нижнего блока',
    nameEn: 'Seated Cable Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rear_delts'],
    movementPattern: 'horizontal_pull',
    isCompound: true,
    equipment: ['cable'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '10-12', endurance: '12-15' },
    notes: 'Сидя с прямой спиной, тяните рукоять к животу. Максимально сводите лопатки в конечной точке движения.',
  },
  {
    id: 't_bar_row',
    name: 'Тяга Т-грифа',
    nameEn: 'T-Bar Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rear_delts'],
    movementPattern: 'horizontal_pull',
    isCompound: true,
    equipment: ['barbell', 'machine'],
    difficulty: 'intermediate',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Стойте в наклоне над грифом, ноги по бокам. Тяните гриф к груди, сохраняя спину прямой.',
  },
  {
    id: 'inverted_row',
    name: 'Горизонтальные подтягивания',
    nameEn: 'Inverted Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rear_delts'],
    movementPattern: 'horizontal_pull',
    isCompound: true,
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '6-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Тело под углом, хват на низкой перекладине. Подтягивайтесь грудью к перекладине, держа тело прямым.',
  },
  {
    id: 'straight_arm_pulldown',
    name: 'Пуловер на блоке',
    nameEn: 'Straight-Arm Pulldown',
    primaryMuscle: 'back',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'intermediate',
    repRanges: { strength: '8-10', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Стойте прямо, тяните рукоять вниз прямыми руками. Фокусируйтесь на растяжении и сокращении широчайших мышц.',
  },
];

// ==========================================
// SHOULDER EXERCISES
// ==========================================

const SHOULDER_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'overhead_press_barbell',
    name: 'Жим штанги стоя',
    nameEn: 'Barbell Overhead Press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps', 'core'],
    movementPattern: 'vertical_push',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '3-6', hypertrophy: '6-10', endurance: '10-15' },
    notes: 'Жмите штангу от плеч строго вверх, ноги на ширине плеч. Не отклоняйтесь назад, держите корпус напряжённым.',
  },
  {
    id: 'overhead_press_dumbbell',
    name: 'Жим гантелей сидя',
    nameEn: 'Seated Dumbbell Press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    movementPattern: 'vertical_push',
    isCompound: true,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Сидя с опорой спины, жмите гантели вверх до касания в верхней точке. Опускайте до уровня ушей.',
  },
  {
    id: 'lateral_raise',
    name: 'Махи гантелей в стороны',
    nameEn: 'Lateral Raises',
    primaryMuscle: 'shoulders',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell', 'cable'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Поднимайте гантели в стороны до уровня плеч, локти слегка согнуты. Не раскачивайтесь, работайте только плечами.',
  },
  {
    id: 'front_raise',
    name: 'Подъём гантелей перед собой',
    nameEn: 'Front Raises',
    primaryMuscle: 'shoulders',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Поднимайте гантели перед собой до уровня глаз попеременно или вместе. Контролируйте движение, не бросайте вес вниз.',
  },
  {
    id: 'arnold_press',
    name: 'Жим Арнольда',
    nameEn: 'Arnold Press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    movementPattern: 'vertical_push',
    isCompound: true,
    equipment: ['dumbbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Начинайте с гантелями перед грудью ладонями к себе, разворачивайте и жмите вверх. Обратное движение с разворотом.',
  },
  {
    id: 'machine_shoulder_press',
    name: 'Жим в тренажёре на плечи',
    nameEn: 'Machine Shoulder Press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    movementPattern: 'vertical_push',
    isCompound: true,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '10-12', endurance: '12-15' },
    notes: 'Отрегулируйте высоту сиденья так, чтобы ручки были на уровне плеч. Жмите плавно вверх, не разгибая локти полностью.',
  },
  {
    id: 'cable_lateral_raise',
    name: 'Махи на блоке в сторону',
    nameEn: 'Cable Lateral Raise',
    primaryMuscle: 'shoulders',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'intermediate',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Стойте боком к блоку, тяните одной рукой в сторону до уровня плеча. Постоянное напряжение благодаря кабелю.',
  },
  {
    id: 'pike_push_ups',
    name: 'Отжимания уголком',
    nameEn: 'Pike Push-ups',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    movementPattern: 'vertical_push',
    isCompound: true,
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Примите позу угла (таз вверх), руки и ноги на полу. Отжимайтесь, опуская голову к рукам, акцент на плечи.',
  },
];

// ==========================================
// REAR DELT EXERCISES
// ==========================================

const REAR_DELT_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'face_pull',
    name: 'Тяга к лицу на блоке',
    nameEn: 'Face Pulls',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['back'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Тяните канат к лицу, разводя руки в стороны. Фокус на задних дельтах и сведении лопаток.',
  },
  {
    id: 'reverse_flyes',
    name: 'Обратные разведения гантелей',
    nameEn: 'Reverse Dumbbell Flyes',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['back'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Наклонитесь вперёд, разводите гантели в стороны и назад. Локти слегка согнуты, акцент на задних дельтах.',
  },
  {
    id: 'reverse_pec_deck',
    name: 'Обратная бабочка',
    nameEn: 'Reverse Pec Deck',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['back'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Сядьте лицом к тренажёру, разводите рукояти назад. Сводите лопатки, прожимайте задние дельты.',
  },
  {
    id: 'band_pull_apart',
    name: 'Разведение резинки перед собой',
    nameEn: 'Band Pull-Apart',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['back'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['resistance_band'],
    difficulty: 'beginner',
    repRanges: { strength: '12-15', hypertrophy: '15-20', endurance: '20-30' },
    notes: 'Держите резинку перед собой, разводите руки в стороны. Простое, но эффективное упражнение для задних дельт.',
  },
  {
    id: 'prone_y_raise',
    name: 'Y-подъём лёжа на животе',
    nameEn: 'Prone Y-Raise',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['back'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell', 'bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Лёжа на животе на наклонной скамье, поднимайте руки вверх в форме Y. Лёгкий вес, фокус на технике.',
  },
];

// ==========================================
// BICEPS EXERCISES
// ==========================================

const BICEPS_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'barbell_curl',
    name: 'Сгибание рук со штангой',
    nameEn: 'Barbell Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['barbell', 'ez_bar'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Локти прижаты к корпусу, сгибайте руки со штангой до полного сокращения бицепса. Опускайте подконтрольно.',
  },
  {
    id: 'dumbbell_curl',
    name: 'Сгибание рук с гантелями',
    nameEn: 'Dumbbell Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Сгибайте руки с гантелями попеременно или вместе, локти неподвижны. Можно с супинацией (разворотом кисти).',
  },
  {
    id: 'hammer_curl',
    name: 'Молотковые сгибания',
    nameEn: 'Hammer Curls',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-12', endurance: '12-15' },
    notes: 'Держите гантели нейтральным хватом (ладони друг к другу), сгибайте руки. Нагружает плечевую мышцу и бицепс.',
  },
  {
    id: 'incline_curl',
    name: 'Сгибания на наклонной скамье',
    nameEn: 'Incline Dumbbell Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '8-10', hypertrophy: '10-12', endurance: '12-15' },
    notes: 'Лёжа на наклонной скамье, руки опущены вниз. Сгибайте руки, чувствуя растяжение бицепса в нижней точке.',
  },
  {
    id: 'preacher_curl',
    name: 'Сгибания на скамье Скотта',
    nameEn: 'Preacher Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['barbell', 'dumbbell', 'ez_bar', 'machine'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-12', endurance: '12-15' },
    notes: 'Локти на подушке скамьи Скотта, сгибайте руки полностью. Изолирует бицепс, исключает читинг.',
  },
  {
    id: 'cable_curl',
    name: 'Сгибания на блоке',
    nameEn: 'Cable Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Сгибайте руки на нижнем блоке, постоянное напряжение мышц. Держите локти неподвижными.',
  },
  {
    id: 'concentration_curl',
    name: 'Концентрированные сгибания',
    nameEn: 'Concentration Curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Сидя, локоть упирается в бедро, сгибайте руку концентрированно. Максимальная изоляция бицепса.',
  },
];

// ==========================================
// TRICEPS EXERCISES
// ==========================================

const TRICEPS_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'tricep_pushdown',
    name: 'Разгибания на блоке',
    nameEn: 'Tricep Pushdown',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Разгибайте руки вниз на блоке, локти прижаты к корпусу. Полностью распрямляйте руки в нижней точке.',
  },
  {
    id: 'overhead_tricep_extension',
    name: 'Французский жим с гантелью',
    nameEn: 'Overhead Tricep Extension',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell', 'cable'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Гантель или рукоять над головой, разгибайте руки вверх. Локти держите неподвижно, работает только трицепс.',
  },
  {
    id: 'skull_crusher',
    name: 'Французский жим лёжа',
    nameEn: 'Skull Crushers',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['barbell', 'ez_bar', 'dumbbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Лёжа, опускайте штангу ко лбу, сгибая только в локтях. Разгибайте руки вверх, локти неподвижны.',
  },
  {
    id: 'close_grip_bench',
    name: 'Жим лёжа узким хватом',
    nameEn: 'Close-Grip Bench Press',
    primaryMuscle: 'triceps',
    secondaryMuscles: ['chest', 'shoulders'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Жим штанги узким хватом (уже плеч), локти ближе к корпусу. Опускайте на низ груди, акцент на трицепс.',
  },
  {
    id: 'dips',
    name: 'Отжимания на брусьях',
    nameEn: 'Dips',
    primaryMuscle: 'triceps',
    secondaryMuscles: ['chest', 'shoulders'],
    movementPattern: 'vertical_push',
    isCompound: true,
    equipment: ['bodyweight'],
    difficulty: 'intermediate',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Отжимайтесь на брусьях, корпус слегка вперёд. Опускайтесь до угла 90° в локтях, поднимайтесь силой трицепсов.',
  },
  {
    id: 'tricep_kickback',
    name: 'Отведение руки с гантелью назад',
    nameEn: 'Tricep Kickback',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['dumbbell', 'cable'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'В наклоне, разгибайте руку с гантелью назад до полного распрямления. Локоть и плечо неподвижны.',
  },
  {
    id: 'diamond_push_ups',
    name: 'Отжимания с узкой постановкой рук',
    nameEn: 'Diamond Push-ups',
    primaryMuscle: 'triceps',
    secondaryMuscles: ['chest'],
    movementPattern: 'horizontal_push',
    isCompound: true,
    equipment: ['bodyweight'],
    difficulty: 'intermediate',
    repRanges: { strength: '5-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Руки близко (ладони касаются), отжимайтесь с акцентом на трицепс. Локти вдоль корпуса.',
  },
];

// ==========================================
// QUAD EXERCISES
// ==========================================

const QUAD_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'barbell_squat',
    name: 'Приседания со штангой',
    nameEn: 'Barbell Back Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    movementPattern: 'squat',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '3-5', hypertrophy: '6-12', endurance: '12-15' },
    notes: 'Штанга на плечах, приседайте до параллели или ниже. Колени над носками, спина прямая, таз назад.',
  },
  {
    id: 'front_squat',
    name: 'Фронтальные приседания',
    nameEn: 'Front Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'core'],
    movementPattern: 'squat',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'advanced',
    repRanges: { strength: '3-6', hypertrophy: '6-10', endurance: '10-12' },
    notes: 'Штанга на передних дельтах, приседайте с вертикальным корпусом. Локти вверх, колени вперёд.',
  },
  {
    id: 'goblet_squat',
    name: 'Приседания с гантелью у груди',
    nameEn: 'Goblet Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'core'],
    movementPattern: 'squat',
    isCompound: true,
    equipment: ['dumbbell', 'kettlebell'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Держите гантель перед грудью двумя руками. Приседайте глубоко, локти между коленей, спина прямая.',
  },
  {
    id: 'leg_press',
    name: 'Жим ногами',
    nameEn: 'Leg Press',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    movementPattern: 'squat',
    isCompound: true,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Ноги на платформе на ширине плеч, выжимайте вес ногами. Не отрывайте поясницу, не разгибайте колени полностью.',
  },
  {
    id: 'leg_extension',
    name: 'Разгибание ног в тренажёре',
    nameEn: 'Leg Extension',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Сидя в тренажёре, разгибайте ноги до параллели с полом. Опускайте подконтрольно, не бросайте вес.',
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Приседания с задней ногой на опоре',
    nameEn: 'Bulgarian Split Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    movementPattern: 'lunge',
    isCompound: true,
    equipment: ['dumbbell', 'bodyweight'],
    difficulty: 'intermediate',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Задняя нога на возвышении, приседайте на передней ноге. Держите корпус вертикально, колено над носком.',
  },
  {
    id: 'walking_lunge',
    name: 'Выпады в ходьбе',
    nameEn: 'Walking Lunges',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    movementPattern: 'lunge',
    isCompound: true,
    equipment: ['dumbbell', 'bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-12', endurance: '12-20' },
    notes: 'Шагайте вперёд, приседая на переднюю ногу до угла 90°. Колено задней ноги почти касается пола.',
  },
  {
    id: 'bodyweight_squat',
    name: 'Приседания без веса',
    nameEn: 'Bodyweight Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    movementPattern: 'squat',
    isCompound: true,
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '15-20', hypertrophy: '20-30', endurance: '30-50' },
    notes: 'Приседайте без веса, руки перед собой для баланса. Опускайтесь до параллели, вставайте через пятки.',
  },
];

// ==========================================
// HAMSTRING EXERCISES
// ==========================================

const HAMSTRING_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'romanian_deadlift',
    name: 'Румынская тяга',
    nameEn: 'Romanian Deadlift',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'back'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['barbell', 'dumbbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Штанга у бёдер, опускайте её вдоль ног с небольшим сгибом коленей. Спина прямая, таз назад, чувствуйте растяжение бицепсов бедра.',
  },
  {
    id: 'stiff_leg_deadlift',
    name: 'Мёртвая тяга',
    nameEn: 'Stiff-Leg Deadlift',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'back'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['barbell', 'dumbbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Как румынская тяга, но с прямыми ногами. Опускайте штангу до середины голени, спина прямая.',
  },
  {
    id: 'lying_leg_curl',
    name: 'Сгибание ног лёжа',
    nameEn: 'Lying Leg Curl',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '6-8', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Лёжа на животе, сгибайте ноги к ягодицам. Полная амплитуда, опускайте вес подконтрольно.',
  },
  {
    id: 'seated_leg_curl',
    name: 'Сгибание ног сидя',
    nameEn: 'Seated Leg Curl',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Сидя в тренажёре, сгибайте ноги под себя. Фиксируйте корпус, работайте только ногами.',
  },
  {
    id: 'good_morning',
    name: 'Наклоны со штангой на плечах',
    nameEn: 'Good Morning',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'back'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'advanced',
    repRanges: { strength: '5-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Штанга на плечах, наклоняйтесь вперёд с прямой спиной. Таз назад, колени чуть согнуты, до параллели.',
  },
  {
    id: 'nordic_curl',
    name: 'Негативные сгибания ног',
    nameEn: 'Nordic Curl',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['bodyweight'],
    difficulty: 'advanced',
    repRanges: { strength: '3-5', hypertrophy: '5-8', endurance: '8-12' },
    notes: 'Колени зафиксированы, опускайте корпус вперёд контролируя негативную фазу. Очень сложное упражнение.',
  },
  {
    id: 'single_leg_rdl',
    name: 'Румынская тяга на одной ноге',
    nameEn: 'Single-Leg RDL',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'core'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['dumbbell', 'kettlebell', 'bodyweight'],
    difficulty: 'intermediate',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'На одной ноге, опускайте корпус вперёд, вторая нога назад для баланса. Гантель в противоположной руке.',
  },
];

// ==========================================
// GLUTE EXERCISES
// ==========================================

const GLUTE_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'hip_thrust',
    name: 'Ягодичный мостик со штангой',
    nameEn: 'Barbell Hip Thrust',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'intermediate',
    repRanges: { strength: '6-8', hypertrophy: '8-12', endurance: '12-15' },
    notes: 'Спина на скамье, штанга на бёдрах, выталкивайте таз вверх. Сжимайте ягодицы в верхней точке.',
  },
  {
    id: 'glute_bridge',
    name: 'Ягодичный мостик',
    nameEn: 'Glute Bridge',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['bodyweight', 'dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-20', endurance: '20-30' },
    notes: 'Лёжа на полу, стопы у ягодиц, поднимайте таз вверх. Сжимайте ягодицы в верхней точке, задержитесь.',
  },
  {
    id: 'cable_pull_through',
    name: 'Тяга каната между ног',
    nameEn: 'Cable Pull-Through',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['cable'],
    difficulty: 'intermediate',
    repRanges: { strength: '8-10', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Спиной к блоку, канат между ног, выпрямляйтесь движением таза вперёд. Акцент на ягодицах.',
  },
  {
    id: 'cable_kickback',
    name: 'Отведение ноги на блоке',
    nameEn: 'Cable Kickback',
    primaryMuscle: 'glutes',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Стоя у блока, отводите ногу назад против сопротивления. Сжимайте ягодицу в верхней точке.',
  },
  {
    id: 'sumo_deadlift',
    name: 'Тяга сумо',
    nameEn: 'Sumo Deadlift',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['quads', 'hamstrings', 'back'],
    movementPattern: 'hinge',
    isCompound: true,
    equipment: ['barbell'],
    difficulty: 'advanced',
    repRanges: { strength: '3-5', hypertrophy: '5-8', endurance: '8-12' },
    notes: 'Широкая стойка, носки врозь, тяните штангу вертикально вверх. Спина прямая, акцент на ягодицах и внутренней поверхности бёдер.',
  },
  {
    id: 'step_ups',
    name: 'Зашагивания на платформу',
    nameEn: 'Step-Ups',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['quads'],
    movementPattern: 'lunge',
    isCompound: true,
    equipment: ['dumbbell', 'bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Зашагивайте на платформу, поднимаясь силой передней ноги. Опускайтесь подконтрольно, не бросайтесь вниз.',
  },
];

// ==========================================
// CALF EXERCISES
// ==========================================

const CALF_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'standing_calf_raise',
    name: 'Подъём на носки стоя',
    nameEn: 'Standing Calf Raise',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['machine', 'barbell', 'dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '12-15', endurance: '15-25' },
    notes: 'Стоя, поднимайтесь на носки максимально высоко. Опускайтесь до растяжения икр, полная амплитуда.',
  },
  {
    id: 'seated_calf_raise',
    name: 'Подъём на носки сидя',
    nameEn: 'Seated Calf Raise',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '15-20', endurance: '20-30' },
    notes: 'Сидя, вес на коленях, поднимайтесь на носки. Работает камбаловидная мышца, полная амплитуда.',
  },
  {
    id: 'leg_press_calf_raise',
    name: 'Подъём на носки в жиме ногами',
    nameEn: 'Leg Press Calf Raise',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['machine'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '15-20', endurance: '20-25' },
    notes: 'В жиме ногами, работайте только носками. Полное распрямление и растяжение икр.',
  },
  {
    id: 'single_leg_calf_raise',
    name: 'Подъём на носки на одной ноге',
    nameEn: 'Single-Leg Calf Raise',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['bodyweight', 'dumbbell'],
    difficulty: 'beginner',
    repRanges: { strength: '10-12', hypertrophy: '15-20', endurance: '20-30' },
    notes: 'На одной ноге, поднимайтесь на носок. Можно держаться для баланса, полная амплитуда.',
  },
];

// ==========================================
// CORE EXERCISES
// ==========================================

const CORE_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'plank',
    name: 'Планка',
    nameEn: 'Plank',
    primaryMuscle: 'core',
    secondaryMuscles: ['shoulders'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '30-60s', hypertrophy: '45-90s', endurance: '60-120s' },
    notes: 'Упор на предплечья и носки, тело прямое как доска. Напрягайте пресс и ягодицы, не прогибайтесь.',
  },
  {
    id: 'hanging_leg_raise',
    name: 'Подъём ног в висе',
    nameEn: 'Hanging Leg Raise',
    primaryMuscle: 'core',
    secondaryMuscles: ['forearms'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['bodyweight'],
    difficulty: 'intermediate',
    repRanges: { strength: '6-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'Вис на перекладине, поднимайте прямые ноги до параллели или выше. Не раскачивайтесь, работайте прессом.',
  },
  {
    id: 'cable_crunch',
    name: 'Скручивания на блоке',
    nameEn: 'Cable Crunch',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['cable'],
    difficulty: 'intermediate',
    repRanges: { strength: '10-12', hypertrophy: '12-20', endurance: '20-30' },
    notes: 'На коленях у блока, скручивайтесь вперёд. Тяните локтями к коленям, округляя спину.',
  },
  {
    id: 'ab_wheel_rollout',
    name: 'Ролик для пресса',
    nameEn: 'Ab Wheel Rollout',
    primaryMuscle: 'core',
    secondaryMuscles: ['shoulders', 'back'],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['bodyweight'],
    difficulty: 'intermediate',
    repRanges: { strength: '6-10', hypertrophy: '10-15', endurance: '15-20' },
    notes: 'На коленях с роликом, раскатывайтесь вперёд. Спина прямая, возвращайтесь силой пресса.',
  },
  {
    id: 'russian_twist',
    name: 'Скручивания с поворотом',
    nameEn: 'Russian Twist',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    movementPattern: 'rotation',
    isCompound: false,
    equipment: ['bodyweight', 'dumbbell', 'kettlebell'],
    difficulty: 'beginner',
    repRanges: { strength: '10-15', hypertrophy: '15-20', endurance: '20-30' },
    notes: 'Сидя с поднятыми ногами, вращайте корпус из стороны в сторону. Можно с весом, акцент на косых мышцах.',
  },
  {
    id: 'dead_bug',
    name: 'Поочерёдные подъёмы рук и ног лёжа',
    nameEn: 'Dead Bug',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '8-10', hypertrophy: '12-15', endurance: '15-20' },
    notes: 'Лёжа на спине, попеременно опускайте противоположные руку и ногу. Поясница прижата к полу, работает глубокий пресс.',
  },
  {
    id: 'crunches',
    name: 'Скручивания',
    nameEn: 'Crunches',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    movementPattern: 'isolation',
    isCompound: false,
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    repRanges: { strength: '15-20', hypertrophy: '20-30', endurance: '30-50' },
    notes: 'Лёжа, ноги согнуты, скручивайтесь отрывая лопатки от пола. Не тяните за голову, работайте прессом.',
  },
];

// ==========================================
// ALL EXERCISES COMBINED
// ==========================================

export const ALL_EXERCISES: ExerciseDefinition[] = [
  ...CHEST_EXERCISES,
  ...BACK_EXERCISES,
  ...SHOULDER_EXERCISES,
  ...REAR_DELT_EXERCISES,
  ...BICEPS_EXERCISES,
  ...TRICEPS_EXERCISES,
  ...QUAD_EXERCISES,
  ...HAMSTRING_EXERCISES,
  ...GLUTE_EXERCISES,
  ...CALF_EXERCISES,
  ...CORE_EXERCISES,
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get exercise by ID
 */
export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return ALL_EXERCISES.find(e => e.id === id);
}

/**
 * Get exercises for a specific muscle group
 */
export function getExercisesByMuscle(muscleId: string): ExerciseDefinition[] {
  return ALL_EXERCISES.filter(e => e.primaryMuscle === muscleId);
}

/**
 * Get exercises for a specific movement pattern
 */
export function getExercisesByMovementPattern(pattern: MovementPattern): ExerciseDefinition[] {
  return ALL_EXERCISES.filter(e => e.movementPattern === pattern);
}

/**
 * Get exercises available for a specific location/equipment setup
 */
export function getExercisesForLocation(location: Location): ExerciseDefinition[] {
  const availableEquipment = LOCATION_EQUIPMENT[location];
  return ALL_EXERCISES.filter(e =>
    e.equipment.some(eq => availableEquipment.includes(eq))
  );
}

/**
 * Get exercises suitable for a specific slot
 * Considers muscle group, movement pattern, equipment, and difficulty
 */
export function getExercisesForSlot(
  slot: ExerciseSlot,
  location: Location,
  maxDifficulty: ExerciseDifficulty = 'advanced',
  excludeIds: string[] = []
): ExerciseDefinition[] {
  const availableEquipment = LOCATION_EQUIPMENT[location];
  const difficultyOrder: ExerciseDifficulty[] = ['beginner', 'intermediate', 'advanced'];
  const maxDifficultyIndex = difficultyOrder.indexOf(maxDifficulty);

  return ALL_EXERCISES.filter(e => {
    // Must match muscle group
    if (e.primaryMuscle !== slot.muscleGroup) return false;

    // Must match compound/isolation
    if (e.isCompound !== slot.isCompound) return false;

    // Must have available equipment
    if (!e.equipment.some(eq => availableEquipment.includes(eq))) return false;

    // Difficulty must not exceed max
    const exerciseDifficultyIndex = difficultyOrder.indexOf(e.difficulty);
    if (exerciseDifficultyIndex > maxDifficultyIndex) return false;

    // Must not be excluded
    if (excludeIds.includes(e.id)) return false;

    // Movement pattern should match (or be isolation which is flexible)
    if (slot.movementPattern !== 'isolation' && e.movementPattern !== slot.movementPattern) {
      // Allow some flexibility for compound movements
      if (e.movementPattern !== 'isolation') return false;
    }

    return true;
  });
}

/**
 * Get a random exercise for a slot
 */
export function getRandomExerciseForSlot(
  slot: ExerciseSlot,
  location: Location,
  maxDifficulty: ExerciseDifficulty = 'advanced',
  excludeIds: string[] = []
): ExerciseDefinition | undefined {
  const candidates = getExercisesForSlot(slot, location, maxDifficulty, excludeIds);
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Get alternative exercises for an existing exercise
 */
export function getAlternativeExercises(
  currentExercise: ExerciseDefinition,
  location: Location,
  count: number = 3
): ExerciseDefinition[] {
  const availableEquipment = LOCATION_EQUIPMENT[location];

  const alternatives = ALL_EXERCISES.filter(e => {
    if (e.id === currentExercise.id) return false;
    if (e.primaryMuscle !== currentExercise.primaryMuscle) return false;
    if (!e.equipment.some(eq => availableEquipment.includes(eq))) return false;
    return true;
  });

  // Shuffle and return requested count
  const shuffled = alternatives.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Check if an exercise is suitable given user's injuries
 */
export function isExerciseSafe(
  exercise: ExerciseDefinition,
  injuries?: string
): boolean {
  if (!injuries || !exercise.contraindications) return true;

  const injuryLower = injuries.toLowerCase();
  return !exercise.contraindications.some(c =>
    injuryLower.includes(c.toLowerCase())
  );
}

/**
 * Get compound exercises count vs isolation for a list
 */
export function getCompoundIsolationRatio(exercises: ExerciseDefinition[]): {
  compound: number;
  isolation: number;
  ratio: number;
} {
  const compound = exercises.filter(e => e.isCompound).length;
  const isolation = exercises.length - compound;
  return {
    compound,
    isolation,
    ratio: exercises.length > 0 ? compound / exercises.length : 0,
  };
}
