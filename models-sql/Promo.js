import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';
import { Product } from './Product.js';

const sequelize = getSequelize();

const Promo = sequelize.define('Promo', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  title: { type: DataTypes.STRING, allowNull: false },
  subtitle: { type: DataTypes.STRING(1024), allowNull: false },
  bundleSize: { type: DataTypes.INTEGER, allowNull: false },
  bundlePrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  categorySlugs: { type: DataTypes.JSON, allowNull: true },
  accentColor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#c8a96e' },
  cartLabel: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Bundle' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'promos' });

const PromoProduct = sequelize.define('PromoProduct', {
  promoId: { type: DataTypes.CHAR(24), allowNull: false, primaryKey: true, field: 'promo_id' },
  productId: { type: DataTypes.CHAR(24), allowNull: false, primaryKey: true, field: 'product_id' },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'promo_products', timestamps: false });

Promo.belongsToMany(Product, { as: 'products', through: PromoProduct, foreignKey: 'promoId', otherKey: 'productId' });
Product.belongsToMany(Promo, { as: 'promos', through: PromoProduct, foreignKey: 'productId', otherKey: 'promoId' });

export { Promo, PromoProduct };
export default Promo;
