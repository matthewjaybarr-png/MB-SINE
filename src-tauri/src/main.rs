// no console window behind Sine on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Sine is the single-file offline page (tools/build-offline.js) in a window; no native commands.
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Sine");
}
