// no console window behind Sine on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Sine is the single-file offline page (tools/build-offline.js) in a window. Its only native call is
// the opener plugin, so reference links open in the default browser (capabilities/default.json).
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Sine");
}
