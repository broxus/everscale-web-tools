mod custom_abi;
mod utils;

use serde::Deserialize;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

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

#[wasm_bindgen(js_name = "parseAbi")]
pub fn parse_abi(input: &str) -> Result<AbiEntityHandler, JsValue> {
    let inner = custom_abi::parse(input)
        .map(Entity::from)
        .map_err(|e| e.to_string())
        .or_else(|_| {
            serde_json::from_str::<AbiFunction>(input)
                .map(|function| Entity::Function {
                    name: function.name,
                    inputs: function.inputs,
                    outputs: function.outputs,
                    abi_version: 2,
                })
                .map_err(|e| e.to_string())
        })
        .handle_error()?;

    Ok(AbiEntityHandler { inner })
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
struct AbiFunction {
    pub name: String,
    pub inputs: Vec<ton_abi::Param>,
    pub outputs: Vec<ton_abi::Param>,
}

#[wasm_bindgen(js_name = "encodeEmptyCell")]
pub fn encode_empty_cell() -> Result<String, JsValue> {
    ton_types::serialize_toc(&ton_types::Cell::default())
        .handle_error()
        .map(base64::encode)
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
            custom_abi::Token::Address => ton_abi::ParamType::Address,
            custom_abi::Token::Bytes => ton_abi::ParamType::Bytes,
            custom_abi::Token::Cell => ton_abi::ParamType::Cell,
            custom_abi::Token::Gram => ton_abi::ParamType::Gram,
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
    Function {
        name: String,
        inputs: Vec<ton_abi::Param>,
        outputs: Vec<ton_abi::Param>,
        abi_version: u8,
    },
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
            } => Entity::Function {
                name,
                inputs: inputs.iter().map(ton_abi::Param::from).collect(),
                outputs: outputs.iter().map(ton_abi::Param::from).collect(),
                abi_version,
            },
        }
    }
}

#[wasm_bindgen(typescript_custom_section)]
const TS_TOKEN_TYPE: &'static str = r#"
export type EnumWrapper<K extends string, I> = { kind: K, info: I };

export type AbiEntity =
    | EnumWrapper<'empty', null>
    | EnumWrapper<'plain', { tokens: Array<AbiParam> }>
    | EnumWrapper<'function', { name: string, inputs: Array<AbiParam>, outputs: Array<AbiParam>, abiVersion: number }>
    | never;

export type AbiParam = {
    name: string,
    type: AbiParamType,
};

export type AbiParamType =
    | EnumWrapper<'unknown', null>
    | EnumWrapper<'uint', { size: number }>
    | EnumWrapper<'int', { size: number }>
    | EnumWrapper<'bool', null>
    | EnumWrapper<'tuple', { types: Array<AbiParam> }>
    | EnumWrapper<'array', { type: AbiParamType }>
    | EnumWrapper<'fixedarray', { type: AbiParamType, size: number }>
    | EnumWrapper<'cell', null>
    | EnumWrapper<'map', { key: AbiParamType, value: AbiParamType }>
    | EnumWrapper<'address', null>
    | EnumWrapper<'bytes', null>
    | EnumWrapper<'fixedbytes', { size: number }>
    | EnumWrapper<'gram', null>
    | EnumWrapper<'time', null>
    | EnumWrapper<'expire', null>
    | EnumWrapper<'publicKey', null>;
"#;

#[wasm_bindgen]
extern "C" {
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
            Entity::Function {
                name,
                inputs,
                outputs,
                abi_version,
            } => (
                "function",
                ObjectBuilder::new()
                    .set("name", name)
                    .set(
                        "inputs",
                        inputs
                            .iter()
                            .map(serialize_param)
                            .collect::<js_sys::Array>(),
                    )
                    .set(
                        "outputs",
                        outputs
                            .iter()
                            .map(serialize_param)
                            .collect::<js_sys::Array>(),
                    )
                    .set("abiVersion", *abi_version)
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
        ton_abi::ParamType::Unknown => ("unknown", JsValue::null()),
        ton_abi::ParamType::Uint(size) => (
            "uint",
            ObjectBuilder::new().set("size", *size as u32).build(),
        ),
        ton_abi::ParamType::Int(size) => (
            "int",
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
                .set("type", serialize_param_type(ty.as_ref()))
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
        ton_abi::ParamType::FixedBytes(size) => (
            "fixedbytes",
            ObjectBuilder::new().set("size", *size as u32).build(),
        ),
        ton_abi::ParamType::Gram => ("gram", JsValue::null()),
        ton_abi::ParamType::Time => ("time", JsValue::null()),
        ton_abi::ParamType::Expire => ("expire", JsValue::null()),
        ton_abi::ParamType::PublicKey => ("publicKey", JsValue::null()),
    };

    ObjectBuilder::new()
        .set("kind", kind)
        .set("info", info)
        .build()
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
