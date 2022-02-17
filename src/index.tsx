import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Permissions, ProviderRpcClient, Subscriber } from 'everscale-inpage-provider';
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

        const currentProviderState = await ever.getProviderState();
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
