import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { LedgerDevice } from "@xmr-core/xmr-crypto-utils";
import { pubkeys_to_string, NetType } from "@xmr-core/xmr-crypto-utils";
import { MyMoneroApi } from "@xmr-core/xmr-mymonero-libs";
import { formatMoneyWithSymbol } from "@xmr-core/xmr-money";

export async function getUnspentOuts() {
	const transport = await TransportNodeHid.create();
	const dev = new LedgerDevice(transport);
	const {
		spend_public_key,
		view_public_key,
	} = await dev.get_public_address();
	const address = pubkeys_to_string(
		spend_public_key,
		view_public_key,
		NetType.MAINNET,
	);
	const { spendKey } = await dev.get_secret_keys();
	const privateViewKey = await dev.export_private_view_key();
	await MyMoneroApi.login(address, privateViewKey);

	const { unspentOutputs } = await MyMoneroApi.unspentOutputs(
		address,
		privateViewKey,
		spend_public_key,
		spendKey,
		6,
		dev,
	);

	const fmt = formatMoneyWithSymbol;

	const x = unspentOutputs.map(({ amount, height, timestamp, tx_hash }) => ({
		amount: fmt(amount),
		height,
		timestamp,
		tx_hash,
	}));

	console.log(x);
}
