<template>
  <BaseModal
    :is-open="isOpen"
    size="sm"
    :title="title"
    :hide-default-header="false"
    :hide-default-footer="true"
    @close="$emit('close')"
  >
    <!-- Corpo do Modal -->
    <div class="p-6">
      <div class="flex items-start gap-4">
        <div
          class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10"
        >
          <ExclamationTriangleIcon
            class="h-6 w-6 text-red-400"
            aria-hidden="true"
          />
        </div>
        <div class="text-left">
          <h3
            class="text-base font-semibold leading-6 text-white"
            id="modal-title"
          >
            {{ title }}
          </h3>
          <div class="mt-2">
            <p class="text-sm text-gray-400">
              {{ message }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer com Ações -->
    <div class="flex justify-end gap-3 px-6 py-4 bg-[#232227] rounded-b-lg">
      <button
        @click="$emit('close')"
        type="button"
        class="btn btn-sm btn-ghost"
        :disabled="isLoading"
      >
        Cancelar
      </button>
      <button
        @click="$emit('confirm')"
        type="button"
        class="btn btn-sm btn-error"
        :disabled="isLoading"
      >
        <span
          v-if="isLoading"
          class="loading loading-spinner loading-xs"
        ></span>
        {{ isLoading ? "Excluindo..." : "Sim, excluir" }}
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { ExclamationTriangleIcon } from "@heroicons/vue/24/outline";

defineProps({
  isOpen: { type: Boolean, required: true },
  isLoading: { type: Boolean, default: false },
  title: { type: String, default: "Confirmar Exclusão" },
  message: {
    type: String,
    default:
      "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
  },
});

defineEmits(["close", "confirm"]);
</script>
