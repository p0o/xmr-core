# xmr-nettype-address-prefixes

Helper library to get Monero address prefixes depending on the network type (mainnet|testnet|stagenet)

## Features

---

-   Get address prefix for standard addresses
-   Get address prefix for integrated addresses
-   Get address prefix for subaddresses

## Usage

---

```ts
import { NetType } from "xmr-types";
import { cryptonoteBase58PrefixForStandardAddressOn } from "xmr-nettype-address-prefixes";

const standardAddressMainnetPrefix = cryptonoteBase58PrefixForStandardAddressOn(
	NetType.MAINNET,
);
```

## Installation

---

```sh
yarn add xmr-nettype-address-prefixes
```

## License

---

The project is licensed under the MIT license.
