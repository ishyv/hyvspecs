//! Linux platform spec gathering module.
//!
//! SAFETY & PRIVACY GUARANTEE:
//! - This module collects generic hardware parameters by reading standard `/sys` virtual files
//!   (sysfs block device parameters, cpufreq metrics) and running the standard `lspci` command.
//! - It NEVER reads private data: no usernames, hostnames, network interface details,
//!   MAC/IP addresses, or hardware/motherboard UUIDs/serial numbers.
//! - Any file read or process execution degrades gracefully and safely if file permissions
//!   or system policies prevent access.

use std::fs;
use std::path::Path;

use crate::collect::vendor::infer_vendor;
use crate::payload::{Drive, DriveKind, Gpu, Payload, Vendor};

const BYTES_PER_MB: u64 = 1024 * 1024;

pub fn enrich(payload: &mut Payload) {
    if let Some(mhz) = cpu_max_clock_mhz() {
        payload.cpu.clock_max_mhz = Some(mhz);
    }
    let drives = drives();
    if !drives.is_empty() {
        payload.drives = drives;
    }
    let gpus = gpus();
    if !gpus.is_empty() {
        payload.gpus = gpus;
    }
}

fn read_trim(path: impl AsRef<Path>) -> Option<String> {
    fs::read_to_string(path).ok().map(|s| s.trim().to_string())
}

fn cpu_max_clock_mhz() -> Option<u32> {
    let khz: u64 = read_trim("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")?
        .parse()
        .ok()?;
    Some((khz / 1000) as u32)
}

/// physical block devices from /sys/block, skipping virtual ones.
fn drives() -> Vec<Drive> {
    let Ok(entries) = fs::read_dir("/sys/block") else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if is_virtual_block(&name) {
            continue;
        }
        let base = entry.path();

        // size is in 512-byte sectors.
        let Some(sectors) = read_trim(base.join("size")).and_then(|s| s.parse::<u64>().ok()) else {
            continue;
        };
        if sectors == 0 {
            continue;
        }

        let rotational = read_trim(base.join("queue/rotational"));
        out.push(Drive {
            size_mb: sectors * 512 / BYTES_PER_MB,
            kind: drive_kind(&name, rotational.as_deref()),
            read_mbps: None,
        });
    }
    out
}

fn is_virtual_block(name: &str) -> bool {
    const PREFIXES: [&str; 6] = ["loop", "ram", "zram", "dm-", "md", "sr"];
    PREFIXES.iter().any(|p| name.starts_with(p))
}

fn drive_kind(name: &str, rotational: Option<&str>) -> DriveKind {
    if name.starts_with("nvme") {
        return DriveKind::Nvme;
    }
    match rotational {
        Some("1") => DriveKind::Hdd,
        Some("0") => DriveKind::Ssd,
        _ => DriveKind::Unknown,
    }
}

/// gpus from /sys/class/drm/card*, with names from lspci when available and
/// vram from amd's mem_info_vram_total. nvidia vram is filled later via nvml.
fn gpus() -> Vec<Gpu> {
    let Ok(entries) = fs::read_dir("/sys/class/drm") else {
        return Vec::new();
    };

    let names = lspci_gpu_names();
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let card = entry.file_name().to_string_lossy().to_string();
        // match "card0", "card1" but not "card0-DP-1".
        if !card.starts_with("card") || !card[4..].chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let device = entry.path().join("device");

        let vendor = read_trim(device.join("vendor"))
            .and_then(|v| pci_vendor(&v))
            .unwrap_or(Vendor::Other);

        let vram_mb = read_trim(device.join("mem_info_vram_total"))
            .and_then(|s| s.parse::<u64>().ok())
            .filter(|&b| b > 0)
            .map(|b| b / BYTES_PER_MB);

        // prefer a real name from lspci; fall back to the vendor.
        let model = names
            .get(out.len())
            .cloned()
            .unwrap_or_else(|| format!("{} gpu", vendor_label(vendor)));

        out.push(Gpu {
            vendor: if matches!(vendor, Vendor::Other) {
                infer_vendor(&model)
            } else {
                vendor
            },
            model,
            vram_mb,
        });
    }
    out
}

fn pci_vendor(id: &str) -> Option<Vendor> {
    let v = match id.trim_start_matches("0x").to_ascii_lowercase().as_str() {
        "1002" => Vendor::Amd,
        "10de" => Vendor::Nvidia,
        "8086" => Vendor::Intel,
        _ => return None,
    };
    Some(v)
}

fn vendor_label(v: Vendor) -> &'static str {
    match v {
        Vendor::Amd => "amd",
        Vendor::Intel => "intel",
        Vendor::Nvidia => "nvidia",
        Vendor::Apple => "apple",
        Vendor::Arm => "arm",
        Vendor::Other => "unknown",
    }
}

/// gpu controller names from `lspci`, in bus order. empty if lspci is absent.
fn lspci_gpu_names() -> Vec<String> {
    let Ok(output) = std::process::Command::new("lspci").arg("-mm").output() else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&output.stdout);

    let mut names = Vec::new();
    for line in text.lines() {
        // class is the second quoted field; "VGA compatible controller",
        // "3D controller", or "Display controller".
        if !(line.contains("VGA compatible controller")
            || line.contains("3D controller")
            || line.contains("Display controller"))
        {
            continue;
        }
        // device name is the fourth quoted field.
        if let Some(name) = line.split('"').nth(5) {
            names.push(name.trim().to_string());
        }
    }
    names
}
