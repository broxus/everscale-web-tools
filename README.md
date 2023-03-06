<p align="center">
  <a href="https://github.com/venom-blockchain/developer-program">
    <img src="https://raw.githubusercontent.com/venom-blockchain/developer-program/main/vf-dev-program.png" alt="Logo" width="366.8" height="146.4">
  </a>
</p>

# Everscale web tools

## Table of Contents

- [About](#about)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## About

Generic contracts UI and blockchain data visualizer.

[Everscale version](https://ever.bytie.moe) | [Venom version](https://tools.venom.rs)

* Executor - interact with contracts through the convinient UI.
* Visualizer - analyze cell tree structures.
* Serializer - pack method calls/arbitrary ABI into cell.
* Deserializer - unpack arbitrary ABI from cell.
* Signer - sign any data using your wallet.
* Debugger - view transaction execution step by step.
* Microwave - activate frozen accounts.
* TIP3 - manage token root contract.

## Usage

### Local Development

This website is built using `Vue` and `Rust`.

### Prerequisites

- Rust 1.61+ with installed target `wasm32-unknown-unknown`
- wasm-pack
- binaryen 99+ (for `wasm-opt`)
- Node.js 14+

### Installation

```bash
git clone https://github.com/broxus/everscale-web-tools.git
cd everscale-web-tools
npm install
npm run wasm
```

### Run

```
npm run dev
```

This command starts a local development server and opens up a browser window (http://localhost:3000).
Most changes are reflected live without having to restart the server.

### Build

```bash
npm run build
```

This command generates static content into the `dist` directory and can be served using any static contents hosting service.

## Contributing

We welcome contributions to the project! If you notice any issues or errors, feel free to open an issue or submit a pull request.

## License

Licensed under MIT license ([LICENSE](/LICENSE) or http://opensource.org/licenses/MIT).
