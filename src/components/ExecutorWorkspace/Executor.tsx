import React, { useEffect, useState } from 'react';
import { ContractState, Permissions, AbiParam } from 'everscale-inpage-provider';
import { convertError, convertFromTons } from '../../common';
import classNames from 'classnames';

import * as core from '@core';
import { FunctionInput } from './FunctionInput';
import { ever } from '../../';

const DEFAULT_ABI_NAME = 'abi1';
const BLOB_PART = /\/blob\//;
const convertLink = (address: URL) => {
  if (address.origin == 'https://github.com' && address.pathname.endsWith('.abi.json')) {
    return new URL(`https://raw.githubusercontent.com${address.pathname.replace(BLOB_PART, '/')}`);
  }
  if (address.origin.includes('abi.rs')) {
    return address;
  }
  return address;
};

const getAllAbi = () => Object.keys(localStorage).map(name => ({ name, abi: localStorage.getItem(name) }));

let abiItems = getAllAbi();

export type ParsedAbi = {
  abi: string;
  data: object;
  functionHandlers: {
    abi: core.AbiParam[];
    handler: core.AbiFunctionHandler;
  }[];
  functions: { [name: string]: { inputs: AbiParam[]; outputs: AbiParam[] } };
  functionNames: string[];
  events: { [name: string]: { inputs: AbiParam[] } };
  eventNames: string[];
};

enum LoadAbiType {
  FROM_FILE,
  FROM_TEXT,
  FROM_LINK
}

type AbiFormProps = {
  inProgress: boolean;
  onChangeAbi: (abi: ParsedAbi) => void;
  preloadAbi?: string;
};

export const AbiForm: React.FC<AbiFormProps> = ({ inProgress, onChangeAbi, preloadAbi }) => {
  const [localInProgress, setLocalInProgress] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadAbiType, setLoadAbiType] = useState(LoadAbiType.FROM_TEXT);
  const [value, setValue] = useState<string>('');
  const [abiName, setAbiName] = useState<string>(DEFAULT_ABI_NAME);
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<string>();
  const [abiSelectorVisible, setAbiSelectorVisible] = useState(false);
  const [selectedAbi, setSelectedAbi] = useState<string>();
  const [abiListVersion, setAbiListVersion] = useState(0);

  const openModal = (type: LoadAbiType) => () => {
    setValue('');
    setAbiName(DEFAULT_ABI_NAME);
    setFile(undefined);
    setLoadAbiType(type);
    setModalVisible(true);
  };
  const hideModal = () => setModalVisible(false);

  const changeAbi = (abiName: string, text: string) => {
    const { functionHandlers, functionNames, eventNames } = core.validateContractAbi(text);

    const currentAbiName = abiName;

    setModalVisible(false);
    setValue('');
    setAbiName(DEFAULT_ABI_NAME);
    setFile(undefined);
    setLoadAbiType(LoadAbiType.FROM_TEXT);

    const data = JSON.parse(text);
    const functions = data.functions.reduce((functions: any, item: any) => {
      functions[item.name] = { inputs: item.inputs || [], outputs: item.outputs || [] };
      return functions;
    }, {});
    const events = data.events.reduce((events: any, item: any) => {
      events[item.name] = { inputs: item.inputs || [] };
      return events;
    }, {});

    localStorage.setItem(currentAbiName, text);
    abiItems = getAllAbi();
    setAbiSelectorVisible(false);
    setSelectedAbi(currentAbiName);

    onChangeAbi({
      abi: text,
      data: JSON.parse(text),
      functionHandlers: functionHandlers.map(handler => ({ abi: handler.data, handler })),
      functions,
      functionNames,
      events,
      eventNames
    });
  };

  const onSelectAbi = (name: string) => () => {
    setError(undefined);
    const text = localStorage.getItem(name);
    if (text == null) {
      return;
    }

    try {
      changeAbi(name, text);
      setSelectedAbi(name);
      setAbiSelectorVisible(false);
    } catch (e: any) {
      console.error(e);
    }
  };

  const onSubmit = () => {
    if (localInProgress) {
      return;
    }
    setLocalInProgress(true);
    setError(undefined);

    (async () => {
      let text = '';
      switch (loadAbiType) {
        case LoadAbiType.FROM_FILE: {
          if (file == null) {
            return;
          }
          text =
            ((await new Promise<string | undefined>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = event => {
                resolve(event?.target?.result as string | undefined);
              };
              reader.onerror = event => reject(event?.target?.error);
              reader.readAsText(file);
            })) as string) || '';
          break;
        }
        case LoadAbiType.FROM_TEXT: {
          text = value;
          break;
        }
        case LoadAbiType.FROM_LINK: {
          const url = convertLink(new URL(value));
          text = await fetch(url.toString(), {}).then(res => res.text());
          break;
        }
      }

      changeAbi(abiName, text);
    })()
      .catch(e => {
        setError(convertError(e));
      })
      .finally(() => {
        setLocalInProgress(false);
      });
  };

  useEffect(() => {
    if (preloadAbi) {
      (async () => {
        const url = convertLink(new URL('https://' + preloadAbi));
        const text = await fetch(url.toString(), {}).then(res => res.text());
        changeAbi(preloadAbi, text);
      })();
    }
  }, []);

  return (
    <>
      <div className={classNames('modal', { 'is-active': modalVisible })}>
        <div className="modal-background" onClick={hideModal} />
        <div className="modal-card">
          <header className="modal-card-head">
            <p className="modal-card-title">Load ABI</p>
            <button className="delete" aria-label="close" onClick={hideModal} />
          </header>
          <section className="modal-card-body">
            <div className="field">
              <label className="label">ABI name:</label>
              <div className="control">
                <input
                  className="input"
                  type="text"
                  value={abiName}
                  spellCheck={false}
                  disabled={inProgress}
                  onChange={e => {
                    setAbiName(e.target.value);
                  }}
                />
              </div>
              {error != null && <p className="help is-danger">{error}</p>}
            </div>
            {loadAbiType == LoadAbiType.FROM_FILE && (
              <>
                <div className="file">
                  <label className="file-label">
                    <input
                      className="file-input"
                      type="file"
                      name="resume"
                      onChange={e => {
                        const files = e.target.files;
                        if ((files?.length || 0) == 0) {
                          return;
                        }
                        setFile(files?.[0]);
                      }}
                    />
                    <span className="file-cta">
                      <span className="file-icon">
                        <i className="fas fa-upload" />
                      </span>
                      <span className="file-label">{file?.name == null ? 'Choose a file…' : file?.name}</span>
                    </span>
                  </label>
                </div>
                {error != null && <p className="help is-danger">{error}</p>}
              </>
            )}
            {loadAbiType == LoadAbiType.FROM_TEXT && (
              <div className="field">
                <label className="label">JSON ABI:</label>
                <div className="control">
                  <textarea
                    className={classNames('textarea', { 'is-danger': error != null })}
                    spellCheck={false}
                    onChange={e => setValue(e.target.value)}
                    value={value}
                    rows={5}
                  />
                </div>
                {error != null && <p className="help is-danger">{error}</p>}
              </div>
            )}
            {loadAbiType == LoadAbiType.FROM_LINK && (
              <div className="field">
                <label className="label">Link to JSON ABI:</label>
                <div className="control">
                  <input
                    className="input"
                    type="text"
                    value={value}
                    spellCheck={false}
                    disabled={inProgress}
                    onChange={e => {
                      setValue(e.target.value);
                    }}
                  />
                </div>
                {error != null && <p className="help is-danger">{error}</p>}
              </div>
            )}
          </section>
          <footer className="modal-card-foot">
            <button
              className={classNames('button', 'is-success', { 'is-loading': localInProgress })}
              onClick={onSubmit}
              disabled={localInProgress}
            >
              Submit
            </button>
            <button className="button" onClick={hideModal}>
              Cancel
            </button>
          </footer>
        </div>
      </div>

      <div className="field has-addons">
        <div className="control">
          <button className="button is-static">Load ABI</button>
        </div>
        <div className="control">
          <button className="button" disabled={inProgress} onClick={openModal(LoadAbiType.FROM_FILE)}>
            From file
          </button>
        </div>
        <div className="control">
          <button className="button" disabled={inProgress} onClick={openModal(LoadAbiType.FROM_TEXT)}>
            From text
          </button>
        </div>
        <div className="control">
          <button className="button" disabled={inProgress} onClick={openModal(LoadAbiType.FROM_LINK)}>
            From link
          </button>
        </div>
        {abiItems.length > 0 && (
          <div className={classNames('dropdown', { 'is-active': abiSelectorVisible })}>
            <div className="dropdown-trigger">
              <button
                className="button"
                aria-haspopup="true"
                aria-controls="select-abi-dropdown"
                onClick={() => setAbiSelectorVisible(!abiSelectorVisible)}
                onBlur={() => setAbiSelectorVisible(false)}
              >
                <span>{selectedAbi == null ? 'Select ABI...' : selectedAbi}</span>
                <span className="icon is-small">
                  <i
                    className={classNames('fas', {
                      'fa-angle-down': !abiSelectorVisible,
                      'fa-angle-up': abiSelectorVisible
                    })}
                    aria-hidden="true"
                  />
                </span>
              </button>
            </div>
            <div key={abiListVersion} className="dropdown-menu" id="select-abi-dropdown" role="menu">
              <div className="dropdown-content">
                {abiItems.map(({ name }) => (
                  <a
                    key={name}
                    className="dropdown-item is-flex is-align-items-center pr-4"
                    onMouseDown={onSelectAbi(name)}
                  >
                    <span className="mr-5">{name}</span>
                    <button
                      className="delete is-small ml-auto"
                      onMouseDown={() => {
                        localStorage.removeItem(name);
                        abiItems = getAllAbi();
                        setAbiListVersion(abiListVersion + 1);
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

type FunctinItemProps = {
  wallet: Permissions['accountInteraction'];
  address: string;
  contractAbi: ParsedAbi;
  functionAbi: core.AbiParam[];
  handler: core.AbiFunctionHandler;
  visible: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

const FunctionItem: React.FC<FunctinItemProps> = ({
  wallet,
  address,
  contractAbi,
  functionAbi,
  handler,
  visible,
  collapsed,
  onToggleCollapse
}) => {
  const [values, setValues] = useState<core.AbiValue[]>(() => handler.makeDefaultState());
  const [inProgress, setInProgress] = useState(false);
  const [output, setOutput] = useState<any>();
  const [error, setError] = useState<string>();
  const [attached, setAttached] = useState<string>('1');
  const [bounce, setBounce] = useState<boolean>(false);
  const [withSignature, setWithSignature] = useState<boolean>(true);
  const [responsible, setResponsible] = useState<boolean>(false);

  const runLocal = async () => {
    if (inProgress) {
      return;
    }
    setError(undefined);
    setInProgress(true);

    (async () => {
      const output = await ever.rawApi.runLocal({
        address,
        responsible,
        functionCall: {
          abi: contractAbi.abi,
          method: handler.functionName,
          params: handler.makeTokensObject(values)
        }
      });
      setOutput(output);
    })()
      .catch(e => {
        setError(convertError(e));
      })
      .finally(() => {
        setInProgress(false);
      });
  };

  const sendExternal = async () => {
    if (inProgress) {
      return;
    }
    setError(undefined);
    setInProgress(true);

    const args = {
      publicKey: wallet.publicKey,
      recipient: address,
      payload: {
        abi: contractAbi.abi,
        method: handler.functionName,
        params: handler.makeTokensObject(values)
      }
    };

    (async () => {
      if (withSignature) {
        setOutput(await ever.rawApi.sendExternalMessage(args));
      } else {
        setOutput(await ever.rawApi.sendUnsignedExternalMessage(args));
      }
    })()
      .catch(e => {
        setError(convertError(e));
      })
      .finally(() => {
        setInProgress(false);
      });
  };

  const sendInternal = async () => {
    if (inProgress) {
      return;
    }
    setError(undefined);
    setInProgress(true);
    (async () => {
      const output = await ever.rawApi.sendMessage({
        sender: wallet.address.toString(),
        recipient: address,
        amount: convertFromTons(attached),
        bounce,
        payload: {
          abi: contractAbi.abi,
          method: handler.functionName,
          params: handler.makeTokensObject(values)
        }
      });
      setOutput(output);
    })()
      .catch(e => {
        setError(convertError(e));
      })
      .finally(() => {
        setInProgress(false);
      });
  };

  return (
    <div className={classNames('function-item box', { 'is-hidden': !visible })}>
      <label className={classNames('label', { 'mb-0': collapsed })} onClick={onToggleCollapse}>
        <span className="icon" style={{ cursor: 'pointer' }}>
          <i
            className={classNames('fa', {
              'fa-chevron-right': collapsed,
              'fa-chevron-down': !collapsed
            })}
          />
        </span>
        <span className="function-name">{handler.functionName}</span>
      </label>

      <div className={classNames({ 'is-hidden': collapsed })}>
        <div className="field">
          <p className="help is-family-monospace">
            input_id: {handler.inputId}
            <br />
            output_id: {handler.outputId}
          </p>
          {functionAbi.length > 0 && <div className="divider mt-1 mb-1">inputs:</div>}
          <div className="control">
            <FunctionInput abi={functionAbi} handler={handler} values={values} onChange={setValues} />
          </div>
        </div>

        <div className="buttons">
          <div className="field mb-0 mr-2 has-addons">
            <div className="control is-unselectable">
              <button className="button" disabled={inProgress} onClick={() => setResponsible(!responsible)}>
                <label className="checkbox">
                  <input type="checkbox" disabled={inProgress} checked={responsible} onChange={() => {}} />
                </label>
                &nbsp;Responsible
              </button>
            </div>
            <div className="control">
              <button className="button is-success" onClick={runLocal} disabled={inProgress}>
                Run local
              </button>
            </div>
          </div>

          <div className="field mb-0 mr-2 has-addons">
            <div className="control is-unselectable">
              <button className="button" disabled={inProgress} onClick={() => setWithSignature(!withSignature)}>
                <label className="checkbox">
                  <input type="checkbox" disabled={inProgress} checked={withSignature} onChange={() => {}} />
                </label>
                &nbsp;With signature
              </button>
            </div>
            <div className="control">
              <button className="button is-success" onClick={sendExternal} disabled={inProgress}>
                Send external
              </button>
            </div>
          </div>

          <div className="field mb-0 mr-2 has-addons">
            <div className="control">
              <input
                className="input"
                type="text"
                placeholder="Amount for EVER"
                value={attached}
                onChange={e => {
                  setAttached(e.target.value);
                }}
                disabled={inProgress}
              />
            </div>
            <div className="control is-unselectable">
              <button className="button" disabled={inProgress} onClick={() => setBounce(!bounce)}>
                <label className="checkbox">
                  <input type="checkbox" disabled={inProgress} checked={bounce} onChange={() => {}} />
                </label>
                &nbsp;Bounce
              </button>
            </div>
            <div className="control">
              <button className="button is-info" disabled={inProgress} onClick={sendInternal}>
                Send
              </button>
            </div>
          </div>
          <button className="button" onClick={() => setOutput(undefined)} disabled={inProgress}>
            Clear output
          </button>
        </div>

        {(output != null || error != null) && <div className="divider mt-1 mb-1">output:</div>}
        {output != null && <pre>{JSON.stringify(output, undefined, 2)}</pre>}
        {error != null && <p className="help is-danger">{error}</p>}
      </div>
    </div>
  );
};

type FunctionSearchProps = {
  query?: string;
  onChange: (query: string) => void;
};

const FunctionSearch = React.forwardRef<HTMLInputElement, FunctionSearchProps>(({ query, onChange }, ref) => {
  return (
    <div className="box field has-addons function-search pb-3">
      <div className="control is-expanded">
        <input
          className="input"
          type="text"
          value={query}
          spellCheck={false}
          ref={ref}
          onChange={event => {
            onChange(event.target.value.trim());
          }}
        />
        <p className="help">Function name</p>
      </div>
      <div className="control">
        <button className="button" onClick={() => onChange('')}>
          Clear
        </button>
      </div>
    </div>
  );
});

export type ExecutorProps = {
  version: number;
  wallet: Permissions['accountInteraction'];
  address?: string;
  state?: ContractState;
  abi?: ParsedAbi;
};

export const Executor: React.FC<ExecutorProps> = ({ version, wallet, address, abi }) => {
  const [collapsed, setCollapsed] = useState<Array<boolean>>();
  const [query, setQuery] = useState<string>('');

  const searchFieldRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const escFunction = (event: KeyboardEvent) => {
      if (event.keyCode === 27) {
        searchFieldRef.current?.focus();
      }
    };

    document.addEventListener('keydown', escFunction, false);
    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, []);

  useEffect(() => {
    if (abi == null) {
      setCollapsed(undefined);
      return;
    }
    setCollapsed(new Array(abi.functionHandlers.length).fill(true));
  }, [abi]);

  const searchQuery = query.toLowerCase().trim();

  let totalVisible = 0;
  const visible =
    abi?.functionHandlers.map(({ handler }) => {
      const visible = searchQuery == '' || handler.functionName.toLowerCase().indexOf(searchQuery) >= 0;
      totalVisible += ~~visible;
      return visible;
    }) || [];

  return (
    <>
      {abi != null && address != null && (
        <div className="block">
          <FunctionSearch ref={searchFieldRef} query={query} onChange={setQuery} />
          {abi.functionHandlers.map(({ abi: functionAbi, handler }, i) => {
            return (
              <FunctionItem
                key={`${i}${version}`}
                wallet={wallet}
                address={address}
                contractAbi={abi}
                functionAbi={functionAbi}
                handler={handler}
                visible={visible[i]}
                collapsed={totalVisible > 1 && (collapsed?.[i] || false)}
                onToggleCollapse={() => {
                  if (collapsed != null) {
                    collapsed[i] = !collapsed[i];
                    setCollapsed([...collapsed]);
                  }
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
};
