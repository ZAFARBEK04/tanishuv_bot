# 💕 Tanishuv Bot — Telegram Dating Bot

O'zbekiston uchun Node.js da yozilgan tez ishlaydigan Telegram tanishuv boti.
**Stack:** Telegraf (Node.js) + MongoDB (Mongoose) + Express + Railway + Telegram Payments (Ammer Pay).

---

## 🚀 Funksiyalar

- Profil `/start` bosilganda avtomatik saqlanadi
- Anketa to'ldirish: viloyat -> yosh -> jins -> rasm
- Qidiruv filtrlari: yosh oralig'i, viloyat, jins
- Layk tizimi va bildirishnoma ("sizga layk bosishdi")
- Profilni ko'rish uchun 5 000 so'm to'lov (Telegram Payments orqali, bot ichida)
- Anketani istalgan vaqtda tahrirlash

---

## Lokal o'rnatish

```
git clone <repo-url>
cd tanishuv-bot
npm install
cp .env.example .env
npm start
```

.env faylida BOT_TOKEN, MONGO_URI va PAYMENT_PROVIDER_TOKEN to'ldirilishi kerak. PUBLIC_URL bo'sh bo'lsa, bot polling rejimida ishlaydi (lokal test uchun shu yetarli).

---

## MongoDB sozlash (bepul)

1. mongodb.com/cloud/atlas saytida ro'yxatdan o'ting
2. Free Cluster (M0) yarating
3. Database Access bo'limida foydalanuvchi yarating
4. Network Access bo'limida Allow Access from Anywhere (0.0.0.0/0) qo'shing
5. Connect -> Drivers orqali ulanish satrini oling, masalan: mongodb+srv://user:parol@cluster0.xxxxx.mongodb.net/tanishuv_bot
6. Shu satrni MONGO_URI sifatida saqlang

---

## To'lov sozlash (Telegram Payments, Ammer Pay)

Sizda BotFather orqali Ammer Pay Live ulangan va provider tokeningiz bor (masalan 5775769170:LIVE:TG_xxxxxxxxxxxxxxxxxxxx).

Shu tokenni PAYMENT_PROVIDER_TOKEN sifatida .env va Railway Variables ga qo'ying, boshqa hech narsa sozlash shart emas. Bot to'lovni to'g'ridan-to'g'ri Telegram ichida (sendInvoice) so'raydi, foydalanuvchi karta ma'lumotini Telegram'ning o'z to'lov oynasida kiritadi. Tashqi sayt yoki alohida webhook server kerak emas.

To'lov o'tgach, bot avtomatik profilni ochadi, kechikishsiz, chunki bu Telegram'ning o'z successful_payment eventi orqali ishlaydi.

PAYMENT_PROVIDER_TOKEN bo'sh qoldirilsa, to'lov tugmasi bosilganda foydalanuvchiga "to'lov tizimi hali sozlanmagan" deb ko'rsatiladi, bot xato bermay ishlayveradi.

---

## Railway ga Deploy qilish

1. BotFather orqali bot tokenini oling
2. Loyihani GitHub'ga yuklang (git init, git add, git commit, git remote add, git push)
3. Railway'da New Project -> Deploy from GitHub repo orqali repozitoriyani ulang
4. Variables bo'limiga BOT_TOKEN, MONGO_URI, PROFILE_PRICE, PAYMENT_PROVIDER_TOKEN qo'shing
5. Settings -> Networking -> Generate Domain orqali domen oling, uni https:// siz PUBLIC_URL sifatida Variables'ga qo'ying
6. Railway avtomatik qayta deploy qiladi, bot webhook rejimida ishlay boshlaydi

Agar avval boshqa kod bilan repo yaratgan bo'lsangiz, eski fayllarni shu loyihadagi fayllar bilan to'liq almashtirib, qaytadan commit/push qiling.

---

## Fayl tuzilmasi

- bot.js - asosiy fayl: Telegraf, Express server, to'lov eventlari
- handlers.js - bot logikasi: anketa, qidiruv, layk, to'lov
- database.js - MongoDB/Mongoose modellari va metodlari
- constants.js - matnlar, klaviaturalar, viloyatlar ro'yxati
- package.json
- railway.toml - Railway konfiguratsiya
- .env.example
- .gitignore

---

## Ma'lumotlar bazasi tuzilishi (MongoDB)

- users - foydalanuvchi profillari (viloyat, yosh, jins, rasm, qidiruv sozlamalari)
- likes - kim kimga layk bosgani, to'lov holati
- payments - barcha to'lov tarixi (Telegram charge ID bilan)

---

## To'lov oqimi

1. Foydalanuvchi "Layklarim" bo'limida boshqa birovning profilini ko'rmoqchi bo'ladi
2. Bot 5 000 so'm to'lov talab qiladi, "To'lash" tugmasini ko'rsatadi
3. Tugma bosilganda Telegram'ning o'z to'lov oynasi (invoice) ochiladi
4. Foydalanuvchi karta ma'lumotlarini Telegram ichida kiritib to'laydi
5. Telegram botga successful_payment eventini yuboradi, bot darhol profilni ochadi

---

## Nega tez ishlaydi

- Telegraf + webhook: Telegram serverlari to'g'ridan-to'g'ri botga signal yuboradi
- MongoDB: native compile talab qilmaydi, Railway'da tez build bo'ladi
- Telegram Payments: alohida webhook server yoki signature tekshirish kerak emas
- .lean() so'rovlari: Mongoose dokumentlarini emas, sodda JS obyektlarini qaytaradi, tezroq
