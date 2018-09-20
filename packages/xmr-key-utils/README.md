# @xmr-core/xmr-key-utils

A collection of functions for creating and verifying Monero related public/private keys.

## Features

---

-   Converting private keys to public keys
-   Generating new keypairs
-   Verifying keypairs

## Usage

---

```ts
import { random_keypair, verify_keys } from "@xmr-core/xmr-key-utils";
const viewKeys = random_keypair();
const spendKeys = random_keypair();
const isValidKeypairs = verify_keys(
	viewKeys.pub,
	viewKeys.sec,
	spendKeys.pub,
	spendKeys.sec,
);
```

## Installation

```sh
yarn add @xmr-core/xmr-key-utils
```

## License

---

The project is licensed under the MIT license.
