<template>
  <section
    class="w-full flex flex-col items-center py-12 px-4 md:px-12 bg-[#18181B]"
  >
    <div class="max-w-4xl w-full text-center mb-12">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
        Conheça nossos recursos
      </h2>
      <p class="text-lg md:text-xl text-gray-300">
        Descubra como nossas funcionalidades podem impulsionar sua experiência.
      </p>
    </div>
    <div class="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div
        v-for="(feature, idx) in features"
        :key="idx"
        class="bg-[#23232A] rounded-xl p-8 flex flex-col items-center border border-[#353542] shadow-lg transition hover:scale-[1.03] hover:border-primary-500"
      >
        <div class="w-full flex justify-center mb-6">
          <div
            class="w-20 h-20 flex items-center justify-center bg-[#2d2d38] rounded-lg overflow-hidden border border-[#353542]"
          >
            <template v-if="feature.visual">
              <img
                v-if="isImage(feature.visual)"
                :src="feature.visual"
                alt="Visual da feature"
                class="object-contain w-full h-full"
                loading="lazy"
              />
              <video
                v-else-if="isVideo(feature.visual)"
                :src="feature.visual"
                class="object-contain w-full h-full"
                autoplay
                muted
                loop
                playsinline
              />
              <span v-else class="text-gray-500 text-xs">Visual</span>
            </template>
            <template v-else>
              <svg
                class="w-8 h-8 text-gray-500"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </template>
          </div>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2 text-center">
          {{ feature.title }}
        </h3>
        <p class="text-gray-300 text-base text-center">
          {{ feature.description }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  features: {
    type: Array,
    required: true,
    default: () => [],
  },
});

function isImage(src) {
  return typeof src === "string" && /\.(jpe?g|png|gif|webp|svg)$/i.test(src);
}
function isVideo(src) {
  return typeof src === "string" && /\.(mp4|webm|ogg)$/i.test(src);
}
</script>

<style scoped>
/* Nenhum estilo adicional necessário, todo o layout usa Tailwind */
</style>
