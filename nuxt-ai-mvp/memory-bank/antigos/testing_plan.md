# Automated Testing Plan: Task Flow & Node/Card Reactivity

**Overall Goal:** Ensure the reliability and correctness of the task flow, focusing on the reactivity and behavior of individual nodes/cards and their associated UI elements (including modals).

**Testing Layers & Priorities:**

1.  **Core Task Flow Reactivity (Existing):**

    - Continue to maintain and expand tests in `tests/taskFlow.spec.ts` for the `TaskFlowStore`. This includes context propagation, compression, edge/node manipulation, and data updates.

2.  **Individual Node/Card Testing (New Focus):**

    - For each distinct card type (e.g., Problem, DataSource, Survey, EmpathMap), we will create dedicated test suites.
    - **Location of new tests:** We can create a new directory like `tests/nodes/` or `tests/cards/` to house these specific test files (e.g., `tests/nodes/problemCard.spec.ts`, `tests/nodes/dataSourceCard.spec.ts`).

    - **For each card type, tests should cover:**
      - **Handler Logic Unit Tests:**
        - Target the functions within the corresponding handler file in `lib/nodeHandlers/` (e.g., `lib/nodeHandlers/problemNodeHandler.ts`).
        - Focus: Test the pure logic of data processing, input/output transformations, and any specific business rules implemented in the handler.
        - Mock dependencies (like AI services or complex store interactions) where necessary to isolate the handler's logic.
      - **Component Interaction & Reactivity Tests:**
        - Test the Vue component itself (e.g., `components/cards/ProblemCard.vue`).
        - Focus:
          - Correct rendering based on input data.
          - User interactions (e.g., button clicks, form inputs within the card).
          - How the component interacts with the `TaskFlowStore` (e.g., dispatching actions, reacting to state changes).
          - Invocation and interaction with any associated modals.
      - **Modal Interaction & Logic Tests (If Applicable):**
        - For cards that use modals (e.g., `DataSourceCard.vue` likely uses `DataSourceModal.vue`; `SurveyCard.vue` uses `SurveyModal.vue`).
        - Focus:
          - Modal opening/closing.
          - Form submissions and data validation within the modal.
          - Interactions that trigger changes in the `TaskFlowStore` or the parent card's data.
          - Correct rendering of modal content and layout elements.
          - Internal logic within the modal's components (e.g., different screens/steps in `SurveyModal.vue`).

**Key Files & Directories Involved:**

- **Stores:**
  - `stores/taskFlow.ts` (primary focus for reactivity)
- **Card Components:**
  - `components/cards/DataSourceCard.vue`
  - `components/cards/EmpathMapCard.vue`
  - `components/cards/ProblemCard.vue`
  - `components/cards/SurveyCard.vue`
  - _(And any other card components)_
- **Node Handlers:**
  - `lib/nodeHandlers/dataSourceNodeHandler.ts`
  - `lib/nodeHandlers/empathMapNodeHandler.ts`
  - `lib/nodeHandlers/problemNodeHandler.ts`
  - `lib/nodeHandlers/surveyNodeHandler.ts`
  - `lib/nodeHandlers/defaultNodeHandler.ts`
  - `lib/nodeHandlers/index.ts`
- **Modals & Modal Content:**
  - `components/modals/DataSourceModal/DataSourceModal.vue`
  - `components/modals/DataSourceModal/content/*`
  - `components/modals/SurveyModal/SurveyModal.vue`
  - `components/modals/SurveyModal/content/*`
  - `components/modals/SurveyModal/blocks/*`
  - `components/modals/SurveyModal/screens/*`
- **Existing Tests:**
  - `tests/taskFlow.spec.ts`
- **New Test Directory (Proposed):**
  - `tests/nodes/` (e.g., `problemCard.spec.ts`, `dataSourceCard.spec.ts`, `surveyCard.spec.ts`)

**Testing Strategy Visualization (Mermaid Diagram):**

```mermaid
graph TD
    A[Automated Testing Strategy] --> B{Test Layers};
    B --> C[Core TaskFlow Reactivity];
    C --> C1([`stores/taskFlow.ts`]);
    C --> C2([`tests/taskFlow.spec.ts`]);

    B --> D[Individual Node/Card Testing];
    D --> D1{Per Card Type};
    D1 --> D1a[ProblemCard];
    D1 --> D1b[DataSourceCard];
    D1 --> D1c[SurveyCard];
    D1 --> D1d[EmpathMapCard];
    D1 --> D1e[...Other Cards];

    D1a --> E1[Handler Logic (`lib/nodeHandlers/problemNodeHandler.ts`)];
    D1a --> F1[Component UI/Interaction (`components/cards/ProblemCard.vue`)];
    D1a --> G1[Associated Modals (if any)];

    D1b --> E2[Handler Logic (`lib/nodeHandlers/dataSourceNodeHandler.ts`)];
    D1b --> F2[Component UI/Interaction (`components/cards/DataSourceCard.vue`)];
    D1b --> G2[Modal (`DataSourceModal.vue`)];
    G2 --> G2a[Modal Layout];
    G2 --> G2b[Modal Logic];
    G2 --> G2c[Modal Interactions];


    D1c --> E3[Handler Logic (`lib/nodeHandlers/surveyNodeHandler.ts`)];
    D1c --> F3[Component UI/Interaction (`components/cards/SurveyCard.vue`)];
    D1c --> G3[Modal (`SurveyModal.vue`)];
    G3 --> G3a[Modal Layout (Screens, Blocks)];
    G3 --> G3b[Modal Logic (Builder, Preview, Results)];
    G3 --> G3c[Modal Interactions];

    subgraph Test Suites
        direction LR
        C2
        H1([`tests/nodes/problemCard.spec.ts`])
        H2([`tests/nodes/dataSourceCard.spec.ts`])
        H3([`tests/nodes/surveyCard.spec.ts`])
    end

    E1 --> H1;
    F1 --> H1;
    G1 --> H1;

    E2 --> H2;
    F2 --> H2;
    G2 --> H2;

    E3 --> H3;
    F3 --> H3;
    G3 --> H3;
```
