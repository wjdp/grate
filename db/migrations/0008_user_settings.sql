ALTER TABLE `User` ADD `timezone` text;--> statement-breakpoint
ALTER TABLE `User` ADD `dayBoundaryHour` integer DEFAULT 6 NOT NULL;