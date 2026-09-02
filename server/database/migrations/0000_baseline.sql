CREATE TABLE `Game` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` TEXT NOT NULL,
	`state` TEXT,
	`playtimeMinutes` INTEGER DEFAULT 0 NOT NULL,
	`lastPlayedAt` DATETIME
);
--> statement-breakpoint
CREATE TABLE `GameStateChange` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gameId` INTEGER NOT NULL,
	`state` TEXT,
	`timestamp` DATETIME NOT NULL,
	FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `GogGame` (
	`gogId` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gameId` INTEGER NOT NULL,
	`name` TEXT NOT NULL,
	`releaseDate` DATETIME,
	`description` TEXT,
	`publisher` TEXT,
	`developer` TEXT,
	`tags` JSONB NOT NULL,
	`properties` JSONB NOT NULL,
	`iconUrl` TEXT,
	`iconSquareUrl` TEXT,
	`logoUrl` TEXT,
	`boxArtImageUrl` TEXT,
	`backgroundImageUrl` TEXT,
	`galaxyBackgroundImageUrl` TEXT,
	`productType` TEXT DEFAULT 'GAME' NOT NULL,
	`playtimeMinutes` INTEGER,
	`lastPlayedAt` DATETIME,
	FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GogGame_gameId_key` ON `GogGame` (`gameId`);--> statement-breakpoint
CREATE TABLE `GogGamePlaytime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gogId` INTEGER NOT NULL,
	`timestampStart` DATETIME,
	`timestampEnd` DATETIME NOT NULL,
	`playtimeMinutes` INTEGER NOT NULL,
	`lastPlayedAt` DATETIME,
	FOREIGN KEY (`gogId`) REFERENCES `GogGame`(`gogId`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `GogIgnoredProduct` (
	`gogId` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reason` TEXT NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `GogUser` (
	`gogUserId` TEXT PRIMARY KEY NOT NULL,
	`galaxyUserId` TEXT NOT NULL,
	`username` TEXT NOT NULL,
	`country` TEXT NOT NULL,
	`checksumGames` TEXT NOT NULL,
	`avatarUrl` TEXT NOT NULL,
	`accessToken` TEXT NOT NULL,
	`accessTokenExpiresAt` DATETIME NOT NULL,
	`refreshToken` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SteamAppInfo` (
	`appId` BIGINT PRIMARY KEY NOT NULL,
	`fetchedAt` DATETIME NOT NULL,
	`type` TEXT NOT NULL,
	`name` TEXT NOT NULL,
	`requiredAge` INTEGER,
	`isFree` BOOLEAN NOT NULL,
	`detailedDescription` TEXT NOT NULL,
	`aboutTheGame` TEXT NOT NULL,
	`shortDescription` TEXT NOT NULL,
	`headerImage` TEXT NOT NULL,
	`capsuleImage` TEXT NOT NULL,
	`capsuleImagev5` TEXT NOT NULL,
	`website` TEXT,
	`developers` JSONB NOT NULL,
	`publishers` JSONB NOT NULL,
	`platformWindows` BOOLEAN NOT NULL,
	`platformMac` BOOLEAN NOT NULL,
	`platformLinux` BOOLEAN NOT NULL,
	`metacriticScore` INTEGER,
	`metacriticUrl` TEXT,
	`categories` JSONB NOT NULL,
	`genres` JSONB NOT NULL,
	`screenshots` JSONB NOT NULL,
	`releaseDate` DATETIME,
	`comingSoon` BOOLEAN,
	`background` TEXT NOT NULL,
	`backgroundRaw` TEXT NOT NULL,
	FOREIGN KEY (`appId`) REFERENCES `SteamGame`(`appId`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `SteamGame` (
	`appId` BIGINT PRIMARY KEY NOT NULL,
	`gameId` INTEGER NOT NULL,
	`appInfoState` TEXT DEFAULT 'NOT_FETCHED' NOT NULL,
	`name` TEXT NOT NULL,
	`playtimeForever` INTEGER,
	`playtime2weeks` INTEGER,
	`playtimeWindowsForever` INTEGER,
	`playtimeMacForever` INTEGER,
	`playtimeLinuxForever` INTEGER,
	`playtimeDeckForever` INTEGER,
	`playtimeDisconnected` INTEGER,
	`rTimeLastPlayed` INTEGER,
	`imgIconUrl` TEXT NOT NULL,
	`capsuleFilename` TEXT NOT NULL,
	`hasCommunityVisibleStats` BOOLEAN DEFAULT false NOT NULL,
	`hasWorkshop` BOOLEAN DEFAULT false NOT NULL,
	`hasDlc` BOOLEAN DEFAULT false NOT NULL,
	`hasLeaderboards` BOOLEAN DEFAULT false NOT NULL,
	FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SteamGame_gameId_key` ON `SteamGame` (`gameId`);--> statement-breakpoint
CREATE TABLE `SteamGamePlaytime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`steamAppId` BIGINT NOT NULL,
	`timestampStart` DATETIME,
	`timestampEnd` DATETIME NOT NULL,
	`playtimeForever` INTEGER,
	`playtime2weeks` INTEGER,
	`playtimeWindowsForever` INTEGER,
	`playtimeMacForever` INTEGER,
	`playtimeLinuxForever` INTEGER,
	`playtimeDeckForever` INTEGER,
	`playtimeDisconnected` INTEGER,
	`rTimeLastPlayed` INTEGER,
	FOREIGN KEY (`steamAppId`) REFERENCES `SteamGame`(`appId`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `SteamUser` (
	`steamId` BIGINT PRIMARY KEY NOT NULL,
	`userId` INTEGER NOT NULL,
	`personaName` TEXT NOT NULL,
	`realName` TEXT,
	`profileUrl` TEXT NOT NULL,
	`avatar` TEXT NOT NULL,
	`avatarMedium` TEXT NOT NULL,
	`avatarFull` TEXT NOT NULL,
	`avatarHash` TEXT NOT NULL,
	`lastLogoff` INTEGER NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SteamUser_userId_key` ON `SteamUser` (`userId`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL
);
