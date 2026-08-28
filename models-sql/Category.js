import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

const Category = sequelize.define('Category', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  image: { type: DataTypes.STRING(1024), allowNull: true },
  parentCategoryId: { type: DataTypes.CHAR(24), allowNull: true, field: 'parent_category_id' },
  seoTitle: { type: DataTypes.STRING, allowNull: true },
  seoDescription: { type: DataTypes.TEXT, allowNull: true },
  seoKeywords: { type: DataTypes.STRING(512), allowNull: true },
}, { tableName: 'categories' });

Category.belongsTo(Category, { as: 'parentCategory', foreignKey: 'parentCategoryId' });
Category.hasMany(Category, { as: 'subCategories', foreignKey: 'parentCategoryId' });

export default Category;
