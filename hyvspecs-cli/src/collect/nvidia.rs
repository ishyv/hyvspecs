//! optional nvidia vram via nvml. works on windows + linux. any failure
//! (no driver, no card, library missing) is silently treated as "no data".

use std::collections::VecDeque;

use crate::payload::{Gpu, Vendor};

const BYTES_PER_MB: u64 = 1024 * 1024;

/// fill vram for nvidia gpus that lack it, and append any nvidia devices the
/// platform enumeration missed entirely.
pub fn fill_missing_vram(gpus: &mut Vec<Gpu>) {
    let mut queue: VecDeque<(String, u64)> = query().into();
    if queue.is_empty() {
        return;
    }

    let mut had_nvidia = false;
    for g in gpus.iter_mut() {
        if g.vendor == Vendor::Nvidia {
            had_nvidia = true;
            if g.vram_mb.is_none() {
                g.vram_mb = queue.pop_front().map(|(_, bytes)| bytes / BYTES_PER_MB);
            }
        }
    }

    if !had_nvidia {
        for (model, bytes) in queue {
            gpus.push(Gpu {
                vendor: Vendor::Nvidia,
                model,
                vram_mb: Some(bytes / BYTES_PER_MB),
            });
        }
    }
}

/// (name, total vram bytes) for each nvidia device, or empty on any error.
fn query() -> Vec<(String, u64)> {
    let Ok(nvml) = nvml_wrapper::Nvml::init() else {
        return Vec::new();
    };
    let Ok(count) = nvml.device_count() else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for i in 0..count {
        let Ok(device) = nvml.device_by_index(i) else {
            continue;
        };
        let name = device.name().unwrap_or_else(|_| "nvidia gpu".into());
        let vram = device.memory_info().map(|m| m.total).unwrap_or(0);
        out.push((name, vram));
    }
    out
}
