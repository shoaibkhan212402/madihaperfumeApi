import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';
import Order from './Order.js';

const sequelize = getSequelize();

const ReturnRequest = sequelize.define('ReturnRequest', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  orderId: { type: DataTypes.CHAR(24), allowNull: true, field: 'order_id' },
  orderIdText: { type: DataTypes.STRING, allowNull: true, field: 'order_id_text' },
  orderSource: {
    type: DataTypes.ENUM('WEBSITE', 'WHATSAPP', 'OTHER'), allowNull: false, defaultValue: 'WEBSITE',
    field: 'order_source',
  },
  customerName: { type: DataTypes.STRING, allowNull: false, field: 'customer_name' },
  phone: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: true },
  deliveredAt: { type: DataTypes.DATE, allowNull: false, field: 'delivered_at' },
  description: { type: DataTypes.TEXT, allowNull: false },
  images: { type: DataTypes.JSON, allowNull: true },
  status: { type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'), allowNull: false, defaultValue: 'PENDING' },
  resolutionType: { type: DataTypes.ENUM('RETURN', 'REPLACEMENT'), allowNull: true, field: 'resolution_type' },
  adminNote: { type: DataTypes.STRING(1024), allowNull: true, field: 'admin_note' },
  processedAt: { type: DataTypes.DATE, allowNull: true, field: 'processed_at' },
}, { tableName: 'return_requests' });

ReturnRequest.belongsTo(Order, { as: 'order', foreignKey: 'orderId' });

export default ReturnRequest;
