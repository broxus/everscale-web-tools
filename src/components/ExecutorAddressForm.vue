<script setup lang="ts">
import { computed, ref } from 'vue';

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
</script>

<template>
  <div class="field has-addons">
    <div class="control is-expanded">
      <input type="text" class="input" spellcheck="false" :disabled="disabled" v-model="input" />
    </div>
    <div class="control">
      <button class="button is-info" :disabled="!canSearch" @click="canSearch && emit('update:modelValue', input)">
        Search
      </button>
    </div>
  </div>
</template>
