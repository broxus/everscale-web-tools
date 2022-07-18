<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { Transaction } from 'everscale-inpage-provider';

import { useDebugger } from '../providers/useDebugger';
import { zeroPad } from '../common';

import TransactionIdForm, { TransactionResponse } from './TransactionIdForm.vue';

enum Status {
  NONE,
  SEARCH,
  APPLY,
  EXECUTE
}

type State = {
  transaction: Transaction;
  steps: number[];
  gasUsed: string[];
  gasCmds: string[];
  cmds: string[];
  stacks: string[][];
};

const { debuggerModule } = useDebugger();
const transaction = shallowRef<TransactionResponse>();
const state = shallowRef<State>();
const stackIndex = ref(0);
const status = ref<Status>(Status.NONE);

const displayedStatus = computed(() => {
  switch (status.value) {
    case Status.SEARCH:
      return 'searching transaction';
    case Status.APPLY:
      return 'applying state';
    case Status.EXECUTE:
      return 'executing';
    default:
      return undefined;
  }
});

const displayedTransaction = computed(() =>
  state.value != null ? JSON.stringify(state.value.transaction, undefined, 2) : undefined
);

watch(
  [debuggerModule, transaction],
  async ([debuggerModule, transaction], _, onCleanup) => {
    state.value = undefined;
    if (debuggerModule == null || transaction == null) {
      return;
    }

    const controller = new AbortController();
    const localState = { transactionChanged: false };
    onCleanup(() => {
      status.value = Status.NONE;
      controller.abort();
      localState.transactionChanged = true;
    });

    status.value = Status.APPLY;
    const account = await fetch('https://states.everscan.io/apply', {
      body: `{"account":"${transaction.rawTransaction.account}","lt":${transaction.rawTransaction.lt}}`,
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    })
      .then(res => res.json())
      .then(res => res.accountBoc)
      .catch(console.error);
    if (localState.transactionChanged) {
      return;
    }

    status.value = Status.EXECUTE;
    nextTick(() => {
      if (localState.transactionChanged) {
        return;
      }
      state.value = debuggerModule.execute(account, transaction.rawTransaction.data, transaction.configBoc);
      stackIndex.value = 0;
      status.value = Status.NONE;
    }).catch(console.error);
  },
  {
    immediate: true
  }
);

function onTransactionFound(tx?: TransactionResponse) {
  status.value = Status.NONE;
  transaction.value = tx;
}

function stackFirst() {
  stackIndex.value = 0;
}

function stackLast() {
  if (state.value?.stacks.length > 0) {
    stackIndex.value = state.value?.stacks.length - 1;
  }
}

function stackBackward() {
  if (stackIndex.value > 0) {
    stackIndex.value -= 1;
  }
}

function stackForward() {
  if (stackIndex.value + 1 < state.value?.stacks.length) {
    stackIndex.value += 1;
  }
}
</script>

<template>
  <div v-if="debuggerModule != null" class="section debugger-workspace">
    <div class="container is-fluid">
      <div class="columns">
        <div class="column is-3 is-full">
          <TransactionIdForm @change="onTransactionFound" @search="status = Status.SEARCH" />
          <template v-if="displayedStatus != null">Status: {{ displayedStatus }}</template>
          <pre v-if="displayedTransaction != null">{{ displayedTransaction }}</pre>
        </div>
        <div v-if="state != null" class="column is-3 is-flex-direction-row noselect">
          <h3 class="is-size-4 is-flex is-flex-direction-row">
            Commands
            <button class="button is-light ml-auto mr-2" @click="stackFirst()">
              <span class="icon"><i class="fas fa-fast-backward" /></span>
            </button>
            <button class="button is-info mr-2" :disabled="stackIndex === 0" @click="stackBackward()">
              <span class="icon"><i class="fas fa-backward" /></span>
            </button>
            <button
              class="button is-info mr-2"
              :disabled="stackIndex + 1 >= state.stacks.length"
              @click="stackForward()"
            >
              <span class="icon"><i class="fas fa-forward"></i></span>
            </button>
            <button class="button is-light" @click="stackLast()">
              <span class="icon"><i class="fas fa-fast-forward" /></span>
            </button>
          </h3>
          <hr />
          <div class="command-list-container">
            <ul class="command-list is-family-monospace">
              <li v-for="(step, i) in state.steps" :key="i">
                <span class="list-index">{{ zeroPad(step, 4) }}</span>
                <span :class="['tag', i === stackIndex ? 'is-success' : 'is-light']" @click="stackIndex = i">{{
                  state.cmds[i]
                }}</span>
              </li>
            </ul>
          </div>
        </div>
        <div v-if="state != null" class="column is-6 noselect">
          <h2 class="is-size-4 is-flex is-flex-direction-row">
            <button class="button is-light mr-2" v-clipboard="state.cmds[stackIndex]">
              <span class="icon"><i class="fas fa-copy" /></span>
            </button>
            <span class="command-title">{{ state.cmds[stackIndex] }}</span>
          </h2>
          <hr />
          <div class="command-list-container">
            <ul class="command-list is-family-monospace">
              <li v-for="(item, i) in state.stacks[stackIndex]" :key="i" class="is-flex">
                <span class="list-index">{{ i }}</span>
                <span class="tag is-light is-full">{{ item }}</span>
                <button class="button is-small is-light ml-2 mr-2" v-clipboard="item">
                  <span class="icon"><i class="fas fa-copy" /></span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="hero is-fullheight-with-navbar">
    <div class="hero-body is-justify-content-center">
      <div>
        <p class="title">Loading debugger...</p>
      </div>
    </div>
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
