# xmr-pid

Validate, create, and manipulate, Monero payment ids

## Features

---

-   Check if a string contains a payment id
-   Check if a payment id is a short(encrypted) or long(plaintext) id
-   Encrypt/Decrypt a payment id with a keypair
-   Generate a payment id

## Usage

---

```ts
import { makePaymentId, isValidShortPaymentID } from "xmr-pid";
const shortPid = makePaymentId();
const isValid = isValidShortPaymentID(shortPid); // true
```

## Installation

```sh
yarn add xmr-pid
```

## License

---

The project is licensed under the MIT license.
