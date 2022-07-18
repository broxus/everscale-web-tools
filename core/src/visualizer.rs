use std::fmt::Write;

use anyhow::Result;
use wasm_bindgen::prelude::*;

use shared::*;

#[wasm_bindgen]
pub fn visualize(boc: &str) -> Result<String, JsValue> {
    let boc = base64::decode(boc).handle_error()?;
    let cells = ton_types::deserialize_cells_tree(&mut boc.as_slice()).handle_error()?;

    let mut result = String::new();
    for cell in cells {
        let _ = writeln!(&mut result, "{:#.1024}", cell);
    }

    Ok(result)
}
