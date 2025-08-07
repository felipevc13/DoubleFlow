// test-setup.ts
import { vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
// importsMock is not directly used here anymore for #imports, but mockFetch will be.
// Import the specific store mock we need
import {
  mockFetch,
  taskFlowStoreFactory, // Import the factory
} from "./mocks/imports";

// Set a mock API key for Google GenerativeAI for testing purposes
process.env.GOOGLE_API_KEY = "mock-api-key";

/**
 * Global test setup file that runs before Vitest executes tests.
 * Sets up mocking for Supabase, Nuxt, and initializes Pinia.
 */

// Configure logging
const DEBUG = false;
const log = (...args: any[]) => DEBUG && console.log(...args);

log("TEST_SETUP: Starting global setup...");

// =====================================
// SUPABASE CLIENT MOCK IMPLEMENTATION
// =====================================
// Use a more specific type for task_flows data
interface MockTaskFlowDataType {
  id: string;
  user_id: string;
  task_id: string;
  nodes: string | null;
  edges: string | null;
  viewport: string | null;
  created_at: string;
  updated_at: string;
}
// Mock type for reports table
interface MockReportDataType {
  id: string;
  title: string;
  summary: string;
  markdown_content: string;
  task_id?: string;
  created_at?: string;
  updated_at?: string;
}
// This is the primary MockQueryBuilder interface
interface MockQueryBuilder {
  _filters: {
    type: string;
    column: string;
    value?: any;
    values?: any[];
    from?: any;
    to?: any;
  }[];
  _single: boolean;
  _order: { column: string; ascending: boolean } | null;
  _limit: number | null;
  eq: (column: string, value: any) => this;
  neq: (column: string, value: any) => this;
  gt: (column: string, value: any) => this;
  gte: (column: string, value: any) => this;
  lt: (column: string, value: any) => this;
  lte: (column: string, value: any) => this;
  like: (column: string, value: any) => this;
  ilike: (column: string, value: any) => this;
  is: (column: string, value: any) => this;
  in: (column: string, values: any[]) => this;
  contains: (column: string, value: any) => this;
  containedBy: (column: string, value: any) => this;
  range: (column: string, from: any, to: any) => this;
  order: (column: string, options?: { ascending?: boolean }) => this;
  limit: (count: number) => this;
  single: () => Promise<{
    data: MockTaskFlowDataType | null; // Updated type
    error: any;
  }>;
  maybeSingle: () => Promise<{ data: MockTaskFlowDataType | null; error: any }>; // Updated type
  then: (
    onFulfilled?: (value: {
      data: MockTaskFlowDataType | MockTaskFlowDataType[] | null; // Updated type
      error: any;
    }) => any,
    onRejected?: (reason: any) => any
  ) => Promise<any>;
}

const createQueryBuilder = (): MockQueryBuilder => {
  const self: MockQueryBuilder = {
    _filters: [],
    _single: false,
    _order: null,
    _limit: null,

    // Filter methods
    eq: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "eq", column, value });
      return this;
    }),
    neq: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "neq", column, value });
      return this;
    }),
    gt: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "gt", column, value });
      return this;
    }),
    gte: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "gte", column, value });
      return this;
    }),
    lt: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "lt", column, value });
      return this;
    }),
    lte: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "lte", column, value });
      return this;
    }),
    like: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "like", column, value });
      return this;
    }),
    ilike: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "ilike", column, value });
      return this;
    }),
    is: vi.fn(function (this: MockQueryBuilder, column: string, value: any) {
      this._filters.push({ type: "is", column, value });
      return this;
    }),
    in: vi.fn(function (this: MockQueryBuilder, column: string, values: any[]) {
      this._filters.push({ type: "in", column, values });
      return this;
    }),
    contains: vi.fn(function (
      this: MockQueryBuilder,
      column: string,
      value: any
    ) {
      this._filters.push({ type: "contains", column, value });
      return this;
    }),
    containedBy: vi.fn(function (
      this: MockQueryBuilder,
      column: string,
      value: any
    ) {
      this._filters.push({ type: "containedBy", column, value });
      return this;
    }),
    range: vi.fn(function (
      this: MockQueryBuilder,
      column: string,
      from: any,
      to: any
    ) {
      this._filters.push({ type: "range", column, from, to });
      return this;
    }),

    // Query configuration
    order: vi.fn(function (
      this: MockQueryBuilder,
      column: string,
      options: { ascending?: boolean } = {}
    ) {
      this._order = { column, ascending: options.ascending ?? true };
      return this;
    }),
    limit: vi.fn(function (this: MockQueryBuilder, count: number) {
      this._limit = count;
      return this;
    }),

    // Result methods
    single: vi.fn(function (this: MockQueryBuilder) {
      this._single = true;
      const mockTaskFlowRecord: MockTaskFlowDataType = {
        id: "mock-single-id",
        user_id: "test-user-id",
        task_id: "mock-task-id",
        nodes: JSON.stringify([
          { id: "node1", type: "default", position: { x: 0, y: 0 }, data: {} },
        ]),
        edges: JSON.stringify([]),
        viewport: JSON.stringify({ x: 0, y: 0, zoom: 1 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return Promise.resolve({
        data: mockTaskFlowRecord,
        error: null,
      });
    }),
    maybeSingle: vi.fn(function (this: MockQueryBuilder) {
      this._single = true;
      // For maybeSingle, returning null data is often the expected case for "not found"
      return Promise.resolve({ data: null, error: null });
    }),

    // Promise interface
    then: function (
      this: MockQueryBuilder,
      onFulfilled?: (value: {
        data: MockTaskFlowDataType | MockTaskFlowDataType[] | null; // Updated type
        error: any;
      }) => any,
      onRejected?: (reason: any) => any
    ) {
      let mockData: MockTaskFlowDataType[] | MockTaskFlowDataType | null;
      const defaultTaskFlowRecord: MockTaskFlowDataType = {
        id: "mock-data-1",
        user_id: "test-user-id",
        task_id: "mock-task-id-1",
        nodes: JSON.stringify([]),
        edges: JSON.stringify([]),
        viewport: JSON.stringify({ x: 0, y: 0, zoom: 1 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (this._single) {
        mockData = { ...defaultTaskFlowRecord, id: "mock-single-id-then" };
      } else {
        mockData = [
          defaultTaskFlowRecord,
          {
            ...defaultTaskFlowRecord,
            id: "mock-data-2",
            task_id: "mock-task-id-2",
          },
        ];
      }

      return Promise.resolve({ data: mockData, error: null }).then(
        onFulfilled,
        onRejected
      );
    },
  };

  return self;
};

const createMockStorageBucket = (bucketName: string) => {
  return {
    bucketName,
    upload: vi.fn((path: string, data: any, options?: any) => {
      log(`MOCK: Storage upload to ${bucketName}/${path}`);
      return Promise.resolve({
        data: { path: `${bucketName}/${path}` },
        error: null,
      });
    }),
    download: vi.fn((path: string) => {
      log(`MOCK: Storage download from ${bucketName}/${path}`);
      return Promise.resolve({
        data: new Blob(["mock content for " + path]),
        error: null,
      });
    }),
    getPublicUrl: vi.fn((path: string) => {
      return {
        data: {
          publicUrl: `https://mock-supabase-storage.com/${bucketName}/${path}`,
        },
      };
    }),
    list: vi.fn((prefix?: string) => {
      return Promise.resolve({
        data: [
          { name: `${prefix || ""}file1.txt`, id: "mock-file-1" },
          { name: `${prefix || ""}file2.png`, id: "mock-file-2" },
        ],
        error: null,
      });
    }),
    remove: vi.fn((paths: string | string[]) => {
      const pathList = Array.isArray(paths) ? paths : [paths];
      log(`MOCK: Storage remove from ${bucketName}:`, pathList);
      return Promise.resolve({ data: { paths: pathList }, error: null });
    }),
  };
};

/**
 * Comprehensive mock of Supabase client including auth, database, and storage
 */
const mockSupabaseClient = {
  // AUTH MODULE
  auth: {
    signIn: vi.fn(({ email, password } = {}) => {
      log("MOCK: auth.signIn called", { email });
      return Promise.resolve({
        data: {
          session: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            expires_at: Date.now() + 3600,
          },
          user: {
            id: "test-user-id",
            email: email || "test@example.com",
            app_metadata: {},
            user_metadata: { name: "Test User" },
          },
        },
        error: null,
      });
    }),

    signUp: vi.fn(({ email, password } = {}) => {
      log("MOCK: auth.signUp called", { email });
      return Promise.resolve({
        data: {
          user: {
            id: "test-user-id",
            email: email || "test@example.com",
            app_metadata: {},
            user_metadata: {},
          },
          session: null,
        },
        error: null,
      });
    }),

    signOut: vi.fn(() => {
      log("MOCK: auth.signOut called");
      return Promise.resolve({ error: null });
    }),

    onAuthStateChange: vi.fn((callback) => {
      log("MOCK: auth.onAuthStateChange subscribed");
      const mockSession = {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          app_metadata: {},
          user_metadata: { name: "Test User" },
        },
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
      };

      // Call callback immediately to simulate already being logged in
      setTimeout(() => callback("SIGNED_IN", mockSession), 0);

      // Return unsubscribe function
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(() => {
              log("MOCK: auth.onAuthStateChange unsubscribed");
            }),
          },
        },
      };
    }),

    getUser: vi.fn(() => {
      log("MOCK: auth.getUser called");
      return Promise.resolve({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            app_metadata: {},
            user_metadata: { name: "Test User" },
          },
        },
        error: null,
      });
    }),

    getSession: vi.fn(() => {
      log("MOCK: auth.getSession called");
      return Promise.resolve({
        data: {
          session: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
              app_metadata: {},
              user_metadata: { name: "Test User" },
            },
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            expires_at: Date.now() + 3600,
          },
        },
        error: null,
      });
    }),

    setSession: vi.fn((accessToken, refreshToken) => {
      log("MOCK: auth.setSession called", {
        accessToken: accessToken?.substring(0, 10) + "...",
      });
      return Promise.resolve({ data: {}, error: null });
    }),

    updateUser: vi.fn((updates) => {
      log("MOCK: auth.updateUser called", updates);
      return Promise.resolve({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            ...updates,
          },
        },
        error: null,
      });
    }),

    resetPasswordForEmail: vi.fn((email) => {
      log("MOCK: auth.resetPasswordForEmail called", { email });
      return Promise.resolve({ data: {}, error: null });
    }),
  },

  // DATABASE MODULE
  from: vi.fn((tableName: string) => {
    log(`MOCK: from('${tableName}') called`);

    // Special mock for "reports" table
    if (tableName === "reports") {
      return {
        select: vi.fn((columns = "*") => {
          log(`MOCK: reports.select called with columns:`, columns);
          // Return a builder with eq and single that resolves to a mock report
          return {
            eq: vi.fn(function (this: any, column: string, value: any) {
              // Simulate filter, but just return this for chaining
              return this;
            }),
            single: vi.fn(() => {
              const mockReport: MockReportDataType = {
                id: "mock-report-id",
                title: "Título do Relatório Mock",
                summary: "Sumário do relatório mock.",
                markdown_content: "# Conteúdo do relatório em markdown",
                task_id: "mock-task-id",
              };
              return Promise.resolve({
                data: mockReport,
                error: null,
              });
            }),
          };
        }),
        // INSERT operation for reports table
        insert: vi.fn((values: any[] | any) => {
          log(`MOCK: reports.insert called with values:`, values);
          const dataToReturn = Array.isArray(values) ? values : [values];

          dataToReturn.forEach((item, index) => {
            if (!item.id) item.id = `mock-report-id-${index}`;
            if (!item.created_at) item.created_at = new Date().toISOString();
          });

          const builder = {
            select: vi.fn(() => builder),
            single: vi.fn(() => {
              const mockReport: MockReportDataType = {
                id: "mock-db-report-id", // Use the ID expected by the test
                title: values.title || "Mock Report Title",
                summary: values.summary || "Mock Report Summary",
                markdown_content:
                  values.markdown_content || "Mock Markdown Content",
                task_id: values.task_id || "mock-task-id",
                created_at: new Date().toISOString(),
              };
              return Promise.resolve({
                data: mockReport,
                error: null,
              });
            }),
            then: (
              onFulfilled?: (value: any) => any,
              onRejected?: (reason: any) => any
            ) => {
              return Promise.resolve({
                data: dataToReturn,
                error: null,
              }).then(onFulfilled, onRejected);
            },
          };
          return builder;
        }),
      };
    }

    // Default behavior for other tables
    return {
      // SELECT operation
      select: vi.fn((columns = "*") => {
        log(`MOCK: ${tableName}.select called with columns:`, columns);
        return createQueryBuilder();
      }),

      // INSERT operation
      insert: vi.fn((values: any[] | any) => {
        log(`MOCK: ${tableName}.insert called with values:`, values);
        const dataToReturn = Array.isArray(values) ? values : [values];

        // Add IDs and timestamps if not present
        dataToReturn.forEach((item, index) => {
          if (!item.id) item.id = `mock-${tableName}-id-${index}`;
          if (!item.created_at) item.created_at = new Date().toISOString();
        });

        const builder = {
          select: vi.fn(() => builder),
          single: vi.fn(() => {
            return Promise.resolve({
              data: dataToReturn[0] || {},
              error: null,
            });
          }),
          then: (
            onFulfilled?: (value: any) => any,
            onRejected?: (reason: any) => any
          ) => {
            return Promise.resolve({
              data: dataToReturn,
              error: null,
            }).then(onFulfilled, onRejected);
          },
        };

        return builder;
      }),

      // UPDATE operation
      update: vi.fn((values: any) => {
        log(`MOCK: ${tableName}.update called with values:`, values);

        // Add updated_at if not present
        if (!values.updated_at) values.updated_at = new Date().toISOString();

        const builder = {
          eq: vi.fn(() => builder),
          neq: vi.fn(() => builder),
          match: vi.fn(() => builder),
          in: vi.fn(() => builder),
          select: vi.fn(() => builder),
          single: vi.fn(() => {
            return Promise.resolve({
              data: values,
              error: null,
            });
          }),
          then: (
            onFulfilled?: (value: any) => any,
            onRejected?: (reason: any) => any
          ) => {
            return Promise.resolve({
              data: [values],
              error: null,
            }).then(onFulfilled, onRejected);
          },
        };

        return builder;
      }),

      // DELETE operation
      delete: vi.fn(() => {
        log(`MOCK: ${tableName}.delete called`);

        const builder = {
          eq: vi.fn(function (this: any, column: string, value: any) {
            // Accept arguments
            log(`MOCK: ${tableName}.delete.eq called with`, column, value);
            // Simulate adding a filter for consistency, though delete might not use it
            if (this._filters && typeof this._filters.push === "function") {
              this._filters.push({ type: "eq", column, value });
            }
            return this; // Return the builder for chaining
          }),
          neq: vi.fn(function (this: any, column: string, value: any) {
            log(`MOCK: ${tableName}.delete.neq called with`, column, value);
            if (this._filters && typeof this._filters.push === "function") {
              this._filters.push({ type: "neq", column, value });
            }
            return this;
          }),
          match: vi.fn(function (this: any, query: object) {
            log(`MOCK: ${tableName}.delete.match called with`, query);
            if (this._filters && typeof this._filters.push === "function") {
              this._filters.push({
                type: "match",
                column: "multiple",
                value: query,
              });
            }
            return this;
          }),
          in: vi.fn(function (this: any, column: string, values: any[]) {
            log(`MOCK: ${tableName}.delete.in called with`, column, values);
            if (this._filters && typeof this._filters.push === "function") {
              this._filters.push({ type: "in", column, values });
            }
            return this;
          }),
          // Ensure other filter methods used by delete() are also correctly defined if needed
          then: (
            onFulfilled?: (value: any) => any,
            onRejected?: (reason: any) => any
          ) => {
            return Promise.resolve({
              data: [{}],
              error: null,
            }).then(onFulfilled, onRejected);
          },
        };

        return builder;
      }),

      // UPSERT operation
      upsert: vi.fn(
        (values: any[] | any, options?: { onConflict?: string }) => {
          // Added options parameter
          log(
            `MOCK: ${tableName}.upsert called with values:`,
            values,
            "Options:",
            options
          );
          const dataToReturn = Array.isArray(values) ? values : [values];

          // Add IDs and timestamps if not present
          dataToReturn.forEach((item, index) => {
            if (!item.id) item.id = `mock-${tableName}-id-${index}`;
            if (!item.created_at) item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
          });

          const builder = {
            select: vi.fn(() => builder),
            single: vi.fn(() => {
              return Promise.resolve({
                data: dataToReturn[0] || {},
                error: null,
              });
            }),
            then: (
              onFulfilled?: (value: any) => any,
              onRejected?: (reason: any) => any
            ) => {
              return Promise.resolve({
                data: dataToReturn,
                error: null,
              }).then(onFulfilled, onRejected);
            },
          };

          return builder;
        }
      ),

      // RLS Policies
      rpc: vi.fn((functionName: string, params: any = {}) => {
        log(
          `MOCK: ${tableName}.rpc called with function:`,
          functionName,
          params
        );
        return Promise.resolve({
          data: { result: `Mock RPC result for ${functionName}` },
          error: null,
        });
      }),
    };
  }),

  // RPC MODULE
  rpc: vi.fn((functionName: string, params: any = {}) => {
    log(`MOCK: rpc('${functionName}') called with params:`, params);
    return Promise.resolve({
      data: { result: `Mock RPC result for ${functionName}` },
      error: null,
    });
  }),

  // STORAGE MODULE
  storage: {
    from: vi.fn((bucketName: string) => {
      log(`MOCK: storage.from('${bucketName}') called`);
      return createMockStorageBucket(bucketName);
    }),
    // Helper methods at root level
    getBucket: vi.fn((bucketName: string) => {
      return Promise.resolve({
        data: {
          name: bucketName,
          id: `mock-bucket-${bucketName}`,
          public: false,
        },
        error: null,
      });
    }),
    listBuckets: vi.fn(() => {
      return Promise.resolve({
        data: [
          { name: "avatars", id: "mock-bucket-avatars", public: true },
          { name: "documents", id: "mock-bucket-documents", public: false },
        ],
        error: null,
      });
    }),
  },
};

log("TEST_SETUP: mockSupabaseClient defined");

// =====================================
// MOCKS DEFINITION
// =====================================

// Mock Supabase SDK
vi.mock("@supabase/supabase-js", () => {
  log("MOCK: @supabase/supabase-js initialized");
  return {
    createClient: vi.fn(() => mockSupabaseClient),
  };
});

// Mock ofetch to use our central mockFetch
// Using vi.stubGlobal to ensure $fetch is available in the global scope for tests
vi.stubGlobal("$fetch", mockFetch);

vi.mock("ofetch", () => {
  log("MOCK: ofetch initialized to use central mockFetch");
  return {
    $fetch: mockFetch,
    // Add other exports from ofetch if they are used and need mocking (e.g., FetchError, createFetch)
    // For now, just $fetch as it's the one being used directly.
  };
});

// Mock Nuxt Supabase module
vi.mock("@nuxtjs/supabase", async (importOriginal) => {
  log("MOCK: @nuxtjs/supabase initialized");
  const actual = (await importOriginal()) as Record<string, any>;
  return {
    ...actual,
    useSupabaseClient: vi.fn(() => mockSupabaseClient),
    useSupabaseUser: vi.fn(() => ({
      value: {
        id: "test-user-id",
        email: "test@example.com",
        app_metadata: {},
        user_metadata: { name: "Test User" },
      },
    })),
    useSupabaseAuthClient: vi.fn(() => mockSupabaseClient),
  };
});

// Mock Nuxt config
vi.mock("#build/nuxt.config.mjs", async () => {
  log("MOCK: #build/nuxt.config.mjs initialized");
  return {
    appId: "test-app-id-from-setup",
    app: {
      baseURL: "/",
      buildAssetsDir: "/_nuxt/",
      cdnURL: "",
    },
    nitro: {
      routeRules: {},
    },
    runtimeConfig: {
      public: {
        supabase: {
          url: "https://mock-supabase-url.com",
          key: "mock-supabase-key",
        },
      },
    },
  };
});

// Mock Nuxt core package
vi.mock("nuxt", () => {
  log("MOCK: nuxt package initialized");
  return {
    defineNuxtConfig: vi.fn((config) => config),
    getNuxtAppCtx: vi.fn(() => ({ id: "test-app-id" })),
    defineNuxtPlugin: vi.fn((plugin) => plugin),
    useAsyncData: vi.fn((_key, handler) => {
      const result = handler ? handler() : null;
      return Promise.resolve({
        data: { value: result },
        error: { value: null },
        pending: { value: false },
        refresh: vi.fn(),
        execute: vi.fn(),
      });
    }),
    useFetch: vi.fn((url, options) => {
      return Promise.resolve({
        data: { value: { message: "Mock useFetch response" } },
        error: { value: null },
        pending: { value: false },
        refresh: vi.fn(),
        execute: vi.fn(),
      });
    }),
    navigateTo: vi.fn(),
    abortNavigation: vi.fn(),
    addRouteMiddleware: vi.fn(),
    defineNuxtRouteMiddleware: vi.fn((middleware) => middleware),
    useRoute: vi.fn(() => ({
      path: "/mock-path",
      params: {},
      query: {},
      name: "mock-route",
    })),
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      beforeEach: vi.fn(),
      afterEach: vi.fn(),
    })),
  };
});

// Stub the global auto-imported store composable
// Ensure this is active if we want a global mock.
// For now, empathCard.spec.ts will handle its own mocking via vi.mock.
// If a global mock is desired, it would be:
// vi.stubGlobal("useTaskFlowStore", vi.fn(taskFlowStoreFactory));

// =====================================
// GLOBAL PINIA SETUP
// =====================================
const pinia = createPinia();
setActivePinia(pinia);
log("TEST_SETUP: Pinia created and set active globally");

// =====================================
// Test Environment Setup
// =====================================
log("TEST_SETUP: Global setup completed");

// Export anything that might be useful in tests
export { mockSupabaseClient };
export { mockFetch };
