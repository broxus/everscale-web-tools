<script setup lang="ts">
import { computed, onBeforeMount, onUnmounted, ref, watch } from 'vue';
import { Address, ContractState, Subscription } from 'everscale-inpage-provider';
import * as core from '@core';

import AddressSearchForm from './AddressSearchForm.vue';
import ConnectWalletStub from './ConnectWalletStub.vue';

import { convertError } from '../common';
import { useEver } from '../providers/useEver';
import { UnfreezeMode, useMicrowave } from '../providers/useMicrowave';

type ExtendedContractState = ContractState & { frozen?: core.FrozenState };

const { ever } = useEver();
const { microwaveReady, initializeMicrowave, deployMicrowave, unfreezeContract } = useMicrowave();

const inProgress = ref(false);
const progressStatus = ref<string>();
const error = ref<string>();

const accountAddress = ref<string>();
const contractState = ref<ExtendedContractState>();
const displayedState = computed(() => contractState.value && JSON.stringify(contractState.value, undefined, 2));

let contractSubscription: Subscription<'contractStateChanged'> | undefined;

const couldBeUnfrozen = computed(() => !contractState.value?.isDeployed);

const formState = ref<{
  statesApiUrl: string;
}>({
  statesApiUrl: 'https://states.everscan.io'
});

watch(
  [accountAddress],
  async ([accountAddress], _old, onCleanup) => {
    if (accountAddress == null) {
      return;
    }

    error.value = undefined;
    progressStatus.value = undefined;
    contractState.value = undefined;

    const state = { addressChanged: false };
    onCleanup(() => {
      state.addressChanged = true;
      contractSubscription?.unsubscribe().catch(console.error);
    });

    const { state: receivedState } = await ever.getFullContractState({
      address: new Address(accountAddress)
    });
    if (state.addressChanged) {
      return;
    }

    let frozen: core.FrozenState | undefined = undefined;
    if (receivedState != null) {
      try {
        frozen = core.parseFrozenState(receivedState.boc);
        (receivedState as ExtendedContractState).frozen = frozen;
      } catch (e: any) {
        console.error(e);
      }
      delete receivedState.boc;
    }
    contractState.value = receivedState;

    contractSubscription = await ever.subscribe('contractStateChanged', { address: new Address(accountAddress) });
    if (state.addressChanged) {
      return;
    }

    contractSubscription.on('data', event => {
      if (event.address.equals(accountAddress)) {
        (event.state as ExtendedContractState).frozen = frozen;
        contractState.value = event.state;
      }
    });
  },
  { immediate: true }
);

let cancelDeploy: () => void | undefined;
const doDeployMicrowave = () => {
  if (inProgress.value) {
    return;
  }
  inProgress.value = true;
  error.value = undefined;

  const deploy = deployMicrowave(status => {
    progressStatus.value = status;
  });
  cancelDeploy = deploy.cancel;
  deploy.promise
    .then(() => {
      error.value = undefined;
    })
    .catch(e => {
      error.value = convertError(e);
    })
    .finally(() => {
      inProgress.value = false;
      cancelDeploy = undefined;
    });
};

let cancelUnfreeze: () => void | undefined;
const doUnfreezeContract = (e: MouseEvent) => {
  if (inProgress.value) {
    return;
  }
  inProgress.value = true;
  error.value = undefined;

  const address = accountAddress.value;
  if (address == null) {
    return;
  }

  let mode = UnfreezeMode.WithDuePayment;
  if (e.shiftKey) {
    mode = UnfreezeMode.Fixed;
  } else if (e.altKey) {
    mode = UnfreezeMode.Destructive;
  }

  const unfreeze = unfreezeContract(
    {
      address,
      mode,
      ...formState.value
    },
    status => {
      progressStatus.value = status;
    }
  );
  cancelUnfreeze = unfreeze.cancel;
  unfreeze.promise
    .then(() => {
      error.value = undefined;
    })
    .catch(e => {
      error.value = convertError(e);
    })
    .finally(() => {
      inProgress.value = false;
      cancelUnfreeze = undefined;
    });
};

onBeforeMount(() => {
  initializeMicrowave();
});

onUnmounted(() => {
  cancelDeploy?.();
  contractSubscription?.unsubscribe().catch(console.error);
});
</script>

<template>
  <ConnectWalletStub>
    <template v-if="microwaveReady != null">
      <div v-if="microwaveReady" class="section">
        <div class="container is-fluid">
          <div class="columns">
            <div class="column is-4 is-full">
              <AddressSearchForm :disabled="inProgress" v-model="accountAddress" />
              <pre v-if="displayedState != null">{{ displayedState }}</pre>
            </div>
            <div class="column is-8 is-full" v-if="accountAddress">
              <div class="field">
                <div class="control">
                  <input type="text" class="input" spellcheck="false" :disabled="inProgress"
                    v-model="formState.statesApiUrl" />
                  <p class="help">States API</p>
                </div>
              </div>
              <button class="button is-success" :disabled="inProgress || contractState == null || !couldBeUnfrozen"
                @click="doUnfreezeContract">
                Unfreeze
              </button>
              <p v-if="progressStatus" class="help">{{ progressStatus }}</p>
              <p v-if="!couldBeUnfrozen" class="help is-danger">Account not frozen</p>
              <p v-if="error" class="help is-danger">{{ error }}</p>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="hero is-fullheight-with-navbar">
        <div class="hero-body is-justify-content-center">
          <div class="has-text-centered">
            <button :class="['button is-primary', inProgress && 'is-loading']" :disabled="inProgress"
              @click="doDeployMicrowave">
              Deploy microwave
            </button>
            <p v-if="inProgress && progressStatus != null" class="help">{{ progressStatus }}</p>
            <p v-if="error" class="help is-danger">{{ error }}</p>
          </div>
        </div>
      </div>
    </template>
  </ConnectWalletStub>
</template>
