//! talks to the ingest server: create a card, delete a card. anonymous unless a github
//! bearer token is supplied (verified tier).

use anyhow::{Context, Result, bail};
use serde::Deserialize;
use serde_json::json;

use crate::payload::Payload;

/// the server's response to a successful create.
#[derive(Deserialize)]
pub struct Created {
    pub url: String,
    pub handle: Option<String>,
    pub card_id: String,
    pub edit_token: String,
    pub verified: bool,
}

pub fn create_showcase(
    endpoint: &str,
    payload: &Payload,
    label: Option<&str>,
    card_id: Option<&str>,
    edit_token: Option<&str>,
    bearer: Option<&str>,
) -> Result<Created> {
    let client = reqwest::blocking::Client::new();
    let mut body = json!({ "payload": payload, "label": label });
    if let Some(id) = card_id {
        body["card_id"] = json!(id);
    }
    if let Some(token) = edit_token {
        body["edit_token"] = json!(token);
    }

    let mut req = client.post(format!("{endpoint}/api/showcase")).json(&body);
    if let Some(token) = bearer {
        req = req.bearer_auth(token);
    }

    let res = req.send().context("could not reach the server")?;
    if !res.status().is_success() {
        bail!("upload rejected: {}", describe(res));
    }
    res.json().context("server returned an unexpected response")
}

pub fn delete_showcase(endpoint: &str, card_id: &str, edit_token: &str) -> Result<()> {
    let res = reqwest::blocking::Client::new()
        .delete(format!("{endpoint}/api/showcase/{card_id}"))
        .json(&json!({ "edit_token": edit_token }))
        .send()
        .context("could not reach the server")?;
    if !res.status().is_success() {
        bail!("delete rejected: {}", describe(res));
    }
    Ok(())
}

/// terse, lowercase failure line in the house voice. the server sends a plain status
/// message which we surface as the condition.
fn describe(res: reqwest::blocking::Response) -> String {
    let status = res.status().as_u16();
    let body = res.text().unwrap_or_default();
    let reason = body.trim();
    if reason.is_empty() {
        format!("status {status}")
    } else {
        format!("{reason} ({status})")
    }
}
