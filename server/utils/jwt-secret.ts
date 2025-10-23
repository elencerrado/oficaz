// 🔒 SECURITY: Centralized JWT_SECRET management
// This ensures all modules use the SAME secret (critical for token verification)

let JWT_SECRET: string = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 FATAL: JWT_SECRET environment variable is not set in production!');
    throw new Error('JWT_SECRET is required for security in production');
  }
  
  // Development: Generate a random secret and warn (ONE TIME FOR ALL MODULES)
  JWT_SECRET = `dev-secret-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  console.warn('⚠️  WARNING: JWT_SECRET not set - using random development secret (sessions will reset on restart)');
  console.warn(`   Development JWT_SECRET: ${JWT_SECRET.substring(0, 20)}...`);
}

export { JWT_SECRET };
