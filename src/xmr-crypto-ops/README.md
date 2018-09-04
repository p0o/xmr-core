# xmr-crypto-ops

Core crypto operations for Monero

## Features

---

-   Key image generation
-   RCT operations such as Pedersen commitments, ECDH encode/decode
-   Hash operations such as `hash_to_scalar`, `hash_to_ec`
-   Derivation operations such as generating key derivations, deriving private and public keys
-   Primitive functions for curve and scalar functions

## Usage

---

```ts
import { generate_key_image } from "xmr-crypto-ops";
const secretKey = "...";
const publicKey = "...";
const keyImage = generate_key_image(publicKey, secretKey);
```

## Installation

---

Install xmr-crypto-ops by running:

```sh
yarn add xmr-crypto-ops
```

## License

---

The project is licensed under the MIT license.
