# Technical Context

## Technologies Used

- **Frontend:** Nuxt 3 (Vue 3), Pinia (State Management), Tailwind CSS, DaisyUI (UI Components), Vue Flow (Workflow UI), TipTap (Rich Text Editor), Vue Toastification (Notifications), vuedraggable, sortablejs (Drag & Drop).
- **Backend:** Nuxt 3 (Nitro Server - Node.js environment), Supabase (BaaS).
- **Database:** PostgreSQL (via Supabase).
- **Infrastructure:** Vercel (Nitro preset suggests Vercel deployment), Supabase (Hosting for BaaS).
- **Key Libraries/Tools:**
  - `@google/generative-ai`: For AI features.
  - `@nuxtjs/supabase`: Nuxt module for Supabase integration.
  - `axios`: HTTP client (potentially used for API calls).
  - `mammoth`: DOCX text extraction (server-side).
  - `xlsx`: Excel file processing (server-side).
  - `turndown`: HTML to Markdown conversion (likely for editor/AI interaction).
  - `uuid`: Generating unique IDs.

## Development Setup

- **Setup:**
  - Node.js (version compatible with Nuxt 3)
  - npm or yarn or pnpm for package management.
  - Clone the repository.
  - Run `npm install` (or equivalent).
  - Environment Variables: Requires `.env` file with `SUPABASE_URL` and `SUPABASE_KEY`. Potentially Google AI API key needed for server routes.
  - Run `npm run dev` to start the development server.
- **Setup Guide:** (No dedicated guide linked, setup inferred from standard Nuxt/Node projects and `nuxt.config.ts`).

## Technical Constraints

- **Limitations:** Dependency on external services (Supabase, Google AI) availability and pricing. Browser compatibility might be influenced by Vue Flow or other complex UI libraries. Performance of complex workflows in Vue Flow needs monitoring.
- **Requirements:** Secure handling of API keys (Supabase, Google AI) via environment variables and server-side usage where appropriate.

## Dependencies

- **External Services:** Supabase (Database, Auth), Google Generative AI.
- **Critical Libraries:** Nuxt, Vue, Pinia, Vue Flow, Supabase Client, Google AI Client.

## Tool Usage Patterns

- **State Management:** Pinia stores used for managing global state (e.g., `taskFlow`, `tasks`, `sidebar`, `modal`). Pinia Persisted State plugin likely used for some stores.
- **UI:** Tailwind CSS for styling, potentially augmented by DaisyUI components. Vue Flow for core workflow visualization.
- **Backend Logic:** Nitro server routes handle specific backend tasks like AI calls and file processing.
- **Code Style/Linting:** No explicit linters configured in `package.json` devDependencies (e.g., ESLint, Prettier), but Nuxt/Vue defaults might apply. TypeScript is used (`tsconfig.json`, `.ts` files).
