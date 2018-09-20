# @xmr-core/xmr-money

Helpers for formatting and parsing Moneroj.

## Features

---

-   Format a Moneroj BigNumber into string
-   Format with the XMR coin symnol
-   Convert units into base units

## Usage

---

```ts
import { formatMoneyFullSymbol } from "@xmr-core/xmr-money";
const amt = "30000";
const parsedAmtWithSym = formatMoneyFullSymbol(amt);
```

## Installation

---

```sh
yarn add @xmr-core/xmr-money
```

## License

---

The project is licensed under the MIT license.
