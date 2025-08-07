<template>
  <Teleport :to="teleportTarget">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="absolute inset-0 z-[30] flex items-center justify-center p-6 bg-black bg-opacity-70"
        @click.self="handleBackdropClick"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="
          $slots.header && title ? 'base-modal-title-slot' : undefined
        "
      >
        <div
          :class="[
            'base-modal-container flex flex-col bg-[#171717] border border-[#343434] rounded-lg shadow-xl text-white overflow-hidden relative',
            modalSizeClass,
            modalContainerClass,
          ]"
          ref="modalContentRef"
        >
          <!-- Loading overlay -->
          <div
            v-if="isLoading"
            class="absolute inset-0 bg-[#171717] bg-opacity-90 flex flex-col items-center justify-center z-20 rounded-lg p-6"
          >
            <slot name="loading">
              <svg
                class="animate-spin h-8 w-8 text-blue-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                ></path>
              </svg>
              <p class="mt-3 text-sm text-white">{{ loadingText }}</p>
            </slot>
          </div>

          <!-- Error overlay -->
          <div
            v-else-if="errorMessage && !isLoading"
            class="absolute inset-0 bg-[#171717] bg-opacity-95 flex flex-col items-center justify-center z-20 rounded-lg p-6 text-center"
          >
            <slot name="error">
              <div
                class="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative max-w-md"
                role="alert"
              >
                <strong class="font-bold">Erro!</strong>
                <p class="block sm:inline">{{ errorMessage }}</p>
              </div>
            </slot>
          </div>

          <!-- Modal content (header, body, footer) -->
          <div
            :class="[
              'flex flex-col flex-1 min-h-0 h-full',
              modalSizeClass,
              contentWrapperClass,
            ]"
            v-if="!isLoading && !errorMessage"
          >
            <!-- Header: slot ou default -->
            <div
              v-if="$slots.header"
              class="base-modal-header flex-shrink-0"
              role="heading"
              aria-level="1"
            >
              <slot name="header"></slot>
            </div>
            <div
              v-else-if="!hideDefaultHeader"
              class="base-modal-header flex items-center justify-between px-6 py-4 border-b border-[#343434] flex-shrink-0"
              role="heading"
              aria-level="1"
            >
              <h2
                :id="title ? 'base-modal-title-slot' : undefined"
                class="text-lg font-semibold text-white truncate"
              >
                {{ title }}
              </h2>
              <button
                @click="closeModal"
                class="text-[#A0A0A0] hover:text-white transition-colors p-1 -mr-1"
                aria-label="Fechar modal"
              >
                <CloseIcon class="h-5 w-5" />
              </button>
            </div>

            <!-- Body (default slot) -->
            <div
              :class="[
                'base-modal-body h-full min-h-0 flex-1 overflow-y-auto',
                bodyClass,
              ]"
            >
              <slot></slot>
            </div>

            <!-- Footer: slot ou default -->
            <div v-if="$slots.footer" class="base-modal-footer flex-shrink-0">
              <slot name="footer"></slot>
            </div>
            <div
              v-else-if="!hideDefaultFooter"
              class="base-modal-footer flex justify-end items-center px-6 py-4 border-t border-[#343434] flex-shrink-0 gap-3 min-h-[68px]"
            ></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from "vue";
import CloseIcon from "~/components/icon/CloseIcon.vue";

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  title: { type: String, default: "" },
  size: { type: String, default: "viewport-fill" },
  closeOnBackdropClick: { type: Boolean, default: true },
  closeOnEsc: { type: Boolean, default: true },
  isLoading: { type: Boolean, default: false },
  loadingText: { type: String, default: "Carregando..." },
  errorMessage: { type: String, default: null },
  hideDefaultHeader: { type: Boolean, default: true },
  hideDefaultFooter: { type: Boolean, default: true },
  modalContainerClass: { type: String, default: "" },
  contentWrapperClass: { type: String, default: "" },
  bodyClass: { type: String, default: "" },
});

// Teleport target: use #modal-container if present, otherwise fallback to body
const teleportTarget = computed(() =>
  document.getElementById("modal-container") ? "#modal-container" : "body"
);

// Declare both 'close' and 'save' so Vue won't warn when @save is used upstream
const emit = defineEmits(["close", "save"]);

const modalContentRef = ref<HTMLElement | null>(null);

const modalSizeClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "max-w-lg w-full min-h-[200px] max-h-[80vh]";
    case "md":
      return "max-w-xl w-full min-h-[300px] max-h-[80vh]";
    case "lg":
      return "max-w-3xl w-full min-h-[400px] max-h-[80vh]";
    case "xl":
      return "max-w-5xl w-full min-h-[500px] max-h-[85vh]";
    case "viewport-fill":
      // Preenche totalmente a área do wrapper (que já exclui SideNav/AgentSidebar),
      // sem ultrapassar para fora nem colar nas bordas internas
      return "w-full h-full max-w-full max-h-full min-h-[300px]";
    case "fullscreen":
      return "w-screen h-screen max-w-none max-h-none rounded-none !border-0";
    default:
      return "w-[95vw] h-[95vh] min-h-[300px]";
  }
});

// Modal close handlers
function closeModal() {
  emit("close");
}
function handleBackdropClick() {
  if (props.closeOnBackdropClick) closeModal();
}
function handleEscKey(event: KeyboardEvent) {
  if (props.isOpen && props.closeOnEsc && event.key === "Escape") closeModal();
}

// Escape key listener
onMounted(() => {
  document.addEventListener("keydown", handleEscKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleEscKey);
});

// Focus trap: (simplificado, só volta foco pro modal se perder)
watch(
  () => props.isOpen,
  (open) => {
    if (open) setTimeout(() => modalContentRef.value?.focus(), 100);
  }
);
</script>

<style scoped>
.base-modal-container {
  max-height: 95vh;
  display: flex;

  flex-direction: column;
  position: relative;
}
.base-modal-body::-webkit-scrollbar {
  width: 6px;
}
.base-modal-body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}
.base-modal-body::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 3px;
}
.base-modal-body::-webkit-scrollbar-thumb:hover {
  background-color: #718096;
}
.base-modal-body {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 rgba(255, 255, 255, 0.05);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .base-modal-container,
.modal-fade-leave-active .base-modal-container {
  transition: transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
}
.modal-fade-enter-from .base-modal-container,
.modal-fade-leave-to .base-modal-container {
  transform: scale(0.98) translateY(5px);
  opacity: 0;
}
</style>
