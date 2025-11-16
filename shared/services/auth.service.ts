import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { User, UserWithPassword, CreateUserInput, LoginInput, AuthResponse, JWTPayload } from '../types/user.types';

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET!;
  private static readonly TOKEN_EXPIRY = process.env.JWT_EXPIRY || '7d';
  private static readonly SALT_ROUNDS = 12;

  // Register user
  static async register(input: CreateUserInput): Promise<AuthResponse> {
    // Check if user exists
    const existingUserData = await kv.hget(`user:${input.email}`, 'data');
    if (existingUserData) {
      const existingUser = JSON.parse(existingUserData as string);
      if (existingUser && Object.keys(existingUser).length > 0) {
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role || 'user',
      phone: input.phone,
      isVerified: false,
      subscriptionType: 'free',
      reputation: 0,
      createdAt: new Date(),
    };

    // Store in Redis (both by email and by ID for lookup)
    const userWithPassword: UserWithPassword = { ...user, password: hashedPassword };
    await kv.hset(`user:${user.email}`, 'data', JSON.stringify(userWithPassword));
    await kv.hset(`user:${user.id}`, 'data', JSON.stringify(userWithPassword));

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      this.JWT_SECRET,
      { expiresIn: this.TOKEN_EXPIRY } as SignOptions
    );

    // Return user without password
    return { user, token };
  }

  // Login user
  static async login(input: LoginInput): Promise<AuthResponse> {
    const userData = await kv.hget(`user:${input.email}`, 'data');
    if (!userData) {
      throw new Error('Invalid credentials');
    }

    const user = JSON.parse(userData as string) as UserWithPassword;
    if (!Object.keys(user).length) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(input.password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    const updatedUser = { ...user, lastLogin: new Date() };
    await kv.hset(`user:${user.id}`, 'data', JSON.stringify(updatedUser));

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      this.JWT_SECRET,
      { expiresIn: this.TOKEN_EXPIRY } as SignOptions
    );

    // Return user without password
    return { user, token };
  }

  // Verify JWT token
  static async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      const userData = await kv.hget(`user:${decoded.userId}`, 'data');
      if (!userData) {
        throw new Error('User not found');
      }

      const user = JSON.parse(userData as string) as UserWithPassword;
      if (!Object.keys(user).length) {
        throw new Error('User not found');
      }

      const { password: _pwd, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Get user by ID
  static async getUserById(id: string): Promise<User | null> {
    const userData = await kv.hget(`user:${id}`, 'data');
    if (!userData) {
      return null;
    }

    const user = JSON.parse(userData as string) as UserWithPassword;
    if (!Object.keys(user).length) {
      return null;
    }

    const { password: _pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Get user by email
  static async getUserByEmail(email: string): Promise<User | null> {
    const userData = await kv.hget(`user:${email}`, 'data');
    if (!userData) {
      return null;
    }

    const user = JSON.parse(userData as string) as UserWithPassword;
    if (!Object.keys(user).length) {
      return null;
    }

    const { password: _pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Update user
  static async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const existingUserData = await kv.hget(`user:${id}`, 'data');
    if (!existingUserData) {
      throw new Error('User not found');
    }

    const existingUser = JSON.parse(existingUserData) as UserWithPassword;
    if (!Object.keys(existingUser).length) {
      throw new Error('User not found');
    }

    const updatedUser: UserWithPassword = { ...existingUser, ...updates };
    await kv.hset(`user:${id}`, 'data', JSON.stringify(updatedUser));

    // Also update email lookup if email changed
    if (updates.email && updates.email !== existingUser.email) {
      // Remove old email lookup
      await kv.del(`user:${existingUser.email}`);
      // Add new email lookup
      await kv.hset(`user:${updates.email}`, 'data', JSON.stringify(updatedUser));
    }

    const { password: _pwd, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  // Change password
  static async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const userData = await kv.hget(`user:${id}`, 'data');
    if (!userData) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userData as string) as UserWithPassword;
    if (!Object.keys(user).length) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    const updatedUser = { ...user, password: hashedNewPassword };
    await kv.hset(`user:${id}`, 'data', JSON.stringify(updatedUser));

    // Update email lookup too
    if (user.email) {
      await kv.hset(`user:${user.email}`, 'data', JSON.stringify(updatedUser));
    }
  }

  // Delete user
  static async deleteUser(id: string): Promise<void> {
    const userData = await kv.hget(`user:${id}`, 'data');
    if (!userData) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userData as string);
    if (!Object.keys(user).length) {
      throw new Error('User not found');
    }

    // Delete both lookups
    await kv.del(`user:${id}`);
    if (user.email) {
      await kv.del(`user:${user.email}`);
    }
  }

  // OAuth Login (Ready but disabled without keys)
  static async oauthLogin(provider: 'google' | 'facebook', oauthData: any): Promise<AuthResponse> {
    if (!this.isOAuthEnabled(provider)) {
      throw new Error(`${provider} OAuth is not configured`);
    }

    // OAuth implementation here
    // This will work when GOOGLE_CLIENT_ID/FACEBOOK_CLIENT_ID are provided
    throw new Error('OAuth not implemented yet');
  }

  private static isOAuthEnabled(provider: string): boolean {
    switch (provider) {
      case 'google':
        return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      case 'facebook':
        return !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET);
      default:
        return false;
    }
  }
}