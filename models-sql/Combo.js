import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';
import { Product } from './Product.js';

const sequelize = getSequelize();

const Combo = sequelize.define('Combo', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  shortDesc: { type: DataTypes.STRING(1024), allowNull: true },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  originalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  image: { type: DataTypes.STRING(1024), allowNull: true },
  badge: { type: DataTypes.STRING, allowNull: true },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'combos' });

const ComboInclude = sequelize.define('ComboInclude', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  comboId: { type: DataTypes.CHAR(24), allowNull: false, field: 'combo_id' },
  text: { type: DataTypes.STRING(1024), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'combo_includes', timestamps: false });

const ComboProduct = sequelize.define('ComboProduct', {
  comboId: { type: DataTypes.CHAR(24), allowNull: false, primaryKey: true, field: 'combo_id' },
  productId: { type: DataTypes.CHAR(24), allowNull: false, primaryKey: true, field: 'product_id' },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'combo_products', timestamps: false });

Combo.hasMany(ComboInclude, { as: 'includes', foreignKey: 'comboId' });
ComboInclude.belongsTo(Combo, { foreignKey: 'comboId' });

Combo.belongsToMany(Product, { as: 'products', through: ComboProduct, foreignKey: 'comboId', otherKey: 'productId' });
Product.belongsToMany(Combo, { as: 'combos', through: ComboProduct, foreignKey: 'productId', otherKey: 'comboId' });

export { Combo, ComboInclude, ComboProduct };
export default Combo;
