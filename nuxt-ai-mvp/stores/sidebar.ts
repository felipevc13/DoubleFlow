import { defineStore } from "pinia";

// Define sidebar types using a const object for better compatibility with auto-imports
export const SidebarType = {
  PROBLEM: "problem",
  ADD_NODE: "addNode",
  AGENT: "agent",
  // Add other sidebar types here as needed
} as const; // Use 'as const' for stricter typing

// Derive the type from the const object's values
export type SidebarType = (typeof SidebarType)[keyof typeof SidebarType];

// Interface for the data within each specific sidebar
// 'any' can be replaced with more specific types if the data structures are known
type SidebarSpecificData = any;

// Interface for a full node object (can be generic or more specific if possible)
// Since it's not reliably persisted, keeping it flexible or null.
type NodeObject = any | null;
type NodeId = string | null;

interface SingleSidebarState {
  isOpen: boolean;
  data: SidebarSpecificData | null;
  node: NodeObject; // Full node object, not persisted reliably
  nodeId: NodeId; // Store the ID separately for persistence
}

// Interface for the main sidebar state
interface SidebarState {
  activeSidebar: SidebarType | null;
  defaultSidebar: SidebarType;
  sidebars: {
    [key in SidebarType]?: SingleSidebarState; // Use mapped type for known sidebars
  } & {
    [key: string]: SingleSidebarState | undefined; // Allow for dynamic but typed sidebars
  };
}

// Interface for the state saved to localStorage (only persistable parts)
interface SavedSidebarEntry {
  isOpen: boolean;
  data: SidebarSpecificData | null;
  nodeId: NodeId;
}
interface SavedState {
  activeSidebar: SidebarType | null;
  sidebars: {
    [key: string]: SavedSidebarEntry | undefined;
  };
}

export const useSidebarStore = defineStore("sidebar", {
  state: (): SidebarState => ({
    activeSidebar: null,
    defaultSidebar: SidebarType.AGENT,
    sidebars: {
      // Use the const object values for keys
      [SidebarType.PROBLEM]: {
        isOpen: false,
        data: null,
        node: null,
        nodeId: null,
      },
      [SidebarType.ADD_NODE]: {
        isOpen: false,
        data: null,
        node: null,
        nodeId: null,
      },
      [SidebarType.AGENT]: {
        isOpen: false,
        data: null,
        node: null,
        nodeId: null,
      },
      // Initialize other known sidebar types here
    },
  }),

  actions: {
    openSidebar(
      type: SidebarType,
      data: SidebarSpecificData = null,
      node: NodeObject = null
    ): void {
      const currentSidebarState = this.sidebars[type];
      const currentData = currentSidebarState?.data;
      const newData =
        data !== undefined && data !== null
          ? data
          : this.activeSidebar === type
          ? currentData
          : null;
      // const currentNode = node || (this.activeSidebar === type ? currentSidebarState?.node : null);

      // Ensure the sidebar type exists in the state before trying to modify it
      if (!this.sidebars[type]) {
        // If it's a new, dynamically added sidebar type, initialize it
        this.sidebars[type] = {
          isOpen: false, // Will be set to true below
          data: null,
          node: null,
          nodeId: null,
        };
      }

      const targetSidebar = this.sidebars[type]!; // Assert non-null after check/init

      targetSidebar.isOpen = true;
      targetSidebar.data = newData ? { ...newData } : null;
      targetSidebar.node = node; // Store the full node temporarily
      targetSidebar.nodeId = node?.id || null; // Explicitly store the ID

      this.activeSidebar = type;
      this.saveSidebarState();
    },

    updateSidebarData(type: SidebarType, data: SidebarSpecificData): void {
      const targetSidebar = this.sidebars[type];
      if (targetSidebar && data) {
        targetSidebar.data = { ...data };
        this.saveSidebarState();
      }
    },

    closeSidebar(type: SidebarType): void {
      const targetSidebar = this.sidebars[type];
      if (targetSidebar) {
        targetSidebar.isOpen = false;
        // targetSidebar.data = null; // Optional: clear data
        // targetSidebar.node = null;  // Optional: clear node
      }
      if (this.activeSidebar === type) {
        this.activeSidebar = null;
      }
      this.saveSidebarState();
    },

    closeAllSidebars(): void {
      Object.keys(this.sidebars).forEach((key) => {
        const sidebarKey = key as SidebarType; // Cast key to SidebarType
        const targetSidebar = this.sidebars[sidebarKey];
        if (targetSidebar) {
          targetSidebar.isOpen = false;
          // targetSidebar.data = null;
          // targetSidebar.node = null;
        }
      });
      this.activeSidebar = null;
      this.saveSidebarState();
    },

    toggleSidebar(
      type: SidebarType,
      data: SidebarSpecificData = null,
      node: NodeObject = null
    ): void {
      if (this.activeSidebar === type) {
        this.closeAllSidebars();
      } else {
        this.openSidebar(type, data, node);
      }
    },

    initializeSidebar(): void {
      if (typeof localStorage === "undefined") return; // Guard for SSR
      try {
        const savedStateString = localStorage.getItem("sidebarState");
        if (savedStateString) {
          const state: SavedState = JSON.parse(savedStateString);

          this.activeSidebar = state.activeSidebar || null;

          if (state.sidebars) {
            Object.keys(state.sidebars).forEach((key) => {
              const sidebarKey = key as SidebarType;
              const savedEntry = state.sidebars[sidebarKey];
              if (savedEntry) {
                if (!this.sidebars[sidebarKey]) {
                  // Initialize if not present
                  this.sidebars[sidebarKey] = {
                    isOpen: false,
                    data: null,
                    node: null,
                    nodeId: null,
                  };
                }
                const targetSidebar = this.sidebars[sidebarKey]!;
                targetSidebar.isOpen = savedEntry.isOpen || false;
                targetSidebar.data = savedEntry.data
                  ? { ...savedEntry.data }
                  : null;
                targetSidebar.nodeId = savedEntry.nodeId || null;
                targetSidebar.node = null; // Reset full node object
              }
            });
          }
        }
      } catch (error: any) {
        console.error(
          "❌ [SidebarStore] Erro ao restaurar estado:",
          error.message
        );
        localStorage.removeItem("sidebarState");
        this.activeSidebar = null;
        Object.keys(this.sidebars).forEach((key) => {
          const sidebarKey = key as SidebarType;
          const targetSidebar = this.sidebars[sidebarKey];
          if (targetSidebar) {
            targetSidebar.isOpen = false;
            targetSidebar.data = null;
            targetSidebar.node = null;
            targetSidebar.nodeId = null;
          }
        });
      }
    },

    saveSidebarState(): void {
      if (typeof localStorage === "undefined") return; // Guard for SSR
      try {
        const stateToSave: SavedState = {
          activeSidebar: this.activeSidebar,
          sidebars: {},
        };
        Object.keys(this.sidebars).forEach((key) => {
          const sidebarKey = key as SidebarType;
          const currentSidebar = this.sidebars[sidebarKey];
          if (currentSidebar) {
            stateToSave.sidebars[sidebarKey] = {
              isOpen: this.activeSidebar === sidebarKey, // Only active is truly "open" for persistence logic here
              data: currentSidebar.data,
              nodeId: currentSidebar.nodeId,
            };
          }
        });
        localStorage.setItem("sidebarState", JSON.stringify(stateToSave));
      } catch (error: any) {
        console.error(
          "❌ [SidebarStore] Erro ao salvar estado:",
          error.message
        );
      }
    },
  },

  getters: {
    isSidebarOpen:
      (state: SidebarState) =>
      (type: SidebarType): boolean =>
        state.activeSidebar === type,

    getSidebarData:
      (state: SidebarState) =>
      (type: SidebarType): SidebarSpecificData | null =>
        state.sidebars[type]?.data || null,

    getSidebarNode:
      (state: SidebarState) =>
      (type: SidebarType): NodeObject =>
        state.sidebars[type]?.node || null,

    getSidebarNodeId:
      (state: SidebarState) =>
      (type: SidebarType): NodeId =>
        state.sidebars[type]?.nodeId || null,

    activeSidebarType: (state: SidebarState): SidebarType | null =>
      state.activeSidebar,

    activeSidebarProps: (state: SidebarState): Partial<SingleSidebarState> => {
      if (!state.activeSidebar || !state.sidebars[state.activeSidebar]) {
        return {};
      }
      const activeType = state.activeSidebar;
      const activeSidebarData = state.sidebars[activeType];
      return {
        data: activeSidebarData?.data,
        node: activeSidebarData?.node,
        nodeId: activeSidebarData?.nodeId,
      };
    },
  },
});
