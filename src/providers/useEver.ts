import { createApp, ref, shallowRef, watch } from 'vue';
import { Permissions, Provider, ProviderNotInitializedException, ProviderRpcClient } from 'everscale-inpage-provider';

import ProviderSelector from '../components/ProviderSelector.vue';

type ConnectorWallet = {
  title: string;
  injected: {
    object: string;
    flag?: string;
    event?: string;
  };
};

type ConnectorParams = {
  supportedWallets: ConnectorWallet[];
};

let ensurePageLoaded: Promise<void>;
if (document.readyState === 'complete') {
  ensurePageLoaded = Promise.resolve();
} else {
  ensurePageLoaded = new Promise<void>(resolve => {
    window.addEventListener('load', () => {
      resolve();
    });
  });
}

class ProviderProxy implements Provider {
  inner?: Provider;

  request(data) {
    if (this.inner == null) {
      throw new ProviderNotInitializedException();
    } else {
      return this.inner.request(data);
    }
  }

  addListener(eventName, listener) {
    this.inner?.addListener(eventName, listener);
    return this;
  }

  removeListener(eventName, listener) {
    this.inner?.removeListener(eventName, listener);
    return this;
  }

  on(eventName, listener) {
    this.inner?.on(eventName, listener);
    return this;
  }

  once(eventName, listener) {
    this.inner?.once(eventName, listener);
    return this;
  }

  prependListener(eventName, listener) {
    this.inner?.prependListener(eventName, listener);
    return this;
  }

  prependOnceListener(eventName, listener) {
    this.inner?.prependOnceListener(eventName, listener);
    return this;
  }
}

class Connector {
  private readonly provider: ProviderProxy = new ProviderProxy();
  private providerPromise?: Promise<Provider>;

  constructor(private readonly params: ConnectorParams) {}

  public asProviderFallback(): () => Promise<Provider> {
    return () => {
      if (this.providerPromise == null) {
        this.providerPromise = new Promise<void>(resolve => {
          const onSelect = (provider: Provider) => {
            this.provider.inner = provider;
            resolve();
          };

          if (this.selectProvider(onSelect)) {
            return;
          }

          ensurePageLoaded.then(() => {
            if (this.selectProvider(onSelect)) {
              return;
            }

            for (const { injected } of this.params.supportedWallets) {
              if (injected.flag != null && injected.event != null && window[injected.flag] === true) {
                window.addEventListener(injected.event, _ => {
                  this.selectProvider(onSelect);
                });
              }
            }
          });
        }).then(() => this.provider);
      }
      return this.providerPromise;
    };
  }

  selectProvider(onSelect: (provider: Provider) => void): boolean {
    if (this.provider.inner != null) {
      return true;
    }

    const providers = this.getProviders();
    if (providers.length === 0) {
      return false;
    } else if (providers.length === 1) {
      onSelect(providers[0].provider);
      return true;
    }

    const modal = document.createElement('div');

    const selector = createApp(ProviderSelector, {
      providers: providers.map(({ provider, wallet }) => ({ title: wallet.title, object: provider })),
      onSelect: (provider: Provider) => {
        modal.remove();
        onSelect(provider);
      }
    });

    document.body.appendChild(modal);
    selector.mount(modal);

    return true;
  }

  getProviders(): { provider: Provider; wallet: ConnectorWallet }[] {
    const providers = new Array<{ provider: Provider; wallet: ConnectorWallet }>();

    for (const wallet of this.params.supportedWallets) {
      const object = wallet.injected.object;
      const provider = window[object];
      if (provider != null) {
        providers.push({
          provider,
          wallet
        });
      }
    }

    return providers;
  }
}

const connector = new Connector({
  supportedWallets: [
    {
      title: 'EVER Wallet',
      injected: {
        object: '__ever',
        event: 'ever#initialized'
      }
    },
    {
      title: 'VENOM Wallet',
      injected: {
        object: '__venom'
      }
    }
  ]
});

// NOTE: it uses fallback to allow using other extensions
const ever = new ProviderRpcClient({
  forceUseFallback: true,
  fallback: connector.asProviderFallback()
});

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
