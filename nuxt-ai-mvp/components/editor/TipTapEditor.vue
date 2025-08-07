<template>
  <div
    class="tiptap-editor-wrapper flex flex-col h-full border border-[#343434] border-t-0 mb-[-1px] overflow-hidden"
  >
    <!-- Toolbar -->
    <div
      v-if="editor"
      class="flex items-center flex-wrap gap-x-4 gap-y-2 p-3 border-b border-[#343434] bg-[#171717] flex-shrink-0"
    >
      <div class="flex gap-2">
        <button
          @click="editor.chain().focus().undo().run()"
          :disabled="!editor.can().undo()"
          class="editor-button"
          :class="{ 'is-disabled': !editor.can().undo() }"
          title="Undo (Ctrl+Z)"
        >
          <ArrowUturnLeftIcon class="w-5 h-5" />
        </button>
        <button
          @click="editor.chain().focus().redo().run()"
          :disabled="!editor.can().redo()"
          class="editor-button"
          :class="{ 'is-disabled': !editor.can().redo() }"
          title="Redo (Ctrl+Y)"
        >
          <ArrowUturnRightIcon class="w-5 h-5" />
        </button>
      </div>

      <select
        :value="currentHeadingLevel"
        @change="setHeading($event)"
        class="bg-transparent text-gray-400 outline-none editor-button text-sm"
        title="Heading Level"
      >
        <option value="paragraph">Normal</option>
        <option value="heading1">Título 1</option>
        <option value="heading2">Título 2</option>
        <option value="heading3">Título 3</option>
      </select>

      <button
        @click="editor.chain().focus().toggleBold().run()"
        class="editor-button"
        :class="{ 'is-active': editor.isActive('bold') }"
        title="Bold (Ctrl+B)"
      >
        <strong class="font-bold">B</strong>
      </button>
      <button
        @click="editor.chain().focus().toggleItalic().run()"
        class="editor-button"
        :class="{ 'is-active': editor.isActive('italic') }"
        title="Italic (Ctrl+I)"
      >
        <em class="italic">I</em>
      </button>
      <button
        @click="editor.chain().focus().toggleUnderline().run()"
        class="editor-button"
        :class="{ 'is-active': editor.isActive('underline') }"
        title="Underline (Ctrl+U)"
      >
        <span class="underline">U</span>
      </button>
      <button
        @click="editor.chain().focus().toggleStrike().run()"
        class="editor-button"
        :class="{ 'is-active': editor.isActive('strike') }"
        title="Strikethrough"
      >
        <span class="line-through">S</span>
      </button>
      <button
        @click="editor.chain().focus().toggleCode().run()"
        class="editor-button"
        :class="{ 'is-active': editor.isActive('code') }"
        title="Code"
      >
        <CodeBracketIcon class="w-5 h-5" />
      </button>

      <button
        @click="editor.chain().focus().toggleBulletList().run()"
        class="editor-button"
        :class="{ 'is-active': editor.isActive('bulletList') }"
        title="Bullet List"
      >
        <ListBulletIcon class="w-5 h-5" />
      </button>
      <button
        @click="editor.chain().focus().toggleOrderedList().run()"
        class="editor-button"
        :class="{ 'is-active': editor.isActive('orderedList') }"
        title="Ordered List"
      >
        <Bars3Icon class="w-5 h-5" />
        <!-- Use a better icon if available -->
      </button>
    </div>

    <!-- Editor Content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content flex-grow h-0 overflow-y-auto p-4 bg-[#171717] text-gray-200 outline-none"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Heading from "@tiptap/extension-heading";

// Import Heroicons
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CodeBracketIcon,
  ListBulletIcon,
  Bars3Icon, // Consider a better icon for ordered list if available
  XMarkIcon,
} from "@heroicons/vue/24/outline";

const props = defineProps({
  modelValue: {
    type: [Object, String, null],
    default: "",
  },
  placeholder: {
    type: String,
    default: "Comece a escrever sua nota aqui...",
  },
});

const emit = defineEmits(["update:modelValue"]);

const editor = ref(null);
const currentHeadingLevel = ref("paragraph");

// Initialize editor
onMounted(() => {
  editor.value = new Editor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: props.placeholder,
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
    ],
    content: props.modelValue,
    onTransaction: () => {
      updateHeadingSelectState();
    },
    onUpdate: () => {
      emit("update:modelValue", editor.value.getJSON());
      updateHeadingSelectState();
    },
  });

  updateHeadingSelectState();
});

// Watch for external changes to modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    if (editor.value) {
      const contentToSet = newValue && typeof newValue === 'object' ? newValue : '';
      const currentContentString = JSON.stringify(editor.value.getJSON());
      const newContentString = JSON.stringify(contentToSet);

      if (currentContentString !== newContentString) {
          editor.value.commands.setContent(contentToSet, false);
          updateHeadingSelectState();
      }
    }
  }
);

// Cleanup editor instance
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});

// --- Toolbar Actions ---

const setHeading = (event) => {
  const value = event.target.value;
  if (!editor.value) return;

  const chain = editor.value.chain().focus();

  if (value === "paragraph") {
    chain.setParagraph().run();
  } else if (value === "heading1") {
    chain.toggleHeading({ level: 1 }).run();
  } else if (value === "heading2") {
    chain.toggleHeading({ level: 2 }).run();
  } else if (value === "heading3") {
    chain.toggleHeading({ level: 3 }).run();
  }

  currentHeadingLevel.value = value;
};

const updateHeadingSelectState = () => {
  if (!editor.value) return;
  let newLevel = "paragraph";
  if (editor.value.isActive("heading", { level: 1 })) {
    newLevel = "heading1";
  } else if (editor.value.isActive("heading", { level: 2 })) {
    newLevel = "heading2";
  } else if (editor.value.isActive("heading", { level: 3 })) {
    newLevel = "heading3";
  }
  currentHeadingLevel.value = newLevel;
  const selectElement = document.querySelector(
    '.tiptap-editor-wrapper select[title="Heading Level"]'
  );
  if (selectElement) {
    selectElement.value = newLevel;
  }
};

const clearFormatting = () => {
  if (!editor.value) return;
  editor.value.chain().focus().setParagraph().unsetAllMarks().run();
  updateHeadingSelectState();
};
</script>

<style>
/* Basic TipTap editor styling */
.tiptap-editor-wrapper .ProseMirror {
  min-height: 150px; /* Adjust as needed */
  outline: none;
}

.tiptap-editor-wrapper .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #6b7280; /* gray-500 */
  pointer-events: none;
  height: 0;
}

/* Toolbar button styling */
.editor-button {
  padding: 0.25rem;
  border-radius: 0.25rem;
  background: transparent;
  color: #9ca3af; /* gray-400 */
  transition: background-color 0.2s ease, color 0.2s ease;
}
.editor-button:hover:not(.is-disabled) {
  background-color: #374151; /* gray-700 */
  color: #e5e7eb; /* gray-200 */
}
.editor-button.is-active {
  background-color: #4b5563; /* gray-600 */
  color: #f3f4f6; /* gray-100 */
}
.editor-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* You might need to target tiptap classes for specific content styling */
.tiptap-content h1 {
  font-size: 1.875rem; /* text-3xl */
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}
.tiptap-content h2 {
  font-size: 1.5rem; /* text-2xl */
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}
.tiptap-content h3 {
  font-size: 1.25rem; /* text-xl */
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}
.tiptap-content p {
  line-height: 1.6;
}
.tiptap-content ul,
.tiptap-content ol {
  margin-left: 1.5rem;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.tiptap-content ul {
  list-style-type: disc;
}
.tiptap-content ol {
  list-style-type: decimal;
}
.tiptap-content blockquote {
  border-left: 3px solid #4b5563; /* gray-600 */
  margin-left: 1rem;
  padding-left: 1rem;
  color: #d1d5db; /* gray-300 */
  font-style: italic;
}
.tiptap-content code {
  background-color: #374151; /* gray-700 */
  padding: 0.1em 0.3em;
  border-radius: 0.25rem;
  font-family: monospace;
  color: #e5e7eb; /* gray-200 */
}
.tiptap-content pre {
  background-color: #1f2937; /* gray-800 */
  color: #f3f4f6; /* gray-100 */
  font-family: monospace;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  white-space: pre-wrap;
  margin-top: 1em;
  margin-bottom: 1em;
}
.tiptap-content pre code {
  background: none;
  color: inherit;
  padding: 0;
  border-radius: 0;
}
.tiptap-content hr {
  border: none;
  border-top: 1px solid #4b5563; /* gray-600 */
  margin: 1rem 0;
}
</style>
