import React from 'react';

import * as core from '../../../core/pkg';

import { EntityBuilderItem } from '../EntityBuilderItem';

type FunctionInputProps = {
  abi: core.AbiParam[];
  handler: core.AbiFunctionHandler;
  values: core.AbiValue[];
  onChange: (values: core.AbiValue[]) => void;
};

type FunctionInputState = {
  values: core.AbiValue[];
};

export class FunctionInput extends React.Component<FunctionInputProps, FunctionInputState> {
  constructor(props: FunctionInputProps) {
    super(props);
  }

  updateOutput = (value: core.AbiValue, i: number) => {
    const { values, onChange } = this.props;

    const newValues = [...values];
    newValues[i] = value;

    onChange(newValues);
  };

  render() {
    const { abi, values } = this.props;

    if (abi.length != values.length) {
      return null;
    }

    return (
      <div>
        {abi.map((abi, i) => {
          return (
            <EntityBuilderItem key={i} value={values[i]} abi={abi} onChange={value => this.updateOutput(value, i)} />
          );
        })}
      </div>
    );
  }
}
