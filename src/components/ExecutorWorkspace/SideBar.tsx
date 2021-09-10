import React, { useState } from 'react';
import classNames from 'classnames';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { ContractState, Transaction, TransactionId } from 'ton-inpage-provider';
import {
  convertAddress,
  convertTons,
  checkAddress,
  convertHash,
  transactionExplorerLink,
  convertDate,
  accountExplorerLink
} from '../../common';

type AddressFormProps = {
  inProgress: boolean;
  currentAddress?: string;
  onChangeAddress: (address: string) => void;
};

const AddressForm: React.FC<AddressFormProps> = ({ inProgress, currentAddress, onChangeAddress }) => {
  const [address, setAddress] = useState<string>('');

  const isSame = address.trim().toLowerCase() === currentAddress?.trim().toLowerCase();
  const isValid = checkAddress(address);

  return (
    <>
      <div className="field has-addons ">
        <div className="control is-expanded">
          <input
            className="input"
            type="text"
            value={address}
            spellCheck={false}
            disabled={inProgress}
            onChange={event => {
              setAddress(event.target.value);
            }}
          />
          <p className="help">Contract address</p>
        </div>
        <div className="control">
          <button
            className="button is-info"
            disabled={inProgress || isSame || !isValid}
            onClick={() => {
              !inProgress && !isSame && isValid && onChangeAddress(address);
            }}
          >
            Search
          </button>
        </div>
      </div>
    </>
  );
};

type AccountInfoProps = {
  address: string;
  state?: ContractState;
};

const AccountInfo: React.FC<AccountInfoProps> = ({ address, state }) => {
  const isDeployed = state?.isDeployed || false;

  return (
    <>
      <div className="is-flex is-flex-direction-row">
        <div className="field has-addons is-grouped mb-0">
          <div className="control">
            <CopyToClipboard text={address}>
              <button className="button is-light">{convertAddress(address)}</button>
            </CopyToClipboard>
            <p className="help">{isDeployed ? 'Deployed' : 'Not deployed'}</p>
          </div>
        </div>
        {state != null && (
          <CopyToClipboard text={state.balance}>
            <button className="button ml-1 is-white">{convertTons(state.balance)} TON</button>
          </CopyToClipboard>
        )}
      </div>
    </>
  );
};

type TransactionProps = {
  transaction: Transaction;
};

const TransactionItem: React.FC<TransactionProps> = ({ transaction }) => {
  const inMsg = transaction.inMessage;

  const parsedFunctionData =
    (transaction as any).parsedFunctionData != null
      ? JSON.stringify((transaction as any).parsedFunctionData, undefined, 2)
      : undefined;
  const parsedEventsData =
    (transaction as any).parsedEventsData != null
      ? JSON.stringify((transaction as any).parsedEventsData, undefined, 2)
      : undefined;

  return (
    <div className="box">
      <div className="columns mb-0">
        <div className="column is-family-monospace">
          <p>{convertDate(transaction.createdAt)}</p>
          <p className="help">Fees: {convertTons(transaction.totalFees)} TON</p>
        </div>
        <div className="column is-narrow-fullhd">
          <div className="field is-grouped is-grouped-multiline">
            {transaction.aborted && (
              <div className="control">
                <div className="tags has-addons">
                  <span className="tag is-danger">aborted</span>
                </div>
              </div>
            )}

            {transaction.exitCode != null && (
              <div className="control">
                <div className="tags has-addons">
                  <span className="tag is-dark">exit code</span>
                  <span className="tag is-info">{transaction.exitCode}</span>
                </div>
              </div>
            )}

            <a href={transactionExplorerLink(transaction.id.hash)} target="_blank" className="tag is-link">
              {convertHash(transaction.id.hash)}
              &nbsp;
              <span className="icon">
                <i className="fa fa-external-link-alt" />
              </span>
            </a>
          </div>
        </div>
      </div>
      {parsedFunctionData && (
        <>
          <div className="divider mt-1 mb-1">function:</div>
          <pre>{parsedFunctionData}</pre>
        </>
      )}
      {parsedEventsData && (
        <>
          <div className="divider mt-1 mb-1">events:</div>
          <pre>{parsedEventsData}</pre>
        </>
      )}
      <div className="divider mt-1 mb-1">in:</div>
      <div className={classNames('message', 'mb-0', { 'is-success': inMsg.src != null })}>
        <div className="message-body pt-2 pb-2 pr-2">
          <div className="columns">
            <div className="column is-family-monospace">
              {inMsg.src == null ? (
                <p className="help">External in</p>
              ) : (
                <>
                  <p>{convertTons(inMsg.value)} TON</p>
                  <p className="help">
                    From:&nbsp;
                    <a href={accountExplorerLink(inMsg.src)} target="_blank">
                      {convertAddress(inMsg.src.toString())}
                    </a>
                  </p>
                </>
              )}
            </div>
            <div className="column is-narrow">
              <div className="field is-grouped is-grouped-multiline">
                {inMsg.bounced && (
                  <div className="control">
                    <div className="tags has-addons">
                      <span className="tag is-warning">bounced</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {transaction.outMessages.length > 0 && <div className="divider mt-1 mb-1">out:</div>}
      {transaction.outMessages.map((msg, i) => {
        const isExternal = msg.dst == null;
        return (
          <div key={i} className={classNames('message', 'mb-1', { 'is-danger': !isExternal })}>
            <div className="message-body pt-2 pb-2 pr-2">
              <div className="columns">
                <div className="column is-family-monospace">
                  {msg.dst == null ? (
                    <p className="help">External out</p>
                  ) : (
                    <>
                      <p>{convertTons(msg.value)} TON</p>
                      <p className="help">
                        To:&nbsp;
                        <a href={accountExplorerLink(msg.dst)} target="_blank">
                          {convertAddress(msg.dst.toString())}
                        </a>
                      </p>
                    </>
                  )}
                </div>
                <div className="column is-narrow">
                  <div className="field is-grouped is-grouped-multiline">
                    {msg.bounce && (
                      <div className="control">
                        <div className="tags has-addons">
                          <span className="tag is-info">bounce</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

type SideBarProps = {
  version: number;
  inProgress: boolean;
  address?: string;
  state?: ContractState;
  transactionCount: number;
  transactions: Transaction[];
  onChangeAddress: (address: string) => void;
  onPreloadTransactions: (continuation: TransactionId) => void;
};

export const SideBar: React.FC<SideBarProps> = ({
  version,
  inProgress,
  address,
  state,
  transactions,
  onChangeAddress,
  onPreloadTransactions
}) => {
  const prevTransactionId =
    transactions.length > 0 ? transactions[transactions.length - 1].prevTransactionId : undefined;

  return (
    <div className="is-flex-direction-column">
      <div className="block">
        <AddressForm inProgress={inProgress} currentAddress={address} onChangeAddress={onChangeAddress} />
      </div>
      {address != null && (
        <div className="block">
          <AccountInfo address={address} state={state} />
        </div>
      )}
      {transactions.map(transaction => (
        <TransactionItem key={`${transaction.id.lt}${version}`} transaction={transaction} />
      ))}
      {prevTransactionId != null && (
        <button
          className={classNames('button', 'is-fullwidth', { 'is-loading': inProgress })}
          disabled={inProgress}
          onClick={() => onPreloadTransactions(prevTransactionId)}
        >
          Load more
        </button>
      )}
    </div>
  );
};
