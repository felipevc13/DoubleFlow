<template>
  <div
    :class="[
      'border rounded-lg p-4 flex flex-col analysis-card qualitative-card',
      light
        ? 'bg-white text-gray-900 border-gray-200'
        : 'bg-white/5 text-white border-white/10',
    ]"
  >
    <h3
      :class="[
        'text-base font-semibold mb-4 card-title',
        light ? 'text-gray-900' : 'text-white',
      ]"
    >
      Análise Qualitativa
    </h3>
    <div class="flex-1 card-content">
      <div
        v-if="!insights || insights.length === 0"
        :class="[
          'text-center text-sm italic py-8',
          light ? 'text-gray-400' : 'text-gray-500',
        ]"
      >
        Nenhum insight qualitativo encontrado.
      </div>
      <div v-else class="space-y-4">
        <div
          v-for="(insight, index) in insights"
          :key="index"
          :class="[
            'rounded-md p-3 themed-insight-card',
            light ? 'bg-white' : 'bg-white/5',
          ]"
        >
          <h4
            :class="[
              'font-semibold text-sm themed-insight-title',
              light ? 'text-gray-800' : 'text-white',
            ]"
          >
            {{ insight.theme }}
          </h4>
          <p
            :class="[
              'text-xs mt-1 themed-insight-summary',
              light ? 'text-gray-700' : 'text-gray-300',
            ]"
          >
            "{{ insight.summary }}"
          </p>
          <div
            v-if="
              insight.supportingQuotes && insight.supportingQuotes.length > 0
            "
            class="mt-2 space-y-1"
          >
            <blockquote
              v-for="(quote, qIndex) in insight.supportingQuotes"
              :key="qIndex"
              :class="[
                'text-xs italic pl-3 border-l-2 quote-block',
                light
                  ? 'text-gray-500 border-blue-400'
                  : 'text-gray-400 border-[#60A5FA]',
              ]"
            >
              {{ quote }}
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { ThemedInsight } from "~/types/taskflow";

const props = defineProps({
  insights: {
    type: Array as PropType<ThemedInsight[]>,
    required: true,
  },
  light: {
    type: Boolean,
    default: false,
  },
});
</script>
