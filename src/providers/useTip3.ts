import { ref, watch } from 'vue';
import { Address, ProviderRpcClient, Subscription, Transaction } from 'everscale-inpage-provider';
import BigNumber from 'bignumber.js';

import { fromNano } from '../common';
import { useTvmConnect } from './useTvmConnect';

const TIP3_ROOT_ABI = {
  'ABI version': 2,
  version: '2.2',
  header: ['pubkey', 'time', 'expire'],
  functions: [
    {
      name: 'name',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'string' }]
    },
    {
      name: 'symbol',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'string' }]
    },
    {
      name: 'decimals',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'uint8' }]
    },
    {
      name: 'totalSupply',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'uint128' }]
    },
    {
      name: 'rootOwner',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'address' }]
    },
    {
      name: 'walletOf',
      inputs: [
        { name: 'answerId', type: 'uint32' },
        { name: 'walletOwner', type: 'address' }
      ],
      outputs: [{ name: 'value0', type: 'address' }]
    }
  ],
  data: [
    { key: 1, name: 'name_', type: 'string' },
    { key: 2, name: 'symbol_', type: 'string' },
    { key: 3, name: 'decimals_', type: 'uint8' },
    { key: 4, name: 'rootOwner_', type: 'address' },
    { key: 5, name: 'walletCode_', type: 'cell' },
    { key: 6, name: 'randomNonce_', type: 'uint256' },
    { key: 7, name: 'deployer_', type: 'address' }
  ],
  events: []
} as const;

const TIP3_WALLET_ABI = {
  'ABI version': 2,
  version: '2.2',
  header: ['pubkey', 'time', 'expire'],
  functions: [
    {
      name: 'burn',
      inputs: [
        { name: 'amount', type: 'uint128' },
        { name: 'remainingGasTo', type: 'address' },
        { name: 'callbackTo', type: 'address' },
        { name: 'payload', type: 'cell' }
      ],
      outputs: []
    },
    {
      name: 'balance',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'uint128' }]
    },
    {
      name: 'owner',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'address' }]
    },
    {
      name: 'root',
      inputs: [{ name: 'answerId', type: 'uint32' }],
      outputs: [{ name: 'value0', type: 'address' }]
    },
    {
      name: 'transfer',
      inputs: [
        { name: 'amount', type: 'uint128' },
        { name: 'recipient', type: 'address' },
        { name: 'deployWalletValue', type: 'uint128' },
        { name: 'remainingGasTo', type: 'address' },
        { name: 'notify', type: 'bool' },
        { name: 'payload', type: 'cell' }
      ],
      outputs: []
    },
    {
      name: 'transferToWallet',
      inputs: [
        { name: 'amount', type: 'uint128' },
        { name: 'recipientTokenWallet', type: 'address' },
        { name: 'remainingGasTo', type: 'address' },
        { name: 'notify', type: 'bool' },
        { name: 'payload', type: 'cell' }
      ],
      outputs: []
    }
  ],
  data: [
    { key: 1, name: 'root_', type: 'address' },
    { key: 2, name: 'owner_', type: 'address' }
  ],
  events: []
} as const;

export type Tip3RootInfo = {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  rootOwner: string;
  walletAddress: string;
};

export type Tip3TransferParams = {
  recipient: string;
  amount: string;
  payload: string;
  notify?: boolean;
  attachedAmount: string;
};

const { tvmConnect } = useTvmConnect()

const getTip3RootInfo = async (address: string, provider: ProviderRpcClient): Promise<Tip3RootInfo> => {
  const tip3Root = new provider.Contract(TIP3_ROOT_ABI, new Address(address));

  const { state } = await provider.getFullContractState({
    address: tip3Root.address
  });

  const args = { answerId: 0 };
  const params = {
    cachedState: state,
    responsible: true
  };

  const [
    { value0: name },
    { value0: symbol },
    { value0: rawDecimals },
    { value0: rawTotalSupply },
    { value0: rawRootOwner }
  ] = await Promise.all([
    tip3Root.methods.name(args).call(params),
    tip3Root.methods.symbol(args).call(params),
    tip3Root.methods.decimals(args).call(params),
    tip3Root.methods.totalSupply(args).call(params),
    tip3Root.methods.rootOwner(args).call(params)
  ]);

  const decimals = parseInt(rawDecimals);
  const totalSupply = new BigNumber(rawTotalSupply).shiftedBy(-decimals).toFixed(decimals);
  const rootOwner = rawRootOwner.toString();

  return <Tip3RootInfo>{
    name,
    symbol,
    decimals,
    totalSupply,
    rootOwner
  };
};

const getTip3WalletAddress = async (root: string, owner: string, provider: ProviderRpcClient): Promise<string> => {
  const tip3Root = new provider.Contract(TIP3_ROOT_ABI, new Address(root));
  const { value0: walletAddress } = await tip3Root.methods
    .walletOf({ answerId: 0, walletOwner: new Address(owner) })
    .call({ responsible: true });
  return walletAddress.toString();
};

const getTip3WalletBalance = async (address: string, provider: ProviderRpcClient): Promise<string | undefined> => {
  const tip3Wallet = new provider.Contract(TIP3_WALLET_ABI, new Address(address));
  const { state } = await provider.getFullContractState({ address: tip3Wallet.address });

  if (state == null || !state.isDeployed) {
    return undefined;
  }

  const { value0: balance } = await tip3Wallet.methods
    .balance({
      answerId: 0
    })
    .call({ cachedState: state, responsible: true });
  return balance;
};

const transferTip3Tokens = async (
  owner: string,
  walletAddress: string,
  args: Tip3TransferParams,
  provider: ProviderRpcClient,
): Promise<Transaction> => {
  const tip3Wallet = new provider.Contract(TIP3_WALLET_ABI, new Address(walletAddress));

  const attachedAmount = new BigNumber(args.attachedAmount || '0').shiftedBy(9).plus(100000000).toFixed();

  const tx = await tip3Wallet.methods
    .transfer({
      amount: args.amount,
      recipient: new Address(args.recipient),
      deployWalletValue: '100000000',
      remainingGasTo: new Address(owner),
      notify: args.notify != null ? args.notify : args.payload != '',
      payload: args.payload
    })
    .send({
      amount: attachedAmount,
      from: new Address(owner),
      bounce: true
    });
  return tx;
};

export const useTip3 = () => {
  return {
    getTip3RootInfo,
    getTip3WalletAddress,
    getTip3WalletBalance,
    transferTip3Tokens
  };
};
