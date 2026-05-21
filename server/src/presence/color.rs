use image::GenericImageView;
use std::path::Path;

const SLOT_COUNT: u32 = 24;
const SLOT_DEGREES: f32 = 360.0 / SLOT_COUNT as f32; // 15°
const MIN_SATURATION: f32 = 0.25;
const MIN_LIGHTNESS: f32 = 0.15;
const MAX_LIGHTNESS: f32 = 0.85;
const MIN_QUALIFYING_PIXELS: u32 = 20;
const SAMPLE_STRIDE: u32 = 8;

/// Returns a slot index 0–23 (hue 0°, 15°, 30°, … 345°) based on the dominant
/// hue in the image at `artwork_path`, or `None` if the image has no sufficiently
/// saturated pixels (→ caller uses `vinyl_default`).
pub fn dominant_hue_slot(artwork_path: &Path) -> Option<u8> {
    let img = image::open(artwork_path).ok()?;
    let (width, height) = img.dimensions();

    let mut buckets = [0u32; SLOT_COUNT as usize];
    let mut qualifying = 0u32;

    let mut y = 0;
    while y < height {
        let mut x = 0;
        while x < width {
            let px = img.get_pixel(x, y);
            let [r, g, b, _a] = px.0;
            let (h, s, l) = rgb_to_hsl(r, g, b);

            if s >= MIN_SATURATION && l >= MIN_LIGHTNESS && l <= MAX_LIGHTNESS {
                let slot = (h / SLOT_DEGREES).floor() as usize;
                let slot = slot.min(SLOT_COUNT as usize - 1);
                buckets[slot] += 1;
                qualifying += 1;
            }

            x += SAMPLE_STRIDE;
        }
        y += SAMPLE_STRIDE;
    }

    if qualifying < MIN_QUALIFYING_PIXELS {
        return None;
    }

    let best_slot = buckets
        .iter()
        .enumerate()
        .max_by_key(|(_, count)| *count)
        .map(|(i, _)| i)?;

    Some(best_slot as u8)
}

/// Maps slot 0–23 to the Discord asset key (e.g. slot 3 → "vinyl_h045").
pub fn slot_to_asset_key(slot: u8) -> String {
    let hue = slot as u32 * SLOT_DEGREES as u32;
    format!("vinyl_h{hue:03}")
}

fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let r = r as f32 / 255.0;
    let g = g as f32 / 255.0;
    let b = b as f32 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;

    let l = (max + min) / 2.0;

    let s = if delta == 0.0 {
        0.0
    } else {
        delta / (1.0 - (2.0 * l - 1.0).abs())
    };

    let h = if delta == 0.0 {
        0.0
    } else if max == r {
        60.0 * (((g - b) / delta) % 6.0)
    } else if max == g {
        60.0 * ((b - r) / delta + 2.0)
    } else {
        60.0 * ((r - g) / delta + 4.0)
    };

    let h = if h < 0.0 { h + 360.0 } else { h };

    (h, s, l)
}

#[cfg(test)]
mod tests {
    use super::{dominant_hue_slot, rgb_to_hsl, slot_to_asset_key, MIN_QUALIFYING_PIXELS};

    #[test]
    fn slot_to_asset_key_formats_correctly() {
        assert_eq!(slot_to_asset_key(0), "vinyl_h000");
        assert_eq!(slot_to_asset_key(1), "vinyl_h015");
        assert_eq!(slot_to_asset_key(3), "vinyl_h045");
        assert_eq!(slot_to_asset_key(23), "vinyl_h345");
    }

    #[test]
    fn rgb_to_hsl_pure_red() {
        let (h, s, l) = rgb_to_hsl(255, 0, 0);
        assert!((h - 0.0).abs() < 1.0);
        assert!(s > 0.99);
        assert!((l - 0.5).abs() < 0.01);
    }

    #[test]
    fn rgb_to_hsl_pure_green() {
        let (h, s, l) = rgb_to_hsl(0, 255, 0);
        assert!((h - 120.0).abs() < 1.0);
        assert!(s > 0.99);
    }

    #[test]
    fn rgb_to_hsl_pure_blue() {
        let (h, s, l) = rgb_to_hsl(0, 0, 255);
        assert!((h - 240.0).abs() < 1.0);
        assert!(s > 0.99);
    }

    #[test]
    fn rgb_to_hsl_grey_has_zero_saturation() {
        let (_, s, _) = rgb_to_hsl(128, 128, 128);
        assert_eq!(s, 0.0);
    }

    #[test]
    fn rgb_to_hsl_hue_wraps_at_360() {
        // Near-red from the negative side (magenta → red)
        let (h, _, _) = rgb_to_hsl(255, 0, 10);
        assert!(h >= 0.0 && h < 360.0, "hue {h} out of range");
    }

    #[test]
    fn dominant_hue_slot_returns_none_for_nonexistent_file() {
        let result = dominant_hue_slot(std::path::Path::new("/nonexistent/artwork.jpg"));
        assert!(result.is_none());
    }
}
