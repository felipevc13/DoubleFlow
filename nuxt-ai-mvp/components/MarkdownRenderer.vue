<template>
  <div class="markdown-body" v-html="sanitizedHtml"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

const props = defineProps({
  content: {
    type: String,
    required: true,
    default: "",
  },
});

const sanitizedHtml = computed(() => {
  if (!props.content) {
    return "";
  }
  try {
    // 1. Parse Markdown to HTML
    const rawHtml = marked.parse(props.content, {
      // mangle: false, // Opção removida. A ofuscação de e-mail não é mais uma opção padrão ou foi movida para extensões.
      // headerIds: false, // Opção removida. A geração de IDs de cabeçalho pode ser controlada por extensões ou é o comportamento padrão.
      gfm: true, // Habilita GitHub Flavored Markdown (tabelas, strikethrough, etc.)
      breaks: true, // Converte quebras de linha simples em <br>
    }) as string; // Cast para string, pois marked.parse pode retornar Promise | string

    // 2. Sanitize HTML
    // Configuração do DOMPurify: permitir apenas tags e atributos seguros.
    // Você pode customizar o que é permitido aqui se necessário.
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true }, // Permite um conjunto padrão de tags HTML seguras
      // FORBID_TAGS: ['style'], // Exemplo: proibir explicitamente a tag <style>
      // FORBID_ATTR: ['style']  // Exemplo: proibir explicitamente o atributo style
    });
    return cleanHtml;
  } catch (error) {
    console.error("Erro ao renderizar Markdown:", error);
    return "<p>Erro ao renderizar conteúdo.</p>"; // Fallback em caso de erro
  }
});
</script>

<style scoped>
/* Estilos básicos para o conteúdo Markdown renderizado. */
.markdown-body {
  line-height: 1.6;
  color: #6b6c7e;
  padding: 32px;
}

/* --- Estilização dos Títulos e Parágrafos Padrão --- */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 1.5em;

  font-weight: 600;
  color: #393b4a;
}

.markdown-body :deep(h1) {
  font-size: 2em;

  padding-bottom: 0.3em;
}

/* Ajuste para H2 ter a mesma borda inferior que H1 se desejado,
   ou remova se o estilo de card abaixo para H2 for suficiente. */
.markdown-body :deep(h2) {
  font-size: 1.5em;
  /* border-bottom: 1px solid #e2e8f0; */ /* Removido para não conflitar com estilo de card */
  /* padding-bottom: 0.3em; */ /* Removido */
}

.markdown-body :deep(h3) {
  font-size: 1.25em;
}

.markdown-body :deep(p) {
  margin-bottom: 1em;
  color: #6b6c7e;
}

/* --- Estilização de Listas Padrão (se não forem cards) --- */
/* Esta regra será sobrescrita para UL/OL após H2/H3 que viram "listas de cards" */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin-left: 1.5em; /* Mantém para listas normais */
  margin-bottom: 1em;
  padding-left: 1em; /* Mantém para listas normais */
}
.markdown-body :deep(ul) {
  list-style-type: disc; /* Mantém para listas normais */
}
.markdown-body :deep(ol) {
  list-style-type: decimal; /* Mantém para listas normais */
}

/* --- Estilização dos Cards de Seção (H2/H3) --- */
.markdown-body :deep(h2), /* <<<< ADICIONADO H2 AQUI */
.markdown-body :deep(h3) {
  font-size: 1.25em; /* Pode ajustar se H2 e H3 devem ter tamanhos diferentes de título de card */
  font-weight: 600;
  color: #111827;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 0.75rem 1.25rem;
  margin-top: 2rem;
  margin-bottom: 0; /* Para colar o conteúdo do card abaixo */
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
  position: relative;
}

/* Conteúdo que segue H2/H3 e forma um "corpo de card" junto com o título */
.markdown-body :deep(h2 + p),   /* <<<< ADICIONADO H2 */
.markdown-body :deep(h3 + p),
.markdown-body :deep(h2 + blockquote), /* <<<< ADICIONADO H2 */
.markdown-body :deep(h3 + blockquote),
.markdown-body :deep(h2 + table),  /* <<<< ADICIONADO H2 */
.markdown-body :deep(h3 + table),
.markdown-body :deep(h2 + pre),   /* <<<< ADICIONADO H2 */
.markdown-body :deep(h3 + pre) {
  background-color: #ffffff;
  border-left: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  border-top: none; /* O H2/H3 já tem a borda superior */
  padding: 1.25rem;
  margin-top: 0;
  margin-bottom: 2rem;
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04),
    0 1px 2px -1px rgba(0, 0, 0, 0.04);
}

/* --- Estilização de UL/OL após H2/H3 para serem contêineres de LI-cards --- */
.markdown-body :deep(h2 + ul), /* <<<< ADICIONADO H2 */
.markdown-body :deep(h2 + ol), /* <<<< ADICIONADO H2 */
.markdown-body :deep(h3 + ul),
.markdown-body :deep(h3 + ol) {
  background-color: transparent; /* Fundo transparente */
  border: none; /* Sem bordas próprias */
  box-shadow: none; /* Sem sombra própria */
  padding: 0; /* Sem padding próprio */
  margin-top: 0; /* Colado ao H2/H3 */
  margin-left: 0;
  list-style-type: none; /* Remove bullets padrão, já que LIs serão cards */
  /* margin-left: 0; */ /* Reseta margin-left padrão de listas */
}

/* --- Estilização de LI para parecerem cards --- */
/* Esta regra se aplica a todos os LIs dentro de markdown-body.
   A especificidade de H2+UL/OL garante que o container não interfira. */
.markdown-body :deep(li) {
  background: #fff !important; /* !important para garantir prioridade se necessário */
  border: 1px solid #e2e8f0 !important;
  margin-bottom: -1px;
  padding: 32px 22px 32px 30px !important; /* Padding para conteúdo e bullet customizado */
  /* Espaçamento entre cards LI */
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 3%) !important;
  color: #6b6c7e !important;
  list-style-type: none !important; /* Garante que não haja bullets padrão */
  position: relative !important; /* Para posicionamento do ::before */
}

/* Pontinho azul como bullet customizado para os LI cards */
.markdown-body :deep(li::before) {
  content: "";
  display: block;
  position: absolute;
  left: 10px; /* Posição do bullet */
  top: 26px; /* Ajustar verticalmente conforme padding/line-height */
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: none;
}

/* Título (strong) dentro do card LI */
.markdown-body :deep(li > strong:first-child) {
  /* Se o strong for o primeiro filho direto */
  font-size: 1.13em !important;
  color: #393b4a !important;
  display: block !important;
  margin-bottom: 3px !important;
}

/* --- Demais estilos (blockquote, pre, code, table, img, a, hr) --- */
.markdown-body :deep(blockquote) {
  border-left: 4px solid #4d6bfe;
  padding-left: 1em;
  margin-left: 0;
  margin-bottom: 1em;
  color: #6b6c7e;
  font-style: italic;
}

.markdown-body :deep(pre) {
  background-color: #f7f7fa;
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 1em;
  border: 1px solid #47464b;
}

.markdown-body :deep(code) {
  font-family: "Courier New", Courier, monospace;
  background-color: #f7f7fa;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  color: #393b4a;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
  color: #393b4a;
}

.markdown-body :deep(table) {
  width: auto;
  max-width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
  border: 1px solid #47464b;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #47464b;
  padding: 0.5em 0.75em;
  text-align: left;
}

.markdown-body :deep(td) {
  color: #6b6c7e;
}

.markdown-body :deep(th) {
  background-color: #f7f7fa; /* Ajustado para tema claro */
  font-weight: 600;
  color: #393b4a;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.markdown-body :deep(a) {
  color: #4d6bfe;
  text-decoration: none;
}
.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(hr) {
  border: 0;
  height: 1px;
  background-color: #47464b;
  margin: 2em 0;
}

/* --- Border-radius inferior apenas no último LI de cada lista --- */
.markdown-body :deep(ul > li:last-child),
.markdown-body :deep(ol > li:last-child) {
  border-bottom-left-radius: 10px !important;
  border-bottom-right-radius: 10px !important;
}
.markdown-body :deep(ul > li:not(:last-child)),
.markdown-body :deep(ol > li:not(:last-child)) {
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}
</style>
