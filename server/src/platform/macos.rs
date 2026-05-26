use block2::RcBlock;
use objc2_media_player::{
    MPRemoteCommandCenter, MPRemoteCommandHandlerStatus,
};
use tauri::{AppHandle, Emitter};

/// Registers `previousTrackCommand` and `nextTrackCommand` on the macOS
/// `MPRemoteCommandCenter` so that F7/F9 (and hardware media keys on supported
/// keyboards) emit `"media-prev-track"` / `"media-next-track"` Tauri events.
///
/// Must be called from the Tauri `setup` closure.  The global-shortcut plugin
/// does not reach these keys on macOS because they are routed through
/// `MPRemoteCommandCenter`, not the standard keyboard hook.
pub fn register_macos_media_keys(handle: AppHandle) {
    let center = unsafe { MPRemoteCommandCenter::sharedCommandCenter() };

    // --- previous track ---
    let prev_cmd = unsafe { center.previousTrackCommand() };
    unsafe { prev_cmd.setEnabled(true) };

    let prev_handle = handle.clone();
    let prev_block = RcBlock::new(move |_event| {
        let _ = prev_handle.emit("media-prev-track", ());
        MPRemoteCommandHandlerStatus::Success
    });
    // addTargetWithHandler: returns a registration token — dropping it removes the handler.
    // Leak intentionally so the handler lives for the app's lifetime.
    let prev_token = unsafe { prev_cmd.addTargetWithHandler(&prev_block) };
    Box::leak(Box::new(prev_token));

    // --- next track ---
    let next_cmd = unsafe { center.nextTrackCommand() };
    unsafe { next_cmd.setEnabled(true) };

    let next_block = RcBlock::new(move |_event| {
        let _ = handle.emit("media-next-track", ());
        MPRemoteCommandHandlerStatus::Success
    });
    let next_token = unsafe { next_cmd.addTargetWithHandler(&next_block) };
    Box::leak(Box::new(next_token));
}
