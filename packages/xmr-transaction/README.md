# @xmr-core/xmr-transaction

Create Monero transactions and check their status

## Features

---

-   Creating non-rct transactions (with private key support)
-   Creating rct transactions (with hardware wallet + private key support)
-   Check a transactions current status (confirmed/unlocked)

## Usage

---

```ts
import { create_transaction, isTransactionConfirmed } from "@xmr-core/xmr-transaction";

const tx = await create_transaction(...args);
const isConfirmed = isTransactionConfirmed(tx);
```

## Installation

---

```sh
yarn add @xmr-core/xmr-transaction
```

## License

---

The project is licensed under the MIT license.
