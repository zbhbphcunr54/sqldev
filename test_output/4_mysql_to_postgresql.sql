-- 目标数据库: PostgreSQL 14+ (psql / pgAdmin 执行)
-- ============================================================
-- 自动生成: MySQL → PostgreSQL
-- 表数量: 1, 视图: 2
-- 生成时间: 2026-04-06 14:02:11
-- 请检查类型映射和分区语法是否符合目标库版本要求
-- ============================================================

-- 员工信息表
CREATE TABLE t_employee (
    emp_id             BIGSERIAL            NOT NULL,
    emp_no             VARCHAR(20)          NOT NULL,
    full_name          VARCHAR(100)        ,
    department         VARCHAR(50)          DEFAULT 'General',
    salary             NUMERIC(10,2)        DEFAULT 0,
    hire_date          TIMESTAMP            NOT NULL,
    is_manager         BOOLEAN              DEFAULT 0,
    bio                TEXT                ,
    avatar             BYTEA               ,
    created_at         TIMESTAMP            DEFAULT CLOCK_TIMESTAMP(),
    CONSTRAINT pk_t_employee PRIMARY KEY (emp_id)
);

COMMENT ON TABLE t_employee IS '员工信息表';

CREATE UNIQUE INDEX idx_emp_no ON t_employee(emp_no);
CREATE INDEX idx_dept ON t_employee(department);

CREATE OR REPLACE VIEW v_managers AS
SELECT emp_id, emp_no, full_name, department, salary,
       COALESCE(department, '未分配') AS dept_display,
       to_char(hire_date, 'YYYY-MM-DD') AS hire_date_str
  FROM t_employee
 WHERE is_manager = 1
;

CREATE OR REPLACE VIEW v_dept_salary AS
SELECT department,
       COUNT(*) AS headcount,
       COALESCE(SUM(salary), 0) AS total_salary,
       COALESCE(AVG(salary), 0) AS avg_salary
  FROM t_employee
 GROUP BY department
WITH CASCADED CHECK OPTION
;