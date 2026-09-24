CREATE TABLE `member_mcp_grant` (
	`capability` text NOT NULL,
	`member_id` text NOT NULL,
	CONSTRAINT `member_mcp_grant_pk` PRIMARY KEY(`member_id`, `capability`),
	CONSTRAINT `fk_member_mcp_grant_member_id_user_id_fk` FOREIGN KEY (`member_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
