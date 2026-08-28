import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

const Reel = sequelize.define('Reel', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  videoUrl: { type: DataTypes.STRING(1024), allowNull: false, field: 'video_url' },
  thumbnail: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '' },
  caption: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '' },
  instagramLink: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '' },
  order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'reels' });

export default Reel;
