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

        println!("  {dim}tip: run `hyvspecs login` first to get a verified github badge on your card{reset}");
        println!();

        if custom_id.is_none() {
            let prompt = format!("  {signal}\u{25b8}{reset} custom url slug (leave blank for random): ");
            let result = read_input_interactive(
                &prompt,
                "",
                |c, len| (c.is_ascii_alphanumeric() || c == '_' || c == '-') && len < 30,
                |inp| {
                    let target = if inp.is_empty() { "[random]" } else { inp };
                    print!("    {dim}preview: {}/{}{reset}", host, target);
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
                    if inp.is_empty() {
                        print!("    {dim}preview: {}/{}{reset}", host, slug_str);
                    } else {
                        print!("    {dim}preview: {}/{}  [label: {}]{reset}", host, slug_str, inp);
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
        let target_url = if label_str.is_empty() {
            format!("{host}/{slug_str}")
        } else {
            format!("{host}/{slug_str}  [label: {label_str}]")
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
