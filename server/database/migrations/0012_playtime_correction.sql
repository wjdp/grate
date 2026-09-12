CREATE TABLE `PlaytimeCorrection` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`providerId` integer NOT NULL,
	`snapshotId` integer,
	`minutes` integer NOT NULL,
	`playedFrom` text NOT NULL,
	`playedTo` text NOT NULL,
	`note` text,
	`createdAt` integer NOT NULL,
	CONSTRAINT "PlaytimeCorrection_minutes_positive" CHECK("PlaytimeCorrection"."minutes" > 0)
);
--> statement-breakpoint
CREATE INDEX `PlaytimeCorrection_provider_providerId_idx` ON `PlaytimeCorrection` (`provider`,`providerId`);