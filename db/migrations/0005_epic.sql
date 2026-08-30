CREATE TABLE `EpicGame` (
	`epicId` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gameId` integer NOT NULL,
	`appName` text NOT NULL,
	`namespace` text NOT NULL,
	`catalogItemId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`developer` text,
	`publisher` text,
	`releaseDate` integer,
	`acquisitionDate` integer,
	`categories` text NOT NULL,
	`boxArtTallUrl` text,
	`boxArtWideUrl` text,
	`logoUrl` text,
	`storeSlug` text,
	`thirdPartyStore` text,
	`playtimeMinutes` integer,
	`lastPlayedAt` integer,
	FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `EpicGame_appName_key` ON `EpicGame` (`appName`);--> statement-breakpoint
CREATE INDEX `EpicGame_gameId_idx` ON `EpicGame` (`gameId`);--> statement-breakpoint
CREATE TABLE `EpicGamePlaytime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`epicId` integer NOT NULL,
	`timestampStart` integer,
	`timestampEnd` integer NOT NULL,
	`playtimeMinutes` integer NOT NULL,
	`lastPlayedAt` integer,
	FOREIGN KEY (`epicId`) REFERENCES `EpicGame`(`epicId`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `EpicIgnoredItem` (
	`appName` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `EpicUser` (
	`accountId` text PRIMARY KEY NOT NULL,
	`displayName` text NOT NULL,
	`country` text,
	`accessToken` text NOT NULL,
	`accessTokenExpiresAt` integer NOT NULL,
	`refreshToken` text NOT NULL,
	`refreshTokenExpiresAt` integer NOT NULL
);
