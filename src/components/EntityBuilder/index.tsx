import React from 'react';

import * as core from '../../../core/pkg';

import { EntityBuilderItem } from '../EntityBuilderItem';

import './style.scss';

const toPaddedHexString = (num: number, len: number) => {
  const str = num.toString(16);
  return '0'.repeat(len - str.length) + str;
};

type EntityBuilderProps = {
  abi: core.AbiEntity;
  handler: core.AbiEntityHandler;
};

type EntityBuilderState = {
  values: core.AbiValue[];
  output?: string;
  error?: string;
};

export class EntityBuilder extends React.Component<EntityBuilderProps, EntityBuilderState> {
  constructor(props: EntityBuilderProps) {
    super(props);

    const values = props.handler.makeDefaultState();
    let error, output;
    try {
      output = core.encodeAbiEntity(props.handler, values);
    } catch (e) {
      error = e.toString();
    }

    this.state = {
      values,
      output,
      error
    };
  }

  componentDidUpdate(prevProps: Readonly<EntityBuilderProps>) {
    console.log('Hello world');
    if (prevProps.abi != this.props.abi) {
      console.log(prevProps, this.props);
    }
  }

  updateOutput = (value: core.AbiValue, i: number) => {
    const { handler } = this.props;
    const { values } = this.state;

    const newValues = [...values];
    newValues[i] = value;

    let error, output;
    try {
      output = core.encodeAbiEntity(handler, newValues);
    } catch (e) {
      error = e.toString();
    }

    this.setState({
      values: newValues,
      output,
      error
    });
  };

  render() {
    const { abi } = this.props;
    const { values, output, error } = this.state;

    return (
      <div className="entity-builder">
        {abi.kind === 'empty' && (
          <div className="entity-builder__output">
            <h1>Output (empty cell):</h1>
            {output && <pre className="encoded-data">{output}</pre>}
          </div>
        )}
        {abi.kind === 'plain' && (
          <>
            <div className="entity-builder__inputs">
              {abi.info.tokens.map((abi, i) => (
                <EntityBuilderItem
                  key={i}
                  value={values[i]}
                  onChange={value => this.updateOutput(value, i)}
                  abi={abi}
                />
              ))}
            </div>
            <div className="entity-builder__output">
              <h1>Output (cell):</h1>
              {output && <pre className="encoded-data">{output}</pre>}
              {error && <pre className="error">{error}</pre>}
            </div>
          </>
        )}
        {abi.kind === 'function' && (
          <>
            <div className="entity-builder__inputs">
              {abi.info.inputs.map((abi, i) => (
                <EntityBuilderItem
                  key={i}
                  value={values[i]}
                  abi={abi}
                  onChange={value => this.updateOutput(value, i)}
                />
              ))}
            </div>
            <div className="entity-builder__output">
              <h1>Function ID:</h1>
              <pre>Input: 0x{toPaddedHexString(abi.info.inputId, 8)}</pre>
              <pre>Output: 0x{toPaddedHexString(abi.info.outputId, 8)}</pre>
              <br />
              <h1>Output (function call):</h1>
              {output && <pre className="encoded-data">{output}</pre>}
              {error && <pre className="error">{error}</pre>}
            </div>
          </>
        )}
      </div>
    );
  }
}
