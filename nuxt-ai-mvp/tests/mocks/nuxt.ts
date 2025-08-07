import { vi } from "vitest"; // Added import for vi

// Mock implementation of nuxt.js
// Este arquivo serve como mock para quando o Vitest tentar importar "nuxt/dist/app/nuxt.js"

// Basic mock for NuxtApp type
export interface NuxtApp {
  provide: (name: string, value: any) => void;
  vueApp: {
    directive: (name: string, directive: any) => void;
    component: (name: string, component: any) => void;
    use: (plugin: any, options?: any) => void;
  };
  _instance?: {
    setupState: Record<string, any>;
  };
  $toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
  // Add other properties/methods if your plugins/tests need them
}

export const useNuxtApp = (): NuxtApp => ({
  vueApp: {
    directive: vi.fn(),
    component: vi.fn(),
    use: vi.fn(),
  },
  provide: vi.fn(),
  _instance: { setupState: {} },
  $toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
});

export const defineNuxtPlugin = (
  callback: (nuxtApp: NuxtApp) => void | Promise<void>
) => {
  // For mocking, we primarily care about the signature for type checking.
  // The actual execution might not be relevant or can be a simple pass-through.
  return callback;
};

export const useRuntimeConfig = () => ({
  public: {
    supabase: {
      url: "http://localhost:54321/test",
      key: "mock_key",
    },
  },
});

export const defineNuxtRouteMiddleware = () => {};
export const useRoute = () => ({});
export const navigateTo = () => {};
export const abortNavigation = () => {};
export const addRouteMiddleware = () => {};
export const getNuxtAppCtx = () => ({ id: "test-app-id" });

export const $fetch = Object.assign(vi.fn(), {
  raw: vi.fn(),
  create: vi.fn(),
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
});
export const useFetch = vi.fn();

// Export default é necessário para que o módulo seja compatível com ESM
export default {};
