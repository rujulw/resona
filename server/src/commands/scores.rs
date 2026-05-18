use crate::scores::{extract_score_from_path, ScoreDetailPayload};

#[tauri::command]
pub fn extract_score(source_path: String) -> Result<ScoreDetailPayload, String> {
    extract_score_from_path(&source_path).map_err(|error| error.to_string())
}
