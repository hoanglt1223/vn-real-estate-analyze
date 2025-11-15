// Shared HTTP client utilities

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export class HttpClient {
  public defaultHeaders: Record<string, string>;
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor(options: {
    defaultHeaders?: Record<string, string>;
    defaultTimeout?: number;
    defaultRetries?: number;
  } = {}) {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.defaultHeaders
    };
    this.defaultTimeout = options.defaultTimeout || 10000; // 10 seconds
    this.defaultRetries = options.defaultRetries || 3;
  }

  async request<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = 1000
    } = options;

    const mergedHeaders = { ...this.defaultHeaders, ...headers };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: mergedHeaders,
          body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Get response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let data: T;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else if (contentType?.includes('text/')) {
          data = await response.text() as T;
        } else {
          data = await response.blob() as T;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        };

      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (except 429 Too Many Requests)
        if (lastError.message.includes('HTTP 4') && !lastError.message.includes('429')) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  // Convenience methods
  async get<T = any>(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  async put<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  async delete<T = any>(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

// Create default instances
export const httpClient = new HttpClient();

// API clients for specific services
export class MapboxClient extends HttpClient {
  constructor(token: string) {
    super({
      defaultHeaders: {
        'Authorization': `Bearer ${token}`
      },
      defaultTimeout: 15000 // 15 seconds for geocoding
    });
  }

  async geocode(query: string, options: {
    country?: string;
    language?: string;
    limit?: number;
  } = {}) {
    const params = new URLSearchParams({
      access_token: this.defaultHeaders.Authorization!.replace('Bearer ', ''),
      country: options.country || 'VN',
      language: options.language || 'vi',
      limit: (options.limit || 1).toString()
    });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
    return this.get(url);
  }

  async suggest(query: string, options: {
    country?: string;
    language?: string;
    limit?: number;
    types?: string;
    proximity?: string;
    sessionToken?: string;
  } = {}) {
    const params = new URLSearchParams({
      access_token: this.defaultHeaders.Authorization!.replace('Bearer ', ''),
      q: query,
      country: options.country || 'VN',
      language: options.language || 'vi',
      limit: (options.limit || 10).toString(),
      types: options.types || 'address,place,poi,locality,neighborhood'
    });

    if (options.proximity) params.set('proximity', options.proximity);
    if (options.sessionToken) params.set('session_token', options.sessionToken);

    const url = `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;
    return this.get(url);
  }

  async retrieve(id: string, sessionToken?: string) {
    const params = new URLSearchParams({
      access_token: this.defaultHeaders.Authorization!.replace('Bearer ', '')
    });

    if (sessionToken) params.set('session_token', sessionToken);

    const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}?${params}`;
    return this.get(url);
  }
}

export class OverpassClient extends HttpClient {
  constructor() {
    super({
      defaultHeaders: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
      },
      defaultTimeout: 30000, // 30 seconds for complex queries
      defaultRetries: 2
    });
  }

  async query(overpassQuery: string): Promise<HttpResponse> {
    return this.post('https://overpass-api.de/api/interpreter', overpassQuery);
  }
}

// Utility functions
export function createQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function isHttpError(error: any): error is Error & { status?: number } {
  return error instanceof Error && (
    error.message.includes('HTTP') ||
    'status' in error
  );
}

export function getErrorCode(error: any): number {
  if (isHttpError(error)) {
    const match = error.message.match(/HTTP (\d+)/);
    return match ? parseInt(match[1]) : 500;
  }
  return 500;
}