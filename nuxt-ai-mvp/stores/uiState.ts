// stores/uiState.ts
import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStateStore = defineStore("uiState", () => {
  const closeContextualPopupsTrigger = ref(0);

  function triggerCloseContextualPopups() {
    closeContextualPopupsTrigger.value++;
  }

  return {
    closeContextualPopupsTrigger,
    triggerCloseContextualPopups,
  };
});
