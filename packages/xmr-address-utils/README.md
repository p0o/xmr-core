# @xmr-core/xmr-address-utils

Utilities for working with Monero addresses

## Features

---

-   Checking for subaddresses
-   Creating addresses based on seeds
-   Creating integrated addresses from normal addresses and a payment id
-   Decoding address strings into their public key components

## Usage

```ts
import { decode_address } from "@xmr-core/xmr-address-utils";

const xmrAddress =
	"49qwWM9y7j1fvaBK684Y5sMbN8MZ3XwDLcSaqcKwjh5W9kn9qFigPBNBwzdq6TCAm2gKxQWrdZuEZQBMjQodi9cNRHuCbTr";

const { spend, view } = decode_address(xmrAddress);

// or use it to validate an address

try {
	decodeAddress("notAnAddress");
} catch {
	console.log("Invalid address entered");
}
```

## Installation

---

```sh
yarn add @xmr-core/xmr-address-utils
```

## License

---

The project is licensed under the MIT license.
