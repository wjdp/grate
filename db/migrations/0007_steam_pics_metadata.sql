CREATE TABLE `SteamPicsMetadata` (
	`appId` integer PRIMARY KEY NOT NULL,
	`fetchedAt` integer NOT NULL,
	`changenumber` integer,
	`capsulePath` text,
	`capsule2xPath` text,
	`heroPath` text,
	`hero2xPath` text,
	`heroBlurPath` text,
	`logoPath` text,
	`logo2xPath` text,
	`headerPath` text,
	`header2xPath` text,
	`logoPosition` text,
	`iconHash` text,
	`reviewScore` integer,
	`reviewPercentage` integer,
	`deckCompatibility` integer,
	`steamosCompatibility` integer,
	`steamMachineCompatibility` integer,
	`storeTags` text,
	`associations` text,
	`steamReleaseDate` integer,
	`originalReleaseDate` integer,
	`nameLocalized` text,
	`supportedLanguages` text,
	`osList` text,
	`controllerSupport` text,
	FOREIGN KEY (`appId`) REFERENCES `SteamGame`(`appId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SteamTag` (
	`tagId` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
