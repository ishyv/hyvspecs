mod cli;
mod collect;
mod config;
mod output;
mod payload;
mod upload;

use std::io::{self, IsTerminal, Write};

use anyhow::{Result, bail};
use clap::Parser;

use cli::{Cli, Command, ShowcaseArgs};
use config::CardRecord;

fn main() {
    if let Err(err) = run() {
        let (dim, reset) = (output::color("\x1b[38;5;240m"), output::color("\x1b[0m"));
        eprintln!();
        eprintln!("  \x1b[31merror\x1b[0m: {}", err);
        let mut source = err.source();
        while let Some(src) = source {
            eprintln!("  {}context: {}{}", dim, src, reset);
            source = src.source();
        }
        eprintln!();
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    match Cli::parse().command {
        Command::Showcase(args) => showcase(args),
        Command::Delete { card_id } => delete(&card_id),
        Command::Login | Command::Claim { .. } => {
            bail!(
                "Not available yet \u{2014} `login` and `claim` commands will be added in a future update."
            );
        }
    }
}

fn showcase(args: ShowcaseArgs) -> Result<()> {
    let payload = collect::collect();

    if args.json {
        println!("{}", output::to_json(&payload)?);
        return Ok(());
    }

    output::print_summary(&payload);

    let endpoint = config::endpoint();
    if args.dry_run {
        output::print_pending(&endpoint);
        println!("{}", output::to_json(&payload)?);
        return Ok(());
    }

    if args.verify {
        bail!("--verify needs `hyvspecs login`, which isn't available yet");
    }

    let mut custom_id = args.id.clone();
    let mut custom_label = args.label.clone();
    let is_interactive = !args.yes && io::stdin().is_terminal() && io::stdout().is_terminal();

    if is_interactive {
        let (gold, signal, dim, reset) = (
            output::color("\x1b[38;5;179m"),
            output::color("\x1b[38;5;37m"),
            output::color("\x1b[38;5;240m"),
            output::color("\x1b[0m"),
        );
        let host = endpoint
            .trim_start_matches("https://")
            .trim_start_matches("http://");

        if custom_id.is_none() {
            loop {
                print!("  {signal}\u{25b8}{reset} custom url slug (leave blank for random): ");
                io::stdout().flush()?;
                let mut input = String::new();
                io::stdin().read_line(&mut input)?;
                let trimmed = input.trim().to_string();
                if trimmed.is_empty() {
                    break;
                }
                if is_valid_id(&trimmed) {
                    println!("    {dim}preview: {host}/{trimmed}{reset}");
                    custom_id = Some(trimmed);
                    break;
                } else {
                    println!("    {dim}invalid url slug. must be 1-30 characters of a-z, A-Z, 0-9, _, or -{reset}");
                }
            }
        }

        if custom_label.is_none() {
            print!("  {signal}\u{25b8}{reset} label (leave blank to skip): ");
            io::stdout().flush()?;
            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            let trimmed = input.trim().to_string();
            if !trimmed.is_empty() {
                custom_label = Some(trimmed);
            }
        }

        let target_url = match &custom_id {
            Some(id) => format!("{host}/{id}"),
            None => format!("{host}/[random]"),
        };

        print!("  {signal}\u{25b8}{reset} publish these specs to {gold}{target_url}{reset}? [y/N]: ");
        io::stdout().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let response = input.trim().to_lowercase();
        if response != "y" && response != "yes" {
            println!("  upload aborted");
            return Ok(());
        }
        println!();
    }

    // Lookup stored token locally if a custom card ID was specified
    let stored_token = custom_id.as_deref().and_then(config::token_for);

    // anonymous upload (bearer is None until github device-flow login lands).
    let created = upload::create_showcase(
        &endpoint,
        &payload,
        custom_label.as_deref(),
        custom_id.as_deref(),
        stored_token.as_deref(),
        None,
    )?;

    // best-effort: losing the token only costs the ability to edit/delete later.
    let _ = config::remember(
        &created.card_id,
        CardRecord {
            token: created.edit_token.clone(),
            url: created.url.clone(),
            handle: created.handle.clone(),
        },
    );

    output::print_link(&created.url, created.verified);
    Ok(())
}

fn delete(card_id: &str) -> Result<()> {
    let Some(token) = config::token_for(card_id) else {
        bail!("no edit token stored for {card_id} on this machine");
    };
    upload::delete_showcase(&config::endpoint(), card_id, &token)?;
    println!("deleted {card_id}");
    Ok(())
}

fn is_valid_id(s: &str) -> bool {
    if s.is_empty() || s.len() > 30 {
        return false;
    }
    s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_id() {
        assert!(is_valid_id("my-rig"));
        assert!(is_valid_id("my_rig_123"));
        assert!(is_valid_id("Rig"));
        assert!(!is_valid_id("my rig"));
        assert!(!is_valid_id(""));
        assert!(!is_valid_id(&"a".repeat(31)));
        assert!(!is_valid_id("rig!"));
    }
}
