import { JSONPrettyPrint } from "@xmr-core/xmr-str-utils";
import { MyMoneroApi } from "@xmr-core/xmr-mymonero-libs";
import {
	LedgerDevice,
	NetType,
	pubkeys_to_string,
} from "@xmr-core/xmr-crypto-utils";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { formatMoneyWithSymbol } from "@xmr-core/xmr-money";

const setTimeoutAsync = (timeout: number) =>
	new Promise(res => setTimeout(() => res(), timeout));

export async function getBalance() {
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

	const res = await MyMoneroApi.login(address, privateViewKey);
	JSONPrettyPrint("getBalance", res, "login");
	let i = 0;
	async function fetchBalance() {
		const addressInfo = await MyMoneroApi.addressInfo(
			address,
			privateViewKey,
			spend_public_key,
			spendKey,
			dev,
		);

		const {
			total_received,
			total_sent,
			locked_balance,
			ratesBySymbol,
		} = addressInfo;

		const fmt = formatMoneyWithSymbol;
		const fmtUsd = (str: string) =>
			(Number(str.split(" ")[0]) * ratesBySymbol.USD).toFixed(2);

		const sent = fmt(total_sent);
		const recv = fmt(total_received);
		const locked = fmt(locked_balance);
		const curr = fmt(total_received.subtract(total_sent));

		const sentUsd = fmtUsd(sent);
		const recvUsd = fmtUsd(recv);
		const lockedUsd = fmtUsd(locked);
		const currUsd = fmtUsd(curr);

		console.clear();
		console.log(`
		---Account Balance Stats--- ${++i}
		Sent: ${sent} | ${sentUsd} USD
		Received: ${recv} | ${recvUsd} USD
		Locked: ${locked} | ${lockedUsd} USD
		Current Balance: ${curr} | ${currUsd} USD
		`);

		await setTimeoutAsync(2000);

		await fetchBalance();
	}

	fetchBalance();
}
