import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    companyId: number;
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
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = {
      id: decoded.id,
      email: decoded.email || decoded.username, // Support both for transition
      role: decoded.role,
      companyId: decoded.companyId,
    };
    next();
  });
}

export function requireRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('DEBUG - Role check:', { 
      userId: req.user.id, 
      userRole: req.user.role, 
      requiredRoles: roles, 
      hasPermission: roles.includes(req.user.role) 
    });

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

export function generateToken(user: { id: number; username: string; role: string; companyId: number }) {
  const token = jwt.sign({
    id: user.id,
    email: user.username, // username field now contains email
    role: user.role,
    companyId: user.companyId
  }, JWT_SECRET, { expiresIn: '30d' }); // Increased to 30 days
  console.log('Generated new token for user:', user.id);
  return token;
}
