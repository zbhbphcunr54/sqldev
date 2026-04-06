-- 目标数据库: MySQL 8.0+ (mysql CLI / Workbench 执行)
-- ============================================================
-- 自动生成: Oracle → MySQL
-- 表数量: 2, 视图: 2
-- 生成时间: 2026-04-06 14:02:11
-- 请检查类型映射和分区语法是否符合目标库版本要求
-- ============================================================

-- 订单主表
CREATE TABLE `t_order` (
    `order_id`          BIGINT               AUTO_INCREMENT COMMENT '订单ID-自增主键',
    `user_id`           BIGINT               NOT NULL,
    `order_no`          VARCHAR(32)          NOT NULL COMMENT '订单编号',
    `product_name`      VARCHAR(200)        ,
    `quantity`          BIGINT               DEFAULT 1,
    `unit_price`        DECIMAL(18,2)       ,
    `total_amt`         DECIMAL(18,2)        DEFAULT 0 COMMENT '订单总金额',
    `status`            CHAR(1)              DEFAULT 'N' COMMENT '状态: N-新建 P-处理中 D-完成',
    `memo`              LONGTEXT            ,
    `photo`             LONGBLOB            ,
    `is_paid`           TINYINT              DEFAULT 0,
    `create_time`       TIMESTAMP(6)         DEFAULT CURRENT_TIMESTAMP(6) NOT NULL,
    `update_time`       TIMESTAMP(6)        ,
    PRIMARY KEY (`order_id`),
    UNIQUE KEY `idx_uni_order_no` (`order_no`),
    KEY `idx_order_user` (`user_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订单主表';

-- 订单明细表
CREATE TABLE `t_order_item` (
    `item_id`           BIGINT               NOT NULL,
    `order_id`          BIGINT               NOT NULL,
    `sku`               VARCHAR(64)         ,
    `qty`               BIGINT               DEFAULT 1,
    `price`             DECIMAL(18,2)       ,
    PRIMARY KEY (`item_id`),
    CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `t_order`(`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订单明细表';

-- 订单汇总视图
CREATE OR REPLACE VIEW `v_order_summary` AS
SELECT O.ORDER_ID, O.ORDER_NO, O.USER_ID,
       IFNULL(O.TOTAL_AMT, 0) AS TOTAL_AMT,
       CASE O.STATUS WHEN 'N' THEN '新建' WHEN 'P' THEN '处理中' WHEN 'D' THEN '已完成' ELSE '未知' END AS STATUS_TEXT,
       DATE_FORMAT(O.CREATE_TIME, '%Y-%m-%d %H:%i:%s') AS CREATED,
       COUNT(I.ITEM_ID) AS ITEM_COUNT
  FROM T_ORDER O
  LEFT JOIN T_ORDER_ITEM I ON O.ORDER_ID = I.ORDER_ID
 GROUP BY O.ORDER_ID, O.ORDER_NO, O.USER_ID, O.TOTAL_AMT, O.STATUS, O.CREATE_TIME
;

-- 已支付订单只读视图
CREATE OR REPLACE VIEW `v_paid_orders` AS
SELECT ORDER_ID, ORDER_NO, TOTAL_AMT FROM T_ORDER WHERE IS_PAID = 1
/* [注意: MySQL 不支持 WITH READ ONLY, 请通过权限控制实现只读] */
;