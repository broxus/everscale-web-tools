## Everscale web tools

### Requirements

- Rust 1.61+ with installed target `wasm32-unknown-unknown`
- wasm-pack
- binaryen 99+ (for `wasm-opt`)
- Node.js 14+

### How to build

```bash
git clone https://github.com/broxus/everscale-web-tools.git
cd everscale-web-tools
npm install
npm run wasm
npm run build

# Or you can run this. It runs the app in the development mode.
# Open http://localhost:3000 to view it in the browser.
npm run dev
```
