CREATE TABLE `collectionTelemetry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowRunId` varchar(32) NOT NULL,
	`status` enum('success','failure') NOT NULL,
	`retryAttempts` int NOT NULL DEFAULT 0,
	`reportedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collectionTelemetry_id` PRIMARY KEY(`id`),
	CONSTRAINT `collectionTelemetry_workflowRunId_unique` UNIQUE(`workflowRunId`)
);
