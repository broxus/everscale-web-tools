use anyhow::Result;
use case::CaseExt;
use codegen::{Field, Scope, Struct, Type};
use itertools::Itertools;
use once_cell::sync::OnceCell;
use std::collections::HashMap;
use std::sync::Mutex;
use ton_abi::{Contract, Event, Function, Param, ParamType};
use wasm_bindgen::prelude::*;
use shared::*;

pub const EVER_TYPE_NAMES: &[&str] = &[
    "array", "int8", "uint8", "uint16", "uint32", "uint64", "uint128", "uint256", "gram", "grams",
    "token", "tokens", "bool", "cell", "address", "string", "bytes",
];

fn helpers_mapping() -> &'static Mutex<HashMap<String, String>> {
    static INSTANCE: OnceCell<Mutex<HashMap<String, String>>> = OnceCell::new();
    INSTANCE.get_or_init(|| {
        let mut m = HashMap::new();
        m.insert(
            "uint160".to_string(),
            "unpack_with=\"uint160_bytes\"".to_string(),
        );
        m.insert(
            "uint160[]".to_string(),
            "unpack_with=\"array_uint160_bytes\"".to_string(),
        );
        Mutex::new(m)
    })
}

#[wasm_bindgen(js_name = "generateRustCodeFromParams")]
pub fn generate_rust_code_from_params(params: &str) -> Result<String, JsValue> {
    let entity = abi_parser::Entity::parse(params).handle_error()?;
    match entity {
        abi_parser::Entity::Cell(p) => {
            let mut generator = Generator::default();
            generator.generate_structs_from_params(p.as_slice()).handle_error()
        }
        _ => Ok("".to_string())
    }
}

#[wasm_bindgen(js_name = "generateRustCode")]
pub fn generate_rust_code(abi: &str) -> Result<String, JsValue> {
    let mut generator = Generator::load_contract(abi).handle_error()?;
    let mut function_inputs = generator.generate_function_input_structs().handle_error()?;

    let mut function_outputs = generator.generate_function_output_structs().handle_error()?;

    let mut event_outputs = generator.generate_events_input_structs().handle_error()?;

    function_outputs.append(&mut function_inputs);
    function_outputs.append(&mut event_outputs);

     let mut module = codegen::Module::new("");
     let _ = &module
        .import("serde", "Serialize")
        .import("serde", "Deserialize")
        .import("nekoton_abi", "UnpackAbi")
        .import("nekoton_abi", "UnpackAbiPlain")
        .import("nekoton_abi", "PackAbi")
        .import("nekoton_abi", "PackAbiPlain")
        .import("nekoton_abi", "UnpackerError")
        .import("nekoton_abi", "UnpackerResult")
        .import("nekoton_abi", "BuildTokenValue")
        .import("nekoton_abi", "TokenValueExt")
        .import("ton_abi", "Param")
        .import("ton_abi", "ParamType")
        .import("std::collections", "HashMap")
        .import("once_cell::sync", "OnceCell");
     let mut scope = module.scope();

    generator.generate_structs(&mut scope, function_outputs).handle_error()?;
    generator.generate_functions(&mut scope);
    Ok(scope.to_string())
}

pub struct Generator {
    contract_functions: HashMap<String, Function>,
    contract_events: HashMap<String, Event>,

    output_structs: HashMap<String, Struct>,
    output_function_inner_structs: HashMap<String, Struct>,
    output_inner_struct_count: u32,
}

impl Default for Generator {
    fn default() -> Self {
        Self {
            contract_functions: HashMap::default(),
            contract_events: HashMap::default(),

            output_function_inner_structs: HashMap::default(),
            output_structs: HashMap::default(),
            output_inner_struct_count: 0,
        }
    }
}

impl Generator {
    pub fn load_contract(abi: &str) -> Result<Generator> {
        let contract = Contract::load(abi)?;
        Ok(Self {
            contract_functions: contract.functions,
            contract_events: contract.events,

            output_function_inner_structs: HashMap::default(),
            output_structs: HashMap::default(),
            output_inner_struct_count: 0,
        })
    }

    pub fn load_raw(functions: HashMap<String, Function>, events: HashMap<String, Event>) -> Self {
        Self {
            contract_functions: functions,
            contract_events: events,

            output_function_inner_structs: HashMap::default(),
            output_structs: HashMap::default(),
            output_inner_struct_count: 0,
        }
    }

    pub fn generate_structs_from_params(&mut self, params: &[Param]) -> Result<String> {
        let mut i = 0;

        let mut module = codegen::Module::new("");
        let _ = &module
            .import("serde", "Serialize")
            .import("serde", "Deserialize")
            .import("nekoton_abi", "UnpackAbi")
            .import("nekoton_abi", "UnpackAbiPlain")
            .import("nekoton_abi", "PackAbi")
            .import("nekoton_abi", "PackAbiPlain")
            .import("nekoton_abi", "UnpackerError")
            .import("nekoton_abi", "UnpackerResult")
            .import("nekoton_abi", "BuildTokenValue")
            .import("nekoton_abi", "TokenValueExt")
            .import("ton_abi", "Param")
            .import("ton_abi", "ParamType")
            .import("std::collections", "HashMap")
            .import("once_cell::sync", "OnceCell");
        let scope = module.scope();

        let mut properties = Vec::new();
        for param in params {
            let name = format!("value{i}");
            let property = generate_property(Some(name), &param.kind)?;
            properties.push(property);
            i += 1;
        }

        let mut abi_struct = Struct::new("CommonStruct");
        abi_struct
            .derive("Serialize")
            .derive("Deserialize")
            .derive("Debug")
            .derive("Clone")
            .derive("PackAbi")
            .derive("UnpackAbiPlain")
            .vis("pub");

        self.generate_struct(properties.as_slice(), &mut abi_struct)?;

        self.output_structs
            .insert(abi_struct.ty().name().to_string(), abi_struct);

        for (_, str) in self.output_structs.iter() {
            scope.push_struct(str.clone());
        }

        for (_, str) in self.output_function_inner_structs.iter() {
            scope.push_struct(str.clone());
        }

        Ok(scope.to_string())
    }

    pub fn generate_functions(&self, scope: &mut Scope) {
        let mut impls = Vec::new();
        for (_, function) in self.contract_functions.iter() {
            let imp = self.generate_function(function);
            impls.push(imp);
        }

        for (_, event) in self.contract_events.iter() {
            let imp = self.generate_event(event);
            impls.push(imp);
        }

        for imp in impls {
            scope.push_fn(imp.struct_impl);
        }
    }

    pub fn generate_function_input_structs(&self) -> Result<Vec<GenericStruct>> {
        let mut inputs = Vec::new();
        for (func_name, function) in self.contract_functions.iter() {
            let mut function_input_properties = Vec::new();
            for i in function.inputs.iter() {
                let property = generate_property(Some(i.name.clone()), &i.kind)?;
                function_input_properties.push(property);
            }
            if !function_input_properties.is_empty() {
                let input = GenericStruct {
                    name: format!("{}FunctionInput", func_name).to_camel(),
                    //abi_name: Some(func_name.to_string()),
                    properties: function_input_properties,
                };
                inputs.push(input);
            }
        }

        Ok(inputs)
    }

    pub fn generate_function_output_structs(&self) -> Result<Vec<GenericStruct>> {
        let mut inputs = Vec::new();
        for (func_name, function) in self.contract_functions.iter() {
            let mut function_output_properties = Vec::new();
            for i in function.outputs.iter() {
                let property = generate_property(Some(i.name.clone()), &i.kind)?;
                function_output_properties.push(property);
            }
            if !function_output_properties.is_empty() {
                let input = GenericStruct {
                    name: format!("{}FunctionOutput", func_name).to_camel(),
                    //abi_name: Some(func_name.to_string()),
                    properties: function_output_properties,
                };
                inputs.push(input);
            }
        }

        Ok(inputs)
    }

    pub fn generate_events_input_structs(&self) -> Result<Vec<GenericStruct>> {
        let mut inputs = Vec::new();
        for (func_name, function) in self.contract_events.iter() {
            let mut event_input_properties = Vec::new();
            for i in function.inputs.iter() {
                let property = generate_property(Some(i.name.clone()), &i.kind)?;
                event_input_properties.push(property);
            }
            let input = GenericStruct {
                name: format!("{}EventOutput", func_name).to_camel(),
                //abi_name: Some(func_name.to_string()),
                properties: event_input_properties,
            };
            inputs.push(input);
        }

        Ok(inputs)
    }

    pub fn generate_structs(&mut self, scope: &mut Scope, struct_metas: Vec<GenericStruct>) -> Result<()> {
        for meta in struct_metas {
            let mut abi_struct = Struct::new(&meta.name);
            abi_struct
                .derive("Serialize")
                .derive("Deserialize")
                .derive("Debug")
                .derive("Clone")
                .derive("PackAbi")
                .derive("UnpackAbiPlain")
                .vis("pub");

            self.generate_struct(meta.properties.as_slice(), &mut abi_struct)?;
            self.output_structs
                .insert(abi_struct.ty().name().to_string(), abi_struct);
        }
        for (_, str) in self.output_structs.iter() {
            scope.push_struct(str.clone());
        }
        for (_, str) in self.output_function_inner_structs.iter() {
            scope.push_struct(str.clone());
        }
        Ok(())
    }

    fn get_type(
        &mut self,
        initial_type_desc: &mut &str,
        property: &StructProperty,
        abi_struct: &mut Struct,
    ) -> Result<String> {
        let ty = match property {
            StructProperty::Simple { rust_type_name, .. } => {
                initial_type_desc.replace("{}", &rust_type_name)
            }
            StructProperty::Array {
                internal_struct_property,
                ..
            } => {
                let initial_type = initial_type_desc.replace("{}", "Vec<{}>");
                self.get_type(
                    &mut initial_type.as_ref(),
                    internal_struct_property,
                    abi_struct,
                )?
            }
            StructProperty::Option {
                internal_struct_property,
                ..
            } => {
                let initial_type = initial_type_desc.replace("{}", "Option<{}>");
                self.get_type(
                    &mut initial_type.as_ref(),
                    internal_struct_property,
                    abi_struct,
                )?
            }
            StructProperty::Tuple { internal_types, .. } => {
                let name = self.generate_inner_struct(internal_types.as_slice())?;
                initial_type_desc.replace("{}", &name)
            }
            StructProperty::HashMap { key, value, .. } => {
                let key = match key.as_ref() {
                    StructProperty::Simple { rust_type_name, .. } => rust_type_name.to_string(),
                    _ => unimplemented!("Hashmap hey can only be simple property"),
                };

                let mut initial_type = "{}";
                let value_type = self.get_type(&mut initial_type, value.as_ref(), abi_struct)?;
                format!("HashMap<{}, {}>", key, value_type)
            }
        };

        Ok(ty)
    }

    fn generate_inner_struct(&mut self, properties: &[StructProperty]) -> Result<String> {
        let key_name: String = properties
            .iter()
            .map(|x| x.abi_name().to_string() + &x.type_str())
            .reduce(|a, b| (a + &b))
            .unwrap_or_default();

        let existing_struct = self
            .output_function_inner_structs
            .iter()
            .find(|(key, _)| key.as_str() == key_name);

        let struct_name = match existing_struct {
            Some((_, value)) => value.ty().name().to_string(),
            None => {
                self.output_inner_struct_count += 1;
                let name = format!("InternalStruct{}", self.output_inner_struct_count);
                println!("{name}");
                let mut st = Struct::new(&name)
                    .derive("Serialize")
                    .derive("Deserialize")
                    .derive("Debug")
                    .derive("Clone")
                    .derive("UnpackAbi")
                    .vis("pub")
                    .clone();
                self.generate_struct(properties, &mut st)?;
                self.output_function_inner_structs
                    .insert(key_name.to_string(), st);
                name
            }
        };

        Ok(struct_name)
    }

    fn generate_struct(&mut self, properties: &[StructProperty], abi_struct: &mut Struct) -> Result<()> {
        for sp in properties {
            let name = sp.abi_name();
            let rust_name = sp.rust_name();
            let derive_type = sp.abi_derive_type_name()?;

            let mut field = Field::new(&("pub ".to_string() + &sp.rust_name()).to_string(), "()");
            let mut annotations = Vec::new();

            let annotation = if name != rust_name {
                if let Some(derived) = derive_type.as_ref() {
                    format!("#[abi(name = \"{name}\", {derived})]")
                } else {
                    format!("#[abi(name = \"{name}\")]")
                }
            } else {
                if let Some(derived) = derive_type.as_ref() {
                    format!("#[abi({derived})]")
                } else {
                    format!("#[abi]")
                }
            };
            annotations.push(annotation);

            field.annotation(annotations.iter().map(|x| x.as_str()).collect());

            match sp {
                StructProperty::Simple { rust_type_name, .. } => {
                    let t = Type::new(rust_type_name.as_str());
                    field.ty = t;
                    abi_struct.push_field(field);
                }
                StructProperty::Array {
                    internal_struct_property,
                    ..
                } => {
                    let mut initial_type = "Vec<{}>";
                    let field_type =
                        self.get_type(&mut initial_type, internal_struct_property, abi_struct)?;
                    let t = Type::new(field_type.as_str());

                    field.ty = t;
                    abi_struct.push_field(field);
                }
                StructProperty::Option {
                    internal_struct_property,
                    ..
                } => {
                    let mut initial_type = "Option<{}>";
                    let field_type =
                        self.get_type(&mut initial_type, internal_struct_property, abi_struct)?;

                    let t = Type::new(field_type.as_str());
                    field.ty = t;
                    abi_struct.push_field(field);
                }
                StructProperty::Tuple { internal_types, .. } => {
                    let name = self.generate_inner_struct(internal_types.as_slice())?;
                    let t = Type::new(name.as_str());
                    field.ty = t;
                    abi_struct.push_field(field);
                }
                StructProperty::HashMap { key, value, .. } => {
                    let key = match key.as_ref() {
                        StructProperty::Simple { rust_type_name, .. } => rust_type_name.to_string(),
                        _ => unimplemented!("Hashmap hey can only be simple property"),
                    };

                    let mut initial_type = "{}";
                    let value_type = self.get_type(&mut initial_type, value.as_ref(), abi_struct)?;
                    let type_name = format!("HashMap<{}, {}>", key, value_type);

                    let t = Type::new(type_name.as_str());
                    field.ty = t;
                    abi_struct.push_field(field);
                }
            }
        }
        Ok(())
    }

    fn generate_function(&self, function: &Function) -> FunctionImpl {
        let headers = params_to_string(function.header.as_slice());
        let mut fun = codegen::Function::new(&function.name.to_snake())
            .vis("pub")
            .ret("&'static ton_abi::Function")
            .line("static FUNCTION: OnceCell<ton_abi::Function> = OnceCell::new();")
            .line("FUNCTION.get_or_init(|| {")
            .line(format!("let header = {}", headers))
            .clone();

        if !(function.inputs.is_empty() && function.outputs.is_empty()) {
            fun = fun
                .line(format!(
                    "let mut builder = FunctionBuilder::new(\"{}\");",
                    function.name
                ))
                .clone();
        }
        let _input = if !function.inputs.is_empty() {
            let mut res = "let input = ".to_string();
            let input = params_to_string(function.inputs.as_slice());
            res += &input;
            fun = fun.line(res).clone();
            fun = fun.line("builder = builder.inputs(input);").clone();

            let name = format!("{}FunctionInput", function.name)
                .replace(|x| !char::is_alphanumeric(x), "_")
                .to_camel();
            Some(impl_gen(&input, &name))
        } else {
            None
        };
        let _output = if !function.outputs.is_empty() {
            let mut res = "let output = ".to_string();
            let output = params_to_string(function.outputs.as_slice());
            res += &output;
            fun = fun.line(res).clone();
            fun = fun.line("builder = builder.outputs(output);").clone();
            let name = format!("{}FunctionOutput", function.name)
                .replace(|x| !char::is_alphanumeric(x), "_")
                .to_camel();
            Some(impl_gen(&output, &name))
        } else {
            None
        };
        let struct_impl = fun
            .line("builder.headers(header)")
            .line(".build()")
            .line("})")
            .clone();
        FunctionImpl {
            struct_impl,
            //builder_impl: (input, output),
        }
    }

    fn generate_event(&self, event: &Event) -> FunctionImpl {
        let mut fun = codegen::Function::new(&event.name.to_snake())
            .vis("pub")
            .ret("&'static ton_abi::Event")
            .line("static EVENT: OnceCell<ton_abi::Event> = OnceCell::new();")
            .line("EVENT.get_or_init(|| {")
            .clone();
        let _input = if !(event.inputs.is_empty()) {
            fun = fun
                .line(format!(
                    "let mut builder = EventBuilder::new(\"{}\");",
                    event.name
                ))
                .clone();
            let mut res = "let input = ".to_string();
            let input = params_to_string(event.inputs.as_slice());
            res += &input;
            fun = fun.line(res).clone();
            fun = fun.line("builder = builder.inputs(input);").clone();
            let name = format!("{}EventInput", event.name)
                .replace(|x| !char::is_alphanumeric(x), "_")
                .to_camel();
            Some(impl_gen(&input, &name))
        } else {
            None
        };
        let fun = fun.line("builder.build()").line("})").clone();
        FunctionImpl {
            struct_impl: fun,
            //builder_impl: (input, None),
        }
    }
}

struct FunctionImpl {
    struct_impl: codegen::Function,
    //builder_impl: (Option<codegen::Impl>, Option<codegen::Impl>), //Input output
}

fn impl_gen(tokens: &str, name: &str) -> codegen::Impl {
    let mut imp = codegen::Impl::new(name);
    let fun = codegen::Function::new("make_params_tuple")
        .vis("pub")
        .ret("ton_abi::ParamType")
        .line("use std::iter::FromIterator;")
        .line(format!("let tokens  = {}", tokens))
        .line("TupleBuilder::from_iter(tokens).build()")
        .clone();
    imp.push_fn(fun);
    imp
}

fn params_to_string(params: &[Param]) -> String {
    fn param_type_to_string(param: ParamType) -> String {
        match param.clone() {
            ParamType::Tuple(a) => {
                let components = a
                    .into_iter()
                    .map(|x| param_to_string(x.kind, &x.name))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("ParamType::Tuple(vec![{}])", components)
            }
            ParamType::Array(a) => {
                let ty = param_type_to_string(*a);
                format!("ParamType::Array(Box::new({}))", ty)
            }
            ParamType::FixedArray(a, _) => {
                let ty = param_type_to_string(*a);
                format!("ParamType::FixedArray(Box::new({}))", ty)
            }
            ParamType::Map(a, b) => {
                let a = param_type_to_string(*a);
                let b = param_type_to_string(*b);
                format!("ParamType::Map(Box::new({}), Box::new({}))", a, b)
            }
            _ => {
                format!("ParamType::{:?}", param)
            }
        }
    }

    fn param_to_string(param: ParamType, name: &str) -> String {
        let param_type = param_type_to_string(param);
        format!(
            "Param{{name: \"{}\".to_string(), kind: {}}}",
            name, param_type
        )
    }

    let mut res = "vec![".to_string();
    let joined = params
        .into_iter()
        .map(|x| param_to_string(x.kind.clone(), &x.name))
        .join(",");
    res += &joined;
    res += "];";
    res
}

fn generate_property(abi_name: Option<String>, param: &ParamType) -> Result<StructProperty> {
    let rust_type = match param {
        ParamType::Uint(a) => match a {
            8 => "u8",
            16 => "u16",
            32 => "u32",
            64 => "u64",
            128 => "u128",
            160 => "num_bigint::BigUint",
            256 => "ton_types::UInt256",
            _ => "num_bigint::BigUint",
        }
        .to_string(),
        ParamType::Int(a) => match a {
            8 => "i8",
            16 => "i16",
            32 => "i32",
            64 => "i64",
            128 => "i128",
            _ => "num_bigint::BigInt",
        }
        .to_string(),
        ParamType::VarUint(_) => "num_bigint::BigUint".to_string(),
        ParamType::VarInt(_) => "num_bigint::BigUint".to_string(),
        ParamType::Bool => "bool".to_string(),
        ParamType::Tuple(a) => {
            let mut structs: Vec<StructProperty> = Vec::new();
            for i in a {
                let name = i.name.clone();
                let property = generate_property(Some(name), &i.kind)?;
                structs.push(property);
            }
            return Ok(StructProperty::Tuple {
                abi_name: abi_name.unwrap_or_default(),
                internal_types: structs,
                params: a.iter().map(|x| x.kind.clone()).collect(),
            });
        }
        ParamType::Array(a) | ParamType::FixedArray(a, _) => {
            let internal_struct = generate_property(None, a.as_ref())?;
            return Ok(StructProperty::Array {
                abi_name: abi_name.unwrap_or_default(),
                internal_type: a.clone(),
                internal_struct_property: Box::new(internal_struct),
            });
        }
        ParamType::Cell => "ton_types::Cell".to_string(),
        ParamType::Map(ref a, ref b) => {
            let key = match a.as_ref() {
                &ParamType::Uint(_) | &ParamType::Int(_) | &ParamType::Address => {
                    generate_property(None, a.as_ref())?
                }
                _ => anyhow::bail!("Map key is not allowed type"),
            };

            let value = generate_property(None, b.as_ref())?;

            return Ok(StructProperty::HashMap {
                abi_name: abi_name.unwrap_or_default(),
                key: Box::new(key),
                value: Box::new(value),
                key_type: Box::new(a.as_ref().clone()),
                value_type: Box::new(b.as_ref().clone()),
            });
        }
        ParamType::Address => "ton_block::MsgAddressInt".to_string(),
        ParamType::Bytes => "Vec<u8>".to_string(),
        ParamType::FixedBytes(_) => "Vec<u8>".to_string(),
        ParamType::String => "String".to_string(),
        ParamType::Token => "ton_block::Grams".to_string(),
        ParamType::Time => "u64".to_string(),
        ParamType::Expire => "u32".to_string(),
        ParamType::PublicKey => "ed25519_dalek::PublicKey".to_string(),
        ParamType::Optional(a) => {
            let internal_struct = generate_property(None, a.as_ref())?;
            return Ok(StructProperty::Array {
                abi_name: abi_name.unwrap_or_default(),
                internal_type: a.clone(),
                internal_struct_property: Box::new(internal_struct),
            });
        }
        ParamType::Ref(a) => return generate_property(abi_name, a.as_ref()),
    };

    Ok(StructProperty::Simple {
        abi_name: abi_name.unwrap_or_default(),
        rust_type_name: rust_type,
        internal_type: Box::new(param.clone()),
    })
}

#[derive(Debug)]
pub struct GenericStruct {
    name: String,
    //abi_name: Option<String>,
    properties: Vec<StructProperty>,
}

#[derive(Debug, Clone)]
pub enum StructProperty {
    Simple {
        abi_name: String,
        rust_type_name: String,
        internal_type: Box<ParamType>,
    },
    Array {
        abi_name: String,
        internal_type: Box<ParamType>,
        internal_struct_property: Box<StructProperty>,
    },
    Option {
        abi_name: String,
        internal_type: Box<ParamType>,
        internal_struct_property: Box<StructProperty>,
    },
    Tuple {
        abi_name: String,
        internal_types: Vec<StructProperty>,
        params: Vec<ParamType>,
    },
    HashMap {
        abi_name: String,
        key: Box<StructProperty>,
        value: Box<StructProperty>,
        key_type: Box<ParamType>,
        value_type: Box<ParamType>,
    },
}

impl StructProperty {
    pub fn type_str(&self) -> String {
        let type_name = match self {
            StructProperty::Simple { internal_type, .. } => internal_type.type_signature(),
            StructProperty::Array { internal_type, .. } => {
                format!("{}[]", internal_type.type_signature())
            }
            StructProperty::Option { internal_type, .. } => {
                format!("optional({})", internal_type.type_signature())
            }
            StructProperty::Tuple { params, .. } => {
                let mut signature = "".to_owned();
                for param in params {
                    signature += ",";
                    signature += &param.type_signature();
                }
                signature.replace_range(..1, "(");
                signature + ")"
            }
            StructProperty::HashMap {
                key_type,
                value_type,
                ..
            } => {
                format!(
                    "map({},{})",
                    key_type.type_signature(),
                    value_type.type_signature()
                )
            }
        };

        type_name
    }
    pub fn abi_name(&self) -> &str {
        let abi_name = match self {
            StructProperty::Simple { abi_name, .. } => abi_name,
            StructProperty::Array { abi_name, .. } => abi_name,
            StructProperty::Option { abi_name, .. } => abi_name,
            StructProperty::Tuple { abi_name, .. } => abi_name,
            StructProperty::HashMap { abi_name, .. } => abi_name,
        };
        abi_name.as_str()
    }
    pub fn abi_derive_type_name(&self) -> Result<Option<String>> {
        let mapping = match self {
            StructProperty::Simple { internal_type, .. } => {
                let mapping = helpers_mapping().lock().unwrap();
                let ty = internal_type.to_string();
                let abi_type = mapping.get(&ty);
                if let Some(abi_type) = abi_type {
                    return Ok(Some(abi_type.to_string()));
                }
                if EVER_TYPE_NAMES.contains(&ty.as_str()) {
                    Some(ty)
                } else {
                    None
                }
            }
            StructProperty::Array { .. } => Some("array".to_string()),
            StructProperty::Option { .. } => Some("optional".to_string()),
            StructProperty::Tuple { .. } => None,
            StructProperty::HashMap { .. } => None,
        };
        Ok(mapping)
    }
    pub fn rust_name(&self) -> String {
        let snaked = self
            .abi_name()
            .to_snake()
            .trim_start()
            .trim_end()
            .to_string();
        let cloned = snaked.clone();

        let stripped = snaked
            .strip_prefix("_")
            .map(|x| x.to_string())
            .unwrap_or(cloned);

        let cloned = stripped.clone();

        stripped
            .strip_suffix("_")
            .map(|x| x.to_string())
            .unwrap_or(cloned)
    }
}