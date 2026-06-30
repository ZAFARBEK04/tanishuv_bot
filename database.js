const mongoose = require('mongoose');

// ─── Schemas ─────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  user_id: { type: Number, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  first_name: { type: String, default: '' },
  last_name: { type: String, default: '' },
  region: { type: String, default: null },
  age: { type: Number, default: null },
  gender: { type: String, default: null }, // 'male' | 'female'
  photo_file_id: { type: String, default: null },
  step: { type: String, default: 'start' },
  search_min_age: { type: Number, default: 18 },
  search_max_age: { type: Number, default: 40 },
  search_region: { type: String, default: 'any' },
  search_gender: { type: String, default: 'any' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const likeSchema = new mongoose.Schema({
  from_user_id: { type: Number, required: true, index: true },
  to_user_id: { type: Number, required: true, index: true },
  paid: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
likeSchema.index({ from_user_id: 1, to_user_id: 1 }, { unique: true });

const paymentSchema = new mongoose.Schema({
  user_id: { type: Number, required: true, index: true },
  target_user_id: { type: Number, default: null },
  amount: { type: Number, default: 0 },
  type: { type: String, default: '' },
  provider: { type: String, default: 'mirpay' }, // 'mirpay' | 'telegram'
  telegram_charge_id: { type: String, default: null }, // Telegram to'lov tasdiqlash ID'si (eski usul uchun)
  mirpay_payid: { type: String, default: null, index: true }, // MirPay to'lov identifikatori
  status: { type: String, default: 'pending' }, // pending | paid | cancelled
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const UserModel = mongoose.model('User', userSchema);
const LikeModel = mongoose.model('Like', likeSchema);
const PaymentModel = mongoose.model('Payment', paymentSchema);

// ─── Database class — handlers.js bilan bir xil interfeys ──────────────────
class Database {
  constructor() {
    this.User = UserModel;
    this.Like = LikeModel;
    this.Payment = PaymentModel;
    this._cache = new Map(); // user_id -> plain user obj (tezlik uchun, ixtiyoriy)
  }

  async connect(uri) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log('✅ MongoDB ulandi');
  }

  // ── Foydalanuvchini saqlash/yangilash ──
  async upsertUser(userId, data) {
    const doc = await this.User.findOneAndUpdate(
      { user_id: userId },
      { $set: data, $setOnInsert: { user_id: userId } },
      { upsert: true, new: true }
    ).lean();
    return doc;
  }

  async getUser(userId) {
    return this.User.findOne({ user_id: userId }).lean();
  }

  async setStep(userId, step) {
    return this.User.findOneAndUpdate(
      { user_id: userId },
      { $set: { step }, $setOnInsert: { user_id: userId } },
      { upsert: true, new: true }
    ).lean();
  }

  // ── Mos foydalanuvchilarni qidirish ──
  // Bir xil odamga ikki marta ko'rsatmaslik uchun excludeIds qo'shimcha beriladi (RAM ichida, session davomida)
  async searchUsers(currentUserId, options = {}) {
    const { minAge, maxAge, region, gender, excludeIds = [] } = options;

    const filter = {
      user_id: { $ne: currentUserId, $nin: excludeIds },
      photo_file_id: { $ne: null },
      age: { $ne: null },
      gender: { $ne: null },
      region: { $ne: null },
      step: 'done',
    };

    if (minAge) filter.age = { ...filter.age, $gte: minAge };
    if (maxAge) filter.age = { ...filter.age, $lte: maxAge };
    if (region && region !== 'any') filter.region = region;
    if (gender && gender !== 'any') filter.gender = gender;

    // Avval layk bosilganlarni chiqarib tashlash
    const likedIds = await this.Like.find({ from_user_id: currentUserId }).distinct('to_user_id');
    if (likedIds.length) {
      filter.user_id.$nin = [...new Set([...filter.user_id.$nin, ...likedIds])];
    }

    // Mongo'da tasodifiy 1 ta hujjat olish uchun aggregate + $sample ishlatamiz
    const result = await this.User.aggregate([
      { $match: filter },
      { $sample: { size: 1 } },
    ]);

    return result[0] || null;
  }

  // ── Layk qo'shish ──
  async addLike(fromUserId, toUserId) {
    try {
      await this.Like.updateOne(
        { from_user_id: fromUserId, to_user_id: toUserId },
        { $setOnInsert: { from_user_id: fromUserId, to_user_id: toUserId, paid: false } },
        { upsert: true }
      );
      return true;
    } catch {
      return false;
    }
  }

  // ── Foydalanuvchiga kelgan (hali pullik ochilmagan) layklar ──
  async getLikesReceived(userId) {
    const likes = await this.Like.find({ to_user_id: userId, paid: false }).lean();
    if (!likes.length) return [];

    const fromIds = likes.map((l) => l.from_user_id);
    const users = await this.User.find({ user_id: { $in: fromIds } }).lean();
    const userMap = new Map(users.map((u) => [u.user_id, u]));

    return likes.map((l) => {
      const u = userMap.get(l.from_user_id) || {};
      return {
        from_user_id: l.from_user_id,
        to_user_id: l.to_user_id,
        first_name: u.first_name,
        age: u.age,
        region: u.region,
        gender: u.gender,
      };
    });
  }

  // ── Layk uchun to'lov qilingan deb belgilash (profil ochiladi) ──
  async markLikePaid(fromUserId, toUserId) {
    return this.Like.updateOne(
      { from_user_id: fromUserId, to_user_id: toUserId },
      { $set: { paid: true } }
    );
  }

  // ── To'lovni saqlash ──
  async recordPayment(userId, data) {
    return this.Payment.create({
      user_id: userId,
      target_user_id: data.targetUserId || null,
      amount: data.amount,
      type: data.type,
      provider: data.provider || 'telegram',
      telegram_charge_id: data.chargeId || null,
      mirpay_payid: data.mirpayPayId || null,
      status: data.status || 'paid',
    });
  }

  // ── MirPay: to'lov "pending" holatda yaratilganda saqlanadi ──
  async createPendingMirpayPayment(userId, targetUserId, amount, payId) {
    return this.Payment.create({
      user_id: userId,
      target_user_id: targetUserId,
      amount,
      type: 'view_profile',
      provider: 'mirpay',
      mirpay_payid: payId,
      status: 'pending',
    });
  }

  // ── MirPay: webhook kelganda payid orqali to'lovni topish ──
  async findPaymentByPayId(payId) {
    return this.Payment.findOne({ mirpay_payid: payId }).lean();
  }

  // ── MirPay: webhook kelganda statusni yangilash ──
  async markMirpayPaymentStatus(payId, status) {
    return this.Payment.updateOne({ mirpay_payid: payId }, { $set: { status } });
  }

  // ── Profilni ko'rish uchun to'lov qilinganmi? ──
  async hasPaid(viewerUserId, targetUserId) {
    const res = await this.Like.findOne({
      from_user_id: viewerUserId,
      to_user_id: targetUserId,
      paid: true,
    }).lean();
    return !!res;
  }
}

module.exports = Database;
