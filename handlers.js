const { STEPS, TEXTS, KEYBOARDS, PROFILE_PRICE } = require('./constants');
const mirpay = require('./mirpay');

// ─── /start ───────────────────────────────────────────────────────────────────
async function handleStart(ctx, db) {
  const { id: userId, first_name, last_name, username } = ctx.from;

  await db.upsertUser(userId, {
    username: username || '',
    first_name: first_name || '',
    last_name: last_name || '',
  });

  const user = await db.getUser(userId);

  if (user && user.step === STEPS.DONE) {
    await ctx.reply(`👋 Salom, <b>${first_name}</b>! Xush qaytdingiz!`, {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.MAIN_MENU,
    });
    return;
  }

  await ctx.reply(TEXTS.WELCOME(first_name), { parse_mode: 'HTML' });
  await askRegion(ctx, db, userId);
}

// ─── Ask region ────────────────────────────────────────────────────────────────
async function askRegion(ctx, db, userId) {
  await db.setStep(userId, STEPS.ASK_REGION);
  await ctx.reply(TEXTS.ASK_REGION, {
    parse_mode: 'HTML',
    reply_markup: KEYBOARDS.REGION,
  });
}

// ─── Handle text messages ──────────────────────────────────────────────────────
async function handleMessage(ctx, db) {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const user = await db.getUser(userId);

  if (!user) {
    return handleStart(ctx, db);
  }

  const step = user.step;

  // Asosiy menyu tugmalari
  if (step === STEPS.DONE) {
    if (text === '🔍 Qidiruv') return startSearch(ctx, db, userId);
    if (text === '❤️ Layklarim') return showLikes(ctx, db, userId);
    if (text === '📝 Anketam') return showMyProfile(ctx, db, userId);
    if (text === '✏️ Tahrirlash') return showEditMenu(ctx, db, userId);
    return;
  }

  // Ro'yxatdan o'tishda kasb kiritish
  if (step === STEPS.ASK_KASB) {
    const kasb = text.trim();
    if (!kasb || kasb.length < 2 || kasb.length > 50) {
      return ctx.reply("❌ Iltimos, kasbingizni to'g'ri kiriting (2-50 ta belgi)");
    }
    await db.upsertUser(userId, { kasb, step: STEPS.ASK_PHOTO });
    return ctx.reply(`💼 Kasb: <b>${kasb}</b>\n\n${TEXTS.ASK_PHOTO}`, { parse_mode: 'HTML' });
  }

  // Tahrirlashda kasb kiritish
  if (step === STEPS.EDIT_KASB) {
    const kasb = text.trim();
    if (!kasb || kasb.length < 2 || kasb.length > 50) {
      return ctx.reply("❌ Iltimos, kasbingizni to'g'ri kiriting (2-50 ta belgi)");
    }
    await db.upsertUser(userId, { kasb, step: STEPS.DONE });
    return ctx.reply('✅ Kasbingiz yangilandi!', {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.MAIN_MENU,
    });
  }

  // Ro'yxatdan o'tishda yosh kiritish
  if (step === STEPS.ASK_AGE) {
    const age = parseInt(text, 10);
    if (isNaN(age) || age < 14 || age > 80) {
      return ctx.reply(TEXTS.INVALID_AGE, { parse_mode: 'HTML' });
    }
    await db.upsertUser(userId, { age, step: STEPS.ASK_GENDER });
    return ctx.reply(TEXTS.ASK_GENDER, {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.GENDER,
    });
  }

  // Tahrirlashda yosh kiritish
  if (step === STEPS.EDIT_AGE) {
    const age = parseInt(text, 10);
    if (isNaN(age) || age < 14 || age > 80) {
      return ctx.reply(TEXTS.INVALID_AGE, { parse_mode: 'HTML' });
    }
    await db.upsertUser(userId, { age, step: STEPS.DONE });
    return ctx.reply('✅ Yoshingiz yangilandi!', {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.MAIN_MENU,
    });
  }

  // Qidiruv: minimal yosh
  if (step === STEPS.SEARCH_AGE_MIN) {
    const age = parseInt(text, 10);
    if (isNaN(age) || age < 14 || age > 80) {
      return ctx.reply("❌ To'g'ri yosh kiriting (14-80)");
    }
    await db.upsertUser(userId, { search_min_age: age, step: STEPS.SEARCH_AGE_MAX });
    return ctx.reply(TEXTS.SEARCH_AGE_MAX(age), { parse_mode: 'HTML' });
  }

  // Qidiruv: maksimal yosh
  if (step === STEPS.SEARCH_AGE_MAX) {
    const minAge = user.search_min_age || 18;
    const age = parseInt(text, 10);
    if (isNaN(age) || age < minAge || age > 80) {
      return ctx.reply(`❌ To'g'ri yosh kiriting (${minAge}-80)`);
    }
    await db.upsertUser(userId, { search_max_age: age, step: STEPS.SEARCH_REGION });
    return ctx.reply(TEXTS.SEARCH_REGION, {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.SEARCH_REGION,
    });
  }
}

// ─── Handle photos ─────────────────────────────────────────────────────────────
async function handlePhoto(ctx, db) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  if (!user) return;

  const step = user.step;
  if (step !== STEPS.ASK_PHOTO && step !== STEPS.EDIT_PHOTO) return;

  const photos = ctx.message.photo;
  const fileId = photos[photos.length - 1].file_id; // eng yuqori sifat

  if (step === STEPS.ASK_PHOTO) {
    await db.upsertUser(userId, { photo_file_id: fileId, step: STEPS.DONE });
    await ctx.reply(TEXTS.PROFILE_DONE, {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.MAIN_MENU,
    });

    const likes = await db.getLikesReceived(userId);
    if (likes.length > 0) {
      await ctx.reply(TEXTS.LIKE_RECEIVED(likes.length), { parse_mode: 'HTML' });
    }
  } else if (step === STEPS.EDIT_PHOTO) {
    await db.upsertUser(userId, { photo_file_id: fileId, step: STEPS.DONE });
    await ctx.reply('✅ Rasmingiz yangilandi!', {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.MAIN_MENU,
    });
  }
}

// ─── Handle callback queries ───────────────────────────────────────────────────
async function handleCallback(ctx, db) {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  await ctx.answerCbQuery().catch(() => {});

  const user = await db.getUser(userId);
  if (!user && data !== 'main_menu') return;

  // ── Viloyat tanlash (ro'yxatdan o'tish) ──
  if (data.startsWith('region_')) {
    const region = data.replace('region_', '');
    await db.upsertUser(userId, { region, step: STEPS.ASK_AGE });
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    return ctx.reply(`📍 Viloyat: <b>${region}</b>\n\n${TEXTS.ASK_AGE}`, { parse_mode: 'HTML' });
  }

  // ── Jins tanlash (ro'yxatdan o'tish) ──
  if (data.startsWith('gender_')) {
    const gender = data === 'gender_male' ? 'male' : 'female';
    const genderText = gender === 'male' ? '👨 Erkak' : '👩 Ayol';
    await db.upsertUser(userId, { gender, step: STEPS.ASK_KASB });
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    return ctx.reply(`👤 Jins: <b>${genderText}</b>\n\n${TEXTS.ASK_KASB}`, { parse_mode: 'HTML' });
  }

  // ── Asosiy menyu ──
  if (data === 'main_menu') {
    await db.setStep(userId, STEPS.DONE);
    return ctx.reply('🏠 Asosiy menyu:', { reply_markup: KEYBOARDS.MAIN_MENU });
  }

  // ── Tahrirlash menyusi ──
  if (data === 'edit_region') {
    await db.setStep(userId, STEPS.EDIT_REGION);
    return ctx.reply(TEXTS.ASK_REGION, { parse_mode: 'HTML', reply_markup: KEYBOARDS.REGION });
  }

  if (data === 'edit_age') {
    await db.setStep(userId, STEPS.EDIT_AGE);
    return ctx.reply(TEXTS.ASK_AGE, { parse_mode: 'HTML' });
  }

  if (data === 'edit_gender') {
    await db.setStep(userId, STEPS.EDIT_GENDER);
    return ctx.reply(TEXTS.ASK_GENDER, { parse_mode: 'HTML', reply_markup: KEYBOARDS.GENDER });
  }

  if (data === 'edit_photo') {
    await db.setStep(userId, STEPS.EDIT_PHOTO);
    return ctx.reply(TEXTS.ASK_PHOTO, { parse_mode: 'HTML' });
  }

  if (data === 'edit_kasb') {
    await db.setStep(userId, STEPS.EDIT_KASB);
    return ctx.reply(TEXTS.ASK_KASB, { parse_mode: 'HTML' });
  }

  // ── Viloyatni tahrirlash ──
  if (data.startsWith('region_') && user.step === STEPS.EDIT_REGION) {
    const region = data.replace('region_', '');
    await db.upsertUser(userId, { region, step: STEPS.DONE });
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    return ctx.reply(`✅ Viloyat <b>${region}</b> ga o'zgartirildi!`, {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.MAIN_MENU,
    });
  }

  // ── Jinsni tahrirlash ──
  if (data.startsWith('gender_') && user.step === STEPS.EDIT_GENDER) {
    const gender = data === 'gender_male' ? 'male' : 'female';
    await db.upsertUser(userId, { gender, step: STEPS.DONE });
    return ctx.reply('✅ Jins yangilandi!', {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.MAIN_MENU,
    });
  }

  // ── Qidiruv: viloyat ──
  if (data.startsWith('sregion_')) {
    const region = data.replace('sregion_', '');
    await db.upsertUser(userId, { search_region: region, step: STEPS.SEARCH_GENDER });
    return ctx.reply(TEXTS.SEARCH_GENDER, { parse_mode: 'HTML', reply_markup: KEYBOARDS.SEARCH_GENDER });
  }

  // ── Qidiruv: jins ──
  if (data.startsWith('sgender_')) {
    const gender = data.replace('sgender_', '');
    await db.upsertUser(userId, { search_gender: gender, step: STEPS.DONE });
    await ctx.reply('🔍 Qidiruv boshlanmoqda...', { parse_mode: 'HTML' });
    return findAndShowUser(ctx, db, userId);
  }

  // ── Layk ──
  if (data.startsWith('like_')) {
    const targetId = parseInt(data.replace('like_', ''), 10);
    await db.addLike(userId, targetId);

    try {
      const liker = await db.getUser(userId);
      const likerName = liker.first_name || 'Kimdir';
      await ctx.telegram.sendMessage(
        targetId,
        `❤️ <b>${likerName}</b> sizga layk bosdi!\n\n"❤️ Layklarim" bo'limidan profilni ko'rishingiz mumkin.`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      // Foydalanuvchi botni bloklagan bo'lishi mumkin
    }

    await ctx.reply(TEXTS.LIKE_SENT, { parse_mode: 'HTML' });
    return findAndShowUser(ctx, db, userId);
  }

  // ── O'tkazib yuborish ──
  if (data === 'skip') {
    return findAndShowUser(ctx, db, userId);
  }

  // ── Layk bosgan odamning profilini ko'rish (to'lov talab qilinadi) ──
  if (data.startsWith('see_liker_')) {
    const likerId = parseInt(data.replace('see_liker_', ''), 10);
    const hasPaid = (await db.hasPaid(userId, likerId)) || (await db.hasPaid(likerId, userId));

    if (hasPaid) {
      return showUserProfile(ctx, db, userId, likerId, true);
    }

    return ctx.reply(TEXTS.PAYMENT_REQUIRED(PROFILE_PRICE), {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.PAY(likerId, PROFILE_PRICE),
    });
  }

  // ── To'lov ──
  if (data.startsWith('pay_')) {
    const targetUserId = parseInt(data.replace('pay_', ''), 10);
    return sendPaymentInvoice(ctx, db, userId, targetUserId);
  }

  // ── Qidiruvdan profilni ochish (to'lov orqali) ──
  if (data.startsWith('open_profile_')) {
    const targetUserId = parseInt(data.replace('open_profile_', ''), 10);
    const hasPaid = await db.hasPaid(userId, targetUserId);
    if (hasPaid) {
      return showUserProfile(ctx, db, userId, targetUserId, true);
    }
    return ctx.reply(TEXTS.PAYMENT_REQUIRED(PROFILE_PRICE), {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.PAY(targetUserId, PROFILE_PRICE),
    });
  }
}

// ─── Qidiruvni boshlash ───────────────────────────────────────────────────────
async function startSearch(ctx, db, userId) {
  await db.setStep(userId, STEPS.SEARCH_AGE_MIN);
  await ctx.reply(TEXTS.SEARCH_TITLE, { parse_mode: 'HTML' });
  await ctx.reply(TEXTS.SEARCH_AGE_MIN, { parse_mode: 'HTML' });
}

// ─── Mos foydalanuvchini topish va ko'rsatish ────────────────────────────────
async function findAndShowUser(ctx, db, userId) {
  const currentUser = await db.getUser(userId);
  if (!currentUser) return;

  const target = await db.searchUsers(userId, {
    minAge: currentUser.search_min_age,
    maxAge: currentUser.search_max_age,
    region: currentUser.search_region,
    gender: currentUser.search_gender,
  });

  if (!target) {
    return ctx.reply(TEXTS.NO_USERS, { parse_mode: 'HTML', reply_markup: KEYBOARDS.BACK });
  }

  await showUserProfile(ctx, db, userId, target.user_id, false);
}

// ─── Foydalanuvchi profilini ko'rsatish ──────────────────────────────────────
async function showUserProfile(ctx, db, viewerId, targetUserId, showContact) {
  const target = await db.getUser(targetUserId);
  if (!target) return;

  const genderText = target.gender === 'male' ? '👨 Erkak' : '👩 Ayol';
  const kasbText = target.kasb ? `\n💼 Kasb: ${target.kasb}` : '';
  const caption = showContact
    ? `<b>${target.first_name || 'Foydalanuvchi'}</b>, ${target.age} yosh\n📍 ${target.region}\n${genderText}${kasbText}\n\n💬 Telegram: @${target.username || "username yo'q"}`
    : `<b>${target.first_name || 'Foydalanuvchi'}</b>, ${target.age} yosh\n📍 ${target.region}\n${genderText}${kasbText}`;

  const markup = showContact ? KEYBOARDS.BACK : KEYBOARDS.SEARCH_ACTIONS(target.user_id);

  if (target.photo_file_id) {
    await ctx.telegram.sendPhoto(viewerId, target.photo_file_id, {
      caption,
      parse_mode: 'HTML',
      reply_markup: markup,
    });
  } else {
    await ctx.telegram.sendMessage(viewerId, caption, { parse_mode: 'HTML', reply_markup: markup });
  }
}

// ─── Layklarni ko'rsatish ─────────────────────────────────────────────────────
async function showLikes(ctx, db, userId) {
  const likes = await db.getLikesReceived(userId);

  if (likes.length === 0) {
    return ctx.reply("😔 Hozircha layk yo'q.\n\nFaol bo'ling, qidiruv orqali layk bering!", {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.BACK,
    });
  }

  await ctx.reply(`❤️ <b>Sizga ${likes.length} ta layk keldi:</b>\n\nProfilni ko'rish uchun bosing:`, {
    parse_mode: 'HTML',
    reply_markup: KEYBOARDS.LIKES_LIST(likes),
  });
}

// ─── O'z profilini ko'rsatish ─────────────────────────────────────────────────
async function showMyProfile(ctx, db, userId) {
  const user = await db.getUser(userId);
  if (!user || user.step !== STEPS.DONE) {
    return ctx.reply("❌ Anketangiz to'liq emas. /start bosing.");
  }

  const genderText = user.gender === 'male' ? '👨 Erkak' : '👩 Ayol';
  const kasbText = user.kasb ? `\n💼 Kasb: <b>${user.kasb}</b>` : '';
  const caption = `👤 <b>Mening anketam</b>\n\n🏷 Ism: <b>${user.first_name}</b>\n🎂 Yosh: <b>${user.age}</b>\n📍 Viloyat: <b>${user.region}</b>\n${genderText}${kasbText}`;

  if (user.photo_file_id) {
    await ctx.replyWithPhoto(user.photo_file_id, {
      caption,
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.BACK,
    });
  } else {
    await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: KEYBOARDS.BACK });
  }
}

// ─── Tahrirlash menyusi ───────────────────────────────────────────────────────
async function showEditMenu(ctx, db, userId) {
  await ctx.reply("✏️ <b>Anketani tahrirlash</b>\n\nNimani o'zgartirmoqchisiz?", {
    parse_mode: 'HTML',
    reply_markup: KEYBOARDS.EDIT_MENU,
  });
}

// ─── To'lov havolasini yuborish (MirPay.uz orqali) ──────────────────────────
async function sendPaymentInvoice(ctx, db, userId, targetUserId) {
  if (!mirpay.isConfigured()) {
    return ctx.reply(TEXTS.PAYMENT_NOT_CONFIGURED, {
      parse_mode: 'HTML',
      reply_markup: KEYBOARDS.BACK,
    });
  }

  try {
    const { payId, payUrl } = await mirpay.createPayment(
      PROFILE_PRICE,
      `Profil korish ${userId}->${targetUserId}`
    );

    if (!payId) {
      throw new Error("MirPay javobidan payid topilmadi, Railway logini tekshiring");
    }

    // Webhook kelganda kim kimni ko'rmoqchi ekanini bilish uchun saqlab qo'yamiz
    await db.createPendingMirpayPayment(userId, targetUserId, PROFILE_PRICE, payId);

    if (payUrl) {
      await ctx.reply(
        `💳 <b>${PROFILE_PRICE.toLocaleString('ru-RU')} so'm to'lash uchun havola tayyor.</b>\n\nTo'lovni 15 daqiqa ichida amalga oshiring, aks holda havola yaroqsiz bo'lib qoladi.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "💳 To'lash", url: payUrl }],
              [{ text: '🔙 Orqaga', callback_data: 'main_menu' }],
            ],
          },
        }
      );
    } else {
      // payUrl topilmadi — lekin payId bor, demak so'rov ketgan.
      // Railway logida "MirPay create-pay javobi" qatorini ko'rib, qaysi
      // maydonda havola kelganini bilib, mirpay.js dagi payUrl ro'yxatiga
      // qo'shish kerak bo'ladi.
      await ctx.reply(
        "⚠️ To'lov yaratildi, lekin havola topilmadi. Iltimos, admin bilan bog'laning.",
        { parse_mode: 'HTML', reply_markup: KEYBOARDS.BACK }
      );
    }
  } catch (err) {
    console.error('MirPay to\'lov yaratishda xatolik:', err.message);
    await ctx.reply(
      "💳 <b>To'lov tizimida vaqtincha xatolik.</b>\n\nIltimos, keyinroq urinib ko'ring.",
      { parse_mode: 'HTML', reply_markup: KEYBOARDS.BACK }
    );
  }
}

// ─── MirPay webhook kelganda chaqiriladi (bot.js dagi /mirpay-webhook dan) ──
// payload: { payid, summa, status, comment, chek, fiskal, sana }
async function handleMirpayWebhook(bot, db, payload) {
  const { payid, status } = payload;
  if (!payid) return;

  const payment = await db.findPaymentByPayId(payid);
  if (!payment) {
    console.warn('MirPay webhook: noma\'lum payid:', payid);
    return;
  }

  // Status muvaffaqiyatli ekanini bildiruvchi mumkin bo'lgan qiymatlar
  const isPaid = ['paid', 'success', 'muvaffaqiyatli', 'ok', '1', 'true'].includes(
    String(status).toLowerCase()
  );

  if (!isPaid) {
    await db.markMirpayPaymentStatus(payid, 'cancelled');
    return;
  }

  await db.markMirpayPaymentStatus(payid, 'paid');

  const viewerId = payment.user_id;
  const targetId = payment.target_user_id;

  await db.markLikePaid(targetId, viewerId);

  try {
    await bot.telegram.sendMessage(viewerId, TEXTS.PAYMENT_SUCCESS, { parse_mode: 'HTML' });
  } catch (e) {
    // foydalanuvchi botni bloklagan bo'lishi mumkin
  }

  // showUserProfile funksiyasi faqat ctx.telegram dan foydalanadi,
  // shuning uchun soxta ctx obyekti bilan qayta ishlatamiz
  await showUserProfile({ telegram: bot.telegram }, db, viewerId, targetId, true);
}



module.exports = {
  handleStart,
  handleMessage,
  handlePhoto,
  handleCallback,
  handleMirpayWebhook,
};
