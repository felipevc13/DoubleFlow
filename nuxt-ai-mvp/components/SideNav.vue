<!-- components/SideNav.vue -->
<template>
  <aside
    :class="[
      sidenavStore.isCollapsed ? 'w-[72px]' : 'w-[234px]',
      'bg-[#171717] text-white py-6 px-4 h-screen fixed top-0 left-0 flex flex-col border-r border-r-[#393939] transition-all duration-300',
    ]"
  >
    <!-- Title -->
    <div
      :class="
        sidenavStore.isCollapsed
          ? 'flex flex-col items-center'
          : 'flex w-full justify-between items-start'
      "
    >
      <div :class="sidenavStore.isCollapsed ? 'mb-8' : 'mb-8 w-auto'">
        <NuxtLink to="/" class="flex items-center justify-center">
          <Logo />
          <h2 v-if="!sidenavStore.isCollapsed" class="text-xl ml-1 font-light">
            DoubleFlow
          </h2>
        </NuxtLink>
      </div>
      <CloseSide
        v-if="!sidenavStore.isCollapsed"
        @click="sidenavStore.toggleSidebar"
      />
      <OpenSide v-else @click="sidenavStore.toggleSidebar" />
    </div>

    <!-- New Task Button -->
    <div :class="sidenavStore.isCollapsed ? 'mb-4 mt-4' : 'mb-4'">
      <button
        @click="$emit('open-task-form')"
        class="btn bg-[#4D6BFE] rounded-[8px] flex items-center justify-center w-full"
      >
        <span v-if="!sidenavStore.isCollapsed">Nova tarefa</span>
        <span v-else class="text-2xl">+</span>
      </button>
    </div>

    <!-- Task List -->
    <div class="flex-1 overflow-y-auto">
      <TaskList v-if="!sidenavStore.isCollapsed" :current-route="route.path" />
    </div>

    <!-- Botão temporário de deslogar -->
    <div class="mt-2">
      <button
        v-if="user"
        @click="handleLogout"
        class="flex items-center space-x-2 text-gray-300 hover:bg-white/10 px-2 py-2 rounded-[8px] w-full justify-start"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"
          />
        </svg>
        <span v-if="!sidenavStore.isCollapsed">
          <p class="text-sm">Sair</p>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from "vue-router";
import { useSidenavStore } from "../stores/sidenav"; // Importar a nova store
import Logo from "./icon/Logo.vue";
import CloseSide from "./icon/CloseSide.vue";
import OpenSide from "./icon/OpenSide.vue";
import { BookOpenIcon } from "@heroicons/vue/24/outline";
import { onMounted } from "vue";
import { useSupabaseUser } from "#imports";

const route = useRoute();
const sidenavStore = useSidenavStore();
const user = useSupabaseUser(); // Get the ref, access .value where needed
const supabase = useSupabaseClient(); // Use the composable

async function handleLogout() {
  if (user.value) {
    // Check if user exists before signing out
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
}

// Inicializar o estado da sidebar ao carregar o componente
onMounted(() => {
  sidenavStore.initializeSidebar();
});

defineEmits(["open-task-form"]);
</script>
