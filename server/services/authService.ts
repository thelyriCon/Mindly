/**
 * Authentication Service — V2.1
 * Implements bcrypt password hashing, secure session management,
 * Real Name & unique @username handling, and social login (Google & Apple).
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { userRepository, sessionRepository, passwordResetRepository } from '../repositories/jsonRepository';
import { UserRecord } from '../types';
import { User, Session } from '../../src/types';

const SESSION_DURATION_DAYS = 30;
const RESET_TOKEN_DURATION_HOURS = 1;

export function sanitizeUser(user: UserRecord): User {
  const { password, passwordHash, ...safe } = user;
  // Ensure realName and username fallback gracefully for legacy accounts
  const realName = safe.realName || safe.name || 'Mindly Learner';
  const username = safe.username || ('@' + (safe.name ? safe.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'learner'));
  return {
    ...safe,
    name: realName,
    realName,
    username,
  } as User;
}

export class AuthService {
  /**
   * Hashes a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Validates a password against user's passwordHash
   */
  async verifyPassword(password: string, user: UserRecord): Promise<boolean> {
    if (user.passwordHash) {
      return bcrypt.compare(password, user.passwordHash);
    }
    if (user.password && user.password === password) {
      const newHash = await this.hashPassword(password);
      await userRepository.update(user.id, { passwordHash: newHash });
      return true;
    }
    return false;
  }

  /**
   * Normalizes a username (removes leading @, trims, lowercases)
   */
  normalizeUsername(raw: string): string {
    return raw.trim().replace(/^@+/, '').toLowerCase();
  }

  /**
   * Checks if a username is available
   */
  async checkUsernameAvailable(rawUsername: string, excludeUserId?: string): Promise<{ available: boolean; error?: string }> {
    const clean = this.normalizeUsername(rawUsername);
    if (!clean || clean.length < 3) {
      return { available: false, error: 'Username must be at least 3 characters.' };
    }
    if (clean.length > 24) {
      return { available: false, error: 'Username cannot exceed 24 characters.' };
    }
    if (!/^[a-z0-9_]+$/.test(clean)) {
      return { available: false, error: 'Username can only contain letters, numbers, and underscores.' };
    }

    const existing = await userRepository.findByUsername(clean);
    if (existing && existing.id !== excludeUserId) {
      return { available: false, error: 'That username is already taken. Please choose another.' };
    }

    return { available: true };
  }

  /**
   * Registers a new user with REAL NAME, USERNAME, EMAIL, and PASSWORD
   */
  async register(
    realName: string,
    rawUsername: string,
    email: string,
    password?: string
  ): Promise<{ user: User; session: Session }> {
    if (!realName || !realName.trim()) {
      throw new Error('Real name is required.');
    }

    const cleanUsername = this.normalizeUsername(rawUsername || '');
    if (!cleanUsername) {
      throw new Error('Username is required.');
    }

    const check = await this.checkUsernameAvailable(cleanUsername);
    if (!check.available) {
      throw new Error(check.error || 'Username is not available.');
    }

    const existingEmail = await userRepository.findByEmail(email);
    if (existingEmail) {
      throw new Error('An account with this email already exists.');
    }

    const passwordHash = password ? await this.hashPassword(password) : await this.hashPassword('mindly123');

    // Clean account state: newly created account starts with 0 courses, 0 lessons, 0 streaks, empty activity
    const created = await userRepository.create({
      name: realName.trim(),
      realName: realName.trim(),
      username: `@${cleanUsername}`,
      email: email.trim().toLowerCase(),
      passwordHash,
      interests: [],
      hasCompletedOnboarding: false,
      dailyStudyGoalMinutes: 30,
      todayStudySeconds: 0,
      privacySettings: {
        profileVisibility: 'public',
        showCompletedCourses: true,
        showCertificates: true,
        showStudyActivity: true,
      },
      settings: {
        theme: 'dark',
        fontSize: 'normal',
        aiStrictness: 'balanced',
        dailyStudyGoalMinutes: 30,
      },
    });

    const session = await this.createSession(created.id);
    return { user: sanitizeUser(created), session };
  }

  /**
   * Logs in a user with email and password
   */
  async login(email: string, password?: string): Promise<{ user: User; session: Session }> {
    const user = await userRepository.findByEmail(email.trim().toLowerCase());
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (password) {
      const isValid = await this.verifyPassword(password, user);
      if (!isValid) {
        throw new Error('Invalid email or password.');
      }
    } else {
      throw new Error('Password is required.');
    }

    const session = await this.createSession(user.id);
    return { user: sanitizeUser(user), session };
  }

  /**
   * Social Authentication (Google & Apple)
   */
  async socialLogin(
    provider: 'google' | 'apple',
    email: string,
    realName?: string,
    profileImage?: string
  ): Promise<{ user: User; session: Session; needsSetup: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await userRepository.findByEmail(normalizedEmail);
    let needsSetup = false;

    if (!user) {
      // Create new user via social auth
      const cleanRealName = (realName && realName.trim()) || normalizedEmail.split('@')[0];
      const baseHandle = normalizedEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'learner';
      
      // Find an available username
      let candidate = baseHandle;
      let counter = 1;
      while (await userRepository.findByUsername(candidate)) {
        candidate = `${baseHandle}${counter++}`;
      }

      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await this.hashPassword(randomPassword);

      user = await userRepository.create({
        name: cleanRealName,
        realName: cleanRealName,
        username: `@${candidate}`,
        email: normalizedEmail,
        profileImage,
        passwordHash,
        interests: [],
        hasCompletedOnboarding: false,
        dailyStudyGoalMinutes: 30,
        todayStudySeconds: 0,
        privacySettings: {
          profileVisibility: 'public',
          showCompletedCourses: true,
          showCertificates: true,
          showStudyActivity: true,
        },
        settings: {
          theme: 'dark',
          fontSize: 'normal',
          aiStrictness: 'balanced',
          dailyStudyGoalMinutes: 30,
        },
      });

      // Mark needs setup if the real name was defaulted or username needs confirmation
      needsSetup = !realName;
    } else {
      if (!user.username || !user.realName) {
        needsSetup = true;
      }
    }

    const session = await this.createSession(user.id);
    return { user: sanitizeUser(user), session, needsSetup };
  }

  /**
   * Sets up Real Name and Username
   */
  async setupProfile(
    userId: string,
    realName: string,
    rawUsername: string
  ): Promise<User> {
    if (!realName || !realName.trim()) {
      throw new Error('Real name is required.');
    }

    const cleanUsername = this.normalizeUsername(rawUsername);
    if (!cleanUsername) {
      throw new Error('Username is required.');
    }

    const check = await this.checkUsernameAvailable(cleanUsername, userId);
    if (!check.available) {
      throw new Error(check.error || 'Username is already taken.');
    }

    const updated = await userRepository.update(userId, {
      name: realName.trim(),
      realName: realName.trim(),
      username: `@${cleanUsername}`,
    });

    if (!updated) {
      throw new Error('User not found.');
    }

    return sanitizeUser(updated);
  }

  /**
   * Creates a cryptographically secure random session token
   */
  async createSession(userId: string): Promise<Session> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    return sessionRepository.create({
      userId,
      token,
      expiresAt,
    });
  }

  /**
   * Validates a session token
   */
  async validateSession(token: string): Promise<User | null> {
    if (!token) return null;
    const session = await sessionRepository.findByToken(token);
    if (!session) return null;

    const user = await userRepository.findById(session.userId);
    if (!user) return null;

    await sessionRepository.touch(token);
    return sanitizeUser(user);
  }

  /**
   * Logs out a session
   */
  async logout(token: string): Promise<boolean> {
    return sessionRepository.deleteByToken(token);
  }

  /**
   * Generates a secure, expiring password reset token
   */
  async createPasswordReset(email: string): Promise<{ token?: string; email: string }> {
    const user = await userRepository.findByEmail(email.trim().toLowerCase());
    if (!user) {
      return { email };
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION_HOURS * 60 * 60 * 1000).toISOString();

    await passwordResetRepository.create({
      userId: user.id,
      email: user.email,
      token,
      expiresAt,
    });

    return { token, email: user.email };
  }

  /**
   * Confirms password reset using valid one-time token
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<boolean> {
    const resetRecord = await passwordResetRepository.findByToken(token);
    if (!resetRecord) {
      throw new Error('Invalid or expired password reset link.');
    }

    const newHash = await this.hashPassword(newPassword);
    await userRepository.update(resetRecord.userId, { passwordHash: newHash });
    await passwordResetRepository.markUsed(token);

    // Invalidate existing sessions
    await sessionRepository.deleteByUserId(resetRecord.userId);
    return true;
  }
}

export const authService = new AuthService();
