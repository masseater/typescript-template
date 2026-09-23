CREATE TABLE `recording` (
	`byte_size` integer NOT NULL,
	`completed_at` integer,
	`content_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`duration_ms` integer,
	`failure` text,
	`id` text PRIMARY KEY,
	`job_id` text NOT NULL,
	`object_key` text NOT NULL,
	`owner_id` text,
	`status` text NOT NULL,
	`title` text NOT NULL,
	CONSTRAINT `fk_recording_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `recording_segment` (
	`end_ms` integer NOT NULL,
	`position` integer NOT NULL,
	`recording_id` text NOT NULL,
	`speaker_label` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`text` text NOT NULL,
	CONSTRAINT `recording_segment_pk` PRIMARY KEY(`recording_id`, `position`),
	CONSTRAINT `fk_recording_segment_recording_id_recording_id_fk` FOREIGN KEY (`recording_id`) REFERENCES `recording`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `recording_speaker` (
	`label` integer NOT NULL,
	`person_id` text,
	`recording_id` text NOT NULL,
	CONSTRAINT `recording_speaker_pk` PRIMARY KEY(`recording_id`, `label`),
	CONSTRAINT `fk_recording_speaker_person_id_speaker_person_id_fk` FOREIGN KEY (`person_id`) REFERENCES `speaker_person`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_recording_speaker_recording_id_recording_id_fk` FOREIGN KEY (`recording_id`) REFERENCES `recording`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `speaker_person` (
	`consent_recorded_by` text,
	`consented_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	CONSTRAINT `fk_speaker_person_consent_recorded_by_user_id_fk` FOREIGN KEY (`consent_recorded_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `recording_created_at_idx` ON `recording` (`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recording_job_id_unique` ON `recording` (`job_id`);