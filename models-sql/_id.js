import crypto from 'crypto';

// Mimics a MongoDB ObjectId's 24-hex-char shape (no embedded timestamp needed —
// nothing in the app relies on ObjectId's chronological sort order; every list
// route sorts explicitly by created_at).
export const genId = () => crypto.randomBytes(12).toString('hex');
