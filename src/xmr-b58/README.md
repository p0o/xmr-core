# xmr-b58

xmr-b58 contains functions to encode and decode base58 strings for monero operations

## Features

---

-   Encoding hex strings to base58 strings
-   Decoding base58 strings to hex strings

## Usage

---

```ts
import { encode, decode } from "xmr-b58";
const hexStr = "0x....";
const b58Str = encode(hexStr);
```

## Installation

---

Install xmr-b58 by running:

```sh
yarn add xmr-b58
```

## License

---

The project is licensed under the MIT license.
