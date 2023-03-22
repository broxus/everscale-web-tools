<script setup lang="ts">
import { computed, nextTick, watch, ref, onMounted } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    required: false
  },
  tabSize: {
    type: Number,
    required: false,
    default: 2
  }
});

const emit = defineEmits<{
  (e: 'update:modelValue', address: string): void;
}>();

const input = ref<HTMLTextAreaElement>(null);

const tabValueProp = computed(() => ' '.repeat(props.tabSize));

const CURRENT_LINE_REGEX = /\S|$/;

function updateValue(event: KeyboardEvent) {
  const target = event.target as HTMLTextAreaElement;
  let value = target.value;
  const start = target.selectionStart;
  const end = target.selectionEnd;
  const tabSize = props.tabSize;
  const tabValue = tabValueProp.value;

  if (event.key === 'Escape') {
    if (target.nextElementSibling) {
      (target.nextElementSibling as HTMLElement).focus();
    } else {
      target.blur();
    }
    return;
  }

  if (event.key === 'Tab' && !event.metaKey) {
    event.preventDefault();
    value = value.substring(0, start) + tabValue + value.substring(end);
    target.value = value;
    nextTick(() => {
      target.selectionStart = target.selectionEnd = start + tabSize;
    });
  }

  if (event.key === 'Backspace' && !event.metaKey) {
    const charsBeforeCursor = value.substring(start - tabSize, start);
    if (charsBeforeCursor === tabValue) {
      event.preventDefault();
      value = value.substring(0, start - tabSize) + value.substring(end);
      target.value = value;
      nextTick(() => {
        target.selectionStart = target.selectionEnd = start - tabSize;
      });
    }
  }

  if (event.key === 'Enter') {
    const currentLine = value.substring(0, start).split('\n').pop();
    if (currentLine && currentLine.startsWith(tabValue)) {
      event.preventDefault();
      const spaceCount = currentLine.search(CURRENT_LINE_REGEX);
      const tabCount = spaceCount ? spaceCount / tabSize : 0;
      value = value.substring(0, start) + '\n' + tabValue.repeat(tabCount) + props.modelValue.substring(end);
      target.value = value;
      nextTick(() => {
        target.selectionStart = target.selectionEnd = start + tabSize * tabCount + 1;
      });
    }
  }

  nextTick(() => {
    emit('update:modelValue', target.value);
  });
}

function adjustTextAreaHext() {
  const textarea = input.value;
  if (textarea != null) {
    textarea.style.height = 'auto';
    nextTick(() => {
      textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
    });
  }
}

function onInput(event: InputEvent) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

watch([() => props.modelValue], () => {
  adjustTextAreaHext();
});

onMounted(() => {
  adjustTextAreaHext();
});
</script>

<template>
  <textarea ref="input" :value="props.modelValue" @keydown="updateValue($event)" @input="onInput"></textarea>
</template>
