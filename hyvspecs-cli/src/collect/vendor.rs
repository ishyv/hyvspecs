use crate::payload::Vendor;

/// infer a vendor from a cpu/gpu model string. lowercase substring match,
/// ordered so the more specific brands win.
pub fn infer_vendor(model: &str) -> Vendor {
    let m = model.to_ascii_lowercase();
    if m.contains("nvidia") || m.contains("geforce") || m.contains("quadro") || m.contains("tesla")
    {
        Vendor::Nvidia
    } else if m.contains("amd")
        || m.contains("radeon")
        || m.contains("ryzen")
        || m.contains("athlon")
        || m.contains("epyc")
    {
        Vendor::Amd
    } else if m.contains("intel")
        || m.contains("core(tm)")
        || m.contains("arc ")
        || m.contains("iris")
        || m.contains("xeon")
        || m.contains("celeron")
        || m.contains("pentium")
    {
        Vendor::Intel
    } else if m.contains("apple") || m.starts_with("apple m") {
        Vendor::Apple
    } else if m.contains("arm") || m.contains("snapdragon") || m.contains("cortex") {
        Vendor::Arm
    } else {
        Vendor::Other
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infers_common_brands() {
        assert_eq!(infer_vendor("AMD Ryzen 9 7950X"), Vendor::Amd);
        assert_eq!(
            infer_vendor("13th Gen Intel(R) Core(TM) i7-13700K"),
            Vendor::Intel
        );
        assert_eq!(infer_vendor("NVIDIA GeForce RTX 4090"), Vendor::Nvidia);
        assert_eq!(infer_vendor("Radeon RX 7900 XTX"), Vendor::Amd);
        assert_eq!(infer_vendor("Apple M3 Max"), Vendor::Apple);
        assert_eq!(infer_vendor("some mystery chip"), Vendor::Other);
    }
}
