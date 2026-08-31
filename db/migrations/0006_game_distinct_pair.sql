CREATE TABLE `GameDistinctPair` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gameAId` integer NOT NULL,
	`gameBId` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`gameAId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`gameBId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GameDistinctPair_pair_key` ON `GameDistinctPair` (`gameAId`,`gameBId`);