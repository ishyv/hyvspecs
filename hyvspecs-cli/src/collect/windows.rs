//! Windows platform spec gathering module.
//!
//! SAFETY & PRIVACY GUARANTEE:
//! - This module gathers purely physical hardware specifications (CPU models, clock speed,
//!   individual RAM modules, GPU specs, and hard drive capacities) via WMI and DXGI.
//! - It NEVER reads private data: no usernames, computer/hostnames, network MAC addresses,
//!   IP addresses, device serial numbers, or security identifiers (SIDs).
//! - All WMI queries are restricted to generic hardware metadata (Win32_Processor,
//!   Win32_PhysicalMemory, MSFT_PhysicalDisk, Win32_VideoController) and fail gracefully.

// wmi class names must match exactly, so the query structs are not camel case.
#![allow(non_snake_case, non_camel_case_types)]

use serde::Deserialize;
use wmi::WMIConnection;

use crate::collect::vendor::infer_vendor;
use crate::payload::{Drive, DriveKind, Gpu, Payload, RamModule};

const BYTES_PER_MB: u64 = 1024 * 1024;

pub fn enrich(payload: &mut Payload) {
    if let Ok(wmi) = WMIConnection::new() {
        fill_clock(&wmi, payload);
        fill_ram_modules(&wmi, payload);
        fill_gpus(&wmi, payload);
    }
    if let Ok(storage) = WMIConnection::with_namespace_path("ROOT\\Microsoft\\Windows\\Storage") {
        fill_drives(&storage, payload);
    }
}

#[derive(Deserialize)]
struct Win32_Processor {
    MaxClockSpeed: Option<u32>,
}

fn fill_clock(wmi: &WMIConnection, payload: &mut Payload) {
    if let Some(mhz) = wmi
        .query::<Win32_Processor>()
        .ok()
        .and_then(|rows| rows.into_iter().find_map(|p| p.MaxClockSpeed))
    {
        payload.cpu.clock_max_mhz = Some(mhz);
    }
}

#[derive(Deserialize)]
struct Win32_PhysicalMemory {
    Capacity: Option<u64>,
    Speed: Option<u32>,
    SMBIOSMemoryType: Option<u16>,
}

fn fill_ram_modules(wmi: &WMIConnection, payload: &mut Payload) {
    let Ok(rows) = wmi.query::<Win32_PhysicalMemory>() else {
        return;
    };
    payload.ram.modules = rows
        .into_iter()
        .filter_map(|m| {
            let bytes = m.Capacity?;
            Some(RamModule {
                size_mb: bytes / BYTES_PER_MB,
                speed_mhz: m.Speed,
                kind: m.SMBIOSMemoryType.and_then(ram_kind),
            })
        })
        .collect();
}

/// smbios memory type code -> ddr generation. only the common ones.
fn ram_kind(code: u16) -> Option<String> {
    let s = match code {
        20 => "ddr",
        21 => "ddr2",
        24 => "ddr3",
        26 => "ddr4",
        34 => "ddr5",
        _ => return None,
    };
    Some(s.into())
}

#[derive(Deserialize)]
struct MSFT_PhysicalDisk {
    Size: Option<u64>,
    MediaType: Option<u16>,
    BusType: Option<u16>,
}

fn fill_drives(storage: &WMIConnection, payload: &mut Payload) {
    let Ok(rows) = storage.query::<MSFT_PhysicalDisk>() else {
        return;
    };
    let drives: Vec<Drive> = rows
        .into_iter()
        .filter_map(|d| {
            let bytes = d.Size?;
            Some(Drive {
                size_mb: bytes / BYTES_PER_MB,
                kind: drive_kind(d.BusType, d.MediaType),
                read_mbps: None,
            })
        })
        .collect();
    if !drives.is_empty() {
        payload.drives = drives;
    }
}

/// bustype 17 == nvme; otherwise fall back to mediatype (4 ssd, 3 hdd).
fn drive_kind(bus_type: Option<u16>, media_type: Option<u16>) -> DriveKind {
    if bus_type == Some(17) {
        return DriveKind::Nvme;
    }
    match media_type {
        Some(4) => DriveKind::Ssd,
        Some(3) => DriveKind::Hdd,
        _ => DriveKind::Unknown,
    }
}

#[derive(Deserialize)]
struct Win32_VideoController {
    Name: Option<String>,
    PNPDeviceID: Option<String>,
}

/// gpu identity + count come from real pci video controllers (this filters out
/// virtual-display drivers that mirror the real adapter). accurate vram comes
/// from dxgi, matched by pci vendor/device id.
fn fill_gpus(wmi: &WMIConnection, payload: &mut Payload) {
    let vram = dxgi_vram_by_pci();

    let Ok(controllers) = wmi.query::<Win32_VideoController>() else {
        return;
    };

    let gpus: Vec<Gpu> = controllers
        .into_iter()
        .filter_map(|c| {
            let pnp = c.PNPDeviceID?;
            let (ven, dev) = parse_pci_ids(&pnp)?; // also drops non-pci (virtual) devices
            let model = c.Name?.trim().to_string();
            Some(Gpu {
                vendor: infer_vendor(&model),
                model,
                vram_mb: vram.get(&(ven, dev)).copied(),
            })
        })
        .collect();

    if !gpus.is_empty() {
        payload.gpus = gpus;
    }
}

/// extract (vendor_id, device_id) from a "PCI\VEN_1002&DEV_747E&..." pnp id.
/// returns None for non-pci devices (e.g. ROOT\DISPLAY virtual monitors).
fn parse_pci_ids(pnp: &str) -> Option<(u32, u32)> {
    if !pnp.starts_with("PCI\\") {
        return None;
    }
    let hex_after = |key: &str| -> Option<u32> {
        let start = pnp.find(key)? + key.len();
        let chunk: String = pnp[start..].chars().take(4).collect();
        u32::from_str_radix(&chunk, 16).ok()
    };
    Some((hex_after("VEN_")?, hex_after("DEV_")?))
}

/// dedicated vram in mb keyed by (vendor_id, device_id), from dxgi.
fn dxgi_vram_by_pci() -> std::collections::HashMap<(u32, u32), u64> {
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE, IDXGIFactory1,
    };

    let mut map = std::collections::HashMap::new();
    unsafe {
        let Ok(factory) = CreateDXGIFactory1::<IDXGIFactory1>() else {
            return map;
        };
        let mut i = 0u32;
        while let Ok(adapter) = factory.EnumAdapters1(i) {
            i += 1;
            let Ok(desc) = adapter.GetDesc1() else {
                continue;
            };
            if desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32 != 0 {
                continue;
            }
            let dedicated = desc.DedicatedVideoMemory as u64;
            if dedicated == 0 {
                continue;
            }
            // keep the largest reading seen for a given pci id.
            let entry = map.entry((desc.VendorId, desc.DeviceId)).or_insert(0);
            *entry = (*entry).max(dedicated / BYTES_PER_MB);
        }
    }
    map
}
