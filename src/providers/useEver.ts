import { ref, shallowRef, watchEffect } from 'vue';
import { Permissions, ProviderRpcClient } from 'everscale-inpage-provider';

const ever = new ProviderRpcClient();

const connectToWallet = async () => {
  await ever.requestPermissions({
    permissions: ['basic', 'accountInteraction']
  });
};

const changeAccount = async () => {
  await ever.changeAccount();
};

const disconnect = async () => {
  await ever.disconnect();
};

const hasProvider = ref(false);
const selectedAccount = shallowRef<Permissions['accountInteraction']>();
const selectedAccountBalance = ref<string>();
const selectedNetwork = ref<string>();

ever.hasProvider().then(async hasTonProvider => {
  if (!hasTonProvider) {
    return;
  }
  hasProvider.value = true;

  await ever.ensureInitialized();

  (await ever.subscribe('permissionsChanged')).on('data', event => {
    selectedAccount.value = event.permissions.accountInteraction;
  });

  (await ever.subscribe('networkChanged')).on('data', event => {
    selectedNetwork.value = event.selectedConnection;
  });

  const currentProviderState = await ever.getProviderState();
  selectedNetwork.value = currentProviderState.selectedConnection;
  if (currentProviderState.permissions.accountInteraction != null) {
    await connectToWallet();
  }
});

watchEffect(async onCleanup => {
  const address = selectedAccount.value?.address;
  if (address == null) {
    return;
  }
  selectedAccountBalance.value = undefined;

  const { state } = await ever.getFullContractState({ address });
  if (selectedAccount.value?.address != address) {
    return;
  }
  selectedAccountBalance.value = state.balance;

  const subscription = await ever.subscribe('contractStateChanged', { address });
  onCleanup(() => subscription.unsubscribe().catch(console.error));

  subscription.on('data', event => {
    if (event.address.equals(selectedAccount.value?.address)) {
      selectedAccountBalance.value = event.state.balance;
    }
  });
});

export function useEver() {
  return {
    ever,
    hasProvider,
    selectedAccount,
    selectedAccountBalance,
    selectedNetwork,
    connectToWallet,
    changeAccount,
    disconnect
  };
}
