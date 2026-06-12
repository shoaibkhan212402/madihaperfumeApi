import dotenv from 'dotenv';
import { existsSync } from 'fs';

// Auto-detect correct env file
const envFile = existsSync('.env.production') ? '.env.production' : '.env';
dotenv.config({ path: envFile, override: true });

// Trim and clean up environment variables
for (const key in process.env) {
  if (typeof process.env[key] === 'string') {
    let val = process.env[key].trim();
    // Hostinger/panels sometimes escape '%' as '\%' to prevent env-variable interpolation.
    // We replace '\%' with '%' to restore the correct URL-encoded password.
    if (val.includes('\\%')) {
      val = val.replace(/\\%/g, '%');
    }
    process.env[key] = val;
  }
}

const maskURI = (uri) => {
  if (!uri) return 'MISSING';
  if (!uri.includes('@')) return uri;
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/, '$1******$3');
};

console.log(`✅ Loaded env from: ${envFile} | DB URI: ${maskURI(process.env.DATABASE_URL)}`);
