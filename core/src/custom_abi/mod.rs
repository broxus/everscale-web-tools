mod lexer;
mod parser;

use anyhow::Result;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Bool,
    Int(u16),
    Uint(u16),
    Address,
    Bytes,
    Cell,
    Gram,
    Array(Box<Token>),
    Map(Box<Token>, Box<Token>),
    Tuple(Vec<Token>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum Entity {
    Empty,
    Plain(Vec<Token>),
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
