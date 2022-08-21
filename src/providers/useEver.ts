import { ref, shallowRef, watch } from 'vue';
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

watch(
  [selectedAccount, selectedNetwork],
  async ([selectedAccount], _old, onCleanup) => {
    const address = selectedAccount?.address;
    if (address == null) {
      return;
    }
    selectedAccountBalance.value = undefined;

    const { state } = await ever.getFullContractState({ address });
    if (selectedAccount?.address != address) {
      return;
    }
    selectedAccountBalance.value = state?.balance;

    const subscription = await ever.subscribe('contractStateChanged', { address });
    onCleanup(() => subscription.unsubscribe().catch(console.error));

    subscription.on('data', event => {
      if (event.address.equals(selectedAccount?.address)) {
        selectedAccountBalance.value = event.state.balance;
      }
    });
  },
  {
    immediate: true
  }
);

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
