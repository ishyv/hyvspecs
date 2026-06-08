//! local config: the ingest endpoint and the edit tokens minted when cards are created.
//! tokens are the only way to later rename/delete/claim a card, so they are persisted
//! per card in the user's config dir.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

const DEFAULT_ENDPOINT: &str = "https://specs.hyvnt.dev";

/// base url of the ingest server. overridable for local dev.
pub fn endpoint() -> String {
    std::env::var("HYVSPECS_ENDPOINT")
        .unwrap_or_else(|_| DEFAULT_ENDPOINT.into())
        .trim_end_matches('/')
        .to_string()
}

#[derive(Serialize, Deserialize)]
pub struct CardRecord {
    pub token: String,
    pub url: String,
    pub handle: Option<String>,
}

// the whole store is one small json map keyed by card_id. a map is enough: lookups for
// delete/claim are by id, and rewriting the file wholesale is fine at this scale.
#[derive(Default, Serialize, Deserialize)]
struct Store {
    cards: BTreeMap<String, CardRecord>,
}

fn store_path() -> Result<PathBuf> {
    let dir = dirs::config_dir().context("no config directory for this platform")?;
    Ok(dir.join("hyvspecs").join("cards.json"))
}

fn load() -> Store {
    // a missing or unreadable store is just an empty one; tokens are best-effort cache.
    store_path()
        .ok()
        .and_then(|p| fs::read(p).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

/// persist the credentials for a freshly created card.
pub fn remember(card_id: &str, record: CardRecord) -> Result<()> {
    let mut store = load();
    store.cards.insert(card_id.to_string(), record);

    let path = store_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, serde_json::to_vec_pretty(&store)?)
        .with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}

/// the edit token for a card created on this machine, if we still have it.
pub fn token_for(card_id: &str) -> Option<String> {
    load().cards.remove(card_id).map(|r| r.token)
}
