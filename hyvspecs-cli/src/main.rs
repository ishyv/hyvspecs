mod cli;
mod collect;
mod config;
mod output;
mod payload;
mod upload;

use std::io::{self, IsTerminal, Write};

use anyhow::{Result, bail};
use clap::Parser;
use crossterm::event::{self, Event, KeyCode};

use cli::{Cli, Command, ShowcaseArgs};
use config::CardRecord;

struct RawModeGuard;

impl RawModeGuard {
    fn enable() -> io::Result<Self> {
        crossterm::terminal::enable_raw_mode()?;
        Ok(RawModeGuard)
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        let _ = crossterm::terminal::disable_raw_mode();
    }
}

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
        Command::Login => login(),
        Command::Claim { card_id } => claim(&card_id),
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

    if let Some(ref id) = args.id {
        if !is_valid_id(id) {
            bail!("invalid url slug format: must be 1-30 characters of a-z, A-Z, 0-9, _, or -");
        }
    }

    let mut custom_id = args.id.clone();
    let mut custom_label = args.label.clone();
    let is_interactive = !args.yes && io::stdin().is_terminal() && io::stdout().is_terminal();

    let mut publish_verified = args.verify;
    let mut github_token = config::github_token();

    if args.verify && github_token.is_none() {
        bail!("--verify requires a github login. run `hyvspecs login` first.");
    }

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

        // 1. Verification prompt
        if !publish_verified {
            print!("  {signal}\u{25b8}{reset} publish under your verified github profile? [y/N]: ");
            io::stdout().flush()?;
            let confirmed = {
                let _guard = RawModeGuard::enable()?;
                loop {
                    if event::poll(std::time::Duration::from_millis(100))? {
                        if let Event::Key(key_event) = event::read()? {
                            if key_event.kind != crossterm::event::KeyEventKind::Press {
                                continue;
                            }
                            match key_event.code {
                                KeyCode::Char('y') | KeyCode::Char('Y') => break true,
                                KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc => break false,
                                KeyCode::Char('c') if key_event.modifiers.contains(crossterm::event::KeyModifiers::CONTROL) => {
                                    break false;
                                }
                                KeyCode::Enter => break false,
                                _ => {}
                            }
                        }
                    }
                }
            };
            println!();

            if confirmed {
                if github_token.is_none() {
                    println!("    to verify your github handle, we need a personal access token.");
                    println!("    please generate one at: {gold}https://github.com/settings/tokens/new?description=hyvspecs-cli&scopes=read:user{reset}");
                    println!();
                    print!("  {signal}\u{25b8}{reset} paste your token: ");
                    io::stdout().flush()?;
                    let mut token = String::new();
                    io::stdin().read_line(&mut token)?;
                    let trimmed = token.trim().to_string();
                    if !trimmed.is_empty() {
                        println!("    {dim}verifying...{reset}");
                        match upload::verify_github_token(&trimmed) {
                            Ok(username) => {
                                config::save_github_token(&trimmed, &username)?;
                                github_token = Some(trimmed);
                                println!("    {dim}verified as @{}{reset}", username);
                            }
                            Err(e) => {
                                println!("    {dim}verification failed: {}. publishing anonymously.{reset}", e);
                            }
                        }
                    } else {
                        println!("    {dim}empty token. publishing anonymously.{reset}");
                    }
                }
                if github_token.is_some() {
                    publish_verified = true;
                }
                println!();
            }
        }

        // Determine target namespace for URL preview
        let handle = if publish_verified {
            config::github_username()
        } else {
            None
        };

        if custom_id.is_none() {
            let prompt = format!("  {signal}\u{25b8}{reset} custom url slug (leave blank for random): ");
            let result = read_input_interactive(
                &prompt,
                "",
                |c, len| (c.is_ascii_alphanumeric() || c == '_' || c == '-') && len < 30,
                |inp| {
                    let preview = match &handle {
                        Some(h) => {
                            let target = if inp.is_empty() { "[random]" } else { inp };
                            format!("{host}/{h}/{target}")
                        }
                        None => {
                            let target = if inp.is_empty() { "[random]" } else { inp };
                            format!("{host}/{target}")
                        }
                    };
                    print!("    {dim}preview: {}{reset}", preview);
                    let _ = io::stdout().flush();
                },
            )?;
            let Some(trimmed) = result else {
                println!("  upload aborted");
                return Ok(());
            };
            if !trimmed.is_empty() {
                custom_id = Some(trimmed);
            }
        }

        if custom_label.is_none() {
            let slug_str = custom_id.as_deref().unwrap_or("[random]");
            let prompt = format!("  {signal}\u{25b8}{reset} label (leave blank to skip): ");
            let result = read_input_interactive(
                &prompt,
                "",
                |c, len| !c.is_control() && len < 50,
                |inp| {
                    let preview = match &handle {
                        Some(h) => format!("{host}/{h}/{slug_str}"),
                        None => format!("{host}/{slug_str}"),
                    };
                    if inp.is_empty() {
                        print!("    {dim}preview: {}{reset}", preview);
                    } else {
                        print!("    {dim}preview: {}  [label: {}]{reset}", preview, inp);
                    }
                    let _ = io::stdout().flush();
                },
            )?;
            let Some(trimmed) = result else {
                println!("  upload aborted");
                return Ok(());
            };
            if !trimmed.is_empty() {
                custom_label = Some(trimmed);
            }
        }

        let slug_str = custom_id.as_deref().unwrap_or("[random]");
        let label_str = custom_label.as_deref().unwrap_or("");
        let preview_url = match &handle {
            Some(h) => format!("{host}/{h}/{slug_str}"),
            None => format!("{host}/{slug_str}"),
        };
        let target_url = if label_str.is_empty() {
            preview_url
        } else {
            format!("{preview_url}  [label: {label_str}]")
        };

        print!("  {signal}\u{25b8}{reset} publish to {gold}{target_url}{reset}? [y/N]: ");
        io::stdout().flush()?;

        let confirmed = {
            let _guard = RawModeGuard::enable()?;
            loop {
                if event::poll(std::time::Duration::from_millis(100))? {
                    if let Event::Key(key_event) = event::read()? {
                        if key_event.kind != crossterm::event::KeyEventKind::Press {
                            continue;
                        }
                        match key_event.code {
                            KeyCode::Char('y') | KeyCode::Char('Y') => break true,
                            KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc => break false,
                            KeyCode::Char('c') if key_event.modifiers.contains(crossterm::event::KeyModifiers::CONTROL) => {
                                break false;
                            }
                            KeyCode::Enter => break false,
                            _ => {}
                        }
                    }
                }
            }
        };

        println!();
        if !confirmed {
            println!("  upload aborted");
            return Ok(());
        }
        println!();
    }

    // Lookup stored token locally if a custom card ID was specified
    let stored_token = custom_id.as_deref().and_then(config::token_for);

    let bearer = if publish_verified { github_token.as_deref() } else { None };

    // anonymous or verified upload
    let created = upload::create_showcase(
        &endpoint,
        &payload,
        custom_label.as_deref(),
        custom_id.as_deref(),
        stored_token.as_deref(),
        bearer,
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

fn login() -> Result<()> {
    let (gold, signal, dim, reset) = (
        output::color("\x1b[38;5;179m"),
        output::color("\x1b[38;5;37m"),
        output::color("\x1b[38;5;240m"),
        output::color("\x1b[0m"),
    );

    println!("  {gold}github verification login{reset}");
    println!();
    println!("    to verify your identity, we need a github personal access token (pat).");
    println!("    please generate a token with 'read:user' scope at:");
    println!("    {gold}https://github.com/settings/tokens/new?description=hyvspecs-cli&scopes=read:user{reset}");
    println!();

    print!("  {signal}\u{25b8}{reset} paste your github access token: ");
    io::stdout().flush()?;

    let mut token = String::new();
    io::stdin().read_line(&mut token)?;
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        bail!("login cancelled: token cannot be empty");
    }

    println!("    {dim}verifying token...{reset}");
    let username = upload::verify_github_token(&trimmed)?;

    config::save_github_token(&trimmed, &username)?;

    println!();
    println!("  {signal}\u{2713}{reset} successfully logged in as {gold}@{username}{reset}");
    println!();
    Ok(())
}

fn claim(card_id: &str) -> Result<()> {
    let (gold, signal, dim, reset) = (
        output::color("\x1b[38;5;179m"),
        output::color("\x1b[38;5;37m"),
        output::color("\x1b[38;5;240m"),
        output::color("\x1b[0m"),
    );

    let Some(github_token) = config::github_token() else {
        bail!("not logged in. run `hyvspecs login` first");
    };

    let Some(edit_token) = config::token_for(card_id) else {
        bail!("no edit token stored for {card_id} on this machine");
    };

    println!("    {dim}claiming card {card_id} on your github profile...{reset}");
    let handle = upload::claim_showcase(&config::endpoint(), card_id, &edit_token, &github_token)?;

    let host = config::endpoint()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .to_string();

    // update the local storage to remember the handle!
    let _ = config::remember(
        card_id,
        CardRecord {
            token: edit_token,
            url: format!("{}/{handle}/{card_id}", config::endpoint()),
            handle: Some(handle.clone()),
        },
    );

    println!();
    println!("  {signal}\u{2713}{reset} successfully claimed! card is now at: {gold}{host}/{handle}/{card_id}{reset}");
    println!();
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

fn redraw_prompt_and_preview(
    prompt: &str,
    input: &str,
    redraw_preview: &impl Fn(&str),
) -> io::Result<()> {
    print!("\r\x1b[K");
    print!("{}{}", prompt, input);
    let _ = io::stdout().flush();
    print!("\r\n\x1b[K");
    let _ = io::stdout().flush();
    redraw_preview(input);
    print!("\x1b[A\r{}{}", prompt, input);
    let _ = io::stdout().flush();
    Ok(())
}

fn read_input_interactive(
    prompt: &str,
    initial: &str,
    char_validator: impl Fn(char, usize) -> bool,
    redraw_preview: impl Fn(&str),
) -> Result<Option<String>> {
    let mut input = initial.to_string();
    
    print!("{}", prompt);
    let _ = io::stdout().flush();
    redraw_preview(&input);

    let _guard = RawModeGuard::enable()?;

    loop {
        if event::poll(std::time::Duration::from_millis(100))? {
            if let Event::Key(key_event) = event::read()? {
                if key_event.kind != crossterm::event::KeyEventKind::Press {
                    continue;
                }

                match key_event.code {
                    KeyCode::Char('c') if key_event.modifiers.contains(crossterm::event::KeyModifiers::CONTROL) => {
                        return Ok(None);
                    }
                    KeyCode::Char(c) => {
                        if char_validator(c, input.len()) {
                            input.push(c);
                            redraw_prompt_and_preview(prompt, &input, &redraw_preview)?;
                        }
                    }
                    KeyCode::Backspace => {
                        if !input.is_empty() {
                            input.pop();
                            redraw_prompt_and_preview(prompt, &input, &redraw_preview)?;
                        }
                    }
                    KeyCode::Enter => {
                        break;
                    }
                    KeyCode::Esc => {
                        return Ok(None);
                    }
                    _ => {}
                }
            }
        }
    }

    drop(_guard);
    print!("\r\n\r\n");
    let _ = io::stdout().flush();
    
    Ok(Some(input))
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
