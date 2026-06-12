import mongoose from 'mongoose';

const maskURI = (uri) => {
  if (!uri) return 'MISSING';
  if (!uri.includes('@')) return uri;
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/, '$1******$3');
};

const connectDB = async () => {
  try {
    const uri = process.env.DATABASE_URL;
    console.log(`🔌 Connecting to MongoDB: ${maskURI(uri)}`);
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB (${maskURI(process.env.DATABASE_URL)}): ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
