import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { db } from './database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');
    
    // Get the project root directory (go up from api/_shared/)
    const projectRoot = path.resolve(__dirname, '../../');
    const migrationsFolder = path.join(projectRoot, 'drizzle');
    
    console.log('Migration folder:', migrationsFolder);
    
    await migrate(db, { 
      migrationsFolder: migrationsFolder
    });
    
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}
