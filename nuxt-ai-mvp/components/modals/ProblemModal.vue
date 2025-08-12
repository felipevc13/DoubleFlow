<template>
  <BaseModal
    :isOpen="props.isOpen ?? props.open"
    size="md"
    hide-default-header
    :hide-default-footer="true"
    @close="onCancel"
  >
    <template #header>
      <div class="flex items-center gap-2 px-6 py-4">
        <ProblemIcon class="w-8 h-8 shrink-0" />
        <span class="text-base font-semibold text-white">
          {{
            props.modalTitle ||
            props.summary ||
            (isDiffMode ? "Revisar Alteração" : "Editar Problema")
          }}
        </span>
      </div>
    </template>
    <p
      v-if="isDiffMode && (props.message || props.summary)"
      class="text-sm text-gray-400 px-6"
    >
      {{ props.message || props.summary }}
    </p>
    <div class="p-6 space-y-4">
      <!-- Título -->
      <div>
        <label class="block font-semibold mb-1 text-gray-300">Título</label>
        <div
          v-if="isDiffMode"
          v-html="titleDiffHtml"
          class="diff-view bg-[#1a1a1a] rounded p-3 font-mono border border-[#333333] min-h-[40px] prose-sm prose-invert"
        ></div>
        <input
          v-else
          v-model="localTitle"
          class="input input-bordered w-full"
          placeholder="Título do problema"
          autofocus
        />
      </div>

      <!-- Descrição -->
      <div>
        <label class="block font-semibold mb-1 text-gray-300">Descrição</label>
        <div
          v-if="isDiffMode"
          v-html="descriptionDiffHtml"
          class="diff-view bg-[#1a1a1a] rounded p-3 font-mono border border-[#333333] min-h-[100px] prose prose-invert max-w-none prose-sm"
        ></div>
        <textarea
          v-else
          v-model="localDescription"
          class="textarea textarea-bordered w-full"
          rows="5"
          placeholder="Descreva o problema em detalhes"
        />
      </div>
    </div>

    <!-- Rodapé -->
    <template #footer>
      <div
        class="flex justify-end gap-3 px-6 py-4 bg-[#232227] rounded-b-lg border-t border-t-[#393939]"
      >
        <button class="btn btn-ghost" @click="onCancel">
          {{ props.cancelLabel || "Cancelar" }}
        </button>
        <button class="btn btn-primary" @click="onConfirm">
          {{ props.confirmLabel || "Confirmar" }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import ProblemIcon from "~/components/icon/ProblemIcon.vue";
import { ref, computed, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import { diffWords } from "diff";

const DBG_PREFIX = "[ProblemModal][diff]";
function dbg(...a: any[]) {
  try {
    console.log(DBG_PREFIX, ...a);
  } catch {}
}

function getDiffItems(): Array<any> {
  const direct = (props as any)?.diff;
  const nested = (props.actionToConfirm as any)?.diff;
  const items =
    Array.isArray(direct) && direct.length
      ? direct
      : Array.isArray(nested)
      ? nested
      : [];
  dbg("getDiffItems", items);
  return items;
}

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  open?: boolean;
  isOpen?: boolean;
  originalData?: { title: string; description: string };
  proposedData?: { title: string; description: string };
  diff?: Array<any>;
  summary?: string;
  diffMode?: boolean;
  modalTitle?: string;
  actionToConfirm?: any;
  mode?: "confirm" | "edit";
  confirmLabel?: string;
  cancelLabel?: string;
  message?: string;
  nodeId?: string;
  diffFields?: string[];
  confirmFn?: () => void | Promise<void>;
  cancelFn?: () => void | Promise<void>;
}>();

const emit = defineEmits(["confirm", "close"]);

const localTitle = ref("");
const localDescription = ref("");

function computeIsDiffMode(): boolean {
  const action: any = props.actionToConfirm as any;
  const explicitDiff = !!action?.diff?.length; // server sent ready-to-render diff
  const hasDiffFields = !!(
    action?.meta?.diffFields?.length || props.diffFields?.length
  );
  const proposedData = action?.parameters?.newData || {};
  const hasProposedChanges =
    typeof proposedData === "object" &&
    (Object.prototype.hasOwnProperty.call(proposedData, "title") ||
      Object.prototype.hasOwnProperty.call(proposedData, "description"));
  const forced = props.mode === "confirm" || props.diffMode === true;
  const result = explicitDiff || hasDiffFields || hasProposedChanges || forced;
  dbg("computeIsDiffMode:", {
    explicitDiff,
    hasDiffFields,
    hasProposedChanges,
    forced,
    proposedKeys: Object.keys(proposedData || {}),
    action: action,
    propsDiffFields: props.diffFields,
  });
  return result;
}

const isDiffMode = ref(computeIsDiffMode());

// Se a ação tiver diff, travamos o modo diff (não voltamos para formulário)
watch(
  () => props.actionToConfirm,
  (nv) => {
    dbg("actionToConfirm changed", nv);
    isDiffMode.value = computeIsDiffMode();
    dbg("isDiffMode now", isDiffMode.value);
  }
);

// Sempre que o modal abre ou originalData muda, atualiza o estado local,
// exceto em diffMode (onde os campos não são editáveis e exibem apenas o diff)
watch(
  () => [props.isOpen ?? props.open, props.originalData, isDiffMode.value],
  ([isOpen, newOriginalData, isDiff]) => {
    console.log(
      "[ProblemModal] Watcher acionado: { open, originalData, diffMode } = ",
      isOpen,
      newOriginalData,
      isDiff
    );
    if (isOpen && !isDiff) {
      localTitle.value =
        typeof newOriginalData === "object" &&
        newOriginalData !== null &&
        "title" in newOriginalData
          ? newOriginalData.title
          : "";
      localDescription.value =
        typeof newOriginalData === "object" &&
        newOriginalData !== null &&
        "description" in newOriginalData
          ? newOriginalData.description
          : "";
      console.log("[ProblemModal] Atualizou campos locais:", {
        localTitle: localTitle.value,
        localDescription: localDescription.value,
      });
    } else if (isOpen && isDiff) {
      console.log(
        "[ProblemModal] Está em diffMode: campos locais NÃO foram alterados."
      );
    }
  },
  { immediate: true, deep: true }
);

function createDiffHtml(oldStr: string, newStr: string): string {
  if ((oldStr ?? "") === (newStr ?? "")) {
    return `<span>${(newStr ?? "").replace(/\n/g, "<br/>")}</span>`;
  }
  const diffs = diffWords(oldStr || "", newStr || "");
  return diffs
    .map((part) => {
      const value = (part.value || "").replace(/\n/g, "<br/>");
      if (part.added) return `<span class="diff-ins">${value}</span>`;
      if (part.removed) return `<span class="diff-del">${value}</span>`;
      return `<span>${value}</span>`;
    })
    .join("");
}

function diffHtmlFromAction(field: string, items?: Array<any>): string | null {
  const list = items ?? getDiffItems();
  if (!list || !Array.isArray(list)) return null;
  const entry = list.find((d) => d?.field === field);
  if (!entry) return null;
  const from = (entry.from ?? "").toString().replace(/\n/g, "<br/>");
  const to = (entry.to ?? "").toString().replace(/\n/g, "<br/>");
  return `<span class="diff-del">${from}</span> <span class="opacity-70">→</span> <span class="diff-ins">${to}</span>`;
}

function getProposedValue(field: "title" | "description"): string {
  const fromProps = (props.proposedData as any)?.[field];
  const fromAction = (props.actionToConfirm as any)?.parameters?.newData?.[
    field
  ];
  const merged = (fromProps ?? fromAction ?? "").toString();
  dbg("getProposedValue", field, { fromProps, fromAction, merged });
  return merged;
}

function getCurrentValue(field: "title" | "description"): string {
  const fromOriginal = (props.originalData as any)?.[field];
  const fromCtxProblem = (props.actionToConfirm as any)?.parameters
    ?.canvasContext?.problem_statement?.[field];
  const fromCtxNode = (props.actionToConfirm as any)?.parameters?.canvasContext
    ?.nodes?.[0]?.data?.[field];
  const merged = (
    fromOriginal ??
    fromCtxProblem ??
    fromCtxNode ??
    ""
  ).toString();
  dbg("getCurrentValue", field, {
    fromOriginal,
    fromCtxProblem,
    fromCtxNode,
    merged,
  });
  return merged;
}

function shouldShowFieldDiff(
  field: "title" | "description",
  items?: Array<any>
): boolean {
  const list = items ?? getDiffItems();
  dbg("shouldShowFieldDiff:start", field, { items: list });

  if (Array.isArray(list) && list.some((d) => d?.field === field)) {
    dbg("shouldShowFieldDiff: explicit item for field", field);
    return true;
  }

  const metaDiffFields: string[] =
    (props.actionToConfirm as any)?.meta?.diffFields || props.diffFields || [];
  if (Array.isArray(metaDiffFields) && metaDiffFields.includes(field)) {
    const oldVal = getCurrentValue(field);
    const newVal = getProposedValue(field);
    const changed = (oldVal ?? "") !== (newVal ?? "");
    dbg("shouldShowFieldDiff: meta diffFields hit", field, {
      metaDiffFields,
      oldVal,
      newVal,
      changed,
    });
    return changed;
  }

  dbg("shouldShowFieldDiff: no diff for field", field);
  return false;
}

const titleDiffHtml = computed(() => {
  if (!isDiffMode.value) return "";
  const items = getDiffItems();
  const hasExplicit =
    Array.isArray(items) && items.some((d) => d?.field === "title");

  if (hasExplicit) {
    const override = diffHtmlFromAction("title", items);
    dbg("titleDiffHtml: explicit diff", { items, override });
    if (override) return override;
  }

  if (shouldShowFieldDiff("title", items)) {
    const oldV = getCurrentValue("title");
    const newV = getProposedValue("title");
    const html = createDiffHtml(oldV, newV);
    dbg("titleDiffHtml: computed diff", { oldV, newV, html });
    return html;
  }

  const current = getCurrentValue("title");
  const html = `<span>${String(current).replace(/\n/g, "<br/>")}</span>`;
  dbg("titleDiffHtml: no diff, current only", { current, html });
  return html;
});

const descriptionDiffHtml = computed(() => {
  if (!isDiffMode.value) return "";
  const items = getDiffItems();
  const hasExplicit =
    Array.isArray(items) && items.some((d) => d?.field === "description");

  if (hasExplicit) {
    const override = diffHtmlFromAction("description", items);
    dbg("descriptionDiffHtml: explicit diff", { items, override });
    if (override) return override;
  }

  if (shouldShowFieldDiff("description", items)) {
    const oldV = getCurrentValue("description");
    const newV = getProposedValue("description");
    const html = createDiffHtml(oldV, newV);
    dbg("descriptionDiffHtml: computed diff", { oldV, newV, html });
    return html;
  }

  const current = getCurrentValue("description");
  const html = `<span>${String(current).replace(/\n/g, "<br/>")}</span>`;
  dbg("descriptionDiffHtml: no diff, current only", { current, html });
  return html;
});

async function onConfirm() {
  console.log("[ProblemModal] onConfirm() chamado!");
  console.log("[ProblemModal] Botão Confirmar clicado", {
    diffMode: isDiffMode.value,
    actionToConfirm: props.actionToConfirm,
    localTitle: localTitle.value,
    localDescription: localDescription.value,
  });

  if (isDiffMode.value) {
    // Prioridade: fluxo do AGENTE com ação proposta
    if (props.actionToConfirm) {
      // Garante que a execução será aplicada (após aprovação) pelo tool
      const normalized = {
        ...props.actionToConfirm,
        parameters: {
          ...(props.actionToConfirm as any)?.parameters,
          // garantir que o backend reconheça a aprovação
          isApprovedUpdate: true,
          isApprovedOperation: true,
        },
      };
      dbg("onConfirm emit", normalized);
      console.log(
        "[ProblemModal] Emitindo confirmação VISUAL com isApprovedUpdate=true",
        normalized
      );
      emit("confirm", normalized);
      // Fecha o modal após confirmar
      emit("close");
      return;
    }

    // Alternativa: callback customizado (se existir)
    if (typeof props.confirmFn === "function") {
      await props.confirmFn();
      emit("close");
      return;
    }
  } else {
    // Modo edição manual (não-diff)
    console.log("[ProblemModal] Emitindo confirmação para edição MANUAL", {
      title: localTitle.value,
      description: localDescription.value,
    });
    emit("confirm", {
      title: localTitle.value,
      description: localDescription.value,
    });
    emit("close");
    return;
  }
}

async function onCancel() {
  if (typeof props.cancelFn === "function") {
    await props.cancelFn();
    return;
  }
  emit("close");
}
</script>

<style>
/* Backward compatibility if any place still renders <ins>/<del> */
.diff-view ins {
  background-color: rgba(46, 160, 67, 0.2);
  color: #56d364;
  text-decoration: none;
}
.diff-view del {
  background-color: rgba(248, 81, 73, 0.2);
  color: #ff7b72;
}
/* New explicit classes that are not affected by typography defaults */
.diff-view .diff-ins {
  background-color: rgba(46, 160, 67, 0.2);
  color: #56d364;
  text-decoration: none;
}
.diff-view .diff-del {
  background-color: rgba(248, 81, 73, 0.2);
  color: #ff7b72;
  text-decoration: none;
}
</style>
