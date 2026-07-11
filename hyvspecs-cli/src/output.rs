//! terminal output. metallic and minimal: lowercase, mono feel, terse.
//! hand-rolled ansi, suppressed when NO_COLOR is set or stdout isn't a tty.

use std::collections::BTreeMap;
use std::io::IsTerminal;

use crate::payload::{DriveKind, Payload, Ram};

const GOLD: &str = "\x1b[38;5;179m";
const SIGNAL: &str = "\x1b[38;5;37m";
const DIM: &str = "\x1b[38;5;240m";
const RESET: &str = "\x1b[0m";

pub fn color(code: &str) -> &str {
    // honour NO_COLOR, and also stay silent when piped/redirected so a captured stream is
    // clean text rather than a soup of escape codes.
    if std::env::var_os("NO_COLOR").is_some() || !std::io::stdout().is_terminal() {
        ""
    } else {
        code
    }
}

/// the glyph set, with an ascii fallback. box-drawing and ▸/✓/·/× are mojibake on a terminal
/// that isn't prepared for utf-8, and a garbled frame is worse than a plain one.
pub struct Glyphs {
    pub arrow: &'static str,
    pub check: &'static str,
    pub tl: &'static str,
    pub tr: &'static str,
    pub bl: &'static str,
    pub br: &'static str,
    pub h: &'static str,
    pub v: &'static str,
    pub dot: &'static str,
    pub times: &'static str,
}

pub fn glyphs() -> Glyphs {
    if ascii_only() {
        Glyphs { arrow: ">", check: "+", tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|", dot: "-", times: "x" }
    } else {
        Glyphs {
            arrow: "\u{25b8}",
            check: "\u{2713}",
            tl: "\u{250c}",
            tr: "\u{2510}",
            bl: "\u{2514}",
            br: "\u{2518}",
            h: "\u{2500}",
            v: "\u{2502}",
            dot: "\u{b7}",
            times: "\u{d7}",
        }
    }
}

fn ascii_only() -> bool {
    if std::env::var_os("HYVSPECS_ASCII").is_some() {
        return true;
    }
    // an explicitly non-utf8 locale (C/POSIX) means box drawing won't render. an *unset* locale
    // is left alone — most modern terminals are utf-8 and we'd rather not degrade the default.
    for key in ["LC_ALL", "LC_CTYPE", "LANG"] {
        if let Ok(v) = std::env::var(key) {
            if v.is_empty() {
                continue;
            }
            let v = v.to_uppercase();
            return !(v.contains("UTF-8") || v.contains("UTF8"));
        }
    }
    false
}

pub fn to_json(payload: &Payload) -> anyhow::Result<String> {
    Ok(serde_json::to_string_pretty(payload)?)
}

pub fn print_summary(payload: &Payload) {
    let (gold, dim, reset) = (color(GOLD), color(DIM), color(RESET));

    println!();
    println!("  {gold}hyvspecs{reset}");
    println!();

    row(dim, reset, "os", &payload.machine.os);
    if let Some(label) = &payload.machine.label {
        row(dim, reset, "name", label);
    }
    row(dim, reset, "cpu", &cpu_line(payload));
    if payload.gpus.is_empty() {
        row(dim, reset, "gpu", "none detected");
    } else {
        for (i, _) in payload.gpus.iter().enumerate() {
            let label = if i == 0 { "gpu" } else { "" };
            row(dim, reset, label, &gpu_line(payload, i));
        }
    }
    row(dim, reset, "ram", &ram_line(&payload.ram));
    row(dim, reset, "disk", &drive_line(payload));
    println!();
    println!(
        "  {dim}privacy: zero personal identifiers (no usernames, IPs, MACs, or hostnames) were collected.{reset}"
    );
    println!();
}

/// the link is the product of the whole command, so it gets a frame — a sharp-cornered panel
/// (corners are corners, per the house rules) that lifts it out of the log and says "this is
/// the thing you came for." gold url, teal marker + verified badge; nothing else.
pub fn print_link(url: &str, verified: bool) {
    let (gold, signal, dim, reset) = (color(GOLD), color(SIGNAL), color(DIM), color(RESET));
    let g = glyphs();

    // show the address without its scheme — cleaner, still recognised and clickable.
    let display = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let status = if verified { "verified" } else { "unverified" };
    let status_color = if verified { signal } else { dim };

    // widths are measured on the *plain* text (chars, not bytes) so the box lines up regardless
    // of the ansi wrapping or any multibyte glyphs in the address.
    let left_w = display.chars().count() + 2; // "▸ " + address
    let status_w = status.chars().count();
    let gap = 4;
    let inner = left_w + status_w + gap + 4; // + 2 spaces padding each side
    let bar = g.h.repeat(inner);
    let spaces = " ".repeat(gap);

    println!();
    println!("  {dim}{}{bar}{}{reset}", g.tl, g.tr);
    println!(
        "  {dim}{}{reset}  {signal}{}{reset} {gold}{display}{reset}{spaces}{status_color}{status}{reset}  {dim}{}{reset}",
        g.v, g.arrow, g.v
    );
    println!("  {dim}{}{bar}{}{reset}", g.bl, g.br);
    println!();
}

/// dry-run: show where it would go and exactly what would be sent.
pub fn print_pending(endpoint: &str) {
    let (dim, reset) = (color(DIM), color(RESET));
    println!("  {dim}would upload to {endpoint}/api/showcase{reset}");
    println!();
}

fn row(dim: &str, reset: &str, label: &str, value: &str) {
    println!("  {dim}{label:<6}{reset}{value}");
}

fn cpu_line(p: &Payload) -> String {
    let dot = glyphs().dot;
    let cpu = &p.cpu;
    let mut s = cpu.model.clone();
    match cpu.cores_physical {
        Some(phys) => s.push_str(&format!(" {dot} {phys}c/{}t", cpu.cores_logical)),
        None => s.push_str(&format!(" {dot} {}t", cpu.cores_logical)),
    }
    if let Some(mhz) = cpu.clock_max_mhz {
        s.push_str(&format!(" {dot} {:.1} ghz", mhz as f64 / 1000.0));
    }
    s
}

fn gpu_line(p: &Payload, i: usize) -> String {
    let gpu = &p.gpus[i];
    match gpu.vram_mb {
        Some(vram) => format!("{} {} {}", gpu.model, glyphs().dot, capacity(vram)),
        None => gpu.model.clone(),
    }
}

fn ram_line(ram: &Ram) -> String {
    let g = glyphs();
    let total = capacity(ram.total_mb);
    if ram.modules.is_empty() {
        return total;
    }

    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for m in &ram.modules {
        let kind = m.kind.clone().unwrap_or_else(|| "ram".into());
        let speed = m.speed_mhz.map(|s| format!("-{s}")).unwrap_or_default();
        counts
            .entry(format!("{} {kind}{speed}", capacity(m.size_mb)))
            .and_modify(|c| *c += 1)
            .or_insert(1);
    }

    let detail = counts
        .iter()
        .map(|(desc, n)| format!("{n} {} {desc}", g.times))
        .collect::<Vec<_>>()
        .join(", ");
    format!("{total} {} {detail}", g.dot)
}

fn drive_line(p: &Payload) -> String {
    if p.drives.is_empty() {
        return "none detected".into();
    }
    p.drives
        .iter()
        .map(|d| format!("{} {}", capacity(d.size_mb), drive_kind(d.kind)))
        .collect::<Vec<_>>()
        .join(&format!(" {} ", glyphs().dot))
}

fn drive_kind(kind: DriveKind) -> &'static str {
    match kind {
        DriveKind::Nvme => "nvme",
        DriveKind::Ssd => "ssd",
        DriveKind::Hdd => "hdd",
        DriveKind::Unknown => "drive",
    }
}

/// mb -> human capacity. gb under a terabyte, tb above.
fn capacity(mb: u64) -> String {
    let gb = mb as f64 / 1024.0;
    if gb >= 1024.0 {
        format!("{:.1} tb", gb / 1024.0)
    } else {
        format!("{gb:.0} gb")
    }
}
