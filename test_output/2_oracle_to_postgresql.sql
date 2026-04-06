-- 目标数据库: PostgreSQL 14+ (psql / pgAdmin 执行)
-- ============================================================
-- 自动生成: Oracle → PostgreSQL
-- 表数量: 1, 视图: 1
-- 生成时间: 2026-04-06 14:02:11
-- 请检查类型映射和分区语法是否符合目标库版本要求
-- ============================================================

-- 账户信息表
CREATE TABLE t_account (
    acct_id            BIGSERIAL           ,
    acct_no            VARCHAR(20)          NOT NULL,
    holder_name        VARCHAR(100)        ,
    balance            NUMERIC(18,4)        DEFAULT 0,
    is_active          SMALLINT             DEFAULT 1,
    open_date          TIMESTAMP           ,
    last_txn           TIMESTAMP            DEFAULT CLOCK_TIMESTAMP(),
    notes              TEXT                ,
    raw_data           BYTEA               ,
    CONSTRAINT pk_account PRIMARY KEY (acct_id)
);

COMMENT ON TABLE t_account IS '账户信息表';
COMMENT ON COLUMN t_account.balance IS '余额(精度4位)';

CREATE UNIQUE INDEX idx_acct_no ON t_account(acct_no);
CREATE INDEX idx_acct_holder ON t_account(holder_name);

-- 活跃账户视图
CREATE OR REPLACE VIEW v_active_accts AS
SELECT ACCT_ID, ACCT_NO, HOLDER_NAME,
       COALESCE(BALANCE, 0) AS BALANCE,
       CASE WHEN NOTES IS NOT NULL THEN '有备注' ELSE '无备注' END AS HAS_NOTES,
       TO_CHAR(OPEN_DATE, 'YYYY-MM-DD') AS OPENED
  FROM T_ACCOUNT
 WHERE IS_ACTIVE = 1
;

COMMENT ON VIEW v_active_accts IS '活跃账户视图';