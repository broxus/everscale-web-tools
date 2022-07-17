<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';

import { checkTxId } from '../common';

export type Transaction = {
  lt: string;
  now: number;
  accountAddr: string;
  messageBoc: string;
};

const emit = defineEmits<{
  (e: 'change', tx: Transaction | undefined): void;
}>();

const currentId = ref<string>();
const inputId = ref('');
const inProgress = ref(false);

const isValid = computed(() => checkTxId(inputId.value));
const isSame = computed(() => inputId.value.toLowerCase() == currentId.value?.toLowerCase());

const GQL_URL = 'https://gra01.main.everos.dev/graphql';

watchEffect(async onCleanup => {
  const id = currentId.value;
  if (id == null) {
    return;
  }

  const controller = new AbortController();
  const signal = controller.signal;
  onCleanup(() => controller.abort());

  inProgress.value = true;
  const transaction: Transaction | undefined = await fetch(GQL_URL, {
    body: JSON.stringify({
      operationName: null,
      variables: {},
      query: `{transactions(filter:{id:{eq:"${id}"}}){lt(format:DEC),now,account_addr,in_message{boc}}}`
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    signal
  })
    .then(res => res.json())
    .then(res => {
      if (typeof res !== 'object' || res == null) {
        return;
      }
      const data = res['data'];
      if (typeof data !== 'object' || data == null) {
        return;
      }

      const transactions = data['transactions'];
      if (!Array.isArray(transactions) || transactions.length == 0) {
        return;
      }
      const item = transactions[0];
      if (typeof item !== 'object' || item == null) {
        return;
      }
      const lt = item['lt'];
      if (typeof lt !== 'string') {
        return;
      }
      const now = item['now'];
      if (typeof now !== 'number') {
        return;
      }
      const accountAddr = item['account_addr'];
      if (typeof accountAddr !== 'string') {
        return;
      }
      const inMessage = item['in_message'];
      if (typeof inMessage !== 'object' || inMessage == null) {
        return;
      }
      const messageBoc = inMessage['boc'];
      if (typeof messageBoc !== 'string') {
        return;
      }
      return {
        lt,
        now,
        accountAddr,
        messageBoc
      };
    })
    .finally(() => {
      inProgress.value = false;
    });

  emit('change', transaction);
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
