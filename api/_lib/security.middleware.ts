import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAge: number;
  };
  security: {
    enabled: boolean;
    hideServerInfo: boolean;
    preventClickjacking: boolean;
    preventMimeSniffing: boolean;
    enforceHTTPS: boolean;
    maxRequestSize: number;
  };
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    requestsPerDay: 10000
  },
  cors: {
    enabled: true,
    allowedOrigins: [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'https://localhost:5173',
      'https://*.vercel.app'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
    maxAge: 86400 // 24 hours
  },
  security: {
    enabled: true,
    hideServerInfo: true,
    preventClickjacking: true,
    preventMimeSniffing: true,
    enforceHTTPS: true,
    maxRequestSize: 10 * 1024 * 1024 // 10MB
  }
};

/**
 * Security middleware cho Vercel Functions
 */
export class SecurityMiddleware {
  private static config = DEFAULT_SECURITY_CONFIG;
  private static isKVAvailable = false;

  static {
    // Check if KV is available
    this.isKVAvailable = !!process.env.KV_REST_API_TOKEN;
  }

  /**
   * Apply tất cả security headers
   */
  static applySecurityHeaders(res: VercelResponse): void {
    if (!this.config.security.enabled) return;

    const headers: Record<string, string> = {};

    // Hide server information
    if (this.config.security.hideServerInfo) {
      headers['Server'] = '';
      headers['X-Powered-By'] = '';
    }

    // Prevent clickjacking
    if (this.config.security.preventClickjacking) {
      headers['X-Frame-Options'] = 'DENY';
    }

    // Prevent MIME sniffing
    if (this.config.security.preventMimeSniffing) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // XSS Protection
    headers['X-XSS-Protection'] = '1; mode=block';

    // Referrer Policy
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

    // Content Security Policy (basic)
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');

    // Enforce HTTPS in production
    if (this.config.security.enforceHTTPS && process.env.NODE_ENV === 'production') {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    // Apply headers
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  /**
   * Apply CORS headers
   */
  static applyCorsHeaders(req: VercelRequest, res: VercelResponse): void {
    if (!this.config.cors.enabled) return;

    const origin = req.headers.origin;
    const allowedOrigin = this.config.cors.allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const domain = allowed.replace('*', '');
        return origin?.endsWith(domain) || false;
      }
      return origin === allowed;
    }) ? origin : this.config.cors.allowedOrigins[0];

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
    res.setHeader('Access-Control-Allow-Methods', this.config.cors.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', this.config.cors.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', this.config.cors.maxAge.toString());
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
    }
  }

  /**
   * Rate limiting với Vercel KV
   */
  static async applyRateLimiting(
    req: VercelRequest,
    action?: string
  ): Promise<{ success: boolean; error?: string; remaining?: number }> {
    if (!this.config.rateLimiting.enabled || !this.isKVAvailable) {
      return { success: true };
    }

    const identifier = this.getClientIdentifier(req);
    const now = Date.now();
    const window = {
      minute: Math.floor(now / 60000),
      hour: Math.floor(now / 3600000),
      day: Math.floor(now / 86400000)
    };

    try {
      // Check minute limit
      const minuteKey = `rate-limit:${identifier}:${window.minute}`;
      const minuteCount = await kv.incr(minuteKey);
      if (minuteCount === 1) {
        await kv.expire(minuteKey, 60);
      }

      if (minuteCount > this.config.rateLimiting.requestsPerMinute) {
        return {
          success: false,
          error: 'Rate limit exceeded (too many requests per minute)',
          remaining: 0
        };
      }

      // Check hour limit
      const hourKey = `rate-limit:${identifier}:${window.hour}:hour`;
      const hourCount = await kv.incr(hourKey);
      if (hourCount === 1) {
        await kv.expire(hourKey, 3600);
      }

      if (hourCount > this.config.rateLimiting.requestsPerHour) {
        return {
          success: false,
          error: 'Rate limit exceeded (too many requests per hour)',
          remaining: 0
        };
      }

      // Check day limit
      const dayKey = `rate-limit:${identifier}:${window.day}:day`;
      const dayCount = await kv.incr(dayKey);
      if (dayCount === 1) {
        await kv.expire(dayKey, 86400);
      }

      if (dayCount > this.config.rateLimiting.requestsPerDay) {
        return {
          success: false,
          error: 'Rate limit exceeded (too many requests per day)',
          remaining: 0
        };
      }

      // Calculate remaining requests for the most restrictive limit
      const remaining = Math.min(
        this.config.rateLimiting.requestsPerMinute - minuteCount,
        this.config.rateLimiting.requestsPerHour - hourCount,
        this.config.rateLimiting.requestsPerDay - dayCount
      );

      return { success: true, remaining };

    } catch (error: any) {
      console.error('Rate limiting error:', error);
      // Allow request if rate limiting fails
      return { success: true };
    }
  }

  /**
   * Validate request size
   */
  static validateRequestSize(req: VercelRequest): { valid: boolean; error?: string } {
    if (!this.config.security.enabled) {
      return { valid: true };
    }

    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const size = parseInt(contentLength);
      if (size > this.config.security.maxRequestSize) {
        return {
          valid: false,
          error: `Request size ${Math.round(size / 1024 / 1024)}MB exceeds limit of ${Math.round(this.config.security.maxRequestSize / 1024 / 1024)}MB`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get client identifier for rate limiting
   */
  private static getClientIdentifier(req: VercelRequest): string {
    // Try to get user ID from JWT token (for authenticated requests)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          // Decode JWT payload to get user ID
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          if (payload.userId) {
            return `user:${payload.userId}`;
          }
        }
      } catch (error) {
        // Invalid token, fall back to IP
      }
    }

    // Fall back to IP address
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
      : req.connection?.remoteAddress
      || 'unknown';

    return `ip:${ip}`;
  }

  /**
   * Validate input against common attacks
   */
  static sanitizeInput(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[this.sanitizeString(key)] = this.sanitizeInput(value);
    }
    return sanitized;
  }

  private static sanitizeString(value: any): any {
    if (typeof value !== 'string') return value;

    // Remove potential XSS vectors
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * Get security statistics
   */
  static async getSecurityStats(): Promise<any> {
    if (!this.isKVAvailable) {
      return { message: 'KV not available' };
    }

    try {
      const keys = await kv.keys('rate-limit:*');
      return {
        activeRateLimits: keys.length,
        config: this.config,
        kvAvailable: true
      };
    } catch (error) {
      return {
        error: 'Failed to get stats',
        kvAvailable: false
      };
    }
  }

  /**
   * Configure security settings
   */
  static configure(newConfig: Partial<SecurityConfig>): void {
    this.config = {
      rateLimiting: { ...this.config.rateLimiting, ...newConfig.rateLimiting },
      cors: { ...this.config.cors, ...newConfig.cors },
      security: { ...this.config.security, ...newConfig.security }
    };
  }
}

/**
 * Apply all security middleware
 */
export async function applySecurity(
  req: VercelRequest,
  res: VercelResponse,
  action?: string
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  try {
    // Apply CORS headers
    SecurityMiddleware.applyCorsHeaders(req, res);

    // Apply security headers
    SecurityMiddleware.applySecurityHeaders(res);

    // Validate request size
    const sizeValidation = SecurityMiddleware.validateRequestSize(req);
    if (!sizeValidation.valid) {
      return { success: false, error: sizeValidation.error };
    }

    // Apply rate limiting
    const rateLimitResult = await SecurityMiddleware.applyRateLimiting(req, action);
    if (!rateLimitResult.success) {
      return rateLimitResult;
    }

    return { success: true, remaining: rateLimitResult.remaining };
  } catch (error: any) {
    console.error('Security middleware error:', error);
    return { success: false, error: 'Security validation failed' };
  }
}

/**
 * Middleware for Express/Next.js style handlers
 */
export function securityMiddleware(action?: string) {
  return async (req: VercelRequest, res: VercelResponse, next?: Function) => {
    const result = await applySecurity(req, res, action);

    if (!result.success) {
      res.setHeader('X-RateLimit-Limit', SecurityMiddleware.config.rateLimiting.requestsPerMinute.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining?.toString() || '0');
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + 60).toString());

      return res.status(429).json({
        error: result.error,
        retryAfter: 60
      });
    }

    if (next) next();
  };
}