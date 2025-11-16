export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  phone?: string;

  // Role và permissions
  role: 'user' | 'agent' | 'admin';
  isVerified: boolean;
  verificationDocuments?: string[];

  // Thông tin môi giới (nếu là agent)
  agencyName?: string;
  licenseNumber?: string;
  experience?: string;
  specializations?: string[];

  // Subscription (serverless-friendly)
  subscriptionType: 'free' | 'basic' | 'premium';
  stripeCustomerId?: string;
  subscriptionEndsAt?: Date;

  // Metadata
  createdAt: Date;
  lastLogin?: Date;
  reputation: number;              // Điểm uy tín (0-5)
}

export interface UserWithPassword extends User {
  password: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: 'user' | 'agent';
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}