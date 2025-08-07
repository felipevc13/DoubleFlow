<template>
  <div
    class="empty-state-card-content flex flex-col items-center justify-center text-center h-full p-4"
  >
    <div v-if="iconComponent" class="mb-4">
      <component
        :is="iconComponent"
        class="w-12 h-12 text-gray-500"
        aria-hidden="true"
      />
    </div>
    <p v-if="message" class="text-gray-400 text-sm mb-4 leading-relaxed">
      {{ message }}
    </p>
    <p v-if="subMessage" class="text-gray-500 text-xs mb-6 italic">
      {{ subMessage }}
    </p>
    <button
      v-if="buttonText"
      @click="$emit('action-clicked')"
      class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#2C2B30]"
      :aria-label="buttonText"
    >
      <!-- Ícone opcional para o botão -->
      <svg
        v-if="showButtonIcon"
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 mr-1"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
      {{ buttonText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { type Component } from "vue";

defineProps({
  message: {
    type: String,
    default: "Nenhum item para exibir no momento.",
  },
  subMessage: {
    // Mensagem secundária, menor e opcional
    type: String,
    default: "",
  },
  buttonText: {
    type: String,
    default: "", // Se vazio, o botão não aparece
  },
  iconComponent: {
    // Prop para passar um componente de ícone dinamicamente
    type: Object as () => Component | null,
    default: null,
  },
  showButtonIcon: {
    // Controla a exibição do ícone "+" no botão
    type: Boolean,
    default: true,
  },
});

defineEmits(["action-clicked"]);
</script>

<style scoped>
/* Estilos adicionais podem ser colocados aqui se necessário,
   mas a ideia é usar o máximo possível de classes Tailwind. */
.empty-state-card-content {
  /* Garante que, se este componente for o único filho
     e o pai for flex, ele possa ocupar o espaço vertical. */
  min-height: 100px; /* Uma altura mínima para garantir visibilidade */
}
</style>
