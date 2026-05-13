-- [2026-05-13] 为每个数据库插入专属的 DDL / 函数 / 存储过程示例
-- 分类: sql_convert_sample, key: {db_slug}_{sql_type}
-- 每个示例展示该数据库特有的数据类型、自增列、约束、注释、索引、序列、分区、异常处理、系统函数等

-- ============================================================
-- 1. Oracle (经典 Oracle 语法)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oracle_ddl', $sam$-- Oracle 电商订单系统 DDL
-- 特性: NUMBER, VARCHAR2, SEQUENCE, COMMENT ON, 自增用序列+触发器, 检查约束, 索引

CREATE SEQUENCE seq_orders START WITH 1000 INCREMENT BY 1 NOCACHE;

CREATE TABLE orders (
  order_id    NUMBER(20) DEFAULT seq_orders.NEXTVAL NOT NULL,
  order_no    VARCHAR2(32) NOT NULL,
  customer_id NUMBER(20) NOT NULL,
  total_amt   NUMBER(12,2) NOT NULL,
  status      NUMBER(2) DEFAULT 0,
  is_deleted  NUMBER(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  update_time TIMESTAMP,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_no UNIQUE (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
);

CREATE TABLE order_items (
  item_id    NUMBER(20) NOT NULL,
  order_id   NUMBER(20) NOT NULL,
  product    VARCHAR2(200) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  quantity   NUMBER(8) DEFAULT 1 NOT NULL,
  CONSTRAINT pk_items PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（序列自增）';
COMMENT ON COLUMN orders.order_no IS '订单编号';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'Oracle DDL 示例：NUMBER/VARCHAR2/序列/COMMENT ON/检查约束/索引', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oracle_function', $sam$-- Oracle PL/SQL 函数：计算订单折后金额
-- 特性: RETURN NUMBER, SELECT INTO, NVL, CASE, EXCEPTION, 游标

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id IN NUMBER,
  p_use_coupon IN BOOLEAN DEFAULT TRUE
) RETURN NUMBER IS
  v_total    NUMBER(12,2);
  v_discount NUMBER(12,2) := 0;
  v_coupon   NUMBER(12,2) := 0;
  v_level    NUMBER(2) := 1;
  v_final    NUMBER(12,2);
  CURSOR cur_coupon IS SELECT NVL(SUM(amount), 0) FROM coupons
    WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > SYSDATE;
BEGIN
  SELECT total_amt, NVL(discount_amt, 0), NVL(customer_level, 1)
  INTO v_total, v_discount, v_level
  FROM orders WHERE order_id = p_order_id;

  OPEN cur_coupon;
  FETCH cur_coupon INTO v_coupon;
  CLOSE cur_coupon;

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;

  IF p_use_coupon THEN
    v_final := v_final - v_coupon;
  END IF;
  v_final := v_final - v_discount;

  RETURN GREATEST(v_final, 0);
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN NULL;
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('Error: ' || SQLERRM);
    RETURN NULL;
END calc_final_amount;$sam$, 'string', 'Oracle 函数示例：PL/SQL RETURN/游标/NVL/CASE/EXCEPTION/SYSDATE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oracle_procedure', $sam$-- Oracle PL/SQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT 参数, PRAGMA EXCEPTION_INIT, FOR..LOOP, COMMIT/ROLLBACK, SQL%ROWCOUNT

CREATE OR REPLACE PROCEDURE pay_order(
  p_order_id   IN NUMBER,
  p_method     IN VARCHAR2,
  p_txn_no     IN VARCHAR2,
  p_result     OUT NUMBER,
  p_message    OUT VARCHAR2
) IS
  v_status    NUMBER(2);
  v_total     NUMBER(12,2);
  v_seq_val   NUMBER;
  e_locked    EXCEPTION;
  e_no_stock  EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_locked, -20001);
  PRAGMA EXCEPTION_INIT(e_no_stock, -20002);
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE WAIT 10;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  SELECT seq_payment.NEXTVAL INTO v_seq_val FROM DUAL;
  INSERT INTO payments(pay_id, order_id, method, txn_no, amount, create_time)
  VALUES(v_seq_val, p_order_id, p_method, p_txn_no, v_total, SYSTIMESTAMP);

  UPDATE orders SET status = 1, update_time = SYSTIMESTAMP
  WHERE order_id = p_order_id;

  FOR item IN (SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id) LOOP
    UPDATE inventory SET stock = stock - item.quantity, update_time = SYSTIMESTAMP
    WHERE product_id = item.product_id AND stock >= item.quantity;
    IF SQL%ROWCOUNT = 0 THEN RAISE e_no_stock; END IF;
  END LOOP;

  COMMIT;
  p_result := 0; p_message := '支付成功';
EXCEPTION
  WHEN e_no_stock THEN ROLLBACK; p_result := -3; p_message := '库存不足';
  WHEN OTHERS THEN ROLLBACK; p_result := -9; p_message := SQLERRM;
END pay_order;$sam$, 'string', 'Oracle 存储过程示例：IN/OUT/PRAGMA/FOR游标/COMMIT/SQL%ROWCOUNT/序列', true);

-- ============================================================
-- 2. MySQL
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'mysql_ddl', $sam$-- MySQL 电商订单系统 DDL
-- 特性: INT AUTO_INCREMENT, VARCHAR, DECIMAL, TINYINT, 内联 COMMENT, ENGINE/CHARSET, 检查约束(8.0+)

CREATE TABLE orders (
  order_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_no    VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  total_amt   DECIMAL(12,2) NOT NULL,
  status      TINYINT DEFAULT 0,
  is_deleted  TINYINT(1) DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订单主表';

CREATE TABLE order_items (
  item_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_id   BIGINT NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订单明细表';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'MySQL DDL 示例：AUTO_INCREMENT/DECIMAL/TINYINT/内联COMMENT/ENGINE/ON DELETE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'mysql_function', $sam$-- MySQL 函数：计算订单折后金额
-- 特性: RETURNS/DETERMINISTIC/DECLARE HANDLER/IF-THEN/SIGNAL

DELIMITER //
CREATE FUNCTION calc_final_amount(
  p_order_id BIGINT,
  p_use_coupon TINYINT
) RETURNS DECIMAL(12,2)
  DETERMINISTIC
  READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_discount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_coupon DECIMAL(12,2) DEFAULT 0;
  DECLARE v_level INT DEFAULT 1;
  DECLARE v_final DECIMAL(12,2);

  DECLARE EXIT HANDLER FOR NOT FOUND RETURN NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION RETURN NULL;

  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level
  FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon
  FROM coupons WHERE order_id = p_order_id
    AND status = 'VALID' AND expire_time > NOW();

  SET v_final = v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;

  IF p_use_coupon THEN SET v_final = v_final - v_coupon; END IF;
  SET v_final = v_final - v_discount;

  RETURN GREATEST(v_final, 0);
END//
DELIMITER ;$sam$, 'string', 'MySQL 函数示例：RETURNS/DELIMITER/DECLARE HANDLER/COALESCE/NOW/GREATEST', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'mysql_procedure', $sam$-- MySQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT 参数, DECLARE HANDLER, 游标循环, START TRANSACTION, SIGNAL

DELIMITER //
CREATE PROCEDURE pay_order(
  IN  p_order_id BIGINT,
  IN  p_method VARCHAR(20),
  IN  p_txn_no VARCHAR(64),
  OUT p_result INT,
  OUT p_message VARCHAR(200)
)
BEGIN
  DECLARE v_status TINYINT;
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_product_id BIGINT;
  DECLARE v_qty INT;

  DECLARE cur_items CURSOR FOR
    SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK; SET p_result = -9; SET p_message = '系统异常';
  END;

  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    SET p_result = -1; SET p_message = '状态不允许支付';
  END IF;

  START TRANSACTION;

  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, NOW());

  UPDATE orders SET status = 1, update_time = NOW()
  WHERE order_id = p_order_id;

  OPEN cur_items;
  read_loop: LOOP
    FETCH cur_items INTO v_product_id, v_qty;
    IF v_done THEN LEAVE read_loop; END IF;
    UPDATE inventory SET stock = stock - v_qty, update_time = NOW()
    WHERE product_id = v_product_id AND stock >= v_qty;
    IF ROW_COUNT() = 0 THEN
      ROLLBACK; SET p_result = -3; SET p_message = '库存不足';
    END IF;
  END LOOP;
  CLOSE cur_items;

  COMMIT;
  SET p_result = 0; SET p_message = '支付成功';
END//
DELIMITER ;$sam$, 'string', 'MySQL 存储过程示例：IN/OUT/游标LOOP/CONTINUE HANDLER/START TRANSACTION/ROW_COUNT', true);

-- ============================================================
-- 3. PostgreSQL
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'postgresql_ddl', $sam$-- PostgreSQL 电商订单系统 DDL
-- 特性: SERIAL/BIGSERIAL, NUMERIC, TEXT, BOOLEAN, IF NOT EXISTS, COMMENT ON, 检查约束

CREATE TABLE IF NOT EXISTS orders (
  order_id    BIGSERIAL PRIMARY KEY,
  order_no    VARCHAR(32) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL,
  total_amt   NUMERIC(12,2) NOT NULL,
  status      SMALLINT DEFAULT 0,
  is_deleted  BOOLEAN DEFAULT FALSE,
  create_time TIMESTAMPTZ DEFAULT now(),
  update_time TIMESTAMPTZ,
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
  item_id    BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product    TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（BIGSERIAL自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_time ON orders(create_time);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);$sam$, 'string', 'PostgreSQL DDL 示例：BIGSERIAL/NUMERIC/TEXT/BOOLEAN/TIMESTAMPTZ/IF NOT EXISTS/内联REFERENCES', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'postgresql_function', $sam$-- PostgreSQL PL/pgSQL 函数：计算订单折后金额
-- 特性: $$ 引用, LANGUAGE plpgsql, RETURNS, DECLARE, 类型转换 ::, COALESCE

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id BIGINT,
  p_use_coupon BOOLEAN DEFAULT TRUE
) RETURNS NUMERIC(12,2) AS $$
DECLARE
  v_total    NUMERIC(12,2);
  v_discount NUMERIC(12,2) := 0;
  v_coupon   NUMERIC(12,2) := 0;
  v_level    INT := 1;
  v_final    NUMERIC(12,2);
BEGIN
  SELECT o.total_amt, COALESCE(o.discount_amt, 0), COALESCE(c.level, 1)
  INTO v_total, v_discount, v_level
  FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
  WHERE o.order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon
  FROM coupons WHERE order_id = p_order_id
    AND status = 'VALID' AND expire_time > now();

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;

  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;

  RETURN GREATEST(v_final, 0);
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'PostgreSQL 函数示例：$$/LANGUAGE plpgsql/RETURNS/COALESCE/LEFT JOIN/RAISE NOTICE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'postgresql_procedure', $sam$-- PostgreSQL PL/pgSQL 存储过程：处理订单支付并扣减库存
-- 特性: CREATE PROCEDURE, IN/INOUT, $$ 引用, LOOP 游标, COMMIT, GET DIAGNOSTICS

CREATE OR REPLACE PROCEDURE pay_order(
  IN  p_order_id BIGINT,
  IN  p_method VARCHAR(20),
  IN  p_txn_no VARCHAR(64),
  INOUT p_result INT,
  INOUT p_message TEXT
) AS $$
DECLARE
  v_status    SMALLINT;
  v_total     NUMERIC(12,2);
  v_item      RECORD;
  v_row_count INT;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, now());

  UPDATE orders SET status = 1, update_time = now()
  WHERE order_id = p_order_id;

  FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE inventory SET stock = stock - v_item.quantity, update_time = now()
    WHERE product_id = v_item.product_id AND stock >= v_item.quantity;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      ROLLBACK; p_result := -3; p_message := '库存不足'; RETURN;
    END IF;
  END LOOP;

  COMMIT;
  p_result := 0; p_message := '支付成功';
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'PostgreSQL 存储过程示例：CREATE PROCEDURE/INOUT/$$/FOR RECORD/GET DIAGNOSTICS', true);

-- ============================================================
-- 4. KingbaseES (Oracle 兼容模式)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'kingbasees_ddl', $sam$-- KingbaseES 电商订单系统 DDL（Oracle 兼容模式）
-- 特性: NUMBER/VARCHAR2/序列/COMMENT ON/SYS_DATE/检查约束/索引

CREATE SEQUENCE seq_orders START WITH 1000 INCREMENT BY 1;

CREATE TABLE orders (
  order_id    NUMBER(20) DEFAULT seq_orders.NEXTVAL NOT NULL,
  order_no    VARCHAR2(32) NOT NULL,
  customer_id NUMBER(20) NOT NULL,
  total_amt   NUMBER(12,2) NOT NULL,
  status      NUMBER(2) DEFAULT 0,
  is_deleted  NUMBER(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT SYS_DATE,
  update_time TIMESTAMP,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_no UNIQUE (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
);

CREATE TABLE order_items (
  item_id    NUMBER(20) NOT NULL,
  order_id   NUMBER(20) NOT NULL,
  product    VARCHAR2(200) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  quantity   NUMBER(8) DEFAULT 1 NOT NULL,
  CONSTRAINT pk_items PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（序列自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'KingbaseES DDL 示例：NUMBER/VARCHAR2/序列/SYS_DATE/COMMENT ON/检查约束', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'kingbasees_function', $sam$-- KingbaseES PL/SQL 函数：计算订单折后金额
-- 特性: RETURN NUMBER/DECLARE/SELECT INTO/NVL/CASE/EXCEPTION/SYS_DATE

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id IN NUMBER,
  p_use_coupon IN BOOLEAN DEFAULT TRUE
) RETURN NUMBER IS
  v_total    NUMBER(12,2);
  v_discount NUMBER(12,2) := 0;
  v_coupon   NUMBER(12,2) := 0;
  v_level    NUMBER(2) := 1;
  v_final    NUMBER(12,2);
BEGIN
  SELECT total_amt, NVL(discount_amt, 0), NVL(customer_level, 1)
  INTO v_total, v_discount, v_level
  FROM orders WHERE order_id = p_order_id;

  SELECT NVL(SUM(amount), 0) INTO v_coupon
  FROM coupons WHERE order_id = p_order_id
    AND status = 'VALID' AND expire_time > SYS_DATE;

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;

  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;

  RETURN GREATEST(v_final, 0);
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN NULL;
  WHEN OTHERS THEN RETURN NULL;
END calc_final_amount;$sam$, 'string', 'KingbaseES 函数示例：PL/SQL RETURN/NVL/SYS_DATE/CASE/EXCEPTION', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'kingbasees_procedure', $sam$-- KingbaseES PL/SQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT 参数/FOR游标循环/COMMIT/ROLLBACK/SQL%ROWCOUNT

CREATE OR REPLACE PROCEDURE pay_order(
  p_order_id IN NUMBER, p_method IN VARCHAR2, p_txn_no IN VARCHAR2,
  p_result OUT NUMBER, p_message OUT VARCHAR2
) IS
  v_status    NUMBER(2); v_total NUMBER(12,2);
  e_no_stock  EXCEPTION;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  INSERT INTO payments(pay_id, order_id, method, txn_no, amount, create_time)
  VALUES(seq_payment.NEXTVAL, p_order_id, p_method, p_txn_no, v_total, SYS_DATE);

  UPDATE orders SET status = 1, update_time = SYS_DATE WHERE order_id = p_order_id;

  FOR item IN (SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id) LOOP
    UPDATE inventory SET stock = stock - item.quantity
    WHERE product_id = item.product_id AND stock >= item.quantity;
    IF SQL%ROWCOUNT = 0 THEN RAISE e_no_stock; END IF;
  END LOOP;

  COMMIT; p_result := 0; p_message := '支付成功';
EXCEPTION
  WHEN e_no_stock THEN ROLLBACK; p_result := -3; p_message := '库存不足';
  WHEN OTHERS THEN ROLLBACK; p_result := -9; p_message := SQLERRM;
END pay_order;$sam$, 'string', 'KingbaseES 存储过程示例：PL/SQL IN/OUT/FOR循环/COMMIT/SQL%ROWCOUNT', true);

-- ============================================================
-- 5. DM8 (达梦数据库，Oracle 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'dm8_ddl', $sam$-- 达梦 DM8 电商订单系统 DDL
-- 特性: NUMBER/VARCHAR2/IDENTITY自增列/COMMENT ON/检查约束/索引/表空间

CREATE TABLE orders (
  order_id    NUMBER(20) IDENTITY(1000,1) NOT NULL,
  order_no    VARCHAR2(32) NOT NULL,
  customer_id NUMBER(20) NOT NULL,
  total_amt   NUMBER(12,2) NOT NULL,
  status      NUMBER(2) DEFAULT 0,
  is_deleted  NUMBER(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT SYSDATE,
  update_time TIMESTAMP,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_no UNIQUE (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
);

CREATE TABLE order_items (
  item_id    NUMBER(20) IDENTITY(1,1) NOT NULL,
  order_id   NUMBER(20) NOT NULL,
  product    VARCHAR2(200) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  quantity   NUMBER(8) DEFAULT 1 NOT NULL,
  CONSTRAINT pk_items PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（IDENTITY自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'DM8 DDL 示例：NUMBER/IDENTITY自增列/VARCHAR2/SYSDATE/COMMENT ON/检查约束', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'dm8_function', $sam$-- 达梦 DM8 PL/SQL 函数：计算订单折后金额
-- 特性: RETURN NUMBER/DECLARE/SELECT INTO/NVL/CASE/EXCEPTION/SYSDATE/DM系统函数

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id IN NUMBER, p_use_coupon IN BOOLEAN DEFAULT TRUE
) RETURN NUMBER IS
  v_total    NUMBER(12,2); v_discount NUMBER(12,2) := 0;
  v_coupon   NUMBER(12,2) := 0; v_level NUMBER(2) := 1;
  v_final    NUMBER(12,2);
BEGIN
  SELECT total_amt, NVL(discount_amt, 0), NVL(customer_level, 1)
  INTO v_total, v_discount, v_level
  FROM orders WHERE order_id = p_order_id;

  SELECT NVL(SUM(amount), 0) INTO v_coupon
  FROM coupons WHERE order_id = p_order_id
    AND status = 'VALID' AND expire_time > SYSDATE;

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;

  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;
  RETURN GREATEST(v_final, 0);
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN NULL;
  WHEN OTHERS THEN RETURN NULL;
END calc_final_amount;$sam$, 'string', 'DM8 函数示例：PL/SQL RETURN/NVL/SYSDATE/CASE/EXCEPTION', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'dm8_procedure', $sam$-- 达梦 DM8 PL/SQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT 参数/DM系统包/FOR游标循环/COMMIT/ROLLBACK

CREATE OR REPLACE PROCEDURE pay_order(
  p_order_id IN NUMBER, p_method IN VARCHAR2, p_txn_no IN VARCHAR2,
  p_result OUT NUMBER, p_message OUT VARCHAR2
) IS
  v_status NUMBER(2); v_total NUMBER(12,2);
  e_no_stock EXCEPTION;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  INSERT INTO payments(pay_id, order_id, method, txn_no, amount, create_time)
  VALUES(SEQ_PAYMENT.NEXTVAL, p_order_id, p_method, p_txn_no, v_total, SYSDATE);

  UPDATE orders SET status = 1, update_time = SYSDATE WHERE order_id = p_order_id;

  FOR item IN (SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id) LOOP
    UPDATE inventory SET stock = stock - item.quantity
    WHERE product_id = item.product_id AND stock >= item.quantity;
    IF SQL%ROWCOUNT = 0 THEN RAISE e_no_stock; END IF;
  END LOOP;

  COMMIT; p_result := 0; p_message := '支付成功';
EXCEPTION
  WHEN e_no_stock THEN ROLLBACK; p_result := -3; p_message := '库存不足';
  WHEN OTHERS THEN ROLLBACK; p_result := -9; p_message := SQLERRM;
END pay_order;$sam$, 'string', 'DM8 存储过程示例：PL/SQL/OUT参数/FOR循环/COMMIT/ROLLBACK/SQL%ROWCOUNT', true);

-- ============================================================
-- 6. YashanDB (崖山数据库，Oracle 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'yashan_ddl', $sam$-- YashanDB 电商订单系统 DDL
-- 特性: NUMBER/VARCHAR2/IDENTITY自增/COMMENT ON/全局索引/检查约束

CREATE TABLE orders (
  order_id    NUMBER(20) GENERATED BY DEFAULT AS IDENTITY(START WITH 1000 INCREMENT BY 1) NOT NULL,
  order_no    VARCHAR2(32) NOT NULL,
  customer_id NUMBER(20) NOT NULL,
  total_amt   NUMBER(12,2) NOT NULL,
  status      NUMBER(2) DEFAULT 0,
  is_deleted  NUMBER(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  update_time TIMESTAMP,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_no UNIQUE (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
);

CREATE TABLE order_items (
  item_id    NUMBER(20) GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  order_id   NUMBER(20) NOT NULL,
  product    VARCHAR2(200) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  quantity   NUMBER(8) DEFAULT 1 NOT NULL,
  CONSTRAINT pk_items PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（IDENTITY自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'YashanDB DDL 示例：IDENTITY自增/NUMBER/VARCHAR2/COMMENT ON/检查约束', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'yashan_function', $sam$-- YashanDB PL/SQL 函数：计算订单折后金额
-- 特性: RETURN NUMBER/SELECT INTO/NVL/CASE/SYSTIMESTAMP/EXCEPTION

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id IN NUMBER, p_use_coupon IN BOOLEAN DEFAULT TRUE
) RETURN NUMBER IS
  v_total    NUMBER(12,2); v_discount NUMBER(12,2) := 0;
  v_coupon   NUMBER(12,2) := 0; v_level NUMBER(2) := 1;
  v_final    NUMBER(12,2);
BEGIN
  SELECT total_amt, NVL(discount_amt, 0), NVL(customer_level, 1)
  INTO v_total, v_discount, v_level
  FROM orders WHERE order_id = p_order_id;

  SELECT NVL(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > SYSTIMESTAMP;

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;
  RETURN GREATEST(v_final, 0);
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN NULL;
  WHEN OTHERS THEN RETURN NULL;
END calc_final_amount;$sam$, 'string', 'YashanDB 函数示例：PL/SQL RETURN/SELECT INTO/NVL/SYSTIMESTAMP/EXCEPTION', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'yashan_procedure', $sam$-- YashanDB PL/SQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT 参数/FOR游标/COMMIT/ROLLBACK/SQL%ROWCOUNT

CREATE OR REPLACE PROCEDURE pay_order(
  p_order_id IN NUMBER, p_method IN VARCHAR2, p_txn_no IN VARCHAR2,
  p_result OUT NUMBER, p_message OUT VARCHAR2
) IS
  v_status NUMBER(2); v_total NUMBER(12,2); e_no_stock EXCEPTION;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  INSERT INTO payments(pay_id, order_id, method, txn_no, amount, create_time)
  VALUES(SEQ_PAYMENT.NEXTVAL, p_order_id, p_method, p_txn_no, v_total, SYSTIMESTAMP);

  UPDATE orders SET status = 1, update_time = SYSTIMESTAMP WHERE order_id = p_order_id;

  FOR item IN (SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id) LOOP
    UPDATE inventory SET stock = stock - item.quantity
    WHERE product_id = item.product_id AND stock >= item.quantity;
    IF SQL%ROWCOUNT = 0 THEN RAISE e_no_stock; END IF;
  END LOOP;

  COMMIT; p_result := 0; p_message := '支付成功';
EXCEPTION
  WHEN e_no_stock THEN ROLLBACK; p_result := -3; p_message := '库存不足';
  WHEN OTHERS THEN ROLLBACK; p_result := -9; p_message := SQLERRM;
END pay_order;$sam$, 'string', 'YashanDB 存储过程示例：PL/SQL/FOR游标/COMMIT/SQL%ROWCOUNT/EXCEPTION', true);

-- ============================================================
-- 7. GaussDB (华为高斯数据库，PostgreSQL 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gaussdb_ddl', $sam$-- GaussDB 电商订单系统 DDL
-- 特性: INTEGER/VARCHAR/NUMERIC/IDENTITY自增/COMMENT ON/检查约束/分布式键

CREATE TABLE orders (
  order_id    INTEGER NOT NULL DEFAULT nextval(''seq_orders''),
  order_no    VARCHAR(32) NOT NULL,
  customer_id INTEGER NOT NULL,
  total_amt   NUMERIC(12,2) NOT NULL,
  status      SMALLINT DEFAULT 0,
  is_deleted  SMALLINT DEFAULT 0,
  create_time TIMESTAMP DEFAULT current_timestamp,
  update_time TIMESTAMP,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_no UNIQUE (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
) DISTRIBUTE BY HASH(order_id);

CREATE TABLE order_items (
  item_id    INTEGER NOT NULL,
  order_id   INTEGER NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  CONSTRAINT pk_items PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
) DISTRIBUTE BY HASH(order_id);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（序列自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status) LOCAL;
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'GaussDB DDL 示例：INTEGER/序列/DISTRIBUTE BY HASH/LOCAL索引/COMMENT ON', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gaussdb_function', $sam$-- GaussDB PL/pgSQL 函数：计算订单折后金额
-- 特性: $$ 引用/LANGUAGE plpgsql/RETURNS/DECLARE/COALESCE

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id INTEGER, p_use_coupon BOOLEAN DEFAULT TRUE
) RETURNS NUMERIC(12,2) AS $$
DECLARE
  v_total    NUMERIC(12,2); v_discount NUMERIC(12,2) := 0;
  v_coupon   NUMERIC(12,2) := 0; v_level INT := 1;
  v_final    NUMERIC(12,2);
BEGIN
  SELECT total_amt, COALESCE(discount_amt, 0) INTO v_total, v_discount
  FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = ''VALID'' AND expire_time > current_timestamp;

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;
  RETURN GREATEST(v_final, 0);
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN NULL;
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'GaussDB 函数示例：$$/LANGUAGE plpgsql/COALESCE/GREATEST/EXCEPTION', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gaussdb_procedure', $sam$-- GaussDB PL/pgSQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT 参数/FOR RECORD/COMMIT/ROLLBACK

CREATE OR REPLACE PROCEDURE pay_order(
  IN p_order_id INTEGER, IN p_method VARCHAR, IN p_txn_no VARCHAR,
  OUT p_result INT, OUT p_message VARCHAR
) AS $$
DECLARE
  v_status SMALLINT; v_total NUMERIC(12,2); v_item RECORD; v_rc INT;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := ''状态不允许支付''; RETURN;
  END IF;

  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, current_timestamp);

  UPDATE orders SET status = 1, update_time = current_timestamp WHERE order_id = p_order_id;

  FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE inventory SET stock = stock - v_item.quantity
    WHERE product_id = v_item.product_id AND stock >= v_item.quantity;
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    IF v_rc = 0 THEN ROLLBACK; p_result := -3; p_message := ''库存不足''; RETURN; END IF;
  END LOOP;

  COMMIT; p_result := 0; p_message := ''支付成功'';
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'GaussDB 存储过程示例：PL/pgSQL/IN/OUT/FOR RECORD/GET DIAGNOSTICS/COMMIT', true);

-- ============================================================
-- 8. GoldenDB (中兴分布式数据库，MySQL 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'goldendb_ddl', $sam$-- GoldenDB 电商订单系统 DDL
-- 特性: INT AUTO_INCREMENT/VARCHAR/DECIMAL/TINYINT/内联COMMENT/ENGINE/分区

CREATE TABLE orders (
  order_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_no    VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  total_amt   DECIMAL(12,2) NOT NULL,
  status      TINYINT DEFAULT 0,
  is_deleted  TINYINT(1) DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表';

CREATE TABLE order_items (
  item_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_id   BIGINT NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'GoldenDB DDL 示例：AUTO_INCREMENT/DECIMAL/TINYINT/内联COMMENT/ENGINE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'goldendb_function', $sam$-- GoldenDB 函数：计算订单折后金额
-- 特性: RETURNS/DETERMINISTIC/DECLARE HANDLER/IF-THEN/COALESCE/NOW

DELIMITER //
CREATE FUNCTION calc_final_amount(
  p_order_id BIGINT, p_use_coupon TINYINT
) RETURNS DECIMAL(12,2) DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(12,2); DECLARE v_discount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_coupon DECIMAL(12,2) DEFAULT 0; DECLARE v_level INT DEFAULT 1;
  DECLARE v_final DECIMAL(12,2);
  DECLARE EXIT HANDLER FOR NOT FOUND RETURN NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION RETURN NULL;

  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > NOW();

  SET v_final = v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN SET v_final = v_final - v_coupon; END IF;
  SET v_final = v_final - v_discount;
  RETURN GREATEST(v_final, 0);
END//
DELIMITER ;$sam$, 'string', 'GoldenDB 函数示例：RETURNS/DELIMITER/DECLARE HANDLER/COALESCE/NOW/GREATEST', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'goldendb_procedure', $sam$-- GoldenDB 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT/游标LOOP/DECLARE HANDLER/START TRANSACTION/ROW_COUNT

DELIMITER //
CREATE PROCEDURE pay_order(
  IN p_order_id BIGINT, IN p_method VARCHAR(20), IN p_txn_no VARCHAR(64),
  OUT p_result INT, OUT p_message VARCHAR(200)
)
BEGIN
  DECLARE v_status TINYINT; DECLARE v_total DECIMAL(12,2);
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_product_id BIGINT; DECLARE v_qty INT;
  DECLARE cur_items CURSOR FOR SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_result = -9; SET p_message = '系统异常'; END;

  SELECT status, total_amt INTO v_status, v_total FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN SET p_result = -1; SET p_message = '状态不允许支付'; END IF;

  START TRANSACTION;
  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, NOW());

  UPDATE orders SET status = 1, update_time = NOW() WHERE order_id = p_order_id;

  OPEN cur_items;
  read_loop: LOOP
    FETCH cur_items INTO v_product_id, v_qty;
    IF v_done THEN LEAVE read_loop; END IF;
    UPDATE inventory SET stock = stock - v_qty WHERE product_id = v_product_id AND stock >= v_qty;
    IF ROW_COUNT() = 0 THEN ROLLBACK; SET p_result = -3; SET p_message = '库存不足'; END IF;
  END LOOP;
  CLOSE cur_items;

  COMMIT; SET p_result = 0; SET p_message = '支付成功';
END//
DELIMITER ;$sam$, 'string', 'GoldenDB 存储过程示例：游标LOOP/DECLARE HANDLER/START TRANSACTION/COMMIT/ROW_COUNT', true);

-- ============================================================
-- 9. OceanBase Oracle 模式
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oceanbase_oracle_ddl', $sam$-- OceanBase (Oracle 模式) 电商订单系统 DDL
-- 特性: NUMBER/VARCHAR2/序列/COMMENT ON/分区/检查约束/索引

CREATE SEQUENCE seq_orders START WITH 1000 INCREMENT BY 1 NOCACHE;

CREATE TABLE orders (
  order_id    NUMBER(20) DEFAULT seq_orders.NEXTVAL NOT NULL,
  order_no    VARCHAR2(32) NOT NULL,
  customer_id NUMBER(20) NOT NULL,
  total_amt   NUMBER(12,2) NOT NULL,
  status      NUMBER(2) DEFAULT 0,
  is_deleted  NUMBER(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  update_time TIMESTAMP,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_no UNIQUE (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
) PARTITION BY HASH(order_id) PARTITIONS 4;

CREATE TABLE order_items (
  item_id    NUMBER(20) NOT NULL,
  order_id   NUMBER(20) NOT NULL,
  product    VARCHAR2(200) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  quantity   NUMBER(8) DEFAULT 1 NOT NULL,
  CONSTRAINT pk_items PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
) PARTITION BY HASH(order_id) PARTITIONS 4;

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（序列自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';

CREATE INDEX idx_orders_customer ON orders(customer_id) LOCAL;
CREATE INDEX idx_orders_status ON orders(status) LOCAL;
CREATE INDEX idx_orders_time ON orders(create_time) LOCAL;
CREATE INDEX idx_items_order ON order_items(order_id) LOCAL;$sam$, 'string', 'OceanBase(Oracle) DDL 示例：NUMBER/序列/PARTITION BY HASH/LOCAL索引/COMMENT ON', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oceanbase_oracle_function', $sam$-- OceanBase (Oracle 模式) PL/SQL 函数：计算订单折后金额
-- 特性: RETURN NUMBER/SELECT INTO/NVL/CASE/SYSTIMESTAMP/EXCEPTION

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id IN NUMBER, p_use_coupon IN BOOLEAN DEFAULT TRUE
) RETURN NUMBER IS
  v_total NUMBER(12,2); v_discount NUMBER(12,2) := 0;
  v_coupon NUMBER(12,2) := 0; v_level NUMBER(2) := 1;
  v_final NUMBER(12,2);
BEGIN
  SELECT total_amt, NVL(discount_amt, 0), NVL(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT NVL(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > SYSTIMESTAMP;

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;
  RETURN GREATEST(v_final, 0);
EXCEPTION
  WHEN NO_DATA_FOUND THEN RETURN NULL;
  WHEN OTHERS THEN RETURN NULL;
END calc_final_amount;$sam$, 'string', 'OceanBase(Oracle) 函数示例：PL/SQL RETURN/NVL/SYSTIMESTAMP/CASE/EXCEPTION', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oceanbase_oracle_procedure', $sam$-- OceanBase (Oracle 模式) PL/SQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT 参数/FOR游标/COMMIT/ROLLBACK/SQL%ROWCOUNT

CREATE OR REPLACE PROCEDURE pay_order(
  p_order_id IN NUMBER, p_method IN VARCHAR2, p_txn_no IN VARCHAR2,
  p_result OUT NUMBER, p_message OUT VARCHAR2
) IS
  v_status NUMBER(2); v_total NUMBER(12,2); e_no_stock EXCEPTION;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  INSERT INTO payments(pay_id, order_id, method, txn_no, amount, create_time)
  VALUES(seq_payment.NEXTVAL, p_order_id, p_method, p_txn_no, v_total, SYSTIMESTAMP);

  UPDATE orders SET status = 1, update_time = SYSTIMESTAMP WHERE order_id = p_order_id;

  FOR item IN (SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id) LOOP
    UPDATE inventory SET stock = stock - item.quantity
    WHERE product_id = item.product_id AND stock >= item.quantity;
    IF SQL%ROWCOUNT = 0 THEN RAISE e_no_stock; END IF;
  END LOOP;

  COMMIT; p_result := 0; p_message := '支付成功';
EXCEPTION
  WHEN e_no_stock THEN ROLLBACK; p_result := -3; p_message := '库存不足';
  WHEN OTHERS THEN ROLLBACK; p_result := -9; p_message := SQLERRM;
END pay_order;$sam$, 'string', 'OceanBase(Oracle) 存储过程示例：PL/SQL/FOR游标/COMMIT/SQL%ROWCOUNT/EXCEPTION', true);

-- ============================================================
-- 10. OceanBase MySQL 模式
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oceanbase_mysql_ddl', $sam$-- OceanBase (MySQL 模式) 电商订单系统 DDL
-- 特性: INT AUTO_INCREMENT/VARCHAR/DECIMAL/TINYINT/内联COMMENT/PARTITION BY HASH

CREATE TABLE orders (
  order_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_no    VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  total_amt   DECIMAL(12,2) NOT NULL,
  status      TINYINT DEFAULT 0,
  is_deleted  TINYINT(1) DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6)
) DEFAULT CHARSET=utf8mb4 COMMENT='订单主表'
  PARTITION BY HASH(order_id) PARTITIONS 4;

CREATE TABLE order_items (
  item_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_id   BIGINT NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表'
  PARTITION BY HASH(order_id) PARTITIONS 4;

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'OceanBase(MySQL) DDL 示例：AUTO_INCREMENT/内联COMMENT/PARTITION BY HASH/DECIMAL', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oceanbase_mysql_function', $sam$-- OceanBase (MySQL 模式) 函数：计算订单折后金额
-- 特性: RETURNS/DETERMINISTIC/DECLARE HANDLER/COALESCE/NOW/CASE

DELIMITER //
CREATE FUNCTION calc_final_amount(
  p_order_id BIGINT, p_use_coupon TINYINT
) RETURNS DECIMAL(12,2) DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(12,2); DECLARE v_discount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_coupon DECIMAL(12,2) DEFAULT 0; DECLARE v_level INT DEFAULT 1;
  DECLARE v_final DECIMAL(12,2);
  DECLARE EXIT HANDLER FOR NOT FOUND RETURN NULL;

  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > NOW();

  SET v_final = v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN SET v_final = v_final - v_coupon; END IF;
  SET v_final = v_final - v_discount;
  RETURN GREATEST(v_final, 0);
END//
DELIMITER ;$sam$, 'string', 'OceanBase(MySQL) 函数示例：RETURNS/DELIMITER/DECLARE HANDLER/COALESCE/NOW/GREATEST', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'oceanbase_mysql_procedure', $sam$-- OceanBase (MySQL 模式) 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT/游标LOOP/DECLARE HANDLER/START TRANSACTION/COMMIT

DELIMITER //
CREATE PROCEDURE pay_order(
  IN p_order_id BIGINT, IN p_method VARCHAR(20), IN p_txn_no VARCHAR(64),
  OUT p_result INT, OUT p_message VARCHAR(200)
)
BEGIN
  DECLARE v_status TINYINT; DECLARE v_total DECIMAL(12,2);
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_product_id BIGINT; DECLARE v_qty INT;
  DECLARE cur_items CURSOR FOR SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_result = -9; SET p_message = '系统异常'; END;

  SELECT status, total_amt INTO v_status, v_total FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN SET p_result = -1; SET p_message = '状态不允许支付'; END IF;

  START TRANSACTION;
  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, NOW());

  UPDATE orders SET status = 1, update_time = NOW() WHERE order_id = p_order_id;

  OPEN cur_items;
  read_loop: LOOP
    FETCH cur_items INTO v_product_id, v_qty;
    IF v_done THEN LEAVE read_loop; END IF;
    UPDATE inventory SET stock = stock - v_qty WHERE product_id = v_product_id AND stock >= v_qty;
    IF ROW_COUNT() = 0 THEN ROLLBACK; SET p_result = -3; SET p_message = '库存不足'; END IF;
  END LOOP;
  CLOSE cur_items;

  COMMIT; SET p_result = 0; SET p_message = '支付成功';
END//
DELIMITER ;$sam$, 'string', 'OceanBase(MySQL) 存储过程示例：游标LOOP/DECLARE HANDLER/START TRANSACTION/ROW_COUNT', true);

-- ============================================================
-- 11. TDSQL MySQL (腾讯分布式，MySQL 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tdsql_mysql_ddl', $sam$-- TDSQL MySQL 电商订单系统 DDL
-- 特性: INT AUTO_INCREMENT/VARCHAR/DECIMAL/shardkey/内联COMMENT/ENGINE

CREATE TABLE orders (
  order_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_no    VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  total_amt   DECIMAL(12,2) NOT NULL,
  status      TINYINT DEFAULT 0,
  is_deleted  TINYINT(1) DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表' shardkey=order_id;

CREATE TABLE order_items (
  item_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_id   BIGINT NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表' shardkey=order_id;

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'TDSQL MySQL DDL 示例：AUTO_INCREMENT/shardkey/DECIMAL/内联COMMENT/CHECK约束', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tdsql_mysql_function', $sam$-- TDSQL MySQL 函数：计算订单折后金额
-- 特性: RETURNS/DETERMINISTIC/DECLARE HANDLER/IF-THEN/COALESCE/NOW

DELIMITER //
CREATE FUNCTION calc_final_amount(
  p_order_id BIGINT, p_use_coupon TINYINT
) RETURNS DECIMAL(12,2) DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(12,2); DECLARE v_discount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_coupon DECIMAL(12,2) DEFAULT 0; DECLARE v_level INT DEFAULT 1;
  DECLARE v_final DECIMAL(12,2);
  DECLARE EXIT HANDLER FOR NOT FOUND RETURN NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION RETURN NULL;

  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > NOW();

  SET v_final = v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN SET v_final = v_final - v_coupon; END IF;
  SET v_final = v_final - v_discount;
  RETURN GREATEST(v_final, 0);
END//
DELIMITER ;$sam$, 'string', 'TDSQL MySQL 函数示例：RETURNS/DELIMITER/DECLARE HANDLER/COALESCE/NOW/GREATEST', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tdsql_mysql_procedure', $sam$-- TDSQL MySQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT/游标LOOP/DECLARE HANDLER/START TRANSACTION

DELIMITER //
CREATE PROCEDURE pay_order(
  IN p_order_id BIGINT, IN p_method VARCHAR(20), IN p_txn_no VARCHAR(64),
  OUT p_result INT, OUT p_message VARCHAR(200)
)
BEGIN
  DECLARE v_status TINYINT; DECLARE v_total DECIMAL(12,2);
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_product_id BIGINT; DECLARE v_qty INT;
  DECLARE cur_items CURSOR FOR SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_result = -9; SET p_message = '系统异常'; END;

  SELECT status, total_amt INTO v_status, v_total FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN SET p_result = -1; SET p_message = '状态不允许支付'; END IF;

  START TRANSACTION;
  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, NOW());

  UPDATE orders SET status = 1, update_time = NOW() WHERE order_id = p_order_id;

  OPEN cur_items;
  read_loop: LOOP
    FETCH cur_items INTO v_product_id, v_qty;
    IF v_done THEN LEAVE read_loop; END IF;
    UPDATE inventory SET stock = stock - v_qty WHERE product_id = v_product_id AND stock >= v_qty;
    IF ROW_COUNT() = 0 THEN ROLLBACK; SET p_result = -3; SET p_message = '库存不足'; END IF;
  END LOOP;
  CLOSE cur_items;

  COMMIT; SET p_result = 0; SET p_message = '支付成功';
END//
DELIMITER ;$sam$, 'string', 'TDSQL MySQL 存储过程示例：游标LOOP/DECLARE HANDLER/START TRANSACTION/COMMIT/ROW_COUNT', true);

-- ============================================================
-- 12. TDSQL PostgreSQL (腾讯分布式，PG 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tdsql_pg_ddl', $sam$-- TDSQL PostgreSQL 电商订单系统 DDL
-- 特性: SERIAL/VARCHAR/NUMERIC/BOOLEAN/TIMESTAMPTZ/DISTRIBUTE BY/COMMENT ON

CREATE TABLE orders (
  order_id    SERIAL NOT NULL,
  order_no    VARCHAR(32) NOT NULL,
  customer_id INTEGER NOT NULL,
  total_amt   NUMERIC(12,2) NOT NULL,
  status      SMALLINT DEFAULT 0,
  is_deleted  BOOLEAN DEFAULT FALSE,
  create_time TIMESTAMPTZ DEFAULT now(),
  update_time TIMESTAMPTZ,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_no UNIQUE (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
) DISTRIBUTE BY SHARD(order_id);

CREATE TABLE order_items (
  item_id    SERIAL NOT NULL,
  order_id   INTEGER NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  CONSTRAINT pk_items PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
) DISTRIBUTE BY SHARD(order_id);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（SERIAL自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'TDSQL PG DDL 示例：SERIAL/NUMERIC/DISTRIBUTE BY SHARD/COMMENT ON/BOOLEAN', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tdsql_pg_function', $sam$-- TDSQL PostgreSQL PL/pgSQL 函数：计算订单折后金额
-- 特性: $$ 引用/LANGUAGE plpgsql/RETURNS/DECLARE/COALESCE/::类型转换

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id INTEGER, p_use_coupon BOOLEAN DEFAULT TRUE
) RETURNS NUMERIC(12,2) AS $$
DECLARE
  v_total    NUMERIC(12,2); v_discount NUMERIC(12,2) := 0;
  v_coupon   NUMERIC(12,2) := 0; v_level INT := 1;
  v_final    NUMERIC(12,2);
BEGIN
  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > now();

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;
  RETURN GREATEST(v_final, 0);
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'TDSQL PG 函数示例：$$/LANGUAGE plpgsql/COALESCE/GREATEST/BOOLEAN', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tdsql_pg_procedure', $sam$-- TDSQL PostgreSQL PL/pgSQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/INOUT/FOR RECORD/GET DIAGNOSTICS/COMMIT/ROLLBACK

CREATE OR REPLACE PROCEDURE pay_order(
  IN p_order_id INTEGER, IN p_method VARCHAR, IN p_txn_no VARCHAR,
  INOUT p_result INT, INOUT p_message TEXT
) AS $$
DECLARE
  v_status SMALLINT; v_total NUMERIC(12,2);
  v_item RECORD; v_rc INT;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, now());

  UPDATE orders SET status = 1, update_time = now() WHERE order_id = p_order_id;

  FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE inventory SET stock = stock - v_item.quantity
    WHERE product_id = v_item.product_id AND stock >= v_item.quantity;
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    IF v_rc = 0 THEN ROLLBACK; p_result := -3; p_message := '库存不足'; RETURN; END IF;
  END LOOP;

  COMMIT; p_result := 0; p_message := '支付成功';
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'TDSQL PG 存储过程示例：INOUT/FOR RECORD/$$/GET DIAGNOSTICS/COMMIT', true);

-- ============================================================
-- 13. TiDB (PingCAP 分布式，MySQL 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tidb_ddl', $sam$-- TiDB 电商订单系统 DDL
-- 特性: INT AUTO_INCREMENT/VARCHAR/DECIMAL/TINYINT/内联COMMENT/AUTO_RANDOM/分区

CREATE TABLE orders (
  order_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_no    VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  total_amt   DECIMAL(12,2) NOT NULL,
  status      TINYINT DEFAULT 0,
  is_deleted  TINYINT(1) DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6)
) COMMENT='订单主表';

CREATE TABLE order_items (
  item_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_id   BIGINT NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) COMMENT='订单明细表';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'TiDB DDL 示例：AUTO_INCREMENT/DECIMAL/TINYINT/内联COMMENT/CHECK约束', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tidb_function', $sam$-- TiDB 函数：计算订单折后金额
-- 特性: RETURNS/DETERMINISTIC/NO SQL/COALESCE/NOW/CASE（TiDB 不支持游标/异常处理）

CREATE FUNCTION calc_final_amount(
  p_order_id BIGINT, p_use_coupon TINYINT
) RETURNS DECIMAL(12,2) DETERMINISTIC NO SQL
BEGIN
  DECLARE v_total DECIMAL(12,2); DECLARE v_discount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_coupon DECIMAL(12,2) DEFAULT 0; DECLARE v_level INT DEFAULT 1;
  DECLARE v_final DECIMAL(12,2);

  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > NOW();

  SET v_final = v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN SET v_final = v_final - v_coupon; END IF;
  SET v_final = v_final - v_discount;
  RETURN GREATEST(v_final, 0);
END;$sam$, 'string', 'TiDB 函数示例：RETURNS/DETERMINISTIC/NO SQL/COALESCE/NOW/GREATEST', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'tidb_procedure', $sam$-- TiDB 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT/游标LOOP/START TRANSACTION/TiDB 特有语法

CREATE PROCEDURE pay_order(
  IN p_order_id BIGINT, IN p_method VARCHAR(20), IN p_txn_no VARCHAR(64),
  OUT p_result INT, OUT p_message VARCHAR(200)
)
BEGIN
  DECLARE v_status TINYINT; DECLARE v_total DECIMAL(12,2);
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_product_id BIGINT; DECLARE v_qty INT;
  DECLARE cur_items CURSOR FOR SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_result = -9; SET p_message = '系统异常'; END;

  SELECT status, total_amt INTO v_status, v_total FROM orders WHERE order_id = p_order_id;

  IF v_status <> 0 THEN SET p_result = -1; SET p_message = '状态不允许支付'; END IF;

  START TRANSACTION;
  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, NOW());

  UPDATE orders SET status = 1, update_time = NOW() WHERE order_id = p_order_id;

  OPEN cur_items;
  read_loop: LOOP
    FETCH cur_items INTO v_product_id, v_qty;
    IF v_done THEN LEAVE read_loop; END IF;
    UPDATE inventory SET stock = stock - v_qty WHERE product_id = v_product_id AND stock >= v_qty;
    IF ROW_COUNT() = 0 THEN ROLLBACK; SET p_result = -3; SET p_message = '库存不足'; END IF;
  END LOOP;
  CLOSE cur_items;

  COMMIT; SET p_result = 0; SET p_message = '支付成功';
END;$sam$, 'string', 'TiDB 存储过程示例：IN/OUT/游标LOOP/CONTINUE HANDLER/START TRANSACTION', true);

-- ============================================================
-- 14. GBase 8a (南大通用分析型，MySQL 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8a_ddl', $sam$-- GBase 8a 电商订单系统 DDL
-- 特性: INT AUTO_INCREMENT/VARCHAR/DECIMAL/TINYINT/内联COMMENT/ENGINE/分区

CREATE TABLE orders (
  order_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_no    VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  total_amt   DECIMAL(12,2) NOT NULL,
  status      TINYINT DEFAULT 0,
  is_deleted  TINYINT(1) DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6)
) ENGINE=EXPRESS DEFAULT CHARSET=utf8mb4 COMMENT='订单主表';

CREATE TABLE order_items (
  item_id    BIGINT NOT NULL AUTO_INCREMENT,
  order_id   BIGINT NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (item_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=EXPRESS DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'GBase 8a DDL 示例：AUTO_INCREMENT/ENGINE=EXPRESS/DECIMAL/内联COMMENT', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8a_function', $sam$-- GBase 8a 函数：计算订单折后金额
-- 特性: RETURNS/DETERMINISTIC/COALESCE/NOW/CASE/GBase扩展

CREATE FUNCTION calc_final_amount(
  p_order_id BIGINT, p_use_coupon TINYINT
) RETURNS DECIMAL(12,2) DETERMINISTIC
BEGIN
  DECLARE v_total DECIMAL(12,2); DECLARE v_discount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_coupon DECIMAL(12,2) DEFAULT 0; DECLARE v_level INT DEFAULT 1;
  DECLARE v_final DECIMAL(12,2);

  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > NOW();

  SET v_final = v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN SET v_final = v_final - v_coupon; END IF;
  SET v_final = v_final - v_discount;
  RETURN GREATEST(v_final, 0);
END;$sam$, 'string', 'GBase 8a 函数示例：RETURNS/DETERMINISTIC/COALESCE/NOW/CASE/GREATEST', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8a_procedure', $sam$-- GBase 8a 存储过程：处理订单支付并扣减库存
-- 特性: IN/OUT/游标LOOP/START TRANSACTION/GBase扩展语法

CREATE PROCEDURE pay_order(
  IN p_order_id BIGINT, IN p_method VARCHAR(20), IN p_txn_no VARCHAR(64),
  OUT p_result INT, OUT p_message VARCHAR(200)
)
BEGIN
  DECLARE v_status TINYINT; DECLARE v_total DECIMAL(12,2);
  DECLARE v_done INT DEFAULT FALSE;
  DECLARE v_product_id BIGINT; DECLARE v_qty INT;
  DECLARE cur_items CURSOR FOR SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

  SELECT status, total_amt INTO v_status, v_total FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN SET p_result = -1; SET p_message = '状态不允许支付'; END IF;

  START TRANSACTION;
  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, NOW());

  UPDATE orders SET status = 1, update_time = NOW() WHERE order_id = p_order_id;

  OPEN cur_items;
  read_loop: LOOP
    FETCH cur_items INTO v_product_id, v_qty;
    IF v_done THEN LEAVE read_loop; END IF;
    UPDATE inventory SET stock = stock - v_qty WHERE product_id = v_product_id AND stock >= v_qty;
    IF ROW_COUNT() = 0 THEN ROLLBACK; SET p_result = -3; SET p_message = '库存不足'; END IF;
  END LOOP;
  CLOSE cur_items;

  COMMIT; SET p_result = 0; SET p_message = '支付成功';
END;$sam$, 'string', 'GBase 8a 存储过程示例：游标LOOP/START TRANSACTION/COMMIT/ROW_COUNT', true);

-- ============================================================
-- 15. GBase 8c (南大通用，PostgreSQL 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8c_ddl', $sam$-- GBase 8c 电商订单系统 DDL
-- 特性: SERIAL/VARCHAR/NUMERIC/BOOLEAN/TIMESTAMPTZ/COMMENT ON/IF NOT EXISTS

CREATE TABLE IF NOT EXISTS orders (
  order_id    SERIAL PRIMARY KEY,
  order_no    VARCHAR(32) NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  total_amt   NUMERIC(12,2) NOT NULL,
  status      SMALLINT DEFAULT 0,
  is_deleted  BOOLEAN DEFAULT FALSE,
  create_time TIMESTAMPTZ DEFAULT current_timestamp,
  update_time TIMESTAMPTZ,
  CONSTRAINT ck_orders_status CHECK (status BETWEEN 0 AND 6),
  CONSTRAINT ck_orders_amt CHECK (total_amt >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
  item_id    SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product    VARCHAR(200) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  CONSTRAINT ck_items_qty CHECK (quantity > 0)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（SERIAL自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'GBase 8c DDL 示例：SERIAL/NUMERIC/COMMENT ON/IF NOT EXISTS/ON DELETE CASCADE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8c_function', $sam$-- GBase 8c PL/pgSQL 函数：计算订单折后金额
-- 特性: $$ 引用/LANGUAGE plpgsql/RETURNS/DECLARE/COALESCE

CREATE OR REPLACE FUNCTION calc_final_amount(
  p_order_id INTEGER, p_use_coupon BOOLEAN DEFAULT TRUE
) RETURNS NUMERIC(12,2) AS $$
DECLARE
  v_total NUMERIC(12,2); v_discount NUMERIC(12,2) := 0;
  v_coupon NUMERIC(12,2) := 0; v_level INT := 1;
  v_final NUMERIC(12,2);
BEGIN
  SELECT total_amt, COALESCE(discount_amt, 0), COALESCE(customer_level, 1)
  INTO v_total, v_discount, v_level FROM orders WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_coupon FROM coupons
  WHERE order_id = p_order_id AND status = 'VALID' AND expire_time > current_timestamp;

  v_final := v_total * CASE v_level
    WHEN 5 THEN 0.85 WHEN 4 THEN 0.90 WHEN 3 THEN 0.95
    WHEN 2 THEN 0.98 ELSE 1.0
  END;
  IF p_use_coupon THEN v_final := v_final - v_coupon; END IF;
  v_final := v_final - v_discount;
  RETURN GREATEST(v_final, 0);
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'GBase 8c 函数示例：$$/LANGUAGE plpgsql/COALESCE/GREATEST/CASE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8c_procedure', $sam$-- GBase 8c PL/pgSQL 存储过程：处理订单支付并扣减库存
-- 特性: IN/INOUT/FOR RECORD/GET DIAGNOSTICS/COMMIT

CREATE OR REPLACE PROCEDURE pay_order(
  IN p_order_id INTEGER, IN p_method VARCHAR, IN p_txn_no VARCHAR,
  INOUT p_result INT, INOUT p_message TEXT
) AS $$
DECLARE
  v_status SMALLINT; v_total NUMERIC(12,2);
  v_item RECORD; v_rc INT;
BEGIN
  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id FOR UPDATE;

  IF v_status <> 0 THEN
    p_result := -1; p_message := '状态不允许支付'; RETURN;
  END IF;

  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, current_timestamp);

  UPDATE orders SET status = 1, update_time = current_timestamp WHERE order_id = p_order_id;

  FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE inventory SET stock = stock - v_item.quantity
    WHERE product_id = v_item.product_id AND stock >= v_item.quantity;
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    IF v_rc = 0 THEN ROLLBACK; p_result := -3; p_message := '库存不足'; RETURN; END IF;
  END LOOP;

  COMMIT; p_result := 0; p_message := '支付成功';
END;
$$ LANGUAGE plpgsql;$sam$, 'string', 'GBase 8c 存储过程示例：INOUT/FOR RECORD/$$/GET DIAGNOSTICS/COMMIT', true);

-- ============================================================
-- 16. GBase 8s (南大通用，Informix 兼容)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8s_ddl', $sam$-- GBase 8s (Informix) 电商订单系统 DDL
-- 特性: SERIAL/INTEGER/VARCHAR/MONEY/DATETIME YEAR TO SECOND/COMMENT ON/LOCK MODE

CREATE SEQUENCE seq_orders START WITH 1000 INCREMENT BY 1;

CREATE TABLE orders (
  order_id    SERIAL NOT NULL,
  order_no    VARCHAR(32) NOT NULL,
  customer_id INTEGER NOT NULL,
  total_amt   MONEY(12,2) NOT NULL,
  status      SMALLINT DEFAULT 0,
  is_deleted  SMALLINT DEFAULT 0,
  create_time DATETIME YEAR TO SECOND DEFAULT CURRENT YEAR TO SECOND,
  update_time DATETIME YEAR TO SECOND,
  PRIMARY KEY (order_id),
  UNIQUE (order_no),
  CHECK (status BETWEEN 0 AND 6),
  CHECK (total_amt >= 0::MONEY)
) LOCK MODE ROW;

CREATE TABLE order_items (
  item_id    SERIAL NOT NULL,
  order_id   INTEGER NOT NULL,
  product    VARCHAR(200) NOT NULL,
  unit_price MONEY(12,2) NOT NULL,
  quantity   INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (item_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CHECK (quantity > 0)
) LOCK MODE ROW;

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID（SERIAL自增）';
COMMENT ON COLUMN orders.status IS '0-待付款 1-已付款 2-已发货 3-已收货 4-已完成 5-已取消 6-已退款';
COMMENT ON COLUMN orders.total_amt IS '订单总金额';

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(create_time);
CREATE INDEX idx_items_order ON order_items(order_id);$sam$, 'string', 'GBase 8s DDL 示例：SERIAL/MONEY/DATETIME YEAR TO SECOND/COMMENT ON/LOCK MODE ROW', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8s_function', $sam$-- GBase 8s (Informix) SPL 函数：计算订单折后金额
-- 特性: RETURNING/SPL/DEFINE/FOREACH/NVL/CURRENT/EXCEPTION

CREATE FUNCTION calc_final_amount(
  p_order_id INTEGER, p_use_coupon BOOLEAN DEFAULT 't'
) RETURNING MONEY(12,2);
  DEFINE v_total    MONEY(12,2);
  DEFINE v_discount MONEY(12,2);
  DEFINE v_coupon   MONEY(12,2);
  DEFINE v_level    INT;
  DEFINE v_final    MONEY(12,2);

  LET v_discount = 0;
  LET v_coupon = 0;
  LET v_level = 1;

  SELECT total_amt, NVL(discount_amt, 0::MONEY), NVL(customer_level, 1)
  INTO v_total, v_discount, v_level
  FROM orders WHERE order_id = p_order_id;

  SELECT NVL(SUM(amount), 0::MONEY) INTO v_coupon
  FROM coupons WHERE order_id = p_order_id
    AND status = 'VALID' AND expire_time > CURRENT;

  LET v_final = v_total * (
    CASE WHEN v_level = 5 THEN 0.85
         WHEN v_level = 4 THEN 0.90
         WHEN v_level = 3 THEN 0.95
         WHEN v_level = 2 THEN 0.98
         ELSE 1.0 END
  );

  IF p_use_coupon THEN LET v_final = v_final - v_coupon; END IF;
  LET v_final = v_final - v_discount;

  IF v_final < 0 THEN LET v_final = 0; END IF;
  RETURN v_final;

END FUNCTION;$sam$, 'string', 'GBase 8s 函数示例：SPL/RETURNING/DEFINE/LET/NVL/CURRENT/CASE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'gbase_8s_procedure', $sam$-- GBase 8s (Informix) SPL 存储过程：处理订单支付并扣减库存
-- 特性: RETURNING/SPL/DEFINE/FOREACH/BEGIN WORK/COMMIT WORK

CREATE PROCEDURE pay_order(
  p_order_id INTEGER, p_method VARCHAR(20), p_txn_no VARCHAR(64)
) RETURNING INT, VARCHAR(200);
  DEFINE v_status SMALLINT;
  DEFINE v_total  MONEY(12,2);
  DEFINE v_product_id INTEGER;
  DEFINE v_qty INT;

  SELECT status, total_amt INTO v_status, v_total
  FROM orders WHERE order_id = p_order_id;

  IF v_status <> 0 THEN
    RETURN -1, '状态不允许支付';
  END IF;

  BEGIN WORK;

  INSERT INTO payments(order_id, method, txn_no, amount, create_time)
  VALUES(p_order_id, p_method, p_txn_no, v_total, CURRENT);

  UPDATE orders SET status = 1, update_time = CURRENT
  WHERE order_id = p_order_id;

  FOREACH cur_items
    SELECT product_id, quantity INTO v_product_id, v_qty
    FROM order_items WHERE order_id = p_order_id
    UPDATE inventory SET stock = stock - v_qty
    WHERE product_id = v_product_id AND stock >= v_qty;
  END FOREACH;

  COMMIT WORK;
  RETURN 0, '支付成功';

END PROCEDURE;$sam$, 'string', 'GBase 8s 存储过程示例：SPL RETURNING/DEFINE/FOREACH/BEGIN WORK/COMMIT WORK', true);

-- ============================================================
-- 17. HiveSQL (Apache Hive)
-- ============================================================
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'hivesql_ddl', $sam$-- HiveSQL 电商订单系统 DDL
-- 特性: STRING/BIGINT/DOUBLE/PARTITIONED BY/STORED AS/ROW FORMAT/TBLPROPERTIES

CREATE TABLE IF NOT EXISTS orders (
  order_id    BIGINT,
  order_no    STRING,
  customer_id BIGINT,
  total_amt   DOUBLE,
  status      INT,
  is_deleted  BOOLEAN,
  create_time TIMESTAMP,
  update_time TIMESTAMP
)
COMMENT '订单主表'
PARTITIONED BY (dt STRING COMMENT '日期分区 yyyyMMdd')
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY', 'transactional'='true');

CREATE TABLE IF NOT EXISTS order_items (
  item_id    BIGINT,
  order_id   BIGINT,
  product    STRING,
  unit_price DOUBLE,
  quantity   INT
)
COMMENT '订单明细表'
PARTITIONED BY (dt STRING)
STORED AS ORC
TBLPROERTIES ('orc.compress'='SNAPPY');

-- Hive 不支持主键/外键/唯一约束，通过业务逻辑保证数据完整性
-- 使用 ANALYZE TABLE 收集统计信息
ANALYZE TABLE orders PARTITION(dt) COMPUTE STATISTICS;
ANALYZE TABLE order_items PARTITION(dt) COMPUTE STATISTICS;$sam$, 'string', 'HiveSQL DDL 示例：STRING/DOUBLE/PARTITIONED BY/STORED AS ORC/TBLPROPERTIES/ANALYZE', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'hivesql_function', $sam$-- HiveSQL UDF 函数：计算订单折后金额（Java UDF 模式）
-- 特性: CREATE FUNCTION/AS/包路径/JAVA 实现引用

-- Hive 不支持原生函数体定义，使用 Java UDF 方式
-- 以下是建函数声明，实现由 Java 类提供
CREATE FUNCTION calc_final_amount
  AS 'com.example.hive.udf.CalcFinalAmount'
  USING JAR 'hdfs:///udf/order-utils-1.0.jar';

-- DDL 模拟：创建存储订单金额计算逻辑的汇总表（Hive 的实际用法）
CREATE TABLE IF NOT EXISTS order_amount_summary AS
SELECT
  o.order_id,
  o.total_amt,
  COALESCE(o.discount_amt, 0) AS discount_amt,
  COALESCE(SUM(c.amount), 0) AS coupon_amt,
  o.total_amt * CASE
    WHEN COALESCE(c2.level, 1) = 5 THEN 0.85
    WHEN COALESCE(c2.level, 1) = 4 THEN 0.90
    WHEN COALESCE(c2.level, 1) = 3 THEN 0.95
    WHEN COALESCE(c2.level, 1) = 2 THEN 0.98
    ELSE 1.0
  END - COALESCE(o.discount_amt, 0) - COALESCE(SUM(c.amount), 0) AS final_amount
FROM orders o
  LEFT JOIN coupons c ON o.order_id = c.order_id AND c.status = 'VALID'
  LEFT JOIN customers c2 ON o.customer_id = c2.id
WHERE o.dt = '${hiveconf:dt}'
GROUP BY o.order_id, o.total_amt, o.discount_amt, c2.level;$sam$, 'string', 'HiveSQL 函数示例：CREATE FUNCTION/UDF/JAR引用/CTAS/COALESCE/CASE/变量替换', true);

INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_sample', 'hivesql_procedure', $sam$-- HiveSQL 数据处理流程（Hive 无存储过程，用脚本化 ETL 替代）
-- 特性: INSERT OVERWRITE/PARTITION/LEFT JOIN/窗口函数/COLLECT_LIST

-- Hive 不支持存储过程，使用 ETL 脚本实现订单支付处理逻辑
-- 以下展示典型的 Hive 库存扣减和支付记录 ETL

-- 创建支付记录增量表
INSERT OVERWRITE TABLE payments PARTITION(dt=''${hiveconf:dt}'')
SELECT
  ROW_NUMBER() OVER (ORDER BY o.order_id) + 1000000 AS pay_id,
  o.order_id,
  ''${hiveconf:method}'' AS method,
  ''${hiveconf:txn_no}'' AS txn_no,
  o.total_amt AS amount,
  CURRENT_TIMESTAMP() AS create_time
FROM orders o
WHERE o.dt = ''${hiveconf:dt}''
  AND o.status = 0
  AND o.order_id = ${hiveconf:order_id};

-- 更新订单状态
INSERT OVERWRITE TABLE orders PARTITION(dt=''${hiveconf:dt}'')
SELECT order_id, order_no, customer_id, total_amt,
  1 AS status, is_deleted, create_time, CURRENT_TIMESTAMP() AS update_time
FROM orders WHERE dt = ''${hiveconf:dt}''
  AND order_id <> ${hiveconf:order_id}
UNION ALL
SELECT order_id, order_no, customer_id, total_amt,
  1 AS status, is_deleted, create_time, CURRENT_TIMESTAMP() AS update_time
FROM orders WHERE dt = ''${hiveconf:dt}''
  AND order_id = ${hiveconf:order_id}
  AND status = 0;

-- 扣减库存
INSERT OVERWRITE TABLE inventory PARTITION(dt=''${hiveconf:dt}'')
SELECT i.product_id, i.stock - oi.quantity AS stock, i.update_time
FROM inventory i
JOIN order_items oi ON i.product_id = oi.product_id
WHERE i.dt = ''${hiveconf:dt}'' AND oi.order_id = ${hiveconf:order_id}
  AND i.stock >= oi.quantity;$sam$, 'string', 'HiveSQL 存储过程示例：INSERT OVERWRITE/ROW_NUMBER/CURRENT_TIMESTAMP/变量替换/ETL模式', true);
