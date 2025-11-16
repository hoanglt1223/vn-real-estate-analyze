export interface WebAPIResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  details?: string;
  status?: number;
}

export interface APIHeaders extends Headers {}

export interface WebAPIRequest {
  url: string;
  method: string;
  headers: Headers;
  json(): Promise<any>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  body?: ReadableStream | null;
}

export interface WebAPIResponseStatic {
  json(data: any, init?: ResponseInit): Response;
  redirect(url: string, init?: number | ResponseInit): Response;
  revalidate(url?: string, init?: number | ResponseInit): Response;
}

export namespace WebAPI {
  export type Request = WebAPIRequest;
  export const Response = {
    json: (data: any, init?: ResponseInit): globalThis.Response => {
      return new globalThis.Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });
    },
    redirect: (url: string, init?: number | ResponseInit): globalThis.Response => {
      const status = typeof init === 'number' ? init : init?.status || 302;
      return new globalThis.Response(null, {
        status,
        headers: { Location: url, ...(init && typeof init === 'object' ? (init.headers || {}) : {}) }
      });
    },
    revalidate: (url?: string, init?: number | ResponseInit): globalThis.Response => {
      // Vercel revalidation stub
      return new globalThis.Response(null, { status: 200 });
    }
  } as WebAPIResponseStatic;
}