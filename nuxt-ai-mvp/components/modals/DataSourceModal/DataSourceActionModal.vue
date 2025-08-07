<template>
  <BaseModal :is-open="isOpen" size="sm" @close="close">
    <!-- Corpo do modal -->
    <template #default>
      <div class="px-6 py-5">
        <h3 class="text-base font-semibold mb-3">Ações para a Fonte</h3>
        <p class="text-sm text-gray-300 break-all">
          Fonte selecionada:
          <span class="font-medium text-white break-all">
            {{
              sourceData?.name || sourceData?.id || "Nenhuma fonte selecionada"
            }}
          </span>
        </p>
      </div>
    </template>

    <!-- Footer -->
    <template #footer>
      <div class="flex justify-end gap-3 px-6 py-4">
        <button @click="close" class="btn btn-sm btn-ghost">Cancelar</button>
        <button @click="confirmDelete" class="btn btn-sm btn-error">
          Deletar Fonte
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import BaseModal from "~/components/modals/BaseModal.vue";

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  sourceData: { type: Object, default: null },
});

const emit = defineEmits(["close", "confirm-delete"]);

const close = () => emit("close");

const confirmDelete = () => {
  if (props.sourceData?.id) {
    emit("confirm-delete", props.sourceData.id);
  }
  emit("close");
};
</script>
