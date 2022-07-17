use std::borrow::Cow;

use ton_abi::{Param, ParamType};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::utils::{HandleError, ObjectBuilder};

#[wasm_bindgen(typescript_custom_section)]
const ABI_ENTITY: &str = r#"
import type * as ever from 'everscale-inpage-provider';

export type AbiEntity =
  | { kind: 'empty' }
  | { kind: 'cell'; structure: ever.AbiParam[] }
  | {
      kind: 'function';
      name: string;
      inputs: ever.AbiParam[];
      inputId: number;
      outputId: number;
    };
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "AbiEntity")]
    pub type AbiEntity;
}

#[wasm_bindgen(js_name = "parse")]
pub fn parse(abi: &str) -> Result<AbiEntity, JsValue> {
    let abi = abi.trim();
    let custom_abi = abi_parser::Entity::parse(abi)
        .or_else(
            |e| match serde_json::from_str::<ton_abi::contract::SerdeFunction>(abi) {
                Ok(raw) => {
                    let mut function = ton_abi::Function {
                        abi_version: ton_abi::contract::ABI_VERSION_2_2,
                        name: raw.name,
                        header: Default::default(),
                        inputs: raw.inputs,
                        outputs: raw.outputs,
                        input_id: 0,
                        output_id: 0,
                    };
                    if let Some(id) = raw.id {
                        function.input_id = id;
                        function.output_id = id;
                    } else {
                        let id = function.get_function_id();
                        function.input_id = id & !0x80000000;
                        function.output_id = id | 0x80000000;
                    }
                    Ok(abi_parser::Entity::Function(function))
                }
                Err(_) => Err(e),
            },
        )
        .handle_error()?;

    Ok(match custom_abi {
        abi_parser::Entity::Empty => ObjectBuilder::new().set("kind", "empty"),
        abi_parser::Entity::Cell(params) => ObjectBuilder::new()
            .set("kind", "cell")
            .set("structure", make_params(params)),
        abi_parser::Entity::Function(function) => ObjectBuilder::new()
            .set("kind", "function")
            .set("name", function.name)
            .set("inputs", make_params(function.inputs))
            .set("inputId", function.input_id)
            .set("outputId", function.output_id),
    }
    .build()
    .unchecked_into())
}

fn make_params(params: Vec<Param>) -> JsValue {
    let result = js_sys::Array::new();
    for param in params {
        result.push(&make_param(param));
    }
    result.unchecked_into()
}

fn make_param(param: Param) -> JsValue {
    let (ty, components) = make_param_type(param.kind);
    let mut res = ObjectBuilder::new()
        .set("name", param.name)
        .set("type", JsValue::from_str(ty.as_ref()));
    if let Some(components) = components {
        res = res.set("components", components);
    }
    res.build()
}

fn make_param_type(param_type: ParamType) -> (Cow<'static, str>, Option<JsValue>) {
    match param_type {
        ParamType::Uint(len) => (Cow::Owned(format!("uint{len}")), None),
        ParamType::Int(len) => (Cow::Owned(format!("int{len}")), None),
        ParamType::VarUint(len) => (Cow::Owned(format!("varuint{len}")), None),
        ParamType::VarInt(len) => (Cow::Owned(format!("varint{len}")), None),
        ParamType::Bool => (Cow::Borrowed("bool"), None),
        ParamType::Tuple(params) => (Cow::Borrowed("tuple"), Some(make_params(params))),
        ParamType::Array(param) => {
            let (ty, components) = make_param_type(*param);
            (Cow::Owned(format!("{ty}[]")), components)
        }
        ParamType::FixedArray(param, len) => {
            let (ty, components) = make_param_type(*param);
            (Cow::Owned(format!("{ty}[{len}]")), components)
        }
        ParamType::Cell => (Cow::Borrowed("cell"), None),
        ParamType::Map(key, value) => {
            let (key, _) = make_param_type(*key);
            let (value, components) = make_param_type(*value);
            (Cow::Owned(format!("map({key},{value})")), components)
        }
        ParamType::Address => (Cow::Borrowed("address"), None),
        ParamType::Bytes => (Cow::Borrowed("bytes"), None),
        ParamType::FixedBytes(len) => (Cow::Owned(format!("fixedbytes{len}")), None),
        ParamType::String => (Cow::Borrowed("string"), None),
        ParamType::Token => (Cow::Borrowed("gram"), None),
        ParamType::Time => (Cow::Borrowed("time"), None),
        ParamType::Expire => (Cow::Borrowed("expire"), None),
        ParamType::PublicKey => (Cow::Borrowed("pubkey"), None),
        ParamType::Optional(param) => {
            let (ty, components) = make_param_type(*param);
            (Cow::Owned(format!("optional({ty})")), components)
        }
        ParamType::Ref(param) => {
            let (ty, components) = make_param_type(*param);
            (Cow::Owned(format!("ref({ty})")), components)
        }
    }
}
