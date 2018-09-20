# @xmr-core/xmr-vendor

A container library that holds external dependencies that have been modified for usage in Monero transaction creation / validation

## Features

---

-   cn_crypto, an emscripten compiled dependency taken from the c++ monero implementation. Contains cryptographic primitives for scalar and curve manipulation.
-   fast_cn, a derived implementation from TweetNaCl that has been modified by luigi1111 for extra CN functionality

## Usage

---

The @xmr-core/xmr-crypto-utils package wraps all the functionality provided by this library into easier to use functions.

## Installation

---

```sh
yarn add @xmr-core/xmr-vendor
```

## License

---

The project is licensed under the MIT license.
