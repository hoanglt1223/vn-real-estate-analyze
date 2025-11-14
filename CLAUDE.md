# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vietnamese Real Estate Analysis Platform - a comprehensive web application for analyzing real estate properties in Vietnam. The platform combines interactive mapping, geospatial analysis, and AI-powered insights to help users evaluate property potential based on nearby amenities, infrastructure, market prices, and risk factors.

**Core Purpose**: Enable users to draw or search for property locations on a map, then receive detailed analysis of surrounding amenities (schools, hospitals, shopping), infrastructure (roads, metro, industrial zones), market pricing data, and AI-generated investment recommendations.

## Key Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Storage**: Filesystem-based JSON storage (serverless compatible)
- **Database**: Previously PostgreSQL with Drizzle ORM (now deprecated)
- **Mapping**: Mapbox GL JS with Mapbox Draw plugin
- **UI**: shadcn/ui components + Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Geospatial**: Turf.js for calculations
- **AI Integration**: OpenAI API for property analysis

## Development Commands

```bash
# Development
pnpm run dev                    # Start development server with hot reload
pnpm run dev:vite              # Start Vite dev server only

# Building
pnpm run build                 # Build production bundle (client + server)
pnpm run build:vercel          # Build for Vercel deployment
pnpm run build:vite            # Build client only

# Production
pnpm run start                 # Start production server
pnpm run start:vite            # Start Vite preview server

# Type Checking
pnpm run check                 # TypeScript type checking
pnpm run format:check          # Check code formatting

# Database (deprecated - kept for reference)
pnpm run db:generate           # Generate migration files
pnpm run db:migrate            # Run migrations
pnpm run db:studio             # Open database studio
```

## Architecture Overview

### Directory Structure

- **`client/`** - React frontend application
  - `src/components/` - React components (main + ui components)
  - `src/pages/` - Page components
  - `src/lib/` - Utility functions and API client
  - `src/hooks/` - Custom React hooks

- **`server/`** - Express.js backend (legacy)
  - `services/` - Business logic and external API integrations
  - `routes.ts` - API route definitions

- **`api/`** - Serverless API functions (current)
  - `_shared/` - Shared utilities and database connection
  - `app.ts` - Main API application

- **`shared/`** - Shared types and utilities
  - `schema.ts` - TypeScript interfaces and validation schemas
  - `services/` - Shared business logic

### Storage Architecture

**Current**: Filesystem-based JSON storage for serverless deployment
- Data stored in `data/` directory as JSON files
- No database infrastructure required
- Compatible with Vercel serverless functions

**Previous**: PostgreSQL with Drizzle ORM (deprecated)
- Schema definitions in `shared/schema.ts`
- Connection pooling for serverless environments

## Key Features & Implementation

### Map Integration
- Mapbox GL JS for interactive mapping
- Mapbox Draw plugin for property boundary drawing
- Turf.js for geospatial calculations (area, orientation, distance)
- Real-time amenity visualization on map

### Property Analysis Flow
1. User draws polygon on map or searches location
2. Frontend calculates basic metrics (area, orientation) using Turf.js
3. API request sent to backend with coordinates, radius, category filters
4. Backend orchestrates multiple data fetches in parallel:
   - OpenStreetMap Overpass API for amenities/infrastructure
   - Market price data scraping
   - AI-powered analysis and scoring
5. Results aggregated and returned to frontend
6. Analysis displayed across multiple UI components

### Service Layer Architecture
- **Geospatial Service**: Property metrics and risk assessment
- **Overpass Service**: OpenStreetMap API integration
- **AI Service**: OpenAI integration for property analysis
- **Scraper Service**: Market price data extraction
- **Cache Service**: Response caching to minimize API calls

### UI Component System
- Based on shadcn/ui components built on Radix UI
- Material Design 3 principles adapted for data-intensive displays
- Vietnamese-first content strategy
- Responsive design with mobile-first approach

## Environment Variables

Required for development:
```env
# Required
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_secure_session_secret

# Optional
DEEPL_API_KEY=your_deepl_api_key
VITE_SKIP_LOGIN=true
DATA_DIR=./data
VITE_MAPBOX_TOKEN=your_mapbox_token
```

## Vietnamese Language Support

- All UI text, labels, and messages in Vietnamese
- Proper formatting for Vietnamese currency (₫) and dates (DD/MM/YYYY)
- Typography optimized for Vietnamese diacritical marks
- District/Ward/Street naming conventions respected

## External API Dependencies

- **Mapbox**: Mapping and geocoding (requires API token)
- **OpenStreetMap Overpass**: Amenity data (public API)
- **OpenAI**: AI-powered analysis (requires API key)
- **DeepL**: Translation services (optional, falls back to OpenAI)

## Development Guidelines

- Keep implementations simple and avoid adding unnecessary layers
- Make minimal changes for bug fixes
- Windows PowerShell compatibility (avoid `&&`, use `;`)
- Serverless-compatible implementation patterns
- No mocking/integration shortcuts - use real APIs
- Focus on practical implementation over extensive testing

## Deployment

- Optimized for Vercel serverless deployment
- Filesystem storage for database-free operation
- Automatic scaling with serverless functions
- Build process creates optimized production bundle