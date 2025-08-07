import { defineStore } from "pinia";

// Interface for the loading store state
interface LoadingState {
  isLoading: boolean;
}

export const useLoadingStore = defineStore("loading", {
  state: (): LoadingState => ({
    isLoading: false, // Start as false initially
  }),
  actions: {
    setLoading(status: boolean): void {
      this.isLoading = status;
    },
    startLoading(): void {
      this.setLoading(true);
    },
    stopLoading(): void {
      this.setLoading(false);
    },
  },
  // persist: true // Optional: uncomment if you need loading state persistence across sessions
});
