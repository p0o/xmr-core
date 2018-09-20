import { NetType } from "@xmr-core/xmr-types";
import { Log } from "./logger";
import { decode_address } from "@xmr-core/xmr-address-utils";

export function getTargetPubViewKey(
	encPid: boolean,
	targetAddress: string,
	nettype: NetType,
): string | undefined {
	if (encPid) {
		const key = decode_address(targetAddress, nettype).view;

		Log.Target.viewKey(key);
		return key;
	}
}
