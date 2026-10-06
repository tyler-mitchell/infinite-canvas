CREATE TABLE `portfolio` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`draft` text NOT NULL,
	`published` text,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_owner_id_unique` ON `portfolio` (`owner_id`);