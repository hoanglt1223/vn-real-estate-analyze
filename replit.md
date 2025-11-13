# Vietnamese Real Estate Analysis Platform

## Overview

This is a comprehensive web application for analyzing real estate properties in Vietnam. The platform combines interactive mapping, geospatial analysis, and AI-powered insights to help users evaluate property potential based on nearby amenities, infrastructure, market prices, and risk factors.

**Core Purpose**: Enable users to draw or search for property locations on a map, then receive detailed analysis of surrounding amenities (schools, hospitals, shopping), infrastructure (roads, metro, industrial zones), market pricing data, and AI-generated investment recommendations.

**Target Users**: Real estate investors, homebuyers, and property analysts in Vietnam looking for data-driven insights.

**Key Technologies**: React + TypeScript frontend, Express backend, Mapbox for mapping, OpenStreetMap Overpass API for amenity data, PostgreSQL database (via Drizzle ORM), OpenAI for analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**UI Component System**: shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS. Design follows Material Design 3 principles adapted for data-intensive displays, with a focus on clear information hierarchy and Vietnamese-first content.

**State Management**: TanStack Query (React Query) for server state management with aggressive caching strategies. Local component state managed with React hooks. No global state management library used.

**Routing**: Wouter for lightweight client-side routing. Currently single-page application with potential for expansion.

**Map Integration**: Mapbox GL JS v3 for base maps with Mapbox Draw plugin for polygon drawing capabilities. Map interactions handle property boundary definition and amenity visualization.

**Form Handling**: React Hook Form with Zod schema validation for type-safe form inputs.

**Design System**: Custom Tailwind configuration with CSS variables for theming. Supports light/dark mode with theme persistence in localStorage. Typography uses Inter for UI and JetBrains Mono for technical data.

### Backend Architecture

**Server Framework**: Express.js with TypeScript, running on Node.js.

**API Design**: RESTful endpoints with JSON payloads. Main endpoint `/api/analyze-property` accepts property coordinates and returns comprehensive analysis results.

**Data Flow**: 
1. User draws polygon on map or searches location
2. Frontend calculates basic metrics (area, orientation) using Turf.js
3. POST request sent to backend with coordinates, radius, category filters
4. Backend orchestrates multiple data fetches in parallel
5. Results aggregated and returned to frontend
6. Frontend displays analysis across multiple UI cards

**Service Layer Pattern**: Business logic separated into distinct services:
- `geospatial.ts`: Property metric calculations and risk assessment using Turf.js
- `overpass.ts`: OpenStreetMap Overpass API integration for amenities and infrastructure
- `scraper.ts`: Market price data (currently mock implementation)
- `ai.ts`: OpenAI integration for property analysis and scoring

**Error Handling**: Async/await with try-catch blocks. Errors logged and returned as JSON responses with appropriate HTTP status codes.

### Data Storage

**Database**: PostgreSQL (configured via Neon serverless driver) with Drizzle ORM for type-safe database operations.

**Schema Design** (in `shared/schema.ts`):
- `users`: Basic user authentication (username/password)
- `property_analyses`: Stores completed analysis results with JSONB columns for flexible data structures
- `amenities_cache`: Caches OpenStreetMap API responses to reduce external API calls
- `market_data_cache`: Caches market price data

**Caching Strategy**: In-memory cache (`MemStorage` class) for development, with interface (`IStorage`) designed for easy swap to database-backed caching. Cache keys based on location coordinates, radius, and category.

**Data Types**: Heavy use of JSONB columns for storing complex nested data (coordinates, amenity arrays, analysis results). Enables flexibility while maintaining PostgreSQL query capabilities.

### Geospatial Analysis

**Core Library**: Turf.js for all geospatial calculations including area computation, bearing/orientation, centroid finding, and distance calculations.

**Property Metrics**:
- Area calculated from polygon coordinates
- Orientation determined by bearing between first two polygon points (8 compass directions)
- Frontage count based on polygon vertex count
- Center point calculated as centroid

**Risk Assessment**: Rule-based system evaluating proximity to:
- Industrial zones (pollution risk)
- Power infrastructure (health concerns)
- Cemeteries (cultural/psychological factors)
- Flood zones (environmental risk)
- Dead-end roads (accessibility issues)

### External API Integration

**Mapbox APIs**:
- Geocoding API for address search and autocomplete
- GL JS for map rendering and interaction
- Draw plugin for user-drawn polygons
- Access token stored in environment variable `VITE_MAPBOX_TOKEN`

**OpenStreetMap Overpass API**:
- Query language for extracting amenity data by category and location
- Supports radius-based queries around property center point
- Categories: education, healthcare, shopping, entertainment
- Infrastructure layers: roads, metro, industrial zones, power, cemeteries, water bodies
- Results cached to minimize API load

**OpenAI API** (optional):
- GPT model integration for generating property analysis summaries
- Scoring algorithms combine amenity proximity, infrastructure quality, and risk factors
- Fallback to rule-based scoring if API key not configured

### PDF Export Functionality

**Libraries**: jsPDF for PDF generation, html2canvas for capturing map screenshots.

**Export Process**:
1. Capture current map state as image
2. Assemble property data, analysis results, and visualizations
3. Format into multi-page PDF with Vietnamese text support
4. Trigger browser download

**Challenges**: Ensuring map markers and layers are visible in screenshot, maintaining layout consistency across different data volumes.

## External Dependencies

### Third-Party Services

**Mapbox** (maps and geocoding):
- Service: Mapbox GL JS v3.0.1, Mapbox Geocoding API
- Purpose: Interactive mapping, location search, map rendering
- Authentication: API token via environment variable
- Rate Limits: Based on Mapbox pricing tier

**OpenStreetMap Overpass API** (amenity data):
- Service: Public Overpass API (`https://overpass-api.de/api/interpreter`)
- Purpose: Real-time queries for points of interest (schools, hospitals, shops)
- Authentication: None (public API)
- Rate Limits: Fair use policy, caching implemented to minimize requests
- Data Format: XML/JSON responses converted to GeoJSON

**OpenAI API** (optional AI analysis):
- Service: OpenAI GPT models
- Purpose: Generate property analysis summaries and recommendations
- Authentication: API key via `OPENAI_API_KEY` environment variable
- Fallback: Rule-based scoring system if API unavailable

### Database

**Neon Serverless PostgreSQL**:
- Purpose: Primary data storage for analyses and caching
- Connection: Via `@neondatabase/serverless` driver
- Configuration: `DATABASE_URL` environment variable
- Migration: Drizzle Kit for schema migrations

### UI Libraries

**Radix UI Primitives**: Accessible, unstyled component primitives for complex UI patterns (dialogs, dropdowns, tooltips, etc.)

**Recharts**: Charting library for market price visualizations

**Tailwind CSS**: Utility-first CSS framework with custom configuration for design system

### Development Tools

**Vite**: Build tool and dev server with HMR support

**TypeScript**: Type safety across frontend and backend

**ESLint/Prettier**: Code quality and formatting (configuration not shown but typical)

**Replit Plugins**: Development banner, cartographer, and runtime error overlay for Replit environment

### Font Services

**Google Fonts**: Inter (UI text) and JetBrains Mono (monospace/technical data) loaded via CDN in `client/index.html`