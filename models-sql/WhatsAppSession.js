import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';

const sequelize = getSequelize();

const WhatsAppSession = sequelize.define('WhatsAppSession', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  sessionName: { type: DataTypes.STRING(100), allowNull: false, unique: true, defaultValue: 'madiha_master', field: 'session_name' },
  sessionData: { type: DataTypes.TEXT('long'), allowNull: true, field: 'session_data' },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'INITIALIZING' },
  qrCode: { type: DataTypes.TEXT, allowNull: true, field: 'qr_code' },
  error: { type: DataTypes.STRING(1024), allowNull: true },
  lastConnectedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_connected_at' },
  connectionUpSince: { type: DataTypes.DATE, allowNull: true, field: 'connection_up_since' },
  lastUpdated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'last_updated' },
}, { tableName: 'whatsapp_sessions' });

export default WhatsAppSession;
