import React from 'react';
import classNames from 'classnames';

import * as core from '../../../core/pkg';

import './style.scss';

type AbiValueData<K extends string> = core.AbiValue extends core.AbiValueWrapper<K, infer T> ? T : never;

type HandlerArgs<K extends core.AbiValue['type']> = {
  abi: core.AbiParamType;
  value: AbiValueData<K>;
  onChange: (newData: AbiValueData<K>) => void;
};

type Handler = (args: HandlerArgs<core.AbiValue['type']>) => React.ReactNode;

const makeTextField: Handler = ({ value, onChange }): React.ReactNode => (
  <div className="control">
    <input
      className="input is-small"
      spellCheck={false}
      type="text"
      value={value as any}
      onChange={e => {
        onChange(e.target.value as any);
      }}
    />
  </div>
);

const makeTextAreaField: Handler = ({ value, onChange }): React.ReactNode => (
  <div className="control">
    <textarea
      className="textarea is-small"
      spellCheck={false}
      value={value as any}
      onChange={e => {
        onChange(e.target.value as any);
      }}
      rows={2}
    />
  </div>
);

const makeBoolField: Handler = ({ value, onChange }): React.ReactNode => (
  <div className="control is-unselectable">
    <label className="checkbox">
      <input
        type="checkbox"
        checked={value as any}
        onChange={() => {
          onChange(!value as any);
        }}
      />
      &nbsp;
      {value?.toString() || false}
    </label>
  </div>
);

const makeTupleField: Handler = ({ abi, value, onChange }): React.ReactNode => {
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

const makeArrayField: Handler = ({ abi, value, onChange }): React.ReactNode => {
  if (abi.kind !== 'array' || value == null) {
    return null;
  }
  const values = value as core.AbiValue[];

  return (
    <>
      {values.map((itemValue, i) => (
        <EntityBuilderItem
          key={i}
          value={itemValue}
          abi={{ name: `element[${i}]`, type: abi.info.type }}
          onChange={newValue => {
            (value as any[])[i] = newValue;
            onChange(value);
          }}
          onDelete={() => {
            (value as any[]).splice(i, 1);
            onChange(value);
          }}
        />
      ))}
      <button
        className="button is-fullwidth is-small"
        onClick={() => {
          const newValue = JSON.parse(JSON.stringify((abi.info as any).defaultValue));
          (value as any[]).push(newValue);
          onChange(value);
        }}
      >
        Add element
      </button>
    </>
  );
};

const HANDLERS: {
  [K in core.AbiValue['type']]: Handler;
} = {
  uint: makeTextField,
  int: makeTextField,
  varuint: makeTextField,
  varint: makeTextField,
  bool: makeBoolField,
  tuple: makeTupleField,
  array: makeArrayField,
  cell: makeTextAreaField,
  address: makeTextAreaField,
  bytes: makeTextAreaField,
  string: makeTextAreaField,
  pubkey: makeTextAreaField
};

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

type EntityBuilderItemProps = {
  abi: core.AbiParam;
  value: core.AbiValue;
  onChange?: (data: core.AbiValue) => void;
  onDelete?: () => void;
};

export class EntityBuilderItem extends React.Component<EntityBuilderItemProps> {
  constructor(props: EntityBuilderItemProps) {
    super(props);
  }

  render() {
    const { abi, value, onChange, onDelete } = this.props;

    const type = abi.type;

    const showInput = () => {
      const handler = HANDLERS[value.type];
      if (handler == null) {
        return 'Unsupported';
      }
      return handler({
        abi: abi.type,
        value: value.data,
        onChange: (data: any) =>
          onChange?.({
            type: value.type,
            data
          } as any)
      });
    };

    const isGroup = abi.type.kind == 'tuple';

    const name = `${abi.name != '' ? `${abi.name}: ` : ''}${getAbiTypeSignature(type)}`;

    return (
      <div className="field box p-3">
        {/*<div className="columns is-gapless">*/}
        {/*  <div className="column is-narrow">{onDelete != null && <button className="delete" onClick={onDelete} />}</div>*/}
        {/*</div>*/}
        {onDelete == null ? (
          <span className={classNames('tag', { 'mb-3': isGroup })}>{name}</span>
        ) : (
          <div className="tags has-addons mb-0">
            <span className="tag mb-0">{name}</span>
            <a className="tag is-delete mb-0" onClick={onDelete} />
          </div>
        )}
        {showInput()}
      </div>
    );
  }
}
