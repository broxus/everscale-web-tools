use shared::{HandleError, ObjectBuilder};
use ton_block::{Deserializable, MaybeDeserialize, Serializable};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

#[wasm_bindgen(typescript_custom_section)]
const FROZEN_STATE: &str = r#"
export type FrozenState = {
    stateHash: string;
    duePayment: string | undefined;
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "FrozenState")]
    pub type FrozenState;
}

#[wasm_bindgen(js_name = "parseFrozenState")]
pub fn parse_frozen_state(account_boc: &str) -> Result<Option<FrozenState>, JsValue> {
    let account_stuff = parse_account_stuff(account_boc)?;
    match account_stuff.storage.state {
        ton_block::AccountState::AccountFrozen { state_init_hash } => {
            let due_payment = account_stuff
                .storage_stat
                .due_payment
                .as_ref()
                .map(ToString::to_string);

            let frozen_state = ObjectBuilder::new()
                .set("stateHash", state_init_hash.to_hex_string())
                .set("duePayment", due_payment)
                .build();
            Ok(Some(frozen_state.unchecked_into()))
        }
        _ => Ok(None),
    }
}

#[wasm_bindgen(js_name = "parseStateInit")]
pub fn parse_state_init(account_boc: &str) -> Result<Option<String>, JsValue> {
    let account = ton_block::Account::construct_from_base64(account_boc.trim()).handle_error()?;
    let state_init = match account {
        ton_block::Account::Account(account) => {
            //account.storage_stat.

            match account.storage.state {
                ton_block::AccountState::AccountActive { state_init } => Some(state_init),
                _ => None,
            }
        }
        _ => None,
    };
    match state_init {
        Some(state_init) => ton_types::serialize_toc(&state_init.serialize().handle_error()?)
            .map(base64::encode)
            .map(Some)
            .handle_error(),
        None => Ok(None),
    }
}

pub fn parse_account_stuff(boc: &str) -> Result<ton_block::AccountStuff, JsValue> {
    let bytes = base64::decode(boc.trim()).handle_error()?;
    ton_types::deserialize_tree_of_cells(&mut bytes.as_slice())
        .and_then(|cell| {
            let slice = &mut cell.into();
            Ok(ton_block::AccountStuff {
                addr: Deserializable::construct_from(slice)?,
                storage_stat: Deserializable::construct_from(slice)?,
                storage: ton_block::AccountStorage {
                    last_trans_lt: Deserializable::construct_from(slice)?,
                    balance: Deserializable::construct_from(slice)?,
                    state: Deserializable::construct_from(slice)?,
                    init_code_hash: if slice.remaining_bits() > 0 {
                        ton_types::UInt256::read_maybe_from(slice)?
                    } else {
                        None
                    },
                },
            })
        })
        .handle_error()
}
