import Decimal from 'decimal.js';
import moment from 'moment';
import { Address } from 'everscale-inpage-provider';

window.ObjectExt = { keys: Object.keys };

const addressRegex = /^(?:-1|0):[0-9a-fA-F]{64}$/;

export const convertAddress = (address: string | undefined) =>
  address ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : '';

export const convertHash = (hash: string | undefined) => (hash ? `${hash?.slice(0, 4)}...${hash?.slice(-4)}` : '');

export const convertTons = (amount?: string) => new Decimal(amount || '0').div('1000000000').toFixed();

export const convertFromTons = (amount?: string) => new Decimal(amount || '0').mul('1000000000').ceil().toFixed();

export const checkAddress = (address: string) => addressRegex.test(address);

export const transactionExplorerLink = (network: string, hash: string) => {
  switch (network) {
    case 'mainnet':
      return `https://tonscan.io/transactions/${hash}`;
    case 'testnet':
      return `https://dev.tonscan.io/transactions/${hash}`;
    case 'fld':
      return `https://fld.ever.live/messages/messageDetails?id=${hash}`;
    case 'localnet':
      return `https://127.0.0.1/messages/messageDetails?id=${hash}`;
    default:
      return `https://tonscan.io/transactions/${hash}`;
  }
};

export const accountExplorerLink = (network: string, address: Address) => {
  switch (network) {
    case 'mainnet':
      return `https://tonscan.io/accounts/${address.toString()}`;
    case 'testnet':
      return `https://dev.tonscan.io/accounts/${address.toString()}`;
    case 'fld':
      return `https://fld.ever.live/accounts/accountDetails?id=${encodeURIComponent(address.toString())}`;
    case 'localnet':
      return `https://127.0.0.1/accounts/accountDetails?id=${encodeURIComponent(address.toString())}`;
    default:
      return `https://tonscan.io/accounts/${address.toString()}`;
  }
};

export const convertDate = (timestamp: number) => {
  return moment(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss');
};

export const convertError = (error: any) => {
  if (typeof error.message === 'string') {
    return error.message;
  } else {
    return error.toString();
  }
};
