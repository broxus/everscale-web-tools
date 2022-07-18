use std::pin::Pin;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use shared::*;
use ton_block::{Deserializable, Serializable};
use ton_executor::TransactionExecutor;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "execute")]
pub fn execute(account: &str, tx: &str, config: &str) -> Result<JsValue, JsValue> {
    let mut root_cell = parse_cell(account)?;
    let account = ton_block::Account::construct_from_cell(root_cell.clone()).handle_error()?;
    let tx = ton_block::Transaction::construct_from_base64(tx).handle_error()?;
    let in_msg = tx.read_in_msg().handle_error()?;

    let config = ton_block::ConfigParams::construct_from_base64(config).handle_error()?;
    let executor = ton_executor::OrdinaryTransactionExecutor::new(
        ton_executor::BlockchainConfig::with_config(config).handle_error()?,
    );

    let last_trans_lt = match account.stuff() {
        Some(state) => state.storage.last_trans_lt,
        None => 0,
    };

    let mut actions = Box::pin(Vec::<StackItem>::new());

    let params = ton_executor::ExecuteParams {
        block_unixtime: tx.now,
        block_lt: tx.lt,
        last_tr_lt: Arc::new(AtomicU64::new(last_trans_lt)),
        trace_callback: {
            struct Crime(*mut Vec<StackItem>);

            impl Crime {
                fn push(&self, info: &ton_vm::executor::EngineTraceInfo) {
                    let actions = unsafe { &mut *self.0 };

                    actions.push(StackItem {
                        step: info.step,
                        gas_used: info.gas_used,
                        gas_cmd: info.gas_cmd,
                        cmd: info.cmd_str.clone(),
                        stack: info.stack.storage.clone(),
                    })
                }
            }

            unsafe impl Send for Crime {}
            unsafe impl Sync for Crime {}

            let actions = Crime(&mut *actions as _);
            Some(Arc::new(move |_, info| {
                actions.push(info);
            }))
        },
        ..Default::default()
    };

    let transaction = executor
        .execute_with_libs_and_params(in_msg.as_ref(), &mut root_cell, params)
        .handle_error()?;

    let steps = js_sys::Array::new();
    let gas_used = js_sys::Array::new();
    let gas_cmds = js_sys::Array::new();
    let cmds = js_sys::Array::new();
    let stacks = js_sys::Array::new();

    Pin::into_inner(actions).into_iter().for_each(|action| {
        steps.push(&JsValue::from(action.step));
        gas_used.push(&JsValue::from(action.gas_used.to_string()));
        gas_cmds.push(&JsValue::from(action.gas_cmd.to_string()));
        cmds.push(&JsValue::from(action.cmd));
        stacks.push(&JsValue::from(
            action
                .stack
                .into_iter()
                .map(|item| JsValue::from(item.to_string()))
                .collect::<js_sys::Array>(),
        ));
    });

    Ok(ObjectBuilder::new()
        .set("transaction", make_transaction(transaction)?)
        .set("steps", steps)
        .set("gasUsed", gas_used)
        .set("gasCmds", gas_cmds)
        .set("cmds", cmds)
        .set("stacks", stacks)
        .build())
}

pub fn make_transaction(data: ton_block::Transaction) -> Result<JsValue, JsValue> {
    fn make_account_status(status: ton_block::AccountStatus) -> JsValue {
        JsValue::from_str(match status {
            ton_block::AccountStatus::AccStateUninit => "uninit",
            ton_block::AccountStatus::AccStateFrozen => "frozen",
            ton_block::AccountStatus::AccStateActive => "active",
            ton_block::AccountStatus::AccStateNonexist => "nonexist",
        })
    }

    pub fn make_message(hash: ton_types::UInt256, data: ton_block::Message) -> JsValue {
        let (body, body_hash) = if let Some(body) = data.body() {
            let body_hash = body.hash(ton_types::MAX_LEVEL);
            let data = ton_types::serialize_toc(&body.into_cell()).expect("Shouldn't fail");
            (Some(base64::encode(data)), Some(body_hash.to_hex_string()))
        } else {
            (None, None)
        };

        let bounce = match data.int_header() {
            Some(header) => header.bounce,
            None => false,
        };

        let value = match data.value() {
            Some(value) => JsValue::from(value.grams.0.to_string()),
            None => JsValue::from_str("0"),
        };

        ObjectBuilder::new()
            .set("hash", hash.to_hex_string())
            .set("src", data.src_ref().map(ToString::to_string))
            .set("dst", data.dst_ref().map(ToString::to_string))
            .set("value", value)
            .set("bounce", bounce)
            .set("bounced", data.bounced())
            .set("body", body)
            .set("bodyHash", body_hash)
            .build()
    }

    let hash = data.serialize().handle_error()?.repr_hash();

    let info = data.read_description().handle_error()?;

    let mut total_fees = data.total_fees.grams.0;
    let (exit_code, result_code) = match &info {
        ton_block::TransactionDescr::Ordinary(info) => {
            let exit_code = match &info.compute_ph {
                ton_block::TrComputePhase::Vm(phase) => Some(phase.exit_code),
                ton_block::TrComputePhase::Skipped(_) => None,
            };
            let result_code = match &info.action {
                Some(phase) => {
                    total_fees += phase
                        .total_fwd_fees
                        .as_ref()
                        .map(|grams| grams.0)
                        .unwrap_or_default();
                    total_fees -= phase
                        .total_action_fees
                        .as_ref()
                        .map(|grams| grams.0)
                        .unwrap_or_default();

                    Some(phase.result_code)
                }
                None => None,
            };

            (exit_code, result_code)
        }
        _ => (None, None),
    };

    let in_msg = match &data.in_msg {
        Some(message) => {
            let hash = message.hash();
            let message = message.read_struct().handle_error()?;
            Some(make_message(hash, message))
        }
        None => None,
    };

    let mut out_msgs = Vec::new();
    data.out_msgs
        .iterate_slices(|slice| {
            if let Ok(message) = slice.reference(0).and_then(|cell| {
                let hash = cell.repr_hash();
                Ok(make_message(
                    hash,
                    ton_block::Message::construct_from_cell(cell)?,
                ))
            }) {
                out_msgs.push(message);
            }
            Ok(true)
        })
        .handle_error()?;

    Ok(ObjectBuilder::new()
        .set(
            "id",
            ObjectBuilder::new()
                .set("lt", data.lt.to_string())
                .set("hash", hash.to_hex_string())
                .build(),
        )
        .set(
            "prevTransactionId",
            if data.prev_trans_lt > 0 {
                Some(
                    ObjectBuilder::new()
                        .set("lt", data.prev_trans_lt)
                        .set("hash", data.prev_trans_hash.to_hex_string())
                        .build(),
                )
            } else {
                None
            },
        )
        .set("createdAt", data.now)
        .set("aborted", info.is_aborted())
        .set("exitCode", exit_code)
        .set("resultCode", result_code)
        .set("origStatus", make_account_status(data.orig_status))
        .set("endStatus", make_account_status(data.end_status))
        .set("totalFees", total_fees.to_string())
        .set("inMessage", in_msg)
        .set(
            "outMessages",
            out_msgs.into_iter().collect::<js_sys::Array>(),
        )
        .build())
}

struct StackItem {
    step: u32,
    gas_used: i64,
    gas_cmd: i64,
    cmd: String,
    stack: Vec<ton_vm::stack::StackItem>,
}

fn parse_cell(boc: &str) -> Result<ton_types::Cell, JsValue> {
    let boc = boc.trim();
    if boc.is_empty() {
        Ok(ton_types::Cell::default())
    } else {
        let body = base64::decode(boc).handle_error()?;
        ton_types::deserialize_tree_of_cells(&mut body.as_slice()).handle_error()
    }
}
