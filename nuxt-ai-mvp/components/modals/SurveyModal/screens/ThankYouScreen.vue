<template>
  <div
    :class="
      fullscreen
        ? 'flex flex-col items-center justify-center w-full h-full bg-[#fafbfc] py-20 rounded-lg'
        : 'relative flex flex-col w-full h-full bg-[#fafbfc] items-center justify-center px-8'
    "
  >
    <div
      class="w-full max-w-xl bg-white rounded-lg shadow-md p-8 flex flex-col items-stretch"
    >
      <h1
        :class="
          fullscreen
            ? 'text-2xl font-bold text-[#393b4a] mb-4 p-8'
            : 'text-lg font-bold text-[#393b4a] mb-4 p-4'
        "
      >
        {{ title }}
      </h1>
      <pre
        :class="
          fullscreen
            ? 'text-base text-[#6b6c7e] mb-4 whitespace-pre-line break-words px-8'
            : 'text-sm text-[#6b6c7e] mb-4 whitespace-pre-line break-words px-4'
        "
        >{{ description }}</pre
      >
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  block: {
    type: Object,
    required: true,
  },
  fullscreen: {
    type: Boolean,
    default: false,
  },
});

const title = computed(
  () =>
    props.block.title ??
    props.block.data?.title ??
    props.block.extra?.title ?? // Check extra object
    "Obrigado por responder!" // Default
);
const description = computed(
  () =>
    props.block.description ??
    props.block.data?.description ??
    props.block.extra?.description ?? // Check extra object
    "Sua participação é muito importante para nós. Caso queira adicionar mais alguma observação, entre em contato com o pesquisador." // Default
);
</script>
