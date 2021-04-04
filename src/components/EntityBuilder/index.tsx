import React from 'react';

import * as core from '../../../core/pkg';

import { EntityBuilderItem } from '../EntityBuilderItem';

import './style.scss';

type EntityBuilderProps = {
  abi: core.AbiEntity;
};

export class EntityBuilder extends React.Component<EntityBuilderProps, {}> {
  constructor(props: EntityBuilderProps) {
    super(props);
  }

  render() {
    const { abi } = this.props;

    return (
      <div className="entity-builder">
        {abi.kind === 'empty' && (
          <div className="entity-builder__output">
            <h1>Output (empty cell):</h1>
            <pre>{core.encodeEmptyCell()}</pre>
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
              <h1>Output (function call):</h1>
            </div>
          </>
        )}
      </div>
    );
  }
}
