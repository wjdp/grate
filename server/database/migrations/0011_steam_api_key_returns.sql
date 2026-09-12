ALTER TABLE `SteamUser` ADD `apiKey` text;--> statement-breakpoint
UPDATE `SteamUser` SET `refreshToken` = NULL, `refreshTokenExpiresAt` = NULL;
