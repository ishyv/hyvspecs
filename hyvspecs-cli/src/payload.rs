//! the `v:1` spec payload. this is the contract with the web app
//! (see hyv-specs/docs/ARCHITECTURE.md). it carries no auto-collected identity.

use serde::Serialize;

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Serialize)]
pub struct Payload {
    pub v: u32,
    pub machine: Machine,
    pub cpu: Cpu,
    pub gpus: Vec<Gpu>,
    pub ram: Ram,
    pub drives: Vec<Drive>,
}

impl Payload {
    pub fn new(machine: Machine, cpu: Cpu, gpus: Vec<Gpu>, ram: Ram, drives: Vec<Drive>) -> Self {
        Self {
            v: SCHEMA_VERSION,
            machine,
            cpu,
            gpus,
            ram,
            drives,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Machine {
    /// os family + version, e.g. "windows 11". no build number, no hostname.
    pub os: String,
    /// optional user-chosen nickname. never auto-filled.
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Cpu {
    pub model: String,
    pub vendor: Vendor,
    pub cores_physical: Option<u32>,
    pub cores_logical: u32,
    /// nominal/max clock in mhz. null when unreadable.
    pub clock_max_mhz: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct Gpu {
    pub model: String,
    pub vendor: Vendor,
    pub vram_mb: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct Ram {
    pub total_mb: u64,
    /// per-module detail. empty when unavailable (e.g. linux without root).
    pub modules: Vec<RamModule>,
}

#[derive(Debug, Serialize)]
pub struct RamModule {
    pub size_mb: u64,
    pub speed_mhz: Option<u32>,
    /// e.g. "ddr5". null when unknown.
    pub kind: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Drive {
    pub size_mb: u64,
    pub kind: DriveKind,
    /// read speed is never benchmarked in v1.
    pub read_mbps: Option<u32>,
}

/// vendor is for iconography/labeling only. card color is driven by
/// performance/magnitude, not brand.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Vendor {
    Amd,
    Intel,
    Nvidia,
    Apple,
    Arm,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DriveKind {
    Nvme,
    Ssd,
    Hdd,
    Unknown,
}
