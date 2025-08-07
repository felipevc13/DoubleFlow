<template>
  <div
    class="flex flex-col items-center justify-center w-full h-full bg-[#fafbfc] py-12 px-8 rounded-lg"
  >
    <div
      :class="
        fullscreen
          ? 'w-full max-w-xl bg-white rounded-lg shadow-md p-8 flex flex-col items-stretch gap-8'
          : 'w-full max-w-xl bg-white rounded-lg shadow-md p-4 flex flex-col items-stretch gap-4'
      "
    >
      <h1
        :class="
          fullscreen
            ? 'text-2xl font-bold text-[#393b4a]'
            : 'text-lg font-bold text-[#393b4a]'
        "
      >
        {{ title }}
      </h1>
      <pre
        :class="
          fullscreen
            ? 'text-base text-[#6b6c7e] whitespace-pre-line break-words '
            : 'text-sm text-[#6b6c7e] whitespace-pre-line break-words'
        "
        >{{ description }}</pre
      >
      <!-- LOG DE DEBUG -->

      <button
        v-if="fullscreen"
        class="mb-2 bg-white text-[#4d6bfe] border-2 border-[#4d6bfe] rounded-lg py-2 px-4 text-lg font-semibold w-full shadow-sm hover:bg-[#f0f3ff] transition"
        @click="$emit('next')"
      >
        Começar →
      </button>
      <button
        v-else
        class="bg-white text-[#4d6bfe] border-2 border-[#4d6bfe] rounded-lg py-2 px-4 text-sm font-medium cursor-not-allowed w-full shadow-sm"
        disabled
        aria-disabled="true"
      >
        Começar →
      </button>
      <p class="text-xs text-[#b0b1be]">
        Ao participar deste estudo, concordo com a Política de Privacidade
      </p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: "You've been invited to participate in a study.",
  },
  description: {
    type: String,
    default:
      "Your feedback matters. Please do whatever your intuition tells you to, and, remember:",
  },
  fullscreen: {
    type: Boolean,
    required: true,
  },
});
</script>
