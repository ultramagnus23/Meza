# Experience Intelligence Platform

Understand how physical environments influence customer behavior and business outcomes using anonymous occupancy analytics and operational data.

## Features

- **Occupancy Analytics** - Real-time table and people counting from existing CCTV
- **Environmental Tracking** - Temperature, music, lighting, weather correlations
- **Revenue Analytics** - Daily revenue trends and order analysis
- **Experimentation** - Design and track A/B tests for environment optimization
- **Recommendations** - Data-driven suggestions for improving experience

## Privacy

This system does NOT collect:
- Customer names, phone numbers, or IDs
- Facial recognition or biometric data
- Images (processed and discarded immediately)
- WiFi device tracking

This system DOES collect:
- Anonymous occupancy counts
- Table utilization metrics
- Queue length and wait times
- Environmental conditions (temperature, music, lighting)

## Setup

1. Create a Supabase project at https://supabase.com
2. Run the SQL migration: `supabase/migrations/001_initial_schema.sql`
3. Copy `.env.local.example` to `.env.local` and add your Supabase credentials
4. Install dependencies: `npm install`
5. Run development server: `npm run dev`

## Architecture

- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email/password)
- **CV Pipeline**: Python script for edge device (Raspberry Pi / Jetson Nano)
- **Charts**: Recharts

## Project Structure

```
app/
  api/           # API routes (restaurants, occupancy, revenue, etc.)
  auth/          # Auth pages
  dashboard/     # Main dashboard
  occupancy/     # Occupancy analytics
  environment/   # Environmental tracking
  experiments/   # Experiment management
  recommendations/ # AI recommendations
components/      # React components
lib/            # Supabase client, types, store, API client
cv_pipeline/    # Python CV pipeline for edge devices
supabase/       # Database migrations
```

## MVP Deployment

- **Cost**: Under ₹10,000 (Raspberry Pi 4 + cables)
- **Timeline**: 2-4 weeks for pilot
- **Data**: Existing CCTV cameras only
- **Privacy**: Zero PII collected
