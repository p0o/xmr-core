# xmr-device

Implementations and interfaces of various hardware devices for creating Monero transactions securely

## Features

---

-   Ledger Nano S implementation under `device-ledger`
-   "Default" device implementation for unified api usage for private keys
-   Device interface to conform to for future hardware device implementations like Trezor

## Usage

---

See `xmr-transaction` to see how `xmr-device` is used in the context of creating transactions, or `xmr-mymonero-libs` to see how `xmr-device` is used for checking if transactions belong to the current hardware device being used.

## Installation

---

```sh
yarn add xmr-device
```

## License

---

The project is licensed under the MIT license.
