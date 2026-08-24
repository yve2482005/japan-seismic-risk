CREATE TABLE `pushDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryKey` varchar(255) NOT NULL,
	`alertId` varchar(191) NOT NULL,
	`subscriptionId` int NOT NULL,
	`status` enum('pending','sent','failed','invalid_subscription','filtered') NOT NULL,
	`failureCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	CONSTRAINT `pushDeliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `pushDeliveries_deliveryKey_unique` UNIQUE(`deliveryKey`)
);
--> statement-breakpoint
CREATE TABLE `pushSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpointHash` varchar(64) NOT NULL,
	`subscriptionJson` text NOT NULL,
	`minimumMagnitude` int NOT NULL DEFAULT 4,
	`regionsJson` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`failureCount` int NOT NULL DEFAULT 0,
	`lastPushAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pushSubscriptions_endpointHash_unique` UNIQUE(`endpointHash`)
);
