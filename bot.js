require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');

const Database = require('./database');
const handlers = require('./handlers');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL; // masalan: my-bot.up.railway.app (https:// siz)

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable topilmadi!');
  process.exit(1);
}
if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable topilmadi!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const db = new Database();
const app = express();

// ─── Bot handler'lari ────────────────────────────────────────────────────────
bot.start((ctx) => handlers.handleStart(ctx, db));

bot.on('photo', (ctx) => handlers.handlePhoto(ctx, db));

bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // boshqa komandalar e'tiborga olinmaydi
  return handlers.handleMessage(ctx, db);
});

bot.on('callback_query', (ctx) => handlers.handleCallback(ctx, db));

// ─── Telegram Payments (Ammer Pay orqali ulangan) ───────────────────────────
// Pre-checkout — to'lov tasdiqlanishidan oldin Telegram so'raydi, "OK" deb javob berish kerak
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true).catch(() => {}));

// To'lov muvaffaqiyatli amalga oshganda
bot.on('successful_payment', (ctx) => handlers.handleSuccessfulPayment(ctx, db));

bot.catch((err, ctx) => {
  console.error('Bot xatosi:', err);
  ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring yoki /start bosing.').catch(() => {});
});

// Railway "health check" uchun oddiy javob
app.get('/', (req, res) => res.send('🤖 Tanishuv bot ishlayapti'));

// ─── Ishga tushirish ─────────────────────────────────────────────────────────
async function main() {
  await db.connect(MONGO_URI);

  if (PUBLIC_URL) {
    // Webhook rejimi — tezroq, Railway uchun tavsiya etiladi
    const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
    app.use(bot.webhookCallback(webhookPath));
    app.listen(PORT, () => console.log(`✅ Server ${PORT} portda ishga tushdi`));
    await bot.telegram.setWebhook(`https://${PUBLIC_URL}${webhookPath}`);
    console.log(`✅ Webhook o'rnatildi: https://${PUBLIC_URL}${webhookPath}`);
  } else {
    // Polling rejimi — lokal test uchun qulay
    app.listen(PORT, () => console.log(`✅ Server ${PORT} portda ishga tushdi`));
    await bot.launch();
    console.log('✅ Bot polling rejimida ishga tushdi');
  }
}

main().catch((err) => {
  console.error('❌ Botni ishga tushirishda xatolik:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
