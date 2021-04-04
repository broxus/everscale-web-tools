use std::iter::Peekable;
use std::str::FromStr;

use super::{lexer, Entity, Token};
use crate::utils::TrustMe;

const MAX_TUPLE_LEVEL: usize = 16;

const DEFAULT_ABI_VERSION: u8 = 2;

pub fn parse<'a, I>(input: &'a str, mut iter: Peekable<I>) -> Result<Entity, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    let mut ctx = Context {
        input,
        len_consumed: 0,
    };

    whitespace0(&mut ctx, &mut iter);

    let entity = match iter.peek().cloned() {
        Some(lexer::Token { kind, len }) => match kind {
            lexer::TokenKind::Ident => {
                let ident = ctx.text(len).to_owned();

                if parse_ident(ctx.len_consumed, &ident)?.is_some() {
                    types_list(&mut ctx, &mut iter).map(Entity::Cell)?
                } else {
                    skip_token(&mut ctx, &mut iter, len);
                    function(&mut ctx, &mut iter, ident)?
                }
            }
            lexer::TokenKind::OpenParen => types_list(&mut ctx, &mut iter).map(Entity::Cell)?,
            _ => return Err(ctx.err_unexpected_token(len)),
        },
        None => return Ok(Entity::Empty),
    };

    whitespace0(&mut ctx, &mut iter);
    eof(&mut ctx, &mut iter)?;

    Ok(entity)
}

fn function<'a, I>(
    ctx: &mut Context,
    iter: &mut Peekable<I>,
    name: String,
) -> Result<Entity, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    whitespace0(ctx, iter);
    tag(ctx, iter, lexer::TokenKind::OpenParen)?;
    let inputs = types_list(ctx, iter)?;
    tag(ctx, iter, lexer::TokenKind::CloseParen)?;
    whitespace0(ctx, iter);
    tag(ctx, iter, lexer::TokenKind::OpenParen)?;
    let outputs = types_list(ctx, iter)?;
    tag(ctx, iter, lexer::TokenKind::CloseParen)?;
    whitespace0(ctx, iter);
    let abi_version = abi_version(ctx, iter)?;

    Ok(Entity::Function {
        name,
        inputs,
        outputs,
        abi_version,
    })
}

fn types_list<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>) -> Result<Vec<Token>, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    let mut tokens: Vec<Vec<Token>> = vec![Vec::new()];

    whitespace0(ctx, iter);

    loop {
        match iter.peek().cloned() {
            Some(lexer::Token { kind, len }) => match kind {
                lexer::TokenKind::Ident => {
                    let tokens = tokens.last_mut().trust_me();
                    let ident = single_type(ctx, iter)?;
                    tokens.push(ident);

                    skip_delim_or_until_paren(ctx, iter)?;
                }
                lexer::TokenKind::OpenParen => {
                    match tokens.len() {
                        0..=MAX_TUPLE_LEVEL => tokens.push(Vec::new()),
                        depth => {
                            return Err(ParserError::TooDeepNesting {
                                depth,
                                position: ctx.len_consumed,
                            });
                        }
                    }

                    skip_token(ctx, iter, len);
                    whitespace0(ctx, iter);
                }
                lexer::TokenKind::CloseParen => {
                    if tokens.len() <= 1 {
                        break;
                    }

                    match tokens.pop() {
                        Some(tuple) if !tuple.is_empty() => match tokens.last_mut() {
                            Some(tokens) => tokens.push(Token::Tuple(tuple)),
                            None => tokens.push(vec![Token::Tuple(tuple)]),
                        },
                        Some(_) => return Err(ctx.err_unexpected_token(len)),
                        _ => unreachable!(),
                    }

                    skip_token(ctx, iter, len);
                    skip_delim_or_until_paren(ctx, iter)?;
                }
                lexer::TokenKind::Whitespace => {
                    whitespace0(ctx, iter);
                }
                _ => return Err(ctx.err_unexpected_token(len)),
            },
            None => break,
        }
    }

    match tokens.pop() {
        None => Ok(Vec::new()),
        Some(parsed) if tokens.is_empty() => Ok(parsed),
        _ => Err(ctx.err_eof()),
    }
}

fn single_type<'a, I>(ctx: &'a mut Context, iter: &mut Peekable<I>) -> Result<Token, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    match iter.peek().cloned() {
        Some(lexer::Token {
            kind: lexer::TokenKind::Ident,
            len,
        }) => {
            let token = match parse_ident(ctx.len_consumed, &ctx.text(len))? {
                Some(ident) => ident.into(),
                None => return Err(ctx.err_unexpected_token(len)),
            };

            skip_token(ctx, iter, len);
            Ok(if optional_brackets(ctx, iter)? {
                Token::Array(Box::new(token))
            } else {
                token
            })
        }
        Some(lexer::Token { len, .. }) => Err(ctx.err_unexpected_token(len)),
        None => Err(ctx.err_eof()),
    }
}

fn parse_ident(position: usize, ident: &str) -> Result<Option<Ident>, ParserError> {
    Ok(Some(match ident {
        "bool" => Ident::Bool,
        "bytes" => Ident::Bytes,
        "addr" | "address" => Ident::Address,
        "cell" => Ident::Cell,
        "gram" => Ident::Gram,
        _ => return parse_ident_integer(position, ident),
    }))
}

fn parse_ident_integer(position: usize, ident: &str) -> Result<Option<Ident>, ParserError> {
    if ident.len() < 2 {
        return Ok(None);
    }

    let (signed, num) = match ident.split_at(1) {
        ("i", num) => (true, num.trim_start_matches("nt")),
        ("u", num) => (false, num.trim_start_matches("int")),
        _ => return Ok(None),
    };

    let size = if num.is_empty() {
        256
    } else {
        match u16::from_str(num) {
            Ok(size @ 1..=256) => size,
            Ok(size) => return Err(ParserError::InvalidInteger { size, position }),
            _ => return Ok(None),
        }
    };

    Ok(Some(match signed {
        true => Ident::Int(size),
        false => Ident::Uint(size),
    }))
}

fn abi_version<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>) -> Result<u8, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    match iter.peek().cloned() {
        Some(lexer::Token {
            kind: lexer::TokenKind::Ident,
            len,
        }) => {
            if let Some(version) = parse_abi_version(ctx.len_consumed, ctx.text(len))? {
                skip_token(ctx, iter, len);
                Ok(version)
            } else {
                Err(ctx.err_unexpected_token(len))
            }
        }
        _ => Ok(DEFAULT_ABI_VERSION),
    }
}

fn parse_abi_version(position: usize, ident: &str) -> Result<Option<u8>, ParserError> {
    if ident.len() < 2 {
        return Ok(None);
    }

    let num = match ident.split_at(1) {
        ("v", num) => num,
        _ => return Ok(None),
    };

    match u8::from_str(num) {
        Ok(version @ 1..=2) => Ok(Some(version)),
        Ok(version) => return Err(ParserError::InvalidAbiVersion { version, position }),
        _ => return Ok(None),
    }
}

fn optional_brackets<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>) -> Result<bool, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    whitespace0(ctx, iter);
    if let Some(lexer::Token {
        kind: lexer::TokenKind::OpenBracket,
        len,
    }) = iter.peek().cloned()
    {
        skip_token(ctx, iter, len);
        whitespace0(ctx, iter);
        tag(ctx, iter, lexer::TokenKind::CloseBracket)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn skip_delim_or_until_paren<'a, I>(
    ctx: &mut Context,
    iter: &mut Peekable<I>,
) -> Result<(), ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    whitespace0(ctx, iter);

    if let Some(lexer::Token { kind, len }) = iter.peek().cloned() {
        match kind {
            lexer::TokenKind::Comma => skip_token(ctx, iter, len),
            lexer::TokenKind::CloseParen => return Ok(()),
            _ => return Err(ctx.err_unexpected_token(len)),
        }
    }

    whitespace0(ctx, iter);
    Ok(())
}

fn tag<'a, I>(
    ctx: &mut Context,
    iter: &mut Peekable<I>,
    kind: lexer::TokenKind,
) -> Result<(), ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    match iter.peek().cloned() {
        Some(token) if token.kind == kind => {
            skip_token(ctx, iter, token.len);
            Ok(())
        }
        Some(lexer::Token { len, .. }) => Err(ctx.err_unexpected_token(len)),
        None => Err(ctx.err_eof()),
    }
}

fn whitespace0<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>)
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    while let Some(lexer::Token {
        kind: lexer::TokenKind::Whitespace,
        len,
    }) = iter.peek().cloned()
    {
        skip_token(ctx, iter, len);
    }
}

fn eof<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>) -> Result<(), ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    if let Some(lexer::Token { len, .. }) = iter.peek() {
        Err(ctx.err_unexpected_token(*len))
    } else {
        Ok(())
    }
}

enum Ident {
    Bool,
    Int(u16),
    Uint(u16),
    Address,
    Bytes,
    Cell,
    Gram,
}

impl From<Ident> for Token {
    fn from(ident: Ident) -> Self {
        match ident {
            Ident::Bool => Token::Bool,
            Ident::Int(size) => Token::Int(size),
            Ident::Uint(size) => Token::Uint(size),
            Ident::Address => Token::Address,
            Ident::Bytes => Token::Bytes,
            Ident::Cell => Token::Cell,
            Ident::Gram => Token::Gram,
        }
    }
}

fn skip_token<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>, len: usize)
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    ctx.len_consumed += len;
    let _ = iter.next();
}

struct Context<'a> {
    input: &'a str,
    len_consumed: usize,
}

impl<'a> Context<'a> {
    fn text(&self, len: usize) -> &str {
        &self.input[self.len_consumed..self.len_consumed + len]
    }

    fn err_unexpected_token(&self, len: usize) -> ParserError {
        ParserError::UnexpectedToken {
            token: self.text(len).to_owned(),
            position: self.len_consumed,
        }
    }

    fn err_eof(&self) -> ParserError {
        ParserError::UnexpectedEof {
            position: self.len_consumed,
        }
    }
}

#[derive(thiserror::Error, Debug)]
pub enum ParserError {
    #[error("Unexpected token `{}` at {}", .token, .position)]
    UnexpectedToken { token: String, position: usize },
    #[error("Unexpected end of input at {}", .position)]
    UnexpectedEof { position: usize },
    #[error("Invalid integer size `{}` at {}", .size, .position)]
    InvalidInteger { size: u16, position: usize },
    #[error("Too deep nesting `{}` at {}", .depth, .position)]
    TooDeepNesting { depth: usize, position: usize },
    #[error("Invalid ABI version `{}` at {}", .version, .position)]
    InvalidAbiVersion { version: u8, position: usize },
}
