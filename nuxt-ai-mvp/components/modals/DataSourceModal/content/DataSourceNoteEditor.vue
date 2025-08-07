<template>
  <div class="data-source-note-editor flex flex-col h-full">
    <!-- Input para o Título -->
    <input
      type="text"
      :value="title"
      @input="$emit('update:title', $event.target.value)"
      placeholder="Título da Nota"
      class="bg-transparent text-white text-md outline-none rounded-t-lg border border-[#343434] w-full px-6 py-4"
    />

    <!-- Editor TipTap para o Conteúdo -->
    <TipTapEditor
      :modelValue="content"
      @update:modelValue="$emit('update:content', $event)"
      placeholder="Digite sua nota rápida aqui..."
      class="flex-grow"
    />
  </div>
</template>

<script setup>
import TipTapEditor from "../../../editor/TipTapEditor.vue";

const props = defineProps({
  title: {
    type: String,
    default: "",
  },
  content: {
    type: [Object, String, null],
    default: null,
  },
});

const emit = defineEmits(["update:title", "update:content"]);

// No additional logic needed here for basic v-model binding
</script>

<style scoped></style>
