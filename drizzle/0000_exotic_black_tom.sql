CREATE TABLE `plays` (
	`viewer` text NOT NULL,
	`lesson` text NOT NULL,
	`start` real NOT NULL,
	`stop` real NOT NULL,
	PRIMARY KEY(`viewer`, `lesson`, `start`),
	FOREIGN KEY (`viewer`) REFERENCES `viewers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `viewers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updated` integer NOT NULL
);
