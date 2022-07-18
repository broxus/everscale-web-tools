use std::convert::TryFrom;

use wasm_bindgen::prelude::*;

use crate::utils::HandleError;

#[wasm_bindgen(js_name = "checkAbi")]
pub fn check_abi(abi: &str) -> Result<(), JsValue> {
    let contract = serde_json::from_str::<ton_abi::contract::SerdeContract>(abi).handle_error()?;
    ton_abi::Contract::try_from(contract).handle_error()?;
    Ok(())
}
