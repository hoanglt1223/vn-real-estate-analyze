# Data Directory

This directory is used for local development data storage.

## Important Notes

- **Production (Vercel):** Uses `/tmp/data` directory (temporary storage)
- **Development:** Uses `./data` directory (persistent local storage)

## Why /tmp in Production?

Vercel serverless functions have read-only filesystem access except for `/tmp`. The `/tmp` directory:
- Is writable during function execution
- Gets reset between function invocations (cold starts)
- Cannot persist data long-term

## Long-term Solution

For production, consider using:
- Vercel KV (Redis)
- External database (PostgreSQL, MongoDB)
- Other cloud storage solutions

## Git Tracking

The `.gitkeep` file ensures this directory is tracked by git, even when empty.