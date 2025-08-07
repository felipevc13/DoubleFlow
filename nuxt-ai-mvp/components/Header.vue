<!-- components/Header.vue -->
<template>
  <header
    class="bg-transparent text-white py-6 px-4 flex items-center justify-center top-0 left-0 w-full z-10 h-[72px] relative"
  >
    <!-- Task Title -->
    <h1
      class="text-lg font-medium tracking-tight bg-[#1a1a1a] px-4 py-1 rounded-lg"
    >
      {{ taskName }}
    </h1>

    <!-- Actions (Menu Icon) -->
    <div class="absolute right-4 flex items-center">
      <div class="dropdown dropdown-end">
        <label
          tabindex="0"
          class="btn btn-ghost btn-square border-[#7E8692] hover:border-[#4D6BFE] bg-transparent"
        >
          <div class="p-2 shadow-md">
            <EllipsisVerticalIcon class="w-5 h-5 text-white" />
          </div>
        </label>
        <ul
          tabindex="0"
          class="menu menu-sm dropdown-content mt-3 p-2 shadow bg-[#1e1e1e] text-white rounded-box w-52 border border-[#393939]"
        >
          <li>
            <button
              @click="$emit('rename')"
              class="text-gray-300 hover:text-white"
            >
              <PencilIcon class="w-4 h-4" />
              Renomear
            </button>
          </li>
          <li>
            <button
              @click="$emit('delete')"
              class="text-red-400 hover:text-red-300"
            >
              <TrashIcon class="w-4 h-4" />
              Excluir
            </button>
          </li>
        </ul>
      </div>
    </div>
  </header>
</template>

<script setup>
import {
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";

defineProps({
  taskName: {
    type: String,
    required: true,
  },
});

defineEmits(["rename", "delete"]);
</script>
