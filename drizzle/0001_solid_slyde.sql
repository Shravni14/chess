CREATE TABLE `chess_games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`gameMode` varchar(32) NOT NULL DEFAULT 'ai',
	`roomCode` varchar(16),
	`fen` text NOT NULL,
	`boardState` json NOT NULL,
	`history` json NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'playing',
	`whitePlayer` varchar(128),
	`blackPlayer` varchar(128),
	`turn` varchar(4) NOT NULL DEFAULT 'w',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chess_games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chess_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCode` varchar(16) NOT NULL,
	`hostId` varchar(64) NOT NULL,
	`hostName` varchar(128),
	`guestId` varchar(64),
	`guestName` varchar(128),
	`gameState` json NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'waiting',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chess_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `chess_rooms_roomCode_unique` UNIQUE(`roomCode`)
);
