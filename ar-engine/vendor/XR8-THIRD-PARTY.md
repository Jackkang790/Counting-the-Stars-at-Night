# XR Engine distribution

`xr8/` contains the unmodified `dist/` directory from `@8thwall/engine-binary@1.0.0`.

- Source: https://registry.npmjs.org/@8thwall/engine-binary/-/engine-binary-1.0.0.tgz
- npm integrity: `sha512-qH0WH7+HHQFtwzKL+TDEg8RT+RadC2eR3c2v+GcJW3Z+7ZedJYadHmA0lZcOXwntBbcQZkeKkj1HYuUKcZanrA==`
- License and copyright: [xr8/LICENSE](./xr8/LICENSE). This is the distributed SLAM binary, not the MIT engine framework.
- Official integration: https://8thwall.org/docs/engine/overview

Run `node scripts/stage-web-slam.mjs` from `ar-engine` before development/build. This copies the vendor files into ignored `.assets/xr8` and emits SHA-256 metadata. The files are served unchanged rather than processed by Vite. The user-facing developer credits link to the same license. Keep the vendor directory tracked; only its staged copy and generated site builds are ignored.
