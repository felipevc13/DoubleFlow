<template>
  <div class="overflow-x-auto bg-[#2C2B30] rounded-lg border border-[#393939]">
    <table class="table table-zebra w-full">
      <thead>
        <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
          <th
            v-for="header in headerGroup.headers"
            :key="header.id"
            @click="header.column.getToggleSortingHandler()?.($event)"
            class="cursor-pointer select-none"
          >
            <template v-if="!header.isPlaceholder">
              {{ header.column.columnDef.header }}
              <span v-if="header.column.getIsSorted() === 'asc'"> 🔼</span>
              <span v-if="header.column.getIsSorted() === 'desc'"> 🔽</span>
            </template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in table.getRowModel().rows" :key="row.id" class="hover">
          <td v-for="cell in row.getVisibleCells()" :key="cell.id">
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
          </td>
        </tr>
      </tbody>
    </table>
    <div class="flex items-center justify-end gap-2 p-4">
      <button class="btn btn-sm" @click="table.setPageIndex(0)" :disabled="!table.getCanPreviousPage()">«</button>
      <button class="btn btn-sm" @click="table.previousPage()" :disabled="!table.getCanPreviousPage()">‹</button>
      <span class="text-sm">
        Página {{ table.getState().pagination.pageIndex + 1 }} de {{ table.getPageCount() }}
      </span>
      <button class="btn btn-sm" @click="table.nextPage()" :disabled="!table.getCanNextPage()">›</button>
      <button class="btn btn-sm" @click="table.setPageIndex(table.getPageCount() - 1)" :disabled="!table.getCanNextPage()">»</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  FlexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/vue-table';

const props = defineProps<{
  data: any[];
  columns: ColumnDef<any>[];
  pageSize?: number;
}>();

const sorting = ref<SortingState>([]);

const table = useVueTable({
  get data() { return props.data },
  get columns() { return props.columns },
  state: {
    get sorting() { return sorting.value },
  },
  onSortingChange: (updater: any) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: {
      pageSize: props.pageSize || 10,
    },
  },
});
</script>

<style scoped>
.table th {
  background-color: #232227;
  color: #e2e8f0;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.table td {
  border-color: #393939;
  color: #e2e8f0;
}

.table-zebra tbody tr:nth-child(odd) td {
  background-color: #2c2b30;
}

.table-zebra tbody tr:nth-child(even) td {
  background-color: #26252a;
}

.btn {
  background-color: #3a3940;
  border-color: #4a4950;
  color: #e5e7eb;
}

.btn:hover {
  background-color: #4a4950;
  border-color: #5a5960;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
