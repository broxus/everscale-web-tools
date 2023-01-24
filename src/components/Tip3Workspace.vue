<script setup lang="ts">
import { Address, ContractState, Subscription } from 'everscale-inpage-provider';
import { ref, computed, watch, onUnmounted } from 'vue'
import BigNumber from 'bignumber.js';
import { useRouter } from 'vue-router';

import ConnectWalletStub from './ConnectWalletStub.vue'
import AddressSearchForm from './AddressSearchForm.vue'

import { accountExplorerLink, checkAddress, convertAddress, convertError } from '../common';
import { useEver } from '../providers/useEver';
import { useTip3, Tip3RootInfo, Tip3TransferParams } from '../providers/useTip3';

const { push, currentRoute } = useRouter();
const { ever, selectedAccount, selectedNetwork } = useEver();
const { getTip3RootInfo, getTip3WalletAddress, getTip3WalletBalance, transferTip3Tokens } = useTip3();

type TokenWalletInfo = {
  owner: string;
  walletAddress: string;
  balance?: string;
};

const inProgress = ref(false);
const transferInProgress = ref(false);

const rootAddress = ref('');
const rootContractInfo = ref<Tip3RootInfo>();
const rootContractError = ref<string>();

const tokenWalletInfo = ref<TokenWalletInfo>();
const tokenWalletError = ref<string>();

const formData = ref<Tip3TransferParams>({
  recipient: '',
  amount: '',
  payload: '',
  attachedAmount: '1'
});
const formOutput = ref<string>();
const transferError = ref<string>();

const displayedRootOwnerAddress = computed(() => {
  const owner = rootContractInfo.value.rootOwner;
  if (owner == null) {
    return undefined;
  }
  return {
    address: convertAddress(owner),
    explorerLink: accountExplorerLink(selectedNetwork.value, owner),
  }
});

const displayedTokenWalletAddress = computed(() => {
  const walletAddress = tokenWalletInfo.value?.walletAddress;
  if (walletAddress == null) {
    return undefined;
  }
  return {
    address: convertAddress(walletAddress),
    explorerLink: accountExplorerLink(selectedNetwork.value, walletAddress),
  }
});

const displayedTokenWalletBalance = computed(() => {
  const info = rootContractInfo.value;
  const walletInfo = tokenWalletInfo.value;
  if (info == null || walletInfo == null) {
    return 'Unknown';
  }

  if (walletInfo.balance == null) {
    return 'Not deployed';
  }
  return new BigNumber(walletInfo.balance).shiftedBy(-info.decimals).toFixed(info.decimals);
});

const notifyRecipient = computed(() => {
  const currentFormData = formData.value;
  return currentFormData.notify != null ? currentFormData.notify : currentFormData.payload != ''
})

const subscriber = new ever.Subscriber();
onUnmounted(() => {
  subscriber.unsubscribe()
})


watch(
  () => currentRoute.value.params,
  (newParams, old) => {
    const newAddress = newParams['address'] as string;
    if (newAddress != old?.['address']) {
      rootAddress.value = newAddress != null && checkAddress(newAddress) ? newAddress : '';
    }
  },
  {
    immediate: true
  }
);


watch(rootAddress, async (newRoot, _old, onCleanup) => {
  if (newRoot == null || newRoot == '') {
    rootContractInfo.value = undefined;
    tokenWalletInfo.value = undefined;
    rootContractError.value = undefined;
    return;
  }

  const state = { addressChanged: false };
  onCleanup(() => {
    state.addressChanged = true;
  })

  inProgress.value = true;
  try {
    const info = await getTip3RootInfo(newRoot);
    if (!state.addressChanged) {
      rootContractInfo.value = info;
      rootContractError.value = undefined;
    }
  } catch (e: any) {
    rootContractInfo.value = undefined;
    rootContractError.value = convertError(e);
  } finally {
    inProgress.value = false;
  }
}, {
  immediate: true,
});

watch([rootAddress, () => selectedAccount.value?.address.toString()], async ([rootAddress, selectedAccount], _old, onCleanup) => {
  tokenWalletInfo.value = undefined;
  if (rootAddress == '' || selectedAccount == null) {
    return;
  }

  const state: {
    addressChanged: boolean,
    tokenWalletSubscription?: Subscription<'contractStateChanged'>,
  } = {
    addressChanged: false,
  };
  onCleanup(() => {
    state.addressChanged = true;
    state?.tokenWalletSubscription?.unsubscribe().catch(console.error);
  })

  let addr: string;
  try {
    addr = await getTip3WalletAddress(rootAddress, selectedAccount);
    if (state.addressChanged) {
      return;
    }

    tokenWalletInfo.value = {
      owner: selectedAccount,
      walletAddress: addr,
    };
    tokenWalletError.value = undefined;
  } catch (e) {
    tokenWalletInfo.value = undefined;
    tokenWalletError.value = convertError(e);
    return;
  }

  const updateBalance = async (address: string, contractState?: ContractState): Promise<boolean> => {
    if (address != addr || state.addressChanged) {
      return false;
    }

    let balance: string | undefined = undefined;
    if (contractState == null || contractState?.isDeployed === true) {
      try {
        balance = await getTip3WalletBalance(address);
        if (state.addressChanged) {
          return false;
        }
      } catch (e) {
        console.error(e);
        return true;
      }
    }

    let walletInfo = tokenWalletInfo.value;
    if (walletInfo != null) {
      walletInfo.balance = balance;
    }
    return true;
  };

  if (!(await updateBalance(addr))) {
    return;
  }

  const tokenWalletSubscription = await ever.subscribe('contractStateChanged', {
    address: new Address(addr)
  });
  if (state.addressChanged) {
    tokenWalletSubscription.unsubscribe().catch(console.error);
    return;
  }

  state.tokenWalletSubscription = tokenWalletSubscription;
  tokenWalletSubscription.on('data', async ({ address, state: contractState }) => {
    updateBalance(address.toString(), contractState);
  });
}, {
  immediate: true,
});

const openTip3Account = (address: string) => {
  push({ name: 'tip3', params: { address } });
};

const doTransferTip3Tokens = async () => {
  const info = rootContractInfo.value;
  const walletInfo = tokenWalletInfo.value;
  if (transferInProgress.value || info == null || walletInfo == null) {
    return false;
  }

  transferInProgress.value = true;
  transferError.value = undefined;

  try {
    const form = formData.value;
    const recipient = form.recipient;
    if (!checkAddress(recipient)) {
      throw new Error('Invalid recipient address');
    } else if (recipient == walletInfo.owner) {
      throw new Error('Cannot send TIP3 tokens to myself');
    }

    const amount = new BigNumber(form.amount).shiftedBy(info.decimals).toFixed(0);

    const output = await transferTip3Tokens(walletInfo.owner, walletInfo.walletAddress, {
      recipient,
      amount,
      payload: form.payload,
      notify: form.notify,
      attachedAmount: form.attachedAmount,
    });
    formOutput.value = JSON.stringify(output, undefined, 4);
    transferError.value = undefined;
  } catch (e) {
    formOutput.value = undefined;
    transferError.value = convertError(e);
  } finally {
    transferInProgress.value = false;
  }
}

</script>

<template>
  <ConnectWalletStub>
    <div class="section tip3-workspace">
      <div class="container is-fluid">
        <div class="columns">
          <div class="column is-4 is-full">
            <AddressSearchForm :disabled="inProgress" :modelValue="rootAddress"
              @update:modelValue="openTip3Account($event)" hint="Token root address" />
            <div class="column" v-if="rootContractInfo != null">

              <div class="card">
                <div class="card-content">
                  <p class="title">
                    {{ rootContractInfo.name }}
                  </p>
                  <div class="content">
                    <div class="is-flex is-flex-direction-row">
                      <div class="is-flex is-flex-direction-column">
                        <div>Symbol:</div>
                        <div>Decimals:</div>
                        <div>Total supply:</div>
                        <div>Owner:</div>
                      </div>
                      <div class="is-flex is-flex-direction-column ml-2">
                        <div><b>{{ rootContractInfo.symbol }}</b></div>
                        <div><b>{{ rootContractInfo.decimals }}</b></div>
                        <div><b>{{ rootContractInfo.totalSupply }}</b></div>
                        <div>
                          <a :href="displayedRootOwnerAddress.explorerLink" target="_blank" class="is-link">{{
                              displayedRootOwnerAddress.address
                          }}&nbsp;<span class="icon"><i class="fa fa-external-link-alt" /></span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card mt-5" v-if="tokenWalletInfo != null && rootContractInfo != null">
                <div class="card-content">
                  <div class="content">
                    <div class="is-flex is-flex-direction-row">
                      <div class="is-flex is-flex-direction-column">
                        <div>Token wallet:</div>
                        <div>Balance, {{ rootContractInfo.symbol }}:</div>
                      </div>
                      <div class="is-flex is-flex-direction-column ml-2">
                        <div>
                          <a :href="displayedTokenWalletAddress.explorerLink" target="_blank" class="is-link">{{
                              displayedTokenWalletAddress.address
                          }}&nbsp;<span class="icon"><i class="fa fa-external-link-alt" /></span>
                          </a>
                        </div>
                        <div><b>{{ displayedTokenWalletBalance }}</b></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            <p v-if="rootContractError" class="help is-danger">{{ rootContractError }}</p>
          </div>
          <div class="column is-8 is-full">
            <div v-if="tokenWalletInfo != null && rootContractInfo != null">
              <div class="function-item box">
                <label class="label">
                  <span>Transfer</span>
                </label>

                <div class="field">
                  <label class="label">Destination</label>
                  <div class="control">
                    <input class="input" type="text" placeholder="Address" v-model.trim="formData.recipient"
                      :disabled="transferInProgress">
                  </div>
                </div>

                <div class="field">
                  <label class="label">Amount, {{ rootContractInfo?.symbol }}</label>
                  <div class="control">
                    <input class="input" type="text" placeholder="Amount" v-model.trim="formData.amount"
                      :disabled="transferInProgress">
                  </div>
                </div>

                <div class="field">
                  <label class="label">Payload</label>
                  <div class="control">
                    <input class="input" type="text" placeholder="BOC encoded payload" v-model.trim="formData.payload"
                      :disabled="transferInProgress">
                  </div>
                </div>

                <div class="buttons">
                  <div class="field mb-0 mr-2 has-addons">
                    <div class="control">
                      <input class="input" type="text" placeholder="Amount, EVER" :disabled="transferInProgress"
                        v-model="formData.attachedAmount" />
                    </div>
                    <div class="control is-unselectable">
                      <button class="button" :disabled="transferInProgress" @click="formData.notify = !notifyRecipient">
                        <label class="checkbox">
                          <input type="checkbox" :disabled="transferInProgress" :checked="notifyRecipient"
                            @change.prevent="" /></label>&nbsp;Notify
                      </button>
                    </div>
                    <div class="control">
                      <button class="button is-info" :disabled="transferInProgress" @click="doTransferTip3Tokens">
                        Send
                      </button>
                    </div>
                  </div>

                  <button class="button" @click="formOutput = undefined">Clear output</button>
                </div>

                <template v-if="formOutput != null || transferError != null">
                  <div class="divider mt-1 mb-1">output:</div>
                  <pre v-if="formOutput != null" class="help">{{ formOutput }}</pre>
                  <p v-if="transferError != null" class="help is-danger">{{ transferError }}</p>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ConnectWalletStub>
</template>

<style lang="scss">
.tip3-workspace {
  .function-item {
    &>label {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;

      margin-bottom: 1em;

      .icon {
        position: absolute;

        width: 2em;
        height: 2em;

        cursor: pointer;
        background-color: whitesmoke;
        border-radius: 6px;

        &:hover {
          background-color: #eeeeee;
        }

        &:active {
          background-color: #e8e8e8;
        }
      }
    }
  }
}
</style>
