<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { Address, ContractState, Transaction, mergeTransactions } from 'everscale-inpage-provider';

import { CURRENCY, convertAddress, fromNano } from '../common';

import AddressSearchForm from './AddressSearchForm.vue';
import ExecutorTransaction from './ExecutorTransaction.vue';
import { useTvmConnect } from '../providers/useTvmConnect';

const props = defineProps<{
  address?: string;
  abi?: string;
}>();

const emit = defineEmits<{
  (e: 'update:address', address?: string): void;
  (e: 'update:codeHash', codeHash?: string): void;
}>();

const inProgress = ref(false);
const state = shallowRef<ContractState>();
const transactions = ref<Transaction[]>();
const preloadingTransactions = ref(false);
const methods = shallowRef<string[]>();

const displayedAddress = computed(() => convertAddress(props.address));
const displayedBalance = computed(() => `${fromNano(state.value?.balance)} ${CURRENCY}`);

const { tvmConnect, tvmConnectState } = useTvmConnect()

watch(
  [() => props.address, () => tvmConnectState.value.isReady],
  async ([address, isReady], _, onCleanup) => {
    const provider = tvmConnect.getProvider();

    if (address == null || !provider || !isReady) {
      return;
    }

    const localState = { addressChanged: false };

    const [statesSubscription, transactionsSubscription] = await Promise.all([
      provider.subscribe('contractStateChanged', { address: new Address(address) }),
      provider.subscribe('transactionsFound', { address: new Address(address) })
    ]);
    onCleanup(async () => {
      localState.addressChanged = true;
      state.value = undefined;
      transactions.value = undefined;
      await Promise.allSettled([statesSubscription.unsubscribe(), transactionsSubscription.unsubscribe()]);
    });

    const { state: currentState } = await provider.getFullContractState({ address: new Address(address) });
    if (localState.addressChanged) {
      return;
    }
    state.value = currentState;
    emit('update:codeHash', currentState?.codeHash);
    statesSubscription.on('data', event => {
      if (address == event.address.toString()) {
        state.value = event.state;
      }
    });

    if (currentState?.lastTransactionId != null) {
      const { transactions: oldTransactions } = await provider.getTransactions({
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
  },
  {
    immediate: true
  }
);

watch(
  () => props.abi,
  abi => {
    if (abi == null) {
      methods.value = undefined;
      return;
    }
    try {
      const parsed = JSON.parse(abi);
      methods.value = parsed.functions.map(f => f.name);
    } catch {
      methods.value = undefined;
    }
  },
  {
    immediate: true
  }
);

async function preloadTransactions() {
  const currentTransactions = transactions.value;
  const address = props.address;
  const provider = tvmConnect.getProvider()
  if (address == null || currentTransactions == null || currentTransactions.length == 0 || !provider) {
    return;
  }
  const continuation = currentTransactions[currentTransactions.length - 1].prevTransactionId;
  if (continuation == null) {
    return;
  }

  preloadingTransactions.value = true;
  const { transactions: oldTransactions, info } = await provider
    .getTransactions({
      address: new Address(address),
      continuation: {
        hash: continuation.hash,
        lt: continuation.lt
      }
    })
    .finally(() => {
      preloadingTransactions.value = false;
    });

  const newTransactions = transactions.value;
  if (
    newTransactions != null &&
    newTransactions.length > 0 &&
    newTransactions[newTransactions.length - 1].prevTransactionId?.hash == continuation.hash
  ) {
    transactions.value = mergeTransactions(newTransactions, oldTransactions, info);
  }
}
</script>

<template>
  <div class="is-flex-direction-column">
    <div class="block">
      <AddressSearchForm
        :disabled="inProgress"
        :modelValue="address"
        @update:modelValue="emit('update:address', $event)"
      />
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
      <ExecutorTransaction
        v-for="transaction in transactions"
        :key="transaction.id.hash"
        :transaction="transaction"
        :abi="abi"
        :methods="methods"
      />

      <button
        v-if="transactions.length > 0 && transactions[transactions.length - 1].prevTransactionId != null"
        :class="['button is-fullwidth', { 'is-loading': preloadingTransactions }]"
        :disabled="preloadingTransactions"
        @click="preloadTransactions"
      >
        Load more
      </button>
    </template>
  </div>
</template>
