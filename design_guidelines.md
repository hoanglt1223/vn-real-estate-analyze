# Design Guidelines: Vietnamese Real Estate Analysis Platform

## Design Approach

**Selected System**: Material Design 3 adapted for data-intensive real estate analysis
**Justification**: This application requires clear information hierarchy, robust data visualization, and professional credibility. Material Design provides excellent patterns for complex data displays while maintaining visual clarity and user-friendly interactions.

**Key Design Principles**:
- Data clarity over decoration
- Progressive disclosure of complexity
- Spatial consistency for professional trust
- Vietnamese-first content strategy

---

## Typography

**Font System**: 
- Primary: Inter (via Google Fonts) - clean, highly legible for data
- Vietnamese optimization: Ensure proper diacritical mark rendering
- Monospace: JetBrains Mono for coordinates and technical data

**Hierarchy**:
- **Hero/Page Titles**: text-4xl md:text-5xl font-bold (40-48px)
- **Section Headers**: text-2xl md:text-3xl font-semibold (24-30px)
- **Card/Module Titles**: text-lg font-semibold (18px)
- **Body Text**: text-base (16px) - primary content
- **Data Labels**: text-sm font-medium (14px) - form labels, metrics
- **Captions/Metadata**: text-xs text-muted-foreground (12px)
- **Technical Data** (coordinates, IDs): font-mono text-sm

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Micro spacing (within components): p-2, gap-2
- Component internal: p-4, gap-4  
- Section spacing: py-8, gap-6
- Major sections: py-12, gap-8
- Page margins: px-4 md:px-6 lg:px-8

**Grid Structure**:
- Container: max-w-7xl mx-auto
- Dashboard layout: Two-panel split (map 60% / data panel 40%)
- Data grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 for metric cards
- Mobile: Always stack to single column

---

## Component Library

### A. Map Interface (Primary Surface)
- Full-height interactive map occupying majority of viewport
- Floating control panels with backdrop-blur-md and shadow-lg
- Property polygon: Distinct boundary with fill opacity for visibility
- Layer toggles: Compact pill-style buttons with icons
- Zoom/draw controls: Bottom-right floating toolbar

### B. Data Panels & Cards
- **Property Input Panel**: Left-side slide-out drawer (w-96)
  - Coordinate inputs with validation
  - Land orientation compass visualization
  - Area calculation display with unit toggle (m² / hectares)
  
- **Analysis Cards**: Consistent card structure
  - White background with border border-border
  - Rounded corners (rounded-lg)
  - Padding: p-6
  - Shadow: shadow-sm hover:shadow-md transition
  
- **Metrics Display**: 
  - Icon + Label + Value pattern
  - Use grid-cols-2 md:grid-cols-4 for score breakdowns
  - Progress bars for scores (0-100 scale)

### C. Navigation & Controls
- **Top Bar**: Sticky header with app logo, breadcrumb navigation, user actions
  - Height: h-16
  - Background: backdrop-blur with subtle border-b
  
- **Sidebar Filter Panel**: 
  - Collapsible sections for amenity categories
  - Checkbox groups with counts
  - Radius slider with live preview
  - Distance badges (100m, 500m, 1km, 5km presets)

### D. Data Visualizations
- **Price Heatmap**: Gradient overlay on map using Mapbox layers
- **Charts**: Use Recharts library
  - Bar charts for price comparisons (min/avg/max)
  - Line charts for historical trends
  - Donut charts for score breakdowns
  - Height: h-64 for standard charts, h-80 for featured

### E. AI Analysis Section
- **Overall Score**: Large circular progress with center value
  - Size: w-32 h-32, positioned prominently
  - Color-coded: 0-40 (red), 41-70 (yellow), 71-100 (green)
  
- **Score Breakdown**: Horizontal progress bars for each category
  - Label + bar + numeric value pattern
  - Gap: gap-4 between items
  
- **Recommendation Badge**: 
  - Large, prominent pill with icon
  - "Nên Mua" (green) / "Không Nên Mua" (red) / "Cân Nhắc" (yellow)
  
- **AI Summary**: 
  - Card with distinct styling (bg-muted)
  - Max 200 words Vietnamese text
  - Typography: text-base leading-relaxed

### F. Market Data Display
- **Listing Grid**: 
  - Cards with thumbnail (if available), price, area, location
  - grid-cols-1 md:grid-cols-2 gap-4
  
- **Price Statistics**: 
  - Three-column layout for Min / Avg / Max
  - Large numbers (text-3xl font-bold)
  - Small labels (text-sm text-muted-foreground)
  - Vietnamese currency formatting (₫)

### G. Forms & Inputs
- **Text Inputs**: 
  - Height: h-10
  - Border: border-input with focus ring
  - Placeholder text in Vietnamese
  
- **Select Dropdowns**:
  - Shadcn Select component
  - Options in Vietnamese
  
- **Sliders**: 
  - Radius selection with live value display
  - Markers at preset distances

### H. Report & Export
- **PDF Preview**: 
  - A4 aspect ratio preview (aspect-[1/1.414])
  - Thumbnail sections showing report contents
  
- **Action Buttons**:
  - Primary: "Tải Báo Cáo PDF" (download icon)
  - Secondary: "Chia Sẻ Link" (share icon)
  - Full width on mobile, inline on desktop

### I. Amenity Display
- **Category Tabs**: 
  - Horizontal scrollable tabs for mobile
  - Icons + Vietnamese labels
  - Active state with border-b-2
  
- **Amenity List Items**:
  - Icon, name, distance, walking time
  - Subtle dividers between items
  - Distance in meters (<1km) or kilometers
  - Click to highlight on map

### J. Risk Indicators
- **Warning Cards**: 
  - Distinct treatment with amber/red tones for backgrounds
  - Icon + risk description + severity level
  - Collapsible details section
  
- **Risk Score Gauge**: 
  - Inverted scale (lower is better)
  - Visual indicator: 0-20 (green), 21-50 (yellow), 51+ (red)

---

## Animations

**Use Sparingly**:
- Map transitions: Smooth pan/zoom when selecting amenities
- Panel slide-ins: transition-transform duration-300
- Score count-up: Animate from 0 to final score on first load
- **No** scroll-triggered animations
- **No** decorative motion

---

## Images

**Property Photos** (if available from crawler):
- Thumbnail in listing cards: aspect-video, object-cover
- Gallery in report: grid-cols-2 md:grid-cols-3

**Iconography**: 
- Use Lucide React icons throughout
- Consistent 20px size for inline icons
- 24px for prominent UI elements

**No hero image needed** - the map IS the hero interface.

---

## Mobile Optimization

- Map takes full height on mobile (h-[60vh])
- Data panels stack below map or slide over as modals
- Collapsible sections for long content
- Bottom sheet pattern for filters
- Touch-friendly tap targets (min h-11)

---

## Vietnamese Language Considerations

- All labels, buttons, messages in Vietnamese
- Proper spacing for diacritical marks
- Number formatting: 1.500.000 ₫ (dot as thousands separator)
- Date format: DD/MM/YYYY
- District/Ward/Street naming conventions respected