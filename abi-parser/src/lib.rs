use std::str::FromStr;

use pest::iterators::Pair;
use pest::Parser;

#[derive(pest_derive::Parser)]
#[grammar = "abi.pest"]
struct Grammar;

#[derive(Debug)]
pub enum Entity {
    Empty,
    Cell(Vec<ton_abi::Param>),
    Function(ton_abi::Function),
}

impl Entity {
    pub fn parse(input: &str) -> Result<Self, ParserError> {
        let input = input.trim();
        if input.is_empty() {
            return Ok(Self::Empty);
        }

        let pairs = Grammar::parse(Rule::abi, input)
            .map_err(|e| ParserError::InvalidInput(e.to_string()))?;

        let pair = pairs.into_iter().next().ok_or(ParserError::UnexpectedEof)?;
        match pair.as_rule() {
            Rule::function => parse_function(pair).map(Self::Function),
            Rule::cell => parse_cell(pair).map(Self::Cell),
            rule => Err(ParserError::UnexpectedRule(format!("{rule:?}"))),
        }
    }
}

fn parse_function(rule: Pair<Rule>) -> Result<ton_abi::Function, ParserError> {
    let mut rules = rule.into_inner().peekable();

    let function_name = rules.next().ok_or(ParserError::UnexpectedEof)?.as_str();
    let function_id = match rules.peek() {
        Some(rule) if rule.as_rule() == Rule::function_id => {
            let rule = rule.as_str();
            let id = u32::from_str_radix(rule.strip_prefix('#').unwrap_or(rule), 16)
                .map_err(|_| ParserError::InvalidFunctionId)?;
            rules.next();
            Some(id)
        }
        Some(_) => None,
        None => return Err(ParserError::UnexpectedEof),
    };
    let inputs = parse_cell(rules.next().ok_or(ParserError::UnexpectedEof)?)?;
    let outputs = parse_cell(rules.next().ok_or(ParserError::UnexpectedEof)?)?;
    let abi_version = match rules.next() {
        Some(rule) => match rule.as_str() {
            "v1.0" | "v1" => ton_abi::contract::ABI_VERSION_1_0,
            "v2.0" => ton_abi::contract::ABI_VERSION_2_0,
            "v2.1" => ton_abi::contract::ABI_VERSION_2_1,
            "v2.2" | "v2" => ton_abi::contract::ABI_VERSION_2_2,
            "v2.3" => ton_abi::contract::ABI_VERSION_2_3,
            _ => return Err(ParserError::InvalidAbiVersion),
        },
        None => ton_abi::contract::ABI_VERSION_2_2,
    };

    let mut function = ton_abi::Function {
        abi_version,
        name: function_name.to_string(),
        header: Vec::new(),
        inputs,
        outputs,
        input_id: 0,
        output_id: 0,
    };

    if let Some(id) = function_id {
        function.input_id = id;
        function.output_id = id;
    } else {
        let id = function.get_function_id();
        function.input_id = id & 0x7FFFFFFF;
        function.output_id = id | 0x80000000;
    }

    Ok(function)
}

fn parse_cell(rule: Pair<Rule>) -> Result<Vec<ton_abi::Param>, ParserError> {
    rule.into_inner()
        .enumerate()
        .map(|(i, rule)| {
            Ok(ton_abi::Param {
                name: format!("value{i}"),
                kind: parse_ty(rule)?,
            })
        })
        .collect::<Result<Vec<_>, _>>()
}

fn parse_ty(rule: Pair<Rule>) -> Result<ton_abi::ParamType, ParserError> {
    match rule.as_rule() {
        Rule::ty_uint => parse_template(rule, Some(256), &|len| match len {
            1..=256 => Ok(ton_abi::ParamType::Uint(len)),
            _ => Err(ParserError::InvalidBitLength),
        }),
        Rule::ty_int => parse_template(rule, Some(256), &|len| match len {
            1..=256 => Ok(ton_abi::ParamType::Int(len)),
            _ => Err(ParserError::InvalidBitLength),
        }),
        Rule::ty_varuint => parse_template(rule, None, &|len| match len {
            16 | 32 => Ok(ton_abi::ParamType::VarUint(len)),
            _ => Err(ParserError::InvalidVarIntLength),
        }),
        Rule::ty_varint => parse_template(rule, None, &|len| match len {
            16 | 32 => Ok(ton_abi::ParamType::VarInt(len)),
            _ => Err(ParserError::InvalidVarIntLength),
        }),
        Rule::ty_bool => Ok(ton_abi::ParamType::Bool),
        Rule::ty_cell => Ok(ton_abi::ParamType::Cell),
        Rule::ty_address => Ok(ton_abi::ParamType::Address),
        Rule::ty_bytes => Ok(ton_abi::ParamType::Bytes),
        Rule::ty_fixedbytes => parse_template(rule, None, &|len| match len {
            1..=32 => Ok(ton_abi::ParamType::FixedBytes(len)),
            _ => Err(ParserError::InvalidFixedBytesLength),
        }),
        Rule::ty_string => Ok(ton_abi::ParamType::String),
        Rule::ty_token => Ok(ton_abi::ParamType::Token),
        Rule::ty_optional => {
            let param = rule.into_inner().next().ok_or(ParserError::UnexpectedEof)?;
            Ok(ton_abi::ParamType::Optional(Box::new(parse_ty(param)?)))
        }
        Rule::ty_ref => {
            let param = rule.into_inner().next().ok_or(ParserError::UnexpectedEof)?;
            Ok(ton_abi::ParamType::Ref(Box::new(parse_ty(param)?)))
        }
        Rule::ty_tuple => Ok(ton_abi::ParamType::Tuple(parse_cell(rule)?)),
        Rule::ty_map => {
            let mut rules = rule.into_inner();
            let key = parse_ty(rules.next().ok_or(ParserError::UnexpectedEof)?)?;
            let value = parse_ty(rules.next().ok_or(ParserError::UnexpectedEof)?)?;
            Ok(ton_abi::ParamType::Map(Box::new(key), Box::new(value)))
        }
        Rule::ty_array => {
            let param = rule.into_inner().next().ok_or(ParserError::UnexpectedEof)?;
            Ok(ton_abi::ParamType::Array(Box::new(parse_ty(param)?)))
        }
        Rule::ty_fixedarray => {
            let mut rules = rule.into_inner();
            let param = parse_ty(rules.next().ok_or(ParserError::UnexpectedEof)?)?;
            let len = usize::from_str(rules.next().ok_or(ParserError::UnexpectedEof)?.as_str())
                .map_err(|_| ParserError::InvalidFixedArrayLength)?;
            Ok(ton_abi::ParamType::FixedArray(Box::new(param), len))
        }
        rule => Err(ParserError::UnexpectedRule(format!("{rule:?}"))),
    }
}

fn parse_template(
    rule: Pair<Rule>,
    optional: Option<usize>,
    handle: &dyn Fn(usize) -> Result<ton_abi::ParamType, ParserError>,
) -> Result<ton_abi::ParamType, ParserError> {
    let length = match (rule.into_inner().next(), optional) {
        (Some(len), _) => {
            usize::from_str(len.as_str()).map_err(|_| ParserError::InvalidTypeParam)?
        }
        (None, Some(len)) => len,
        _ => return Err(ParserError::UnexpectedEof),
    };
    handle(length)
}

#[derive(thiserror::Error, Debug)]
pub enum ParserError {
    #[error("invalid input:\n{0}")]
    InvalidInput(String),
    #[error("unexpected rule: {0:?}")]
    UnexpectedRule(String),
    #[error("unexpected end of input")]
    UnexpectedEof,
    #[error("empty types list")]
    EmptyTypesList,
    #[error("invalid abi version")]
    InvalidAbiVersion,
    #[error("invalid function id")]
    InvalidFunctionId,
    #[error("invalid type param")]
    InvalidTypeParam,
    #[error("invalid bit length")]
    InvalidBitLength,
    #[error("invalid varint length")]
    InvalidVarIntLength,
    #[error("invalid fixed bytes length")]
    InvalidFixedBytesLength,
    #[error("invalid fixed array length")]
    InvalidFixedArrayLength,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn correct_parser() {
        assert!(matches!(Entity::parse("").unwrap(), Entity::Empty));

        let entity = Entity::parse("uint").unwrap();
        println!("{entity:?}");

        let entity = Entity::parse("uint256").unwrap();
        println!("{entity:?}");

        let entity = Entity::parse("(uint256, addr)").unwrap();
        println!("{entity:?}");

        let entity = Entity::parse("map(uint256, addr)").unwrap();
        println!("{entity:?}");

        let entity = Entity::parse("map(uint256, addr)[]").unwrap();
        println!("{entity:?}");
    }
}
