# Database Setup Guide

This application now uses **Neon PostgreSQL** for persistent data storage and **Redis** for high-performance caching.

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@ep-***.us-east-1.aws.neon.tech/database_name?sslmode=require

# Redis Configuration  
REDIS_URL=redis://default:your_password@redis-url:port

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# DeepL Configuration (optional - will fallback to OpenAI)
DEEPL_API_KEY=your-deepl-api-key

# Session Configuration
SESSION_SECRET=your-random-session-secret
```

## Database Setup

1. **Generate Migration Files** (if schema changes):
   ```bash
   pnpm db:generate
   ```

2. **Run Migrations** (to create tables in your database):
   ```bash
   pnpm db:migrate
   ```

3. **Open Database Studio** (optional - for visual database management):
   ```bash
   pnpm db:studio
   ```

## Storage Architecture

The application uses a **layered storage approach**:

### 1. **PostgreSQL (Primary Storage)**
- Persistent storage for all user data, lessons, workflows
- Automatic failover to in-memory storage if unavailable
- Located in `api/_shared/postgres-storage.ts`

### 2. **Redis (Fast Cache Layer)**  
- High-speed caching for:
  - Translation results (DeepL/OpenAI)
  - AI-generated responses (analysis, flashcards)
  - Frequently accessed data
- Gracefully handles Redis unavailability
- Located in `api/_shared/redis.ts`

### 3. **File System (Fallback Cache)**
- Local file caching when Redis is unavailable  
- Translation cache persisted to disk
- Located in `api/_shared/translation-cache.ts`

## Default Users

The system automatically creates these default users on first startup:

- **Username**: `thuthao`, **Password**: `310799`
- **Username**: `thanhhoang`, **Password**: `090800`

## Cache Strategy

### Translation Caching
1. **Redis** (fastest) - TTL: 7 days
2. **PostgreSQL** (persistent backup)
3. **File system** (local fallback)

### AI Response Caching  
1. **Redis** with intelligent TTL:
   - Analysis results: 2 hours
   - Flashcards: 4 hours
   - Lesson plans: 1 hour

## Development vs Production

- **Development**: Falls back to in-memory storage if DATABASE_URL not set
- **Production**: Requires DATABASE_URL for persistent storage
- **Serverless**: Optimized for Vercel deployment with connection pooling

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` format and credentials
- Check Neon database status and connection limits
- Application will fallback to in-memory storage

### Redis Connection Issues  
- Verify `REDIS_URL` format and credentials
- Application gracefully continues without Redis caching
- Translation and AI responses will use fallback caching

### Migration Issues
```bash
# Reset and regenerate migrations
rm -rf drizzle/
pnpm db:generate
pnpm db:migrate
```
