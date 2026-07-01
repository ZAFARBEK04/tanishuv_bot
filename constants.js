const REGIONS = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Samarqand',
  'Buxoro',
  'Andijon',
  "Farg'ona",
  'Namangan',
  'Qashqadaryo',
  'Surxondaryo',
  'Jizzax',
  'Sirdaryo',
  'Navoiy',
  'Xorazm',
  "Qoraqalpog'iston",
];

const STEPS = {
  START: 'start',
  ASK_REGION: 'ask_region',
  ASK_AGE: 'ask_age',
  ASK_GENDER: 'ask_gender',
  ASK_KASB: 'ask_kasb',
  ASK_PHOTO: 'ask_photo',
  DONE: 'done',
  EDIT_REGION: 'edit_region',
  EDIT_AGE: 'edit_age',
  EDIT_GENDER: 'edit_gender',
  EDIT_KASB: 'edit_kasb',
  EDIT_PHOTO: 'edit_photo',
  SEARCH_AGE_MIN: 'search_age_min',
  SEARCH_AGE_MAX: 'search_age_max',
  SEARCH_REGION: 'search_region',
  SEARCH_GENDER: 'search_gender',
  SEARCHING: 'searching',
};

const PROFILE_PRICE = parseInt(process.env.PROFILE_PRICE || '5000', 10);

const TEXTS = {
  WELCOME: (name) => `👋 Salom, <b>${name}</b>!\n\n💕 <b>TanishuvBot</b>ga xush kelibsiz!\n\nAnketa to'ldirish uchun davom eting.`,
  ASK_REGION: "📍 <b>Qaysi viloyatdansiz?</b>\n\nQuyidagi ro'yxatdan tanlang:",
  ASK_AGE: '🎂 <b>Yoshingiz nechada?</b>\n\n(Faqat raqam yozing, masalan: 25)',
  ASK_GENDER: '👤 <b>Jinsingiz?</b>',
  ASK_KASB: '💼 <b>Kasbingiz nima?</b>\n\n(Masalan: Dasturchi, O\'qituvchi, Shifokor, Talaba va h.k.)',
  ASK_PHOTO: '📸 <b>Rasmingizni yuboring!</b>\n\n(Eng yaxshi rasmingizni yuboring 😊)',
  PROFILE_DONE: "✅ <b>Anketangiz tayyor!</b>\n\nEndi qidiruvni boshlashingiz mumkin.",
  INVALID_AGE: "❌ Iltimos, to'g'ri yosh kiriting (14-80 oralig'ida raqam)",
  SEARCH_TITLE: '🔍 <b>Qidiruv sozlamalari</b>\n\nKimni qidiryapsiz?',
  SEARCH_AGE_MIN: '📊 <b>Yosh chegarasi</b>\n\nMinimal yosh kiriting (masalan: 18):',
  SEARCH_AGE_MAX: (min) => `📊 Maksimal yosh kiriting (${min} dan katta):`,
  SEARCH_REGION: '📍 <b>Qaysi viloyatdan qidirasiz?</b>',
  SEARCH_GENDER: '👤 <b>Qaysi jins vakilini qidiryapsiz?</b>',
  NO_USERS: "😔 Hozircha mos anketa topilmadi.\n\nKeyinroq qayta urinib ko'ring!",
  LIKE_SENT: '❤️ Layk yuborildi!',
  LIKE_RECEIVED: (count) => `💌 Sizga <b>${count} ta</b> layk kelib tushdi!\n\n"Layklarim" tugmasini bosing.`,
  PAYMENT_REQUIRED: (price) => `💳 Bu profilni ko'rish uchun <b>${price.toLocaleString('ru-RU')} so'm</b> to'lov qilishingiz kerak.`,
  PAYMENT_SUCCESS: "✅ To'lov qabul qilindi! Profil ochilmoqda...",
  PAYMENT_PENDING: "⏳ To'lovingiz tasdiqlanish jarayonida. Bir necha soniyadan so'ng qayta urinib ko'ring.",
  PAYMENT_NOT_CONFIGURED: "💳 <b>To'lov tizimi hali sozlanmagan.</b>\n\nTez orada ishga tushadi. Iltimos, keyinroq urinib ko'ring.",
};

const KEYBOARDS = {
  GENDER: {
    inline_keyboard: [
      [
        { text: '👨 Erkak', callback_data: 'gender_male' },
        { text: '👩 Ayol', callback_data: 'gender_female' },
      ],
    ],
  },
  SEARCH_GENDER: {
    inline_keyboard: [
      [
        { text: '👨 Erkaklar', callback_data: 'sgender_male' },
        { text: '👩 Ayollar', callback_data: 'sgender_female' },
        { text: '👥 Hammasi', callback_data: 'sgender_any' },
      ],
    ],
  },
  MAIN_MENU: {
    keyboard: [
      ['🔍 Qidiruv', '❤️ Layklarim'],
      ['📝 Anketam', '✏️ Tahrirlash'],
    ],
    resize_keyboard: true,
  },
  SEARCH_ACTIONS: (targetId) => ({
    inline_keyboard: [
      [
        { text: '❤️ Layk', callback_data: `like_${targetId}` },
        { text: "👎 O'tkazib yuborish", callback_data: 'skip' },
      ],
      [{ text: "👤 Profilni ochish", callback_data: `open_profile_${targetId}` }],
      [{ text: '🏠 Asosiy menyu', callback_data: 'main_menu' }],
    ],
  }),
  LIKES_LIST: (likes) => ({
    inline_keyboard: [
      ...likes.map((l) => [
        {
          text: `❤️ ${l.first_name || 'Foydalanuvchi'}, ${l.age} yosh — ${l.region}`,
          callback_data: `see_liker_${l.from_user_id}`,
        },
      ]),
      [{ text: '🏠 Asosiy menyu', callback_data: 'main_menu' }],
    ],
  }),
  EDIT_MENU: {
    inline_keyboard: [
      [{ text: '📍 Viloyat', callback_data: 'edit_region' }, { text: '🎂 Yosh', callback_data: 'edit_age' }],
      [{ text: '👤 Jins', callback_data: 'edit_gender' }, { text: '💼 Kasb', callback_data: 'edit_kasb' }],
      [{ text: '📸 Rasm', callback_data: 'edit_photo' }],
      [{ text: '🏠 Orqaga', callback_data: 'main_menu' }],
    ],
  },
  SEARCH_REGION: {
    inline_keyboard: [
      ...chunk(REGIONS, 2).map((row) =>
        row.map((r) => ({ text: r, callback_data: `sregion_${r}` }))
      ),
      [{ text: '🌍 Barcha viloyatlar', callback_data: 'sregion_any' }],
    ],
  },
  REGION: {
    inline_keyboard: [
      ...chunk(REGIONS, 2).map((row) =>
        row.map((r) => ({ text: r, callback_data: `region_${r}` }))
      ),
    ],
  },
  BACK: {
    inline_keyboard: [[{ text: '🏠 Asosiy menyu', callback_data: 'main_menu' }]],
  },
  PAY: (targetUserId, price) => ({
    inline_keyboard: [
      [{ text: `💳 ${price.toLocaleString('ru-RU')} so'm to'lash`, callback_data: `pay_${targetUserId}` }],
      [{ text: '🔙 Orqaga', callback_data: 'main_menu' }],
    ],
  }),
};

function chunk(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

module.exports = { REGIONS, STEPS, TEXTS, KEYBOARDS, PROFILE_PRICE };
