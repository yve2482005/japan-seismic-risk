CREATE TABLE `pushConfiguration` (
	`id` int NOT NULL,
	`publicKey` varchar(255) NOT NULL,
	`sealedPrivateKey` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushConfiguration_id` PRIMARY KEY(`id`)
);
