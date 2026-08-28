import { Sequelize } from 'sequelize';

// Same masking/un-escaping conventions as config/env.js and config/db.js —
// Hostinger's env panel has previously escaped '%' in stored values, and we
// mask credentials in logs for the same reason those files do.
const maskHost = (host) => host || 'MISSING';

let sequelize;

export function getSequelize() {
  if (sequelize) return sequelize;

  const {
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_DATABASE,
    MYSQL_USER,
    MYSQL_PASSWORD,
  } = process.env;

  sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, {
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
    // Conservative pool — single Node instance in production, shared-hosting
    // MySQL plans cap max_connections low.
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    retry: { max: 3 },
  });

  return sequelize;
}

export async function connectMysql() {
  const db = getSequelize();
  const { MYSQL_HOST, MYSQL_DATABASE } = process.env;
  console.log(`🔌 Connecting to MySQL: ${maskHost(MYSQL_HOST)} / db=${MYSQL_DATABASE || 'MISSING'}`);
  await db.authenticate();
  console.log('✅ MySQL connected');
  return db;
}

export default getSequelize;
