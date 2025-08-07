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
            modalTitle || (diffMode ? "Revisar Alteração" : "Editar Problema")
          }}
        </span>
      </div>
    </template>
    <div class="p-6 space-y-4">
      <!-- Título -->
      <div>
        <label class="block font-semibold mb-1 text-gray-300">Título</label>
        <div
          v-if="diffMode"
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
          v-if="diffMode"
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
        <button class="btn btn-ghost" @click="onCancel">Cancelar</button>
        <button class="btn btn-primary" @click="onConfirm">Confirmar</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import ProblemIcon from "~/components/icon/ProblemIcon.vue";
import { ref, computed, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import { diffWords } from "diff";

const props = defineProps<{
  open?: boolean;
  isOpen?: boolean;
  originalData?: { title: string; description: string };
  proposedData?: { title: string; description: string };
  diffMode?: boolean;
  modalTitle?: string;
  actionToConfirm?: any;
}>();

const emit = defineEmits(["confirm", "close"]);

const localTitle = ref("");
const localDescription = ref("");

// Sempre que o modal abre ou originalData muda, atualiza o estado local,
// exceto em diffMode (onde os campos não são editáveis e exibem apenas o diff)
watch(
  () => [props.isOpen ?? props.open, props.originalData, props.diffMode],
  ([isOpen, newOriginalData, diffMode]) => {
    console.log(
      "[ProblemModal] Watcher acionado: { open, originalData, diffMode } = ",
      isOpen,
      newOriginalData,
      diffMode
    );
    if (isOpen && !diffMode) {
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
    } else if (isOpen && diffMode) {
      console.log(
        "[ProblemModal] Está em diffMode: campos locais NÃO foram alterados."
      );
    }
  },
  { immediate: true, deep: true }
);

function createDiffHtml(oldStr: string, newStr: string): string {
  if (oldStr === newStr)
    return `<span>${newStr.replace(/\n/g, "<br/>")}</span>`;
  const diffs = diffWords(oldStr || "", newStr || "");
  return diffs
    .map((part) => {
      const value = part.value.replace(/\n/g, "<br/>");
      if (part.added) return `<ins>${value}</ins>`;
      if (part.removed) return `<del>${value}</del>`;
      return `<span>${value}</span>`;
    })
    .join("");
}

const titleDiffHtml = computed(() =>
  props.diffMode
    ? createDiffHtml(
        props.originalData?.title || "",
        props.proposedData?.title || ""
      )
    : ""
);

const descriptionDiffHtml = computed(() =>
  props.diffMode
    ? createDiffHtml(
        props.originalData?.description || "",
        props.proposedData?.description || ""
      )
    : ""
);

function onConfirm() {
  console.log("[ProblemModal] onConfirm() chamado!");
  console.log("[ProblemModal] Botão Confirmar clicado", {
    diffMode: props.diffMode,
    actionToConfirm: props.actionToConfirm,
    localTitle: localTitle.value,
    localDescription: localDescription.value,
  });
  if (props.diffMode && props.actionToConfirm) {
    console.log(
      "[ProblemModal] Emitindo confirmação para fluxo AGENTE",
      props.actionToConfirm
    );
    emit("confirm", props.actionToConfirm);
  } else if (!props.diffMode) {
    console.log("[ProblemModal] Emitindo confirmação para edição MANUAL", {
      title: localTitle.value,
      description: localDescription.value,
    });
    emit("confirm", {
      title: localTitle.value,
      description: localDescription.value,
    });
  }
}

function onCancel() {
  emit("close");
}
</script>

<style>
.diff-view ins {
  background-color: rgba(46, 160, 67, 0.2);
  color: #56d364;
  text-decoration: none;
}
.diff-view del {
  background-color: rgba(248, 81, 73, 0.2);
  color: #ff7b72;
}
</style>
