import React, { useEffect, useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import * as core from '@core';

import './style.scss';
import classNames from 'classnames';

export type DebuggerWorkspaceProps = {};

type TransactionIdFormProps = {
  inProgress: boolean;
  currentId?: string;
  onChangeId: (id: string) => void;
};

const txRegex = /^[\da-fA-F]{64}$/;

const TransactionIdForm: React.FC<TransactionIdFormProps> = ({ inProgress, currentId, onChangeId }) => {
  const [id, setId] = useState<string>('');

  const isSame = id.trim().toLowerCase() === currentId?.trim().toLowerCase();
  const isValid = txRegex.test(id);

  return (
    <>
      <div className="field has-addons">
        <div className="control is-expanded">
          <input
            className="input"
            type="text"
            value={id}
            spellCheck={false}
            disabled={inProgress}
            onChange={event => {
              setId(event.target.value.trim());
            }}
          />
          <p className="help">Transaction id</p>
        </div>
        <div className="control">
          <button
            className="button is-info"
            disabled={inProgress || isSame || !isValid}
            onClick={() => {
              !inProgress && !isSame && isValid && onChangeId(id);
            }}
          >
            Search
          </button>
        </div>
      </div>
    </>
  );
};

const STATES_URL = 'https://states.everscan.io/apply';

const getState = (address: string, lt: string): Promise<string> =>
  fetch(STATES_URL, {
    body: `{"account":"${address}","lt":${lt}}`,
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  }).then(res => res.json());

const GQL_URL = 'https://gra01.main.everos.dev/graphql';

const findTransactionById = (id: string): Promise<Transaction | undefined> =>
  fetch(GQL_URL, {
    body: JSON.stringify({
      operationName: null,
      variables: {},
      query: `{transactions(filter:{id:{eq:"${id}"}}){lt(format:DEC),now,account_addr,in_message{boc}}}`
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  })
    .then(res => res.json())
    .then(res => {
      if (typeof res !== 'object' || res == null) {
        return;
      }
      const data = res['data'];
      if (typeof data !== 'object' || data == null) {
        return;
      }

      const transactions = data['transactions'];
      if (!Array.isArray(transactions) || transactions.length == 0) {
        return;
      }
      const item = transactions[0];
      if (typeof item !== 'object' || item == null) {
        return;
      }
      const lt = item['lt'];
      if (typeof lt !== 'string') {
        return;
      }
      const now = item['now'];
      if (typeof now !== 'number') {
        return;
      }
      const accountAddr = item['account_addr'];
      if (typeof accountAddr !== 'string') {
        return;
      }
      const inMessage = item['in_message'];
      if (typeof inMessage !== 'object' || inMessage == null) {
        return;
      }
      const messageBoc = inMessage['boc'];
      if (typeof messageBoc !== 'string') {
        return;
      }
      return {
        lt,
        now,
        accountAddr,
        messageBoc
      };
    });

type Transaction = {
  lt: string;
  now: number;
  accountAddr: string;
  messageBoc: string;
};

enum Status {
  NONE,
  SEARCH_TRANSACTION,
  APPLY_STATE,
  EXECUTE
}

const zeroPad = (num: number, places: number) => {
  const zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join('0') + num;
};

export const DebuggerWorkspace: React.FC<DebuggerWorkspaceProps> = ({}) => {
  const [inProgress, setInProgress] = useState(false);
  const [transaction, setTransaction] = useState<Transaction>();
  const [status, setStatus] = useState(Status.NONE);
  const [stackIndex, setStackIndex] = useState<number>();
  const [data, setData] = useState<any>();
  const [txId, setTxId] = useState<string>();

  useEffect(() => {
    if (txId == null) {
      return;
    }

    setInProgress(true);
    setStatus(Status.SEARCH_TRANSACTION);
    findTransactionById(txId)
      .then(async transaction => {
        setTransaction(transaction);
        if (transaction != null) {
          setStatus(Status.APPLY_STATE);
          const state = await getState(transaction.accountAddr, transaction.lt);
          setStatus(Status.EXECUTE);
          setStackIndex(undefined);

          const data = core.execute(state, transaction.messageBoc, transaction.now, transaction.lt);
          setData(data);
          if (data.stacks.length > 0) {
            setStackIndex(0);
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        setStatus(Status.NONE);
        setInProgress(false);
      });
  }, [txId]);

  useEffect(() => {
    if (transaction == null) {
      setData(undefined);
    } else {
      // setTransaction(core.execute);
    }
  }, [transaction]);

  return (
    <section className="section debugger-workspace">
      <div className="container is-fluid">
        <div className="columns">
          <div className="column is-3 is-full">
            <TransactionIdForm inProgress={inProgress} currentId={txId} onChangeId={setTxId} />
            {status != Status.NONE && (
              <>
                Status:{' '}
                {status == Status.SEARCH_TRANSACTION
                  ? 'search transaction'
                  : status == Status.APPLY_STATE
                  ? 'apply state'
                  : 'execute'}
              </>
            )}
            {data != null && <pre>{JSON.stringify((data as any).transaction, undefined, 4)}</pre>}
          </div>
          <div className="column is-3 is-flex-direction-row noselect">
            {data != null && (
              <>
                <h3 className="is-size-4 is-flex is-flex-direction-row">
                  Commands{' '}
                  <button className="button is-light ml-auto mr-2" onClick={() => setStackIndex(0)}>
                    <span className="icon">
                      <i className="fas fa-fast-backward"></i>
                    </span>
                  </button>
                  <button
                    className="button is-info mr-2"
                    disabled={stackIndex == null || stackIndex == 0}
                    onClick={() => {
                      if (stackIndex != null && stackIndex > 0) {
                        setStackIndex(stackIndex - 1);
                      }
                    }}
                  >
                    <span className="icon">
                      <i className="fas fa-backward"></i>
                    </span>
                  </button>
                  <button
                    className="button is-info mr-2"
                    disabled={stackIndex == null || stackIndex + 1 >= data.stacks.length}
                    onClick={() => {
                      if (stackIndex != null && stackIndex + 1 < data.stacks.length) {
                        const index = stackIndex + 1;
                        setStackIndex(index);
                      }
                    }}
                  >
                    <span className="icon">
                      <i className="fas fa-forward"></i>
                    </span>
                  </button>
                  <button
                    className="button is-light"
                    onClick={() => {
                      if (data.stacks.length > 0) {
                        const index = data.stacks.length - 1;
                        setStackIndex(index);
                      }
                    }}
                  >
                    <span className="icon">
                      <i className="fas fa-fast-forward"></i>
                    </span>
                  </button>
                </h3>
                <hr></hr>
                <div className="command-list-container">
                  <ul className="command-list is-family-monospace">
                    {data.steps.map((step: number, i: number) => {
                      return (
                        <li key={i}>
                          <span className="list-index">{zeroPad(step, 4)}</span>
                          <span
                            className={classNames('tag', {
                              'is-light': i != stackIndex,
                              'is-success': i == stackIndex
                            })}
                            onClick={() => {
                              setStackIndex(i);
                            }}
                          >
                            {data.cmds[i]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="column is-6 noselect">
            {data != null && stackIndex != null && (
              <>
                <h2 className="is-size-4 is-flex is-flex-direction-row">
                  <CopyToClipboard text={data.cmds[stackIndex]}>
                    <button className="button is-light mr-2">
                      <span className="icon">
                        <i className="fas fa-copy"></i>
                      </span>
                    </button>
                  </CopyToClipboard>
                  <span className="command-title">{data.cmds[stackIndex]}</span>
                </h2>
                <hr></hr>
                <div className="command-list-container">
                  <ul className="command-list is-family-monospace">
                    {data.stacks[stackIndex].map((item: string, i: number) => {
                      return (
                        <li key={i} className="is-flex">
                          <span className="list-index">{i}</span>
                          <span className="tag is-light is-full">{item}</span>
                          <CopyToClipboard text={data.stacks[stackIndex]}>
                            <button className="button is-small is-light ml-2 mr-2">
                              <span className="icon">
                                <i className="fas fa-copy"></i>
                              </span>
                            </button>
                          </CopyToClipboard>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
