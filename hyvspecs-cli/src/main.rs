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
        // gold, not red — the palette is gold + teal + dim, nothing else, even for faults.
        let (gold, dim, reset) = (
            output::color("\x1b[38;5;179m"),
            output::color("\x1b[38;5;240m"),
            output::color("\x1b[0m"),
        );
        eprintln!();
        eprintln!("  {gold}error{reset}: {}", err);
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
        let arrow = output::glyphs().arrow;
        let host = endpoint
            .trim_start_matches("https://")
            .trim_start_matches("http://");

        // 1. Verification prompt
        if !publish_verified {
            print!("  {signal}{arrow}{reset} publish under your verified github profile? [y/N]: ");
            io::stdout().flush()?;
            let confirmed = confirm_yn()?;
            println!();

            if confirmed {
                if github_token.is_none() {
                    println!("    to verify your github handle, we need a personal access token.");
                    println!("    please generate one at: {gold}https://github.com/settings/tokens/new?description=hyvspecs-cli&scopes=read:user{reset}");
                    println!();
                    print!("  {signal}{arrow}{reset} paste your token: ");
                    io::stdout().flush()?;
                    let trimmed = read_secret()?;
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
            let prompt = format!("  {signal}{arrow}{reset} custom url slug (leave blank for random): ");
            let result = read_input_interactive(
                &prompt,
                "",
                |c, len| (c.is_ascii_alphanumeric() || c == '_' || c == '-') && len < 30,
                |inp| {
                    let target = if inp.is_empty() { "[random]" } else { inp };
                    match &handle {
                        Some(h) => format!("preview: {host}/{h}/{target}"),
                        None => format!("preview: {host}/{target}"),
                    }
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
            let prompt = format!("  {signal}{arrow}{reset} label (leave blank to skip): ");
            let result = read_input_interactive(
                &prompt,
                "",
                |c, len| !c.is_control() && len < 50,
                |inp| {
                    let base = match &handle {
                        Some(h) => format!("{host}/{h}/{slug_str}"),
                        None => format!("{host}/{slug_str}"),
                    };
                    if inp.is_empty() {
                        format!("preview: {base}")
                    } else {
                        format!("preview: {base}  [label: {inp}]")
                    }
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

        print!("  {signal}{arrow}{reset} publish to {gold}{target_url}{reset}? [y/N]: ");
        io::stdout().flush()?;

        let confirmed = confirm_yn()?;

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

    let g = output::glyphs();
    print!("  {signal}{}{reset} paste your github access token: ", g.arrow);
    io::stdout().flush()?;

    let trimmed = read_secret()?;
    if trimmed.is_empty() {
        bail!("login cancelled: token cannot be empty");
    }

    println!("    {dim}verifying token...{reset}");
    let username = upload::verify_github_token(&trimmed)?;

    config::save_github_token(&trimmed, &username)?;

    println!();
    println!("  {signal}{}{reset} successfully logged in as {gold}@{username}{reset}", g.check);
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
    println!(
        "  {signal}{}{reset} successfully claimed! card is now at: {gold}{host}/{handle}/{card_id}{reset}",
        output::glyphs().check
    );
    println!();
    Ok(())
}

fn delete(card_id: &str) -> Result<()> {
    let (signal, gold, reset) = (
        output::color("\x1b[38;5;37m"),
        output::color("\x1b[38;5;179m"),
        output::color("\x1b[0m"),
    );
    let Some(token) = config::token_for(card_id) else {
        bail!("no edit token stored for {card_id} on this machine");
    };
    upload::delete_showcase(&config::endpoint(), card_id, &token)?;
    // match the house style the rest of the cli uses, instead of a bare unstyled line.
    println!();
    println!("  {signal}{}{reset} deleted {gold}{card_id}{reset}", output::glyphs().check);
    println!();
    Ok(())
}

/// one raw-mode y/N prompt, shared by every confirmation. Enter, Esc and Ctrl-C all mean *no* —
/// the safe default, since both call sites gate a publish.
fn confirm_yn() -> Result<bool> {
    let _guard = RawModeGuard::enable()?;
    loop {
        if event::poll(std::time::Duration::from_millis(100))? {
            if let Event::Key(k) = event::read()? {
                if k.kind != crossterm::event::KeyEventKind::Press {
                    continue;
                }
                match k.code {
                    KeyCode::Char('y') | KeyCode::Char('Y') => return Ok(true),
                    KeyCode::Char('c')
                        if k.modifiers.contains(crossterm::event::KeyModifiers::CONTROL) =>
                    {
                        return Ok(false);
                    }
                    KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc | KeyCode::Enter => {
                        return Ok(false);
                    }
                    _ => {}
                }
            }
        }
    }
}

/// read a token WITHOUT echoing it. a pasted PAT that echoes lands in the scrollback, the
/// terminal's history, and any screen recording. we print a dot per character so there's still
/// feedback that the paste landed. piped input isn't echoed anyway, so it just reads the line.
fn read_secret() -> Result<String> {
    if !io::stdin().is_terminal() {
        let mut s = String::new();
        io::stdin().read_line(&mut s)?;
        println!(); // piped input isn't echoed, so close the prompt row ourselves
        return Ok(s.trim().to_string());
    }

    let mut secret = String::new();
    {
        let _guard = RawModeGuard::enable()?;
        loop {
            if event::poll(std::time::Duration::from_millis(100))? {
                if let Event::Key(k) = event::read()? {
                    if k.kind != crossterm::event::KeyEventKind::Press {
                        continue;
                    }
                    match k.code {
                        KeyCode::Char('c')
                            if k.modifiers.contains(crossterm::event::KeyModifiers::CONTROL) =>
                        {
                            secret.clear();
                            break;
                        }
                        KeyCode::Char(c) => {
                            secret.push(c);
                            print!("*");
                            let _ = io::stdout().flush();
                        }
                        KeyCode::Backspace => {
                            if secret.pop().is_some() {
                                print!("\u{8} \u{8}");
                                let _ = io::stdout().flush();
                            }
                        }
                        KeyCode::Enter | KeyCode::Esc => break,
                        _ => {}
                    }
                }
            }
        }
    }
    print!("\r\n");
    let _ = io::stdout().flush();
    Ok(secret.trim().to_string())
}

/// visible width, skipping ansi escape sequences — a coloured prompt must measure as what the
/// user actually sees, or every width calculation below is wrong.
fn visible_width(s: &str) -> usize {
    let mut w = 0;
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            for c2 in chars.by_ref() {
                if c2.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            w += 1;
        }
    }
    w
}

/// the last `n` chars, so a long slug scrolls within the prompt row instead of wrapping it.
fn tail(s: &str, n: usize) -> String {
    let len = s.chars().count();
    if len <= n {
        return s.to_string();
    }
    s.chars().skip(len - n).collect()
}

/// clamp to `n` chars so a long preview can't wrap onto a second row.
fn clip(s: &str, n: usize) -> String {
    let len = s.chars().count();
    if len <= n {
        return s.to_string();
    }
    if n <= 1 {
        return String::new();
    }
    s.chars().take(n - 1).chain(std::iter::once('\u{2026}')).collect()
}

/// repaint the prompt row and the live preview row beneath it, leaving the cursor back on the
/// prompt. BOTH rows are clamped to the terminal width: the old version assumed neither would
/// wrap and then moved the cursor up exactly one line, so a narrow terminal or a long slug
/// desynced the cursor and shredded the prompt.
fn redraw_prompt_and_preview(
    prompt: &str,
    input: &str,
    preview_of: &impl Fn(&str) -> String,
) -> io::Result<()> {
    let cols = crossterm::terminal::size()
        .map(|(w, _)| w as usize)
        .unwrap_or(80)
        .max(24);
    let (dim, reset) = (output::color("\x1b[38;5;240m"), output::color("\x1b[0m"));

    let room = cols.saturating_sub(visible_width(prompt)).saturating_sub(1);
    let shown = tail(input, room);
    let preview = clip(&preview_of(input), cols.saturating_sub(5)); // 4-space indent + margin

    print!("\r\x1b[K{prompt}{shown}");
    print!("\r\n\x1b[K    {dim}{preview}{reset}");
    print!("\x1b[A\r\x1b[K{prompt}{shown}");
    io::stdout().flush()
}

fn read_input_interactive(
    prompt: &str,
    initial: &str,
    char_validator: impl Fn(char, usize) -> bool,
    preview_of: impl Fn(&str) -> String,
) -> Result<Option<String>> {
    let mut input = initial.to_string();

    let _guard = RawModeGuard::enable()?;
    redraw_prompt_and_preview(prompt, &input, &preview_of)?;

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
                        // count characters, not bytes, so multibyte input hits the cap at the
                        // right place and the length limits mean what they say.
                        if char_validator(c, input.chars().count()) {
                            input.push(c);
                            redraw_prompt_and_preview(prompt, &input, &preview_of)?;
                        }
                    }
                    KeyCode::Backspace => {
                        if input.pop().is_some() {
                            redraw_prompt_and_preview(prompt, &input, &preview_of)?;
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
    // step past the preview row so whatever prints next doesn't land on top of it.
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
