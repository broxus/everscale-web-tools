mod lexer;
mod parser;

use anyhow::Result;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Bool,
    Int(u16),
    Uint(u16),
    VarInt(u16),
    VarUint(u16),
    Address,
    Bytes,
    String,
    Cell,
    Token,
    Array(Box<Token>),
    Map(Box<Token>, Box<Token>),
    Tuple(Vec<Token>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum Entity {
    Empty,
    Cell(Vec<Token>),
    Function {
        name: String,
        inputs: Vec<Token>,
        outputs: Vec<Token>,
        abi_version: u8,
    },
}

pub fn parse(input: &str) -> Result<Entity> {
    let tokens = parser::parse(input, lexer::tokenize(input))?;
    Ok(tokens)
}

pub fn get_function_signature(
    name: &str,
    inputs: &[ton_abi::Param],
    outputs: &[ton_abi::Param],
    abi_version: u8,
) -> String {
    let input_types = inputs
        .iter()
        .map(|param| param.kind.type_signature())
        .collect::<Vec<_>>()
        .join(",");

    let output_types = outputs
        .iter()
        .map(|param| param.kind.type_signature())
        .collect::<Vec<_>>()
        .join(",");

    format!(
        "{}({})({})v{}",
        name, input_types, output_types, abi_version
    )
}

pub fn calc_function_id(signature: &str) -> u32 {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(&signature.as_bytes());
    let signature_hash = hasher.finalize();

    let mut bytes: [u8; 4] = [0; 4];
    bytes.copy_from_slice(&signature_hash[..4]);
    u32::from_be_bytes(bytes)
}
