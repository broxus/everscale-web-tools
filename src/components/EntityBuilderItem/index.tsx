import React from 'react';
import classNames from 'classnames';

import * as core from '../../../core/pkg';

import './style.scss';

type AbiValueData<K extends string> = core.AbiValue extends core.AbiValueWrapper<K, infer T> ? T : never;

const makeTextField = <K extends core.AbiValue['type']>(
  _: core.AbiParamType,
  value: AbiValueData<K>,
  onChange: (newData: typeof value) => void
): React.ReactNode => (
  <input
    spellCheck={false}
    type="text"
    value={value as any}
    onChange={e => {
      onChange(e.target.value as any);
    }}
  />
);

const makeTextAreaField = <K extends core.AbiValue['type']>(
  _: core.AbiParamType,
  value: AbiValueData<K>,
  onChange: (newData: typeof value) => void
): React.ReactNode => (
  <textarea
    className="w100"
    spellCheck={false}
    value={value as any}
    onChange={e => {
      onChange(e.target.value as any);
    }}
    rows={2}
  />
);

const makeBoolField = <K extends core.AbiValue['type']>(
  _: core.AbiParamType,
  value: AbiValueData<K>,
  onChange: (newData: typeof value) => void
): React.ReactNode => (
  <label className="checkbox control-checkbox">
    {value.toString()}
    <input
      type="checkbox"
      checked={value}
      onChange={() => {
        onChange(!value);
      }}
    />
    <div className="control_indicator" />
  </label>
);

const makeTupleField = <K extends core.AbiValue['type']>(
  abi: core.AbiParamType,
  value: AbiValueData<K>,
  onChange: (newData: typeof value) => void
): React.ReactNode => {
  if (abi.kind !== 'tuple') {
    return null;
  }
  return abi.info.types.map((abi, i) => {
    return (
      <EntityBuilderItem
        key={i}
        value={value[i]}
        abi={abi}
        onChange={newValue => {
          value[i] = newValue;
          onChange(value);
        }}
      />
    );
  });
};

const HANDLERS: {
  [K in core.AbiValue['type']]: (
    abi: core.AbiParamType,
    value: AbiValueData<K>,
    onChange: (newData: typeof value) => void
  ) => React.ReactNode;
} = {
  uint: makeTextField,
  int: makeTextField,
  bool: makeBoolField,
  tuple: makeTupleField,
  cell: makeTextAreaField,
  address: makeTextAreaField,
  bytes: makeTextAreaField,
  pubkey: makeTextAreaField
};

type EntityBuilderItemProps = {
  abi: core.AbiParam;
  value: core.AbiValue;
  onChange?: (data: core.AbiValue) => void;
};

export class EntityBuilderItem extends React.Component<EntityBuilderItemProps> {
  constructor(props: EntityBuilderItemProps) {
    super(props);
  }

  render() {
    const { abi, value, onChange } = this.props;

    const type = abi.type;

    const showInput = () => {
      const handler = HANDLERS[value.type];
      if (handler == null) {
        return 'Unsupported';
      }
      return handler(abi.type, value.data, data =>
        onChange?.({
          type: value.type,
          data
        })
      );
    };

    return (
      <div className="entity-builder-item">
        <span>{`${abi.name != '' ? `${abi.name}: ` : ''}${getAbiTypeSignature(type)}`}</span>
        {showInput()}
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
