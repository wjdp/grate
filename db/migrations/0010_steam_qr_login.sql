ALTER TABLE `SteamUser` DROP COLUMN `apiKey`;--> statement-breakpoint
ALTER TABLE `SteamUser` DROP COLUMN `lastLogoff`;--> statement-breakpoint
ALTER TABLE `SteamUser` DROP COLUMN `avatarHash`;--> statement-breakpoint
ALTER TABLE `SteamUser` ADD `refreshToken` text;--> statement-breakpoint
ALTER TABLE `SteamUser` ADD `refreshTokenExpiresAt` integer;