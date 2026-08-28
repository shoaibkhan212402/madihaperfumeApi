import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

const Coupon = sequelize.define('Coupon', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  code: {
    type: DataTypes.STRING(100), allowNull: false, unique: true,
    set(value) { this.setDataValue('code', String(value).trim().toUpperCase()); },
  },
  description: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '' },
  discountType: { type: DataTypes.ENUM('PERCENT', 'FLAT'), allowNull: false, field: 'discount_type' },
  discountValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
  freeShipping: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  minOrderAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  maxUses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  startsAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'coupons' });

// Shared computed check — used directly in route logic (couponRoutes.js /apply)
// AND by the serializer, so the two never drift out of sync (mirrors the old
// Mongoose `isValid` virtual, which was likewise a single source of truth).
Coupon.prototype.isCouponValid = function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.startsAt && new Date(this.startsAt) > now) return false;
  if (this.expiresAt && new Date(this.expiresAt) < now) return false;
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) return false;
  return true;
};

export default Coupon;
