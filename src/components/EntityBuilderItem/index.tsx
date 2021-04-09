import React from 'react';
import classNames from 'classnames';

import * as core from '../../../core/pkg';

import './style.scss';

type BoolDataType = 'bool';
type StringDataType =
  | 'int'
  | 'uint'
  | 'cell'
  | 'address'
  | 'bytes'
  | 'fixedbytes'
  | 'gram'
  | 'time'
  | 'expire'
  | 'pubkey';
type TupleDataType = 'tuple';
type ArrayDataType = 'array' | 'fixedarray';

export type EntityBuilderData =
  | {
      type: BoolDataType;
      data: boolean;
    }
  | {
      type: StringDataType;
      data: string;
    }
  | {
      type: TupleDataType;
      data: EntityBuilderData[];
    }
  | {
      type: ArrayDataType;
      data: EntityBuilderData[];
    };

enum DataType {
  Unknown,
  Number,
  Bool,
  Cell,
  Bytes,
  Address
}

type EntityBuilderItemProps = {
  abi: core.AbiParam;
  data: EntityBuilderData;
  onChange?: (data: EntityBuilderData) => void;
};

type EntityBuilderItemState = {
  innerData: EntityBuilderData[];
  data?: EntityBuilderData;
};

export class EntityBuilderItem extends React.Component<EntityBuilderItemProps, EntityBuilderItemState> {
  constructor(props: EntityBuilderItemProps) {
    super(props);

    this.state = {
      data: undefined,
      innerData: []
    };
  }

  render() {
    const { abi, onChange } = this.props;
    const { data } = this.state;

    const type = abi.type;

    return (
      <div className="entity-builder-item">
        <span>{`${abi.name != '' ? `${abi.name}: ` : ''}${getAbiTypeSignature(type)}`}</span>
        {type.kind === 'tuple' ? (
          type.info.types.map((abi, i) => <EntityBuilderItem key={i} data={undefined} abi={abi} />)
        ) : type.kind === 'bool' ? (
          (() => {
            const checked = typeof data == 'boolean' ? data : false;

            return (
              <label className="checkbox control-checkbox">
                {checked.toString()}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    console.log('asd');
                    //onChange?.(!checked)
                    this.setState({
                      data: !checked
                    });
                  }}
                />
                <div className="control_indicator" />
              </label>
            );
          })()
        ) : (
          <input spellCheck={false} type="text" />
        )}
      </div>
    );
  }
}

const getAbiTypeSignature = (param: core.AbiParamType): string => {
  if (param.kind == 'uint' || param.kind == 'int') {
    return `${param.kind}${param.info.size}`;
  } else if (param.kind == 'array') {
    return `${getAbiTypeSignature(param.info.type)}[]`;
  } else if (param.kind == 'fixedarray') {
    return `${getAbiTypeSignature(param.info.type)}[${param.info.size}]`;
  } else if (param.kind == 'fixedbytes') {
    return `${param.kind}[${param.info.size}]`;
  } else if (param.kind == 'map') {
    return `${param.kind}(${getAbiTypeSignature(param.info.key)}, ${getAbiTypeSignature(param.info.value)})`;
  } else {
    return param.kind;
  }
};
