//! spec gathering. a sysinfo base, enriched by platform-specific fills.

mod common;
mod nvidia;
pub mod vendor;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(windows)]
mod windows;

use crate::payload::Payload;

pub fn collect() -> Payload {
    let mut payload = common::collect_base();

    #[cfg(windows)]
    windows::enrich(&mut payload);
    #[cfg(target_os = "linux")]
    linux::enrich(&mut payload);

    nvidia::fill_missing_vram(&mut payload.gpus);

    payload
}
