import React from 'react';
import classNames from 'classnames';

import * as core from '../../../core/pkg';

import './style.scss';

type AbiValueData<K extends string> = core.AbiValue extends core.AbiValueWrapper<K, infer T> ? T : never;

type Handler<K extends core.AbiValue['type']> = (
  abi: core.AbiParamType,
  value: AbiValueData<K>,
  onChange: (newData: typeof value) => void
) => React.ReactNode;

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
    {value?.toString() || false}
    <input
      type="checkbox"
      checked={value as any}
      onChange={() => {
        onChange(!value as any);
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
  if (abi.kind !== 'tuple' || value == null) {
    return null;
  }
  return abi.info.types.map((abi, i) => {
    return (
      <EntityBuilderItem
        key={i}
        value={(value as any)[i]}
        abi={abi}
        onChange={newValue => {
          (value as any)[i] = newValue;
          onChange(value);
        }}
      />
    );
  });
};

const makeArrayField = <K extends core.AbiValue['type']>(
  abi: core.AbiParamType,
  value: AbiValueData<K>,
  onChange: (newData: typeof value) => void
): React.ReactNode => {
  return <p>Hello world</p>;
};

const HANDLERS: {
  [K in core.AbiValue['type']]: Handler<K>;
} = {
  //@ts-ignore
  uint: makeTextField,
  //@ts-ignore
  int: makeTextField,
  //@ts-ignore
  varuint: makeTextField,
  //@ts-ignore
  varint: makeTextField,
  //@ts-ignore
  bool: makeBoolField,
  //@ts-ignore
  tuple: makeTupleField,
  //@ts-ignore
  array: makeArrayField,
  //@ts-ignore
  cell: makeTextAreaField,
  //@ts-ignore
  address: makeTextAreaField,
  //@ts-ignore
  bytes: makeTextAreaField,
  //@ts-ignore
  string: makeTextAreaField,
  //@ts-ignore
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
      //@ts-ignore
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
  if (param.kind == 'uint' || param.kind == 'int' || param.kind == 'varuint' || param.kind == 'varint') {
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
