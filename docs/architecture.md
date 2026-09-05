# Architecture

## Process and window split

- `src/main/main.ts` is the Electron main process. It creates the two `BrowserWindow` instances, applies native window settings, owns file dialogs, validates file payload size, routes typed IPC, and logs avatar status/command routing.
- `src/renderer/avatar/` is the only renderer that owns Three.js, VRM, VRMA, expression, LookAt, and animation runtime objects. `AvatarRuntime` reports serializable status back through the preload bridge.
- `src/renderer/debug/` is a React control panel. It contains standard `button`, `input`, `select`, `checkbox`, and range controls so the principal path works with Tab, Shift+Tab, Enter, and Space. It never imports Three.js or VRM packages.
- `src/shared/` contains the typed IPC contract, serializable status types, window-state rules, and the bundled-asset allowlist.

## Electron security boundary

Both windows use the same bundled preload with:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` at the BrowserWindow level
- a narrow `contextBridge.exposeInMainWorld('vrmDesktop', api)` API

The renderer does not access Node.js or Electron modules directly. User-selected files are transferred as bounded `ArrayBuffer` payloads to the avatar renderer; bundled files are resolved only from the fixed `BUNDLED_ASSETS` map.

The main process applies runtime guards to renderer-supplied file payloads, avatar commands, avatar status, coordinates, and movement directions. IPC handlers also verify the expected `event.sender` (`Debug` for controls and `Avatar` for status), so TypeScript types are not the only protection at the boundary. Navigation and redirects are limited to the bundled `dist` pages or the local Vite origin, all `window.open` requests are denied, and both HTML entry points carry a restrictive CSP.

## Linux window policy

The Linux entry path always appends `--ozone-platform=x11`. On the target Ubuntu GNOME Wayland session this selects the Xwayland backend, which is the PoC's supported path for transparent, frameless, always-on-top windows. Native Wayland is intentionally not the acceptance target because transparent/frameless window behavior is platform- and compositor-dependent.

The Avatar Window is created from `screen.getPrimaryDisplay().bounds`, transparent, frameless, non-movable, non-resizable, fullscreen, always-on-top by default, and skipped from the taskbar. Fullscreen is required on GNOME/Xwayland: a normal transparent BrowserWindow was constrained by the window manager to the `workArea` even when `setBounds(display.bounds)` was requested. The main process explicitly enters fullscreen at creation and re-applies both the display bounds and fullscreen state on `display-metrics-changed`, `display-added`, and `display-removed`. It always calls `setIgnoreMouseEvents(true, { forward: true })`; there is no Interaction Mode or BrowserWindow movement control.

The character position is separate from the native window. `SceneController` stores a normalized screen-space coordinate (top-left `0,0`, bottom-right `1,1`) and projects the VRM scene root to that screen coordinate with the Three.js camera. The Y coordinate is a feet anchor, using the model's local feet point derived from the world-space bounds after root normalization, so moving the character vertically does not change the intended foot placement semantics across models. Before projection, the requested target is clamped against the projected model bounds with a small edge margin; this keeps the model at least partially visible and prevents edge positions from making it completely inaccessible. `AvatarRuntime` exposes position commands through the existing validated avatar-command IPC, and the Debug Window sends keyboard-accessible X/Y and directional controls. The position is preserved when the model is replaced and when the overlay is resized.

## VRM runtime

`VrmLoader` registers `VRMLoaderPlugin` and `VRMAnimationLoaderPlugin` with `GLTFLoader`. `SceneController` owns the alpha WebGL renderer, camera, lights, resize observer, render loop, and model scene attachment. `AvatarRuntime` composes:

- `ExpressionController`: preset/custom expression discovery, clamped weights, reset, mouth presets, manual blink, and auto blink.
- `LookAtController`: a scene target driven by normalized pointer coordinates and VRM LookAt enable/disable state.
- `MotionController`: VRMA-to-`AnimationClip` conversion via `createVRMAnimationClip`, AnimationMixer play/pause/stop, repeat/once loop, speed clamping, and motion switching. `AvatarRuntime` publishes a terminal one-shot transition only while the model/motion load generation and controller identity are current, so the Debug Window does not remain stuck at `playing` after a non-looping clip finishes or get overwritten by a stale load.

Missing optional VRM capabilities are represented as `unsupported` in the Debug Window rather than throwing. A failed VRM/VRMA load is converted to a status message and does not terminate the app. Stale asynchronous loads are discarded, and replaced VRM scenes are deep-disposed.

## Asset and license boundary

`assets/manifest.json` records source URL, download URL where applicable, author, license, redistribution decision, credit requirement, checksum, and blocked candidates. Only obtained, license-reviewed public samples are committed. VRoid Hub and BOOTH candidates that require current terms, login, consent, or purchase checks remain `BLOCKED_ASSET` with no file path or checksum.

See [`../assets/README.md`](../assets/README.md) and [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
