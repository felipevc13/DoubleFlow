import { defineStore } from "pinia";

// Interface for the sidenav store state
interface SidenavState {
  isCollapsed: boolean;
}

export const useSidenavStore = defineStore("sidenav", {
  state: (): SidenavState => ({
    isCollapsed: false, // Estado inicial: sidebar expandida
  }),
  actions: {
    toggleSidebar(): void {
      this.isCollapsed = !this.isCollapsed;
      // Persistir o estado no localStorage
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          "sidebarCollapsed",
          JSON.stringify(this.isCollapsed)
        );
      }
    },
    initializeSidebar(): void {
      // Carregar o estado do localStorage ao inicializar
      if (typeof localStorage !== "undefined") {
        const savedState = localStorage.getItem("sidebarCollapsed");
        if (savedState !== null) {
          try {
            this.isCollapsed = JSON.parse(savedState);
          } catch (e) {
            console.error(
              "Error parsing sidebarCollapsed state from localStorage",
              e
            );
            // Optionally reset to a default state or remove the invalid item
            localStorage.removeItem("sidebarCollapsed");
            this.isCollapsed = false;
          }
        }
      }
    },
  },
});
