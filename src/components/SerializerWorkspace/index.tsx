import React from 'react';
import classNames from 'classnames';

import * as core from '../../../core/pkg';

import { EntityBuilder } from '../EntityBuilder';
import { hasTonProvider } from 'ton-inpage-provider';

import './style.scss';

export type SerializerWorkspaceState = {
  hasTonProvider: boolean;
  abiInput: string;
  decodedAbi: { handler: core.AbiEntityHandler; data: core.AbiEntity } | null;
  error: string | null;
};

export class SerializerWorkspace extends React.Component<{}, SerializerWorkspaceState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      hasTonProvider: false,
      abiInput: '',
      decodedAbi: prepareHandler(core.parseAbi('')),
      error: null
    };
  }

  componentDidMount() {
    hasTonProvider().then(hasTonProvider => {
      this.setState({
        hasTonProvider
      });
    });
  }

  clear = (callback?: () => void) => {
    const { decodedAbi } = this.state;
    this.setState(
      {
        decodedAbi: null,
        error: null
      },
      () => {
        if (decodedAbi != null) {
          decodedAbi.handler.free();
        }
        callback?.();
      }
    );
  };

  setNewAbi = (handler: core.AbiEntityHandler) => {
    this.clear(() =>
      this.setState({
        decodedAbi: prepareHandler(handler),
        error: null
      })
    );
  };

  handleAbi = (abiInput: string) => {
    this.setState({ abiInput: prettyPrint(abiInput) });

    try {
      const customAbi = core.parseAbi(abiInput);
      console.log(customAbi);

      this.setNewAbi(customAbi);
    } catch (e) {
      this.clear(() =>
        this.setState({
          error: e.toString()
        })
      );
    }
  };

  render() {
    const { abiInput, decodedAbi, error } = this.state;

    return (
      <>
        <section className="section">
          <div className="container is-fluid">
            <div className="field">
              <label className="label">Enter function signature or cell ABI:</label>
              <div className="control">
                <textarea
                  className={classNames('textarea', { 'is-danger': error != null })}
                  spellCheck={false}
                  onChange={event => {
                    this.handleAbi(event.target.value);
                  }}
                  onPaste={event => {
                    let pastedText = event.clipboardData.getData('text');
                    this.handleAbi(prettyPrint(pastedText));
                    event.preventDefault();
                  }}
                  value={abiInput}
                  rows={5}
                />
              </div>
              {error != null && <p className="help is-danger">{error}</p>}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container is-fluid">
            {decodedAbi != null && <EntityBuilder abi={decodedAbi.data} handler={decodedAbi.handler} />}
          </div>
        </section>
      </>
    );
  }
}

const prepareHandler = (handler: core.AbiEntityHandler) => ({
  handler,
  data: handler.data
});

const prettyPrint = (text: string) => {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, undefined, 4);
  } catch (e) {
    return text;
  }
};
