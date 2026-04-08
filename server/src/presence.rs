use crate::playback::PlaybackSnapshot;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

static GLOBAL_PRESENCE_STATE: OnceLock<PresenceRuntimeState> = OnceLock::new();

const DISCORD_CLIENT_ID_ENV: &str = "RESONA_DISCORD_CLIENT_ID";

#[derive(Clone)]
pub struct PresenceRuntimeState {
    inner: Arc<Mutex<PresenceRuntime>>,
}

struct PresenceRuntime {
    last_published_key: Option<PresenceKey>,
    driver: Box<dyn PresenceDriver + Send>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct PresenceKey {
    track_id: Option<String>,
    title: Option<String>,
    artist: String,
    is_playing: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct PresencePayload {
    key: PresenceKey,
    details: String,
    state: String,
    start_timestamp: i64,
}

trait PresenceDriver {
    fn connect_if_needed(&mut self) -> Result<(), String>;
    fn set_playing(&mut self, payload: &PresencePayload) -> Result<(), String>;
    fn clear(&mut self) -> Result<(), String>;
}

struct DiscordPresenceDriver {
    client: DiscordIpcClient,
    connected: bool,
}

impl DiscordPresenceDriver {
    fn new(client_id: &str) -> Self {
        Self {
            client: DiscordIpcClient::new(client_id),
            connected: false,
        }
    }
}

impl PresenceDriver for DiscordPresenceDriver {
    fn connect_if_needed(&mut self) -> Result<(), String> {
        if !self.connected {
            self.client.connect().map_err(|error| error.to_string())?;
            self.connected = true;
        }

        Ok(())
    }

    fn set_playing(&mut self, payload: &PresencePayload) -> Result<(), String> {
        let activity = activity::Activity::new()
            .activity_type(activity::ActivityType::Listening)
            .details(payload.details.as_str())
            .state(payload.state.as_str())
            .status_display_type(activity::StatusDisplayType::State)
            .timestamps(activity::Timestamps::new().start(payload.start_timestamp));

        self.client
            .set_activity(activity)
            .map_err(|error| error.to_string())
    }

    fn clear(&mut self) -> Result<(), String> {
        self.client.clear_activity().map_err(|error| error.to_string())
    }
}

struct NoopPresenceDriver;

impl PresenceDriver for NoopPresenceDriver {
    fn connect_if_needed(&mut self) -> Result<(), String> {
        Ok(())
    }

    fn set_playing(&mut self, _payload: &PresencePayload) -> Result<(), String> {
        Ok(())
    }

    fn clear(&mut self) -> Result<(), String> {
        Ok(())
    }
}

impl Default for PresenceRuntimeState {
    fn default() -> Self {
        let driver: Box<dyn PresenceDriver + Send> = match load_discord_client_id() {
            Some(client_id) => Box::new(DiscordPresenceDriver::new(client_id.as_str())),
            None => Box::new(NoopPresenceDriver),
        };

        Self {
            inner: Arc::new(Mutex::new(PresenceRuntime {
                last_published_key: None,
                driver,
            })),
        }
    }
}

pub fn register_global_presence(state: PresenceRuntimeState) {
    let _ = GLOBAL_PRESENCE_STATE.set(state);
}

pub fn sync_presence_with_snapshot(snapshot: &PlaybackSnapshot) {
    let Some(state) = GLOBAL_PRESENCE_STATE.get() else {
        return;
    };

    state.sync_snapshot(snapshot);
}

impl PresenceRuntimeState {
    fn sync_snapshot(&self, snapshot: &PlaybackSnapshot) {
        let mut runtime = self
            .inner
            .lock()
            .expect("presence runtime lock should not be poisoned");
        let desired_payload = PresencePayload::from_snapshot(snapshot);
        let desired_key = desired_payload.as_ref().map(|payload| payload.key.clone());

        if runtime.last_published_key == desired_key {
            return;
        }

        let result = match desired_payload.as_ref() {
            Some(payload) => runtime
                .driver
                .connect_if_needed()
                .and_then(|()| runtime.driver.set_playing(payload)),
            None if runtime.last_published_key.is_some() => runtime
                .driver
                .connect_if_needed()
                .and_then(|()| runtime.driver.clear()),
            None => Ok(()),
        };

        if result.is_ok() {
            runtime.last_published_key = desired_key;
        }
    }
}

impl PresencePayload {
    fn from_snapshot(snapshot: &PlaybackSnapshot) -> Option<Self> {
        if !snapshot.is_playing {
            return None;
        }

        let artist = snapshot
            .track_artist
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())?;

        let started_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0)
            .saturating_sub(snapshot.progress_seconds as i64);

        Some(Self {
            key: PresenceKey {
                track_id: snapshot.track_id.clone(),
                title: snapshot.track_title.clone(),
                artist: artist.to_owned(),
                is_playing: snapshot.is_playing,
            },
            details: snapshot
                .track_title
                .clone()
                .unwrap_or_else(|| "Unknown Track".to_owned()),
            state: format!("{artist}"),
            start_timestamp: started_at,
        })
    }
}

fn load_discord_client_id() -> Option<String> {
    std::env::var(DISCORD_CLIENT_ID_ENV)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .or_else(read_discord_client_id_from_dotenv)
}

fn read_discord_client_id_from_dotenv() -> Option<String> {
    for dotenv_path in candidate_dotenv_paths() {
        let Ok(contents) = fs::read_to_string(&dotenv_path) else {
            continue;
        };

        for line in contents.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let Some((key, value)) = trimmed.split_once('=') else {
                continue;
            };
            if key.trim() != DISCORD_CLIENT_ID_ENV {
                continue;
            }

            let value = value.trim().trim_matches('"').trim_matches('\'').to_owned();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }

    None
}

fn candidate_dotenv_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(current_dir) = std::env::current_dir() {
        push_if_missing(&mut paths, current_dir.join(".env"));
        if let Some(parent) = current_dir.parent() {
            push_if_missing(&mut paths, parent.join(".env"));
        }
    }
    push_if_missing(&mut paths, PathBuf::from(".env"));
    paths
}

fn push_if_missing(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !paths.iter().any(|existing| same_path(existing, &path)) {
        paths.push(path);
    }
}

fn same_path(left: &Path, right: &Path) -> bool {
    left == right
}

#[cfg(test)]
mod tests {
    use super::{
        candidate_dotenv_paths, read_discord_client_id_from_dotenv, PresenceDriver, PresencePayload,
        PresenceRuntime, PresenceRuntimeState,
    };
    use crate::playback::PlaybackSnapshot;
    use std::fs;
    use std::sync::{Arc, Mutex};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Default)]
    struct RecordedDriver {
        actions: Arc<Mutex<Vec<String>>>,
    }

    impl PresenceDriver for RecordedDriver {
        fn connect_if_needed(&mut self) -> Result<(), String> {
            self.actions
                .lock()
                .expect("actions lock should not be poisoned")
                .push("connect".to_owned());
            Ok(())
        }

        fn set_playing(&mut self, payload: &PresencePayload) -> Result<(), String> {
            self.actions
                .lock()
                .expect("actions lock should not be poisoned")
                .push(format!(
                    "set:{}|{}|{}",
                    payload.details, payload.state, payload.start_timestamp
                ));
            Ok(())
        }

        fn clear(&mut self) -> Result<(), String> {
            self.actions
                .lock()
                .expect("actions lock should not be poisoned")
                .push("clear".to_owned());
            Ok(())
        }
    }

    fn snapshot_with_artist(
        track_id: &str,
        track_title: &str,
        is_playing: bool,
        artist: Option<&str>,
    ) -> PlaybackSnapshot {
        PlaybackSnapshot {
            status_label: if is_playing {
                "Playing".to_owned()
            } else {
                "Paused".to_owned()
            },
            transport_label: if is_playing {
                "Playing".to_owned()
            } else {
                "Paused".to_owned()
            },
            output_owner: "rust".to_owned(),
            progress_seconds: 12,
            duration_seconds: 182,
            is_playing,
            track_id: Some(track_id.to_owned()),
            track_title: Some(track_title.to_owned()),
            track_artist: artist.map(str::to_owned),
            track_album: Some("Signals".to_owned()),
            track_advisory: None,
        }
    }

    fn test_runtime_state(actions: Arc<Mutex<Vec<String>>>) -> PresenceRuntimeState {
        PresenceRuntimeState {
            inner: Arc::new(Mutex::new(PresenceRuntime {
                last_published_key: None,
                driver: Box::new(RecordedDriver { actions }),
            })),
        }
    }

    #[test]
    fn builds_presence_payload_only_for_active_playback_with_artist_metadata() {
        let active = PresencePayload::from_snapshot(&snapshot_with_artist(
            "track-1",
            "Alpha",
            true,
            Some("North"),
        ))
        .expect("playing snapshot with artist should publish presence");

        assert_eq!(active.details, "Alpha");
        assert_eq!(active.state, "North");
        assert!(active.start_timestamp > 0);

        assert!(
            PresencePayload::from_snapshot(&snapshot_with_artist(
                "track-1",
                "Alpha",
                false,
                Some("North"),
            ))
            .is_none()
        );
        assert!(
            PresencePayload::from_snapshot(&snapshot_with_artist("track-1", "Alpha", true, None))
                .is_none()
        );
        assert!(
            PresencePayload::from_snapshot(&snapshot_with_artist(
                "track-1",
                "Alpha",
                true,
                Some("   "),
            ))
            .is_none()
        );
    }

    #[test]
    fn smoke_covers_privacy_safe_presence_updates_during_playback() {
        let actions = Arc::new(Mutex::new(Vec::new()));
        let runtime = test_runtime_state(Arc::clone(&actions));

        runtime.sync_snapshot(&snapshot_with_artist("track-1", "Alpha", true, Some("North")));

        let actions = actions.lock().expect("actions lock should not be poisoned");
        assert_eq!(actions.len(), 2);
        assert_eq!(actions[0], "connect");
        assert!(actions[1].starts_with("set:Alpha|North|"));
        assert!(!actions[1].contains("Signals"));
    }

    #[test]
    fn clears_presence_when_playback_stops_and_deduplicates_repeated_updates() {
        let actions = Arc::new(Mutex::new(Vec::new()));
        let runtime = test_runtime_state(Arc::clone(&actions));

        runtime.sync_snapshot(&snapshot_with_artist("track-1", "Alpha", true, Some("North")));
        runtime.sync_snapshot(&snapshot_with_artist("track-1", "Alpha", true, Some("North")));
        runtime.sync_snapshot(&snapshot_with_artist("track-1", "Alpha", false, Some("North")));

        let actions = actions.lock().expect("actions lock should not be poisoned");
        assert_eq!(actions.len(), 4);
        assert_eq!(actions[0], "connect");
        assert!(actions[1].starts_with("set:Alpha|North|"));
        assert_eq!(actions[2], "connect");
        assert_eq!(actions[3], "clear");
    }

    #[test]
    fn republishes_when_track_changes_even_if_artist_matches() {
        let actions = Arc::new(Mutex::new(Vec::new()));
        let runtime = test_runtime_state(Arc::clone(&actions));

        runtime.sync_snapshot(&snapshot_with_artist("track-1", "Alpha", true, Some("North")));
        runtime.sync_snapshot(&snapshot_with_artist("track-2", "Beta", true, Some("North")));

        let actions = actions.lock().expect("actions lock should not be poisoned");
        assert_eq!(actions.len(), 4);
        assert_eq!(actions[0], "connect");
        assert!(actions[1].starts_with("set:Alpha|North|"));
        assert_eq!(actions[2], "connect");
        assert!(actions[3].starts_with("set:Beta|North|"));
    }

    #[test]
    fn dotenv_candidates_include_current_and_parent_directory() {
        let candidates = candidate_dotenv_paths();
        assert!(!candidates.is_empty());
        assert!(candidates.iter().any(|path| path.ends_with(".env")));
    }

    #[test]
    fn reads_client_id_from_repo_local_dotenv_when_env_var_is_absent() {
        std::env::remove_var("RESONA_DISCORD_CLIENT_ID");
        let original_dir = std::env::current_dir().expect("current dir should resolve");
        let temp_dir = std::env::temp_dir().join(format!(
            "resona-presence-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("current time should be after unix epoch")
                .as_nanos()
        ));
        let nested_dir = temp_dir.join("server");
        fs::create_dir_all(&nested_dir).expect("temp test directories should be created");
        fs::write(
            temp_dir.join(".env"),
            "RESONA_DISCORD_CLIENT_ID=test-client-id\n",
        )
        .expect("temp dotenv should be written");

        std::env::set_current_dir(&nested_dir).expect("should enter temp server dir");
        let value = read_discord_client_id_from_dotenv();
        std::env::set_current_dir(&original_dir).expect("should restore original current dir");
        fs::remove_dir_all(&temp_dir).expect("temp test directories should be removed");

        assert_eq!(value.as_deref(), Some("test-client-id"));
    }
}
