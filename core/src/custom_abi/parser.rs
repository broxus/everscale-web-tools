use std::iter::Peekable;
use std::str::FromStr;

use super::{lexer, Token};
use crate::utils::TrustMe;

const MAX_TUPLE_LEVEL: usize = 16;

pub fn parse<'a, I>(input: &'a str, mut iter: Peekable<I>) -> Result<Vec<Token>, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    let mut ctx = Context {
        input,
        len_consumed: 0,
    };

    whitespace0(&mut ctx, &mut iter);

    tokens_list(&mut ctx, &mut iter)
}

fn tokens_list<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>) -> Result<Vec<Token>, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    let mut tokens: Vec<Vec<Token>> = vec![Vec::new()];

    loop {
        match iter.peek().cloned() {
            Some(lexer::Token { kind, len }) => match kind {
                lexer::TokenKind::Ident => {
                    let tokens = tokens.last_mut().trust_me();
                    let ident = ident(ctx, iter)?;
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
                            })
                        }
                    }
                    ctx.len_consumed += len;
                    let _ = iter.next();

                    whitespace0(ctx, iter);
                }
                lexer::TokenKind::CloseParen => {
                    match tokens.pop() {
                        Some(tuple) if !tokens.is_empty() && !tuple.is_empty() => {
                            match tokens.last_mut() {
                                Some(tokens) => tokens.push(Token::Tuple(tuple)),
                                None => tokens.push(vec![Token::Tuple(tuple)]),
                            }
                        }
                        _ => {
                            return {
                                crate::log("Close paren");
                                Err(ctx.err_unexpected_token(len))
                            }
                        }
                    }
                    ctx.len_consumed += len;
                    let _ = iter.next();

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

fn ident<'a, I>(ctx: &'a mut Context, iter: &mut Peekable<I>) -> Result<Token, ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    match iter.next() {
        Some(lexer::Token {
            kind: lexer::TokenKind::Ident,
            len,
        }) => {
            let token = match parse_ident(ctx.len_consumed, &ctx.text(len))? {
                Some(ident) => ident.into(),
                None => return Err(ctx.err_unexpected_token(len)),
            };

            ctx.len_consumed += len;
            Ok(token)
        }
        Some(lexer::Token { len, .. }) => Err(ctx.err_unexpected_token(len)),
        None => Err(ctx.err_eof()),
    }
}

enum FirstIdent<'a> {
    Ident(Ident),
    FunctionName(&'a str),
}

fn parse_ident(position: usize, ident: &str) -> Result<Option<Ident>, ParserError> {
    Ok(Some(match ident {
        "bool" => Ident::Bool,
        "bytes" => Ident::Bytes,
        "address" => Ident::Address,
        "cell" => Ident::Cell,
        _ => return parse_ident_integer(position, ident),
    }))
}

fn parse_ident_integer(position: usize, ident: &str) -> Result<Option<Ident>, ParserError> {
    if ident.len() < 2 {
        return Ok(None);
    }

    let (signed, num) = match ident.split_at(1) {
        ("i", num) => (true, num.trim_start_matches("nt")),
        ("u", num) => (true, num.trim_start_matches("int")),
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

fn skip_delim_or_until_paren<'a, I>(
    ctx: &mut Context,
    iter: &mut Peekable<I>,
) -> Result<(), ParserError>
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    whitespace0(ctx, iter);

    if let Some(lexer::Token { kind, len }) = iter.peek() {
        match kind {
            lexer::TokenKind::Comma => {
                ctx.len_consumed += len;
                let _ = iter.next();
            }
            lexer::TokenKind::CloseParen => return Ok(()),
            _ => return Err(ctx.err_unexpected_token(*len)),
        }
    }

    whitespace0(ctx, iter);
    Ok(())
}

fn whitespace0<'a, I>(ctx: &mut Context, iter: &mut Peekable<I>)
where
    I: Iterator<Item = lexer::Token> + 'a,
{
    while let Some(lexer::Token {
        kind: lexer::TokenKind::Whitespace,
        len,
    }) = iter.peek()
    {
        ctx.len_consumed += len;
        let _ = iter.next();
    }
}

enum Ident {
    Bool,
    Int(u16),
    Uint(u16),
    Address,
    Bytes,
    Cell,
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
        }
    }
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
}
