CREATE TABLE `metric_snapshot` (
	`bucket` text NOT NULL,
	`client_kind` text NOT NULL,
	`computed_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`metric` text NOT NULL,
	`period` text NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metric_snapshot_metric_period_bucket_idx` ON `metric_snapshot` (`metric`,`period`,`bucket`);--> statement-breakpoint
CREATE UNIQUE INDEX `metric_snapshot_unique` ON `metric_snapshot` (`metric`,`period`,`bucket`,`client_kind`);