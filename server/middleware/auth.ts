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

// 🔒 SECURITY: Generate long-lived refresh token (90 days for PWA persistence)
// Extended from 30d to 90d for better PWA experience - sliding session renews on each use
export function generateRefreshToken(userId: number) {
  const token = jwt.sign({
    userId,
    type: 'refresh' // Mark as refresh token
  }, JWT_SECRET, { expiresIn: '90d' }); // 90 days for PWA - renewed on each use (sliding session)
  return token;
}

// Mapping of feature keys to addon keys
const featureToAddonKey: Record<string, string> = {
  timeTracking: 'time_tracking',
  time_tracking: 'time_tracking',
  vacation: 'vacation',
  schedules: 'schedules',
  documents: 'documents',
  messages: 'messages',
  reminders: 'reminders',
  work_reports: 'work_reports',
  reports: 'work_reports',
  ai_assistant: 'ai_assistant',
};

// Middleware to check if a manager has visibility to a feature
// Instead of blocking, this now sets req.managerAccessMode to 'full' or 'self'
// 'full' = full access like admin, 'self' = can only access own data (read-only)
export function requireVisibleFeature(featureKey: string, getStorage: () => any) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Admins get full access, employees get self access
    if (req.user.role === 'admin') {
      (req as any).managerAccessMode = 'full';
      return next();
    }
    
    if (req.user.role === 'employee') {
      (req as any).managerAccessMode = 'self';
      return next();
    }

    // For managers, check their permissions
    try {
      const storage = getStorage();
      const company = await storage.getCompany(req.user.companyId);
      
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      const managerPermissions = company.managerPermissions as { visibleFeatures?: string[] | null } | null;
      const visibleFeatures = managerPermissions?.visibleFeatures;

      // If visibleFeatures is null/undefined, all features are visible (full access)
      if (visibleFeatures === null || visibleFeatures === undefined) {
        (req as any).managerAccessMode = 'full';
        return next();
      }

      // Check if the feature is in the visible list
      const addonKey = featureToAddonKey[featureKey] || featureKey;
      if (visibleFeatures.includes(addonKey)) {
        // Manager has full access to this feature
        (req as any).managerAccessMode = 'full';
      } else {
        // Manager has self-access only (read-only, own data)
        (req as any).managerAccessMode = 'self';
      }

      next();
    } catch (error) {
      console.error('Error checking feature visibility:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
}
