# CMF Lens svelte

A Progressive Web App (PWA) that uses Artificial Intelligence to analyze product images, identifying materials and matching colors to professional standards like NCS and RAL.

## Features

*   **AI Analysis**: Identifies products, materials, textures, and finishes using Google Gemini 2.5 Pro with web search capability.
*   **Product Recognition**: When a known product is identified, searches the web for official manufacturer color codes (NCS/RAL).
*   **Precision Color Matching**: Matches colors to NCS S-Series and RAL Classic standards with lighting correction.
*   **Technical Specifications**: Provides detailed color data including Light Reflectance Value (LRV), CMYK, RGB, and NCS component breakdowns (Blackness, Chromaticness, Hue).
*   **Comparison Tool**: Split-screen view to compare scanned colors against standard references or previous history.
*   **User Authentication**: Email/password authentication powered by Supabase.
*   **Cloud Storage**: Scan history and images stored in Supabase.
*   **Profile Management**: User profile settings with display name customization.
*   **Community Features**: Share scans publicly for the community to discover.

## Tech Stack

*   React 19
*   TypeScript
*   Tailwind CSS
*   Google GenAI SDK (Gemini 3 Pro with Google Search grounding)
*   Supabase (Auth, Database, Storage)
*   Lucide React

## Getting Started

### Prerequisites

*   Node.js 18+
*   A Supabase project

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

### Supabase Setup

Run the SQL migrations in your Supabase project dashboard (SQL Editor):

1. `supabase/migrations/20240101000000_create_profiles.sql` - Creates user profiles table
2. `supabase/migrations/20240101000001_create_storage.sql` - Sets up storage bucket for images
3. `supabase/migrations/20240101000002_create_scans.sql` - Creates scans table for history

**Important**: In your Supabase project settings, disable email confirmation for easier authentication:
- Go to Authentication > Providers > Email
- Disable "Confirm email"

### Installation

```bash
npm install
npm run dev
```

## Roadmap

*   ~~Implement user authentication system.~~
*   Integrate Google Login.
*   ~~Create detailed user profile pages to manage collections.~~
*   ~~Migrate community features from local storage to a backend database.~~
*   Implement Stripe payment integration for subscriptions.
*   Implement daily scan quota for free users.
