import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import ton, { Permissions, Subscriber } from 'ton-inpage-provider';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import { Mutex } from '@broxus/await-semaphore';

import './styles/main.scss';

import init from '../core/pkg';
import './common';

import { Navbar } from './components/Navbar';
import { ExecutorWorkspace } from './components/ExecutorWorkspace';
import { VisualizerWorkspace } from './components/VisualizerWorkspace';
import { SerializerWorkspace } from './components/SerializerWorkspace';
import { SignerWorkspace } from './components/SignerWorkspace';

const connectToWallet = async () => {
  await ton.requestPermissions({
    permissions: ['tonClient', 'accountInteraction']
  });
};

const disconnectFromWallet = async () => {
  await ton.disconnect();
};

const walletMutex: Mutex = new Mutex();
let walletSubscriber: Subscriber | undefined = undefined;

const App: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasTonProvider, setHasTonProvider] = useState(false);
  const [walletAccount, setWalletAccount] = useState<Permissions['accountInteraction']>();
  const [walletBalance, setWalletBalance] = useState<string>();

  useEffect(() => {
    if (walletAccount == null) {
      return;
    }

    walletMutex
      .use(async () => {
        walletSubscriber = ton.createSubscriber();
        const { state } = await ton.getFullContractState({
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
    ton.hasProvider().then(async hasTonProvider => {
      setHasTonProvider(hasTonProvider);
      if (hasTonProvider) {
        await ton.ensureInitialized();
        (await ton.subscribe('permissionsChanged')).on('data', event => {
          setWalletAccount(event.permissions.accountInteraction);
        });

        const currentProviderState = await ton.getProviderState();
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
      ton.signData({
        data: btoa(data),
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
        onDisconnect={disconnectFromWallet}
      />
      <Switch>
        <Route exact path="/">
          <Redirect to="/executor" />
        </Route>
        <Route key="executor" exact path="/executor">
          <ExecutorWorkspace hasTonProvider={hasTonProvider} walletAccount={walletAccount} />
        </Route>
        <Route key="visualizer" exact path="/visualizer">
          <VisualizerWorkspace />
        </Route>
        <Route key="serializer" exact path="/serializer">
          <SerializerWorkspace />
        </Route>
        <Route key="signer" exact path="/signer">
          <SignerWorkspace signData={signData} />
        </Route>
      </Switch>
    </>
  );
};

(async () => {
  await init();

  ReactDOM.render(
    <React.StrictMode>
      <Router>
        <App />
      </Router>
    </React.StrictMode>,
    document.getElementById('root')
  );
})();
