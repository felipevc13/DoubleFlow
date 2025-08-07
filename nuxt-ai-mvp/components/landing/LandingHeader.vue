<template>
  <header
    class="w-full bg-[#171717] px-6 py-4 flex items-center justify-between shadow-sm border-b border-[#232323]"
  >
    <NuxtLink to="/" class="flex items-center gap-2">
      <!-- Substitua pelo componente/logo real caso exista -->
      <img src="/logo.svg" alt="DoubleFlow Logo" class="w-10 h-10" />
      <span class="text-2xl font-light text-white">DoubleFlow</span>
    </NuxtLink>
    <NuxtLink
      to="/register"
      class="btn btn-primary bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold hover:bg-blue-700 transition"
    >
      Comece a usar de graça
    </NuxtLink>
  </header>
</template>

<script setup>
// Nenhuma lógica específica necessária para este header simples
</script>
