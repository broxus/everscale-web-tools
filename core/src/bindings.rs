use std::collections::HashMap;

use anyhow::Result;
use num_bigint::{BigInt, BigUint};
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
use ton_block::{Deserializable, MsgAddressInt};
use ton_types::Cell;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::custom_abi::{self, calc_function_id, get_function_signature};
use crate::utils::*;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    Ok(())
}

#[wasm_bindgen]
pub fn decode(boc: &str) -> Result<String, JsValue> {
    let boc = base64::decode(boc).handle_error()?;
    let cells = ton_types::deserialize_cells_tree(&mut std::io::Cursor::new(boc)).handle_error()?;

    let mut result = String::new();
    for cell in cells {
        result += &format!("{:#.1024}\n", cell);
    }

    Ok(result)
}

#[wasm_bindgen(js_name = "validateContractAbi")]
pub fn validate_contract_abi(input: &str) -> Result<ValidatedAbi, JsValue> {
    #[derive(Deserialize)]
    struct SerdeFunction {
        pub name: String,
    }

    #[derive(Deserialize)]
    struct SerdeEvent {
        pub name: String,
    }

    #[derive(Deserialize)]
    struct SerdeContract {
        pub functions: Vec<SerdeFunction>,
        #[serde(default)]
        events: Vec<SerdeEvent>,
    }

    let intermediate_contract: SerdeContract = serde_json::from_str(input).handle_error()?;

    let contract: ton_abi::Contract =
        ton_abi::Contract::load(&mut std::io::Cursor::new(input)).handle_error()?;

    let functions = contract
        .functions()
        .keys()
        .map(JsValue::from)
        .collect::<js_sys::Array>();

    let events = contract
        .events()
        .keys()
        .map(JsValue::from)
        .collect::<js_sys::Array>();

    let function_handlers = intermediate_contract
        .functions
        .into_iter()
        .filter_map(|SerdeFunction { name }| {
            let function = contract.function(&name).ok()?;
            Some(AbiFunctionHandler {
                inner: function.clone(),
            })
        })
        .map(JsValue::from)
        .collect::<js_sys::Array>();

    Ok(ObjectBuilder::new()
        .set("functionHandlers", function_handlers)
        .set("functionNames", functions)
        .set("eventNames", events)
        .build()
        .unchecked_into())
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "ValidatedAbi")]
    pub type ValidatedAbi;
}

#[wasm_bindgen(typescript_custom_section)]
const VALIDATED_ABI: &'static str = r#"
export type ValidatedAbi = {
    functionHandlers: AbiFunctionHandler[],
    functionNames: string[];
    eventNames: string[];
};
"#;

#[wasm_bindgen(js_name = "parseAbi")]
pub fn parse_abi(input: &str) -> Result<AbiEntityHandler, JsValue> {
    let inner = custom_abi::parse(input)
        .map(Entity::from)
        .map_err(|e| e.to_string())
        .or_else(|_| {
            serde_json::from_str::<AbiFunction>(input)
                .map(|function| {
                    let abi_version = 2;

                    let (input_id, output_id) =
                        function.id.map(|id| (id, id)).unwrap_or_else(|| {
                            let id = calc_function_id(&get_function_signature(
                                &function.name,
                                &function.inputs,
                                &function.outputs,
                                abi_version,
                            ));
                            (id & 0x7FFFFFFF, id | 0x80000000)
                        });

                    Entity::Function(ton_abi::Function {
                        abi_version: ton_abi::contract::ABI_VBERSION_2_1,
                        name: function.name,
                        header: Vec::new(),
                        inputs: function.inputs,
                        outputs: function.outputs,
                        input_id,
                        output_id,
                    })
                })
                .map_err(|e| e.to_string())
        })
        .handle_error()?;

    Ok(AbiEntityHandler { inner })
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
struct AbiFunction {
    pub name: String,

    #[serde(default)]
    pub inputs: Vec<ton_abi::Param>,

    #[serde(default)]
    pub outputs: Vec<ton_abi::Param>,

    #[serde(default)]
    #[serde(deserialize_with = "ton_abi::contract::deserialize_opt_u32_from_string")]
    pub id: Option<u32>,
}

#[wasm_bindgen(js_name = "encodeEmptyCell")]
pub fn encode_empty_cell() -> Result<String, JsValue> {
    ton_types::serialize_toc(&ton_types::Cell::default())
        .handle_error()
        .map(base64::encode)
}

#[wasm_bindgen(js_name = "encodeAbiEntity")]
pub fn encode_abi_entry(
    entity: &AbiEntityHandler,
    values: AbiValueArray,
) -> Result<String, JsValue> {
    let values = values.unchecked_into();

    let cell: Cell = match &entity.inner {
        Entity::Empty => return encode_empty_cell(),
        Entity::Cell(inputs) => {
            let values = parse_abi_values(inputs, values).handle_error()?;
            ton_abi::TokenValue::pack_values_into_chain(&values, Vec::new(), 2)
                .handle_error()?
                .into()
        }
        Entity::Function(function) => {
            let values = parse_abi_values(&function.inputs, values).handle_error()?;
            function
                .encode_input(&HashMap::new(), &values, true, None)
                .handle_error()?
                .into()
        }
    };

    ton_types::serialize_toc(&cell)
        .handle_error()
        .map(base64::encode)
}

fn parse_abi_values(abi: &[ton_abi::Param], values: JsValue) -> Result<Vec<ton_abi::Token>> {
    fn parse_token((param, value): (&ton_abi::Param, JsAbiValue)) -> Result<ton_abi::Token> {
        let value = parse_token_value((&param.kind, value))?;
        Ok(ton_abi::Token {
            name: param.name.clone(),
            value,
        })
    }

    fn parse_token_value(
        (param, value): (&ton_abi::ParamType, JsAbiValue),
    ) -> Result<ton_abi::TokenValue> {
        Ok(match (param, value) {
            (ton_abi::ParamType::Uint(size), JsAbiValue::Uint(number)) => {
                ton_abi::TokenValue::Uint(ton_abi::Uint {
                    number,
                    size: *size,
                })
            }
            (ton_abi::ParamType::Int(size), JsAbiValue::Int(number)) => {
                ton_abi::TokenValue::Int(ton_abi::Int {
                    number,
                    size: *size,
                })
            }
            (ton_abi::ParamType::VarUint(size), JsAbiValue::VarUint(number)) => {
                ton_abi::TokenValue::VarUint(*size, number)
            }
            (ton_abi::ParamType::VarInt(size), JsAbiValue::VarInt(number)) => {
                ton_abi::TokenValue::VarInt(*size, number)
            }
            (ton_abi::ParamType::Bool, JsAbiValue::Bool(value)) => ton_abi::TokenValue::Bool(value),
            (ton_abi::ParamType::Tuple(params), JsAbiValue::Tuple(values)) => {
                if params.len() != values.len() {
                    return Err(AbiError::InvalidArgumentCount.into());
                }

                let mut result = Vec::with_capacity(params.len());
                for item in params.iter().zip(values.into_iter()) {
                    result.push(parse_token(item)?);
                }

                ton_abi::TokenValue::Tuple(result)
            }
            (ton_abi::ParamType::Array(param), JsAbiValue::Array(values))
            | (ton_abi::ParamType::FixedArray(param, ..), JsAbiValue::Array(values)) => {
                let mut result = Vec::with_capacity(values.len());

                for value in values.into_iter() {
                    result.push(parse_token_value((param.as_ref(), value))?);
                }

                ton_abi::TokenValue::Array(*param.clone(), result)
            }
            (ton_abi::ParamType::Address, JsAbiValue::Address(address)) => {
                let value = match address {
                    ton_block::MsgAddressInt::AddrStd(addr) => ton_block::MsgAddress::AddrStd(addr),
                    ton_block::MsgAddressInt::AddrVar(addr) => ton_block::MsgAddress::AddrVar(addr),
                };
                ton_abi::TokenValue::Address(value)
            }
            (ton_abi::ParamType::Bytes, JsAbiValue::Bytes(bytes))
            | (ton_abi::ParamType::FixedBytes(_), JsAbiValue::Bytes(bytes)) => {
                ton_abi::TokenValue::Bytes(bytes)
            }
            (ton_abi::ParamType::String, JsAbiValue::String(value)) => {
                ton_abi::TokenValue::String(value)
            }
            (ton_abi::ParamType::Cell, JsAbiValue::Cell(cell)) => ton_abi::TokenValue::Cell(cell),
            (ton_abi::ParamType::Token, JsAbiValue::Uint(value)) => match value.to_u128() {
                Some(grams) => ton_abi::TokenValue::Token(ton_block::Grams(grams)),
                None => return Err(AbiError::InvalidInteger.into()),
            },
            (ton_abi::ParamType::Time, JsAbiValue::Uint(value)) => match value.to_u64() {
                Some(time) => ton_abi::TokenValue::Time(time),
                None => return Err(AbiError::InvalidInteger.into()),
            },
            (ton_abi::ParamType::Expire, JsAbiValue::Uint(value)) => match value.to_u32() {
                Some(expire) => ton_abi::TokenValue::Expire(expire),
                None => return Err(AbiError::InvalidInteger.into()),
            },
            (ton_abi::ParamType::PublicKey, JsAbiValue::PublicKey(public_key)) => {
                ton_abi::TokenValue::PublicKey(public_key)
            }
            (ton_abi::ParamType::Optional(param_type), JsAbiValue::Optional(value)) => {
                ton_abi::TokenValue::Optional(
                    *param_type.clone(),
                    value
                        .map(|value| parse_token_value((param_type.as_ref(), *value)))
                        .transpose()?
                        .map(Box::new),
                )
            }
            _ => return Err(AbiError::InvalidType.into()),
        })
    }

    let values: Vec<JsAbiValue> = values.into_serde()?;
    if values.len() != abi.len() {
        return Err(AbiError::InvalidArgumentCount.into());
    }

    let mut result = Vec::with_capacity(values.len());
    for item in abi.iter().zip(values.into_iter()) {
        result.push(parse_token(item)?);
    }

    Ok(result)
}

mod serde_helpers {
    use super::*;

    use std::str::FromStr;

    use num_traits::Num;
    use serde::de;
    use serde::de::Error;
    use ton_block::Deserializable;
    use ton_types::SliceData;

    pub fn deserialize_cell<'de, D>(deserializer: D) -> Result<Cell, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        let encoded = String::deserialize(deserializer)?;
        let encoded = encoded.trim();
        let bytes = base64::decode(&encoded).map_err(D::Error::custom)?;
        ton_types::deserialize_tree_of_cells(&mut std::io::Cursor::new(bytes))
            .map_err(D::Error::custom)
    }

    pub fn deserialize_address<'de, D>(deserializer: D) -> Result<MsgAddressInt, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        MsgAddressInt::from_str(String::deserialize(deserializer)?.trim()).map_err(D::Error::custom)
    }

    pub fn deserialize_bytes<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        let string = String::deserialize(deserializer)?;
        let string = string.trim();
        hex::decode(&string)
            .or_else(|_| base64::decode(&string))
            .map_err(D::Error::custom)
    }

    pub fn deserialize_optional_pubkey<'de, D>(
        deserializer: D,
    ) -> Result<Option<ed25519_dalek::PublicKey>, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        if let Some(string) = Option::<String>::deserialize(deserializer)? {
            let bytes = hex::decode(string.trim()).map_err(D::Error::custom)?;
            ed25519_dalek::PublicKey::from_bytes(&bytes)
                .map(Some)
                .map_err(D::Error::custom)
        } else {
            Ok(None)
        }
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum NumberValue<T> {
        Number(T),
        String(String),
    }

    pub fn deserialize_uint<'de, D>(deserializer: D) -> Result<BigUint, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        match NumberValue::<u64>::deserialize(deserializer)? {
            NumberValue::Number(number) => Ok(BigUint::from(number)),
            NumberValue::String(string) => {
                let string = string.trim();
                if string.is_empty() {
                    return Ok(Default::default());
                }
                match string.strip_prefix("0x") {
                    Some(hex) => BigUint::from_str_radix(hex, 16).map_err(D::Error::custom),
                    None => BigUint::from_str(string).map_err(D::Error::custom),
                }
            }
            _ => Ok(Default::default()),
        }
    }

    pub fn deserialize_int<'de, D>(deserializer: D) -> Result<BigInt, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        match NumberValue::<i64>::deserialize(deserializer)? {
            NumberValue::Number(number) => Ok(BigInt::from(number)),
            NumberValue::String(string) => {
                let string = string.trim();
                if string.is_empty() {
                    return Ok(Default::default());
                }
                match string.strip_prefix("0x") {
                    Some(hex) => BigInt::from_str_radix(hex, 16).map_err(D::Error::custom),
                    None => BigInt::from_str(string).map_err(D::Error::custom),
                }
            }
            _ => Ok(Default::default()),
        }
    }
}

#[derive(thiserror::Error, Debug)]
enum AbiError {
    #[error("Invalid argument count")]
    InvalidArgumentCount,
    #[error("Invalid integer")]
    InvalidInteger,
    #[error("Invalid type")]
    InvalidType,
}

#[wasm_bindgen]
pub struct AbiFunctionHandler {
    #[wasm_bindgen(skip)]
    pub inner: ton_abi::Function,
}

#[wasm_bindgen]
impl AbiFunctionHandler {
    #[wasm_bindgen(getter, js_name = "functionName")]
    pub fn function_name(&self) -> String {
        self.inner.name.clone()
    }

    #[wasm_bindgen(getter, js_name = "inputId")]
    pub fn input_id(&self) -> String {
        format!("{:08x}", self.inner.input_id)
    }

    #[wasm_bindgen(getter, js_name = "outputId")]
    pub fn output_id(&self) -> String {
        format!("{:08x}", self.inner.output_id)
    }

    #[wasm_bindgen(getter)]
    pub fn data(&self) -> AbiParamArray {
        self.inner
            .inputs
            .iter()
            .map(serialize_param)
            .collect::<js_sys::Array>()
            .unchecked_into()
    }

    #[wasm_bindgen(js_name = "makeTokensObject")]
    pub fn make_tokens_object(&self, values: AbiValueArray) -> Result<TokensObject, JsValue> {
        let values = values.unchecked_into();
        let function = &self.inner;

        let values = parse_abi_values(&function.inputs, values).handle_error()?;
        make_tokens_object(&values)
    }

    #[wasm_bindgen(js_name = "makeDefaultState")]
    pub fn make_default_state(&self) -> AbiValueArray {
        self.inner
            .inputs
            .iter()
            .map(|param| make_default_state(&param.kind))
            .map(JsValue::from)
            .collect::<js_sys::Array>()
            .unchecked_into()
    }
}

#[wasm_bindgen]
pub struct AbiEntityHandler {
    #[wasm_bindgen(skip)]
    pub inner: Entity,
}

#[wasm_bindgen]
impl AbiEntityHandler {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> AbiEntity {
        JsValue::from(&self.inner).unchecked_into()
    }

    #[wasm_bindgen(js_name = "makeDefaultState")]
    pub fn make_default_state(&self) -> AbiValueArray {
        match &self.inner {
            Entity::Empty => std::iter::empty::<JsValue>().collect::<js_sys::Array>(),
            Entity::Cell(inputs) => inputs
                .iter()
                .map(|param| make_default_state(&param.kind))
                .map(JsValue::from)
                .collect::<js_sys::Array>(),
            Entity::Function(function) => function
                .inputs
                .iter()
                .map(|param| make_default_state(&param.kind))
                .map(JsValue::from)
                .collect::<js_sys::Array>(),
        }
        .unchecked_into()
    }
}

fn make_default_state(param: &ton_abi::ParamType) -> AbiValue {
    let (ty, data) = match param {
        ton_abi::ParamType::Uint(_) => ("uint", JsValue::from_str("0")),
        ton_abi::ParamType::Int(_) => ("int", JsValue::from_str("0")),
        ton_abi::ParamType::VarUint(_) => ("varuint", JsValue::from_str("0")),
        ton_abi::ParamType::VarInt(_) => ("varint", JsValue::from_str("0")),
        ton_abi::ParamType::Bool => ("bool", JsValue::from(false)),
        ton_abi::ParamType::Tuple(params) => (
            "tuple",
            params
                .iter()
                .map(|param| make_default_state(&param.kind))
                .map(JsValue::from)
                .collect::<js_sys::Array>()
                .unchecked_into(),
        ),
        ton_abi::ParamType::Array(param) => (
            "array",
            std::iter::once(make_default_state(param.as_ref()))
                .map(JsValue::from)
                .collect::<js_sys::Array>()
                .unchecked_into(),
        ),
        ton_abi::ParamType::FixedArray(param, len) => (
            "array",
            std::iter::repeat_with(|| make_default_state(param.as_ref()))
                .take(*len)
                .map(JsValue::from)
                .collect::<js_sys::Array>()
                .unchecked_into(),
        ),
        ton_abi::ParamType::Map(_, _) => ("map", ObjectBuilder::new().build()),
        ton_abi::ParamType::Cell => ("cell", JsValue::from(encode_empty_cell().trust_me())),
        ton_abi::ParamType::Address => (
            "address",
            JsValue::from(MsgAddressInt::default().to_string()),
        ),
        ton_abi::ParamType::Bytes => ("bytes", JsValue::from_str("")),
        ton_abi::ParamType::String => ("string", JsValue::from_str("")),
        ton_abi::ParamType::FixedBytes(len) => {
            ("bytes", JsValue::from_str(&hex::encode(&vec![0; *len])))
        }
        ton_abi::ParamType::Token => ("uint", JsValue::from_str("0")),
        ton_abi::ParamType::Time => ("uint", JsValue::from_str("0")),
        ton_abi::ParamType::Expire => ("uint", JsValue::from(u32::MAX.to_string())),
        ton_abi::ParamType::PublicKey => ("pubkey", JsValue::null()),
        ton_abi::ParamType::Optional(_) => ("optional", JsValue::null()),
    };

    ObjectBuilder::new()
        .set("type", ty)
        .set("data", data)
        .build()
        .unchecked_into()
}

impl From<&'_ custom_abi::Token> for ton_abi::Param {
    fn from(token: &'_ custom_abi::Token) -> Self {
        Self {
            name: String::new(),
            kind: token.into(),
        }
    }
}

impl From<&'_ custom_abi::Token> for ton_abi::ParamType {
    fn from(token: &'_ custom_abi::Token) -> Self {
        match token {
            custom_abi::Token::Bool => ton_abi::ParamType::Bool,
            custom_abi::Token::Int(size) => ton_abi::ParamType::Int(*size as usize),
            custom_abi::Token::Uint(size) => ton_abi::ParamType::Uint(*size as usize),
            custom_abi::Token::VarInt(size) => ton_abi::ParamType::VarInt(*size as usize),
            custom_abi::Token::VarUint(size) => ton_abi::ParamType::VarUint(*size as usize),
            custom_abi::Token::Address => ton_abi::ParamType::Address,
            custom_abi::Token::Bytes => ton_abi::ParamType::Bytes,
            custom_abi::Token::String => ton_abi::ParamType::String,
            custom_abi::Token::Cell => ton_abi::ParamType::Cell,
            custom_abi::Token::Token => ton_abi::ParamType::Token,
            custom_abi::Token::Array(ty) => ton_abi::ParamType::Array(Box::new(ty.as_ref().into())),
            custom_abi::Token::Map(key, value) => ton_abi::ParamType::Map(
                Box::new(key.as_ref().into()),
                Box::new(value.as_ref().into()),
            ),
            custom_abi::Token::Tuple(items) => ton_abi::ParamType::Tuple(
                items
                    .iter()
                    .map(Self::from)
                    .map(|kind| ton_abi::Param {
                        name: String::new(),
                        kind,
                    })
                    .collect(),
            ),
        }
    }
}

pub enum Entity {
    Empty,
    Cell(Vec<ton_abi::Param>),
    Function(ton_abi::Function),
}

impl From<custom_abi::Entity> for Entity {
    fn from(entity: custom_abi::Entity) -> Self {
        match entity {
            custom_abi::Entity::Empty => Entity::Empty,
            custom_abi::Entity::Cell(tokens) => {
                Entity::Cell(tokens.iter().map(ton_abi::Param::from).collect())
            }
            custom_abi::Entity::Function {
                name,
                inputs,
                outputs,
                abi_version,
            } => {
                let inputs = inputs.iter().map(ton_abi::Param::from).collect::<Vec<_>>();
                let outputs = outputs.iter().map(ton_abi::Param::from).collect::<Vec<_>>();

                let id = calc_function_id(&get_function_signature(
                    &name,
                    &inputs,
                    &outputs,
                    abi_version,
                ));

                Entity::Function(ton_abi::Function {
                    abi_version: abi_version.into(),
                    name,
                    header: Vec::new(),
                    inputs,
                    outputs,
                    input_id: id & 0x7FFFFFFF,
                    output_id: id | 0x80000000,
                })
            }
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase", tag = "type", content = "data")]
enum JsAbiValue {
    #[serde(deserialize_with = "serde_helpers::deserialize_uint")]
    Uint(BigUint),
    #[serde(deserialize_with = "serde_helpers::deserialize_int")]
    Int(BigInt),
    #[serde(deserialize_with = "serde_helpers::deserialize_uint")]
    VarUint(BigUint),
    #[serde(deserialize_with = "serde_helpers::deserialize_int")]
    VarInt(BigInt),
    Bool(bool),
    Tuple(Vec<JsAbiValue>),
    Array(Vec<JsAbiValue>),
    #[serde(deserialize_with = "serde_helpers::deserialize_cell")]
    Cell(Cell),
    #[serde(deserialize_with = "serde_helpers::deserialize_address")]
    Address(MsgAddressInt),
    #[serde(deserialize_with = "serde_helpers::deserialize_bytes")]
    Bytes(Vec<u8>),
    String(String),
    #[serde(
        rename = "pubkey",
        deserialize_with = "serde_helpers::deserialize_optional_pubkey"
    )]
    PublicKey(Option<ed25519_dalek::PublicKey>),
    Optional(Option<Box<JsAbiValue>>),
}

#[wasm_bindgen(typescript_custom_section)]
const TS_TOKEN_TYPE: &'static str = r#"
export type AbiValueWrapper<T extends string, D> = { type: T, data: D };

export type AbiValue =
  | AbiValueWrapper<'uint', string>
  | AbiValueWrapper<'int', string>
  | AbiValueWrapper<'varuint', string>
  | AbiValueWrapper<'varint', string>
  | AbiValueWrapper<'bool', boolean>
  | AbiValueWrapper<'tuple', AbiValue[]>
  | AbiValueWrapper<'array', AbiValue[]>
  | AbiValueWrapper<'cell', string>
  | AbiValueWrapper<'address', string>
  | AbiValueWrapper<'bytes', string>
  | AbiValueWrapper<'string', string>
  | AbiValueWrapper<'pubkey', string | undefined>;

export type EnumWrapper<K extends string, I> = { kind: K, info: I };

export type AbiEntity =
  | EnumWrapper<'empty', null>
  | EnumWrapper<'plain', { tokens: Array<AbiParam> }>
  | EnumWrapper<'function', { 
      name: string, 
      inputs: Array<AbiParam>, 
      outputs: Array<AbiParam>, 
      abiVersion: number,
      inputId: number,
      outputId: number, 
    }>
  | never;

export type AbiParam = {
  name: string,
  type: AbiParamType,
};

export type AbiParamType =
  | EnumWrapper<'unknown', null>
  | EnumWrapper<'uint', { size: number }>
  | EnumWrapper<'int', { size: number }>
  | EnumWrapper<'varuint', { size: number }>
  | EnumWrapper<'varint', { size: number }>
  | EnumWrapper<'bool', null>
  | EnumWrapper<'tuple', { types: Array<AbiParam> }>
  | EnumWrapper<'array', { type: AbiParamType, defaultValue: AbiValueWrapper }>
  | EnumWrapper<'fixedarray', { type: AbiParamType, size: number }>
  | EnumWrapper<'cell', null>
  | EnumWrapper<'map', { key: AbiParamType, value: AbiParamType }>
  | EnumWrapper<'address', null>
  | EnumWrapper<'bytes', null>
  | EnumWrapper<'string', null>
  | EnumWrapper<'fixedbytes', { size: number }>
  | EnumWrapper<'gram', null>
  | EnumWrapper<'time', null>
  | EnumWrapper<'expire', null>
  | EnumWrapper<'publicKey', null>;
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Array<AbiValue>")]
    pub type AbiValueArray;

    #[wasm_bindgen(typescript_type = "Array<AbiParam>")]
    pub type AbiParamArray;

    #[wasm_bindgen(typescript_type = "AbiValue")]
    pub type AbiValue;

    #[wasm_bindgen(typescript_type = "AbiEntity")]
    pub type AbiEntity;
}

impl From<&'_ Entity> for JsValue {
    fn from(entity: &'_ Entity) -> Self {
        let (kind, info) = match entity {
            Entity::Empty => ("empty", JsValue::null()),
            Entity::Cell(tokens) => (
                "plain",
                ObjectBuilder::new()
                    .set(
                        "tokens",
                        tokens
                            .iter()
                            .map(serialize_param)
                            .collect::<js_sys::Array>(),
                    )
                    .build(),
            ),
            Entity::Function(function) => (
                "function",
                ObjectBuilder::new()
                    .set("name", function.name.clone())
                    .set(
                        "inputs",
                        function
                            .inputs
                            .iter()
                            .map(serialize_param)
                            .collect::<js_sys::Array>(),
                    )
                    .set(
                        "outputs",
                        function
                            .outputs
                            .iter()
                            .map(serialize_param)
                            .collect::<js_sys::Array>(),
                    )
                    .set("abiVersion", function.abi_version.major)
                    .set("inputId", function.input_id)
                    .set("outputId", function.output_id)
                    .build(),
            ),
        };

        ObjectBuilder::new()
            .set("kind", kind)
            .set("info", info)
            .build()
    }
}

fn serialize_param(param: &ton_abi::Param) -> JsValue {
    ObjectBuilder::new()
        .set("name", param.name.as_str())
        .set("type", serialize_param_type(&param.kind))
        .build()
}

fn serialize_param_type(param: &ton_abi::ParamType) -> JsValue {
    let (kind, info) = match param {
        ton_abi::ParamType::Uint(size) => (
            "uint",
            ObjectBuilder::new().set("size", *size as u32).build(),
        ),
        ton_abi::ParamType::Int(size) => (
            "int",
            ObjectBuilder::new().set("size", *size as u32).build(),
        ),
        ton_abi::ParamType::VarUint(size) => (
            "varuint",
            ObjectBuilder::new().set("size", *size as u32).build(),
        ),
        ton_abi::ParamType::VarInt(size) => (
            "varint",
            ObjectBuilder::new().set("size", *size as u32).build(),
        ),
        ton_abi::ParamType::Bool => ("bool", JsValue::null()),
        ton_abi::ParamType::Tuple(types) => (
            "tuple",
            ObjectBuilder::new()
                .set(
                    "types",
                    types.iter().map(serialize_param).collect::<js_sys::Array>(),
                )
                .build(),
        ),
        ton_abi::ParamType::Array(ty) => (
            "array",
            ObjectBuilder::new()
                .set("type", serialize_param_type(ty))
                .set("defaultValue", make_default_state(ty))
                .build(),
        ),
        ton_abi::ParamType::FixedArray(ty, size) => (
            "fixedarray",
            ObjectBuilder::new()
                .set("type", serialize_param_type(ty.as_ref()))
                .set("size", *size as u32)
                .build(),
        ),
        ton_abi::ParamType::Cell => ("cell", JsValue::null()),
        ton_abi::ParamType::Map(key, value) => (
            "map",
            ObjectBuilder::new()
                .set("key", serialize_param_type(key.as_ref()))
                .set("value", serialize_param_type(value.as_ref()))
                .build(),
        ),
        ton_abi::ParamType::Address => ("address", JsValue::null()),
        ton_abi::ParamType::Bytes => ("bytes", JsValue::null()),
        ton_abi::ParamType::String => ("string", JsValue::null()),
        ton_abi::ParamType::FixedBytes(size) => (
            "fixedbytes",
            ObjectBuilder::new().set("size", *size as u32).build(),
        ),
        ton_abi::ParamType::Token => ("gram", JsValue::null()),
        ton_abi::ParamType::Time => ("time", JsValue::null()),
        ton_abi::ParamType::Expire => ("expire", JsValue::null()),
        ton_abi::ParamType::PublicKey => ("publicKey", JsValue::null()),
        ton_abi::ParamType::Optional(param) => ("optional", serialize_param_type(param)),
    };

    ObjectBuilder::new()
        .set("kind", kind)
        .set("info", info)
        .build()
}

fn make_token_value(value: &ton_abi::TokenValue) -> Result<JsValue, JsValue> {
    Ok(match value {
        ton_abi::TokenValue::Uint(value) => JsValue::from(value.number.to_string()),
        ton_abi::TokenValue::Int(value) => JsValue::from(value.number.to_string()),
        ton_abi::TokenValue::VarInt(_, value) => JsValue::from(value.to_string()),
        ton_abi::TokenValue::VarUint(_, value) => JsValue::from(value.to_string()),
        ton_abi::TokenValue::Bool(value) => JsValue::from(*value),
        ton_abi::TokenValue::Tuple(values) => {
            let tuple = js_sys::Object::new();
            for token in values.iter() {
                js_sys::Reflect::set(
                    &tuple,
                    &JsValue::from_str(&token.name),
                    &make_token_value(&token.value)?,
                )
                .trust_me();
            }
            tuple.unchecked_into()
        }
        ton_abi::TokenValue::Array(_, values) | ton_abi::TokenValue::FixedArray(_, values) => {
            values
                .iter()
                .map(make_token_value)
                .collect::<Result<js_sys::Array, _>>()
                .map(JsCast::unchecked_into)?
        }
        ton_abi::TokenValue::Cell(value) => {
            let data = ton_types::serialize_toc(value).handle_error()?;
            JsValue::from(base64::encode(&data))
        }
        ton_abi::TokenValue::Map(_, _, values) => values
            .iter()
            .map(|(key, value)| {
                Result::<JsValue, JsValue>::Ok(
                    [JsValue::from_str(key.as_str()), make_token_value(&value)?]
                        .iter()
                        .collect::<js_sys::Array>()
                        .unchecked_into(),
                )
            })
            .collect::<Result<js_sys::Array, _>>()?
            .unchecked_into(),
        ton_abi::TokenValue::Address(value) => JsValue::from(value.to_string()),
        ton_abi::TokenValue::Bytes(value) | ton_abi::TokenValue::FixedBytes(value) => {
            JsValue::from(base64::encode(value))
        }
        ton_abi::TokenValue::String(value) => JsValue::from(value),
        ton_abi::TokenValue::Token(value) => JsValue::from(value.0.to_string()),
        ton_abi::TokenValue::Time(value) => JsValue::from(value.to_string()),
        ton_abi::TokenValue::Expire(value) => JsValue::from(*value),
        ton_abi::TokenValue::PublicKey(value) => {
            JsValue::from(value.map(|value| hex::encode(value.as_bytes())))
        }
        ton_abi::TokenValue::Optional(_, value) => match value {
            Some(value) => make_token_value(value)?,
            None => JsValue::null(),
        },
    })
}

#[wasm_bindgen(typescript_custom_section)]
const TOKEN: &str = r#"
export type AbiToken =
    | boolean
    | string
    | number
    | { [K in string]: AbiToken }
    | AbiToken[]
    | (readonly [AbiToken, AbiToken])[];
    
type TokensObject = { [K in string]: AbiToken };
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "TokensObject")]
    pub type TokensObject;
}

fn make_tokens_object(tokens: &[ton_abi::Token]) -> Result<TokensObject, JsValue> {
    let object = js_sys::Object::new();
    for token in tokens.iter() {
        js_sys::Reflect::set(
            &object,
            &JsValue::from_str(&token.name),
            &make_token_value(&token.value)?,
        )
        .trust_me();
    }
    Ok(object.unchecked_into())
}

struct ObjectBuilder {
    object: js_sys::Object,
}

impl ObjectBuilder {
    fn new() -> Self {
        Self {
            object: js_sys::Object::new(),
        }
    }

    fn set<T>(self, key: &str, value: T) -> Self
    where
        JsValue: From<T>,
    {
        let key = JsValue::from_str(key);
        let value = JsValue::from(value);
        js_sys::Reflect::set(&self.object, &key, &value).trust_me();
        self
    }

    fn build(self) -> JsValue {
        JsValue::from(self.object)
    }
}
