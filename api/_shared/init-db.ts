import { PostgresStorage } from './postgres-storage.js';
import { runMigrations } from './migrate.js';

let initPromise: Promise<void> | null = null;

export async function initializeDatabase(): Promise<void> {
  // Ensure we only initialize once
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Only initialize if DATABASE_URL is configured
      if (!process.env.DATABASE_URL) {
        console.log('📝 DATABASE_URL not configured, skipping database initialization');
        return;
      }

      console.log('🔄 Initializing database...');
      
      // Run migrations first to ensure tables exist
      await runMigrations();
      
      // Then initialize default users
      const postgresStorage = new PostgresStorage();
      await postgresStorage.initializeDefaultUsers();
      
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      // Don't throw error - allow app to continue with fallback storage
    }
  })();

  return initPromise;
}
