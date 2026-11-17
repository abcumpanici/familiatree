CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_hash` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_user` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `parent_links` (
	`id` text NOT NULL,
	`tree_id` text NOT NULL,
	`child_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_links_pk` ON `parent_links` (`tree_id`,`id`);--> statement-breakpoint
CREATE TABLE `partnerships` (
	`id` text NOT NULL,
	`tree_id` text NOT NULL,
	`person_a_id` text NOT NULL,
	`person_b_id` text NOT NULL,
	`married` integer NOT NULL,
	`start_date` text NOT NULL,
	`start_place` text NOT NULL,
	`ended` integer NOT NULL,
	`end_date` text NOT NULL,
	`end_place` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partnerships_pk` ON `partnerships` (`tree_id`,`id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text NOT NULL,
	`tree_id` text NOT NULL,
	`first_names` text NOT NULL,
	`surname` text NOT NULL,
	`birth_surname` text NOT NULL,
	`gender` text NOT NULL,
	`born_date` text NOT NULL,
	`born_place` text NOT NULL,
	`died` integer NOT NULL,
	`died_date` text NOT NULL,
	`died_place` text NOT NULL,
	`photo` text NOT NULL,
	`story` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_pk` ON `people` (`tree_id`,`id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`tree_id` text NOT NULL,
	`person_id` text NOT NULL,
	`content_type` text NOT NULL,
	`hash` text NOT NULL,
	`bytes` blob NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_pk` ON `photos` (`tree_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `trees` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`home_person_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trees_owner` ON `trees` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email` ON `users` (`email`);