<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { Address, ContractState, Transaction, mergeTransactions } from 'everscale-inpage-provider';

import { useEver } from '../providers/useEver';
import { convertAddress, convertTons } from '../common';

import ExecutorAddressForm from './ExecutorAddressForm.vue';
import ExecutorTransaction from './ExecutorTransaction.vue';

const props = defineProps<{
  abi?: string;
}>();

const inProgress = ref(false);
const address = ref<string>();
const state = shallowRef<ContractState>();
const transactions = ref<Transaction[]>();
const preloadingTransactions = ref(false);

const displayedAddress = computed(() => convertAddress(address.value));
const displayedBalance = computed(() => `${convertTons(state.value?.balance)} EVER`);

const { ever } = useEver();

watch(address, async (address, _, onCleanup) => {
  if (address == null) {
    return;
  }

  const localState = { addressChanged: false };

  const [statesSubscription, transactionsSubscription] = await Promise.all([
    ever.subscribe('contractStateChanged', { address: new Address(address) }),
    ever.subscribe('transactionsFound', { address: new Address(address) })
  ]);
  onCleanup(async () => {
    localState.addressChanged = true;
    state.value = undefined;
    transactions.value = undefined;
    await Promise.allSettled([statesSubscription.unsubscribe(), transactionsSubscription.unsubscribe()]);
  });

  const { state: currentState } = await ever.getFullContractState({ address: new Address(address) });
  if (localState.addressChanged) {
    return;
  }
  state.value = currentState;
  statesSubscription.on('data', event => {
    if (address == event.address.toString()) {
      state.value = event.state;
    }
  });

  if (currentState?.lastTransactionId != null) {
    const { transactions: oldTransactions } = await ever.getTransactions({
      address: new Address(address),
      continuation: {
        lt: currentState.lastTransactionId.lt,
        hash: currentState.lastTransactionId.hash || '00'.repeat(32)
      }
    });
    if (localState.addressChanged) {
      return;
    }
    transactions.value = oldTransactions;
  } else {
    transactions.value = [];
  }

  transactionsSubscription.on('data', event => {
    if (address == event.address.toString()) {
      transactions.value = mergeTransactions(transactions.value, event.transactions, event.info);
    }
  });
});

async function preloadTransactions() {
  const currentTransactions = transactions.value;
  if (address.value == null || currentTransactions == null || currentTransactions.length == 0) {
    return;
  }
  const continuation = currentTransactions[currentTransactions.length - 1].id;

  preloadingTransactions.value = true;
  const { transactions: oldTransactions, info } = await ever
    .getTransactions({
      address: new Address(address.value),
      continuation
    })
    .finally(() => {
      preloadingTransactions.value = false;
    });

  const newTransactions = transactions.value;
  if (
    newTransactions != null &&
    newTransactions.length > 0 &&
    newTransactions[newTransactions.length - 1].id.hash == continuation.hash
  ) {
    transactions.value = mergeTransactions(newTransactions, oldTransactions, info);
  }
}
</script>

<template>
  <div class="is-flex-direction-column">
    <div class="block">
      <ExecutorAddressForm :disabled="inProgress" v-model="address" />
    </div>
    <div v-if="address != null" class="block">
      <div class="is-flex is-flex-direction-row">
        <div class="field has-addons is-grouped mb-0">
          <div class="control">
            <button class="button is-light" v-clipboard="address">{{ displayedAddress }}</button>
            <p class="help">{{ state?.isDeployed ? 'Deployed' : 'Not deployed' }}</p>
          </div>
        </div>
        <button v-if="state != null" class="button ml-1 is-white" v-clipboard="state.balance">
          {{ displayedBalance }}
        </button>
      </div>
    </div>

    <template v-if="transactions">
      <ExecutorTransaction v-for="transaction in transactions" :key="transaction.id.hash" />
    </template>

    <button
      :class="['button is-fullwidth', { 'is-loading': preloadingTransactions }]"
      :disabled="preloadingTransactions"
      @click="preloadTransactions"
    >
      Load more
    </button>
  </div>
</template>
