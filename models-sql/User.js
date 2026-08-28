import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

const User = sequelize.define('User', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('USER', 'ADMIN'), allowNull: false, defaultValue: 'USER' },
  googleId: { type: DataTypes.STRING, allowNull: true },
  isGoogleUser: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  phone: { type: DataTypes.STRING, allowNull: true },
  isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  otp: { type: DataTypes.STRING, allowNull: true },
  otpExpires: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'users',
  hooks: {
    // Mirrors the old Mongoose `pre('save')` hook: only re-hash when the
    // password field actually changed, so migrated bcrypt hashes (copied
    // verbatim from Mongo) are never double-hashed.
    beforeSave: async (user) => {
      if (!user.changed('password')) return;
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    },
  },
});

User.prototype.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const UserAddress = sequelize.define('UserAddress', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  userId: { type: DataTypes.CHAR(24), allowNull: false, field: 'user_id' },
  type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Home' },
  fullName: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  street: { type: DataTypes.STRING(1024), allowNull: true },
  landmark: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  state: { type: DataTypes.STRING, allowNull: true },
  country: { type: DataTypes.STRING, allowNull: false, defaultValue: 'India' },
  zipCode: { type: DataTypes.STRING(20), allowNull: true },
  isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'user_addresses', timestamps: false });

const UserCartItem = sequelize.define('UserCartItem', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  userId: { type: DataTypes.CHAR(24), allowNull: false, field: 'user_id' },
  productIdText: { type: DataTypes.STRING, allowNull: true, field: 'product_id_text' },
  name: { type: DataTypes.STRING, allowNull: true },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  originalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  image: { type: DataTypes.STRING(1024), allowNull: true },
  qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'user_cart_items', timestamps: false });

User.hasMany(UserAddress, { as: 'addresses', foreignKey: 'userId' });
UserAddress.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(UserCartItem, { as: 'cartItems', foreignKey: 'userId' });
UserCartItem.belongsTo(User, { foreignKey: 'userId' });

export { User, UserAddress, UserCartItem };
export default User;
