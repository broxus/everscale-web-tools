import { ref, watch } from 'vue';
import { Address, Subscription, LT_COLLATOR, TransactionId, Transaction } from 'everscale-inpage-provider';
import BigNumber from 'bignumber.js';
import * as core from '@core';

import { useEver } from './useEver';

const FACTORY_BOC =
  'te6ccgEBDQEA4gACATQDAQEBwAIAQ9AAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACACKP8AIMEB9KQgWJL0oOBfAoog7VPZBgQBCvSkIPShBQAAAgEgDAcCAv0KCAIBIAsJALcAe1AAfhhAdMAAcAAjjsw0z/TH9MfghAnss0dErryqfgAcPhk1fpA1NHIgBDPCwUSznD6AnbPC2vMyYEAoPsAXwPtUIIQJ7LNHSBZAVUB4IECABLXGAEwIVUB2YAIBIAsLAAU8jaAANN8wIPhh0NMAAcAAkvIw4dYB0wAwwADyafI3';
const MICROWAVE_BOC =
  'te6ccgEBCQEA3gACATQDAQEBwAIAQ9AAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACACKP8AIMEB9KQgWJL0oOBfAoog7VPZBgQBCvSkIPShBQAAAQPQQAcB/gHQ0wABwADysNYB0wAwwADyvDAgxwGa7UDtUHADXwPbMAHAAI5QMAHTH4IQU8UVHyIBuZcwwADyfPI84IIQU8UVHxK68ryCEDuaygBw+wLIgBDPCwUB+kACznD6AnbPC2sB1DABzMmBAID7ACBwcFkBVQFVAtkgWQFVAeAixwIIAAzAACIiAeI=';

const FACTORY_ABI = {
  'ABI version': 2,
  version: '2.2',
  header: ['time', 'expire'],
  functions: [
    {
      name: 'constructor',
      inputs: [
        { name: 'dest', type: 'address' },
        { name: 'state_init', type: 'cell' }
      ],
      outputs: []
    }
  ],
  fields: [{ name: '__uninitialized', type: 'bool' }],
  events: []
} as const;

const MICROWAVE_ABI = {
  'ABI version': 2,
  version: '2.2',
  functions: [
    {
      name: 'deploy',
      inputs: [
        {
          name: 'dest',
          type: 'address'
        },
        {
          name: 'state_init',
          type: 'cell'
        }
      ],
      outputs: []
    }
  ],
  events: [],
  headers: []
} as const;

const initialized = ref(false);
const microwaveReady = ref<boolean>();

const { ever, selectedAccount, selectedNetwork } = useEver();

type Addresses = {
  factory: string;
  microwave: string;
};

const addressesPromise: Promise<Addresses | undefined> = ever.hasProvider().then(async hasProvider => {
  if (!hasProvider) {
    return undefined;
  }

  await ever.ensureInitialized();
  const [{ hash: factoryHash }, { hash: microwaveHash }] = await Promise.all([
    ever.rawApi.getBocHash({ boc: FACTORY_BOC }),
    ever.rawApi.getBocHash({ boc: MICROWAVE_BOC })
  ]);

  return {
    factory: `0:${factoryHash}`,
    microwave: `0:${microwaveHash}`
  };
});

const initializeMicrowave = () => {
  initialized.value = true;
};

export enum UnfreezeMode {
  WithDuePayment,
  Fixed,
  Destructive
}

export type UnfreezeContractParams = {
  address: string;
  mode: UnfreezeMode;
  statesApiUrl: string;
};

const unfreezeContract = (args: UnfreezeContractParams, setStatus: (status?: string) => void) => {
  const state: {
    cancelled: boolean;
    controller?: AbortController;
    microwaveSubscription?: Subscription<'transactionsFound'>;
    targetSubscription?: Subscription<'transactionsFound'>;
    reject?: () => void;
  } = { cancelled: false };

  const promise = (async () => {
    const addresses = await addressesPromise;
    if (addresses == null) {
      return;
    }

    const accountAddress = new Address(args.address);
    const microwaveAddress = new Address(addresses.microwave);

    setStatus('computing due payment');
    const { state: accountState } = await ever.getFullContractState({ address: accountAddress });
    if (accountState == null) {
      throw new Error('Account is uninit');
    }
    const frozen = core.parseFrozenState(accountState.boc);
    if (frozen == null) {
      throw new Error('Account not frozen');
    }

    let amount: BigNumber;
    switch (args.mode) {
      case UnfreezeMode.WithDuePayment: {
        amount = new BigNumber('1000000000');
        if (frozen.duePayment != null) {
          amount = amount.plus(frozen.duePayment);
        }
        break;
      }
      case UnfreezeMode.Destructive: {
        amount = new BigNumber('200000000'); // 0.2 EVER
        break;
      }
      default: {
        amount = new BigNumber('1000000000'); // 1 EVER
        break;
      }
    }

    setStatus('searching for freeze transaction');
    let freezeTransactionLt: string | undefined;
    let continuation: TransactionId | undefined = undefined;
    outer: while (true) {
      const batch = await ever.getTransactions({
        address: accountAddress,
        continuation
      });
      if (state.cancelled) {
        return;
      }

      for (const transaction of batch.transactions) {
        if (transaction.endStatus !== 'frozen') {
          throw new Error('Account not frozen');
        }
        if (transaction.origStatus !== 'frozen') {
          freezeTransactionLt = transaction.id.lt;
          break outer;
        }
      }

      continuation = batch.continuation;
      if (continuation == null) {
        break;
      }
    }
    if (freezeTransactionLt == null) {
      throw new Error('Freeze transaction not found');
    }

    setStatus('applying state');
    if (!args.statesApiUrl.startsWith('http://') && !args.statesApiUrl.startsWith('https://')) {
      args.statesApiUrl = `https://${args.statesApiUrl}`;
    }

    state.controller = new AbortController();
    const accountBoc = await fetch(`${args.statesApiUrl}/apply`, {
      body: `{"account":"${args.address}","lt":${freezeTransactionLt}}`,
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: state.controller.signal
    })
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          return res.json().then((e: any) => {
            throw e;
          });
        }
      })
      .then(res => res.accountBoc)
      .finally(() => (state.controller = undefined));
    if (state.cancelled) {
      return;
    }

    const stateInit = core.parseStateInit(accountBoc);
    if (stateInit == null) {
      throw new Error('Failed to prepare state');
    }

    setStatus('creating subscriptions');
    const [microwaveSubscription, targetSubscription] = await Promise.all([
      ever.subscribe('transactionsFound', { address: microwaveAddress }),
      ever.subscribe('transactionsFound', { address: accountAddress })
    ]);
    state.microwaveSubscription = microwaveSubscription;
    state.targetSubscription = targetSubscription;
    if (state.cancelled) {
      return;
    }

    type Entry = {
      resolve: (tx: Transaction) => void;
      promise: Promise<Transaction>;
    };

    const initSubscription = (subscription: Subscription<'transactionsFound'>) => {
      const messages: Map<string, Entry> = new Map();
      subscription.on('data', batch => {
        if (state.cancelled) {
          return;
        }
        for (const tx of batch.transactions) {
          const existingTx = messages.get(tx.inMessage.hash);
          if (existingTx != null) {
            existingTx.resolve(tx);
          } else {
            messages.set(tx.inMessage.hash, {
              resolve: _tx => {},
              promise: Promise.resolve(tx)
            });
          }
        }
      });
      return messages;
    };

    const microwaveMessages = initSubscription(state.microwaveSubscription);
    const targetMessages = initSubscription(state.targetSubscription);

    setStatus('sending unfreeze message');

    const from = selectedAccount.value?.address;
    if (from == null) {
      throw new Error('Account not selected');
    }

    const walletTx = await new ever.Contract(MICROWAVE_ABI, microwaveAddress).methods
      .deploy({
        dest: accountAddress,
        state_init: stateInit
      })
      .send({
        from,
        amount: amount.toFixed(),
        bounce: false
      });
    if (state.cancelled) {
      return;
    }

    const waitTx = async (tx: Transaction, messages: Map<string, Entry>) => {
      let outMsgHash: string | undefined;
      for (const msg of tx.outMessages) {
        if (msg.dst != null) {
          outMsgHash = msg.hash;
          break;
        }
      }
      if (outMsgHash == null) {
        throw new Error('Deploy transaction failed');
      }

      const nextTx = messages.get(outMsgHash);
      if (nextTx != null) {
        return nextTx.promise;
      } else {
        let resolve: (tx: Transaction | undefined) => void;
        const promise = new Promise<Transaction | undefined>(resolvePromise => {
          resolve = tx => resolvePromise(tx);
          state.reject = () => resolvePromise(undefined);
        });
        messages.set(outMsgHash, { resolve, promise });
        return promise;
      }
    };

    setStatus('waiting microwave transaction');
    const microwaveTx = await waitTx(walletTx, microwaveMessages);
    if (microwaveTx == null || state.cancelled) {
      return;
    }

    setStatus('waiting unfreeze transaction');
    const targetTx = await waitTx(microwaveTx, targetMessages);
    if (targetTx == null || state.cancelled) {
      return;
    }
  })().finally(() => {
    setStatus(undefined);
    state.targetSubscription?.unsubscribe().catch(console.error);
    state.microwaveSubscription?.unsubscribe().catch(console.error);
  });

  const cancel = () => {
    state.cancelled = true;
    if (state.controller != null) {
      state.controller.abort();
      state.controller = undefined;
    }
    state.reject?.();
  };

  return { promise, cancel };
};

const deployMicrowave = (setStatus: (status?: string) => void) => {
  const state: {
    cancelled: boolean;
    factorySubscription?: Subscription<'contractStateChanged'>;
    microwaveSubscription?: Subscription<'contractStateChanged'>;
  } = {
    cancelled: false
  };

  const promise = (async () => {
    const addresses = await addressesPromise;
    const selectedAccountAddress = selectedAccount.value?.address;
    if (addresses == null || selectedAccountAddress == null || state.cancelled) {
      return;
    }

    const factoryAddress = new Address(addresses.factory);
    const microwaveAddress = new Address(addresses.microwave);

    setStatus('creating subscription');
    const [factorySubscription, microwaveSubscription] = await Promise.all([
      ever.subscribe('contractStateChanged', {
        address: factoryAddress
      }),
      ever.subscribe('contractStateChanged', {
        address: microwaveAddress
      })
    ]);
    state.factorySubscription = factorySubscription;
    state.microwaveSubscription = microwaveSubscription;
    if (state.cancelled) {
      return;
    }

    const REQUIRED_BALANCE = '900000000';

    let resolveBalance: () => void;
    const balancePromise = new Promise<void>(promiseResolve => {
      resolveBalance = () => promiseResolve();
    });

    factorySubscription.on('data', event => {
      if (state.cancelled || LT_COLLATOR.compare(event.state.balance, REQUIRED_BALANCE) > 0) {
        resolveBalance();
      }
    });

    let resolveMicrowave: () => void;
    const microwavePromise = new Promise<void>(promiseResolve => {
      resolveMicrowave = () => promiseResolve();
    });

    microwaveSubscription.on('data', event => {
      if (state.cancelled || event.state.isDeployed) {
        resolveMicrowave();
      }
    });

    setStatus('fetching states');
    const [{ state: factoryState }, { state: microwaveState }] = await Promise.all([
      ever.getFullContractState({ address: factoryAddress }),
      ever.getFullContractState({ address: microwaveAddress })
    ]);
    if (state.cancelled || microwaveState?.isDeployed === true) {
      return;
    }

    if (factoryState != null && LT_COLLATOR.compare(factoryState.balance, REQUIRED_BALANCE) > 0) {
      resolveBalance();
    } else {
      setStatus('sending initial balance');
      await ever.sendMessage({
        sender: selectedAccountAddress,
        recipient: factoryAddress,
        bounce: false,
        amount: '1000000000'
      });
      if (state.cancelled) {
        return;
      }
    }

    setStatus('waiting for readiness');
    await balancePromise;
    if (state.cancelled) {
      return;
    }

    setStatus('deploying factory');
    await new ever.Contract(FACTORY_ABI, factoryAddress).methods
      .constructor({
        dest: new Address(addresses.microwave),
        state_init: MICROWAVE_BOC
      })
      .sendExternal({
        withoutSignature: true,
        stateInit: FACTORY_BOC
      });
    if (state.cancelled) {
      return;
    }

    setStatus('deploying microwave');
    await microwavePromise;
  })().finally(() => {
    setStatus(undefined);
    if (state.factorySubscription != null) {
      state.factorySubscription.unsubscribe().catch(console.error);
    }
    if (state.microwaveSubscription != null) {
      state.microwaveSubscription.unsubscribe().catch(console.error);
    }
  });

  const cancel = () => (state.cancelled = true);

  return { promise, cancel };
};

watch(
  [initialized, selectedNetwork],
  async ([initialized], _old, onCleanup) => {
    if (!initialized) {
      return;
    }

    const state: {
      networkChanged: boolean;
      subscription?: Promise<Subscription<'contractStateChanged'>>;
    } = {
      networkChanged: false
    };
    onCleanup(() => {
      state.networkChanged = true;
      if (state.subscription != null) {
        state.subscription.then(s => s.unsubscribe()).catch(console.error);
      }
    });

    const addresses = await addressesPromise;
    if (addresses == null || state.networkChanged) {
      return;
    }

    const microwaveAddress = new Address(addresses.microwave);

    const { state: microwaveContract } = await ever.getFullContractState({
      address: microwaveAddress
    });
    if (state.networkChanged) {
      return;
    }

    if (microwaveContract?.isDeployed === true) {
      microwaveReady.value = true;
      return;
    }

    microwaveReady.value = false;

    state.subscription = ever.subscribe('contractStateChanged', { address: microwaveAddress });
    const subscription = await state.subscription;
    if (state.networkChanged) {
      return;
    }

    subscription.on('data', event => {
      if (state.networkChanged) {
        return;
      }
      if (event.state.isDeployed) {
        microwaveReady.value = true;
        delete state.subscription;
        subscription.unsubscribe().catch(console.error);
      }
    });
  },
  {
    immediate: true
  }
);

export function useMicrowave() {
  return {
    microwaveReady,
    initializeMicrowave,
    deployMicrowave,
    unfreezeContract
  };
}
