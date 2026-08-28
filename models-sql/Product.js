import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';
import Category from './Category.js';

const sequelize = getSequelize();

const Product = sequelize.define('Product', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  originalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  categoryId: { type: DataTypes.CHAR(24), allowNull: false, field: 'category_id' },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  badge: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  isBestSeller: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  seoTitle: { type: DataTypes.STRING, allowNull: true },
  seoDescription: { type: DataTypes.TEXT, allowNull: true },
  seoKeywords: { type: DataTypes.STRING(512), allowNull: true },
}, { tableName: 'products' });

const ProductImage = sequelize.define('ProductImage', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  productId: { type: DataTypes.CHAR(24), allowNull: false, field: 'product_id' },
  url: { type: DataTypes.STRING(1024), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'product_images', timestamps: false });

const ProductFeature = sequelize.define('ProductFeature', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  productId: { type: DataTypes.CHAR(24), allowNull: false, field: 'product_id' },
  text: { type: DataTypes.STRING(1024), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'product_features', timestamps: false });

const ProductSize = sequelize.define('ProductSize', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  productId: { type: DataTypes.CHAR(24), allowNull: false, field: 'product_id' },
  label: { type: DataTypes.STRING(100), allowNull: false },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  originalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'product_sizes', timestamps: false });

Product.belongsTo(Category, { as: 'category', foreignKey: 'categoryId' });
Category.hasMany(Product, { as: 'products', foreignKey: 'categoryId' });

Product.hasMany(ProductImage, { as: 'images', foreignKey: 'productId' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(ProductFeature, { as: 'features', foreignKey: 'productId' });
ProductFeature.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(ProductSize, { as: 'sizes', foreignKey: 'productId' });
ProductSize.belongsTo(Product, { foreignKey: 'productId' });

export { Product, ProductImage, ProductFeature, ProductSize };
export default Product;
