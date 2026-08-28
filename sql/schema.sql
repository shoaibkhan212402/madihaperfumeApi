-- Madiha Perfume — MySQL schema (migrated from MongoDB/Mongoose)
-- Primary keys are CHAR(24) and hold the original MongoDB ObjectId hex strings verbatim,
-- so foreign keys, already-issued JWTs, and the frontend's `_id`-as-opaque-string usage
-- all keep working unchanged after migration.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────── categories
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
  id CHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NULL,
  image VARCHAR(1024) NULL,
  parent_category_id CHAR(24) NULL,
  seo_title VARCHAR(255) NULL,
  seo_description TEXT NULL,
  seo_keywords VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── products
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  id CHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  original_price DECIMAL(12,2) NULL,
  category_id CHAR(24) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  badge VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_best_seller TINYINT(1) NOT NULL DEFAULT 0,
  seo_title VARCHAR(255) NULL,
  seo_description TEXT NULL,
  seo_keywords VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_products_active_bestseller (is_active, is_best_seller),
  INDEX idx_products_category_active (category_id, is_active),
  INDEX idx_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS product_images;
CREATE TABLE product_images (
  id CHAR(24) PRIMARY KEY,
  product_id CHAR(24) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_images_product (product_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS product_features;
CREATE TABLE product_features (
  id CHAR(24) PRIMARY KEY,
  product_id CHAR(24) NOT NULL,
  text VARCHAR(1024) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_features_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_features_product (product_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS product_sizes;
CREATE TABLE product_sizes (
  id CHAR(24) PRIMARY KEY,
  product_id CHAR(24) NOT NULL,
  label VARCHAR(100) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  original_price DECIMAL(12,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_sizes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_sizes_product (product_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── users
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id CHAR(24) PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  google_id VARCHAR(255) NULL,
  is_google_user TINYINT(1) NOT NULL DEFAULT 0,
  phone VARCHAR(50) NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  otp VARCHAR(20) NULL,
  otp_expires DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS user_addresses;
CREATE TABLE user_addresses (
  id CHAR(24) PRIMARY KEY,
  user_id CHAR(24) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Home',
  full_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  street VARCHAR(1024) NULL,
  landmark VARCHAR(255) NULL,
  city VARCHAR(255) NULL,
  state VARCHAR(255) NULL,
  country VARCHAR(255) NOT NULL DEFAULT 'India',
  zip_code VARCHAR(20) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_addresses_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS user_cart_items;
CREATE TABLE user_cart_items (
  id CHAR(24) PRIMARY KEY,
  user_id CHAR(24) NOT NULL,
  product_id_text VARCHAR(255) NULL, -- loose string, not a real FK (may hold combo/promo pseudo-ids)
  name VARCHAR(255) NULL,
  price DECIMAL(12,2) NULL,
  original_price DECIMAL(12,2) NULL,
  image VARCHAR(1024) NULL,
  qty INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_user_cart_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_cart_items_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── combos
DROP TABLE IF EXISTS combos;
CREATE TABLE combos (
  id CHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  short_desc VARCHAR(1024) NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  original_price DECIMAL(12,2) NULL,
  image VARCHAR(1024) NULL,
  badge VARCHAR(255) NULL,
  stock INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS combo_includes;
CREATE TABLE combo_includes (
  id CHAR(24) PRIMARY KEY,
  combo_id CHAR(24) NOT NULL,
  text VARCHAR(1024) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_combo_includes_combo FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
  INDEX idx_combo_includes_combo (combo_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS combo_products;
CREATE TABLE combo_products (
  combo_id CHAR(24) NOT NULL,
  product_id CHAR(24) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (combo_id, product_id),
  CONSTRAINT fk_combo_products_combo FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
  CONSTRAINT fk_combo_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── coupons
DROP TABLE IF EXISTS coupons;
CREATE TABLE coupons (
  id CHAR(24) PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(1024) NOT NULL DEFAULT '',
  discount_type ENUM('PERCENT','FLAT') NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL,
  free_shipping TINYINT(1) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_uses INT NOT NULL DEFAULT 0,
  used_count INT NOT NULL DEFAULT 0,
  starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── newsletters
DROP TABLE IF EXISTS newsletters;
CREATE TABLE newsletters (
  id CHAR(24) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── promos
DROP TABLE IF EXISTS promos;
CREATE TABLE promos (
  id CHAR(24) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(1024) NOT NULL,
  bundle_size INT NOT NULL,
  bundle_price DECIMAL(12,2) NOT NULL,
  category_slugs JSON NULL,
  accent_color VARCHAR(20) NOT NULL DEFAULT '#c8a96e',
  cart_label VARCHAR(100) NOT NULL DEFAULT 'Bundle',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS promo_products;
CREATE TABLE promo_products (
  promo_id CHAR(24) NOT NULL,
  product_id CHAR(24) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (promo_id, product_id),
  CONSTRAINT fk_promo_products_promo FOREIGN KEY (promo_id) REFERENCES promos(id) ON DELETE CASCADE,
  CONSTRAINT fk_promo_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── reels
DROP TABLE IF EXISTS reels;
CREATE TABLE reels (
  id CHAR(24) PRIMARY KEY,
  video_url VARCHAR(1024) NOT NULL,
  thumbnail VARCHAR(1024) NOT NULL DEFAULT '',
  caption VARCHAR(1024) NOT NULL DEFAULT '',
  instagram_link VARCHAR(1024) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── banners
DROP TABLE IF EXISTS banners;
CREATE TABLE banners (
  id CHAR(24) PRIMARY KEY,
  title_first VARCHAR(255) NOT NULL DEFAULT '',
  title_second VARCHAR(255) NOT NULL DEFAULT '',
  eyebrow VARCHAR(255) NOT NULL DEFAULT '',
  subtitle VARCHAR(1024) NOT NULL DEFAULT '',
  image VARCHAR(1024) NOT NULL,
  mobile_image VARCHAR(1024) NOT NULL DEFAULT '',
  text_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  cta_label VARCHAR(255) NOT NULL DEFAULT '',
  cta_link VARCHAR(1024) NOT NULL DEFAULT '',
  cta2_label VARCHAR(255) NOT NULL DEFAULT '',
  cta2_link VARCHAR(1024) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── orders
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id CHAR(24) PRIMARY KEY,
  user_id CHAR(24) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  address VARCHAR(1024) NOT NULL,
  city VARCHAR(255) NOT NULL,
  state VARCHAR(255) NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(255) NOT NULL,
  payment_method VARCHAR(100) NOT NULL,
  payment_id VARCHAR(255) NULL,
  payment_status VARCHAR(100) NULL,
  payment_email VARCHAR(255) NULL,
  items_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  coupon_code VARCHAR(100) NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  paid_at DATETIME NULL,
  is_delivered TINYINT(1) NOT NULL DEFAULT 0,
  delivered_at DATETIME NULL,
  status ENUM('PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED') NOT NULL DEFAULT 'PENDING',
  awb_code VARCHAR(255) NULL,
  courier_name VARCHAR(255) NULL,
  shiprocket_order_id VARCHAR(255) NULL,
  shiprocket_shipment_id VARCHAR(255) NULL,
  is_return_requested TINYINT(1) NOT NULL DEFAULT 0,
  return_reason VARCHAR(1024) NULL,
  return_status ENUM('NONE','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NONE',
  return_requested_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_awb (awb_code),
  INDEX idx_orders_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS order_items;
CREATE TABLE order_items (
  id CHAR(24) PRIMARY KEY,
  order_id CHAR(24) NOT NULL,
  name VARCHAR(255) NOT NULL,
  qty INT NOT NULL,
  image VARCHAR(1024) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  product_id CHAR(24) NULL, -- nullable FK: bundle/promo items may lack a real product row
  product_ref VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── return_requests
DROP TABLE IF EXISTS return_requests;
CREATE TABLE return_requests (
  id CHAR(24) PRIMARY KEY,
  order_id CHAR(24) NULL,
  order_id_text VARCHAR(255) NULL,
  order_source ENUM('WEBSITE','WHATSAPP','OTHER') NOT NULL DEFAULT 'WEBSITE',
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NULL,
  delivered_at DATETIME NOT NULL,
  description TEXT NOT NULL,
  images JSON NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  resolution_type ENUM('RETURN','REPLACEMENT') NULL,
  admin_note VARCHAR(1024) NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_return_requests_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── site_settings (single row, id='1')
DROP TABLE IF EXISTS site_settings;
CREATE TABLE site_settings (
  id CHAR(24) PRIMARY KEY,
  instagram_handle VARCHAR(255) NOT NULL DEFAULT '@madihaperfume',
  instagram_link VARCHAR(1024) NOT NULL DEFAULT 'https://instagram.com/madihaperfume',
  instagram_images JSON NULL,
  instagram_reels JSON NULL,
  promo_banner_enabled TINYINT(1) NOT NULL DEFAULT 1,
  promo_banner_badge VARCHAR(255) NOT NULL DEFAULT '🔥 Exclusive Offer',
  promo_banner_title VARCHAR(255) NOT NULL DEFAULT 'Get 3 Premium Perfumes',
  promo_banner_price DECIMAL(12,2) NOT NULL DEFAULT 899,
  promo_banner_original_price DECIMAL(12,2) NOT NULL DEFAULT 1799,
  promo_banner_subtitle VARCHAR(1024) NOT NULL DEFAULT 'No code needed · Limited time · Mix & match any 3',
  promo_banner_cta_label VARCHAR(255) NOT NULL DEFAULT 'Claim Offer →',
  promo_banner_cta_link VARCHAR(1024) NOT NULL DEFAULT '/promo/get-3-perfumes-at-899',
  promo_banner_image VARCHAR(1024) NOT NULL DEFAULT '',
  overall_rating DECIMAL(3,1) NOT NULL DEFAULT 4.9,
  total_reviews VARCHAR(50) NOT NULL DEFAULT '3,200+',
  delivery_charge DECIMAL(12,2) NOT NULL DEFAULT 60,
  free_delivery_threshold DECIMAL(12,2) NOT NULL DEFAULT 799,
  min_order_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  seo_title VARCHAR(255) NOT NULL DEFAULT 'Madiha Perfume | Luxury Indian & Arabic Fragrances',
  seo_description TEXT NULL,
  seo_keywords VARCHAR(1024) NULL,
  seo_image VARCHAR(1024) NOT NULL DEFAULT '/og-image.png',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS site_testimonials;
CREATE TABLE site_testimonials (
  id CHAR(24) PRIMARY KEY,
  site_settings_id CHAR(24) NOT NULL,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL DEFAULT '',
  stars TINYINT NOT NULL DEFAULT 5,
  text TEXT NOT NULL,
  initials VARCHAR(10) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_site_testimonials_settings FOREIGN KEY (site_settings_id) REFERENCES site_settings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS site_why_us;
CREATE TABLE site_why_us (
  id CHAR(24) PRIMARY KEY,
  site_settings_id CHAR(24) NOT NULL,
  icon VARCHAR(20) NOT NULL DEFAULT '✨',
  title VARCHAR(255) NOT NULL,
  description VARCHAR(1024) NOT NULL DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_site_why_us_settings FOREIGN KEY (site_settings_id) REFERENCES site_settings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS site_trust_bar;
CREATE TABLE site_trust_bar (
  id CHAR(24) PRIMARY KEY,
  site_settings_id CHAR(24) NOT NULL,
  icon VARCHAR(20) NOT NULL DEFAULT '✓',
  label VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_site_trust_bar_settings FOREIGN KEY (site_settings_id) REFERENCES site_settings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────── whatsapp_sessions
DROP TABLE IF EXISTS whatsapp_sessions;
CREATE TABLE whatsapp_sessions (
  id CHAR(24) PRIMARY KEY,
  session_name VARCHAR(100) NOT NULL UNIQUE DEFAULT 'madiha_master',
  session_data LONGTEXT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'INITIALIZING',
  qr_code TEXT NULL,
  error VARCHAR(1024) NULL,
  last_connected_at DATETIME NULL,
  connection_up_since DATETIME NULL,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
