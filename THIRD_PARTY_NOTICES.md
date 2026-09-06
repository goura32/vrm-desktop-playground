# Third-party notices

The versions below are the lockfile-resolved direct dependencies at the PoC commit. Complete license texts for npm dependencies are available in `node_modules/<package>/LICENSE*` after `npm ci`; transitive dependency license metadata is retained in `package-lock.json`.

| Package | Version | License | License / project URL |
|---|---:|---|---|
| Electron | 44.2.0 | MIT | https://github.com/electron/electron/blob/main/LICENSE |
| React / React DOM | 19.2.8 | MIT | https://github.com/facebook/react/blob/main/LICENSE |
| Three.js | 0.180.0 | MIT | https://github.com/mrdoob/three.js/blob/dev/LICENSE |
| `@pixiv/three-vrm` | 3.5.5 | MIT | https://github.com/pixiv/three-vrm/blob/dev/LICENSE |
| `@pixiv/three-vrm-animation` | 3.5.5 | MIT | https://github.com/pixiv/three-vrm/blob/dev/LICENSE |
| Vite | 6.4.3 | MIT | https://github.com/vitejs/vite/blob/main/LICENSE.md |
| Vitest | 3.2.7 | MIT | https://github.com/vitest-dev/vitest/blob/main/LICENSE.md |
| TypeScript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt |
| esbuild | 0.25.12 | MIT | https://github.com/evanw/esbuild/blob/main/LICENSE.md |
| ESLint | 9.39.5 | MIT | https://github.com/eslint/eslint/blob/main/LICENSE |

Bundled VRM/VRMA sample files are tracked separately in [`assets/manifest.json`](assets/manifest.json), which records source URLs, checksums, license review, redistribution status, and credit requirements.

The committed `Relax.vrma`, `Goodbye.vrma`, and `Jump.vrma` files are from [tk256ailab/vrm-viewer](https://github.com/tk256ailab/vrm-viewer), revision `0cd2267f36939da589afc8eac449b5b9ccce4c01`. The repository is MIT-licensed; credit TK256 and the source repository when redistributing these motion files. See the per-file SHA-256 and license evidence in `assets/manifest.json`.