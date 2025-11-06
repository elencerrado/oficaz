import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../utils/jwt-secret.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    companyId: number;
    pushAction?: boolean; // Flag for push notification action tokens
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // Support token in query params for PDF viewing
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // CRITICAL FIX: Block corrupted tokens for non-existent user ID 4
    if (decoded.id === 4) {
      return res.status(403).json({ message: 'Invalid token - user does not exist' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email || decoded.username, // Support both for transition
      role: decoded.role,
      companyId: decoded.companyId,
      pushAction: decoded.pushAction || false, // Include pushAction flag if present
    };
    next();
  });
}

export function requireRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

// 🔒 SECURITY: Generate short-lived access token (15 minutes)
export function generateToken(user: { id: number; username: string; role: string; companyId: number }) {
  const token = jwt.sign({
    id: user.id,
    email: user.username, // username field now contains email
    role: user.role,
    companyId: user.companyId,
    type: 'access' // Mark as access token
  }, JWT_SECRET, { expiresIn: '15m' }); // 🔒 SECURITY: Reduced from 30d to 15m
  return token;
}

// 🔒 SECURITY: Generate long-lived refresh token (30 days)
export function generateRefreshToken(userId: number) {
  const token = jwt.sign({
    userId,
    type: 'refresh' // Mark as refresh token
  }, JWT_SECRET, { expiresIn: '30d' });
  return token;
}
