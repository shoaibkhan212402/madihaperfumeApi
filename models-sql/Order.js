import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/mysql.js';
import { genId } from './_id.js';
import User from './User.js';
import { Product } from './Product.js';

const sequelize = getSequelize();

const Order = sequelize.define('Order', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  userId: { type: DataTypes.CHAR(24), allowNull: false, field: 'user_id' },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.STRING(1024), allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  state: { type: DataTypes.STRING, allowNull: true },
  postalCode: { type: DataTypes.STRING(20), allowNull: false },
  country: { type: DataTypes.STRING, allowNull: false },
  paymentMethod: { type: DataTypes.STRING(100), allowNull: false },
  paymentId: { type: DataTypes.STRING, allowNull: true },
  paymentStatus: { type: DataTypes.STRING(100), allowNull: true },
  paymentEmail: { type: DataTypes.STRING, allowNull: true },
  itemsPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  taxPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  shippingPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  totalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  couponCode: { type: DataTypes.STRING(100), allowNull: true },
  isPaid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  paidAt: { type: DataTypes.DATE, allowNull: true },
  isDelivered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  deliveredAt: { type: DataTypes.DATE, allowNull: true },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'),
    allowNull: false, defaultValue: 'PENDING',
  },
  awbCode: { type: DataTypes.STRING, allowNull: true },
  courierName: { type: DataTypes.STRING, allowNull: true },
  shiprocketOrderId: { type: DataTypes.STRING, allowNull: true },
  shiprocketShipmentId: { type: DataTypes.STRING, allowNull: true },
  isReturnRequested: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  returnReason: { type: DataTypes.STRING(1024), allowNull: true },
  returnStatus: {
    type: DataTypes.ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED'),
    allowNull: false, defaultValue: 'NONE',
  },
  returnRequestedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'orders' });

const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.CHAR(24), primaryKey: true, defaultValue: genId },
  orderId: { type: DataTypes.CHAR(24), allowNull: false, field: 'order_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  qty: { type: DataTypes.INTEGER, allowNull: false },
  image: { type: DataTypes.STRING(1024), allowNull: false },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  productId: { type: DataTypes.CHAR(24), allowNull: true, field: 'product_id' },
  productRef: { type: DataTypes.STRING, allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'order_items', timestamps: false });

Order.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(Order, { as: 'orders', foreignKey: 'userId' });

Order.hasMany(OrderItem, { as: 'orderItems', foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

OrderItem.belongsTo(Product, { as: 'product', foreignKey: 'productId' });

export { Order, OrderItem };
export default Order;
