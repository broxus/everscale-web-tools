import Decimal from 'decimal.js';
import moment from 'moment';
import { Address } from 'ton-inpage-provider';

window.ObjectExt = { keys: Object.keys };

const addressRegex = /^(?:-1|0):[0-9a-fA-F]{64}$/;

export const convertAddress = (address: string | undefined) =>
  address ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : '';

export const convertHash = (hash: string | undefined) => (hash ? `${hash?.slice(0, 4)}...${hash?.slice(-4)}` : '');

export const convertTons = (amount?: string) => new Decimal(amount || '0').div('1000000000').toFixed();

export const convertFromTons = (amount?: string) => new Decimal(amount || '0').mul('1000000000').ceil().toFixed();

export const checkAddress = (address: string) => addressRegex.test(address);

export const transactionExplorerLink = (hash: string) => `https://tonscan.io/transactions/${hash}`;

export const accountExplorerLink = (address: Address) => `https://tonscan.io/accounts/${address.toString()}`;

export const convertDate = (timestamp: number) => {
  return moment(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss');
};
