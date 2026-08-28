import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

const Banner = sequelize.define('Banner', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  titleFirst: { type: DataTypes.STRING, allowNull: false, defaultValue: '', field: 'title_first' },
  titleSecond: { type: DataTypes.STRING, allowNull: false, defaultValue: '', field: 'title_second' },
  eyebrow: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
  subtitle: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '' },
  image: { type: DataTypes.STRING(1024), allowNull: false },
  mobileImage: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '', field: 'mobile_image' },
  textColor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#ffffff', field: 'text_color' },
  ctaLabel: { type: DataTypes.STRING, allowNull: false, defaultValue: '', field: 'cta_label' },
  ctaLink: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '', field: 'cta_link' },
  cta2Label: { type: DataTypes.STRING, allowNull: false, defaultValue: '', field: 'cta2_label' },
  cta2Link: { type: DataTypes.STRING(1024), allowNull: false, defaultValue: '', field: 'cta2_link' },
  order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'banners' });

export default Banner;
