import React from 'react';

import * as core from '../../../core/pkg';

import { EntityBuilder } from '../EntityBuilder';

import './style.scss';

export type SerializerWorkspaceState = {
  abiInput: string;
  decodedAbi: { handler: core.AbiEntityHandler; data: core.AbiEntity } | null;
  error: string | null;
};

export class SerializerWorkspace extends React.Component<{}, SerializerWorkspaceState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      abiInput: '',
      decodedAbi: prepareHandler(core.parseAbi('')),
      error: null
    };
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
      <div className="serializer-workspace">
        <h1>Enter function signature or cell ABI:</h1>
        <textarea
          className="w100"
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
        {decodedAbi != null && <EntityBuilder abi={decodedAbi.data} />}
        {error != null && <pre className="error">{error}</pre>}
      </div>
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
