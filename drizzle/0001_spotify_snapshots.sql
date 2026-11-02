CREATE TABLE `spotify_snapshots` (
	`chart` text NOT NULL,
	`date` text NOT NULL,
	`fetched` integer NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`chart`, `date`)
);
