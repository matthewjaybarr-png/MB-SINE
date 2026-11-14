// no console window behind Sine on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Sine is the single-file offline page (tools/build-offline.js) in a window. Native calls: the opener
// plugin, so reference links open in the default browser (capabilities/default.json), and
// frame_colors, so the title bar and window border follow the theme picked in Sine.

// "#rrggbb" to a Windows COLORREF (0x00bbggrr).
#[cfg(windows)]
fn colorref(hex: &str) -> Option<u32> {
    let v = u32::from_str_radix(hex.strip_prefix('#')?, 16).ok()?;
    Some(((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff))
}

// The same DWM attributes Orbit's window_theme.rs sets: dark mode (20), border (34), caption (35), caption text (36).
// Windows 10 knows only dark mode; the colour calls fail there and the frame stays light or dark.
#[tauri::command]
fn frame_colors(window: tauri::WebviewWindow, dark: bool, caption: String, text: String, border: String) {
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
        let set = |attribute: u32, value: u32| unsafe {
            DwmSetWindowAttribute(hwnd.0 as _, attribute, &value as *const u32 as _, 4);
        };
        set(20, dark as u32);
        for (attribute, hex) in [(34, &border), (35, &caption), (36, &text)] {
            if let Some(color) = colorref(hex) {
                set(attribute, color);
            }
        }
    }
    #[cfg(not(windows))]
    let _ = (window, dark, caption, text, border);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![frame_colors])
        .run(tauri::generate_context!())
        .expect("error while running Sine");
}
