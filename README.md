# Speak for the Dead

A Next.js application that allows users to upload documents and interact with an AI to analyze and discuss their content.

## Features

- Document upload and processing
- AI-powered content analysis using OpenAI
- Modern 3D UI with React Three Fiber
- Real-time chat interface
- Content moderation and safety screening
- Supabase backend integration

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase project set up
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` with your actual values.

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (server-only)
- `OPENAI_API_KEY` - Your OpenAI API key
- `NEXT_PUBLIC_APP_URL` - Your application URL
- `SUPABASE_EDGE_FUNCTION_URL` - Your Supabase Edge Functions URL

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI**: React Three Fiber, Framer Motion, Lucide React
- **Backend**: Supabase, OpenAI
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod validation

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

This application is designed to be deployed on Vercel with Supabase as the backend.

## License

Private - All rights reserved.
