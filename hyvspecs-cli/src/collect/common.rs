//! Cross-platform base spec gathering module using `sysinfo`.
//!
//! SAFETY & PRIVACY GUARANTEE:
//! - This module gathers general OS names, CPU models, RAM sizes, and disk sizes using `sysinfo`.
//! - It explicitly filters out and drops machine names, usernames, and hostnames to ensure absolute privacy.
//! - The gathered data strictly adheres to the schema defined in `payload.rs`.

use sysinfo::{Disks, System};

use crate::collect::vendor::infer_vendor;
use crate::payload::{Cpu, Drive, DriveKind, Machine, Payload, Ram};

const BYTES_PER_MB: u64 = 1024 * 1024;

pub fn collect_base() -> Payload {
    let mut sys = System::new_all();
    sys.refresh_all();

    Payload::new(
        machine(),
        cpu(&sys),
        Vec::new(),
        ram(&sys),
        drives_fallback(),
    )
}

fn machine() -> Machine {
    let name = System::name().unwrap_or_else(|| "unknown".into());
    // os_version may carry a build, e.g. "11 (26200)" on windows. drop it.
    let version = System::os_version()
        .unwrap_or_default()
        .split(" (")
        .next()
        .unwrap_or_default()
        .trim()
        .to_string();
    let os = if version.is_empty() {
        name
    } else {
        format!("{name} {version}")
    }
    .to_ascii_lowercase();

    Machine { os, label: None }
}

fn cpu(sys: &System) -> Cpu {
    let model = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".into());

    Cpu {
        vendor: infer_vendor(&model),
        model,
        cores_physical: System::physical_core_count().map(|n| n as u32),
        cores_logical: sys.cpus().len() as u32,
        clock_max_mhz: None, // filled by platform enrich
    }
}

fn ram(sys: &System) -> Ram {
    Ram {
        total_mb: sys.total_memory() / BYTES_PER_MB,
        modules: Vec::new(), // filled by platform enrich
    }
}

/// last-resort drive list from sysinfo. lists mounted volumes, not physical
/// drives, so platform enrich replaces this when it can. deduped by name.
fn drives_fallback() -> Vec<Drive> {
    let disks = Disks::new_with_refreshed_list();
    let mut seen: Vec<String> = Vec::new();
    let mut out = Vec::new();

    for disk in &disks {
        let name = disk.name().to_string_lossy().to_string();
        if seen.contains(&name) {
            continue;
        }
        seen.push(name);
        out.push(Drive {
            size_mb: disk.total_space() / BYTES_PER_MB,
            kind: map_disk_kind(disk.kind()),
            read_mbps: None,
        });
    }
    out
}

fn map_disk_kind(kind: sysinfo::DiskKind) -> DriveKind {
    match kind {
        sysinfo::DiskKind::SSD => DriveKind::Ssd,
        sysinfo::DiskKind::HDD => DriveKind::Hdd,
        sysinfo::DiskKind::Unknown(_) => DriveKind::Unknown,
    }
}
