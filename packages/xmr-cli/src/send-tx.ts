import {
	sendFundsSimple,
	sendFundsStatusToMessage,
} from "@xmr-core/xmr-mymonero-libs";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { MyMoneroApi } from "@xmr-core/xmr-mymonero-libs";
import {
	pubkeys_to_string,
	LedgerDevice,
	NetType,
} from "@xmr-core/xmr-crypto-utils";
import { Pid } from "@xmr-core/xmr-transaction";
import { JSONPrettyPrint } from "@xmr-core/xmr-str-utils";

export async function send(address: string, amount: number, pid: Pid) {
	const transport = await TransportNodeHid.create();
	const dev = new LedgerDevice(transport);

	const {
		spend_public_key,
		view_public_key,
	} = await dev.get_public_address();

	const privateViewKey = await dev.export_private_view_key();

	const senderAddress = pubkeys_to_string(
		spend_public_key,
		view_public_key,
		NetType.MAINNET,
	);

	await MyMoneroApi.login(senderAddress, privateViewKey);

	const res = await sendFundsSimple(
		address,
		amount,
		pid,
		(status: number) => {
			console.log(
				"[Transaction Status]",
				sendFundsStatusToMessage[status as 1 | 2 | 3 | 4 | 5],
			);
		},
		dev,
	);

	JSONPrettyPrint("[send]", res, "Funds sent!");
}
