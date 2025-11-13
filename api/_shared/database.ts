import { drizzle } from 'drizzle-orm/neon-serverless';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './db-schema.js';

// Configure Neon for serverless environments
// Set WebSocket constructor for Node.js environment
neonConfig.webSocketConstructor = ws;

// Initialize the database connection
export const db = drizzle({
  connection: process.env.DATABASE_URL!,
  ws: ws,
  schema
});

// Export schema for convenience
export * from './db-schema.js';
