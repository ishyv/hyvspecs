//! terminal output. metallic and minimal: lowercase, mono feel, terse.
//! hand-rolled ansi, suppressed when NO_COLOR is set.

use std::collections::BTreeMap;

use crate::payload::{DriveKind, Payload, Ram};

const GOLD: &str = "\x1b[38;5;179m";
const SIGNAL: &str = "\x1b[38;5;37m";
const DIM: &str = "\x1b[38;5;240m";
const RESET: &str = "\x1b[0m";

pub fn color(code: &str) -> &str {
    if std::env::var_os("NO_COLOR").is_some() {
        ""
    } else {
        code
    }
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

/// the link is the product of the whole command: big, on its own line, easy to copy.
pub fn print_link(url: &str, verified: bool) {
    let (gold, signal, dim, reset) = (color(GOLD), color(SIGNAL), color(DIM), color(RESET));
    let mark = if verified {
        format!("  {signal}verified{reset}")
    } else {
        format!("  {dim}unverified{reset}")
    };
    println!("  {signal}\u{25b8}{reset} {gold}{url}{reset}{mark}");
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
    let cpu = &p.cpu;
    let mut s = cpu.model.clone();
    match cpu.cores_physical {
        Some(phys) => s.push_str(&format!(" \u{b7} {phys}c/{}t", cpu.cores_logical)),
        None => s.push_str(&format!(" \u{b7} {}t", cpu.cores_logical)),
    }
    if let Some(mhz) = cpu.clock_max_mhz {
        s.push_str(&format!(" \u{b7} {:.1} ghz", mhz as f64 / 1000.0));
    }
    s
}

fn gpu_line(p: &Payload, i: usize) -> String {
    let gpu = &p.gpus[i];
    match gpu.vram_mb {
        Some(vram) => format!("{} \u{b7} {}", gpu.model, capacity(vram)),
        None => gpu.model.clone(),
    }
}

fn ram_line(ram: &Ram) -> String {
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
        .map(|(desc, n)| format!("{n} \u{d7} {desc}"))
        .collect::<Vec<_>>()
        .join(", ");
    format!("{total} \u{b7} {detail}")
}

fn drive_line(p: &Payload) -> String {
    if p.drives.is_empty() {
        return "none detected".into();
    }
    p.drives
        .iter()
        .map(|d| format!("{} {}", capacity(d.size_mb), drive_kind(d.kind)))
        .collect::<Vec<_>>()
        .join(" \u{b7} ")
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
