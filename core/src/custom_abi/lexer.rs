use std::iter::Peekable;
use std::str::Chars;

use crate::utils::*;

pub fn tokenize(mut input: &str) -> Peekable<impl Iterator<Item = Token> + '_> {
    std::iter::from_fn(move || {
        if input.is_empty() {
            return None;
        }
        let token = first_token(input);
        input = &input[token.len..];
        Some(token)
    })
    .peekable()
}

fn first_token(input: &str) -> Token {
    Cursor::new(input).advance_token()
}

#[derive(Copy, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub len: usize,
}

#[derive(Copy, Clone, PartialEq)]
pub enum TokenKind {
    Whitespace,
    Ident,
    Comma,      // `,`
    OpenParen,  // `(`
    CloseParen, // `)`
    Unknown,
}

fn is_whitespace(c: char) -> bool {
    match c {
        ' ' // simple space 
        | '\t' // tab
        | '\n' // new line
        | '\r' // caret return
        | '\u{000B}' // vertical tab
        | '\u{000C}' // form feed
        | '\u{0085}' // new line from latin1
        | '\u{200E}' // left-to-right mark
        | '\u{200F}' // right-to-left mark
        | '\u{2028}' // line separator
        | '\u{2029}' => true, // paragraph separator
        _ => false
    }
}

pub fn is_ident_start(c: char) -> bool {
    ('a'..='z').contains(&c) || ('A'..='Z').contains(&c) || c == '_'
}

pub fn is_ident_continue(c: char) -> bool {
    ('a'..='z').contains(&c) || ('A'..='Z').contains(&c) || ('0'..='9').contains(&c) || c == '_'
}

struct Cursor<'a> {
    initial_len: usize,
    chars: Chars<'a>,
}

impl<'a> Cursor<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            initial_len: input.len(),
            chars: input.chars(),
        }
    }

    fn advance_token(&mut self) -> Token {
        let first_char = self.bump().trust_me();
        let kind = match first_char {
            c if is_whitespace(c) => self.whitespace(),
            c if is_ident_start(c) => self.ident(),
            ',' => TokenKind::Comma,
            '(' => TokenKind::OpenParen,
            ')' => TokenKind::CloseParen,
            _ => TokenKind::Unknown,
        };

        Token {
            kind,
            len: self.len_consumed(),
        }
    }

    fn whitespace(&mut self) -> TokenKind {
        self.eat_while(is_whitespace);
        TokenKind::Whitespace
    }

    fn ident(&mut self) -> TokenKind {
        self.eat_while(is_ident_continue);
        TokenKind::Ident
    }

    fn eat_while(&mut self, mut p: impl FnMut(char) -> bool) {
        while p(self.first()) && !self.is_eof() {
            self.bump();
        }
    }

    pub fn first(&self) -> char {
        self.nth_char(0)
    }

    pub fn nth_char(&self, n: usize) -> char {
        self.chars().nth(n).unwrap_or(EOF_CHAR)
    }

    pub fn is_eof(&self) -> bool {
        self.chars.as_str().is_empty()
    }

    pub fn len_consumed(&self) -> usize {
        self.initial_len - self.chars.as_str().len()
    }

    pub fn bump(&mut self) -> Option<char> {
        self.chars.next()
    }

    fn chars(&self) -> Chars<'a> {
        self.chars.clone()
    }
}

const EOF_CHAR: char = '\0';
