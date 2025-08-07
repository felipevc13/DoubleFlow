import { defineStore } from "pinia";
import { ref } from "vue";

export const useConnectionControlStore = defineStore(
  "connectionControl",
  () => {
    const lastInteractionWasSimpleClickOnSource = ref(false);

    const dragInProgress = ref(false);

    function setDragInProgress(value: boolean) {
      dragInProgress.value = value;
    }

    function setLastInteractionWasSimpleClickOnSource(value: boolean) {
      lastInteractionWasSimpleClickOnSource.value = value;
    }

    function consumeLastInteractionWasSimpleClickOnSource() {
      const value = lastInteractionWasSimpleClickOnSource.value;
      // NÃO resete aqui! O reset agora deve ser feito manualmente após popup/contexto.
      // if (value) {
      //   lastInteractionWasSimpleClickOnSource.value = false;
      // }
      return value;
    }

    return {
      lastInteractionWasSimpleClickOnSource,
      setLastInteractionWasSimpleClickOnSource,
      consumeLastInteractionWasSimpleClickOnSource,
      dragInProgress,
      setDragInProgress,
    };
  }
);
