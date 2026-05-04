-- ============================================================
-- SQL 转换规则数据 INSERT 脚本
-- 生成时间: 2026-05-03T08:04:08.215Z
-- 说明: 插入系统默认规则（user_id = NULL）
-- kind: 1 = DDL 类型映射, 2 = 程序块变换
-- ============================================================

-- DDL: oracleToMysql (31 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'ddl', '[
  {
    "source": "NUMBER(p,s)",
    "target": "DECIMAL(p,s)"
  },
  {
    "source": "NUMBER(p) [p<=3]",
    "target": "TINYINT"
  },
  {
    "source": "NUMBER(p) [p<=5]",
    "target": "SMALLINT"
  },
  {
    "source": "NUMBER(p) [p<=9]",
    "target": "INT"
  },
  {
    "source": "NUMBER(p) [p<=18]",
    "target": "BIGINT"
  },
  {
    "source": "NUMBER(p)",
    "target": "DECIMAL(p,0)"
  },
  {
    "source": "NUMBER",
    "target": "DECIMAL(38,10)"
  },
  {
    "source": "NUMERIC(p,s)",
    "target": "DECIMAL(p,s)"
  },
  {
    "source": "DECIMAL(p,s)",
    "target": "DECIMAL(p,s)"
  },
  {
    "source": "INTEGER",
    "target": "INT"
  },
  {
    "source": "INT",
    "target": "INT"
  },
  {
    "source": "PLS_INTEGER",
    "target": "INT"
  },
  {
    "source": "BINARY_INTEGER",
    "target": "INT"
  },
  {
    "source": "SMALLINT",
    "target": "SMALLINT"
  },
  {
    "source": "FLOAT",
    "target": "DOUBLE"
  },
  {
    "source": "BINARY_FLOAT",
    "target": "FLOAT"
  },
  {
    "source": "BINARY_DOUBLE",
    "target": "DOUBLE"
  },
  {
    "source": "VARCHAR2(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "NVARCHAR2(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "CHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "NCHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "CLOB",
    "target": "LONGTEXT"
  },
  {
    "source": "NCLOB",
    "target": "LONGTEXT"
  },
  {
    "source": "LONG",
    "target": "LONGTEXT"
  },
  {
    "source": "BLOB",
    "target": "LONGBLOB"
  },
  {
    "source": "RAW(n)",
    "target": "VARBINARY(n)"
  },
  {
    "source": "LONG RAW",
    "target": "LONGBLOB"
  },
  {
    "source": "DATE",
    "target": "DATETIME"
  },
  {
    "source": "TIMESTAMP",
    "target": "TIMESTAMP(6)"
  },
  {
    "source": "BOOLEAN",
    "target": "TINYINT(1)"
  },
  {
    "source": "XMLTYPE",
    "target": "LONGTEXT"
  }
]');

-- DDL: oracleToPg (30 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'ddl', '[
  {
    "source": "NUMBER(p,s)",
    "target": "NUMERIC(p,s)"
  },
  {
    "source": "NUMBER(p) [p<=5]",
    "target": "SMALLINT"
  },
  {
    "source": "NUMBER(p) [p<=9]",
    "target": "INTEGER"
  },
  {
    "source": "NUMBER(p) [p<=18]",
    "target": "BIGINT"
  },
  {
    "source": "NUMBER(p)",
    "target": "NUMERIC(p,0)"
  },
  {
    "source": "NUMBER",
    "target": "NUMERIC"
  },
  {
    "source": "NUMERIC(p,s)",
    "target": "NUMERIC(p,s)"
  },
  {
    "source": "DECIMAL(p,s)",
    "target": "NUMERIC(p,s)"
  },
  {
    "source": "INTEGER",
    "target": "INTEGER"
  },
  {
    "source": "INT",
    "target": "INTEGER"
  },
  {
    "source": "PLS_INTEGER",
    "target": "INTEGER"
  },
  {
    "source": "BINARY_INTEGER",
    "target": "INTEGER"
  },
  {
    "source": "SMALLINT",
    "target": "SMALLINT"
  },
  {
    "source": "FLOAT",
    "target": "REAL"
  },
  {
    "source": "BINARY_FLOAT",
    "target": "REAL"
  },
  {
    "source": "BINARY_DOUBLE",
    "target": "DOUBLE PRECISION"
  },
  {
    "source": "VARCHAR2(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "NVARCHAR2(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "CHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "NCHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "CLOB",
    "target": "TEXT"
  },
  {
    "source": "NCLOB",
    "target": "TEXT"
  },
  {
    "source": "LONG",
    "target": "TEXT"
  },
  {
    "source": "BLOB",
    "target": "BYTEA"
  },
  {
    "source": "RAW",
    "target": "BYTEA"
  },
  {
    "source": "LONG RAW",
    "target": "BYTEA"
  },
  {
    "source": "DATE",
    "target": "TIMESTAMP"
  },
  {
    "source": "TIMESTAMP",
    "target": "TIMESTAMP"
  },
  {
    "source": "BOOLEAN",
    "target": "BOOLEAN"
  },
  {
    "source": "XMLTYPE",
    "target": "XML"
  }
]');

-- DDL: mysqlToOracle (39 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'ddl', '[
  {
    "source": "TINYINT(1)",
    "target": "NUMBER(1)"
  },
  {
    "source": "TINYINT",
    "target": "NUMBER(3)"
  },
  {
    "source": "SMALLINT",
    "target": "NUMBER(5)"
  },
  {
    "source": "MEDIUMINT",
    "target": "NUMBER(7)"
  },
  {
    "source": "INT",
    "target": "NUMBER(10)"
  },
  {
    "source": "INTEGER",
    "target": "NUMBER(10)"
  },
  {
    "source": "BIGINT",
    "target": "NUMBER(18)"
  },
  {
    "source": "DECIMAL(p,s)",
    "target": "NUMBER(p,s)"
  },
  {
    "source": "NUMERIC(p,s)",
    "target": "NUMBER(p,s)"
  },
  {
    "source": "DECIMAL(p)",
    "target": "NUMBER(p)"
  },
  {
    "source": "NUMERIC(p)",
    "target": "NUMBER(p)"
  },
  {
    "source": "DECIMAL",
    "target": "NUMBER"
  },
  {
    "source": "NUMERIC",
    "target": "NUMBER"
  },
  {
    "source": "FLOAT",
    "target": "BINARY_FLOAT"
  },
  {
    "source": "DOUBLE",
    "target": "BINARY_DOUBLE"
  },
  {
    "source": "VARCHAR(n)",
    "target": "VARCHAR2(n)"
  },
  {
    "source": "NVARCHAR(n)",
    "target": "NVARCHAR2(n)"
  },
  {
    "source": "CHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "TEXT",
    "target": "CLOB"
  },
  {
    "source": "MEDIUMTEXT",
    "target": "CLOB"
  },
  {
    "source": "LONGTEXT",
    "target": "CLOB"
  },
  {
    "source": "TINYTEXT",
    "target": "CLOB"
  },
  {
    "source": "BLOB",
    "target": "BLOB"
  },
  {
    "source": "MEDIUMBLOB",
    "target": "BLOB"
  },
  {
    "source": "LONGBLOB",
    "target": "BLOB"
  },
  {
    "source": "TINYBLOB",
    "target": "BLOB"
  },
  {
    "source": "VARBINARY(n)",
    "target": "RAW(n)"
  },
  {
    "source": "BINARY(n)",
    "target": "RAW(n)"
  },
  {
    "source": "DATETIME(n)",
    "target": "TIMESTAMP(n)"
  },
  {
    "source": "DATETIME",
    "target": "DATE"
  },
  {
    "source": "TIMESTAMP",
    "target": "TIMESTAMP"
  },
  {
    "source": "DATE",
    "target": "DATE"
  },
  {
    "source": "TIME",
    "target": "VARCHAR2(20)"
  },
  {
    "source": "YEAR",
    "target": "NUMBER(4)"
  },
  {
    "source": "BIT",
    "target": "NUMBER(1)"
  },
  {
    "source": "ENUM",
    "target": "VARCHAR2(100)"
  },
  {
    "source": "SET",
    "target": "VARCHAR2(100)"
  },
  {
    "source": "JSON",
    "target": "CLOB"
  },
  {
    "source": "BOOLEAN",
    "target": "NUMBER(1)"
  }
]');

-- DDL: mysqlToPg (38 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'ddl', '[
  {
    "source": "TINYINT(1)",
    "target": "BOOLEAN"
  },
  {
    "source": "TINYINT",
    "target": "SMALLINT"
  },
  {
    "source": "SMALLINT",
    "target": "SMALLINT"
  },
  {
    "source": "MEDIUMINT",
    "target": "INTEGER"
  },
  {
    "source": "INT",
    "target": "INTEGER"
  },
  {
    "source": "INTEGER",
    "target": "INTEGER"
  },
  {
    "source": "BIGINT",
    "target": "BIGINT"
  },
  {
    "source": "DECIMAL(p,s)",
    "target": "NUMERIC(p,s)"
  },
  {
    "source": "NUMERIC(p,s)",
    "target": "NUMERIC(p,s)"
  },
  {
    "source": "DECIMAL(p)",
    "target": "NUMERIC(p)"
  },
  {
    "source": "NUMERIC(p)",
    "target": "NUMERIC(p)"
  },
  {
    "source": "DECIMAL",
    "target": "NUMERIC"
  },
  {
    "source": "NUMERIC",
    "target": "NUMERIC"
  },
  {
    "source": "FLOAT",
    "target": "REAL"
  },
  {
    "source": "DOUBLE",
    "target": "DOUBLE PRECISION"
  },
  {
    "source": "VARCHAR(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "NVARCHAR(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "CHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "TEXT",
    "target": "TEXT"
  },
  {
    "source": "MEDIUMTEXT",
    "target": "TEXT"
  },
  {
    "source": "LONGTEXT",
    "target": "TEXT"
  },
  {
    "source": "TINYTEXT",
    "target": "TEXT"
  },
  {
    "source": "BLOB",
    "target": "BYTEA"
  },
  {
    "source": "MEDIUMBLOB",
    "target": "BYTEA"
  },
  {
    "source": "LONGBLOB",
    "target": "BYTEA"
  },
  {
    "source": "TINYBLOB",
    "target": "BYTEA"
  },
  {
    "source": "VARBINARY",
    "target": "BYTEA"
  },
  {
    "source": "BINARY",
    "target": "BYTEA"
  },
  {
    "source": "DATETIME",
    "target": "TIMESTAMP"
  },
  {
    "source": "TIMESTAMP",
    "target": "TIMESTAMP"
  },
  {
    "source": "DATE",
    "target": "DATE"
  },
  {
    "source": "TIME",
    "target": "TIME"
  },
  {
    "source": "YEAR",
    "target": "INTEGER"
  },
  {
    "source": "BIT",
    "target": "BOOLEAN"
  },
  {
    "source": "ENUM",
    "target": "VARCHAR(100)"
  },
  {
    "source": "SET",
    "target": "VARCHAR(100)"
  },
  {
    "source": "JSON",
    "target": "JSONB"
  },
  {
    "source": "BOOLEAN",
    "target": "BOOLEAN"
  }
]');

-- DDL: pgToOracle (32 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'ddl', '[
  {
    "source": "BIGSERIAL",
    "target": "NUMBER(18)"
  },
  {
    "source": "SERIAL",
    "target": "NUMBER(10)"
  },
  {
    "source": "SMALLSERIAL",
    "target": "NUMBER(5)"
  },
  {
    "source": "SMALLINT",
    "target": "NUMBER(5)"
  },
  {
    "source": "INTEGER",
    "target": "NUMBER(10)"
  },
  {
    "source": "INT",
    "target": "NUMBER(10)"
  },
  {
    "source": "BIGINT",
    "target": "NUMBER(18)"
  },
  {
    "source": "NUMERIC(p,s)",
    "target": "NUMBER(p,s)"
  },
  {
    "source": "DECIMAL(p,s)",
    "target": "NUMBER(p,s)"
  },
  {
    "source": "NUMERIC(p)",
    "target": "NUMBER(p)"
  },
  {
    "source": "DECIMAL(p)",
    "target": "NUMBER(p)"
  },
  {
    "source": "NUMERIC",
    "target": "NUMBER"
  },
  {
    "source": "DECIMAL",
    "target": "NUMBER"
  },
  {
    "source": "REAL",
    "target": "BINARY_FLOAT"
  },
  {
    "source": "DOUBLE PRECISION",
    "target": "BINARY_DOUBLE"
  },
  {
    "source": "VARCHAR(n)",
    "target": "VARCHAR2(n)"
  },
  {
    "source": "CHARACTER VARYING(n)",
    "target": "VARCHAR2(n)"
  },
  {
    "source": "CHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "CHARACTER(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "TEXT",
    "target": "CLOB"
  },
  {
    "source": "BYTEA",
    "target": "BLOB"
  },
  {
    "source": "BOOLEAN",
    "target": "NUMBER(1)"
  },
  {
    "source": "TIMESTAMP WITHOUT TIME ZONE",
    "target": "TIMESTAMP"
  },
  {
    "source": "TIMESTAMP WITH TIME ZONE",
    "target": "TIMESTAMP"
  },
  {
    "source": "TIMESTAMP",
    "target": "TIMESTAMP"
  },
  {
    "source": "DATE",
    "target": "DATE"
  },
  {
    "source": "TIME WITHOUT TIME ZONE",
    "target": "VARCHAR2(20)"
  },
  {
    "source": "TIME",
    "target": "VARCHAR2(20)"
  },
  {
    "source": "JSON",
    "target": "CLOB"
  },
  {
    "source": "JSONB",
    "target": "CLOB"
  },
  {
    "source": "XML",
    "target": "XMLTYPE"
  },
  {
    "source": "UUID",
    "target": "RAW(16)"
  }
]');

-- DDL: pgToMysql (29 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'ddl', '[
  {
    "source": "BIGSERIAL",
    "target": "BIGINT"
  },
  {
    "source": "SERIAL",
    "target": "INT"
  },
  {
    "source": "SMALLSERIAL",
    "target": "SMALLINT"
  },
  {
    "source": "SMALLINT",
    "target": "SMALLINT"
  },
  {
    "source": "INTEGER",
    "target": "INT"
  },
  {
    "source": "INT",
    "target": "INT"
  },
  {
    "source": "BIGINT",
    "target": "BIGINT"
  },
  {
    "source": "NUMERIC(p,s)",
    "target": "DECIMAL(p,s)"
  },
  {
    "source": "DECIMAL(p,s)",
    "target": "DECIMAL(p,s)"
  },
  {
    "source": "NUMERIC(p)",
    "target": "DECIMAL(p)"
  },
  {
    "source": "DECIMAL(p)",
    "target": "DECIMAL(p)"
  },
  {
    "source": "NUMERIC",
    "target": "DECIMAL(38,10)"
  },
  {
    "source": "DECIMAL",
    "target": "DECIMAL(38,10)"
  },
  {
    "source": "REAL",
    "target": "FLOAT"
  },
  {
    "source": "DOUBLE PRECISION",
    "target": "DOUBLE"
  },
  {
    "source": "VARCHAR(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "CHARACTER VARYING(n)",
    "target": "VARCHAR(n)"
  },
  {
    "source": "CHAR(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "CHARACTER(n)",
    "target": "CHAR(n)"
  },
  {
    "source": "TEXT",
    "target": "LONGTEXT"
  },
  {
    "source": "BYTEA",
    "target": "LONGBLOB"
  },
  {
    "source": "BOOLEAN",
    "target": "TINYINT(1)"
  },
  {
    "source": "TIMESTAMP",
    "target": "TIMESTAMP(6)"
  },
  {
    "source": "DATE",
    "target": "DATE"
  },
  {
    "source": "TIME",
    "target": "TIME"
  },
  {
    "source": "JSON",
    "target": "JSON"
  },
  {
    "source": "JSONB",
    "target": "JSON"
  },
  {
    "source": "XML",
    "target": "LONGTEXT"
  },
  {
    "source": "UUID",
    "target": "CHAR(36)"
  }
]');

-- Body: oracleToPg (61 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'body', '[
  {
    "s": "DECODE(expr, v1, r1, ..., def)",
    "t": "CASE expr WHEN v1 THEN r1 ... ELSE def END"
  },
  {
    "s": "NVL(a, b)",
    "t": "COALESCE(a, b)"
  },
  {
    "s": "NVL2(a, b, c)",
    "t": "CASE WHEN a IS NOT NULL THEN b ELSE c END"
  },
  {
    "s": "TO_NUMBER(x)",
    "t": "CAST(x AS INTEGER)"
  },
  {
    "s": "SYSTIMESTAMP",
    "t": "CLOCK_TIMESTAMP()"
  },
  {
    "s": "SYSDATE",
    "t": "CURRENT_DATE"
  },
  {
    "s": "TO_CHAR(expr, fmt)",
    "t": "to_char(expr, fmt) 格式符转换"
  },
  {
    "s": "TO_CHAR(expr) 单参数",
    "t": "expr::TEXT"
  },
  {
    "s": "TO_DATE(expr, fmt)",
    "t": "to_date(expr, fmt) 格式符转换"
  },
  {
    "s": "SUBSTR(a, b, c)",
    "t": "SUBSTRING(a FROM b FOR c)"
  },
  {
    "s": "RAISE_APPLICATION_ERROR(-code, msg)",
    "t": "RAISE EXCEPTION msg USING ERRCODE = ''P0001''"
  },
  {
    "s": "RAISE; 重新抛出",
    "t": "RAISE;"
  },
  {
    "s": "|| 字符串拼接",
    "t": "|| 保持不变"
  },
  {
    "s": "DBMS_OUTPUT.PUT_LINE(expr)",
    "t": "RAISE NOTICE ''%'', expr"
  },
  {
    "s": "EXCEPTION WHEN OTHERS THEN",
    "t": "EXCEPTION WHEN OTHERS THEN 保持"
  },
  {
    "s": "ROWNUM <= n",
    "t": "LIMIT n"
  },
  {
    "s": "EXECUTE IMMEDIATE expr",
    "t": "EXECUTE expr USING ..."
  },
  {
    "s": "SQL%ROWCOUNT",
    "t": "GET DIAGNOSTICS var = ROW_COUNT"
  },
  {
    "s": "ELSIF",
    "t": "ELSIF 保持"
  },
  {
    "s": "WHILE ... LOOP / END LOOP",
    "t": "WHILE ... LOOP / END LOOP 保持"
  },
  {
    "s": "seq.NEXTVAL",
    "t": "nextval(''seq'')"
  },
  {
    "s": "seq.CURRVAL",
    "t": "currval(''seq'')"
  },
  {
    "s": "MONTHS_BETWEEN(a, b)",
    "t": "EXTRACT(YEAR/MONTH FROM AGE(a,b))"
  },
  {
    "s": "ADD_MONTHS(dt, n)",
    "t": "(dt + (n || '' month'')::interval)"
  },
  {
    "s": "LAST_DAY(dt)",
    "t": "(date_trunc(''month'', dt) + interval ''1 month'' - interval ''1 day'')"
  },
  {
    "s": "TRUNC(dt, ''MM'')",
    "t": "date_trunc(''month'', dt)"
  },
  {
    "s": "TRUNC(dt, ''YYYY'')",
    "t": "date_trunc(''year'', dt)"
  },
  {
    "s": "TRUNC(dt, ''DD'')",
    "t": "date_trunc(''day'', dt)"
  },
  {
    "s": "TRUNC(SYSDATE)",
    "t": "CURRENT_DATE"
  },
  {
    "s": "date_trunc (PG)",
    "t": "TRUNC (Oracle)"
  },
  {
    "s": "LENGTHB(x)",
    "t": "OCTET_LENGTH(x)"
  },
  {
    "s": "INSTR(a, b)",
    "t": "strpos(a, b)"
  },
  {
    "s": "DBMS_RANDOM.VALUE",
    "t": "random()"
  },
  {
    "s": "DBMS_RANDOM.VALUE(lo, hi)",
    "t": "(lo + random() * (hi - lo))"
  },
  {
    "s": "LISTAGG(col, sep) WITHIN GROUP(ORDER BY x)",
    "t": "string_agg(col::TEXT, sep ORDER BY x)"
  },
  {
    "s": "cursor%NOTFOUND",
    "t": "NOT FOUND"
  },
  {
    "s": "cursor%FOUND",
    "t": "FOUND"
  },
  {
    "s": "cursor%ROWTYPE",
    "t": "RECORD"
  },
  {
    "s": "cursor%ISOPEN",
    "t": "(PG 无直接等价, 用 BEGIN CLOSE; EXCEPTION END)"
  },
  {
    "s": "CURSOR c IS SELECT ...",
    "t": "c CURSOR FOR SELECT ..."
  },
  {
    "s": "FOR r IN (SELECT...) LOOP",
    "t": "FOR r IN SELECT... LOOP"
  },
  {
    "s": "REGEXP_LIKE(expr, pat)",
    "t": "expr ~ pat"
  },
  {
    "s": "SQLCODE",
    "t": "SQLSTATE"
  },
  {
    "s": "DBMS_UTILITY.FORMAT_ERROR_BACKTRACE",
    "t": "PG_EXCEPTION_CONTEXT"
  },
  {
    "s": "expr::TEXT",
    "t": "TO_CHAR(expr)"
  },
  {
    "s": "INITCAP(x)",
    "t": "INITCAP(x) (PG 原生支持)"
  },
  {
    "s": "VARCHAR2",
    "t": "VARCHAR"
  },
  {
    "s": "FETCH FIRST n ROWS ONLY",
    "t": "LIMIT n"
  },
  {
    "s": "LIMIT m, n → OFFSET m ROWS FETCH NEXT n ROWS ONLY",
    "t": "LIMIT n OFFSET m"
  },
  {
    "s": "NUMBER(p,s)",
    "t": "NUMERIC(p,s)"
  },
  {
    "s": "CLOB",
    "t": "TEXT"
  },
  {
    "s": "BLOB",
    "t": "BYTEA"
  },
  {
    "s": "PLS_INTEGER / BINARY_INTEGER",
    "t": "INTEGER"
  },
  {
    "s": "BOOLEAN",
    "t": "BOOLEAN"
  },
  {
    "s": "TRUE/FALSE (DML)",
    "t": "1/0"
  },
  {
    "s": "VARCHAR2 type",
    "t": "VARCHAR type"
  },
  {
    "s": "DATE",
    "t": "TIMESTAMP"
  },
  {
    "s": "REAL",
    "t": "DOUBLE PRECISION"
  },
  {
    "s": "NVARCHAR2(n)",
    "t": "VARCHAR(n)"
  },
  {
    "s": "DATE 格式符: YYYY MM DD HH24 MI SS",
    "t": "格式符: YYYY MM DD HH24 MI SS 保持"
  },
  {
    "s": "GET STACKED DIAGNOSTICS (PG)",
    "t": "(removed)"
  }
]');

-- Body: pgToOracle (25 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'body', '[
  {
    "s": "COALESCE(a, b)",
    "t": "NVL(a, b)"
  },
  {
    "s": "CLOCK_TIMESTAMP()",
    "t": "SYSTIMESTAMP"
  },
  {
    "s": "CURRENT_DATE",
    "t": "SYSDATE"
  },
  {
    "s": "SUBSTRING(a FROM b FOR c)",
    "t": "SUBSTR(a, b, c)"
  },
  {
    "s": "RAISE EXCEPTION msg USING ERRCODE = ''P0001''",
    "t": "RAISE_APPLICATION_ERROR(-code, msg)"
  },
  {
    "s": "RAISE NOTICE ''%'', expr",
    "t": "DBMS_OUTPUT.PUT_LINE(expr)"
  },
  {
    "s": "EXECUTE expr USING ...",
    "t": "EXECUTE IMMEDIATE expr"
  },
  {
    "s": "GET DIAGNOSTICS var = ROW_COUNT",
    "t": "SQL%ROWCOUNT"
  },
  {
    "s": "nextval(''seq'')",
    "t": "seq.NEXTVAL"
  },
  {
    "s": "EXTRACT(YEAR/MONTH FROM AGE(a,b))",
    "t": "MONTHS_BETWEEN(a, b)"
  },
  {
    "s": "(dt + (n || '' month'')::interval)",
    "t": "ADD_MONTHS(dt, n)"
  },
  {
    "s": "(date_trunc(''month'', dt) + interval ''1 month'' - interval ''1 day'')",
    "t": "LAST_DAY(dt)"
  },
  {
    "s": "TRUNC (Oracle)",
    "t": "date_trunc (PG)"
  },
  {
    "s": "OCTET_LENGTH(x)",
    "t": "LENGTHB(x)"
  },
  {
    "s": "strpos(a, b)",
    "t": "INSTR(a, b)"
  },
  {
    "s": "random()",
    "t": "DBMS_RANDOM.VALUE"
  },
  {
    "s": "string_agg(col::TEXT, sep ORDER BY x)",
    "t": "LISTAGG(col, sep) WITHIN GROUP(ORDER BY x)"
  },
  {
    "s": "NOT FOUND",
    "t": "cursor%NOTFOUND"
  },
  {
    "s": "c CURSOR FOR SELECT ...",
    "t": "CURSOR c IS SELECT ..."
  },
  {
    "s": "FOR r IN SELECT... LOOP",
    "t": "FOR r IN (SELECT...) LOOP"
  },
  {
    "s": "expr ~ pat",
    "t": "REGEXP_LIKE(expr, pat)"
  },
  {
    "s": "SQLSTATE",
    "t": "SQLCODE"
  },
  {
    "s": "TO_CHAR(expr)",
    "t": "expr::TEXT"
  },
  {
    "s": "1/0",
    "t": "TRUE/FALSE (DML)"
  },
  {
    "s": "(removed)",
    "t": "GET STACKED DIAGNOSTICS (PG)"
  }
]');

-- Body: oracleToMysql (76 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'body', '[
  {
    "s": "DECODE(expr, v1, r1, ..., def)",
    "t": "CASE expr WHEN v1 THEN r1 ... ELSE def END"
  },
  {
    "s": "NVL(a, b)",
    "t": "IFNULL(a, b)"
  },
  {
    "s": "NVL2(a, b, c)",
    "t": "IF(a IS NOT NULL, b, c)"
  },
  {
    "s": "TO_NUMBER(x)",
    "t": "CAST(x AS SIGNED)"
  },
  {
    "s": "SYSTIMESTAMP",
    "t": "NOW()"
  },
  {
    "s": "SYSDATE",
    "t": "NOW()"
  },
  {
    "s": "TO_CHAR(expr, fmt)",
    "t": "DATE_FORMAT(expr, fmt) 格式符转换"
  },
  {
    "s": "TO_CHAR(expr) 单参数",
    "t": "CAST(expr AS CHAR)"
  },
  {
    "s": "TO_DATE(expr, fmt)",
    "t": "STR_TO_DATE(expr, fmt) 格式符转换"
  },
  {
    "s": "SUBSTR(a, b, c)",
    "t": "SUBSTRING(a, b, c)"
  },
  {
    "s": "RAISE_APPLICATION_ERROR(-code, msg)",
    "t": "SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = msg"
  },
  {
    "s": "RAISE; 重新抛出",
    "t": "RESIGNAL;"
  },
  {
    "s": "DBMS_OUTPUT/RAISE NOTICE pre-convert",
    "t": "SELECT (pre-convert)"
  },
  {
    "s": "|| 字符串拼接",
    "t": "CONCAT(a, b, ...)"
  },
  {
    "s": "DBMS_OUTPUT.PUT_LINE(expr)",
    "t": "SELECT expr;"
  },
  {
    "s": "EXCEPTION WHEN OTHERS THEN ...",
    "t": "DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN...END"
  },
  {
    "s": "EXCEPTION WHEN NO_DATA_FOUND",
    "t": "DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN...END"
  },
  {
    "s": "ROWNUM <= n",
    "t": "LIMIT n"
  },
  {
    "s": "VARCHAR2",
    "t": "VARCHAR"
  },
  {
    "s": "LIMIT -> FETCH FIRST",
    "t": "FETCH FIRST"
  },
  {
    "s": "EXECUTE IMMEDIATE expr USING ...",
    "t": "PREPARE/EXECUTE/DEALLOCATE 模式"
  },
  {
    "s": "var := expr;",
    "t": "SET var = expr;"
  },
  {
    "s": "SQL%ROWCOUNT",
    "t": "ROW_COUNT()"
  },
  {
    "s": "ELSIF",
    "t": "ELSEIF"
  },
  {
    "s": "WHILE ... LOOP / END LOOP",
    "t": "WHILE ... DO / END WHILE"
  },
  {
    "s": "LOOP / END LOOP 基本循环",
    "t": "label: LOOP / END LOOP label"
  },
  {
    "s": "EXIT WHEN condition;",
    "t": "IF condition THEN LEAVE label; END IF;"
  },
  {
    "s": "cursor%NOTFOUND",
    "t": "_done (配合 HANDLER FOR NOT FOUND)"
  },
  {
    "s": "cursor%FOUND",
    "t": "NOT _done"
  },
  {
    "s": "cursor%ROWCOUNT",
    "t": "ROW_COUNT()"
  },
  {
    "s": "cursor%ISOPEN",
    "t": "-- (MySQL 无 %ISOPEN)"
  },
  {
    "s": "CURSOR c IS SELECT ...",
    "t": "DECLARE c CURSOR FOR SELECT ..."
  },
  {
    "s": "FOR i IN 1..10 LOOP",
    "t": "DECLARE i INT DEFAULT 1; WHILE i<=10 DO ... SET i=i+1; END WHILE"
  },
  {
    "s": "FOR r IN (SELECT...) LOOP",
    "t": "DECLARE CURSOR + OPEN + FETCH 循环"
  },
  {
    "s": "seq.NEXTVAL",
    "t": "/* MySQL 无序列, 用 AUTO_INCREMENT */"
  },
  {
    "s": "seq.CURRVAL",
    "t": "LAST_INSERT_ID()"
  },
  {
    "s": "MONTHS_BETWEEN(a, b)",
    "t": "TIMESTAMPDIFF(MONTH, b, a)"
  },
  {
    "s": "ADD_MONTHS(dt, n)",
    "t": "DATE_ADD(dt, INTERVAL n MONTH)"
  },
  {
    "s": "TRUNC(dt, ''MM'')",
    "t": "CAST(DATE_FORMAT(dt, ''%Y-%m-01'') AS DATE)"
  },
  {
    "s": "TRUNC(dt, ''YYYY'')",
    "t": "CAST(DATE_FORMAT(dt, ''%Y-01-01'') AS DATE)"
  },
  {
    "s": "TRUNC(dt, ''DD'')",
    "t": "CAST(dt AS DATE)"
  },
  {
    "s": "TRUNC(SYSDATE)",
    "t": "CURDATE()"
  },
  {
    "s": "TRUNC(x, n) 数值截断",
    "t": "TRUNCATE(x, n)"
  },
  {
    "s": "LENGTH(x) 字符长度",
    "t": "CHAR_LENGTH(x)"
  },
  {
    "s": "LENGTHB(x)",
    "t": "LENGTH(x)"
  },
  {
    "s": "DBMS_RANDOM.VALUE",
    "t": "RAND()"
  },
  {
    "s": "DBMS_RANDOM.VALUE(lo, hi)",
    "t": "(lo + RAND() * (hi - lo))"
  },
  {
    "s": "LISTAGG(col, sep) WITHIN GROUP(ORDER BY x)",
    "t": "GROUP_CONCAT(col ORDER BY x SEPARATOR sep)"
  },
  {
    "s": "REGEXP_LIKE(expr, pat)",
    "t": "expr REGEXP pat"
  },
  {
    "s": "INITCAP(x)",
    "t": "CONCAT(UPPER(LEFT(x,1)), LOWER(SUBSTRING(x,2)))"
  },
  {
    "s": "SQLCODE",
    "t": "@_err_code"
  },
  {
    "s": "SQLERRM",
    "t": "@_err_msg"
  },
  {
    "s": "DBMS_UTILITY.FORMAT_ERROR_BACKTRACE",
    "t": "'''' (MySQL 无等价函数)"
  },
  {
    "s": "MERGE INTO ... WHEN MATCHED/NOT MATCHED",
    "t": "INSERT...ON DUPLICATE KEY UPDATE"
  },
  {
    "s": "CONCAT_WS(sep, a, b)",
    "t": "(a || sep || b)"
  },
  {
    "s": "CASE WHEN cond THEN a ELSE b END",
    "t": "IF(cond, a, b)"
  },
  {
    "s": "SUBSTRING_INDEX(str, d, n)",
    "t": "(Oracle 无, 需 SUBSTR+INSTR 或正则)"
  },
  {
    "s": "DATE_SUB(dt, INTERVAL n unit) (MySQL)",
    "t": "(dt - INTERVAL n unit) (Oracle)"
  },
  {
    "s": "CURRENT_TIMESTAMP (MySQL)",
    "t": "SYSTIMESTAMP (Oracle)"
  },
  {
    "s": "INSTR(a, b)",
    "t": "INSTR(a, b) (MySQL 原生支持)"
  },
  {
    "s": "LAST_DAY(dt)",
    "t": "LAST_DAY(dt) (MySQL 原生支持)"
  },
  {
    "s": "::INTEGER (PG reverse)",
    "t": "CAST AS SIGNED (MySQL reverse)"
  },
  {
    "s": "COMMIT; / ROLLBACK;",
    "t": "START TRANSACTION; ... COMMIT; / ROLLBACK;"
  },
  {
    "s": "NUMBER(p,s)",
    "t": "DECIMAL(p,s)"
  },
  {
    "s": "CLOB",
    "t": "LONGTEXT"
  },
  {
    "s": "BLOB",
    "t": "LONGBLOB"
  },
  {
    "s": "DATE (Oracle)",
    "t": "DATETIME"
  },
  {
    "s": "TIMESTAMP",
    "t": "DATETIME(6)"
  },
  {
    "s": "PLS_INTEGER / BINARY_INTEGER",
    "t": "INT"
  },
  {
    "s": "BOOLEAN",
    "t": "TINYINT(1)"
  },
  {
    "s": "VARCHAR2 type",
    "t": "VARCHAR type"
  },
  {
    "s": "%ROWTYPE",
    "t": "VARCHAR(4000) (MySQL 无等价)"
  },
  {
    "s": "REAL",
    "t": "DOUBLE"
  },
  {
    "s": "INTEGER",
    "t": "INT"
  },
  {
    "s": "NVARCHAR2(n)",
    "t": "VARCHAR(n)"
  },
  {
    "s": "格式符: YYYY MM DD HH24 MI SS",
    "t": "格式符: %Y %m %d %H %i %s"
  }
]');

-- Body: mysqlToOracle (37 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'body', '[
  {
    "s": "IFNULL(a, b)",
    "t": "NVL(a, b)"
  },
  {
    "s": "IF(a IS NOT NULL, b, c)",
    "t": "NVL2(a, b, c)"
  },
  {
    "s": "CAST(x AS SIGNED)",
    "t": "TO_NUMBER(x)"
  },
  {
    "s": "NOW()",
    "t": "SYSDATE"
  },
  {
    "s": "DATE_FORMAT(expr, fmt) 格式符转换",
    "t": "TO_CHAR(expr, fmt)"
  },
  {
    "s": "STR_TO_DATE(expr, fmt) 格式符转换",
    "t": "TO_DATE(expr, fmt)"
  },
  {
    "s": "SUBSTRING(a, b, c)",
    "t": "SUBSTR(a, b, c)"
  },
  {
    "s": "SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = msg",
    "t": "RAISE_APPLICATION_ERROR(-code, msg)"
  },
  {
    "s": "RESIGNAL;",
    "t": "RAISE; 重新抛出"
  },
  {
    "s": "CONCAT(a, b, ...)",
    "t": "|| 字符串拼接"
  },
  {
    "s": "SELECT expr;",
    "t": "DBMS_OUTPUT.PUT_LINE(expr)"
  },
  {
    "s": "DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN...END",
    "t": "EXCEPTION WHEN OTHERS THEN ..."
  },
  {
    "s": "FETCH FIRST",
    "t": "LIMIT -> FETCH FIRST"
  },
  {
    "s": "PREPARE/EXECUTE/DEALLOCATE 模式",
    "t": "EXECUTE IMMEDIATE expr USING ..."
  },
  {
    "s": "SET var = expr;",
    "t": "var := expr;"
  },
  {
    "s": "ROW_COUNT()",
    "t": "SQL%ROWCOUNT"
  },
  {
    "s": "ELSEIF",
    "t": "ELSIF"
  },
  {
    "s": "WHILE ... DO / END WHILE",
    "t": "WHILE ... LOOP / END LOOP"
  },
  {
    "s": "label: LOOP / END LOOP label",
    "t": "LOOP / END LOOP 基本循环"
  },
  {
    "s": "IF condition THEN LEAVE label; END IF;",
    "t": "EXIT WHEN condition;"
  },
  {
    "s": "_done (配合 HANDLER FOR NOT FOUND)",
    "t": "cursor%NOTFOUND"
  },
  {
    "s": "DECLARE c CURSOR FOR SELECT ...",
    "t": "CURSOR c IS SELECT ..."
  },
  {
    "s": "TIMESTAMPDIFF(MONTH, b, a)",
    "t": "MONTHS_BETWEEN(a, b)"
  },
  {
    "s": "DATE_ADD(dt, INTERVAL n MONTH)",
    "t": "ADD_MONTHS(dt, n)"
  },
  {
    "s": "TRUNCATE(x, n)",
    "t": "TRUNC(x, n) 数值截断"
  },
  {
    "s": "CHAR_LENGTH(x)",
    "t": "LENGTH(x) 字符长度"
  },
  {
    "s": "RAND()",
    "t": "DBMS_RANDOM.VALUE"
  },
  {
    "s": "GROUP_CONCAT(col ORDER BY x SEPARATOR sep)",
    "t": "LISTAGG(col, sep) WITHIN GROUP(ORDER BY x)"
  },
  {
    "s": "expr REGEXP pat",
    "t": "REGEXP_LIKE(expr, pat)"
  },
  {
    "s": "@_err_code",
    "t": "SQLCODE"
  },
  {
    "s": "INSERT...ON DUPLICATE KEY UPDATE",
    "t": "MERGE INTO ... WHEN MATCHED/NOT MATCHED"
  },
  {
    "s": "(a || sep || b)",
    "t": "CONCAT_WS(sep, a, b)"
  },
  {
    "s": "IF(cond, a, b)",
    "t": "CASE WHEN cond THEN a ELSE b END"
  },
  {
    "s": "(Oracle 无, 需 SUBSTR+INSTR 或正则)",
    "t": "SUBSTRING_INDEX(str, d, n)"
  },
  {
    "s": "(dt - INTERVAL n unit) (Oracle)",
    "t": "DATE_SUB(dt, INTERVAL n unit) (MySQL)"
  },
  {
    "s": "SYSTIMESTAMP (Oracle)",
    "t": "CURRENT_TIMESTAMP (MySQL)"
  },
  {
    "s": "START TRANSACTION; ... COMMIT; / ROLLBACK;",
    "t": "COMMIT; / ROLLBACK;"
  }
]');

-- Body: mysqlToPg (74 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'body', '[
  {
    "s": "IFNULL(a, b)",
    "t": "COALESCE(a, b)"
  },
  {
    "s": "CAST(x AS SIGNED)",
    "t": "CAST(x AS INTEGER)"
  },
  {
    "s": "CAST(x AS UNSIGNED)",
    "t": "CAST(x AS INTEGER)"
  },
  {
    "s": "NOW()",
    "t": "CURRENT_DATE"
  },
  {
    "s": "CURRENT_TIMESTAMP",
    "t": "CURRENT_TIMESTAMP 保持"
  },
  {
    "s": "DATE_FORMAT(expr, fmt)",
    "t": "to_char(expr, fmt) 格式符转换"
  },
  {
    "s": "STR_TO_DATE(expr, fmt)",
    "t": "to_date(expr, fmt) 格式符转换"
  },
  {
    "s": "SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT",
    "t": "RAISE EXCEPTION msg USING ERRCODE = ''P0001''"
  },
  {
    "s": "RESIGNAL;",
    "t": "RAISE;"
  },
  {
    "s": "RAISE NOTICE pre-convert (PG->MySQL)",
    "t": "SELECT (pre-convert)"
  },
  {
    "s": "PG interval pre-convert (PG->MySQL)",
    "t": "DATE_ADD pre-convert"
  },
  {
    "s": "PG EXECUTE pre-convert (PG->MySQL)",
    "t": "PREPARE/EXECUTE pre-convert"
  },
  {
    "s": "CONCAT(a, b, ...)",
    "t": "(a || b || ...)"
  },
  {
    "s": "DECLARE HANDLER FOR SQLEXCEPTION",
    "t": "EXCEPTION WHEN OTHERS THEN"
  },
  {
    "s": "DECLARE HANDLER FOR NOT FOUND",
    "t": "EXCEPTION WHEN NO_DATA_FOUND THEN"
  },
  {
    "s": "SELECT expr (调试输出)",
    "t": "RAISE NOTICE ''%'', expr"
  },
  {
    "s": "ELSEIF",
    "t": "ELSIF"
  },
  {
    "s": "WHILE ... DO / END WHILE",
    "t": "WHILE ... LOOP / END LOOP"
  },
  {
    "s": "SET var = expr;",
    "t": "var := expr;"
  },
  {
    "s": "ROW_COUNT()",
    "t": "GET DIAGNOSTICS var = ROW_COUNT"
  },
  {
    "s": "PREPARE/EXECUTE/DEALLOCATE",
    "t": "EXECUTE expr;"
  },
  {
    "s": "TIMESTAMPDIFF(MONTH, a, b)",
    "t": "EXTRACT(YEAR/MONTH FROM AGE(b, a))"
  },
  {
    "s": "DATE_ADD(dt, INTERVAL n MONTH)",
    "t": "(dt + (n || '' month'')::interval)"
  },
  {
    "s": "LAST_DAY(dt)",
    "t": "(date_trunc(''month'', dt) + interval ''1 month'' - interval ''1 day'')"
  },
  {
    "s": "TRUNCATE(x, n)",
    "t": "TRUNC(x, n)"
  },
  {
    "s": "CHAR_LENGTH(x)",
    "t": "LENGTH(x)"
  },
  {
    "s": "RAND()",
    "t": "random()"
  },
  {
    "s": "GROUP_CONCAT(col ORDER BY x SEPARATOR sep)",
    "t": "string_agg(col::TEXT, sep ORDER BY x)"
  },
  {
    "s": "DECLARE c CURSOR FOR SELECT ...",
    "t": "c CURSOR FOR SELECT ..."
  },
  {
    "s": "expr REGEXP pat",
    "t": "expr ~ pat"
  },
  {
    "s": "LIMIT n OFFSET m",
    "t": "LIMIT n OFFSET m 保持"
  },
  {
    "s": "ON DUPLICATE KEY UPDATE col=VALUES(col)",
    "t": "ON CONFLICT (pk) DO UPDATE SET col=EXCLUDED.col"
  },
  {
    "s": "INSERT IGNORE INTO",
    "t": "INSERT INTO ... ON CONFLICT DO NOTHING"
  },
  {
    "s": "label: LOOP",
    "t": "<<label>> LOOP"
  },
  {
    "s": "LEAVE label;",
    "t": "EXIT label;"
  },
  {
    "s": "LEAVE;",
    "t": "EXIT;"
  },
  {
    "s": "IF _done THEN LEAVE ...",
    "t": "EXIT WHEN NOT FOUND;"
  },
  {
    "s": "NOT FOUND (PG->MySQL)",
    "t": "_done handler"
  },
  {
    "s": "@_err_msg",
    "t": "SQLERRM"
  },
  {
    "s": "@_err_code",
    "t": "SQLSTATE"
  },
  {
    "s": "AS SIGNED/UNSIGNED",
    "t": "AS INTEGER"
  },
  {
    "s": "START TRANSACTION",
    "t": "(PG 过程内事务管理不同, 自动移除)"
  },
  {
    "s": "CURRENT_TIMESTAMP(n)",
    "t": "CLOCK_TIMESTAMP()"
  },
  {
    "s": "IF(cond, a, b)",
    "t": "CASE WHEN cond THEN a ELSE b END"
  },
  {
    "s": "FOR r IN SELECT... LOOP (PG)",
    "t": "DECLARE CURSOR + OPEN + FETCH"
  },
  {
    "s": "date_trunc (PG->MySQL)",
    "t": "DATE_FORMAT/CAST"
  },
  {
    "s": "GET STACKED DIAGNOSTICS (PG)",
    "t": "(removed)"
  },
  {
    "s": "expr::TEXT (PG 类型转换)",
    "t": "CAST(expr AS CHAR)"
  },
  {
    "s": "expr::INTEGER",
    "t": "CAST(expr AS SIGNED)"
  },
  {
    "s": "expr::NUMERIC",
    "t": "CAST(expr AS DECIMAL)"
  },
  {
    "s": "expr::DATE",
    "t": "CAST(expr AS DATE)"
  },
  {
    "s": "PG ::TYPE casts (reverse)",
    "t": "MySQL CASTs"
  },
  {
    "s": "SUBSTRING_INDEX(str, d, n)",
    "t": "(PG 无, 需 SUBSTR+INSTR 或正则)"
  },
  {
    "s": "CONCAT_WS(sep, a, b)",
    "t": "concat_ws(sep, a, b) (PG 原生支持)"
  },
  {
    "s": "DATE_SUB(dt, INTERVAL n unit)",
    "t": "(dt - INTERVAL ''n unit'')"
  },
  {
    "s": "SUBSTRING(a, b, c)",
    "t": "SUBSTRING(a FROM b FOR c)"
  },
  {
    "s": "INITCAP(x) (PG 原生)",
    "t": "CONCAT(UPPER(LEFT(x,1)), LOWER(SUBSTRING(x,2)))"
  },
  {
    "s": "strpos(a, b) (PG)",
    "t": "INSTR(a, b) (MySQL)"
  },
  {
    "s": "FOR i IN 1..10 DO (模拟)",
    "t": "FOR i IN 1..10 LOOP"
  },
  {
    "s": "DECIMAL(p,s)",
    "t": "NUMERIC(p,s)"
  },
  {
    "s": "TINYINT(1)",
    "t": "BOOLEAN"
  },
  {
    "s": "TINYINT",
    "t": "SMALLINT"
  },
  {
    "s": "INT",
    "t": "INTEGER"
  },
  {
    "s": "DOUBLE",
    "t": "DOUBLE PRECISION"
  },
  {
    "s": "LONGTEXT / MEDIUMTEXT",
    "t": "TEXT"
  },
  {
    "s": "LONGBLOB",
    "t": "BYTEA"
  },
  {
    "s": "DATETIME",
    "t": "TIMESTAMP"
  },
  {
    "s": "DATETIME(n)",
    "t": "TIMESTAMP(n)"
  },
  {
    "s": "格式符: %Y %m %d %H %i %s",
    "t": "格式符: YYYY MM DD HH24 MI SS"
  },
  {
    "s": "SERIAL",
    "t": "INT AUTO_INCREMENT"
  },
  {
    "s": "BIGSERIAL",
    "t": "BIGINT AUTO_INCREMENT"
  },
  {
    "s": "RECORD (PG)",
    "t": "VARCHAR(4000) (MySQL 无等价)"
  },
  {
    "s": "VARCHAR type",
    "t": "VARCHAR type"
  },
  {
    "s": "NUMERIC type",
    "t": "DECIMAL type"
  }
]');

-- Body: pgToMysql (32 条)
insert into public.user_rules (user_id, kind, rules_json)
values (NULL, 'body', '[
  {
    "s": "COALESCE(a, b)",
    "t": "IFNULL(a, b)"
  },
  {
    "s": "CURRENT_DATE",
    "t": "NOW()"
  },
  {
    "s": "to_char(expr, fmt) 格式符转换",
    "t": "DATE_FORMAT(expr, fmt)"
  },
  {
    "s": "to_date(expr, fmt) 格式符转换",
    "t": "STR_TO_DATE(expr, fmt)"
  },
  {
    "s": "RAISE EXCEPTION msg USING ERRCODE = ''P0001''",
    "t": "SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT"
  },
  {
    "s": "RAISE;",
    "t": "RESIGNAL;"
  },
  {
    "s": "SELECT (pre-convert)",
    "t": "RAISE NOTICE pre-convert (PG->MySQL)"
  },
  {
    "s": "DATE_ADD pre-convert",
    "t": "PG interval pre-convert (PG->MySQL)"
  },
  {
    "s": "PREPARE/EXECUTE pre-convert",
    "t": "PG EXECUTE pre-convert (PG->MySQL)"
  },
  {
    "s": "(a || b || ...)",
    "t": "CONCAT(a, b, ...)"
  },
  {
    "s": "EXCEPTION WHEN OTHERS THEN",
    "t": "DECLARE HANDLER FOR SQLEXCEPTION"
  },
  {
    "s": "RAISE NOTICE ''%'', expr",
    "t": "SELECT expr (调试输出)"
  },
  {
    "s": "ELSIF",
    "t": "ELSEIF"
  },
  {
    "s": "WHILE ... LOOP / END LOOP",
    "t": "WHILE ... DO / END WHILE"
  },
  {
    "s": "var := expr;",
    "t": "SET var = expr;"
  },
  {
    "s": "GET DIAGNOSTICS var = ROW_COUNT",
    "t": "ROW_COUNT()"
  },
  {
    "s": "EXECUTE expr;",
    "t": "PREPARE/EXECUTE/DEALLOCATE"
  },
  {
    "s": "(dt + (n || '' month'')::interval)",
    "t": "DATE_ADD(dt, INTERVAL n MONTH)"
  },
  {
    "s": "(date_trunc(''month'', dt) + interval ''1 month'' - interval ''1 day'')",
    "t": "LAST_DAY(dt)"
  },
  {
    "s": "TRUNC(x, n)",
    "t": "TRUNCATE(x, n)"
  },
  {
    "s": "LENGTH(x)",
    "t": "CHAR_LENGTH(x)"
  },
  {
    "s": "random()",
    "t": "RAND()"
  },
  {
    "s": "string_agg(col::TEXT, sep ORDER BY x)",
    "t": "GROUP_CONCAT(col ORDER BY x SEPARATOR sep)"
  },
  {
    "s": "c CURSOR FOR SELECT ...",
    "t": "DECLARE c CURSOR FOR SELECT ..."
  },
  {
    "s": "expr ~ pat",
    "t": "expr REGEXP pat"
  },
  {
    "s": "_done handler",
    "t": "NOT FOUND (PG->MySQL)"
  },
  {
    "s": "SQLERRM",
    "t": "@_err_msg"
  },
  {
    "s": "DATE_FORMAT/CAST",
    "t": "date_trunc (PG->MySQL)"
  },
  {
    "s": "(removed)",
    "t": "GET STACKED DIAGNOSTICS (PG)"
  },
  {
    "s": "MySQL CASTs",
    "t": "PG ::TYPE casts (reverse)"
  },
  {
    "s": "SUBSTRING(a FROM b FOR c)",
    "t": "SUBSTRING(a, b, c)"
  },
  {
    "s": "CONCAT(UPPER(LEFT(x,1)), LOWER(SUBSTRING(x,2)))",
    "t": "INITCAP(x) (PG 原生)"
  }
]');
