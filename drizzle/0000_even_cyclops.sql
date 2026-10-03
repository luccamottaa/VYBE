CREATE TABLE `chart_snapshots` (
	`country` text NOT NULL,
	`date` text NOT NULL,
	`fetched` integer NOT NULL,
	`updated` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`country`, `date`)
);
