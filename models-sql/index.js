import { getSequelize } from '../config/mysql.js';
import Category from './Category.js';
import { Product, ProductImage, ProductFeature, ProductSize } from './Product.js';
import { User, UserAddress, UserCartItem } from './User.js';
import { Order, OrderItem } from './Order.js';
import { Combo, ComboInclude, ComboProduct } from './Combo.js';
import { Promo, PromoProduct } from './Promo.js';
import Coupon from './Coupon.js';
import Newsletter from './Newsletter.js';
import Reel from './Reel.js';
import Banner from './Banner.js';
import ReturnRequest from './ReturnRequest.js';
import { SiteSettings, SiteTestimonial, SiteWhyUs, SiteTrustBar } from './SiteSettings.js';
import WhatsAppSession from './WhatsAppSession.js';

export const sequelize = getSequelize();

export {
  Category,
  Product, ProductImage, ProductFeature, ProductSize,
  User, UserAddress, UserCartItem,
  Order, OrderItem,
  Combo, ComboInclude, ComboProduct,
  Promo, PromoProduct,
  Coupon,
  Newsletter,
  Reel,
  Banner,
  ReturnRequest,
  SiteSettings, SiteTestimonial, SiteWhyUs, SiteTrustBar,
  WhatsAppSession,
};
