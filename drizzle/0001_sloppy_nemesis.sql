CREATE TABLE `collectionRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`status` enum('running','succeeded','failed','skipped') NOT NULL,
	`recordsCollected` int NOT NULL DEFAULT 0,
	`recordsAccepted` int NOT NULL DEFAULT 0,
	`duplicatesRejected` int NOT NULL DEFAULT 0,
	`invalidRejected` int NOT NULL DEFAULT 0,
	`message` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `collectionRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `earthquakes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(191) NOT NULL,
	`sourceId` int NOT NULL,
	`originalEventId` varchar(191),
	`sourceUrl` varchar(1024) NOT NULL,
	`originTimeUtc` timestamp NOT NULL,
	`localTimeJapan` varchar(64),
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`depthKm` double,
	`magnitude` double,
	`magnitudeType` varchar(24),
	`region` varchar(64),
	`prefecture` varchar(64),
	`nearestCity` varchar(160),
	`eventType` varchar(64),
	`rawPayload` text NOT NULL,
	`normalizedPayload` text NOT NULL,
	`parserVersion` varchar(32) NOT NULL,
	`dataQuality` enum('validated','incomplete','rejected') NOT NULL,
	`duplicateStatus` enum('accepted','duplicate','rejected') NOT NULL,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `earthquakes_id` PRIMARY KEY(`id`),
	CONSTRAINT `earthquakes_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `modelVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelVersion` varchar(32) NOT NULL,
	`targetDefinition` varchar(160) NOT NULL,
	`algorithm` varchar(64) NOT NULL,
	`status` enum('candidate','production','retired','failed','demo') NOT NULL,
	`datasetVersion` varchar(64) NOT NULL,
	`featureVersion` varchar(64) NOT NULL,
	`trainingRecords` int NOT NULL,
	`testRecords` int NOT NULL,
	`accuracy` double,
	`precision` double,
	`recall` double,
	`f1` double,
	`rocAuc` double,
	`prAuc` double,
	`brierScore` double,
	`metricsJson` text,
	`trainedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modelVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `modelVersions_modelVersion_unique` UNIQUE(`modelVersion`)
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelVersionId` int NOT NULL,
	`region` varchar(64) NOT NULL,
	`targetDefinition` varchar(160) NOT NULL,
	`probability` double NOT NULL,
	`riskLevel` enum('LOW','MODERATE','ELEVATED','HIGH') NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`baseUrl` varchar(1024) NOT NULL,
	`termsUrl` varchar(1024),
	`robotsUrl` varchar(1024),
	`complianceStatus` enum('pending_review','approved','rejected','expired') NOT NULL DEFAULT 'pending_review',
	`enabled` boolean NOT NULL DEFAULT false,
	`rateLimitSeconds` int NOT NULL DEFAULT 60,
	`parserVersion` varchar(32),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `sources_sourceKey_unique` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE TABLE `systemLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`component` varchar(64) NOT NULL,
	`severity` enum('info','warning','error') NOT NULL,
	`message` text NOT NULL,
	`contextJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `systemLogs_id` PRIMARY KEY(`id`)
);
