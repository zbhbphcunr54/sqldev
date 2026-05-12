export const SAMPLE_DDL = `-- 电商订单系统核心表结构
-- 订单主表
CREATE TABLE orders (
  order_id NUMBER(20) NOT NULL,
  order_no VARCHAR2(32) NOT NULL,
  customer_id NUMBER(20) NOT NULL,
  merchant_id NUMBER(20) NOT NULL,
  order_status NUMBER(2) DEFAULT 0,
  payment_status NUMBER(2) DEFAULT 0,
  shipping_status NUMBER(2) DEFAULT 0,
  order_amount NUMBER(12,2) NOT NULL,
  discount_amount NUMBER(12,2) DEFAULT 0,
  coupon_amount NUMBER(12,2) DEFAULT 0,
  freight_amount NUMBER(10,2) DEFAULT 0,
  total_amount NUMBER(12,2) NOT NULL,
  payment_amount NUMBER(12,2),
  payment_method VARCHAR2(20),
  payment_time TIMESTAMP,
  shipping_time TIMESTAMP,
  receive_time TIMESTAMP,
  receiver_name VARCHAR2(100),
  receiver_phone VARCHAR2(20),
  receiver_province VARCHAR2(50),
  receiver_city VARCHAR2(50),
  receiver_district VARCHAR2(50),
  receiver_address VARCHAR2(500),
  buyer_remark VARCHAR2(500),
  seller_remark VARCHAR2(500),
  create_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  update_time TIMESTAMP,
  is_deleted NUMBER(1) DEFAULT 0,
  version NUMBER(10) DEFAULT 0,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_order_no UNIQUE (order_no)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID';
COMMENT ON COLUMN orders.order_no IS '订单编号';
COMMENT ON COLUMN orders.customer_id IS '客户ID';
COMMENT ON COLUMN orders.merchant_id IS '商户ID';
COMMENT ON COLUMN orders.order_status IS '订单状态:0-待付款,1-已付款,2-已发货,3-已收货,4-已完成,5-已取消,6-已退款';
COMMENT ON COLUMN orders.total_amount IS '订单总金额';

-- 订单明细表
CREATE TABLE order_items (
  item_id NUMBER(20) NOT NULL,
  order_id NUMBER(20) NOT NULL,
  product_id NUMBER(20) NOT NULL,
  sku_id NUMBER(20),
  product_name VARCHAR2(200) NOT NULL,
  sku_name VARCHAR2(200),
  product_image VARCHAR2(500),
  original_price NUMBER(12,2) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  quantity NUMBER(8) NOT NULL DEFAULT 1,
  discount_amount NUMBER(12,2) DEFAULT 0,
  item_amount NUMBER(12,2) NOT NULL,
  is_gift NUMBER(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  update_time TIMESTAMP,
  CONSTRAINT pk_order_items PRIMARY KEY (item_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- 创建索引
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_merchant ON orders(merchant_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_create_time ON orders(create_time);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);`

export const SAMPLE_FUNC = `-- 计算订单应付金额函数
CREATE OR REPLACE FUNCTION calculate_order_amount(
  p_order_id IN NUMBER,
  p_use_balance IN BOOLEAN DEFAULT TRUE
) RETURN NUMBER IS
  v_order_amount NUMBER(12,2);
  v_discount_amount NUMBER(12,2) := 0;
  v_coupon_amount NUMBER(12,2) := 0;
  v_freight_amount NUMBER(10,2) := 0;
  v_wallet_balance NUMBER(12,2) := 0;
  v_customer_level NUMBER(2) := 1;
  v_points_amount NUMBER(12,2) := 0;
  v_final_amount NUMBER(12,2);
  v_discount_rate NUMBER(5,4) := 1.0;
BEGIN
  -- 获取订单信息
  SELECT order_amount, discount_amount, coupon_amount, freight_amount
  INTO v_order_amount, v_discount_amount, v_coupon_amount, v_freight_amount
  FROM orders WHERE order_id = p_order_id;

  -- 获取客户等级和钱包余额
  SELECT NVL(wallet_balance, 0), NVL(customer_level, 1)
  INTO v_wallet_balance, v_customer_level
  FROM customers WHERE customer_id = (
    SELECT customer_id FROM orders WHERE order_id = p_order_id
  );

  -- 根据客户等级计算折扣
  CASE v_customer_level
    WHEN 5 THEN v_discount_rate := 0.85;
    WHEN 4 THEN v_discount_rate := 0.90;
    WHEN 3 THEN v_discount_rate := 0.95;
    WHEN 2 THEN v_discount_rate := 0.98;
    ELSE v_discount_rate := 1.0;
  END CASE;

  -- 计算积分抵扣金额
  SELECT NVL(SUM(points * 0.01), 0) INTO v_points_amount
  FROM customer_points
  WHERE customer_id = (SELECT customer_id FROM orders WHERE order_id = p_order_id)
    AND points_type = 'ORDER'
    AND status = 'AVAILABLE'
    AND expire_time > SYSDATE;

  -- 计算最终金额
  v_final_amount := v_order_amount * v_discount_rate
                 - v_discount_amount
                 - v_coupon_amount
                 - LEAST(v_points_amount, v_order_amount * 0.1);

  -- 如果使用余额抵扣
  IF p_use_balance THEN
    IF v_wallet_balance >= v_final_amount THEN
      v_final_amount := 0;
    ELSE
      v_final_amount := v_final_amount - v_wallet_balance;
    END IF;
  END IF;

  -- 最低为0
  RETURN GREATEST(v_final_amount, 0);

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RETURN NULL;
  WHEN OTHERS THEN
    RETURN NULL;
END calculate_order_amount;`

export const SAMPLE_PROC = `-- 处理订单支付并扣减库存存储过程
CREATE OR REPLACE PROCEDURE process_order_payment(
  p_order_id IN NUMBER,
  p_payment_method IN VARCHAR2,
  p_transaction_no IN VARCHAR2,
  p_result OUT NUMBER,
  p_message OUT VARCHAR2
)
IS
  v_order_status NUMBER(2);
  v_customer_id NUMBER(20);
  v_total_amount NUMBER(12,2);
  v_payment_amount NUMBER(12,2);
  v_points_to_add NUMBER(10);
  e_order_locked EXCEPTION;
  e_insufficient_stock EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_order_locked, -20001);
  PRAGMA EXCEPTION_INIT(e_insufficient_stock, -20002);
BEGIN
  SELECT order_status, customer_id, total_amount, payment_amount
  INTO v_order_status, v_customer_id, v_total_amount, v_payment_amount
  FROM orders WHERE order_id = p_order_id FOR UPDATE WAIT 10;

  IF v_order_status != 0 THEN
    p_result := -1;
    p_message := '订单状态不允许支付';
    RETURN;
  END IF;

  INSERT INTO payment_records (
    payment_id, order_id, payment_method, transaction_no,
    payment_amount, payment_time, status, create_time
  ) VALUES (
    payment_seq.NEXTVAL, p_order_id, p_payment_method, p_transaction_no,
    NVL(v_payment_amount, v_total_amount), SYSTIMESTAMP, 'SUCCESS', SYSTIMESTAMP
  );

  UPDATE orders SET
    order_status = 1, payment_status = 1,
    payment_method = p_payment_method, payment_time = SYSTIMESTAMP,
    update_time = SYSTIMESTAMP, version = version + 1
  WHERE order_id = p_order_id;

  FOR item_rec IN (
    SELECT oi.product_id, oi.sku_id, oi.quantity
    FROM order_items oi WHERE oi.order_id = p_order_id
  ) LOOP
    UPDATE product_stock ps SET
      ps.stock_quantity = ps.stock_quantity - item_rec.quantity,
      ps.update_time = SYSTIMESTAMP
    WHERE ps.product_id = item_rec.product_id
      AND ps.sku_id = item_rec.sku_id
      AND ps.stock_quantity >= item_rec.quantity;

    IF SQL%ROWCOUNT = 0 THEN
      RAISE e_insufficient_stock;
    END IF;
  END LOOP;

  v_points_to_add := FLOOR(NVL(v_payment_amount, v_total_amount));
  UPDATE customers SET points = points + v_points_to_add
  WHERE customer_id = v_customer_id;

  COMMIT;
  p_result := 0;
  p_message := '支付成功';
EXCEPTION
  WHEN e_insufficient_stock THEN
    ROLLBACK; p_result := -3; p_message := '库存不足';
  WHEN OTHERS THEN
    ROLLBACK; p_result := -9; p_message := SQLERRM;
END process_order_payment;`
