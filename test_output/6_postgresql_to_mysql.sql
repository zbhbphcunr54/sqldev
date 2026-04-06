-- 目标数据库: MySQL 8.0+ (mysql CLI / Workbench 执行)
-- ============================================================
-- 自动生成: PostgreSQL → MySQL
-- 表数量: 2, 视图: 2
-- 生成时间: 2026-04-06 14:02:11
-- 请检查类型映射和分区语法是否符合目标库版本要求
-- ============================================================

-- 文章表
CREATE TABLE `t_article` (
    `article_id`        BIGINT               AUTO_INCREMENT NOT NULL,
    `slug`              VARCHAR(100)         NOT NULL COMMENT 'URL友好标识',
    `title`             VARCHAR(200)        ,
    `author`            VARCHAR(80)         ,
    `word_count`        INT                  DEFAULT 0,
    `score`             DECIMAL(5,2)         COMMENT '评分',
    `is_published`      TINYINT(1)           DEFAULT FALSE,
    `body`              LONGTEXT            ,
    `cover_img`         LONGBLOB            ,
    `published_at`      TIMESTAMP(6)        ,
    `created_at`        TIMESTAMP(6)         DEFAULT CURRENT_TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (`article_id`),
    UNIQUE KEY `idx_slug` (`slug`),
    KEY `idx_author` (`author`),
    KEY `idx_published` (`is_published`, `published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='文章表';

-- t_tag
CREATE TABLE `t_tag` (
    `tag_id`            INT                  AUTO_INCREMENT NOT NULL,
    `article_id`        BIGINT               NOT NULL,
    `tag_name`          VARCHAR(50)         ,
    PRIMARY KEY (`tag_id`),
    CONSTRAINT `fk_tag_article` FOREIGN KEY (`article_id`) REFERENCES `t_article`(`article_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW `v_published_articles` AS
SELECT a.article_id, a.slug, a.title, a.author,
       IFNULL(a.score, 0) AS score,
       a.word_count,
       COUNT(t.tag_id) AS tag_count,
       DATE_FORMAT(a.published_at, '%Y-%m-%d') AS pub_date
  FROM t_article a
  LEFT JOIN t_tag t ON a.article_id = t.article_id
 WHERE a.is_published = TRUE
 GROUP BY a.article_id, a.slug, a.title, a.author, a.score, a.word_count, a.published_at
;

CREATE OR REPLACE VIEW `v_top_articles` AS
SELECT article_id, slug, title, score
  FROM t_article
 WHERE score >= 4.0 AND is_published = TRUE
WITH LOCAL CHECK OPTION
;