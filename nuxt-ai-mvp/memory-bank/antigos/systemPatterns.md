# System Patterns

## System Architecture

- **Architecture:** Full-stack Nuxt 3 application. Utilizes Nuxt's integrated Nitro server for specific backend API endpoints (AI, file processing) and leverages Supabase (BaaS) for core database persistence, authentication, and potentially other backend services.
- **Diagrams:** (No diagrams available in current context)
- **Main Components:**
  - **Nuxt 3 Frontend:** Handles UI rendering (Vue 3 components), routing, state management (Pinia), and user interactions.
  - **Nitro Server:** Integrated backend providing API routes (`server/api/*`) for tasks like AI generation and file extraction.
  - **Supabase:** External BaaS providing PostgreSQL database, authentication, and potentially other backend features.
  - **Vue Flow:** Library used for rendering the interactive visual task workflow editor.
  - **Google Generative AI:** External service used for AI-powered features, accessed via a Nitro API route.

## Key Technical Decisions

- **Nuxt 3:** Chosen for its full-stack capabilities, Vue 3 integration, module ecosystem, and performance features (SSR, Nitro).
- **Vue 3 / Composition API:** Modern reactive framework foundation for Nuxt.
- **Pinia:** Official state management library for Vue, offering type safety and developer experience improvements over Vuex.
- **Tailwind CSS (+ DaisyUI):** Utility-first CSS for rapid UI development and customization.
- **Vue Flow:** Selected for building the core visual workflow interface.
- **Supabase:** Provides a quick way to set up a backend with database and auth, integrating well with Nuxt. Alternative might be building a custom backend (e.g., Express), but Supabase offers faster development.
- **Google Generative AI:** Chosen AI provider for task refinement features. Alternatives could include OpenAI or others.
- **TipTap:** Rich text editor for potentially detailed task descriptions or notes.
- **Server Routes (Nitro):** Used for specific backend logic (AI calls, file processing) that shouldn't run client-side or requires server environment/secrets.

## Design Patterns

- **Component-Based Architecture:** UI is broken down into reusable Vue components (`components/`, `pages/`, `layouts/`). Promotes modularity and maintainability.
- **MVVM (Model-View-ViewModel) / MVC:** Nuxt structure implicitly follows this pattern (Pages/Components as View/ViewModel, Stores/Composables/API routes interacting with Supabase as Model/Controller).
- **Composition API (Vue 3 Composables):** Reusable logic extracted into functions (`composables/useNodeActions.js`, `composables/useNodeContext.js`). Enhances code reuse and organization.
- **Centralized State Management (Pinia):** Application state managed in stores (`stores/taskFlow.js`, `stores/tasks.js`). Simplifies state sharing and debugging.
- **API Routes (Nitro):** Backend logic encapsulated as distinct endpoints (`server/api/...`). Clear separation of backend concerns.
- **Dependency Injection (Nuxt Plugins/Modules):** Services like Supabase client or Toast notifications are injected (`plugins/`, `modules:` in `nuxt.config.ts`).

## Component Relationships

- **UI Interaction:** Pages orchestrate components. Components communicate via props, events, and shared Pinia stores.
- **State Flow:** User actions in components trigger updates in Pinia stores. Stores might trigger API calls (either directly to Supabase client-side or via Nitro server routes). API responses update stores, which reactively update the UI.
- **Visual Flow:** `TaskFlow.vue` uses Vue Flow components. Node/edge data likely synced with `stores/taskFlow.js`. Interactions within the flow trigger actions defined in composables or store actions.
- **Backend Communication:** Frontend components/stores/composables make HTTP requests to Nitro API routes (`/server/api/...`) for AI, file processing. Direct calls to Supabase client library for database/auth operations.
- **API Contracts:** Defined by the Nitro server routes in `server/api/`. Supabase interactions follow the Supabase client library API.

#### Node Data Flow (TaskFlow)

- **Data Structure:** Nodes within the `TaskFlow` store (`stores/taskFlow.js`) manage their data dependencies using specific properties within the `node.data` object:
  - `inputData`: An object containing data received from parent nodes. Keys are the IDs of the source (parent) nodes, and values are the `outputData` propagated from those parents. This allows a node to access context from multiple inputs (e.g., an Empath Map node receiving data from both a Problem node and a Survey node).
  - `outputData`: An object representing the data this node makes available to its children nodes. The structure of `outputData` depends on the node type (e.g., problem definition, survey results, data source content, empath map analysis).
- **Propagation Mechanism:**
  - When a node's data is updated (e.g., via the `updateNodeData` action in the store), the `propagateOutput(updatedNodeId)` action is triggered automatically after the update.
  - `propagateOutput` determines the correct `outputData` for the source node based on its type and current state (e.g., fetching survey results, grouping data source content).
  - It then identifies all child nodes connected via edges originating from the source node.
  - For each child node, it calls `updateTargetNodeInput(childNodeId, sourceNodeId, sourceOutputData)`.
  - `updateTargetNodeInput` updates the `childNode.data.inputData` object, adding or replacing the entry for the `sourceNodeId` with the new `sourceOutputData`.
- **Reactivity:** This system ensures that changes in a parent node automatically propagate their relevant output data to the input data of their children. Vue's reactivity system then ensures that components observing this `inputData` (like the various Node Cards) update accordingly.
- **Persistence:** Both `inputData` and `outputData` are persisted as part of the `nodes` array within the `task_flows` table in Supabase, ensuring the state is saved and restored correctly.

## Critical Implementation Paths

- **Visual Workflow Rendering & Interaction:** Managing state and updates for potentially complex graphs in Vue Flow.
- **AI Integration:** Calling the external AI API, handling latency, and integrating results back into the task flow.
- **Real-time Updates (if any):** If Supabase real-time features are used, managing subscriptions and updates efficiently.
- **File Processing:** Handling potentially large file uploads and server-side extraction logic.
- **State Management Complexity:** Ensuring Pinia stores remain manageable as the application grows.
- **Potential Bottlenecks:** External API call latency (AI, Supabase), complex graph rendering performance, server-side processing time for large files.
