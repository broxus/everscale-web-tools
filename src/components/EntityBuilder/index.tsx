import React from 'react';

import * as core from '../../../core/pkg';

import { EntityBuilderItem, EntityBuilderData } from '../EntityBuilderItem';

import './style.scss';

const toPaddedHexString = (num: number, len: number) => {
  const str = num.toString(16);
  return '0'.repeat(len - str.length) + str;
};

type EntityBuilderProps = {
  abi: core.AbiEntity;
  handler: core.AbiEntityHandler;
  defaultState: core.AbiValue[];
};

type EntityBuilderState = {
  values: EntityBuilderData[];
};

export class EntityBuilder extends React.Component<EntityBuilderProps, EntityBuilderState> {
  constructor(props: EntityBuilderProps) {
    super(props);

    this.state = {
      values: []
    };
  }

  render() {
    const { abi, handler, defaultState } = this.props;

    return (
      <div className="entity-builder">
        {abi.kind === 'empty' && (
          <div className="entity-builder__output">
            <h1>Output (empty cell):</h1>
            <pre className="encoded-data">{core.encodeAbiEntity(handler, defaultState)}</pre>
          </div>
        )}
        {abi.kind === 'plain' && (
          <>
            <div className="entity-builder__inputs">
              {abi.info.tokens.map((abi, i) => (
                <EntityBuilderItem key={i} data={undefined} abi={abi} />
              ))}
            </div>
            <div className="entity-builder__output">
              <h1>Output (cell):</h1>
              <pre className="encoded-data">{core.encodeAbiEntity(handler, defaultState)}</pre>
            </div>
          </>
        )}
        {abi.kind === 'function' && (
          <>
            <div className="entity-builder__inputs">
              {abi.info.inputs.map((abi, i) => (
                <EntityBuilderItem key={i} data={undefined} abi={abi} />
              ))}
            </div>
            <div className="entity-builder__output">
              <h1>Function ID:</h1>
              <pre>Input: 0x{toPaddedHexString(abi.info.inputId, 8)}</pre>
              <pre>Output: 0x{toPaddedHexString(abi.info.outputId, 8)}</pre>
              <br />
              <h1>Output (function call):</h1>
              <pre className="encoded-data">{core.encodeAbiEntity(handler, defaultState)}</pre>
            </div>
          </>
        )}
      </div>
    );
  }
}
