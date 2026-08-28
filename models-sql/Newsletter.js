import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

const Newsletter = sequelize.define('Newsletter', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  email: {
    type: DataTypes.STRING, allowNull: false, unique: true,
    set(value) { this.setDataValue('email', String(value).trim().toLowerCase()); },
  },
  subscribedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'newsletters' });

export default Newsletter;
