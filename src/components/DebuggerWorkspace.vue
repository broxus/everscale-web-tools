<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import * as core from '@core';

import TransactionIdForm, { Transaction } from './TransactionIdForm.vue';

const transaction = shallowRef<Transaction>();

const STATES_URL = 'https://states.everscan.io/apply';

watch(transaction, async (transaction, _, onCleanup) => {
  const controller = new AbortController();
  const signal = controller.signal;
  onCleanup(() => controller.abort());

  const state = await fetch(STATES_URL, {
    body: `{"account":"${transaction.accountAddr}","lt":${transaction.lt}}`,
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    signal
  })
    .then(res => res.json())
    .then(res => res.accountBoc)
    .catch(console.error);

  const data = core.execute(state, transaction.messageBoc, transaction.now, transaction.lt);
  console.log(data);
});
</script>

<template>
  <div class="section debugger-workspace">
    <div class="container is-fluid">
      <div class="columns">
        <div class="column is-3 is-full">
          <TransactionIdForm @change="transaction = $event" />
        </div>
      </div>
    </div>
    <div v-if="transaction">{{ transaction.lt }}</div>
  </div>
</template>

<style lang="scss">
.debugger-workspace {
  max-height: 100%;

  .command-list-container {
    overflow-y: scroll;
    max-height: calc((1.5em + 0.2em) * 40 + 0.75em);
  }

  .command-title {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .command-list {
    width: 100%;

    li {
      cursor: pointer;
      display: flex;
      flex-direction: row;
      justify-content: start;
      margin-bottom: 0.2em;
      height: 1.5em;

      .list-index {
        width: 4em;
      }

      .tag {
        width: 100%;
        display: inline;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        line-height: 2em;
      }

      button {
        height: 2em;
      }
    }
  }
}
</style>
