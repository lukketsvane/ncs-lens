# NCS Lens

A Progressive Web App (PWA) that uses Artificial Intelligence to analyze product images, identifying materials and matching colors to professional standards like NCS and RAL.

## Features

*   **AI Analysis**: Identifies products, materials, textures, and finishes using OpenAI GPT-4.1 mini vision.
*   **Product Recognition**: When a known product is identified, searches the web for official manufacturer color codes (NCS/RAL).
*   **Precision Color Matching**: Matches colors to NCS S-Series and RAL Classic standards with lighting correction.
*   **Technical Specifications**: Provides detailed color data including Light Reflectance Value (LRV), CMYK, RGB, and NCS component breakdowns (Blackness, Chromaticness, Hue).
*   **Palette Extraction**: Client-side image analysis extracting dominant colors and mapping to Pantone codes.
*   **Comparison Tool**: Split-screen view to compare scanned colors against standard references or previous history.
*   **NCS Color Wheel**: Interactive hue ring and triangle picker for fine-tuning NCS colors.
*   **User Authentication**: Email/password authentication powered by Supabase.
*   **Cloud Storage**: Scan history and images stored in Supabase.
*   **Profile Management**: User profile settings with display name and avatar customization.
*   **Community Features**: Share scans publicly for the community to discover and like.
*   **i18n**: Norwegian (default) with English variant at `/en`.

## Tech Stack

*   Svelte 5 / SvelteKit
*   TypeScript
*   Tailwind CSS
*   OpenAI SDK (GPT-4.1 mini vision)
*   Supabase (Auth, Database, Storage)
*   Lucide Svelte

## Project Structure

```
src/
├── lib/
│   ├── actions/          # Svelte actions (swipe gesture)
│   ├── components/
│   │   ├── ncs/          # NCS color wheel (HueRing, TrianglePicker)
│   │   ├── CommunityTab.svelte
│   │   ├── ColorDetailView.svelte
│   │   ├── HistoryTab.svelte
│   │   ├── PaletteTab.svelte
│   │   ├── ProfileTab.svelte
│   │   ├── ResultView.svelte
│   │   ├── ScanTab.svelte
│   │   └── Toast.svelte
│   ├── i18n/
│   │   ├── index.ts      # Locale store + derived t() function
│   │   ├── no.ts         # Norwegian translations (default)
│   │   └── en.ts         # English translations
│   ├── stores/
│   │   ├── app.ts        # Main app state (tabs, history, colors)
│   │   ├── auth.ts       # Auth state (user, isLoggedIn)
│   │   └── toast.ts      # Toast notification store
│   ├── api.ts            # Gemini AI analysis
│   ├── ncs-colors.ts     # NCS color data + deltaE2000
│   ├── pantone-colors.ts # Pantone color data + palette extraction
│   ├── saved-colors.ts   # Supabase saved colors CRUD
│   ├── scans.ts          # Supabase scans CRUD + likes
│   └── storage.ts        # Supabase image storage
├── routes/
│   ├── en/
│   │   ├── +layout.svelte   # Sets locale to 'en'
│   │   ├── +page.svelte     # English main page
│   │   └── vilkaar/
│   │       └── +page.svelte # English terms page
│   ├── vilkaar/
│   │   └── +page.svelte     # Norwegian terms page
│   ├── +error.svelte        # Custom error page
│   ├── +layout.svelte       # Root layout (nav, toast)
│   └── +page.svelte         # Main page (tab routing)
└── app.html
```

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
   OPENAI_API_KEY=your_openai_api_key
   ```

### Database Setup

All database schema lives in `supabase/migrations/`. There are two ways to bring the
database up.

#### Option A — Local development (Supabase CLI + Docker)

Requires Docker running locally. The CLI applies **every** migration automatically.

```bash
npm run db:start    # boots Postgres + Auth + Storage + Studio, applies all migrations
npm run db:status   # prints the local API URL + anon/service keys for your .env
npm run db:reset    # re-applies every migration from scratch (use after editing migrations)
npm run db:stop     # tears the stack down
```

Then copy the local values from `db:status` into `.env` (or uncomment the local block
already present in `.env.example`).

#### Option B — Hosted Supabase project

Apply the migrations to your project. Either link the CLI and push:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

…or paste each file in `supabase/migrations/` (in filename order) into the Supabase
dashboard SQL Editor.

**Important**: In your Supabase project settings, disable email confirmation for easier authentication:
- Go to Authentication > Providers > Email
- Disable "Confirm email"

### Installation

```bash
npm install
npm run dev
```

## Database Schema

### `likes`
```sql
create table public.likes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  scan_id uuid not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint likes_pkey primary key (id),
  constraint likes_user_id_scan_id_key unique (user_id, scan_id),
  constraint likes_scan_id_fkey foreign key (scan_id) references scans (id) on delete cascade,
  constraint likes_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create index idx_likes_scan_id on public.likes using btree (scan_id);
create index idx_likes_user_id on public.likes using btree (user_id);
```

### `profiles`
```sql
create table public.profiles (
  id uuid not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  display_name text null default ''::text,
  avatar_url text null default ''::text,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
);
```

### `saved_colors`
```sql
create table public.saved_colors (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  color_system text not null,
  color_code text not null,
  color_name text null,
  color_hex text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint saved_colors_pkey primary key (id),
  constraint saved_colors_user_id_system_code_key unique (user_id, color_system, color_code),
  constraint saved_colors_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create index idx_saved_colors_user_id on public.saved_colors using btree (user_id);
```

### `scans`
```sql
create table public.scans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  image_url text not null,
  result jsonb not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  is_public boolean null default false,
  author text null,
  constraint scans_pkey primary key (id),
  constraint scans_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create index idx_scans_is_public on public.scans using btree (is_public);
create index idx_scans_user_id on public.scans using btree (user_id);
```

## Roadmap

*   ~~Implement user authentication system.~~
*   Integrate Google Login.
*   ~~Create detailed user profile pages to manage collections.~~
*   ~~Migrate community features from local storage to a backend database.~~
*   Implement Stripe payment integration for subscriptions.
*   Implement daily scan quota for free users.
