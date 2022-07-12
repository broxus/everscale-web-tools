import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Permissions, ProviderRpcClient, Subscriber } from 'everscale-inpage-provider';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Mutex } from '@broxus/await-semaphore';
import init from '@core';
import './common';

import './styles/main.scss';

import { Navbar } from './components/Navbar';
import { ExecutorWorkspace } from './components/ExecutorWorkspace';
import { VisualizerWorkspace } from './components/VisualizerWorkspace';
import { SerializerWorkspace } from './components/SerializerWorkspace';
import { SignerWorkspace } from './components/SignerWorkspace';
import { DebuggerWorkspace } from './components/DebuggerWorkspace';

export const ever = new ProviderRpcClient();

const connectToWallet = async () => {
  await ever.requestPermissions({
    permissions: ['basic', 'accountInteraction']
  });
};

const changeAccount = async () => {
  await ever.changeAccount();
};

const disconnectFromWallet = async () => {
  await ever.disconnect();
};

const useQuery = () => {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
};

const walletMutex: Mutex = new Mutex();
let walletSubscriber: Subscriber | undefined = undefined;

const App: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasTonProvider, setHasTonProvider] = useState(false);
  const [networkGroup, setNetworkGroup] = useState<string>('mainnet');
  const [walletAccount, setWalletAccount] = useState<Permissions['accountInteraction']>();
  const [walletBalance, setWalletBalance] = useState<string>();
  const query = useQuery();

  useEffect(() => {
    if (walletAccount == null) {
      return;
    }

    walletMutex
      .use(async () => {
        walletSubscriber = new ever.Subscriber();
        const { state } = await ever.getFullContractState({
          address: walletAccount.address
        });

        setWalletBalance(state?.balance || '0');
        walletSubscriber.states(walletAccount.address).on(state => {
          setWalletBalance(state.state.balance);
        });
      })
      .catch(console.error);

    return () => {
      walletMutex
        .use(async () => {
          await walletSubscriber?.unsubscribe();
          setWalletBalance(undefined);
        })
        .catch(console.error);
    };
  }, [walletAccount]);

  useEffect(() => {
    ever.hasProvider().then(async hasTonProvider => {
      setHasTonProvider(hasTonProvider);
      if (hasTonProvider) {
        await ever.ensureInitialized();
        (await ever.subscribe('permissionsChanged')).on('data', event => {
          setWalletAccount(event.permissions.accountInteraction);
        });

        (await ever.subscribe('networkChanged')).on('data', event => {
          setNetworkGroup(event.selectedConnection);
        });

        const currentProviderState = await ever.getProviderState();
        setNetworkGroup(currentProviderState.selectedConnection);
        if (currentProviderState.permissions.accountInteraction != null) {
          await connectToWallet();
        }
      }
    });
  }, []);

  const onConnect = async () => {
    try {
      setIsConnecting(true);
      await connectToWallet();
    } finally {
      setIsConnecting(false);
    }
  };

  const signData = async (data: string) => {
    if (walletAccount?.publicKey == null) {
      throw new Error('Account not selected');
    }

    return await walletMutex.use(async () =>
      ever.signData({
        data: btoa(
          encodeURIComponent(data).replace(/%([0-9A-F]{2})/g, function toSolidBytes(_match, p1: any) {
            return String.fromCharCode(('0x' + p1) as any);
          })
        ),
        publicKey: walletAccount?.publicKey
      })
    );
  };

  return (
    <>
      <Navbar
        hasTonProvider={hasTonProvider}
        walletAddress={walletAccount?.address}
        walletBalance={walletBalance}
        isConnecting={isConnecting}
        onConnect={onConnect}
        onChangeAccount={changeAccount}
        onDisconnect={disconnectFromWallet}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/executor" />} />
        <Route
          key="executor"
          path="/executor"
          element={
            <ExecutorWorkspace
              hasTonProvider={hasTonProvider}
              networkGroup={networkGroup}
              walletAccount={walletAccount}
              selectedAddress={query.get('addr') || undefined}
              selectedAbi={query.get('abi') || undefined}
            />
          }
        />
        <Route key="visualizer" path="/visualizer" element={<VisualizerWorkspace />} />
        <Route key="serializer" path="/serializer" element={<SerializerWorkspace />} />
        <Route key="signer" path="/signer" element={<SignerWorkspace signData={signData} />} />
        <Route key="debugger" path="/debugger" element={<DebuggerWorkspace />} />
      </Routes>
    </>
  );
};

const initPromise = init();
const container = document.getElementById('root');
const root = createRoot(container!);
initPromise.then(() => {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});
