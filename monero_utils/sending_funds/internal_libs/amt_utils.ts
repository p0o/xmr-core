import { JSBigInt } from "./types";

export function getBaseTotalAmount(
	isSweeping: boolean,
	feelessTotal: JSBigInt,
	networkFee: JSBigInt,
) {
	// const hostingService_chargeAmount = hostedMoneroAPIClient.HostingServiceChargeFor_transactionWithNetworkFee(attemptAt_network_minimumFee)

	if (isSweeping) {
		return new JSBigInt("18450000000000000000"); //~uint64 max
	} else {
		return feelessTotal.add(
			networkFee,
		); /*.add(hostingService_chargeAmount) NOTE service fee removed for now */
	}
}
