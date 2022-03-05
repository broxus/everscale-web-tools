## Everscale web tools

### Requirements

- Rust 1.50+ with installed target `wasm32-unknown-unknown`
- wasm-pack
- binaryen 99+ (for `wasm-opt`)
- Node.js 14+

### How to build

```bash
git clone https://github.com/broxus/everscale-web-tools.git
cd everscale-web-tools
npm install
npm run build

# Or you can run this. It runs the app in the development mode.
# Open http://localhost:55555 to view it in the browser.
npm run start
```

### Custom ABI syntax

```bnf
<abi> ::= <space>* (<abi_plain> | <abi_function>) <space>*

<abi_plain> ::= <type> (<delim> <type>)*
<abi_function> ::= 
    <function_name> <space>* 
    <function_params> <space>*  ; inputs
    <function_params> <space>*  ; outputs
    <function_abi>

<function_name> ::= <function_name_start> (<function_name_start> | [0-9])*
<function_name_start> ::= [a-z] | [A-Z] | "_"
<function_params> ::= "(" <space>* (<type> (<delim> <type>)*)? <space>* ")" 
<function_abi> ::= "v1" | "v2"

<type> ::= <type_not_array> | <type_not_array> "[]"
<type_not_array> ::= <type_simple> | <type_map> | <type_tuple>
<type_tuple> ::= "(" <space>* <type> (<delim> <type>)* <space>* ")"
<type_map> ::= "map" <space>* <type_map_params>
<type_map_params> ::= "(" <space>* <type_simple> <delim> <type> <space>* ")"
<type_simple> ::= "bool" | "address" | "bytes" | "cell" | <uint> | <int>

<uint> ::= "uint" <bits>? | "u" <bits>
<int> ::= "int" <bits>? | "i" <bits>
<bits> ::= [1-9] | [1-9] [0-9] | "1" [0-9] [0-9] | "2" [0-4] [0-9] | "25" [0-6]

<delim> ::= <space>* "," <space>*
<space> ::= " " | "\t" | "\n"
```
