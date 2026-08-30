PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- The gog_playtime backfill wrote ISO text ("2025-03-24T01:00:00.000Z") into a
-- column the app otherwise fills with unix milliseconds, and CURRENT_TIMESTAMP
-- wrote zone-less UTC text ("2025-03-24 01:00:00"). strftime reads both.
-- Normalise before the rebuild so the column copy is already clean.
UPDATE "Game" SET "lastPlayedAt" = CAST(strftime('%s', "lastPlayedAt") AS INTEGER) * 1000 WHERE typeof("lastPlayedAt") = 'text';--> statement-breakpoint
UPDATE "GogIgnoredProduct" SET "createdAt" = CAST(strftime('%s', "createdAt") AS INTEGER) * 1000 WHERE typeof("createdAt") = 'text';--> statement-breakpoint
CREATE TABLE `__new_Game` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`state` text,
	`playtimeMinutes` integer DEFAULT 0 NOT NULL,
	`lastPlayedAt` integer
);
--> statement-breakpoint
INSERT INTO `__new_Game`("id", "name", "state", "playtimeMinutes", "lastPlayedAt") SELECT "id", "name", "state", "playtimeMinutes", "lastPlayedAt" FROM `Game`;--> statement-breakpoint
DROP TABLE `Game`;--> statement-breakpoint
ALTER TABLE `__new_Game` RENAME TO `Game`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_GameStateChange` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gameId` integer NOT NULL,
	`state` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_GameStateChange`("id", "gameId", "state", "timestamp") SELECT "id", "gameId", "state", "timestamp" FROM `GameStateChange`;--> statement-breakpoint
DROP TABLE `GameStateChange`;--> statement-breakpoint
ALTER TABLE `__new_GameStateChange` RENAME TO `GameStateChange`;--> statement-breakpoint
CREATE TABLE `__new_GogGame` (
	`gogId` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gameId` integer NOT NULL,
	`name` text NOT NULL,
	`releaseDate` integer,
	`description` text,
	`publisher` text,
	`developer` text,
	`tags` text NOT NULL,
	`properties` text NOT NULL,
	`iconUrl` text,
	`iconSquareUrl` text,
	`logoUrl` text,
	`boxArtImageUrl` text,
	`backgroundImageUrl` text,
	`galaxyBackgroundImageUrl` text,
	`productType` text DEFAULT 'GAME' NOT NULL,
	`playtimeMinutes` integer,
	`lastPlayedAt` integer,
	FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_GogGame`("gogId", "gameId", "name", "releaseDate", "description", "publisher", "developer", "tags", "properties", "iconUrl", "iconSquareUrl", "logoUrl", "boxArtImageUrl", "backgroundImageUrl", "galaxyBackgroundImageUrl", "productType", "playtimeMinutes", "lastPlayedAt") SELECT "gogId", "gameId", "name", "releaseDate", "description", "publisher", "developer", "tags", "properties", "iconUrl", "iconSquareUrl", "logoUrl", "boxArtImageUrl", "backgroundImageUrl", "galaxyBackgroundImageUrl", "productType", "playtimeMinutes", "lastPlayedAt" FROM `GogGame`;--> statement-breakpoint
DROP TABLE `GogGame`;--> statement-breakpoint
ALTER TABLE `__new_GogGame` RENAME TO `GogGame`;--> statement-breakpoint
CREATE UNIQUE INDEX `GogGame_gameId_key` ON `GogGame` (`gameId`);--> statement-breakpoint
CREATE TABLE `__new_GogGamePlaytime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gogId` integer NOT NULL,
	`timestampStart` integer,
	`timestampEnd` integer NOT NULL,
	`playtimeMinutes` integer NOT NULL,
	`lastPlayedAt` integer,
	FOREIGN KEY (`gogId`) REFERENCES `GogGame`(`gogId`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_GogGamePlaytime`("id", "gogId", "timestampStart", "timestampEnd", "playtimeMinutes", "lastPlayedAt") SELECT "id", "gogId", "timestampStart", "timestampEnd", "playtimeMinutes", "lastPlayedAt" FROM `GogGamePlaytime`;--> statement-breakpoint
DROP TABLE `GogGamePlaytime`;--> statement-breakpoint
ALTER TABLE `__new_GogGamePlaytime` RENAME TO `GogGamePlaytime`;--> statement-breakpoint
CREATE TABLE `__new_GogIgnoredProduct` (
	`gogId` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reason` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_GogIgnoredProduct`("gogId", "reason", "createdAt") SELECT "gogId", "reason", "createdAt" FROM `GogIgnoredProduct`;--> statement-breakpoint
DROP TABLE `GogIgnoredProduct`;--> statement-breakpoint
ALTER TABLE `__new_GogIgnoredProduct` RENAME TO `GogIgnoredProduct`;--> statement-breakpoint
CREATE TABLE `__new_GogUser` (
	`gogUserId` text PRIMARY KEY NOT NULL,
	`galaxyUserId` text NOT NULL,
	`username` text NOT NULL,
	`country` text NOT NULL,
	`checksumGames` text NOT NULL,
	`avatarUrl` text NOT NULL,
	`accessToken` text NOT NULL,
	`accessTokenExpiresAt` integer NOT NULL,
	`refreshToken` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_GogUser`("gogUserId", "galaxyUserId", "username", "country", "checksumGames", "avatarUrl", "accessToken", "accessTokenExpiresAt", "refreshToken") SELECT "gogUserId", "galaxyUserId", "username", "country", "checksumGames", "avatarUrl", "accessToken", "accessTokenExpiresAt", "refreshToken" FROM `GogUser`;--> statement-breakpoint
DROP TABLE `GogUser`;--> statement-breakpoint
ALTER TABLE `__new_GogUser` RENAME TO `GogUser`;--> statement-breakpoint
CREATE TABLE `__new_SteamAppInfo` (
	`appId` integer PRIMARY KEY NOT NULL,
	`fetchedAt` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`requiredAge` integer,
	`isFree` integer NOT NULL,
	`detailedDescription` text NOT NULL,
	`aboutTheGame` text NOT NULL,
	`shortDescription` text NOT NULL,
	`headerImage` text NOT NULL,
	`capsuleImage` text NOT NULL,
	`capsuleImagev5` text NOT NULL,
	`website` text,
	`developers` text NOT NULL,
	`publishers` text NOT NULL,
	`platformWindows` integer NOT NULL,
	`platformMac` integer NOT NULL,
	`platformLinux` integer NOT NULL,
	`metacriticScore` integer,
	`metacriticUrl` text,
	`categories` text NOT NULL,
	`genres` text NOT NULL,
	`screenshots` text NOT NULL,
	`releaseDate` integer,
	`comingSoon` integer,
	`background` text NOT NULL,
	`backgroundRaw` text NOT NULL,
	FOREIGN KEY (`appId`) REFERENCES `SteamGame`(`appId`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_SteamAppInfo`("appId", "fetchedAt", "type", "name", "requiredAge", "isFree", "detailedDescription", "aboutTheGame", "shortDescription", "headerImage", "capsuleImage", "capsuleImagev5", "website", "developers", "publishers", "platformWindows", "platformMac", "platformLinux", "metacriticScore", "metacriticUrl", "categories", "genres", "screenshots", "releaseDate", "comingSoon", "background", "backgroundRaw") SELECT "appId", "fetchedAt", "type", "name", "requiredAge", "isFree", "detailedDescription", "aboutTheGame", "shortDescription", "headerImage", "capsuleImage", "capsuleImagev5", "website", "developers", "publishers", "platformWindows", "platformMac", "platformLinux", "metacriticScore", "metacriticUrl", "categories", "genres", "screenshots", "releaseDate", "comingSoon", "background", "backgroundRaw" FROM `SteamAppInfo`;--> statement-breakpoint
DROP TABLE `SteamAppInfo`;--> statement-breakpoint
ALTER TABLE `__new_SteamAppInfo` RENAME TO `SteamAppInfo`;--> statement-breakpoint
CREATE TABLE `__new_SteamGame` (
	`appId` integer PRIMARY KEY NOT NULL,
	`gameId` integer NOT NULL,
	`appInfoState` text DEFAULT 'NOT_FETCHED' NOT NULL,
	`name` text NOT NULL,
	`playtimeForever` integer,
	`playtime2weeks` integer,
	`playtimeWindowsForever` integer,
	`playtimeMacForever` integer,
	`playtimeLinuxForever` integer,
	`playtimeDeckForever` integer,
	`playtimeDisconnected` integer,
	`rTimeLastPlayed` integer,
	`imgIconUrl` text NOT NULL,
	`capsuleFilename` text NOT NULL,
	`hasCommunityVisibleStats` integer DEFAULT false NOT NULL,
	`hasWorkshop` integer DEFAULT false NOT NULL,
	`hasDlc` integer DEFAULT false NOT NULL,
	`hasLeaderboards` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_SteamGame`("appId", "gameId", "appInfoState", "name", "playtimeForever", "playtime2weeks", "playtimeWindowsForever", "playtimeMacForever", "playtimeLinuxForever", "playtimeDeckForever", "playtimeDisconnected", "rTimeLastPlayed", "imgIconUrl", "capsuleFilename", "hasCommunityVisibleStats", "hasWorkshop", "hasDlc", "hasLeaderboards") SELECT "appId", "gameId", "appInfoState", "name", "playtimeForever", "playtime2weeks", "playtimeWindowsForever", "playtimeMacForever", "playtimeLinuxForever", "playtimeDeckForever", "playtimeDisconnected", "rTimeLastPlayed", "imgIconUrl", "capsuleFilename", "hasCommunityVisibleStats", "hasWorkshop", "hasDlc", "hasLeaderboards" FROM `SteamGame`;--> statement-breakpoint
DROP TABLE `SteamGame`;--> statement-breakpoint
ALTER TABLE `__new_SteamGame` RENAME TO `SteamGame`;--> statement-breakpoint
CREATE UNIQUE INDEX `SteamGame_gameId_key` ON `SteamGame` (`gameId`);--> statement-breakpoint
CREATE TABLE `__new_SteamGamePlaytime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`steamAppId` integer NOT NULL,
	`timestampStart` integer,
	`timestampEnd` integer NOT NULL,
	`playtimeForever` integer,
	`playtime2weeks` integer,
	`playtimeWindowsForever` integer,
	`playtimeMacForever` integer,
	`playtimeLinuxForever` integer,
	`playtimeDeckForever` integer,
	`playtimeDisconnected` integer,
	`rTimeLastPlayed` integer,
	FOREIGN KEY (`steamAppId`) REFERENCES `SteamGame`(`appId`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_SteamGamePlaytime`("id", "steamAppId", "timestampStart", "timestampEnd", "playtimeForever", "playtime2weeks", "playtimeWindowsForever", "playtimeMacForever", "playtimeLinuxForever", "playtimeDeckForever", "playtimeDisconnected", "rTimeLastPlayed") SELECT "id", "steamAppId", "timestampStart", "timestampEnd", "playtimeForever", "playtime2weeks", "playtimeWindowsForever", "playtimeMacForever", "playtimeLinuxForever", "playtimeDeckForever", "playtimeDisconnected", "rTimeLastPlayed" FROM `SteamGamePlaytime`;--> statement-breakpoint
DROP TABLE `SteamGamePlaytime`;--> statement-breakpoint
ALTER TABLE `__new_SteamGamePlaytime` RENAME TO `SteamGamePlaytime`;--> statement-breakpoint
CREATE TABLE `__new_SteamUser` (
	`steamId` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`personaName` text NOT NULL,
	`realName` text,
	`profileUrl` text NOT NULL,
	`avatar` text NOT NULL,
	`avatarMedium` text NOT NULL,
	`avatarFull` text NOT NULL,
	`avatarHash` text NOT NULL,
	`lastLogoff` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_SteamUser`("steamId", "userId", "personaName", "realName", "profileUrl", "avatar", "avatarMedium", "avatarFull", "avatarHash", "lastLogoff") SELECT "steamId", "userId", "personaName", "realName", "profileUrl", "avatar", "avatarMedium", "avatarFull", "avatarHash", "lastLogoff" FROM `SteamUser`;--> statement-breakpoint
DROP TABLE `SteamUser`;--> statement-breakpoint
ALTER TABLE `__new_SteamUser` RENAME TO `SteamUser`;--> statement-breakpoint
CREATE UNIQUE INDEX `SteamUser_userId_key` ON `SteamUser` (`userId`);--> statement-breakpoint
-- Hand-added: `User` needs no type change, so drizzle-kit leaves it alone and an
-- adopted database would keep Prisma's DDL text for it while a fresh one gets
-- Drizzle's. Rebuilding it makes every install's schema byte-identical.
CREATE TABLE `__new_User` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_User`("id") SELECT "id" FROM `User`;--> statement-breakpoint
DROP TABLE `User`;--> statement-breakpoint
ALTER TABLE `__new_User` RENAME TO `User`;
