/**
 * Authentication and Request Validation Middleware
 * Enforces cryptographically verified Firebase ID tokens via Firebase Admin SDK.
 * COMPLETELY eliminates client-spoofed X-User-Id fallback headers.
 */
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../firebaseAdmin';
import { userRepository } from '../repositories/jsonRepository';
import { User } from '../../src/types';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

/**
 * Extracts and cryptographically verifies Firebase ID token from Authorization header.
 * Requests without a valid Firebase ID token leave req.user undefined.
 * X-User-Id is NEVER trusted as an identity source.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      // Unauthenticated request
      req.user = undefined;
      return next();
    }

    try {
      // Cryptographically verify ID token against Firebase Auth public keys
      const decoded = await adminAuth.verifyIdToken(token);
      const uid = decoded.uid;

      // Check if user has an existing record in local repository for compatibility
      let existing = await userRepository.findById(uid);
      if (!existing) {
        // Construct canonical User object from verified Firebase token
        const realName = decoded.name || 'Mindly Learner';
        existing = {
          id: uid,
          name: realName,
          realName,
          username: `@learner_${uid.slice(0, 5)}`,
          email: decoded.email || '',
          profileImage: decoded.picture,
          interests: ['General Knowledge'],
          createdAt: new Date().toISOString(),
          hasCompletedOnboarding: true,
          dailyStudyGoalMinutes: 30,
          todayStudySeconds: 0,
        };
      }

      req.user = existing;
      req.sessionToken = token;
    } catch (tokenErr: any) {
      // Token is invalid, expired, or forged
      req.user = undefined;
    }

    return next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE] Error during authentication:', err);
    req.user = undefined;
    return next();
  }
}

/**
 * Strict route protection: rejects unauthenticated requests with 401
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in with Firebase.' });
  }
  next();
}
