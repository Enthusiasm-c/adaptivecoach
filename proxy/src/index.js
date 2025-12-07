import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import cron from 'node-cron';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// Neon DB connection
const sql = neon(process.env.DATABASE_URL);

// Database migration
async function runMigrations() {
  try {
    // Check if workout_logs exists and has correct structure
    const tableCheck = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'workout_logs' AND column_name = 'workout_date'
    `;

    if (tableCheck.length === 0) {
      // Drop old table if exists (might have wrong schema)
      await sql`DROP TABLE IF EXISTS workout_logs CASCADE`;

      // 1. workout_logs table - use workout_date to avoid reserved word issues
      await sql`CREATE TABLE workout_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        workout_date DATE NOT NULL,
        start_time TIMESTAMPTZ,
        duration INTEGER,
        total_volume INTEGER DEFAULT 0,
        exercises_data JSONB NOT NULL,
        feedback_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        UNIQUE(user_id, workout_date, session_id)
      )`;
      console.log('Created workout_logs table');
    }
    await sql`CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, workout_date DESC)`;

    // 2. badge_definitions table
    await sql`CREATE TABLE IF NOT EXISTS badge_definitions (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name_ru TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description_ru TEXT NOT NULL,
      description_en TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL,
      tier TEXT DEFAULT 'bronze',
      threshold INTEGER,
      is_secret BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    // 3. user_badges table
    await sql`CREATE TABLE IF NOT EXISTS user_badges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id INTEGER NOT NULL REFERENCES badge_definitions(id),
      earned_at TIMESTAMPTZ DEFAULT NOW(),
      workout_log_id INTEGER REFERENCES workout_logs(id),
      UNIQUE(user_id, badge_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id)`;

    // 4. kudos table
    await sql`CREATE TABLE IF NOT EXISTS kudos (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workout_log_id INTEGER REFERENCES workout_logs(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL DEFAULT 'workout',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(sender_id, workout_log_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_kudos_recipient ON kudos(recipient_id, created_at DESC)`;

    // 5. challenges table
    await sql`CREATE TABLE IF NOT EXISTS challenges (
      id SERIAL PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      challenge_type TEXT NOT NULL,
      target_value INTEGER,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    // 6. challenge_participants table
    await sql`CREATE TABLE IF NOT EXISTS challenge_participants (
      id SERIAL PRIMARY KEY,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      current_value INTEGER DEFAULT 0,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(challenge_id, user_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_challenge_participants ON challenge_participants(challenge_id)`;

    // 7. Seed badge definitions
    const badges = [
      ['streak_7', 'Неделя огня', 'Week of Fire', 'Тренировки 7 дней подряд', '7-day training streak', '🔥', 'streak', 'bronze', 7],
      ['streak_30', 'Месяц силы', 'Month of Power', 'Тренировки 30 дней подряд', '30-day training streak', '💪', 'streak', 'silver', 30],
      ['streak_100', 'Легендарный streak', 'Legendary Streak', 'Тренировки 100 дней подряд', '100-day training streak', '🏆', 'streak', 'gold', 100],
      ['volume_1t', 'Первая тонна', 'First Ton', 'Подняли 1 тонну суммарно', 'Lifted 1 ton total', '🏋️', 'volume', 'bronze', 1000],
      ['volume_10t', 'Десятник', 'Heavy Lifter', 'Подняли 10 тонн суммарно', 'Lifted 10 tons total', '⚡', 'volume', 'silver', 10000],
      ['volume_100t', 'Сотня тонн', 'Iron Machine', 'Подняли 100 тонн суммарно', 'Lifted 100 tons total', '🦾', 'volume', 'gold', 100000],
      ['pr_new', 'Новый рекорд!', 'New PR!', 'Побили личный рекорд', 'Beat a personal record', '🎯', 'pr', 'bronze', 1],
      ['pr_5', 'Рекордсмен', 'Record Breaker', '5 личных рекордов', '5 personal records', '⭐', 'pr', 'silver', 5],
      ['first_friend', 'Дружба', 'Friendship', 'Добавили первого друга', 'Added first friend', '🤝', 'social', 'bronze', 1],
      ['squad_5', 'Команда', 'Squad', '5 друзей в команде', '5 friends in squad', '👥', 'social', 'silver', 5],
      ['first_workout', 'Первый шаг', 'First Step', 'Завершили первую тренировку', 'Completed first workout', '🎉', 'milestone', 'bronze', 1],
      ['workouts_10', 'Десятка', 'Ten Done', '10 тренировок завершено', '10 workouts completed', '🔟', 'milestone', 'bronze', 10],
      ['workouts_50', 'Полтинник', 'Fifty Strong', '50 тренировок завершено', '50 workouts completed', '5️⃣', 'milestone', 'silver', 50],
      ['workouts_100', 'Сотня', 'Century', '100 тренировок завершено', '100 workouts completed', '💯', 'milestone', 'gold', 100]
    ];

    for (const [code, name_ru, name_en, desc_ru, desc_en, icon, category, tier, threshold] of badges) {
      await sql`
        INSERT INTO badge_definitions (code, name_ru, name_en, description_ru, description_en, icon, category, tier, threshold)
        VALUES (${code}, ${name_ru}, ${name_en}, ${desc_ru}, ${desc_en}, ${icon}, ${category}, ${tier}, ${threshold})
        ON CONFLICT (code) DO NOTHING
      `;
    }

    // 8. user_notification_settings table
    await sql`CREATE TABLE IF NOT EXISTS user_notification_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      preferred_days INTEGER[] DEFAULT '{1,3,5}',
      reminder_time TIME DEFAULT '08:00',
      reminder_enabled BOOLEAN DEFAULT true,
      timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
      last_notification_at TIMESTAMPTZ,
      notification_response_rate FLOAT DEFAULT 1.0,
      notifications_this_week INTEGER DEFAULT 0,
      last_week_reset DATE DEFAULT CURRENT_DATE,
      consecutive_ignores INTEGER DEFAULT 0,
      paused_until DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    // 9. notification_logs table
    await sql`CREATE TABLE IF NOT EXISTS notification_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message_type VARCHAR(50),
      message_template VARCHAR(200),
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      opened_app BOOLEAN DEFAULT false,
      opened_at TIMESTAMPTZ
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id, sent_at DESC)`;

    console.log('Database migrations completed successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

// Run migrations on startup
runMigrations();

// ============ NOTIFICATION SYSTEM ============

const MESSAGE_TEMPLATES = {
  workout_reminder: [
    "🌅 Доброе утро, {name}!\n\nСегодня по плану {workout_type}. Помнишь упражнения?\nЖду тебя! 💪",
    "Привет, {name}! 💪 Сегодня {workout_type} - твой любимый день! Жду тебя в зале!",
    "{name}, готов к {workout_type}? Твои мышцы соскучились! 🔥",
    "Чемпион {name}! День {workout_type} ждёт. Покажем что можем? 💪",
    "Эй {name}, я тут сижу один... А сегодня же {workout_type}! 🥺",
    "{name}, твой план тренировок скучает! Сегодня {workout_type} по расписанию 📅",
  ],
  workout_reminder_streak: [
    "{name}, у тебя {streak} дней стрик! 🔥 Не сломай его, сегодня {workout_type}!",
    "Wow {name}! {streak} дней подряд! Сегодня {workout_type} - продолжаем? 🏆",
  ],
  streak_at_risk: [
    "Эй {name}! 🔥\n\n{streak} дней подряд - отличный результат!\nДо конца дня осталось {hours} часов чтобы не потерять стрик.\n\nДаже 10 минут лучше чем ничего!",
    "{name}, твой {streak}-дневный стрик под угрозой! 😱 Осталось {hours} часов!",
    "Не дай стрику сгореть, {name}! {streak} дней работы... Зайди хотя бы на минуту! 🔥",
  ],
  comeback: [
    "Привет {name}! 👋\n\nКак ты? Давно не виделись...\nТвои мышцы скучают! 😢\n\nЕсли что-то пошло не так - просто напиши мне.\nЕсли просто забыл - давай вернёмся!",
    "{name}, давно тебя не было! Соскучился 😢 Как ты?",
    "Привет {name}! Всё в порядке? Твой план тренировок ждёт... 💪",
    "{name}, прошла неделя... Может вернёмся к тренировкам? Я верю в тебя! 🙏",
  ],
  weekly_summary: [
    "📊 {name}, итоги недели!\n\n✅ Тренировок: {workouts}\n💪 Объём: {volume} кг\n🔥 Стрик: {streak} дней\n{trend_emoji} Прогресс: {trend}\n\n{comment}\n\nУвидимся на следующей неделе! 🚀",
  ],
  achievement: [
    "🏆 {name}, НОВЫЙ РЕКОРД!\n\n{exercise}: {weight} кг (+{delta} кг!)\n\nТы становишься сильнее! 💪",
    "🎯 {name}, личный рекорд в {exercise}!\n\n{weight} кг - новая вершина! 🔥",
  ],
};

const WORKOUT_NAMES = {
  'upper': 'верха тела',
  'lower': 'ног',
  'push': 'жимов',
  'pull': 'тяг',
  'full': 'всего тела',
  'chest': 'груди',
  'back': 'спины',
  'shoulders': 'плеч',
  'arms': 'рук',
  'legs': 'ног',
  'core': 'кора',
};

function getRandomTemplate(templates) {
  return templates[Math.floor(Math.random() * templates.length)];
}

function personalizeMessage(template, data) {
  return template
    .replace(/{name}/g, data.name || 'Чемпион')
    .replace(/{workout_type}/g, data.workoutType || 'тренировки')
    .replace(/{streak}/g, data.streak || 0)
    .replace(/{hours}/g, data.hours || 4)
    .replace(/{workouts}/g, data.workouts || 0)
    .replace(/{volume}/g, data.volume || 0)
    .replace(/{trend_emoji}/g, data.trendEmoji || '📈')
    .replace(/{trend}/g, data.trend || 'стабильно')
    .replace(/{comment}/g, data.comment || 'Продолжай в том же духе! 💪')
    .replace(/{exercise}/g, data.exercise || 'упражнении')
    .replace(/{weight}/g, data.weight || 0)
    .replace(/{delta}/g, data.delta || 0);
}

function getPersonalizedComment(workouts, targetWorkouts, volumeDelta, streak) {
  if (workouts === 0) {
    return "На этой неделе пропустили. Бывает! Главное - вернуться 💪";
  }
  if (workouts >= (targetWorkouts || 3)) {
    return "План выполнен! Ты машина! 🎉";
  }
  if (volumeDelta > 0) {
    return `Объём вырос на ${volumeDelta}кг! Прогресс идёт! 📈`;
  }
  if (streak >= 7 && streak % 7 === 0) {
    return `${streak} дней подряд - это уже привычка! 🔥`;
  }
  return "Продолжай в том же духе! 💪";
}

// Helper to check if can send notification
async function canSendNotification(userId) {
  const settings = await sql`
    SELECT * FROM user_notification_settings WHERE user_id = ${userId}
  `;

  if (settings.length === 0) return { canSend: false, reason: 'no_settings' };
  const s = settings[0];

  if (!s.reminder_enabled) return { canSend: false, reason: 'disabled' };
  if (s.paused_until && new Date(s.paused_until) > new Date()) return { canSend: false, reason: 'paused' };
  if (s.notifications_this_week >= 3) return { canSend: false, reason: 'weekly_limit' };

  // Cooldown: min 2 days between messages
  if (s.last_notification_at) {
    const daysSince = (Date.now() - new Date(s.last_notification_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 2) return { canSend: false, reason: 'cooldown' };
  }

  // Adaptive frequency based on response rate
  if (s.notification_response_rate < 0.3) {
    if (Math.random() > s.notification_response_rate) {
      return { canSend: false, reason: 'low_engagement' };
    }
  }

  return { canSend: true, settings: s };
}

// Log notification and update counters
async function logNotification(userId, messageType, template) {
  await sql`
    INSERT INTO notification_logs (user_id, message_type, message_template)
    VALUES (${userId}, ${messageType}, ${template.substring(0, 200)})
  `;

  await sql`
    UPDATE user_notification_settings
    SET last_notification_at = NOW(),
        notifications_this_week = notifications_this_week + 1
    WHERE user_id = ${userId}
  `;
}

// Reset weekly counter (called Monday 00:00)
async function resetWeeklyCounters() {
  await sql`
    UPDATE user_notification_settings
    SET notifications_this_week = 0,
        last_week_reset = CURRENT_DATE
    WHERE last_week_reset < CURRENT_DATE - 6
  `;
  console.log('[CRON] Weekly notification counters reset');
}

// Get today's workout type for user
async function getTodayWorkoutType(userId, dayOfWeek) {
  // Try to get from latest workout log's session_id pattern
  const recent = await sql`
    SELECT session_id FROM workout_logs
    WHERE user_id = ${userId}
    ORDER BY workout_date DESC LIMIT 1
  `;

  if (recent.length > 0) {
    const sessionId = recent[0].session_id || '';
    for (const [key, name] of Object.entries(WORKOUT_NAMES)) {
      if (sessionId.toLowerCase().includes(key)) {
        return name;
      }
    }
  }

  // Fallback based on day
  const dayWorkouts = ['отдыха', 'тренировки', 'тренировки', 'тренировки', 'тренировки', 'тренировки', 'активного восстановления'];
  return dayWorkouts[dayOfWeek] || 'тренировки';
}

// Telegram Bot Token
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Logger setup
const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
    new transports.Console({ format: format.combine(format.colorize(), format.simple()) })
  ]
});

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  'https://adaptivecoach.vercel.app',
  'https://web.telegram.org',
  process.env.ALLOWED_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.includes(allowed) || allowed.includes(origin))) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Rate limiting
app.use(rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many requests' } }));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  req.requestId = uuidv4();
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, duration: Date.now() - start });
  });
  next();
});

// API Key validation
const validateApiKey = (req, res, next) => {
  const clientKey = req.headers['x-api-key'];
  if (!clientKey || clientKey !== process.env.CLIENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Telegram initData validation
function validateTelegramWebAppData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    const dataCheckArr = [];
    urlParams.sort();
    urlParams.forEach((val, key) => dataCheckArr.push(key + '=' + val));
    const dataCheckString = dataCheckArr.join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculatedHash !== hash) return null;
    const userStr = urlParams.get('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    logger.error({ message: 'Failed to validate initData', error: e.message });
    return null;
  }
}

// Auth middleware
const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  const user = validateTelegramWebAppData(initData);
  if (!user) return res.status(401).json({ error: 'Invalid Telegram authentication' });
  req.telegramUser = user;
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug: list all users (temporary)
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await sql`SELECT id, telegram_id, telegram_username, first_name FROM users ORDER BY id DESC LIMIT 20`;
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ AUTH ENDPOINTS ============

app.post('/api/auth/validate', async (req, res) => {
  try {
    const { initData } = req.body;
    const user = validateTelegramWebAppData(initData);
    if (!user) return res.status(401).json({ error: 'Invalid Telegram data' });

    const result = await sql`
      INSERT INTO users (telegram_id, telegram_username, first_name, photo_url)
      VALUES (${user.id}, ${user.username || null}, ${user.first_name || 'User'}, ${user.photo_url || null})
      ON CONFLICT (telegram_id) DO UPDATE SET
        telegram_username = EXCLUDED.telegram_username,
        first_name = EXCLUDED.first_name,
        photo_url = EXCLUDED.photo_url,
        updated_at = NOW()
      RETURNING id, telegram_id, first_name, is_pro, pro_expires_at
    `;

    const dbUser = result[0];
    let isPro = dbUser.is_pro;
    if (isPro && dbUser.pro_expires_at && new Date(dbUser.pro_expires_at) < new Date()) {
      isPro = false;
      await sql`UPDATE users SET is_pro = false WHERE id = ${dbUser.id}`;
    }

    res.json({
      success: true,
      user: {
        id: dbUser.id,
        telegramId: dbUser.telegram_id,
        firstName: dbUser.first_name,
        isPro: isPro,
        proExpiresAt: dbUser.pro_expires_at
      }
    });
  } catch (error) {
    logger.error({ message: 'Auth validate error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await sql`
      SELECT id, telegram_id, first_name, is_pro, pro_expires_at
      FROM users WHERE telegram_id = ${req.telegramUser.id}
    `;
    if (result.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result[0];
    res.json({
      id: user.id,
      telegramId: user.telegram_id,
      firstName: user.first_name,
      isPro: user.is_pro && (!user.pro_expires_at || new Date(user.pro_expires_at) > new Date()),
      proExpiresAt: user.pro_expires_at
    });
  } catch (error) {
    logger.error({ message: 'Get user error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ PAYMENT ENDPOINTS ============

app.post('/api/payments/create-invoice', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.body;
    const telegramId = req.telegramUser.id;
    if (itemId !== 'pro_monthly') return res.status(400).json({ error: 'Invalid item' });

    const payload = 'pro_' + telegramId + '_' + Date.now();
    const invoiceResponse = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/createInvoiceLink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Sensei Pro',
        description: 'AI тренер на месяц: умная адаптация, чат с тренером, аналитика',
        payload: payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: 'Pro подписка (30 дней)', amount: 5 }]
      })
    });

    const invoiceData = await invoiceResponse.json();
    if (!invoiceData.ok) {
      logger.error({ message: 'Failed to create invoice', error: invoiceData });
      return res.status(500).json({ error: 'Failed to create invoice' });
    }

    logger.info({ message: 'Invoice created', telegramId, payload });
    res.json({ success: true, invoiceLink: invoiceData.result });
  } catch (error) {
    logger.error({ message: 'Create invoice error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/payments/status', authMiddleware, async (req, res) => {
  try {
    const result = await sql`
      SELECT is_pro, pro_expires_at FROM users WHERE telegram_id = ${req.telegramUser.id}
    `;
    if (result.length === 0) return res.json({ isPro: false, expiresAt: null });
    const user = result[0];
    res.json({
      isPro: user.is_pro && (!user.pro_expires_at || new Date(user.pro_expires_at) > new Date()),
      expiresAt: user.pro_expires_at
    });
  } catch (error) {
    logger.error({ message: 'Payment status error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Telegram Bot API helper
async function sendTelegramMessage(chatId, text, options = {}) {
  await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...options
    })
  });
}

// Bot command handlers
async function handleBotCommand(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const firstName = message.from.first_name || 'друг';

  // /start command
  if (text.startsWith('/start')) {
    // Check for referral parameter: /start ref_123456
    const refMatch = text.match(/\/start\s+ref_(\d+)/);

    if (refMatch) {
      const referrerTelegramId = parseInt(refMatch[1]);
      const newUserTelegramId = message.from.id;

      // Don't allow self-referral
      if (referrerTelegramId !== newUserTelegramId) {
        try {
          // Create new user in DB
          const newUserResult = await sql`
            INSERT INTO users (telegram_id, telegram_username, first_name, photo_url)
            VALUES (${newUserTelegramId}, ${message.from.username || null}, ${message.from.first_name || 'User'}, null)
            ON CONFLICT (telegram_id) DO UPDATE SET
              telegram_username = EXCLUDED.telegram_username,
              first_name = EXCLUDED.first_name
            RETURNING id
          `;
          const newUserDbId = newUserResult[0].id;

          // Find referrer
          const referrerResult = await sql`SELECT id FROM users WHERE telegram_id = ${referrerTelegramId}`;

          if (referrerResult.length > 0) {
            const referrerDbId = referrerResult[0].id;

            // Create friendship (auto-accepted)
            await sql`
              INSERT INTO friendships (requester_id, addressee_id, status)
              VALUES (${referrerDbId}, ${newUserDbId}, 'accepted')
              ON CONFLICT DO NOTHING
            `;

            // Notify referrer
            await sendTelegramMessage(referrerTelegramId,
              `🎉 <b>${message.from.first_name}</b> присоединился к Sensei Training по твоей ссылке! Теперь вы друзья.`
            );

            logger.info({ message: 'Referral friendship created', referrer: referrerTelegramId, newUser: newUserTelegramId });
          }
        } catch (e) {
          logger.error({ message: 'Referral processing error', error: e.message });
        }
      }
    }

    const welcomeText = `<b>Привет, ${firstName}!</b>

Добро пожаловать в <b>Sensei Training</b> — твой адаптивный AI-тренер.

<b>Возможности:</b>
• Индивидуальные планы тренировок
• Адаптация нагрузки под твой прогресс
• Ответы на вопросы о технике и питании
• Отслеживание результатов

<b>Pro подписка</b> открывает безлимитный чат с тренером, продвинутую аналитику и прогноз рекордов.`;

    await sendTelegramMessage(chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть приложение', web_app: { url: 'https://adaptivecoach.vercel.app' } }],
          [{ text: 'Pro подписка', callback_data: 'pricing' }],
          [{ text: 'FAQ', callback_data: 'faq' }, { text: 'Как это работает', callback_data: 'how_it_works' }]
        ]
      }
    });
    return;
  }

  // /help command
  if (text === '/help') {
    const helpText = `<b>Помощь</b>

<b>Команды:</b>
/start — Главное меню
/help — Эта справка
/pro — Информация о Pro подписке

<b>Поддержка:</b>
Если есть вопросы — пиши @sensei_support`;

    await sendTelegramMessage(chatId, helpText);
    return;
  }

  // /pro command
  if (text === '/pro') {
    const proText = `<b>Sensei Pro</b>

<b>Что входит:</b>
• Безлимитный AI-тренер
• Pro аналитика — прогноз рекордов, тренды
• Команда Pro — история друзей, секретные бейджи

<b>Стоимость:</b> 250 Stars / месяц

Оформить подписку можно в приложении.`;

    await sendTelegramMessage(chatId, proText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть приложение', web_app: { url: 'https://adaptivecoach.vercel.app' } }]
        ]
      }
    });
    return;
  }
}

// Callback query handlers
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Answer callback to remove loading state
  await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/answerCallbackQuery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });

  if (data === 'pricing') {
    const pricingText = `<b>Pro подписка</b>

<b>Стоимость:</b> 250 Stars в месяц

<b>Что получаешь:</b>
• Безлимитные вопросы AI-тренеру
• Продвинутая аналитика прогресса
• Прогноз личных рекордов
• Команда Pro с секретными бейджами

Оплата через Telegram Stars.`;

    await sendTelegramMessage(chatId, pricingText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Оформить в приложении', web_app: { url: 'https://adaptivecoach.vercel.app' } }],
          [{ text: 'Назад', callback_data: 'back_to_menu' }]
        ]
      }
    });
    return;
  }

  if (data === 'faq') {
    const faqText = `<b>Частые вопросы</b>

<b>Как начать тренироваться?</b>
Открой приложение, заполни анкету — AI создаст план под тебя.

<b>Нужен ли спортзал?</b>
Нет. Есть программы для дома и улицы.

<b>Как работает адаптация?</b>
AI анализирует твои результаты и корректирует нагрузку каждую неделю.

<b>Можно ли отменить подписку?</b>
Да, в любой момент. Доступ сохранится до конца оплаченного периода.`;

    await sendTelegramMessage(chatId, faqText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть приложение', web_app: { url: 'https://adaptivecoach.vercel.app' } }],
          [{ text: 'Назад', callback_data: 'back_to_menu' }]
        ]
      }
    });
    return;
  }

  if (data === 'how_it_works') {
    const howText = `<b>Как это работает</b>

<b>1. Заполни анкету</b>
Расскажи о себе: цели, опыт, доступное оборудование.

<b>2. Получи план</b>
AI создаст персональную программу тренировок.

<b>3. Тренируйся</b>
Следуй плану, отмечай выполненные упражнения.

<b>4. Прогрессируй</b>
AI адаптирует нагрузку под твой прогресс.

<b>5. Достигай целей</b>
Отслеживай результаты в разделе Прогресс.`;

    await sendTelegramMessage(chatId, howText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Начать', web_app: { url: 'https://adaptivecoach.vercel.app' } }],
          [{ text: 'Назад', callback_data: 'back_to_menu' }]
        ]
      }
    });
    return;
  }

  if (data === 'back_to_menu') {
    // Resend welcome message
    await handleBotCommand({ chat: { id: chatId }, text: '/start', from: callbackQuery.from });
    return;
  }
}

app.post('/api/payments/webhook', async (req, res) => {
  try {
    const update = req.body;
    logger.info({ message: 'Webhook received', update: JSON.stringify(update).substring(0, 500) });

    // Handle bot commands
    if (update.message && update.message.text && update.message.text.startsWith('/')) {
      logger.info({ message: 'Processing command', text: update.message.text });
      await handleBotCommand(update.message);
      return res.sendStatus(200);
    }

    // Handle regular messages (not commands)
    if (update.message && update.message.text) {
      logger.info({ message: 'Got message but not command', text: update.message.text });
    }

    // Handle callback queries (inline button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return res.sendStatus(200);
    }

    // Handle pre-checkout query
    if (update.pre_checkout_query) {
      await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/answerPreCheckoutQuery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true })
      });
      return res.sendStatus(200);
    }

    // Handle successful payment
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const telegramId = update.message.from.id;
      const chatId = update.message.chat.id;

      const userResult = await sql`
        INSERT INTO users (telegram_id, first_name)
        VALUES (${telegramId}, ${update.message.from.first_name || 'User'})
        ON CONFLICT (telegram_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `;

      const userId = userResult[0].id;

      await sql`
        INSERT INTO subscriptions (user_id, telegram_payment_charge_id, amount, expires_at)
        VALUES (${userId}, ${payment.telegram_payment_charge_id}, ${payment.total_amount}, NOW() + INTERVAL '30 days')
      `;

      await sql`
        UPDATE users SET is_pro = true, pro_expires_at = NOW() + INTERVAL '30 days' WHERE id = ${userId}
      `;

      // Send confirmation message
      await sendTelegramMessage(chatId, `<b>Готово!</b>\n\nТы теперь <b>Sensei Pro</b>. Подписка активна 30 дней.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Открыть приложение', web_app: { url: 'https://adaptivecoach.vercel.app' } }]
          ]
        }
      });

      logger.info({ message: 'User upgraded to Pro', userId, telegramId });
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error({ message: 'Webhook error', error: error.message });
    res.sendStatus(200);
  }
});

// ============ SOCIAL API ENDPOINTS ============

const WEBAPP_URL = 'https://adaptivecoach.vercel.app';

// Helper to get or create user's DB id from telegram_id
async function getOrCreateUserId(telegramUser) {
  // Try to find existing user
  let result = await sql`SELECT id FROM users WHERE telegram_id = ${telegramUser.id}`;

  if (result.length > 0) {
    return result[0].id;
  }

  // User not found - create new user
  result = await sql`
    INSERT INTO users (telegram_id, telegram_username, first_name, photo_url)
    VALUES (${telegramUser.id}, ${telegramUser.username || null}, ${telegramUser.first_name || 'User'}, ${telegramUser.photo_url || null})
    ON CONFLICT (telegram_id) DO UPDATE SET
      telegram_username = EXCLUDED.telegram_username,
      first_name = EXCLUDED.first_name,
      photo_url = EXCLUDED.photo_url
    RETURNING id
  `;

  return result[0].id;
}

// Search users by username
app.get('/api/social/search', authMiddleware, async (req, res) => {
  try {
    let { q } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });

    // Strip @ symbol from search query (usernames stored without @)
    q = q.replace(/^@+/, '').trim();
    if (q.length < 2) return res.json({ users: [] });

    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    const users = await sql`
      SELECT
        u.id, u.telegram_id as "telegramId", u.telegram_username as username,
        u.first_name as "firstName", u.photo_url as "photoUrl",
        COALESCE(u.level, 1) as level, COALESCE(u.streak_days, 0) as streak,
        COALESCE(u.total_volume, 0) as "totalVolume", u.last_workout_at as "lastActive",
        f.status as "friendshipStatus",
        CASE
          WHEN f.requester_id = ${currentUserId} THEN 'outgoing'
          WHEN f.addressee_id = ${currentUserId} THEN 'incoming'
          ELSE null
        END as "requestDirection"
      FROM users u
      LEFT JOIN friendships f ON (
        (f.requester_id = u.id AND f.addressee_id = ${currentUserId})
        OR
        (f.addressee_id = u.id AND f.requester_id = ${currentUserId})
      )
      WHERE u.telegram_username ILIKE ${'%' + q + '%'}
        AND u.id != ${currentUserId}
      LIMIT 10
    `;

    res.json({ users });
  } catch (error) {
    logger.error({ message: 'Social search error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get friends list
app.get('/api/social/friends', authMiddleware, async (req, res) => {
  try {
    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    const friends = await sql`
      SELECT
        u.id, u.telegram_id as "telegramId", u.telegram_username as username,
        u.first_name as name, u.photo_url as "photoUrl",
        COALESCE(u.level, 1) as level, COALESCE(u.streak_days, 0) as streak,
        COALESCE(u.total_volume, 0) as "totalVolume", u.last_workout_at as "lastActive",
        CASE WHEN u.last_workout_at > NOW() - INTERVAL '15 minutes' THEN true ELSE false END as "isOnline"
      FROM users u
      INNER JOIN friendships f ON (
        (f.requester_id = u.id AND f.addressee_id = ${currentUserId})
        OR
        (f.addressee_id = u.id AND f.requester_id = ${currentUserId})
      )
      WHERE f.status = 'accepted'
      ORDER BY u.last_workout_at DESC NULLS LAST
    `;

    res.json({ friends });
  } catch (error) {
    logger.error({ message: 'Get friends error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Send friend request
app.post('/api/social/friends/request', authMiddleware, async (req, res) => {
  try {
    const { addresseeId } = req.body;
    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    // Check if friendship already exists
    const existing = await sql`
      SELECT id, status FROM friendships
      WHERE (requester_id = ${currentUserId} AND addressee_id = ${addresseeId})
         OR (requester_id = ${addresseeId} AND addressee_id = ${currentUserId})
    `;

    if (existing.length > 0) {
      if (existing[0].status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      }
      if (existing[0].status === 'pending') {
        return res.status(400).json({ error: 'Request already sent' });
      }
    }

    // Create friend request
    const result = await sql`
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES (${currentUserId}, ${addresseeId}, 'pending')
      RETURNING id, status
    `;

    // Get addressee telegram_id for notification
    const addressee = await sql`SELECT telegram_id, first_name FROM users WHERE id = ${addresseeId}`;
    const requester = await sql`SELECT first_name FROM users WHERE id = ${currentUserId}`;

    if (addressee.length > 0 && requester.length > 0) {
      await sendTelegramMessage(addressee[0].telegram_id,
        `<b>${requester[0].first_name}</b> хочет добавить тебя в друзья!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть приложение', web_app: { url: WEBAPP_URL } }]
            ]
          }
        }
      );
    }

    res.json({ success: true, friendship: result[0] });
  } catch (error) {
    logger.error({ message: 'Friend request error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get incoming friend requests
app.get('/api/social/friends/requests', authMiddleware, async (req, res) => {
  try {
    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    const requests = await sql`
      SELECT
        f.id,
        f.created_at as "createdAt",
        json_build_object(
          'id', u.id,
          'telegramId', u.telegram_id,
          'username', u.telegram_username,
          'name', u.first_name,
          'photoUrl', u.photo_url,
          'level', COALESCE(u.level, 1),
          'streak', COALESCE(u.streak_days, 0),
          'totalVolume', COALESCE(u.total_volume, 0)
        ) as requester
      FROM friendships f
      INNER JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ${currentUserId} AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;

    res.json({ requests });
  } catch (error) {
    logger.error({ message: 'Get friend requests error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Respond to friend request
app.post('/api/social/friends/respond', authMiddleware, async (req, res) => {
  try {
    const { friendshipId, accept } = req.body;
    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    // Verify this request is for current user
    const friendship = await sql`
      SELECT id, requester_id, addressee_id FROM friendships
      WHERE id = ${friendshipId} AND addressee_id = ${currentUserId} AND status = 'pending'
    `;

    if (friendship.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const newStatus = accept ? 'accepted' : 'rejected';
    await sql`
      UPDATE friendships SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${friendshipId}
    `;

    res.json({ success: true, status: newStatus });
  } catch (error) {
    logger.error({ message: 'Respond to request error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete friend
app.delete('/api/social/friends/:friendId', authMiddleware, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId);
    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    await sql`
      DELETE FROM friendships
      WHERE (requester_id = ${currentUserId} AND addressee_id = ${friendId})
         OR (requester_id = ${friendId} AND addressee_id = ${currentUserId})
    `;

    res.json({ success: true });
  } catch (error) {
    logger.error({ message: 'Delete friend error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get activity feed
app.get('/api/social/feed', authMiddleware, async (req, res) => {
  try {
    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    // Get workouts from friends
    const feed = await sql`
      SELECT
        'wl_' || wl.id as id,
        wl.user_id as "userId",
        u.first_name as "userName",
        u.photo_url as "userPhoto",
        'workout_finish' as type,
        'Закончил тренировку' as title,
        'Поднял ' || COALESCE(wl.total_volume, 0) || ' кг' as description,
        EXTRACT(EPOCH FROM wl.finished_at) * 1000 as timestamp,
        0 as likes,
        false as "likedByMe"
      FROM workout_logs wl
      INNER JOIN users u ON u.id = wl.user_id
      INNER JOIN friendships f ON (
        (f.requester_id = wl.user_id AND f.addressee_id = ${currentUserId})
        OR
        (f.addressee_id = wl.user_id AND f.requester_id = ${currentUserId})
      )
      WHERE f.status = 'accepted' AND wl.finished_at IS NOT NULL
      ORDER BY wl.finished_at DESC
      LIMIT 20
    `;

    res.json({ feed });
  } catch (error) {
    logger.error({ message: 'Get feed error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Nudge friend
app.post('/api/social/nudge', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;
    const currentUserId = await getOrCreateUserId(req.telegramUser);
    if (!currentUserId) return res.status(401).json({ error: 'User not found' });

    // Verify friendship exists
    const friendship = await sql`
      SELECT id FROM friendships
      WHERE ((requester_id = ${currentUserId} AND addressee_id = ${friendId})
         OR (requester_id = ${friendId} AND addressee_id = ${currentUserId}))
        AND status = 'accepted'
    `;

    if (friendship.length === 0) {
      return res.status(403).json({ error: 'Not friends' });
    }

    // Get friend's telegram_id and sender's name
    const friend = await sql`SELECT telegram_id, first_name FROM users WHERE id = ${friendId}`;
    const sender = await sql`SELECT first_name FROM users WHERE id = ${currentUserId}`;

    if (friend.length > 0 && sender.length > 0) {
      await sendTelegramMessage(friend[0].telegram_id,
        `<b>${sender[0].first_name}</b> пнул тебя! Пора тренироваться!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть приложение', web_app: { url: WEBAPP_URL } }]
            ]
          }
        }
      );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ message: 'Nudge error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ WORKOUTS API ============

// Badge checker function
async function checkAndAwardBadges(userId, workoutLogId) {
  const awarded = [];
  try {
    // Get user stats
    const userStats = await sql`
      SELECT
        COALESCE(streak_days, 0) as streak_days,
        COALESCE(total_volume, 0) as total_volume,
        (SELECT COUNT(*) FROM workout_logs WHERE user_id = ${userId}) as workout_count,
        (SELECT COUNT(*) FROM friendships WHERE (requester_id = ${userId} OR addressee_id = ${userId}) AND status = 'accepted') as friend_count
      FROM users WHERE id = ${userId}
    `;
    if (userStats.length === 0) return awarded;
    const stats = userStats[0];

    // Get already earned badges
    const earned = await sql`
      SELECT bd.code FROM user_badges ub
      JOIN badge_definitions bd ON bd.id = ub.badge_id
      WHERE ub.user_id = ${userId}
    `;
    const earnedCodes = new Set(earned.map(b => b.code));

    // Check badges
    const badgeChecks = [
      { code: 'streak_7', check: () => stats.streak_days >= 7 },
      { code: 'streak_30', check: () => stats.streak_days >= 30 },
      { code: 'streak_100', check: () => stats.streak_days >= 100 },
      { code: 'volume_1t', check: () => stats.total_volume >= 1000 },
      { code: 'volume_10t', check: () => stats.total_volume >= 10000 },
      { code: 'volume_100t', check: () => stats.total_volume >= 100000 },
      { code: 'first_friend', check: () => stats.friend_count >= 1 },
      { code: 'squad_5', check: () => stats.friend_count >= 5 },
      { code: 'first_workout', check: () => stats.workout_count >= 1 },
      { code: 'workouts_10', check: () => stats.workout_count >= 10 },
      { code: 'workouts_50', check: () => stats.workout_count >= 50 },
      { code: 'workouts_100', check: () => stats.workout_count >= 100 }
    ];

    for (const { code, check } of badgeChecks) {
      if (!earnedCodes.has(code) && check()) {
        const badge = await sql`SELECT id, name_ru, icon FROM badge_definitions WHERE code = ${code}`;
        if (badge.length > 0) {
          await sql`
            INSERT INTO user_badges (user_id, badge_id, workout_log_id)
            VALUES (${userId}, ${badge[0].id}, ${workoutLogId})
            ON CONFLICT (user_id, badge_id) DO NOTHING
          `;
          awarded.push({ name: badge[0].name_ru, icon: badge[0].icon });
        }
      }
    }
  } catch (err) {
    logger.error({ message: 'Badge check error', error: err.message });
  }
  return awarded;
}

// Sync workout from client
app.post('/api/workouts/sync', authMiddleware, async (req, res) => {
  try {
    const { sessionId, date, startTime, duration, completedExercises, feedback } = req.body;
    const userId = await getOrCreateUserId(req.telegramUser);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    // Calculate total volume
    let totalVolume = 0;
    if (completedExercises && Array.isArray(completedExercises)) {
      for (const ex of completedExercises) {
        if (ex.completedSets && Array.isArray(ex.completedSets)) {
          for (const set of ex.completedSets) {
            totalVolume += (set.weight || 0) * (set.reps || 0);
          }
        }
      }
    }

    // Insert or update workout log
    const result = await sql`
      INSERT INTO workout_logs (user_id, session_id, workout_date, start_time, duration, total_volume, exercises_data, feedback_data, finished_at)
      VALUES (${userId}, ${sessionId}, ${date}, ${startTime ? new Date(startTime).toISOString() : null}, ${duration || 0},
              ${totalVolume}, ${JSON.stringify(completedExercises)}, ${JSON.stringify(feedback)}, NOW())
      ON CONFLICT (user_id, workout_date, session_id) DO UPDATE SET
        duration = EXCLUDED.duration,
        total_volume = EXCLUDED.total_volume,
        exercises_data = EXCLUDED.exercises_data,
        feedback_data = EXCLUDED.feedback_data,
        finished_at = NOW()
      RETURNING id
    `;
    const workoutLogId = result[0]?.id;

    // Update user stats with smart streak calculation
    // Streak logic: count consecutive completed scheduled workout days
    // Don't reset streak on rest days - only on missed scheduled days
    await sql`
      WITH user_schedule AS (
        SELECT COALESCE(
          (SELECT preferred_days FROM user_notification_settings WHERE user_id = ${userId}),
          ARRAY[1,3,5]::integer[]
        ) as preferred_days
      ),
      last_workout AS (
        SELECT last_workout_at::date as last_date FROM users WHERE id = ${userId}
      ),
      missed_scheduled_days AS (
        -- Count scheduled days between last workout and today that were missed
        SELECT COUNT(*) as missed
        FROM generate_series(
          (SELECT last_date + 1 FROM last_workout),
          CURRENT_DATE - 1,
          '1 day'::interval
        ) as d(day)
        CROSS JOIN user_schedule us
        WHERE EXTRACT(DOW FROM d.day)::integer = ANY(us.preferred_days)
          AND NOT EXISTS (
            SELECT 1 FROM workout_logs wl
            WHERE wl.user_id = ${userId} AND wl.workout_date = d.day::date
          )
      )
      UPDATE users SET
        total_volume = COALESCE((SELECT SUM(total_volume) FROM workout_logs WHERE user_id = ${userId}), 0),
        last_workout_at = NOW(),
        streak_days = CASE
          -- Same day workout - keep streak
          WHEN last_workout_at::date = CURRENT_DATE THEN COALESCE(streak_days, 1)
          -- No missed scheduled days - increment streak
          WHEN (SELECT missed FROM missed_scheduled_days) = 0 THEN COALESCE(streak_days, 0) + 1
          -- Missed scheduled days - reset streak
          ELSE 1
        END
      WHERE id = ${userId}
    `;

    // Update challenge progress
    await sql`
      UPDATE challenge_participants cp
      SET current_value = (
        SELECT CASE
          WHEN c.challenge_type = 'workout_count' THEN (
            SELECT COUNT(*) FROM workout_logs wl
            WHERE wl.user_id = cp.user_id AND wl.workout_date BETWEEN c.start_date AND c.end_date
          )
          WHEN c.challenge_type = 'total_volume' THEN (
            SELECT COALESCE(SUM(total_volume), 0) FROM workout_logs wl
            WHERE wl.user_id = cp.user_id AND wl.workout_date BETWEEN c.start_date AND c.end_date
          )
          ELSE 0
        END
        FROM challenges c WHERE c.id = cp.challenge_id
      )
      WHERE cp.user_id = ${userId}
      AND cp.challenge_id IN (SELECT id FROM challenges WHERE status = 'active')
    `;

    // Check and award badges
    const newBadges = await checkAndAwardBadges(userId, workoutLogId);

    logger.info({ message: 'Workout synced', userId, sessionId, totalVolume, newBadges: newBadges.length });
    res.json({ success: true, totalVolume, newBadges });
  } catch (error) {
    logger.error({ message: 'Workout sync error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's workout history
app.get('/api/workouts', authMiddleware, async (req, res) => {
  try {
    const userId = await getOrCreateUserId(req.telegramUser);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const workouts = await sql`
      SELECT id, session_id, workout_date, duration, total_volume, exercises_data, feedback_data, finished_at
      FROM workout_logs
      WHERE user_id = ${userId}
      ORDER BY workout_date DESC, finished_at DESC
      LIMIT 50
    `;
    res.json({ workouts });
  } catch (error) {
    logger.error({ message: 'Get workouts error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BADGES API ============

// Get all badges with user's earned status
app.get('/api/social/badges', authMiddleware, async (req, res) => {
  try {
    const userId = await getOrCreateUserId(req.telegramUser);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const badges = await sql`
      SELECT
        bd.id, bd.code, bd.name_ru as name, bd.description_ru as description,
        bd.icon, bd.category, bd.tier, bd.threshold,
        ub.earned_at as "earnedAt",
        CASE WHEN ub.id IS NOT NULL THEN false ELSE true END as "isLocked"
      FROM badge_definitions bd
      LEFT JOIN user_badges ub ON ub.badge_id = bd.id AND ub.user_id = ${userId}
      WHERE bd.is_secret = false OR ub.id IS NOT NULL
      ORDER BY bd.category, bd.threshold
    `;
    res.json({ badges });
  } catch (error) {
    logger.error({ message: 'Get badges error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get badges for a specific user (for friend profile)
app.get('/api/social/users/:userId/badges', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const badges = await sql`
      SELECT bd.id, bd.code, bd.name_ru as name, bd.icon, bd.tier, ub.earned_at as "earnedAt"
      FROM user_badges ub
      JOIN badge_definitions bd ON bd.id = ub.badge_id
      WHERE ub.user_id = ${userId}
      ORDER BY ub.earned_at DESC
    `;
    res.json({ badges });
  } catch (error) {
    logger.error({ message: 'Get user badges error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ KUDOS API ============

// Give kudos to a workout
app.post('/api/social/kudos', authMiddleware, async (req, res) => {
  try {
    const { workoutLogId } = req.body;
    const senderId = await getOrCreateUserId(req.telegramUser);
    if (!senderId) return res.status(401).json({ error: 'User not found' });

    // Get workout owner
    const workout = await sql`SELECT user_id FROM workout_logs WHERE id = ${workoutLogId}`;
    if (workout.length === 0) return res.status(404).json({ error: 'Workout not found' });

    const recipientId = workout[0].user_id;
    if (recipientId === senderId) {
      return res.status(400).json({ error: 'Cannot kudos yourself' });
    }

    await sql`
      INSERT INTO kudos (sender_id, recipient_id, workout_log_id, activity_type)
      VALUES (${senderId}, ${recipientId}, ${workoutLogId}, 'workout')
      ON CONFLICT (sender_id, workout_log_id) DO NOTHING
    `;

    // Notify recipient
    const sender = await sql`SELECT first_name FROM users WHERE id = ${senderId}`;
    const recipient = await sql`SELECT telegram_id FROM users WHERE id = ${recipientId}`;
    if (sender.length > 0 && recipient.length > 0) {
      await sendTelegramMessage(recipient[0].telegram_id,
        `${sender[0].first_name} дал тебе Kudos за тренировку! 🙌`
      );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ message: 'Kudos error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove kudos
app.delete('/api/social/kudos/:workoutLogId', authMiddleware, async (req, res) => {
  try {
    const { workoutLogId } = req.params;
    const senderId = await getOrCreateUserId(req.telegramUser);
    if (!senderId) return res.status(401).json({ error: 'User not found' });

    await sql`DELETE FROM kudos WHERE sender_id = ${senderId} AND workout_log_id = ${workoutLogId}`;
    res.json({ success: true });
  } catch (error) {
    logger.error({ message: 'Remove kudos error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CHALLENGES API ============

// Create challenge
app.post('/api/social/challenges', authMiddleware, async (req, res) => {
  try {
    const { title, description, challengeType, targetValue, durationDays, invitedFriendIds } = req.body;
    const creatorId = await getOrCreateUserId(req.telegramUser);
    if (!creatorId) return res.status(401).json({ error: 'User not found' });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (durationDays || 7));

    const result = await sql`
      INSERT INTO challenges (creator_id, title, description, challenge_type, target_value, start_date, end_date)
      VALUES (${creatorId}, ${title}, ${description || null}, ${challengeType}, ${targetValue || null},
              ${startDate.toISOString().split('T')[0]}, ${endDate.toISOString().split('T')[0]})
      RETURNING id
    `;
    const challengeId = result[0].id;

    // Add creator as participant
    await sql`INSERT INTO challenge_participants (challenge_id, user_id) VALUES (${challengeId}, ${creatorId})`;

    // Invite friends
    const creator = await sql`SELECT first_name FROM users WHERE id = ${creatorId}`;
    for (const friendId of (invitedFriendIds || [])) {
      await sql`
        INSERT INTO challenge_participants (challenge_id, user_id) VALUES (${challengeId}, ${friendId})
        ON CONFLICT DO NOTHING
      `;
      const friend = await sql`SELECT telegram_id FROM users WHERE id = ${friendId}`;
      if (friend.length > 0) {
        await sendTelegramMessage(friend[0].telegram_id,
          `${creator[0]?.first_name || 'Друг'} пригласил тебя в challenge "${title}"! 🏆`
        );
      }
    }

    res.json({ success: true, challengeId });
  } catch (error) {
    logger.error({ message: 'Create challenge error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active challenges
app.get('/api/social/challenges', authMiddleware, async (req, res) => {
  try {
    const userId = await getOrCreateUserId(req.telegramUser);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const challenges = await sql`
      SELECT
        c.id, c.title, c.description, c.challenge_type as "challengeType",
        c.target_value as "targetValue", c.start_date as "startDate",
        c.end_date as "endDate", c.status,
        (SELECT json_agg(json_build_object(
          'userId', cp2.user_id,
          'userName', u2.first_name,
          'photoUrl', u2.photo_url,
          'currentValue', cp2.current_value
        ) ORDER BY cp2.current_value DESC)
        FROM challenge_participants cp2
        JOIN users u2 ON u2.id = cp2.user_id
        WHERE cp2.challenge_id = c.id) as participants
      FROM challenges c
      WHERE c.id IN (SELECT challenge_id FROM challenge_participants WHERE user_id = ${userId})
        AND (c.status = 'active' OR c.end_date >= CURRENT_DATE - 7)
      ORDER BY c.end_date ASC
    `;
    res.json({ challenges });
  } catch (error) {
    logger.error({ message: 'Get challenges error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ENHANCED USER PROFILE API ============

// Get detailed user profile (for friend view)
app.get('/api/social/users/:userId/profile', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = await getOrCreateUserId(req.telegramUser);

    // Support both internal id and telegram_id
    // Telegram IDs are typically > 1 billion, internal IDs are small
    const isTelegramId = parseInt(userId) > 1000000;

    // Get user info
    const user = isTelegramId
      ? await sql`
          SELECT id, telegram_id, telegram_username, first_name, photo_url,
                 COALESCE(level, 1) as level, COALESCE(streak_days, 0) as streak_days,
                 COALESCE(total_volume, 0) as total_volume, last_workout_at as "lastActive"
          FROM users WHERE telegram_id = ${userId}
        `
      : await sql`
          SELECT id, telegram_id, telegram_username, first_name, photo_url,
                 COALESCE(level, 1) as level, COALESCE(streak_days, 0) as streak_days,
                 COALESCE(total_volume, 0) as total_volume, last_workout_at as "lastActive"
          FROM users WHERE id = ${userId}
        `;
    if (user.length === 0) return res.status(404).json({ error: 'User not found' });

    const internalUserId = user[0].id;

    // Get badges
    const badges = await sql`
      SELECT bd.id, bd.code, bd.name_ru as name, bd.icon, bd.tier
      FROM user_badges ub
      JOIN badge_definitions bd ON bd.id = ub.badge_id
      WHERE ub.user_id = ${internalUserId}
      ORDER BY ub.earned_at DESC
      LIMIT 10
    `;

    // Get recent workouts
    const recentWorkouts = await sql`
      SELECT id, session_id, workout_date, total_volume, duration
      FROM workout_logs
      WHERE user_id = ${internalUserId}
      ORDER BY workout_date DESC
      LIMIT 5
    `;

    // Get workout count
    const stats = await sql`
      SELECT COUNT(*) as "workoutCount" FROM workout_logs WHERE user_id = ${internalUserId}
    `;

    res.json({
      user: user[0],
      badges,
      recentWorkouts,
      workoutCount: parseInt(stats[0]?.workoutCount || 0)
    });
  } catch (error) {
    logger.error({ message: 'Get user profile error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ GEMINI API PROXY ============

app.post('/api/gemini/*', validateApiKey, async (req, res) => {
  try {
    const geminiPath = req.path.replace('/api/gemini', '');
    const geminiUrl = 'https://generativelanguage.googleapis.com' + geminiPath;
    const url = new URL(geminiUrl);
    url.searchParams.set('key', process.env.GEMINI_API_KEY);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    logger.error({ message: 'Proxy error', error: error.message });
    res.status(500).json({ error: 'Proxy error' });
  }
});

// ============ NOTIFICATION API ENDPOINTS ============

// Get notification settings
app.get('/api/notifications/settings', authMiddleware, async (req, res) => {
  try {
    const userId = await getOrCreateUserId(req.telegramUser);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const settings = await sql`
      SELECT * FROM user_notification_settings WHERE user_id = ${userId}
    `;

    if (settings.length === 0) {
      // Return defaults
      return res.json({
        reminder_enabled: true,
        preferred_days: [1, 3, 5],
        reminder_time: '08:00',
        timezone: 'Europe/Moscow'
      });
    }

    res.json(settings[0]);
  } catch (error) {
    logger.error({ message: 'Get notification settings error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Save notification settings
app.post('/api/notifications/settings', authMiddleware, async (req, res) => {
  try {
    const { preferredDays, reminderTime, enabled, timezone } = req.body;
    const userId = await getOrCreateUserId(req.telegramUser);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    await sql`
      INSERT INTO user_notification_settings
        (user_id, preferred_days, reminder_time, reminder_enabled, timezone)
      VALUES (${userId}, ${preferredDays || [1,3,5]}, ${reminderTime || '08:00'}, ${enabled !== false}, ${timezone || 'Europe/Moscow'})
      ON CONFLICT (user_id) DO UPDATE SET
        preferred_days = EXCLUDED.preferred_days,
        reminder_time = EXCLUDED.reminder_time,
        reminder_enabled = EXCLUDED.reminder_enabled,
        timezone = EXCLUDED.timezone
    `;

    logger.info({ message: 'Notification settings updated', userId, enabled });
    res.json({ success: true });
  } catch (error) {
    logger.error({ message: 'Save notification settings error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Track notification open (called when app opens from notification)
app.post('/api/notifications/track-open', authMiddleware, async (req, res) => {
  try {
    const userId = await getOrCreateUserId(req.telegramUser);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    // Mark latest notification as opened
    await sql`
      UPDATE notification_logs
      SET opened_app = true, opened_at = NOW()
      WHERE user_id = ${userId}
        AND sent_at > NOW() - INTERVAL '24 hours'
        AND opened_app = false
      ORDER BY sent_at DESC
      LIMIT 1
    `;

    // Improve response rate
    await sql`
      UPDATE user_notification_settings
      SET notification_response_rate = LEAST(1.0, notification_response_rate + 0.1),
          consecutive_ignores = 0
      WHERE user_id = ${userId}
    `;

    res.json({ success: true });
  } catch (error) {
    logger.error({ message: 'Track notification open error', error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CRON JOBS ============

// Send workout reminders - 8:00 Moscow time (5:00 UTC)
cron.schedule('0 5 * * *', async () => {
  logger.info('[CRON] Starting workout reminders job');
  try {
    const dayOfWeek = new Date().getDay();

    // Find users who should receive workout reminder today
    const users = await sql`
      SELECT u.id, u.telegram_id, u.first_name, u.streak_days,
             uns.preferred_days, uns.notification_response_rate
      FROM users u
      INNER JOIN user_notification_settings uns ON uns.user_id = u.id
      WHERE uns.reminder_enabled = true
        AND ${dayOfWeek} = ANY(uns.preferred_days)
        AND (uns.paused_until IS NULL OR uns.paused_until < CURRENT_DATE)
        AND uns.notifications_this_week < 3
        AND (uns.last_notification_at IS NULL OR uns.last_notification_at < CURRENT_DATE - 1)
    `;

    logger.info({ message: '[CRON] Found users for workout reminder', count: users.length });

    for (const user of users) {
      try {
        const { canSend, reason } = await canSendNotification(user.id);
        if (!canSend) {
          logger.info({ message: '[CRON] Skipping user', userId: user.id, reason });
          continue;
        }

        const workoutType = await getTodayWorkoutType(user.id, dayOfWeek);
        const streak = user.streak_days || 0;

        // Choose template based on streak
        let templates = MESSAGE_TEMPLATES.workout_reminder;
        if (streak >= 7) {
          templates = [...templates, ...MESSAGE_TEMPLATES.workout_reminder_streak];
        }

        const template = getRandomTemplate(templates);
        const message = personalizeMessage(template, {
          name: user.first_name || 'Чемпион',
          workoutType,
          streak
        });

        await sendTelegramMessage(user.telegram_id, message, {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Открыть тренировку 💪', web_app: { url: WEBAPP_URL + '?ref=notif_workout' } }
            ]]
          }
        });

        await logNotification(user.id, 'workout_reminder', template);
        logger.info({ message: '[CRON] Sent workout reminder', userId: user.id });
      } catch (e) {
        logger.error({ message: '[CRON] Error sending to user', userId: user.id, error: e.message });
      }
    }
  } catch (error) {
    logger.error({ message: '[CRON] Workout reminders job error', error: error.message });
  }
});

// Streak at risk reminders - 20:00 Moscow time (17:00 UTC)
cron.schedule('0 17 * * *', async () => {
  logger.info('[CRON] Starting streak at risk job');
  try {
    const dayOfWeek = new Date().getDay();

    // Find users with streak at risk (scheduled today but didn't train)
    const users = await sql`
      SELECT u.id, u.telegram_id, u.first_name, u.streak_days,
             uns.preferred_days
      FROM users u
      INNER JOIN user_notification_settings uns ON uns.user_id = u.id
      WHERE uns.reminder_enabled = true
        AND u.streak_days >= 3
        AND ${dayOfWeek} = ANY(uns.preferred_days)
        AND (u.last_workout_at IS NULL OR u.last_workout_at::date < CURRENT_DATE)
        AND uns.notifications_this_week < 3
    `;

    logger.info({ message: '[CRON] Found users with streak at risk', count: users.length });

    for (const user of users) {
      try {
        const { canSend, reason } = await canSendNotification(user.id);
        if (!canSend) continue;

        const hoursLeft = 24 - new Date().getHours();
        const template = getRandomTemplate(MESSAGE_TEMPLATES.streak_at_risk);
        const message = personalizeMessage(template, {
          name: user.first_name || 'Чемпион',
          streak: user.streak_days,
          hours: hoursLeft
        });

        await sendTelegramMessage(user.telegram_id, message, {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Быстрая тренировка 🔥', web_app: { url: WEBAPP_URL + '?ref=notif_streak' } }
            ]]
          }
        });

        await logNotification(user.id, 'streak_at_risk', template);
        logger.info({ message: '[CRON] Sent streak warning', userId: user.id, streak: user.streak_days });
      } catch (e) {
        logger.error({ message: '[CRON] Error sending streak warning', userId: user.id, error: e.message });
      }
    }
  } catch (error) {
    logger.error({ message: '[CRON] Streak at risk job error', error: error.message });
  }
});

// Comeback messages - 12:00 Moscow time (9:00 UTC)
cron.schedule('0 9 * * *', async () => {
  logger.info('[CRON] Starting comeback job');
  try {
    // Find inactive users (5+ days)
    const users = await sql`
      SELECT u.id, u.telegram_id, u.first_name,
             EXTRACT(DAY FROM NOW() - u.last_workout_at) as days_inactive
      FROM users u
      LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
      WHERE (uns.reminder_enabled IS NULL OR uns.reminder_enabled = true)
        AND (u.last_workout_at IS NULL OR u.last_workout_at < NOW() - INTERVAL '5 days')
        AND (uns.last_notification_at IS NULL OR uns.last_notification_at < NOW() - INTERVAL '7 days')
      LIMIT 50
    `;

    logger.info({ message: '[CRON] Found inactive users for comeback', count: users.length });

    for (const user of users) {
      try {
        // Create settings if not exist
        await sql`
          INSERT INTO user_notification_settings (user_id)
          VALUES (${user.id})
          ON CONFLICT (user_id) DO NOTHING
        `;

        const { canSend } = await canSendNotification(user.id);
        if (!canSend) continue;

        const template = getRandomTemplate(MESSAGE_TEMPLATES.comeback);
        const message = personalizeMessage(template, {
          name: user.first_name || 'Чемпион'
        });

        await sendTelegramMessage(user.telegram_id, message, {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Открыть план 📋', web_app: { url: WEBAPP_URL + '?ref=notif_comeback' } }
            ]]
          }
        });

        await logNotification(user.id, 'comeback', template);
        logger.info({ message: '[CRON] Sent comeback message', userId: user.id, daysInactive: user.days_inactive });
      } catch (e) {
        logger.error({ message: '[CRON] Error sending comeback', userId: user.id, error: e.message });
      }
    }
  } catch (error) {
    logger.error({ message: '[CRON] Comeback job error', error: error.message });
  }
});

// Weekly summary - Sunday 18:00 Moscow time (15:00 UTC)
cron.schedule('0 15 * * 0', async () => {
  logger.info('[CRON] Starting weekly summary job');
  try {
    // Find users with at least 1 workout this week
    const users = await sql`
      SELECT u.id, u.telegram_id, u.first_name, u.streak_days,
             COUNT(wl.id) as workouts_this_week,
             COALESCE(SUM(wl.total_volume), 0) as volume_this_week
      FROM users u
      LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
      LEFT JOIN workout_logs wl ON wl.user_id = u.id
        AND wl.workout_date >= CURRENT_DATE - 7
      WHERE (uns.reminder_enabled IS NULL OR uns.reminder_enabled = true)
      GROUP BY u.id, u.telegram_id, u.first_name, u.streak_days
      HAVING COUNT(wl.id) > 0
    `;

    logger.info({ message: '[CRON] Found users for weekly summary', count: users.length });

    for (const user of users) {
      try {
        // Get last week's volume for comparison
        const lastWeek = await sql`
          SELECT COALESCE(SUM(total_volume), 0) as volume
          FROM workout_logs
          WHERE user_id = ${user.id}
            AND workout_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 7
        `;
        const lastWeekVolume = lastWeek[0]?.volume || 0;
        const volumeDelta = user.volume_this_week - lastWeekVolume;

        const comment = getPersonalizedComment(
          user.workouts_this_week,
          3,
          volumeDelta,
          user.streak_days || 0
        );

        const template = MESSAGE_TEMPLATES.weekly_summary[0];
        const message = personalizeMessage(template, {
          name: user.first_name || 'Чемпион',
          workouts: user.workouts_this_week,
          volume: Math.round(user.volume_this_week),
          streak: user.streak_days || 0,
          trendEmoji: volumeDelta > 0 ? '📈' : volumeDelta < 0 ? '📉' : '➡️',
          trend: volumeDelta > 0 ? `+${Math.round(volumeDelta)} кг` : volumeDelta < 0 ? `${Math.round(volumeDelta)} кг` : 'стабильно',
          comment
        });

        await sendTelegramMessage(user.telegram_id, message, {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Посмотреть статистику 📊', web_app: { url: WEBAPP_URL + '?ref=notif_summary&tab=progress' } }
            ]]
          }
        });

        // Log but don't count towards weekly limit (it's a summary)
        await sql`
          INSERT INTO notification_logs (user_id, message_type, message_template)
          VALUES (${user.id}, 'weekly_summary', ${template.substring(0, 200)})
        `;

        logger.info({ message: '[CRON] Sent weekly summary', userId: user.id, workouts: user.workouts_this_week });
      } catch (e) {
        logger.error({ message: '[CRON] Error sending weekly summary', userId: user.id, error: e.message });
      }
    }
  } catch (error) {
    logger.error({ message: '[CRON] Weekly summary job error', error: error.message });
  }
});

// Reset weekly counters - Monday 00:00 Moscow time (Sunday 21:00 UTC)
cron.schedule('0 21 * * 0', resetWeeklyCounters);

// Update ignored notifications (reduce response rate for unopened)
cron.schedule('0 22 * * *', async () => {
  logger.info('[CRON] Updating response rates for ignored notifications');
  try {
    // Find notifications sent 24h+ ago that weren't opened
    const ignored = await sql`
      SELECT DISTINCT nl.user_id
      FROM notification_logs nl
      WHERE nl.sent_at < NOW() - INTERVAL '24 hours'
        AND nl.sent_at > NOW() - INTERVAL '48 hours'
        AND nl.opened_app = false
        AND nl.message_type != 'weekly_summary'
    `;

    for (const { user_id } of ignored) {
      await sql`
        UPDATE user_notification_settings
        SET notification_response_rate = GREATEST(0.2, notification_response_rate - 0.15),
            consecutive_ignores = consecutive_ignores + 1,
            paused_until = CASE
              WHEN consecutive_ignores >= 2 THEN CURRENT_DATE + 7
              ELSE paused_until
            END
        WHERE user_id = ${user_id}
      `;
    }

    logger.info({ message: '[CRON] Updated response rates', count: ignored.length });
  } catch (error) {
    logger.error({ message: '[CRON] Response rate update error', error: error.message });
  }
});

logger.info('[CRON] All notification cron jobs scheduled');

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  logger.error({ message: 'Unhandled error', error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => logger.info('Proxy server running on port ' + PORT));
