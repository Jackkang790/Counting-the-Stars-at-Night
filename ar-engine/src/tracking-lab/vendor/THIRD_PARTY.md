# Image tracking lab vendor provenance

The NFT worker is the **unchanged worker source string** extracted from the
official AR.js 3.4.8 Three.js distribution. It is a replaceable, separate worker,
not a reimplementation of NFT and not a modified existing AR engine.

- AR.js commit: `147ccd4170bb153f64d7fd9858eaff1d3294990c`
- Distribution/source: https://github.com/AR-js-org/AR.js/tree/147ccd4170bb153f64d7fd9858eaff1d3294990c
- Bundle: https://raw.githubusercontent.com/AR-js-org/AR.js/147ccd4170bb153f64d7fd9858eaff1d3294990c/three.js/build/ar-threex.mjs
- Bundle SHA256: `6c9aa037be052f9741defe725bc3d22b01c8ba09500a41796a11f6417eb6fd34`
- Worker SHA256: `be534a96259992be8dc0b9338e396780bb53ea82dc3b9145395e0f6e0c628b57`
- Extract using `ar-engine/tools/extract-arjs-worker.mjs`; no library logic edits.
- MIT notice: `LICENSE.AR-js`.
- Embedded ARToolKit dependency: `@ar-js-org/artoolkit5-js` 0.3.2, LGPL-3.0, gitHead `ad058766e9c9880cfadd1381f74ec1c5eaa46679`.
- Corresponding source and build instructions: https://github.com/andypotato/artoolkit5-js/tree/ad058766e9c9880cfadd1381f74ec1c5eaa46679 (including its ARToolKit submodule/build instructions).
- ARToolKit notices/terms retained in `LICENSE.ARToolkit`.
- Camera calibration: unmodified `data/data/camera_para.dat` at the AR.js commit above. This is generic calibration, **not measured calibration for every phone lens**.

Offline NFT descriptors use the official NFT-Marker-Creator WASM at commit
`9a09b213d063123fa87f95e815cb2c099e4ab2c1`:
https://github.com/AR-js-org/NFT-Marker-Creator/tree/9a09b213d063123fa87f95e815cb2c099e4ab2c1
The creator's package declares MIT. Its tool binaries are downloaded separately
for offline use, not included in the viewer. The wrapper reads packed RGB data
directly, avoiding the upstream sample app's JPEG metadata prompts and PNG channel
conversion. No remote image upload occurs.

MindAR 1.2.5 and TensorFlow.js use the existing locally vendored distributions and
notices in `src/musical/vendor/`. No CDN runtime dependency was added.
The performer is the same CC0-derived GLB already used by the quartet; refer to
`musical-assets/quartet/CREDITS.md`. The image is derived from the user's first
room photograph, using the existing rectified facade; neither source is an
automatically reconstructed/measured building.
