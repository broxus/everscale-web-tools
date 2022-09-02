<script setup lang="ts">
import { computed, watch, ref } from 'vue';

import { checkAddress } from '../common';

const props = defineProps<{
  modelValue?: string;
  disabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', address: string): void;
}>();

const input = ref('');

const canSearch = computed(
  () => !props.disabled && props.modelValue?.toLowerCase() != input.value.toLowerCase() && checkAddress(input.value)
);

watch(
  () => props.modelValue,
  newValue => {
    if (newValue != null && newValue != input.value) {
      input.value = newValue;
    }
  },
  {
    immediate: true
  }
);
</script>

<template>
  <div class="field has-addons">
    <div class="control is-expanded">
      <input type="text" class="input" spellcheck="false" :disabled="disabled" v-model="input" />
      <p class="help">Contract address</p>
    </div>
    <div class="control">
      <button class="button is-info" :disabled="!canSearch" @click="canSearch && emit('update:modelValue', input)">
        Search
      </button>
    </div>
  </div>
</template>
