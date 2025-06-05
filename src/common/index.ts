import BigNumber from 'bignumber.js';
import { AbiParam, Address, TokenValue } from 'everscale-inpage-provider';

window.ObjectExt = { keys: Object.keys };

export const CURRENCY = import.meta.env.BYTIE_CURRENCY || 'EVER';

export const EMPTY_CELL = 'te6ccgEBAQEAAgAAAA==';
export const DEFAULT_ADDRESS = '0:0000000000000000000000000000000000000000000000000000000000000000';

export const deepCopy = (f: any) => JSON.parse(JSON.stringify(f));

export const convertAddress = (address: string | undefined) =>
  address ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : '';

export const convertHash = (hash: string | undefined) => (hash ? `${hash?.slice(0, 4)}...${hash?.slice(-4)}` : '');

export const fromNano = (amount?: string) => new BigNumber(amount || '0').div('1000000000').toFixed();

export const toNano = (amount?: string) => new BigNumber(amount || '0').multipliedBy('1000000000').toFixed(0);

const addressRegex = /^(?:-1|0):[\da-fA-F]{64}$/;
export const checkAddress = (address: string) => addressRegex.test(address);

const txIdRegex = /^[\da-fA-F]{64}$/;
export const checkTxId = (id: string) => txIdRegex.test(id);

export const toPaddedHexString = (num: number, len: number) => {
  const str = num.toString(16);
  return '0'.repeat(len - str.length) + str;
};

export const zeroPad = (num: number, places: number) => {
  const zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join('0') + num;
};

export const normalizeBase64 = (base64str: string) => {
  return base64str.replace(/_/g, '/').replace(/-/g, '+');
};

const BLOB_PART = /\/blob\//;
const EVERSCAN_CONTRACT_PATH = /^\/contracts\/([0-9a-fA-F]{64})\/?$/;
export const rewriteAbiUrl = (address: URL) => {
  if (address.origin == 'https://github.com' && address.pathname.endsWith('.abi.json')) {
    return new URL(`https://raw.githubusercontent.com${address.pathname.replace(BLOB_PART, '/')}`);
  } else if (address.origin == 'https://everscan.io') {
    const parsed = EVERSCAN_CONTRACT_PATH.exec(address.pathname);
    if (parsed != null && parsed.length > 1) {
      return new URL(`https://verify.everscan.io/abi/code_hash/${parsed[1]}`);
    }
  }
  return address;
};

export const transactionExplorerLink = (network: number, hash: string) => {
  switch (network) {
    case -239:
      return `https://tonviewer.com/transaction/${hash}`;
    case -3:
      return `https://testnet.tonviewer.com/transaction/${hash}`;
    case 2000:
      return `https://testnet.tychoprotocol.com/transactions/${hash}`;
    case -6001:
      return `https://e-tycho-devnet1.broxus.com/transactions/${hash}`;
    case 1:
      return `https://venomscan.com/transactions/${hash}`;
    case 42:
      return `https://everscan.io/transactions/${hash}`;
    case -42:
      return `https://testnet.everscan.io/transactions/${hash}`;
    case 7:
      return `https://hamsterscan.io/transactions/${hash}`;
    case 0:
      return `https://127.0.0.1/messages/messageDetails?id=${hash}`;
    default:
      return `https://everscan.io/transactions/${hash}`;
  }
};

export const accountExplorerLink = (network: number, address: Address | string) => {
  const addr = address.toString();
  switch (network) {
    case -239:
      return `https://tonviewer.com/${addr}`;
    case -3:
      return `https://testnet.tonviewer.com/${addr}`;
    case 2000:
      return `https://testnet.tychoprotocol.com/accounts/${addr}`;
    case 1:
      return `https://venomscan.com/accounts/${addr}`;
    case -6001:
      return `https://e-tycho-devnet1.broxus.com/accounts/${addr}`;
    case 42:
      return `https://everscan.io/accounts/${addr}`;
    case -42:
      return `https://testnet.everscan.io/accounts/${addr}`;
    case 7:
      return `https://hamsterscan.io/accounts/${addr}`;
    case 0:
      return `https://127.0.0.1/accounts/accountDetails?id=${encodeURIComponent(addr)}`;
    default:
      return `https://everscan.io/accounts/${addr}`;
  }
};

export const convertDate = (timestamp: number) => {
  const d = new Date(timestamp * 1000);
  return `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}-${('0' + d.getDate()).slice(-2)} ${(
    '0' + d.getHours()
  ).slice(-2)}:${('0' + d.getMinutes()).slice(-2)}:${('0' + d.getSeconds()).slice(-2)}`;
};

export const convertError = (error: any) => {
  if (typeof error.message === 'string') {
    return error.message;
  } else if (typeof error === 'object' && typeof error.error === 'string') {
    return error.error;
  } else {
    return error.toString();
  }
};

export type FieldType = 'checkbox' | 'number' | 'text' | 'tuple' | 'array' | 'map';

export type Structure = {
  name: string;
  type: string;
  optional?: boolean;
  fieldType: FieldType;
  key?: Structure;
  value?: Structure;
  defaultValue: TokenValue<string>;
  components?: Structure[];
};

const NUMBER_FIELD_REGEX = /^(?:(?:var)?u?int\d+|gram|timestamp|expire)$/;
const TEXT_FIELD_REGEX = /^(?:cell|address|address_std|bytes|string|fixedbytes\d+|pubkey)$/;

export function makeStructure(
  param: AbiParam,
  { optional, useType, showOriginalType }: { optional?: boolean; useType?: string; showOriginalType?: boolean }
): Structure {
  const checkType: string = useType || param.type;
  const showType: string = showOriginalType === true ? param.type : checkType;

  if (checkType == 'bool') {
    return {
      name: param.name,
      type: showType,
      optional,
      fieldType: 'checkbox',
      defaultValue: false
    };
  } else if (NUMBER_FIELD_REGEX.test(checkType)) {
    return {
      name: param.name,
      type: showType,
      optional,
      fieldType: 'number',
      defaultValue: '0'
    };
  } else if (TEXT_FIELD_REGEX.test(checkType)) {
    const defaultValue = ['address', 'address_std'].includes(checkType) ? DEFAULT_ADDRESS : checkType == 'cell' ? EMPTY_CELL : '';
    return {
      name: param.name,
      type: showType,
      optional,
      fieldType: 'text',
      defaultValue
    };
  } else if (checkType == 'tuple') {
    const defaultValue = {};
    let components = [];
    for (const component of param.components || []) {
      const structure = makeStructure(component, {});
      defaultValue[component.name] = structure.defaultValue;
      components.push(structure);
    }
    return {
      name: param.name,
      type: showType,
      optional,
      fieldType: 'tuple',
      defaultValue,
      components
    };
  } else if (checkType.endsWith(']')) {
    let endIndex = checkType.length - 2;
    for (; endIndex > 0 && checkType[endIndex] != '['; --endIndex) {}
    const value = makeStructure(param, {
      useType: checkType.substring(0, endIndex)
    });
    return {
      name: param.name,
      type: showType,
      optional,
      fieldType: 'array',
      value,
      defaultValue: []
    };
  } else if (checkType.startsWith('map')) {
    let valueIndex = checkType.indexOf(',', 4);
    const key = makeStructure(param, {
      useType: checkType.substring(4, valueIndex)
    });
    const value = makeStructure(param, {
      useType: checkType.substring(valueIndex + 1, checkType.length - 1)
    });
    return {
      name: param.name,
      type: showType,
      optional,
      fieldType: 'map',
      key,
      value,
      defaultValue: []
    };
  } else if (checkType.startsWith('ref')) {
    return makeStructure(param, {
      useType: checkType.substring(4, checkType.length - 1),
      showOriginalType: true
    });
  } else if (checkType.startsWith('optional')) {
    return makeStructure(param, {
      optional: true,
      useType: checkType.substring(9, checkType.length - 1),
      showOriginalType: true
    });
  } else {
    throw new Error(`Unknown type ${checkType}`);
  }
}
