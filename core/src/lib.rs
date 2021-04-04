mod custom_abi;
mod utils;

use wasm_bindgen::prelude::*;

use crate::utils::*;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    Ok(())
}

#[wasm_bindgen]
pub fn decode(boc: &str) -> Result<String, JsValue> {
    let boc = base64::decode(boc).handle_error()?;
    let cells = ton_types::deserialize_cells_tree(&mut std::io::Cursor::new(boc)).handle_error()?;

    let mut result = String::new();
    for cell in cells {
        result += &format!("{:#.1024}\n", cell);
    }

    Ok(result)
}

#[wasm_bindgen(js_name = "customAbiPrepare")]
pub fn custom_abi_prepare(input: &str) -> Result<(), JsValue> {
    let result = custom_abi::parse(input).handle_error()?;
    log(&format!("{:?}", result));
    Ok(())
}
