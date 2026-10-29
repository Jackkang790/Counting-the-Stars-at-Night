# Image tracking runtime

MindAR 1.2.5, MIT, copyright 2020 hiukim. Original package:
https://registry.npmjs.org/mind-ar/-/mind-ar-1.2.5.tgz

Only `mindar-image.prod.js`, `controller-mGt1s8dJ.js`, and `ui-fBadYuor.js` are used. The Three.js/A-Frame/face-tracking adapters are not shipped. Existing Three.js 0.169.0 is retained; there is no second Three.js runtime and no package or lockfile change.

`LICENSE.mind-ar` contains the MIT license. The controller bundle retains upstream TensorFlow.js and other embedded copyright/license notices. TensorFlow.js is Apache-2.0; the Apache license accompanies this directory in `LICENSE.apache-2.0`. No performer footage is included in this dependency.

Local modifications to the controller distribution:

- The unused Node-specific `importFetch` hook returns `globalThis.fetch`, avoiding Vite resolving `node-fetch` in this browser-only build.
- The target compiler terminates its worker when compilation completes.

Image tracking estimates the planar target pose. It is not persistent markerless SLAM. Camera and GPU capability must be tested on the actual target iPhone and Android versions. All runtime chunks are bundled locally; the app does not fetch tracking code from a CDN at runtime.
