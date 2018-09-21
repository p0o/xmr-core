import moment from "moment";
import { config } from "@xmr-core/xmr-constants";

export function isTransactionConfirmed(
	tx: { height: number },
	blockchainHeight: number,
) {
	return blockchainHeight - tx.height > config.txMinConfirms;
}

export function isTransactionUnlocked(
	{ unlock_time }: { unlock_time: number },
	blockchainHeight: number,
) {
	if (!config.maxBlockNumber) {
		throw Error("Max block number is not set in config!");
	}
	if (unlock_time < config.maxBlockNumber) {
		// unlock time is block height
		return blockchainHeight >= unlock_time;
	} else {
		// unlock time is timestamp
		const current_time = Math.round(new Date().getTime() / 1000);
		return current_time >= unlock_time;
	}
}

export function transactionLockedReason(
	{ unlock_time }: { unlock_time: number },
	blockchainHeight: number,
) {
	if (unlock_time < config.maxBlockNumber) {
		// unlock time is block height
		const numBlocks = unlock_time - blockchainHeight;
		if (numBlocks <= 0) {
			return "Transaction is unlocked";
		}
		const unlock_prediction = moment().add(
			numBlocks * config.avgBlockTime,
			"seconds",
		);
		return (
			"Will be unlocked in " +
			numBlocks +
			" blocks, ~" +
			unlock_prediction.fromNow(true) +
			", " +
			unlock_prediction.calendar() +
			""
		);
	} else {
		// unlock time is timestamp
		const current_time = Math.round(new Date().getTime() / 1000);
		const time_difference = unlock_time - current_time;
		if (time_difference <= 0) {
			return "Transaction is unlocked";
		}
		const unlock_moment = moment(unlock_time * 1000);
		return (
			"Will be unlocked " +
			unlock_moment.fromNow() +
			", " +
			unlock_moment.calendar()
		);
	}
}
