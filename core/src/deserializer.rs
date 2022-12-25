use anyhow::{anyhow, Result};
use serde_json::{Map, Value};
use ton_block::*;
use ton_block_json::*;
use ton_types::{deserialize_tree_of_cells, serialize_toc, SliceData};
use wasm_bindgen::prelude::*;

use shared::*;

const BLOCK_TAG: u32 = 0x11ef55aa;
const TRANSACTION_TAG: usize = 0x7;

// const BLOCK_INFO_TAG: u32 = 0x9bc7a987;
// const BLOCK_EXTRA_TAG: u32 = 0x4a33f6fd;
// const VALUE_FLOW_TAG: u32 = 0xb8e48dfb;
// const VALUE_FLOW_TAG_V2: u32 = 0xe0864f6d;
// const TOPBLOCK_DESCR_SET_TAG: u32 = 0x4ac789f3;

#[wasm_bindgen]
pub fn deserialize(boc: &str, structure_type: Option<String>) -> Result<Option<String>, JsValue> {
    let boc = base64::decode(boc).handle_error()?;
    let structure_type = match structure_type {
        Some(structure_type) => structure_type,
        None => try_detect_type(boc.clone()).handle_error()?.to_string(),
    };
    match_deserializer(&boc, structure_type.as_str()).handle_error()
}

fn try_detect_type(boc: Vec<u8>) -> Result<&'static str> {
    let cell = deserialize_tree_of_cells(&mut &*boc)?;
    let mut slice: SliceData = cell.into();
    match slice.clone().get_next_u32()? {
        BLOCK_TAG => return Ok("Block"),
        _ => "",
    };
    match slice.get_next_int(4)? as usize {
        TRANSACTION_TAG => return Ok("Transaction"),
        _ => "",
    };
    Err(anyhow!("Cannot detect structure type by tag"))
}

fn match_deserializer(boc: &[u8], structure_type: &str) -> Result<Option<String>> {
    let result = match structure_type {
        "Block" => Some(serialize_block_full(Block::construct_from_bytes(boc)?)?.to_string()),
        "Message" => Some(serialize_message(Message::construct_from_bytes(boc)?)?.to_string()),
        "Transaction" => Some(serialize_transaction(Transaction::construct_from_bytes(boc)?)?.to_string()),
        "Account" => Some(serialize_account(Account::construct_from_bytes(boc)?)?.to_string()),
        // "AccountStuff" => Some(serialize_account_stuff(AccountStuff::construct_from_bytes(&boc)?)?.to_string()),
        _ => { None }
    };
    Ok(result)
}

pub fn serialize_block_full(block: Block) -> Result<Value> {
    let root_cell = block.serialize()?;
    let set = BlockSerializationSet {
        block: block.clone(),
        id: root_cell.repr_hash(),
        status: BlockProcessingStatus::Finalized,
        boc: Vec::new(),
    };

    let extra = block.read_extra()?;
    let in_msgs_descr = extra.read_in_msg_descr()?;
    let mut in_msgs = Map::new();
    in_msgs_descr.iterate_objects(|in_msg| {
        let message = in_msg.read_message()?;
        in_msgs.insert(root_cell.repr_hash().to_hex_string(), serialize_message(message)?);
        Ok(true)
    })?;
    let out_msgs_descr = extra.read_out_msg_descr()?;
    let mut out_msgs = Map::new();
    out_msgs_descr.iterate_objects(|out_msg| {
        if let Some(message) = out_msg.read_message()? {
            out_msgs.insert(root_cell.repr_hash().to_hex_string(), serialize_message(message)?);
        }
        Ok(true)
    })?;
    let acc_blocks = extra.read_account_blocks()?;
    let mut transactions = Map::new();
    acc_blocks.iterate_objects(|block| {
        block.transactions().iterate_objects(|InRefValue(tr)| {
            transactions.insert(root_cell.repr_hash().to_hex_string(), serialize_transaction(tr)?);
            Ok(true)
        })
    })?;
    Ok(serde_json::json!({
        "block": db_serialize_block_ex("id", &set, SerializationMode::QServer)?,
        "in_msgs": in_msgs,
        "out_msgs": out_msgs,
        "transactions": transactions,
    }))
}

pub fn serialize_message(message: Message) -> Result<Value> {
    let root_cell = message.serialize()?;
    let set = MessageSerializationSet {
        message,
        id: root_cell.repr_hash(),
        block_id: None,
        transaction_id: None,
        transaction_now: None,
        status: MessageProcessingStatus::Finalized,
        boc: serialize_toc(&root_cell)?,
        proof: None,
    };
    let map = db_serialize_message_ex("id", &set, SerializationMode::QServer)?;
    Ok(map.into())
}

pub fn serialize_transaction(tr: Transaction) -> Result<Value> {
    let root_cell = tr.serialize()?;
    let set = TransactionSerializationSetEx {
        transaction: &tr,
        id: &root_cell.repr_hash(),
        status: TransactionProcessingStatus::Finalized,
        block_id: None,
        workchain_id: None,
        boc: &serialize_toc(&root_cell)?,
        proof: None,
    };
    let map = db_serialize_transaction_ex("id", set, SerializationMode::QServer)?;
    Ok(map.into())
}

pub fn serialize_account(account: Account) -> Result<Value> {
    let set = AccountSerializationSet {
        account: account.clone(),
        prev_account_state: None,
        boc: Vec::new(),
        proof: None,
    };
    let mut map = db_serialize_account_ex("id", &set, SerializationMode::QServer)?;
    if let Some(stuff) = account.stuff() {
        map.insert("stuff_full".to_string(), serialize_account_stuff(stuff)?);
    }
    Ok(map.into())
}

pub fn serialize_account_stuff(account_stuff: &AccountStuff) -> Result<Value> {
    let mut map = Map::new();
    map.insert("addr".to_string(), account_stuff.addr.to_string().into());
    map.insert(
        "storage_stat".to_string(),
        serialize_account_storage_info(account_stuff.storage_stat())?,
    );
    map.insert(
        "storage".to_string(),
        serialize_account_storage(account_stuff.storage())?,
    );
    Ok(map.into())
}

fn serialize_account_storage(storage: &AccountStorage) -> Result<Value> {
    let mut map = Map::new();
    map.insert("balance".to_string(), serialize_cc(storage.balance())?);
    map.insert("last_trans_lt".to_string(), storage.last_trans_lt().into());
    let state = match storage.state() {
        AccountState::AccountUninit => {
            serde_json::json!({"type": "AccountUninit"})
        }
        AccountState::AccountActive { state_init, .. } => {
            let special = state_init.special().map(|special| serde_json::json!({
                         "tick": special.tick,
                         "tock": special.tock,
                     }));
            serde_json::json!({
                "type": "AccountActive",
                "state_init": {
                    "split_depth": state_init.split_depth.clone().unwrap_or_default().0,
                    "special": special,
                    "code": base64::encode(&serialize_toc(&state_init.code.clone().unwrap_or_default())?),
                    "data": base64::encode(&serialize_toc(&state_init.data.clone().unwrap_or_default())?),
                    "library": base64::encode(&serialize_toc(&state_init.library.serialize()?)?),
                }
            })
        }
        AccountState::AccountFrozen { state_init_hash, .. } => {
            serde_json::json!({
                "type": "AccountFrozen",
                "state_init_hash": state_init_hash.to_hex_string(),
            })
        }
    };
    map.insert("state".to_string(), state);
    map.insert(
        "init_code_hash".to_string(),
        storage.init_code_hash.unwrap_or_default().to_hex_string().into(),
    );
    Ok(map.into())
}

fn serialize_account_storage_info(storage_info: &StorageInfo) -> Result<Value> {
    Ok(serde_json::json!({
        "used": serde_json::json!({
            "cells": storage_info.used.cells(),
            "bits": storage_info.used.bits(),
            "public_cells": storage_info.used.public_cells(),
        }),
        "last_paid": storage_info.last_paid,
        "due_payment": storage_info.due_payment().unwrap_or(&Grams::zero()).to_string(),
    }))
}

fn serialize_cc(cc: &CurrencyCollection) -> Result<Value> {
    let mut map = Map::new();
    map.insert("grams".to_string(), cc.grams.to_string().into());
    let other = serialize_ecc(&cc.other)?;
    if !other.is_empty() {
        map.insert("other".to_string(), other.into());
    }
    Ok(map.into())
}

fn serialize_ecc(ecc: &ExtraCurrencyCollection) -> Result<Vec<Map<String, Value>>> {
    let mut other = Vec::new();
    ecc.iterate_with_keys(|key: u32, ref mut value| -> Result<bool> {
        let mut other_map = Map::new();
        other_map.insert("key".to_string(), key.into());
        other_map.insert("velue".to_string(), value.to_string().into());
        other.push(other_map);
        Ok(true)
    })?;
    Ok(other)
}