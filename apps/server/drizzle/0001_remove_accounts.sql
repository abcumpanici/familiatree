DROP TABLE `api_tokens`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`home_person_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_trees`("id", "name", "home_person_id", "created_at", "updated_at") SELECT "id", "name", "home_person_id", "created_at", "updated_at" FROM `trees`;--> statement-breakpoint
DROP TABLE `trees`;--> statement-breakpoint
ALTER TABLE `__new_trees` RENAME TO `trees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;