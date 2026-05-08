mod queries;
mod store;

pub use store::ArtistStore;

pub(crate) fn build_artist_image_map(dir: &std::path::Path) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let Ok(entries) = std::fs::read_dir(dir) else { return map; };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() { continue; }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp") { continue; }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else { continue; };
        map.insert(stem.to_lowercase(), path.to_string_lossy().into_owned());
    }
    map
}
