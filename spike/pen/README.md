# Pen spike

A throwaway Tauri app that answers one question: does pen pressure reach a Tauri window on macOS?

## Set up (once)

1. `xcode-select --install`
2. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`, then open a new Terminal window.
3. Node 20 or newer.

## Run

```sh
cd spike/pen
npm install
npm run dev
```

The first run compiles Rust and takes several minutes. Later runs start in seconds.

## Test

Draw in the window with each input you have, then press **Copy report**:

- trackpad or mouse (a Force Touch trackpad should show "Trackpad force" above 1 when you press hard)
- a drawing tablet (Wacom or similar)
- an iPad with Apple Pencil over Sidecar (System Settings > Displays > add the iPad, then drag this window onto it)

Paste the report back into the chat.
