DROP INDEX `GogGame_gameId_key`;--> statement-breakpoint
CREATE INDEX `GogGame_gameId_idx` ON `GogGame` (`gameId`);--> statement-breakpoint
DROP INDEX `SteamGame_gameId_key`;--> statement-breakpoint
CREATE INDEX `SteamGame_gameId_idx` ON `SteamGame` (`gameId`);