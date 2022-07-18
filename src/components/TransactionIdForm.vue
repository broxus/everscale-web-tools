<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';

import { checkTxId } from '../common';

export type TransactionResponse = {
  rawTransaction: {
    account: string;
    lt: string;
    data: string;
  };
  configBoc: string;
};

const emit = defineEmits<{
  (e: 'change', tx: TransactionResponse | undefined): void;
  (e: 'search'): void;
}>();

const currentId = ref<string>();
const inputId = ref('');
const inProgress = ref(false);

const isValid = computed(() => checkTxId(inputId.value));
const isSame = computed(() => inputId.value.toLowerCase() == currentId.value?.toLowerCase());

watchEffect(async onCleanup => {
  const id = currentId.value;
  if (id == null) {
    return;
  }
  emit('search');

  const controller = new AbortController();
  const signal = controller.signal;
  onCleanup(() => controller.abort());

  inProgress.value = true;
  const res: TransactionResponse | undefined = await fetch(`https://states.everscan.io/transaction/${id}`, {
    method: 'GET',
    signal
  })
    .then(res => res.json())
    .finally(() => {
      inProgress.value = false;
    });

  emit('change', res);
});
</script>

<template>
  <div class="field has-addons">
    <div class="control is-expanded">
      <input type="text" class="input" spellcheck="false" v-model="inputId" />
      <p class="help">Transaction id</p>
    </div>
    <div class="control">
      <button class="button is-info" :disabled="inProgress || isSame || !isValid" @click="currentId = inputId">
        Search
      </button>
    </div>
  </div>
</template>
