<template>
  <div class="w-full">
    <label
      v-if="label"
      :for="id"
      class="block text-sm font-medium text-gray-400 mb-1"
    >
      {{ label }}
    </label>
    <div class="flex w-full">
      <input
        :id="id"
        ref="linkInput"
        type="text"
        :value="link"
        readonly
        class="flex-1 bg-transparent border border-gray-700 rounded-l-md text-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-600 font-mono"
        @focus="selectAllInput"
        @click="selectAllInput"
      />
      <button
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm rounded-r-md font-medium transition min-w-[72px]"
        @click="copyToClipboard"
        :disabled="copied"
        type="button"
      >
        <span v-if="!copied">Copiar</span>
        <span v-else>Copiado!</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  id: string;
  link: string;
  label?: string;
}>();

const copied = ref(false);
const linkInput = ref<HTMLInputElement | null>(null);

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.link);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    // fallback: select and let the user copy manually
    if (linkInput.value) {
      linkInput.value.select();
    }
  }
};

const selectAllInput = (event: FocusEvent) => {
  const target = event.target as HTMLInputElement | null;
  if (target) {
    target.select();
  }
};
</script>
