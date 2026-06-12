import dotenv from 'dotenv';
import { existsSync } from 'fs';

// Auto-detect correct env file
const envFile = existsSync('.env.production') ? '.env.production' : '.env';
dotenv.config({ path: envFile, override: true });

// Trim all environment variables to clean up trailing spaces/newlines/carriage returns (\r)
for (const key in process.env) {
  if (typeof process.env[key] === 'string') {
    process.env[key] = process.env[key].trim();
  }
}

const maskURI = (uri) => {
  if (!uri) return 'MISSING';
  if (!uri.includes('@')) return uri;
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/, '$1******$3');
};

console.log(`✅ Loaded env from: ${envFile} | DB URI: ${maskURI(process.env.DATABASE_URL)}`);
