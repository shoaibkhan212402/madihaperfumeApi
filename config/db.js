import mongoose from 'mongoose';

const maskURI = (uri) => {
  if (!uri) return 'MISSING';
  if (!uri.includes('@')) return uri;
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/, '$1******$3');
};

const analyzePassword = (uri) => {
  if (!uri) return 'No URI';
  try {
    const match = uri.match(/mongodb(?:\+srv)?:\/\/[^:]+:([^@]+)@/);
    if (!match) return 'No password found in URI';
    const password = match[1];
    return `length: ${password.length}, start: "${password.slice(0, 2)}", end: "${password.slice(-2)}", has%40: ${password.includes('%40')}, has@: ${password.includes('@')}`;
  } catch (err) {
    return 'Error: ' + err.message;
  }
};

const connectDB = async () => {
  try {
    const uri = process.env.DATABASE_URL;
    console.log(`🔌 Connecting to MongoDB: ${maskURI(uri)}`);
    console.log(`🔑 DB Password Details: ${analyzePassword(uri)}`);
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB (${maskURI(process.env.DATABASE_URL)}): ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
