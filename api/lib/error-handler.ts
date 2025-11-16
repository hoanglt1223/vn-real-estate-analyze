import type { VercelResponse } from '@vercel/node';

export function handleError(res: VercelResponse, error: any, context: string) {
  console.error(`${context} error:`, error);
  
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Internal Server Error";
  
  return res.status(status).json({ 
    message,
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
}
