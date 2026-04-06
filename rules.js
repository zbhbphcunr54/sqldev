/* ===== rules.js — 映射规则数据 (DDL 类型映射 + 函数/存储过程 体转换规则) ===== */

/* ----- DDL Type Mapping Rules ----- */
/* ===== DDL TYPE MAPPING RULES (data-driven) ===== */
var _ddlRulesData = {
  oracleToMysql: [
    {source:'NUMBER(p,s)',target:'DECIMAL(p,s)'},
    {source:'NUMBER(p) [p<=3]',target:'TINYINT'},
    {source:'NUMBER(p) [p<=5]',target:'SMALLINT'},
    {source:'NUMBER(p) [p<=9]',target:'INT'},
    {source:'NUMBER(p) [p<=18]',target:'BIGINT'},
    {source:'NUMBER(p)',target:'DECIMAL(p,0)'},
    {source:'NUMBER',target:'DECIMAL(38,10)'},
    {source:'NUMERIC(p,s)',target:'DECIMAL(p,s)'},
    {source:'DECIMAL(p,s)',target:'DECIMAL(p,s)'},
    {source:'INTEGER',target:'INT'},
    {source:'INT',target:'INT'},
    {source:'PLS_INTEGER',target:'INT'},
    {source:'BINARY_INTEGER',target:'INT'},
    {source:'SMALLINT',target:'SMALLINT'},
    {source:'FLOAT',target:'DOUBLE'},
    {source:'BINARY_FLOAT',target:'FLOAT'},
    {source:'BINARY_DOUBLE',target:'DOUBLE'},
    {source:'VARCHAR2(n)',target:'VARCHAR(n)'},
    {source:'NVARCHAR2(n)',target:'VARCHAR(n)'},
    {source:'CHAR(n)',target:'CHAR(n)'},
    {source:'NCHAR(n)',target:'CHAR(n)'},
    {source:'CLOB',target:'LONGTEXT'},
    {source:'NCLOB',target:'LONGTEXT'},
    {source:'LONG',target:'LONGTEXT'},
    {source:'BLOB',target:'LONGBLOB'},
    {source:'RAW(n)',target:'VARBINARY(n)'},
    {source:'LONG RAW',target:'LONGBLOB'},
    {source:'DATE',target:'DATETIME'},
    {source:'TIMESTAMP',target:'TIMESTAMP(6)'},
    {source:'BOOLEAN',target:'TINYINT(1)'},
    {source:'XMLTYPE',target:'LONGTEXT'}
  ],
  oracleToPg: [
    {source:'NUMBER(p,s)',target:'NUMERIC(p,s)'},
    {source:'NUMBER(p) [p<=5]',target:'SMALLINT'},
    {source:'NUMBER(p) [p<=9]',target:'INTEGER'},
    {source:'NUMBER(p) [p<=18]',target:'BIGINT'},
    {source:'NUMBER(p)',target:'NUMERIC(p,0)'},
    {source:'NUMBER',target:'NUMERIC'},
    {source:'NUMERIC(p,s)',target:'NUMERIC(p,s)'},
    {source:'DECIMAL(p,s)',target:'NUMERIC(p,s)'},
    {source:'INTEGER',target:'INTEGER'},
    {source:'INT',target:'INTEGER'},
    {source:'PLS_INTEGER',target:'INTEGER'},
    {source:'BINARY_INTEGER',target:'INTEGER'},
    {source:'SMALLINT',target:'SMALLINT'},
    {source:'FLOAT',target:'REAL'},
    {source:'BINARY_FLOAT',target:'REAL'},
    {source:'BINARY_DOUBLE',target:'DOUBLE PRECISION'},
    {source:'VARCHAR2(n)',target:'VARCHAR(n)'},
    {source:'NVARCHAR2(n)',target:'VARCHAR(n)'},
    {source:'CHAR(n)',target:'CHAR(n)'},
    {source:'NCHAR(n)',target:'CHAR(n)'},
    {source:'CLOB',target:'TEXT'},
    {source:'NCLOB',target:'TEXT'},
    {source:'LONG',target:'TEXT'},
    {source:'BLOB',target:'BYTEA'},
    {source:'RAW',target:'BYTEA'},
    {source:'LONG RAW',target:'BYTEA'},
    {source:'DATE',target:'TIMESTAMP'},
    {source:'TIMESTAMP',target:'TIMESTAMP'},
    {source:'BOOLEAN',target:'BOOLEAN'},
    {source:'XMLTYPE',target:'XML'}
  ],
  mysqlToOracle: [
    {source:'TINYINT(1)',target:'NUMBER(1)'},
    {source:'TINYINT',target:'NUMBER(3)'},
    {source:'SMALLINT',target:'NUMBER(5)'},
    {source:'MEDIUMINT',target:'NUMBER(7)'},
    {source:'INT',target:'NUMBER(10)'},
    {source:'INTEGER',target:'NUMBER(10)'},
    {source:'BIGINT',target:'NUMBER(18)'},
    {source:'DECIMAL(p,s)',target:'NUMBER(p,s)'},
    {source:'NUMERIC(p,s)',target:'NUMBER(p,s)'},
    {source:'DECIMAL(p)',target:'NUMBER(p)'},
    {source:'NUMERIC(p)',target:'NUMBER(p)'},
    {source:'DECIMAL',target:'NUMBER'},
    {source:'NUMERIC',target:'NUMBER'},
    {source:'FLOAT',target:'BINARY_FLOAT'},
    {source:'DOUBLE',target:'BINARY_DOUBLE'},
    {source:'VARCHAR(n)',target:'VARCHAR2(n)'},
    {source:'NVARCHAR(n)',target:'NVARCHAR2(n)'},
    {source:'CHAR(n)',target:'CHAR(n)'},
    {source:'TEXT',target:'CLOB'},
    {source:'MEDIUMTEXT',target:'CLOB'},
    {source:'LONGTEXT',target:'CLOB'},
    {source:'TINYTEXT',target:'CLOB'},
    {source:'BLOB',target:'BLOB'},
    {source:'MEDIUMBLOB',target:'BLOB'},
    {source:'LONGBLOB',target:'BLOB'},
    {source:'TINYBLOB',target:'BLOB'},
    {source:'VARBINARY(n)',target:'RAW(n)'},
    {source:'BINARY(n)',target:'RAW(n)'},
    {source:'DATETIME(n)',target:'TIMESTAMP(n)'},
    {source:'DATETIME',target:'DATE'},
    {source:'TIMESTAMP',target:'TIMESTAMP'},
    {source:'DATE',target:'DATE'},
    {source:'TIME',target:'VARCHAR2(20)'},
    {source:'YEAR',target:'NUMBER(4)'},
    {source:'BIT',target:'NUMBER(1)'},
    {source:'ENUM',target:'VARCHAR2(100)'},
    {source:'SET',target:'VARCHAR2(100)'},
    {source:'JSON',target:'CLOB'},
    {source:'BOOLEAN',target:'NUMBER(1)'}
  ],
  mysqlToPg: [
    {source:'TINYINT(1)',target:'BOOLEAN'},
    {source:'TINYINT',target:'SMALLINT'},
    {source:'SMALLINT',target:'SMALLINT'},
    {source:'MEDIUMINT',target:'INTEGER'},
    {source:'INT',target:'INTEGER'},
    {source:'INTEGER',target:'INTEGER'},
    {source:'BIGINT',target:'BIGINT'},
    {source:'DECIMAL(p,s)',target:'NUMERIC(p,s)'},
    {source:'NUMERIC(p,s)',target:'NUMERIC(p,s)'},
    {source:'DECIMAL(p)',target:'NUMERIC(p)'},
    {source:'NUMERIC(p)',target:'NUMERIC(p)'},
    {source:'DECIMAL',target:'NUMERIC'},
    {source:'NUMERIC',target:'NUMERIC'},
    {source:'FLOAT',target:'REAL'},
    {source:'DOUBLE',target:'DOUBLE PRECISION'},
    {source:'VARCHAR(n)',target:'VARCHAR(n)'},
    {source:'NVARCHAR(n)',target:'VARCHAR(n)'},
    {source:'CHAR(n)',target:'CHAR(n)'},
    {source:'TEXT',target:'TEXT'},
    {source:'MEDIUMTEXT',target:'TEXT'},
    {source:'LONGTEXT',target:'TEXT'},
    {source:'TINYTEXT',target:'TEXT'},
    {source:'BLOB',target:'BYTEA'},
    {source:'MEDIUMBLOB',target:'BYTEA'},
    {source:'LONGBLOB',target:'BYTEA'},
    {source:'TINYBLOB',target:'BYTEA'},
    {source:'VARBINARY',target:'BYTEA'},
    {source:'BINARY',target:'BYTEA'},
    {source:'DATETIME',target:'TIMESTAMP'},
    {source:'TIMESTAMP',target:'TIMESTAMP'},
    {source:'DATE',target:'DATE'},
    {source:'TIME',target:'TIME'},
    {source:'YEAR',target:'INTEGER'},
    {source:'BIT',target:'BOOLEAN'},
    {source:'ENUM',target:'VARCHAR(100)'},
    {source:'SET',target:'VARCHAR(100)'},
    {source:'JSON',target:'JSONB'},
    {source:'BOOLEAN',target:'BOOLEAN'}
  ],
  pgToOracle: [
    {source:'BIGSERIAL',target:'NUMBER(18)'},
    {source:'SERIAL',target:'NUMBER(10)'},
    {source:'SMALLSERIAL',target:'NUMBER(5)'},
    {source:'SMALLINT',target:'NUMBER(5)'},
    {source:'INTEGER',target:'NUMBER(10)'},
    {source:'INT',target:'NUMBER(10)'},
    {source:'BIGINT',target:'NUMBER(18)'},
    {source:'NUMERIC(p,s)',target:'NUMBER(p,s)'},
    {source:'DECIMAL(p,s)',target:'NUMBER(p,s)'},
    {source:'NUMERIC(p)',target:'NUMBER(p)'},
    {source:'DECIMAL(p)',target:'NUMBER(p)'},
    {source:'NUMERIC',target:'NUMBER'},
    {source:'DECIMAL',target:'NUMBER'},
    {source:'REAL',target:'BINARY_FLOAT'},
    {source:'DOUBLE PRECISION',target:'BINARY_DOUBLE'},
    {source:'VARCHAR(n)',target:'VARCHAR2(n)'},
    {source:'CHARACTER VARYING(n)',target:'VARCHAR2(n)'},
    {source:'CHAR(n)',target:'CHAR(n)'},
    {source:'CHARACTER(n)',target:'CHAR(n)'},
    {source:'TEXT',target:'CLOB'},
    {source:'BYTEA',target:'BLOB'},
    {source:'BOOLEAN',target:'NUMBER(1)'},
    {source:'TIMESTAMP WITHOUT TIME ZONE',target:'TIMESTAMP'},
    {source:'TIMESTAMP WITH TIME ZONE',target:'TIMESTAMP'},
    {source:'TIMESTAMP',target:'TIMESTAMP'},
    {source:'DATE',target:'DATE'},
    {source:'TIME WITHOUT TIME ZONE',target:'VARCHAR2(20)'},
    {source:'TIME',target:'VARCHAR2(20)'},
    {source:'JSON',target:'CLOB'},
    {source:'JSONB',target:'CLOB'},
    {source:'XML',target:'XMLTYPE'},
    {source:'UUID',target:'RAW(16)'}
  ],
  pgToMysql: [
    {source:'BIGSERIAL',target:'BIGINT'},
    {source:'SERIAL',target:'INT'},
    {source:'SMALLSERIAL',target:'SMALLINT'},
    {source:'SMALLINT',target:'SMALLINT'},
    {source:'INTEGER',target:'INT'},
    {source:'INT',target:'INT'},
    {source:'BIGINT',target:'BIGINT'},
    {source:'NUMERIC(p,s)',target:'DECIMAL(p,s)'},
    {source:'DECIMAL(p,s)',target:'DECIMAL(p,s)'},
    {source:'NUMERIC(p)',target:'DECIMAL(p)'},
    {source:'DECIMAL(p)',target:'DECIMAL(p)'},
    {source:'NUMERIC',target:'DECIMAL(38,10)'},
    {source:'DECIMAL',target:'DECIMAL(38,10)'},
    {source:'REAL',target:'FLOAT'},
    {source:'DOUBLE PRECISION',target:'DOUBLE'},
    {source:'VARCHAR(n)',target:'VARCHAR(n)'},
    {source:'CHARACTER VARYING(n)',target:'VARCHAR(n)'},
    {source:'CHAR(n)',target:'CHAR(n)'},
    {source:'CHARACTER(n)',target:'CHAR(n)'},
    {source:'TEXT',target:'LONGTEXT'},
    {source:'BYTEA',target:'LONGBLOB'},
    {source:'BOOLEAN',target:'TINYINT(1)'},
    {source:'TIMESTAMP',target:'TIMESTAMP(6)'},
    {source:'DATE',target:'DATE'},
    {source:'TIME',target:'TIME'},
    {source:'JSON',target:'JSON'},
    {source:'JSONB',target:'JSON'},
    {source:'XML',target:'LONGTEXT'},
    {source:'UUID',target:'CHAR(36)'}
  ]
};

/* ===== DEFAULT RULES SNAPSHOT (frozen, for reset) ===== */
var _ddlRulesDefault = JSON.parse(JSON.stringify(_ddlRulesData));

/* ----- Rule Helpers & Shared Handlers ----- */
/* ===== Rule helpers & shared handlers ===== */
function _rf(from, to) {
  var re = new RegExp('\\b' + from.replace(/[.$]/g, '\\$&') + '\\s*\\(', 'gi');
  return function(b) { return b.replace(re, to + '('); };
}
function _rk(from, to) {
  var re = new RegExp('\\b' + from.replace(/[.$]/g, '\\$&') + '\\b', 'gi');
  return function(b) { return b.replace(re, to); };
}
function _typeReplace(pattern, replacement) {
  var re = (pattern instanceof RegExp) ? pattern : new RegExp(pattern, 'gi');
  return function(t) { return t.replace(re, replacement); };
}
function _typeChain() {
  var fns = Array.prototype.slice.call(arguments);
  return function(t) {
    for (var i = 0; i < fns.length; i++) t = fns[i](t);
    return t;
  };
}

/* --- Shared body-transform handlers (referenced by multiple rule categories) --- */

var _handleDecodeToCase = function(b) {
  return b.replace(/\bDECODE\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, function(match, inner) {
    var args = _splitArgs(inner);
    if (args.length < 3) return match;
    var expr = args[0].trim();
    var result = 'CASE ' + expr;
    var remaining = args.length - 1;
    var hasElse = remaining % 2 === 1;
    var pairCount = hasElse ? (remaining - 1) / 2 : remaining / 2;
    for (var i = 0; i < pairCount; i++) {
      result += ' WHEN ' + args[1 + i * 2].trim() + ' THEN ' + args[2 + i * 2].trim();
    }
    if (hasElse) result += ' ELSE ' + args[args.length - 1].trim();
    result += ' END';
    return result;
  });
};

var _handleNvl2ToPgCase = function(b) {
  var nvl2Re = /\bNVL2\s*\(/gi;
  var nvl2Match, nvl2Result = '', nvl2Last = 0;
  while ((nvl2Match = nvl2Re.exec(b)) !== null) {
    nvl2Result += b.substring(nvl2Last, nvl2Match.index);
    var nvl2Start = nvl2Match.index + nvl2Match[0].length;
    var nvl2Depth = 1, nvl2J = nvl2Start, nvl2InQ = false;
    while (nvl2J < b.length && nvl2Depth > 0) {
      if (b[nvl2J] === "'" && !nvl2InQ) nvl2InQ = true;
      else if (b[nvl2J] === "'" && nvl2InQ) { if (nvl2J+1<b.length && b[nvl2J+1]==="'") nvl2J++; else nvl2InQ = false; }
      else if (!nvl2InQ) { if (b[nvl2J] === '(') nvl2Depth++; else if (b[nvl2J] === ')') nvl2Depth--; }
      if (nvl2Depth > 0) nvl2J++;
    }
    var nvl2Inner = b.substring(nvl2Start, nvl2J);
    var nvl2Args = _splitArgs(nvl2Inner);
    if (nvl2Args.length >= 3) {
      var nvl2A = nvl2Args[0].trim(), nvl2B = nvl2Args[1].trim(), nvl2C = nvl2Args[2].trim();
      nvl2Result += 'CASE WHEN ' + nvl2A + ' IS NOT NULL THEN ' + nvl2B + ' ELSE ' + nvl2C + ' END';
    } else {
      nvl2Result += nvl2Match[0] + nvl2Inner + ')';
    }
    nvl2Last = nvl2J + 1;
  }
  if (nvl2Last > 0) { nvl2Result += b.substring(nvl2Last); return nvl2Result; }
  return b;
};

var _handleNvl2ToMysqlIf = function(b) {
  var nvl2Re = /\bNVL2\s*\(/gi;
  var nvl2Match, nvl2Result = '', nvl2Last = 0;
  while ((nvl2Match = nvl2Re.exec(b)) !== null) {
    nvl2Result += b.substring(nvl2Last, nvl2Match.index);
    var nvl2Start = nvl2Match.index + nvl2Match[0].length;
    var nvl2Depth = 1, nvl2J = nvl2Start, nvl2InQ = false;
    while (nvl2J < b.length && nvl2Depth > 0) {
      if (b[nvl2J] === "'" && !nvl2InQ) nvl2InQ = true;
      else if (b[nvl2J] === "'" && nvl2InQ) { if (nvl2J+1<b.length && b[nvl2J+1]==="'") nvl2J++; else nvl2InQ = false; }
      else if (!nvl2InQ) { if (b[nvl2J] === '(') nvl2Depth++; else if (b[nvl2J] === ')') nvl2Depth--; }
      if (nvl2Depth > 0) nvl2J++;
    }
    var nvl2Inner = b.substring(nvl2Start, nvl2J);
    var nvl2Args = _splitArgs(nvl2Inner);
    if (nvl2Args.length >= 3) {
      var nvl2A = nvl2Args[0].trim(), nvl2B = nvl2Args[1].trim(), nvl2C = nvl2Args[2].trim();
      nvl2Result += 'IF(' + nvl2A + ' IS NOT NULL, ' + nvl2B + ', ' + nvl2C + ')';
    } else {
      nvl2Result += nvl2Match[0] + nvl2Inner + ')';
    }
    nvl2Last = nvl2J + 1;
  }
  if (nvl2Last > 0) { nvl2Result += b.substring(nvl2Last); return nvl2Result; }
  return b;
};

var _handleCoalescePgToOracle = function(b) {
  return b.replace(/\bCOALESCE\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, function(m, inner) {
    var args = inner.split(/,(?![^()]*\))/);
    if (args.length <= 2) return 'NVL(' + args.join(',') + ')';
    var result = args[args.length - 1].trim();
    for (var i = args.length - 2; i >= 0; i--) {
      result = 'NVL(' + args[i].trim() + ', ' + result + ')';
    }
    return result;
  });
};

var _handleCoalescePgToMysql = function(b) {
  return b.replace(/\bCOALESCE\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, function(m, inner) {
    var args = inner.split(/,(?![^()]*\))/);
    if (args.length <= 2) return 'IFNULL(' + args.join(',') + ')';
    var result = args[args.length - 1].trim();
    for (var i = args.length - 2; i >= 0; i--) {
      result = 'IFNULL(' + args[i].trim() + ', ' + result + ')';
    }
    return result;
  });
};

var _handleRaiseAppErrorToPg = function(b) {
  b = b.replace(/\bRAISE_APPLICATION_ERROR\s*\(\s*[^,]+,\s*'([^']*)'\s*\)\s*;/gi, "RAISE EXCEPTION '$1' USING ERRCODE = 'P0001';");
  b = b.replace(/\bRAISE_APPLICATION_ERROR\s*\(\s*[^,]+,\s*((?:[^)]*\|\|[^)]*|'[^']*'|[^)]+)+)\)\s*;/gi, "RAISE EXCEPTION '%', $1 USING ERRCODE = 'P0001';");
  return b;
};

var _handleRaiseAppErrorToMysql = function(b) {
  b = b.replace(/\bRAISE_APPLICATION_ERROR\s*\(\s*[^,]+,\s*'([^']*)'\s*\)\s*;/gi, "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$1';");
  b = b.replace(/\bRAISE_APPLICATION_ERROR\s*\(\s*[^,]+,\s*((?:[^)]*\|\|[^)]*|'[^']*'|[^)]+)+)\)\s*;/gi, function(m, msg) {
    var parts = _splitOnPipeOutsideStringsAndParens(msg);
    var converted = parts.length > 1 ? 'CONCAT(' + parts.map(function(p) { return p.trim(); }).join(', ') + ')' : msg;
    if (/\bCONCAT\s*\(/i.test(converted) || /[^']\w+[^']/i.test(converted)) {
      return "SET @_signal_msg = " + converted + ";\n    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @_signal_msg;";
    }
    return "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = " + converted + ";";
  });
  return b;
};

var _handlePgRaiseExToOracle = function(b) {
  b = b.replace(/\bRAISE\s+EXCEPTION\s+'([^']*)'\s*(?:USING\s+[^;]+)?\s*;/gi, "RAISE_APPLICATION_ERROR(-20001, '$1');");
  b = b.replace(/\bRAISE\s+EXCEPTION\s+'[^']*',\s*([^;]+?)\s*(?:USING\s+[^;]+)?\s*;/gi, "RAISE_APPLICATION_ERROR(-20001, $1);");
  return b;
};

var _handlePgRaiseExToMysql = function(b) {
  b = b.replace(/\bRAISE\s+EXCEPTION\s+'([^']*)'\s*(?:USING\s+[^;]+)?\s*;/gi, "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '$1';");
  b = b.replace(/\bRAISE\s+EXCEPTION\s+'[^']*',\s*([^;]+?)\s*(?:USING\s+[^;]+)?\s*;/gi, function(m, expr) {
    return "SET @_signal_msg = " + expr.trim() + ";\n    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @_signal_msg;";
  });
  return b;
};

var _handleMysqlSignalToOracle = function(b) {
  b = b.replace(/\bSIGNAL\s+SQLSTATE\s+'45000'\s+SET\s+MESSAGE_TEXT\s*=\s*'([^']*)'\s*;/gi, "RAISE_APPLICATION_ERROR(-20001, '$1');");
  b = b.replace(/\bSIGNAL\s+SQLSTATE\s+'45000'\s+SET\s+MESSAGE_TEXT\s*=\s*([^;]+)\s*;/gi, "RAISE_APPLICATION_ERROR(-20001, $1);");
  return b;
};

var _handleMysqlSignalToPg = function(b) {
  b = b.replace(/\bSIGNAL\s+SQLSTATE\s+'45000'\s+SET\s+MESSAGE_TEXT\s*=\s*'([^']*)'\s*;/gi, "RAISE EXCEPTION '$1' USING ERRCODE = 'P0001';");
  b = b.replace(/\bSIGNAL\s+SQLSTATE\s+'45000'\s+SET\s+MESSAGE_TEXT\s*=\s*([^;]+)\s*;/gi, "RAISE EXCEPTION '%', $1 USING ERRCODE = 'P0001';");
  return b;
};

var _handleRaiseToResignal = function(b) { return b.replace(/\bRAISE\s*;/gi, 'RESIGNAL;'); };
var _handleResignalToRaise = function(b) { return b.replace(/\bRESIGNAL\s*;/gi, 'RAISE;'); };

var _handlePreConvertRaiseNoticeDbmsToMysql = function(b) {
  b = b.replace(/\bRAISE\s+NOTICE\s+'([^']*)',\s*([^;]+);/gi, function(m, fmt, args) {
    var parts = fmt.split('%');
    var argList = args.split(',').map(function(a) { return a.trim(); });
    if (parts.length > 1 && argList.length >= parts.length - 1) {
      var concatParts = [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i]) concatParts.push("'" + parts[i] + "'");
        if (i < parts.length - 1 && argList[i]) concatParts.push(argList[i]);
      }
      return 'SELECT CONCAT(' + concatParts.join(', ') + ');';
    }
    return 'SELECT ' + args.trim() + ';';
  });
  b = b.replace(/\bDBMS_OUTPUT\.PUT_LINE\s*\(\s*([^;]+)\)\s*;/gi, 'SELECT $1;');
  return b;
};

var _handlePipeConcatToFunction = function(b) {
  var joinedLines = [];
  var accum = '';
  var bLines = b.split('\n');
  for (var li = 0; li < bLines.length; li++) {
    var line = bLines[li];
    if (/^\s*\|\|/.test(line) && accum) {
      accum += '\n' + line;
    } else {
      if (accum) joinedLines.push(accum);
      accum = line;
    }
  }
  if (accum) joinedLines.push(accum);
  for (var ji = 0; ji < joinedLines.length; ji++) {
    if (joinedLines[ji].indexOf('||') >= 0 && !/^\s*--/.test(joinedLines[ji])) {
      var flat = joinedLines[ji].replace(/\n\s*/g, ' ');
      joinedLines[ji] = _convertConcatToFunction(flat);
    }
  }
  return joinedLines.join('\n');
};

var _handleConcatWsMysqlToOracle = function(b) {
  var concatWsRe = /\bCONCAT_WS\s*\(/gi;
  var cwMatch;
  var newB = '';
  var lastIdx = 0;
  while ((cwMatch = concatWsRe.exec(b)) !== null) {
    newB += b.substring(lastIdx, cwMatch.index);
    var startPos = cwMatch.index + cwMatch[0].length;
    var depth = 1, ci = startPos;
    while (ci < b.length && depth > 0) {
      if (b[ci] === '(') depth++;
      else if (b[ci] === ')') depth--;
      if (depth > 0) ci++;
    }
    var inner = b.substring(startPos, ci);
    var cwArgs = _splitArgs(inner);
    if (cwArgs.length < 2) {
      newB += cwMatch[0] + inner + ')';
    } else {
      var sep = cwArgs[0].trim();
      var parts = cwArgs.slice(1).map(function(a) { return a.trim(); });
      if (sep === "''" || sep === "''") newB += '(' + parts.join(' || ') + ')';
      else newB += '(' + parts.join(' || ' + sep + ' || ') + ')';
    }
    lastIdx = ci + 1;
  }
  if (lastIdx > 0) { newB += b.substring(lastIdx); return newB; }
  return b;
};

var _handleConcatWsMysqlToPg = function(b) {
  var concatWsRe = /\bCONCAT_WS\s*\(/gi;
  var cwMatch;
  var newB = '';
  var lastIdx = 0;
  while ((cwMatch = concatWsRe.exec(b)) !== null) {
    newB += b.substring(lastIdx, cwMatch.index);
    var startPos = cwMatch.index + cwMatch[0].length;
    var depth = 1, ci = startPos;
    while (ci < b.length && depth > 0) {
      if (b[ci] === '(') depth++;
      else if (b[ci] === ')') depth--;
      if (depth > 0) ci++;
    }
    var inner = b.substring(startPos, ci);
    newB += 'concat_ws(' + inner + ')';
    lastIdx = ci + 1;
  }
  if (lastIdx > 0) { newB += b.substring(lastIdx); return newB; }
  return b;
};

var _handleSubstringIndexMysqlToOraclePg = function(toDb) {
  return function(b) {
    var dbName = toDb === 'oracle' ? 'Oracle' : 'PG';
    if (/\bSUBSTRING_INDEX\s*\(/i.test(b)) {
      var siDone = false;
      b = b.replace(/\bSUBSTRING_INDEX\s*\(/gi, function(m) {
        if (!siDone) { siDone = true; return '/* [\u6ce8\u610f: ' + dbName + ' \u65e0 SUBSTRING_INDEX, \u8bf7\u6539\u7528 SUBSTR+INSTR \u6216\u6b63\u5219] */ ' + m; }
        return m;
      });
    }
    return b;
  };
};

var _handleExceptionToMysqlHandler = function(b) {
  // First, convert nested BEGIN...EXCEPTION...END blocks
  b = b.replace(/\bBEGIN\b([\s\S]*?)\bEXCEPTION\b([\s\S]*?)\bEND\b\s*;/gi, function(match, bodyBefore, exBlock) {
    var othersMatch = exBlock.match(/WHEN\s+OTHERS\s+THEN([\s\S]*)/i);
    var handlerStmt = '';
    if (othersMatch) {
      handlerStmt = othersMatch[1].trim();
    }
    var result = 'BEGIN\n';
    result += '            DECLARE EXIT HANDLER FOR SQLEXCEPTION\n';
    result += '            BEGIN\n';
    var hLines = handlerStmt.split('\n');
    for (var hi = 0; hi < hLines.length; hi++) {
      var hl = hLines[hi].trim();
      if (!hl) continue;
      hl = hl.replace(/^(\w+)\s*:=\s*/i, 'SET $1 = ');
      hl = hl.replace(/^\s*RAISE\s*;\s*$/i, 'RESIGNAL;');
      hl = hl.replace(/^\s*NULL\s*;\s*$/i, '-- NULL (no-op)');
      result += '              ' + hl + '\n';
    }
    result += '            END;\n';
    result += bodyBefore;
    result += 'END;';
    return result;
  });
  // Convert top-level EXCEPTION block
  b = b.replace(/\bEXCEPTION\b([\s\S]*?)$/i, function(match, exBlock) {
    var othersMatch = exBlock.match(/WHEN\s+OTHERS\s+THEN([\s\S]*?)(?=WHEN\s+\w|$)/i);
    var nodataMatch = exBlock.match(/WHEN\s+NO_DATA_FOUND\s+THEN([\s\S]*?)(?=WHEN\s+\w|$)/i);
    var handlerBody = '';
    if (othersMatch) {
      var body = othersMatch[1].trim();
      body = body.replace(/\bEND\b\s*\w*\s*;?\s*$/, '').trim();
      handlerBody = body;
    }
    var result = '';
    if (nodataMatch) {
      var ndBody = nodataMatch[1].trim().replace(/\bEND\b\s*\w*\s*;?\s*$/, '').trim();
      result += '/* [注意: Oracle NO_DATA_FOUND 仅在 SELECT INTO 无行时触发,\n';
      result += '   而 MySQL HANDLER FOR NOT FOUND 会被所有 FETCH/SELECT INTO 无数据触发,\n';
      result += '   语义更宽泛, 如有 CURSOR FETCH 操作请检查是否产生误触发] */\n';
      result += 'DECLARE CONTINUE HANDLER FOR NOT FOUND\n';
      result += '  BEGIN\n';
      var ndLines = ndBody.split('\n');
      for (var li = 0; li < ndLines.length; li++) {
        var tl = ndLines[li].trim();
        if (!tl) continue;
        tl = tl.replace(/^(\w+)\s*:=\s*/i, 'SET $1 = ');
        result += '    ' + tl + '\n';
      }
      result += '  END;\n';
    }
    if (handlerBody) {
      result += 'DECLARE v_error_msg VARCHAR(2000);\n';
      result += 'DECLARE v_sqlstate CHAR(5);\n';
      result += 'DECLARE EXIT HANDLER FOR SQLEXCEPTION\n';
      result += '  BEGIN\n';
      result += '    GET DIAGNOSTICS CONDITION 1\n';
      result += '      v_error_msg = MESSAGE_TEXT,\n';
      result += '      v_sqlstate = RETURNED_SQLSTATE;\n';
      var hLines = handlerBody.split('\n');
      for (var li = 0; li < hLines.length; li++) {
        var tl = hLines[li].trim();
        if (!tl) continue;
        if (/^\s*RAISE\s*;/i.test(tl)) {
          result += '    RESIGNAL;\n';
        } else if (/ROLLBACK/i.test(tl)) {
          result += '    ROLLBACK;\n';
        } else if (/^\s*SELECT\s+/i.test(tl) && !/\bINTO\b/i.test(tl) && !/\bFROM\b/i.test(tl)) {
          var selExpr = tl.replace(/^\s*SELECT\s+/i, '').replace(/;\s*$/, '');
          result += '    SET @_debug_msg = ' + selExpr + ';\n';
        } else {
          result += '    ' + tl + '\n';
        }
      }
      result += '  END;';
    } else {
      result += '-- [\u6ce8\u610f: Oracle/PG EXCEPTION \u5757\u9700\u624b\u52a8\u6539\u5199\u4e3a MySQL DECLARE HANDLER]';
    }
    return result;
  });
  return b;
};

var _handleMysqlHandlerToOracle = function(b) {
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+SQLEXCEPTION\s*\n?\s*BEGIN([\s\S]*?)END\s*;/gi,
    function(m, handlerType, handlerBody) {
      var lines = handlerBody.trim().split('\n').map(function(l) { return '  --   ' + l.trim(); }).join('\n');
      return '-- [Oracle EXCEPTION \u8f6c\u6362: MySQL ' + handlerType + ' HANDLER FOR SQLEXCEPTION]\n-- EXCEPTION\n--   WHEN OTHERS THEN\n' + lines;
    });
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+SQLEXCEPTION\b([^\n]*)/gi,
    function(m, handlerType, rest) {
      var stmt = rest.trim();
      return '-- [Oracle EXCEPTION \u8f6c\u6362: MySQL ' + handlerType + ' HANDLER]\n-- EXCEPTION WHEN OTHERS THEN ' + stmt;
    });
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+NOT\s+FOUND\s*\n?\s*BEGIN([\s\S]*?)END\s*;/gi,
    function(m, handlerType, handlerBody) {
      var lines = handlerBody.trim().split('\n').map(function(l) { return '  --   ' + l.trim(); }).join('\n');
      return '-- [Oracle EXCEPTION \u8f6c\u6362: MySQL ' + handlerType + ' HANDLER FOR NOT FOUND]\n-- EXCEPTION\n--   WHEN NO_DATA_FOUND THEN\n' + lines;
    });
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+NOT\s+FOUND\b([^\n]*)/gi,
    function(m, handlerType, rest) {
      var stmt = rest.trim();
      return '-- [Oracle EXCEPTION \u8f6c\u6362: MySQL ' + handlerType + ' HANDLER]\n-- EXCEPTION WHEN NO_DATA_FOUND THEN ' + stmt;
    });
  return b;
};

var _handleMysqlHandlerToPg = function(b) {
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+SQLEXCEPTION\s*\n?\s*BEGIN[\s\S]*?END\s*;/gi,
    '-- [\u6ce8\u610f: MySQL HANDLER -> PG \u8bf7\u4f7f\u7528 EXCEPTION WHEN OTHERS THEN]');
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+SQLEXCEPTION\b[^\n]*/gi,
    '-- [\u6ce8\u610f: MySQL HANDLER -> PG \u8bf7\u4f7f\u7528 EXCEPTION WHEN OTHERS THEN]');
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+NOT\s+FOUND\s*\n?\s*BEGIN[\s\S]*?END\s*;/gi,
    '-- [\u6ce8\u610f: MySQL HANDLER -> PG \u8bf7\u4f7f\u7528 EXCEPTION WHEN NO_DATA_FOUND THEN]');
  b = b.replace(/\bDECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+FOR\s+NOT\s+FOUND\b[^\n]*/gi,
    '-- [\u6ce8\u610f: MySQL HANDLER -> PG \u8bf7\u4f7f\u7528 EXCEPTION WHEN NO_DATA_FOUND THEN]');
  return b;
};

var _handleRownumToLimit = function(b) {
  var rownumMatch = b.match(/\bROWNUM\s*<=?\s*(\d+)/i);
  if (rownumMatch) {
    var limitN = rownumMatch[1];
    /* Record approximate position of ROWNUM before stripping */
    var rIdx = b.search(/\bROWNUM\s*<=?\s*\d+/i);
    b = b.replace(/\s*AND\s+ROWNUM\s*<=?\s*\d+/gi, '');
    b = b.replace(/\bWHERE\s+ROWNUM\s*<=?\s*\d+\s*AND\s+/gi, 'WHERE ');
    b = b.replace(/\bWHERE\s+ROWNUM\s*<=?\s*\d+\s*/gi, '');
    /* Insert LIMIT before the semicolon of the statement that contained ROWNUM,
       not at the very end of the body (which breaks procedure bodies). */
    var searchFrom = Math.max(0, rIdx - 40);
    var semiPos = b.indexOf(';', searchFrom);
    if (semiPos >= 0) {
      b = b.substring(0, semiPos) + '\n  LIMIT ' + limitN + b.substring(semiPos);
    } else {
      /* Fallback for DDL without trailing semicolon */
      b = b.replace(/\s*$/, '\n  LIMIT ' + limitN);
    }
  }
  return b;
};

var _handleLimitToFetchFirst = function(b) {
  b = b.replace(/\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*;/gi, function(m, n, off) {
    return 'OFFSET ' + off + ' ROWS FETCH NEXT ' + n + ' ROWS ONLY;';
  });
  b = b.replace(/\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$/gim, function(m, n, off) {
    return 'OFFSET ' + off + ' ROWS FETCH NEXT ' + n + ' ROWS ONLY';
  });
  b = b.replace(/\bLIMIT\s+(\d+)\s*,\s*(\d+)\s*;/gi, function(m, off, n) {
    return 'OFFSET ' + off + ' ROWS FETCH NEXT ' + n + ' ROWS ONLY;';
  });
  b = b.replace(/\bLIMIT\s+(\d+)\s*,\s*(\d+)\s*$/gim, function(m, off, n) {
    return 'OFFSET ' + off + ' ROWS FETCH NEXT ' + n + ' ROWS ONLY';
  });
  b = b.replace(/\bLIMIT\s+(\d+)\s*;/gi, function(m, n) {
    return 'FETCH FIRST ' + n + ' ROWS ONLY;';
  });
  b = b.replace(/\bLIMIT\s+(\d+)\s*$/gim, function(m, n) {
    return 'FETCH FIRST ' + n + ' ROWS ONLY';
  });
  return b;
};

var _handleTruncNumToMysql = function(b) {
  var truncRe = /\bTRUNC\s*\(/gi;
  var truncMatch, truncResult = '', truncLast = 0;
  while ((truncMatch = truncRe.exec(b)) !== null) {
    var tStart = truncMatch.index + truncMatch[0].length;
    var tDepth = 1, ti = tStart;
    while (ti < b.length && tDepth > 0) {
      if (b[ti] === '(') tDepth++;
      else if (b[ti] === ')') tDepth--;
      if (tDepth > 0) ti++;
    }
    var tInner = b.substring(tStart, ti);
    var tArgs = _splitArgs(tInner);
    truncResult += b.substring(truncLast, truncMatch.index);
    if (tArgs.length === 2 && /^\s*\d+\s*$/.test(tArgs[1])) {
      truncResult += 'TRUNCATE(' + tArgs[0].trim() + ', ' + tArgs[1].trim() + ')';
    } else if (tArgs.length === 1) {
      truncResult += 'TRUNCATE(' + tArgs[0].trim() + ', 0)';
    } else {
      truncResult += truncMatch[0] + tInner + ')';
    }
    truncLast = ti + 1;
  }
  if (truncLast > 0) return truncResult + b.substring(truncLast);
  return b;
};

var _handleDbmsRandomValueToFn = function(toDb) {
  return function(b) {
    var rndFn = (toDb === 'postgresql') ? 'random()' : 'RAND()';
    b = b.replace(/\bDBMS_RANDOM\.VALUE\s*\(\s*([^,)]+),\s*([^)]+)\)/gi, function(m, lo, hi) {
      return '(' + lo.trim() + ' + ' + rndFn.replace('()', '') + '() * (' + hi.trim() + ' - ' + lo.trim() + '))';
    });
    b = b.replace(/\bDBMS_RANDOM\.VALUE\b/gi, rndFn);
    return b;
  };
};

var _handleWhileLoopToMysql = function(b) {
  /* Fix: first convert PG <<label>> on separate line to same-line label: format */
  b = b.replace(/(^|\n)\s*<<(\w+)>>\s*\n(\s*LOOP\b)/gi, '$1$3'.replace(/LOOP/, function() { return ''; }) || '$1$3');
  b = b.replace(/<<(\w+)>>\s*\n(\s*)LOOP\b/gi, '$2$1: LOOP');
  b = b.replace(/<<(\w+)>>\s*LOOP\b/gi, '$1: LOOP');
  var lines = b.split('\n');
  var loopStack = [];
  var basicLoopCount = 0;
  var queryForCount = 0;
  /* Track the current innermost loop label for LEAVE fixup */
  var _currentLoopLabels = [];
  for (var li = 0; li < lines.length; li++) {
    if (/^\s*--/.test(lines[li])) continue;
    if (/\bWHILE\b.+\bLOOP\b/i.test(lines[li])) {
      lines[li] = lines[li].replace(/\bWHILE\b(.+?)\bLOOP\b/gi, 'WHILE$1DO');
      loopStack.push('while');
      _currentLoopLabels.push(null);
    } else if (/\bFOR\b.+\bLOOP\b/i.test(lines[li])) {
      if (/\bFOR\s+\w+\s+IN\s+\S+?\s*\.\./i.test(lines[li])) {
        loopStack.push('for');
        _currentLoopLabels.push(null);
      } else {
        queryForCount++;
        var qfLabel = '_for_loop_' + queryForCount;
        loopStack.push({ type: 'query_for', label: qfLabel });
        _currentLoopLabels.push(qfLabel);
      }
    } else if (/^\s*(?:\w+\s*:\s*)?LOOP\b/i.test(lines[li])) {
      basicLoopCount++;
      var loopLabel = '_loop' + basicLoopCount;
      if (/^\s*(\w+)\s*:\s*LOOP\b/i.test(lines[li])) {
        var existingLabel = lines[li].match(/^\s*(\w+)\s*:/)[1];
        loopStack.push({ type: 'basic', label: existingLabel });
        _currentLoopLabels.push(existingLabel);
      } else {
        lines[li] = lines[li].replace(/\bLOOP\b/i, loopLabel + ': LOOP');
        loopStack.push({ type: 'basic', label: loopLabel });
        _currentLoopLabels.push(loopLabel);
      }
    } else if (/\bEND\s+LOOP\b/i.test(lines[li])) {
      var loopType = loopStack.pop();
      _currentLoopLabels.pop();
      if (loopType === 'while' || loopType === 'for') {
        lines[li] = lines[li].replace(/\bEND\s+LOOP\b/gi, 'END WHILE');
      } else if (loopType && loopType.type === 'query_for') {
        lines[li] = lines[li].replace(/\bEND\s+LOOP\b/gi, 'END LOOP ' + loopType.label);
      } else if (loopType && loopType.type === 'basic') {
        lines[li] = lines[li].replace(/\bEND\s+LOOP\b/gi, 'END LOOP ' + loopType.label);
      }
    }
    /* Fix bare LEAVE; -> LEAVE label; using current innermost loop label */
    if (/\bLEAVE\s*;/i.test(lines[li]) && _currentLoopLabels.length > 0) {
      var curLabel = _currentLoopLabels[_currentLoopLabels.length - 1];
      if (curLabel) {
        lines[li] = lines[li].replace(/\bLEAVE\s*;/gi, 'LEAVE ' + curLabel + ';');
      }
    }
  }
  return lines.join('\n');
};

var _handleWhileDoToLoop = function(b) {
  b = b.replace(/\bWHILE\b(.+?)\bDO\b/gi, 'WHILE$1LOOP');
  b = b.replace(/\bEND\s+WHILE\b/gi, 'END LOOP');
  return b;
};

var _handleOracleCursorNotfoundToMysql = function(b) {
  if (/\w+%NOTFOUND\b/i.test(b)) {
    b = 'DECLARE _done INT DEFAULT 0;\nDECLARE CONTINUE HANDLER FOR NOT FOUND SET _done = 1;\n' + b;
  }
  b = b.replace(/\b(\w+)%NOTFOUND\b/gi, '_done');
  b = b.replace(/\b(\w+)%FOUND\b/gi, 'NOT _done');
  b = b.replace(/\b(\w+)%ISOPEN\b/gi, '/* [\u6ce8\u610f: MySQL \u65e0 %ISOPEN] */');
  b = b.replace(/\b(\w+)%ROWCOUNT\b/gi, 'ROW_COUNT()');
  b = b.replace(/\b(\w+)%ROWTYPE\b/gi, '/* [\u6ce8\u610f: MySQL \u65e0 %ROWTYPE, \u8bf7\u6539\u7528\u72ec\u7acb\u53d8\u91cf] */');
  return b;
};

var _handleOracleCursorAttrsToPg = function(b) {
  b = b.replace(/\bIF\s+(\w+)%ISOPEN\s+THEN\s+CLOSE\s+\1\s*;\s*END\s+IF\s*;/gi, 'BEGIN CLOSE $1; EXCEPTION WHEN OTHERS THEN NULL; END;');
  b = b.replace(/\b(\w+)%NOTFOUND\b/gi, 'NOT FOUND');
  b = b.replace(/\b(\w+)%FOUND\b/gi, 'FOUND');
  b = b.replace(/\b(\w+)%ISOPEN\b/gi, 'FALSE /* $1%ISOPEN not available in PG */');
  b = b.replace(/\b(\w+)%ROWTYPE\b/gi, 'RECORD');
  return b;
};

var _handleOracleQueryForToMysql = function(b) {
  var _forLoopRecVars = [];
  var _oraForLoopCount = 0;
  b = b.replace(/(^|\n)(\s*)FOR\s+(\w+)\s+IN\s*\(([\s\S]*?)\)\s*LOOP\b/gi, function(m, pre, indent, recVar, query) {
    var q = query.trim().replace(/\s*\n\s*/g, ' ');
    var selectMatch = q.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\s/i);
    var colNames = [];
    if (selectMatch) {
      var colParts = selectMatch[1].split(',');
      for (var ci = 0; ci < colParts.length; ci++) {
        var colExpr = colParts[ci].trim();
        var aliasMatch = colExpr.match(/\bAS\s+(\w+)\s*$/i);
        if (aliasMatch) {
          colNames.push(aliasMatch[1]);
        } else {
          var lastWord = colExpr.match(/(\w+)\s*$/);
          if (lastWord) colNames.push(lastWord[1]);
        }
      }
    }
    var declares = '';
    var fetchVars = recVar;
    if (colNames.length > 0) {
      for (var ci = 0; ci < colNames.length; ci++) {
        declares += indent + 'DECLARE _rec_' + colNames[ci] + ' VARCHAR(4000);\n';
      }
      fetchVars = colNames.map(function(c) { return '_rec_' + c; }).join(', ');
      _forLoopRecVars.push({ recVar: recVar, colNames: colNames });
    }
    _oraForLoopCount++;
    var _curLabel = '_for_loop_' + _oraForLoopCount;
    return pre + declares + indent + 'DECLARE _done INT DEFAULT 0;\n' + indent + 'DECLARE _cur CURSOR FOR ' + q + ';\n' + indent + 'DECLARE CONTINUE HANDLER FOR NOT FOUND SET _done = 1;\n' + indent + 'OPEN _cur;\n' + indent + _curLabel + ': LOOP\n' + indent + '  FETCH _cur INTO ' + fetchVars + ';\n' + indent + '  IF _done THEN LEAVE ' + _curLabel + '; END IF;';
  });
  for (var ri = 0; ri < _forLoopRecVars.length; ri++) {
    var rv = _forLoopRecVars[ri];
    for (var ci = 0; ci < rv.colNames.length; ci++) {
      b = b.replace(new RegExp('\\b' + rv.recVar + '\\.' + rv.colNames[ci] + '\\b', 'gi'), '_rec_' + rv.colNames[ci]);
    }
  }
  return b;
};

var _handlePgQueryForToMysql = function(b) {
  var _forLoopRecVarsPG = [];
  var _pgForLoopCount = 0;
  b = b.replace(/(^|\n)(\s*)FOR\s+(\w+)\s+IN\s+(SELECT\s+[\s\S]*?)\s+LOOP\b/gi, function(m, pre, indent, recVar, query) {
    var q = query.trim().replace(/\s*\n\s*/g, ' ');
    var selectMatch = q.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\s/i);
    var colNames = [];
    if (selectMatch) {
      var colParts = selectMatch[1].split(',');
      for (var ci = 0; ci < colParts.length; ci++) {
        var colExpr = colParts[ci].trim();
        var aliasMatch = colExpr.match(/\bAS\s+(\w+)\s*$/i);
        if (aliasMatch) colNames.push(aliasMatch[1]);
        else { var lw = colExpr.match(/(\w+)\s*$/); if (lw) colNames.push(lw[1]); }
      }
    }
    var declares = '';
    var fetchVars = recVar;
    if (colNames.length > 0) {
      for (var ci = 0; ci < colNames.length; ci++) declares += indent + 'DECLARE _rec_' + colNames[ci] + ' VARCHAR(4000);\n';
      fetchVars = colNames.map(function(c) { return '_rec_' + c; }).join(', ');
      _forLoopRecVarsPG.push({ recVar: recVar, colNames: colNames });
    }
    _pgForLoopCount++;
    var _curLabel = '_for_loop_' + _pgForLoopCount;
    return pre + declares + indent + 'DECLARE _done INT DEFAULT 0;\n' + indent + 'DECLARE _cur CURSOR FOR ' + q + ';\n' + indent + 'DECLARE CONTINUE HANDLER FOR NOT FOUND SET _done = 1;\n' + indent + 'OPEN _cur;\n' + indent + _curLabel + ': LOOP\n' + indent + '  FETCH _cur INTO ' + fetchVars + ';\n' + indent + '  IF _done THEN LEAVE ' + _curLabel + '; END IF;';
  });
  for (var ri = 0; ri < _forLoopRecVarsPG.length; ri++) {
    var rv = _forLoopRecVarsPG[ri];
    for (var ci = 0; ci < rv.colNames.length; ci++) {
      b = b.replace(new RegExp('\\b' + rv.recVar + '\\.' + rv.colNames[ci] + '\\b', 'gi'), '_rec_' + rv.colNames[ci]);
    }
  }
  return b;
};

var _handleMergeToMysql = function(b) {
  var parenContent = '((?:[^()]+|\\([^)]*\\))*)';
  var mergeReStr = '\\bMERGE\\s+INTO\\s+(\\S+)\\s+(\\w+)\\s*\\n?\\s*USING\\s*\\(([\\s\\S]*?)\\)\\s+(\\w+)\\s+ON\\s*\\(?([^)\\n]+?)\\)?\\s*\\n?\\s*WHEN\\s+MATCHED\\s+THEN\\s+UPDATE\\s+SET\\s+([\\s\\S]*?)\\s*\\n?\\s*WHEN\\s+NOT\\s+MATCHED\\s+THEN\\s+INSERT\\s*\\(' + parenContent + '\\)\\s*VALUES\\s*\\(' + parenContent + '\\)\\s*;';
  var mergeRe = new RegExp(mergeReStr, 'gi');
  return b.replace(mergeRe,
    function(m, tgt, tgtAlias, subquery, srcAlias, onCond, updateSet, insertCols, insertVals) {
      var cleanUpdate = updateSet.trim().replace(new RegExp('\\b' + tgtAlias + '\\.', 'gi'), '').replace(new RegExp('\\b' + srcAlias + '\\.', 'gi'), '');
      var cleanVals = insertVals.trim().replace(new RegExp('\\b' + srcAlias + '\\.', 'gi'), '');
      var cleanCols = insertCols.trim().replace(new RegExp('\\b' + tgtAlias + '\\.', 'gi'), '').replace(new RegExp('\\b' + srcAlias + '\\.', 'gi'), '');
      /* Use MySQL 8.0.20+ alias syntax: INSERT INTO ... AS _new ON DUPLICATE KEY UPDATE col = _new.col */
      var updateParts = cleanUpdate.split(',').map(function(p) {
        var parts = p.trim().split(/\s*=\s*/);
        if (parts.length === 2) return parts[0].trim() + ' = _new.' + parts[0].trim();
        return p.trim();
      });
      return 'INSERT INTO ' + tgt + ' (' + cleanCols + ')\nSELECT ' + cleanVals + '\n  FROM (' + subquery.trim() + ') ' + srcAlias + ' AS _new\nON DUPLICATE KEY UPDATE\n  ' + updateParts.join(',\n  ') + ';';
    });
};

var _handleExecImmediateOracleToMysql = function(b) {
  // First, replace Oracle-style :N or :name bind variable placeholders with ? in SQL string literals
  b = b.replace(/'([^']+)'/g, function(m, inner) {
    if (/\b(SELECT|INSERT|UPDATE|DELETE|MERGE|WHERE|SET|FROM)\b/i.test(inner)) {
      var replaced = inner.replace(/:\w+/g, '?');
      if (replaced !== inner) return "'" + replaced + "'";
    }
    return m;
  });
  return b.replace(/^(\s*)EXECUTE\s+IMMEDIATE\s+([^\n]+?)(?:\s+INTO\s+([^\n]+?))?(?:\s+USING\s+([^\n]+?))?\s*;/gim, function(m, indent, expr, intoVars, usingVars) {
    if (/^\s*--/.test(m)) return m;
    var v = expr.trim();
    var result = indent + 'SET @_dyn_sql = ' + v + ';\n' + indent + 'PREPARE _dyn_stmt FROM @_dyn_sql;';
    if (usingVars) {
      var uVars = usingVars.trim().split(/\s*,\s*/);
      var uSets = [];
      var uRefs = [];
      for (var ui = 0; ui < uVars.length; ui++) {
        var uv = uVars[ui].trim();
        uSets.push('SET @_p' + ui + ' = ' + uv + ';');
        uRefs.push('@_p' + ui);
      }
      result += '\n' + indent + uSets.join('\n' + indent);
      result += '\n' + indent + 'EXECUTE _dyn_stmt USING ' + uRefs.join(', ') + ';';
    } else {
      result += '\n' + indent + 'EXECUTE _dyn_stmt;';
    }
    if (intoVars) {
      result += '\n' + indent + '-- [\u6ce8\u610f: MySQL PREPARE/EXECUTE \u4e0d\u652f\u6301 INTO, \u8bf7\u7528 SELECT...INTO \u66ff\u4ee3]';
      result += '\n' + indent + '-- \u539f\u59cb INTO: ' + intoVars.trim();
    }
    result += '\n' + indent + 'DEALLOCATE PREPARE _dyn_stmt;';
    return result;
  });
};

var _handlePgExecuteToMysql = function(b) {
  return b.replace(/\bEXECUTE\s+(?!IMMEDIATE\b)([^;]+);/gi, function(m, expr) {
    var v = expr.trim();
    if (/^\s*(stmt|_dyn_stmt)\b/i.test(v)) return m;
    var usingMatch = v.match(/^([\s\S]+?)\s+USING\s+([\s\S]+)$/i);
    if (usingMatch) {
      var sqlExpr = usingMatch[1].trim();
      var usingParams = usingMatch[2].trim().split(/\s*,\s*/);
      var result = 'SET @_dyn_sql = ' + sqlExpr + ';\n  PREPARE _dyn_stmt FROM @_dyn_sql;';
      var uSets = [];
      var uRefs = [];
      for (var ui = 0; ui < usingParams.length; ui++) {
        var uv = usingParams[ui].trim();
        uSets.push('SET @_p' + ui + ' = ' + uv + ';');
        uRefs.push('@_p' + ui);
      }
      result += '\n  ' + uSets.join('\n  ');
      result += '\n  EXECUTE _dyn_stmt USING ' + uRefs.join(', ') + ';';
      result += '\n  DEALLOCATE PREPARE _dyn_stmt;';
      return result;
    }
    return 'SET @_dyn_sql = ' + v + ';\n  PREPARE _dyn_stmt FROM @_dyn_sql;\n  EXECUTE _dyn_stmt;\n  DEALLOCATE PREPARE _dyn_stmt;';
  });
};

var _handleMysqlPrepExecToOraclePg = function(toDb) {
  return function(b) {
    /* Tolerant pattern: allow variable whitespace, comments, blank lines between the four statements.
       Also handle optional USING clause in EXECUTE. */
    return b.replace(/SET\s+@(\w+)\s*=\s*([^;]+);\s*\n[\s\S]*?PREPARE\s+(\w+)\s+FROM\s+@\1\s*;\s*\n[\s\S]*?EXECUTE\s+\3(?:\s+USING\s+([^;]*))?\s*;\s*\n[\s\S]*?DEALLOCATE\s+PREPARE\s+\3\s*;/gi, function(m, varName, expr, stmtName, usingClause) {
      var cleanExpr = expr.trim();
      if (usingClause) {
        /* Convert USING @var1, @var2 to bind syntax */
        var params = usingClause.split(',').map(function(p) { return p.trim().replace(/^@/, ''); });
        if (toDb === 'oracle') {
          /* Replace ? or concat placeholders with :p1, :p2 */
          var idx = 0;
          var oraExpr = cleanExpr.replace(/\?/g, function() { return ':p' + (++idx); });
          return 'EXECUTE IMMEDIATE ' + oraExpr + ' USING ' + params.join(', ') + ';';
        }
        var idx2 = 0;
        var pgExpr = cleanExpr.replace(/\?/g, function() { return '$' + (++idx2); });
        return 'EXECUTE ' + pgExpr + ' USING ' + params.join(', ') + ';';
      }
      if (toDb === 'oracle') return 'EXECUTE IMMEDIATE ' + cleanExpr + ';';
      return 'EXECUTE ' + cleanExpr + ';';
    });
  };
};

var _handleAssignToSet = function(b) {
  return b.replace(/^(\s*)(\w+)\s*:=\s*(.+);/gm, '$1SET $2 = $3;');
};

var _handleSetToAssign = function(b) {
  return b.replace(/\bSET\s+(\w+)\s*=\s*(.+?)\s*;/gim, function(m, vname, expr, offset) {
    if (/^(TRANSACTION|SESSION|GLOBAL|NAMES|CHARACTER|MESSAGE_TEXT)/i.test(vname)) return m;
    var lineStart = b.lastIndexOf('\n', offset);
    var beforeSet = b.substring(lineStart >= 0 ? lineStart : 0, offset);
    if (/\bUPDATE\b/i.test(beforeSet)) return m;
    return vname + ' := ' + expr.trim() + ';';
  });
};

var _handleSqlRowcountOracleToPg = function(b) {
  b = b.replace(/^(\s*)(\w+)\s*:=\s*(.*?)\bSQL%ROWCOUNT\b(.*?)\s*;/gim, function(m, indent, varName, before, after) {
    return indent + 'GET DIAGNOSTICS _pg_rowcount = ROW_COUNT;\n' + indent + varName + ' := ' + before + '_pg_rowcount' + after + ';';
  });
  b = b.replace(/\bSQL%ROWCOUNT\b/gi, '_pg_rowcount /* GET DIAGNOSTICS _pg_rowcount = ROW_COUNT */');
  return b;
};

var _handlePgNotFoundToOracle = function(b) {
  return b.replace(/\bNOT\s+FOUND\b(?!\s+handler)/gi, function(m, offset) {
    var before = b.substring(0, offset);
    if (/EXIT\s+WHEN\s*$/i.test(before) || /(?:^|\n)\s*WHEN\s*$/i.test(before)) {
      /* Scan backwards for nearest FETCH cursor_name or OPEN cursor_name to resolve actual cursor */
      var fetchMatch = before.match(/\b(?:FETCH|OPEN)\s+(\w+)\b(?!.*\b(?:FETCH|OPEN)\s+\w+\b)/si);
      var cursorName = fetchMatch ? fetchMatch[1] : 'C1';
      return cursorName + '%NOTFOUND';
    }
    return m;
  });
};

var _handleMysqlIfToCase = function(b) {
  var ifMaxIter = 20;
  while (ifMaxIter-- > 0 && /\bIF\s*\(/i.test(b)) {
    var prevB = b;
    b = b.replace(/\bIF\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi,
      function(m, cond, thenVal, elseVal) {
        return 'CASE WHEN ' + cond.trim() + ' THEN ' + thenVal.trim() + ' ELSE ' + elseVal.trim() + ' END';
      });
    if (b === prevB) break;
  }
  return b;
};

var _handlePgDateTruncToMysql = function(b) {
  b = b.replace(/\bdate_trunc\s*\(\s*'month'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "CAST(DATE_FORMAT($1, '%Y-%m-01') AS DATE)");
  b = b.replace(/\bdate_trunc\s*\(\s*'year'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "CAST(DATE_FORMAT($1, '%Y-01-01') AS DATE)");
  b = b.replace(/\bdate_trunc\s*\(\s*'day'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "CAST($1 AS DATE)");
  b = b.replace(/\bdate_trunc\s*\(\s*'hour'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "DATE_FORMAT($1, '%Y-%m-%d %H:00:00')");
  b = b.replace(/\bdate_trunc\s*\(\s*'minute'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "DATE_FORMAT($1, '%Y-%m-%d %H:%i:00')");
  b = b.replace(/\bdate_trunc\s*\(\s*'second'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "CAST($1 AS DATETIME)");
  b = b.replace(/\bdate_trunc\s*\(\s*'quarter'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "MAKEDATE(YEAR($1), 1) + INTERVAL (QUARTER($1) - 1) QUARTER");
  b = b.replace(/\bdate_trunc\s*\(\s*'week'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "DATE_SUB($1, INTERVAL WEEKDAY($1) DAY)");
  return b;
};

var _handlePgDateTruncToOracle = function(b) {
  b = b.replace(/\bdate_trunc\s*\(\s*'month'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "TRUNC($1, 'MM')");
  b = b.replace(/\bdate_trunc\s*\(\s*'year'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "TRUNC($1, 'YYYY')");
  b = b.replace(/\bdate_trunc\s*\(\s*'day'\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, "TRUNC($1)");
  return b;
};

var _handleOracleMonthsBetweenToPg = function(b) {
  return b.replace(/\bMONTHS_BETWEEN\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi,
    "(EXTRACT(YEAR FROM AGE($1, $2)) * 12 + EXTRACT(MONTH FROM AGE($1, $2)) + EXTRACT(DAY FROM AGE($1, $2)) / 31.0)");
};

var _handleOracleMonthsBetweenToMysql = function(b) {
  return b.replace(/\bMONTHS_BETWEEN\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, 'TIMESTAMPDIFF(MONTH, $2, $1)');
};

var _handleMysqlTimestampdiffToOracle = function(b) {
  return b.replace(/\bTIMESTAMPDIFF\s*\(\s*MONTH\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi, 'MONTHS_BETWEEN($2, $1)');
};

var _handleMysqlTimestampdiffToPg = function(b) {
  return b.replace(/\bTIMESTAMPDIFF\s*\(\s*MONTH\s*,\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\)/gi,
    "(EXTRACT(YEAR FROM AGE($2, $1)) * 12 + EXTRACT(MONTH FROM AGE($2, $1)) + EXTRACT(DAY FROM AGE($2, $1)) / 31.0)");
};

var _handlePgExtractAgeToOracle = function(b) {
  return b.replace(/\(\s*EXTRACT\s*\(\s*YEAR\s+FROM\s+AGE\s*\(\s*([^,]+),\s*([^)]+)\)\s*\)\s*\*\s*12\s*\+\s*EXTRACT\s*\(\s*MONTH\s+FROM\s+AGE\s*\(\s*[^,]+,\s*[^)]+\)\s*\)(?:\s*\+\s*EXTRACT\s*\(\s*DAY\s+FROM\s+AGE\s*\(\s*[^,]+,\s*[^)]+\)\s*\)\s*\/\s*31\.0)?\s*\)/gi,
    'MONTHS_BETWEEN($1, $2)');
};


function _splitArgs(str) {
  let result = [], depth = 0, current = '', inQ = false, qChar = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQ) {
      current += ch;
      if (ch === qChar && str[i - 1] !== '\\') inQ = false;
    } else if (ch === "'" || ch === '"') {
      inQ = true; qChar = ch; current += ch;
    } else if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { result.push(current); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) result.push(current);
  return result;
}

function _splitParamList(paramStr) {
  return _splitArgs(paramStr).map(function(p) { return p.trim(); }).filter(function(p) { return p.length > 0; });
}


function _convertConcatToFunction(line) {
  if (line.indexOf('||') < 0) return line;
  // Skip comments
  if (/^\s*--/.test(line)) return line;
  const leading = line.match(/^(\s*)/)[1];
  const trimmed = line.trim();

  // Helper: recursively convert || inside an expression, including within function args
  function _deepConvertPipe(expr) {
    if (expr.indexOf('||') < 0) return expr;
    // First try splitting at depth 0
    var parts = _splitOnPipeOutsideStringsAndParens(expr);
    if (parts.length > 1) {
      // Recursively process each part for nested || inside parens
      var processed = parts.map(function(p) { return _deepConvertInside(p.trim()); });
      return 'CONCAT(' + processed.join(', ') + ')';
    }
    // No top-level ||, try inside function arguments
    return _deepConvertInside(expr);
  }

  // Convert || inside function argument lists
  function _deepConvertInside(expr) {
    if (expr.indexOf('||') < 0) return expr;
    var result = '', i = 0;
    while (i < expr.length) {
      if (expr[i] === "'" ) {
        // Skip string literal
        result += expr[i]; i++;
        while (i < expr.length) {
          if (expr[i] === "'" && i+1 < expr.length && expr[i+1] === "'") {
            result += "''"; i += 2;
          } else if (expr[i] === "'") {
            result += "'"; i++; break;
          } else { result += expr[i]; i++; }
        }
      } else if (expr[i] === '(') {
        // Find matching close paren and recursively convert
        var start = i; var depth = 1; i++;
        var inQ = false;
        while (i < expr.length && depth > 0) {
          if (expr[i] === "'" && !inQ) inQ = true;
          else if (expr[i] === "'" && inQ) { if (i+1<expr.length && expr[i+1]==="'") i++; else inQ = false; }
          else if (!inQ) { if (expr[i] === '(') depth++; else if (expr[i] === ')') depth--; }
          if (depth > 0) i++;
        }
        var inner = expr.substring(start + 1, i);
        // Convert || inside each comma-separated argument
        if (inner.indexOf('||') >= 0) {
          var args = _splitArgs(inner);
          var convertedArgs = args.map(function(a) { return _deepConvertPipe(a.trim()); });
          result += '(' + convertedArgs.join(', ') + ')';
        } else {
          result += '(' + inner + ')';
        }
        i++; // skip closing paren
      } else {
        result += expr[i]; i++;
      }
    }
    return result;
  }

  // Match assignment (:= expr;), SET var = expr;, or RETURN expr;
  const assignMatch = trimmed.match(/^(.+?:=\s*)(.*\|\|.*?)(;\s*$)/i);
  const setMatch = !assignMatch && trimmed.match(/^(SET\s+\w+\s*=\s*)(.*\|\|.*?)(;\s*$)/i);
  const returnMatch = !assignMatch && !setMatch && trimmed.match(/^(RETURN\s+)(.*\|\|.*?)(;\s*$)/i);
  const selectMatch = !assignMatch && !setMatch && !returnMatch && trimmed.match(/^(SELECT\s+)(.*\|\|.*?)(;\s*$)/i);
  const match = assignMatch || setMatch || returnMatch || selectMatch;

  if (match) {
    const prefix = match[1];
    const expr = match[2];
    const suffix = match[3];
    var converted = _deepConvertPipe(expr);
    return leading + prefix + converted + suffix;
  }

  // Handle function calls with || inside arguments, e.g. DBMS_OUTPUT.PUT_LINE('x' || y);
  // Replace || inside each top-level parenthesized argument list
  let convertedLine = trimmed;
  let changed = false;
  convertedLine = convertedLine.replace(/(\b\w+(?:\.\w+)?\s*)\(([^()]*\|\|[^()]*)\)/g, function(fm, fnName, inner) {
    const innerParts = _splitOnPipeOutsideStringsAndParens(inner);
    if (innerParts.length > 1) {
      changed = true;
      return fnName + '(CONCAT(' + innerParts.map(function(p) { return p.trim(); }).join(', ') + '))';
    }
    return fm;
  });
  if (changed) return leading + convertedLine;

  // Fallback: try to convert the whole line if it has ||
  const parts2 = _splitOnPipeOutsideStringsAndParens(trimmed);
  if (parts2.length > 1) {
    return leading + 'CONCAT(' + parts2.map(function(p) { return p.trim(); }).join(', ') + ')';
  }
  return line;
}

function _splitOnPipeOutsideStringsAndParens(expr) {
  let parts = [], current = '', inSingle = false, depth = 0, i = 0;
  while (i < expr.length) {
    if (expr[i] === "'" && !inSingle) {
      inSingle = true; current += expr[i]; i++;
    } else if (expr[i] === "'" && inSingle) {
      if (i + 1 < expr.length && expr[i + 1] === "'") {
        current += "''"; i += 2;
      } else {
        inSingle = false; current += expr[i]; i++;
      }
    } else if (inSingle) {
      current += expr[i]; i++;
    } else if (expr[i] === '(') {
      depth++; current += expr[i]; i++;
    } else if (expr[i] === ')') {
      depth--; current += expr[i]; i++;
    } else if (!inSingle && depth === 0 && expr[i] === '|' && i + 1 < expr.length && expr[i + 1] === '|') {
      parts.push(current); current = ''; i += 2;
    } else {
      current += expr[i]; i++;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function _convertConcatToPipe(body) {
  // Replace CONCAT(a, b, ...) with (a || b || ...) handling nested parens
  let result = '', i = 0;
  while (i < body.length) {
    // Look for CONCAT( keyword, but NOT GROUP_CONCAT (check preceding char)
    const concatMatch = body.substring(i).match(/^\bCONCAT\s*\(/i);
    if (concatMatch && i > 0 && /\w/.test(body[i - 1])) {
      // Preceded by word char (e.g. GROUP_CONCAT) — skip, not a standalone CONCAT
      result += body[i]; i++; continue;
    }
    if (concatMatch) {
      const start = i + concatMatch[0].length;
      // Find matching closing paren
      let depth = 1, j = start, inQ = false;
      while (j < body.length && depth > 0) {
        if (body[j] === "'" && !inQ) { inQ = true; }
        else if (body[j] === "'" && inQ) {
          if (j + 1 < body.length && body[j+1] === "'") { j++; } else { inQ = false; }
        }
        else if (!inQ) {
          if (body[j] === '(') depth++;
          else if (body[j] === ')') depth--;
        }
        if (depth > 0) j++;
      }
      const inner = body.substring(start, j);
      // Split on commas at depth 0
      let args = [], cur = '', d = 0, iq = false;
      for (let k = 0; k < inner.length; k++) {
        const ch = inner[k];
        if (ch === "'" && !iq) { iq = true; cur += ch; }
        else if (ch === "'" && iq) {
          if (k + 1 < inner.length && inner[k+1] === "'") { cur += "''"; k++; }
          else { iq = false; cur += ch; }
        }
        else if (iq) { cur += ch; }
        else if (ch === '(') { d++; cur += ch; }
        else if (ch === ')') { d--; cur += ch; }
        else if (ch === ',' && d === 0) { args.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      if (cur.trim()) args.push(cur.trim());
      // Recursively convert any nested CONCAT in args
      args = args.map(function(a) { return _convertConcatToPipe(a); });
      if (args.length > 1) {
        result += '(' + args.join(' || ') + ')';
      } else {
        result += args[0] || '';
      }
      i = j + 1;
    } else {
      result += body[i];
      i++;
    }
  }
  return result;
}

function _convertDateFormat(fmt, fromDb, toDb) {
  if (fromDb === toDb) return fmt;
  const oracleToMySQL = {'MONTH':'%M','YYYY':'%Y','MON':'%b','HH24':'%H','DAY':'%W','DD':'%d','DY':'%a','HH':'%h','MI':'%i','MM':'%m','SS':'%s','YY':'%y','D':'%w','J':'%j'};
  const mysqlToOracle = {'%M':'MONTH','%Y':'YYYY','%b':'MON','%H':'HH24','%W':'DAY','%d':'DD','%a':'DY','%h':'HH','%i':'MI','%m':'MM','%s':'SS','%y':'YY','%w':'D','%j':'J'};
  function _replaceByMap(str, map) {
    var keys = Object.keys(map).sort(function(a, b) { return b.length - a.length; });
    var pattern = keys.map(function(k) { return k.replace(/[.*+?^${}()|[\]\\%]/g, '\\$&'); }).join('|');
    return str.replace(new RegExp(pattern, 'gi'), function(m) { return map[m] || map[m.toUpperCase()] || m; });
  }
  if (toDb === 'mysql' && fromDb !== 'mysql') {
    fmt = _replaceByMap(fmt, oracleToMySQL);
  } else if (fromDb === 'mysql' && toDb !== 'mysql') {
    fmt = _replaceByMap(fmt, mysqlToOracle);
  }
  return fmt;
}


/* ----- Body / Function / Procedure Rules ----- */
/* ===== _bodyRulesData: single source of truth for body & type transformations ===== */
var _bodyRulesData = {
  /* ---------- Oracle <-> PostgreSQL ---------- */
  oraclePg: [
    /* DECODE -> CASE */
    {s:'DECODE(expr, v1, r1, ..., def)',t:'CASE expr WHEN v1 THEN r1 ... ELSE def END', fwd: _handleDecodeToCase, rev: null},
    /* NVL -> COALESCE */
    {s:'NVL(a, b)',t:'COALESCE(a, b)', fwd: _rf('NVL','COALESCE'), rev: _handleCoalescePgToOracle},
    /* NVL2 -> CASE WHEN */
    {s:'NVL2(a, b, c)',t:'CASE WHEN a IS NOT NULL THEN b ELSE c END', fwd: _handleNvl2ToPgCase, rev: null},
    /* TO_NUMBER -> CAST AS INTEGER */
    {s:'TO_NUMBER(x)',t:'CAST(x AS INTEGER)', fwd: function(b) { return b.replace(/\bTO_NUMBER\s*\(\s*([^)]+)\s*\)/gi, 'CAST($1 AS INTEGER)'); }, rev: null},
    /* SYSDATE / SYSTIMESTAMP */
    {s:'SYSTIMESTAMP',t:'CLOCK_TIMESTAMP()', fwd: _rk('SYSTIMESTAMP','CLOCK_TIMESTAMP()'), rev: function(b) { b = b.replace(/\bCLOCK_TIMESTAMP\s*\(\s*\)/gi, 'SYSTIMESTAMP'); return b; }},
    {s:'SYSDATE',t:'CURRENT_DATE', fwd: _rk('SYSDATE','CURRENT_DATE'), rev: function(b) { b = b.replace(/\bCURRENT_DATE\b/gi, 'SYSDATE'); b = b.replace(/\bNOW\s*\(\s*\)/gi, 'SYSDATE'); return b; }},
    /* TO_CHAR with format */
    {s:'TO_CHAR(expr, fmt)',t:'to_char(expr, fmt) \u683c\u5f0f\u7b26\u8f6c\u6362', fwd: null, rev: null},
    /* TO_CHAR single arg */
    {s:'TO_CHAR(expr) \u5355\u53c2\u6570',t:'expr::TEXT', fwd: function(b) { return b.replace(/\bTO_CHAR\s*\(\s*([^,)]+)\s*\)/gi, '$1::TEXT'); }, rev: null},
    /* TO_DATE */
    {s:'TO_DATE(expr, fmt)',t:'to_date(expr, fmt) \u683c\u5f0f\u7b26\u8f6c\u6362', fwd: null, rev: null},
    /* SUBSTR -> SUBSTRING FROM FOR */
    {s:'SUBSTR(a, b, c)',t:'SUBSTRING(a FROM b FOR c)', fwd: function(b) { return b.replace(/\bSUBSTR\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*((?:[^,()]+|\([^)]*\))*[^)]*)\)/gi, 'SUBSTRING($1 FROM $2 FOR $3)'); }, rev: function(b) { return b.replace(/\bSUBSTRING\s*\(\s*((?:[^,()]+|\([^)]*\))+?)\s+FROM\s+(\S+)\s+FOR\s+(\S+)\s*\)/gi, 'SUBSTR($1, $2, $3)'); }},
    /* RAISE_APPLICATION_ERROR (must run BEFORE || -> CONCAT) */
    {s:'RAISE_APPLICATION_ERROR(-code, msg)',t:"RAISE EXCEPTION msg USING ERRCODE = 'P0001'", fwd: _handleRaiseAppErrorToPg, rev: _handlePgRaiseExToOracle},
    /* RAISE; re-throw */
    {s:'RAISE; \u91cd\u65b0\u629b\u51fa',t:'RAISE;', fwd: null, rev: null},
    /* || concat (stays the same for Oracle<->PG) */
    {s:'|| \u5b57\u7b26\u4e32\u62fc\u63a5',t:'|| \u4fdd\u6301\u4e0d\u53d8', fwd: null, rev: null},
    /* DBMS_OUTPUT.PUT_LINE */
    {s:'DBMS_OUTPUT.PUT_LINE(expr)',t:"RAISE NOTICE '%', expr", fwd: function(b) { return b.replace(/\bDBMS_OUTPUT\.PUT_LINE\s*\(\s*([^;]+)\)\s*;/gi, "RAISE NOTICE '%', $1;"); }, rev: function(b) { b = b.replace(/\bRAISE\s+NOTICE\s+'([^']*)',\s*([^;]+);/gi, function(m, fmt, args) { var parts = args.split(/\s*,\s*/); if (parts.length > 1) return 'DBMS_OUTPUT.PUT_LINE(' + parts.join(" || ' ' || ") + ');'; return 'DBMS_OUTPUT.PUT_LINE(' + args.trim() + ');'; }); b = b.replace(/\bRAISE\s+NOTICE\s+'([^']*)'\s*;/gi, "DBMS_OUTPUT.PUT_LINE('$1');"); return b; }},
    /* EXCEPTION handling (Oracle/PG keep mostly, but conversion to MySQL is separate) */
    {s:'EXCEPTION WHEN OTHERS THEN',t:'EXCEPTION WHEN OTHERS THEN \u4fdd\u6301', fwd: null, rev: null},
    /* ROWNUM -> LIMIT */
    {s:'ROWNUM <= n',t:'LIMIT n', fwd: _handleRownumToLimit, rev: null},
    /* EXECUTE IMMEDIATE -> EXECUTE (with bind-variable conversion) */
    {s:'EXECUTE IMMEDIATE expr',t:'EXECUTE expr USING ...', fwd: function(b) {
      /* Handle EXECUTE IMMEDIATE ... USING ... with Oracle bind vars :1/:name -> $1,$2 */
      b = b.replace(/\bEXECUTE\s+IMMEDIATE\s+([^\n;]+?)\s+USING\s+([^\n;]+)\s*;/gi, function(m, expr, usingVars) {
        var params = usingVars.split(/\s*,\s*/);
        var idx = 0;
        var newExpr = expr.replace(/:\w+/g, function() { return '$' + (++idx); });
        if (idx === 0) { idx = 0; newExpr = expr.replace(/\?/g, function() { return '$' + (++idx); }); }
        return 'EXECUTE ' + newExpr + ' USING ' + params.join(', ') + ';';
      });
      /* Handle simple EXECUTE IMMEDIATE with string concatenation -> EXECUTE ... USING $1 */
      b = b.replace(/\bEXECUTE\s+IMMEDIATE\s+('(?:[^']|'')*')\s*\|\|\s*(\w[\w.]*)\s*;/gi, function(m, sql, variable) {
        return "EXECUTE " + sql + " || $1 USING " + variable + ";";
      });
      /* Fallback: strip IMMEDIATE for remaining cases */
      b = b.replace(/\bEXECUTE\s+IMMEDIATE\b/gi, 'EXECUTE');
      return b;
    }, rev: function(b) { return b.replace(/\bEXECUTE\s+(?!IMMEDIATE\b)([^;]+);/gi, function(m, expr) { if (/^\s*(stmt|_dyn_stmt)\b/i.test(expr)) return m; return 'EXECUTE IMMEDIATE ' + expr.trim() + ';'; }); }},
    /* SQL%ROWCOUNT */
    {s:'SQL%ROWCOUNT',t:'GET DIAGNOSTICS var = ROW_COUNT', fwd: _handleSqlRowcountOracleToPg, rev: function(b) { return b.replace(/\bGET\s+DIAGNOSTICS\s+(\w+)\s*=\s*ROW_COUNT\s*;/gi, '$1 := SQL%ROWCOUNT;'); }},
    /* ELSIF stays */
    {s:'ELSIF',t:'ELSIF \u4fdd\u6301', fwd: null, rev: null},
    /* WHILE LOOP stays */
    {s:'WHILE ... LOOP / END LOOP',t:'WHILE ... LOOP / END LOOP \u4fdd\u6301', fwd: null, rev: null},
    /* seq.NEXTVAL / CURRVAL */
    {s:'seq.NEXTVAL',t:"nextval('seq')", fwd: function(b) { b = b.replace(/\b(\w+)\.NEXTVAL\b/gi, "nextval('$1')"); b = b.replace(/\b(\w+)\.CURRVAL\b/gi, "currval('$1')"); return b; }, rev: function(b) { b = b.replace(/\bnextval\s*\(\s*'(\w+)'\s*\)/gi, '$1.NEXTVAL'); b = b.replace(/\bcurrval\s*\(\s*'(\w+)'\s*\)/gi, '$1.CURRVAL'); return b; }},
    {s:'seq.CURRVAL',t:"currval('seq')", fwd: null, rev: null},
    /* MONTHS_BETWEEN */
    {s:'MONTHS_BETWEEN(a, b)',t:'EXTRACT(YEAR/MONTH FROM AGE(a,b))', fwd: _handleOracleMonthsBetweenToPg, rev: _handlePgExtractAgeToOracle},
    /* ADD_MONTHS */
    {s:'ADD_MONTHS(dt, n)',t:"(dt + (n || ' month')::interval)", fwd: function(b) { return b.replace(/\bADD_MONTHS\s*\(\s*([^,]+),\s*([^)]+)\)/gi, "($1 + ($2 || ' month')::interval)"); }, rev: function(b) { return b.replace(/\(\s*([^+]+)\s*\+\s*\(\s*([^|]+)\s*\|\|\s*'\s*month\s*'\s*\)\s*::interval\s*\)/gi, function(m, dt, n) { return 'ADD_MONTHS(' + dt.trim() + ', ' + n.trim() + ')'; }); }},
    /* LAST_DAY */
    {s:'LAST_DAY(dt)',t:"(date_trunc('month', dt) + interval '1 month' - interval '1 day')", fwd: function(b) { return b.replace(/\bLAST_DAY\s*\(\s*([^)]+)\)/gi, "(date_trunc('month', $1) + interval '1 month' - interval '1 day')"); }, rev: function(b) { return b.replace(/\(\s*date_trunc\s*\(\s*'month'\s*,\s*([^)]+)\)\s*\+\s*interval\s*'1 month'\s*-\s*interval\s*'1 day'\s*\)/gi, 'LAST_DAY($1)'); }},
    /* TRUNC date */
    {s:"TRUNC(dt, 'MM')",t:"date_trunc('month', dt)", fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*([^,]+),\s*'(?:MM|MON|MONTH)'\s*\)/gi, "date_trunc('month', $1)"); }, rev: null},
    {s:"TRUNC(dt, 'YYYY')",t:"date_trunc('year', dt)", fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*([^,]+),\s*'(?:YY|YYYY|YEAR)'\s*\)/gi, "date_trunc('year', $1)"); }, rev: null},
    {s:"TRUNC(dt, 'DD')",t:"date_trunc('day', dt)", fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*([^,]+),\s*'(?:DD|DDD|DAY)'\s*\)/gi, "date_trunc('day', $1)"); }, rev: null},
    /* TRUNC(SYSDATE) */
    {s:'TRUNC(SYSDATE)',t:'CURRENT_DATE', fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*(?:SYSDATE|CURRENT_DATE|CURRENT_TIMESTAMP)\s*\)/gi, 'CURRENT_DATE'); }, rev: null},
    /* PG date_trunc -> Oracle TRUNC (reverse) */
    {s:'date_trunc (PG)',t:'TRUNC (Oracle)', fwd: null, rev: _handlePgDateTruncToOracle},
    /* LENGTHB -> OCTET_LENGTH */
    {s:'LENGTHB(x)',t:'OCTET_LENGTH(x)', fwd: _rf('LENGTHB','OCTET_LENGTH'), rev: _rf('OCTET_LENGTH','LENGTHB')},
    /* INSTR -> strpos */
    {s:'INSTR(a, b)',t:'strpos(a, b)', fwd: _rf('INSTR','strpos'), rev: _rf('strpos','INSTR')},
    /* DBMS_RANDOM.VALUE */
    {s:'DBMS_RANDOM.VALUE',t:'random()', fwd: _handleDbmsRandomValueToFn('postgresql'), rev: function(b) { return b.replace(/\brandom\s*\(\s*\)/gi, 'DBMS_RANDOM.VALUE'); }},
    {s:'DBMS_RANDOM.VALUE(lo, hi)',t:'(lo + random() * (hi - lo))', fwd: null, rev: null},
    /* LISTAGG -> string_agg */
    {s:'LISTAGG(col, sep) WITHIN GROUP(ORDER BY x)',t:'string_agg(col::TEXT, sep ORDER BY x)', fwd: function(b) { return b.replace(/\bLISTAGG\s*\(\s*([^,]+),\s*'([^']*)'\s*\)\s*WITHIN\s+GROUP\s*\(\s*ORDER\s+BY\s+([^)]+)\)/gi, function(m, col, sep, orderBy) { var c = col.trim(); if (!/::TEXT\s*$/i.test(c)) c += '::TEXT'; return "string_agg(" + c + ", '" + sep + "' ORDER BY " + orderBy.trim() + ")"; }); }, rev: function(b) { return b.replace(/\bstring_agg\s*\(\s*([^,]+?)(?:::TEXT)?\s*,\s*'([^']*)'\s+ORDER\s+BY\s+([^)]+)\)/gi, function(m, col, sep, orderBy) { return "LISTAGG(" + col.trim() + ", '" + sep + "') WITHIN GROUP (ORDER BY " + orderBy.trim() + ")"; }); }},
    /* Cursor attrs */
    {s:'cursor%NOTFOUND',t:'NOT FOUND', fwd: function(b) { return _handleOracleCursorAttrsToPg(b); }, rev: _handlePgNotFoundToOracle},
    {s:'cursor%FOUND',t:'FOUND', fwd: null, rev: null},
    {s:'cursor%ROWTYPE',t:'RECORD', fwd: null, rev: null},
    /* RECORD -> cursor%ROWTYPE (PG->Oracle): handled in app.js _convertSingleProcedure */
    {s:'cursor%ISOPEN',t:'(PG \u65e0\u76f4\u63a5\u7b49\u4ef7, \u7528 BEGIN CLOSE; EXCEPTION END)', fwd: null, rev: null},
    /* CURSOR declaration */
    {s:'CURSOR c IS SELECT ...',t:'c CURSOR FOR SELECT ...', fwd: function(b) { return b.replace(/\bCURSOR\s+(\w+)\s+IS\b/gi, '$1 CURSOR FOR'); }, rev: function(b) { return b.replace(/\b(\w+)\s+CURSOR\s+FOR\b/gi, 'CURSOR $1 IS'); }},
    /* FOR r IN (SELECT...) LOOP */
    {s:'FOR r IN (SELECT...) LOOP',t:'FOR r IN SELECT... LOOP', fwd: function(b) { return b.replace(/(^|\n)(\s*)FOR\s+(\w+)\s+IN\s*\(([\s\S]*?)\)\s*LOOP\b/gi, '$1$2FOR $3 IN $4 LOOP'); }, rev: function(b) { return b.replace(/(^|\n)(\s*)FOR\s+(\w+)\s+IN\s+(SELECT\b[\s\S]*?)\s*LOOP\b/gi, '$1$2FOR $3 IN ($4) LOOP'); }},
    /* REGEXP_LIKE */
    {s:'REGEXP_LIKE(expr, pat)',t:'expr ~ pat', fwd: function(b) { return b.replace(/\bREGEXP_LIKE\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*([^)]+)\)/gi, '$1 ~ $2'); }, rev: function(b) { return b.replace(/\b(\S+)\s+~\s+('(?:[^']*)'|\S+)/gi, function(m, expr, pat) { return 'REGEXP_LIKE(' + expr + ', ' + pat + ')'; }); }},
    /* SQLCODE -> SQLSTATE */
    {s:'SQLCODE',t:'SQLSTATE', fwd: function(b) { return b.replace(/\bSQLCODE\b/g, 'SQLSTATE'); }, rev: function(b) { return b.replace(/\bSQLSTATE\b(?!\s*')/g, 'SQLCODE'); }},
    /* DBMS_UTILITY.FORMAT_ERROR_BACKTRACE */
    {s:'DBMS_UTILITY.FORMAT_ERROR_BACKTRACE',t:'PG_EXCEPTION_CONTEXT', fwd: _rk('DBMS_UTILITY.FORMAT_ERROR_BACKTRACE','PG_EXCEPTION_CONTEXT'), rev: null},
    /* PG ::TYPE cast (reverse PG->Oracle) */
    {s:'expr::TEXT',t:'TO_CHAR(expr)', fwd: null, rev: function(b) { b = b.replace(/(\w+)::TEXT\b/gi, function(m, v) { return 'TO_CHAR(' + v + ')'; }); b = b.replace(/(\w+)::NUMERIC\b/gi, function(m, v) { return 'TO_NUMBER(' + v + ')'; }); b = b.replace(/(\w+)::DATE\b/gi, function(m, v) { return 'CAST(' + v + ' AS DATE)'; }); return b; }},
    /* INITCAP (PG supports natively) */
    {s:'INITCAP(x)',t:'INITCAP(x) (PG \u539f\u751f\u652f\u6301)', fwd: null, rev: null},
    /* VARCHAR2 in body */
    {s:'VARCHAR2',t:'VARCHAR', fwd: function(b) { return b.replace(/\bVARCHAR2\b/gi, 'VARCHAR'); }, rev: null},
    /* FETCH FIRST / LIMIT */
    {s:'FETCH FIRST n ROWS ONLY',t:'LIMIT n', fwd: null, rev: null},
    {s:'LIMIT m, n \u2192 OFFSET m ROWS FETCH NEXT n ROWS ONLY',t:'LIMIT n OFFSET m', fwd: null, rev: null},
    /* Display-only type rules */
    {s:'NUMBER(p,s)',t:'NUMERIC(p,s)', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bNUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMERIC($1,$2)'), _typeReplace(/\bNUMBER\s*\(\s*(\d+)\s*\)/gi, 'BIGINT'), _typeReplace(/\bNUMBER\b/gi, 'BIGINT')), typeRev: _typeChain(_typeReplace(/\bNUMERIC\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMBER($1,$2)'), _typeReplace(/\bNUMERIC\b/gi, 'NUMBER'), _typeReplace(/\bBIGINT\b/gi, 'NUMBER(19)'), _typeReplace(/\bINTEGER\b/gi, 'NUMBER(10)'), _typeReplace(/\bSMALLINT\b/gi, 'NUMBER(5)'), _typeReplace(/\bSERIAL\b/gi, 'NUMBER'), _typeReplace(/\bBIGSERIAL\b/gi, 'NUMBER'), _typeReplace(/\bDOUBLE PRECISION\b/gi, 'NUMBER'))},
    {s:'CLOB',t:'TEXT', fwd: null, rev: null, typeFwd: _typeReplace(/\bCLOB\b/gi, 'TEXT'), typeRev: _typeReplace(/\bTEXT\b/gi, 'CLOB')},
    {s:'BLOB',t:'BYTEA', fwd: null, rev: null, typeFwd: _typeReplace(/\bBLOB\b/gi, 'BYTEA'), typeRev: _typeReplace(/\bBYTEA\b/gi, 'BLOB')},
    {s:'PLS_INTEGER / BINARY_INTEGER',t:'INTEGER', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bPLS_INTEGER\b/gi, 'INTEGER'), _typeReplace(/\bBINARY_INTEGER\b/gi, 'INTEGER')), typeRev: null},
    {s:'BOOLEAN',t:'BOOLEAN', fwd: null, rev: null, typeFwd: _typeReplace(/\bBOOLEAN\b/gi, 'BOOLEAN'), typeRev: _typeReplace(/\bBOOLEAN\b/gi, 'NUMBER(1)')},
    /* Boolean literals TRUE/FALSE -> 1/0 in Oracle DML (UPDATE SET, INSERT VALUES, WHERE) */
    {s:'TRUE/FALSE (DML)',t:'1/0', fwd: null, rev: function(b) { b = b.replace(/(\bSET\s+\w+\s*=\s*)TRUE\b/gi, '$1' + '1'); b = b.replace(/(\bSET\s+\w+\s*=\s*)FALSE\b/gi, '$1' + '0'); b = b.replace(/(\bWHERE\s+[\s\S]*?=\s*)TRUE\b/gi, '$1' + '1'); b = b.replace(/(\bWHERE\s+[\s\S]*?=\s*)FALSE\b/gi, '$1' + '0'); return b; }},
    {s:'VARCHAR2 type',t:'VARCHAR type', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bVARCHAR2\s*\(([^)]+)\)/gi, 'VARCHAR($1)'), _typeReplace(/\bVARCHAR2\b/gi, 'VARCHAR'), _typeReplace(/\bNVARCHAR2\s*\(([^)]+)\)/gi, 'VARCHAR($1)')), typeRev: _typeChain(_typeReplace(/\bVARCHAR\b(?!\s*\()/gi, 'VARCHAR2(4000)'), _typeReplace(/\bVARCHAR\s*\(([^)]+)\)/gi, 'VARCHAR2($1)'))},
    {s:'DATE',t:'TIMESTAMP', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bDATE\b/gi, 'TIMESTAMP'), _typeReplace(/\bTIMESTAMP\b/gi, 'TIMESTAMP')), typeRev: null},
    {s:'REAL',t:'DOUBLE PRECISION', fwd: null, rev: null, typeFwd: _typeReplace(/\bREAL\b/gi, 'DOUBLE PRECISION'), typeRev: null},
    {s:'NVARCHAR2(n)',t:'VARCHAR(n)', fwd: null, rev: null},
    {s:'DATE \u683c\u5f0f\u7b26: YYYY MM DD HH24 MI SS',t:'\u683c\u5f0f\u7b26: YYYY MM DD HH24 MI SS \u4fdd\u6301', fwd: null, rev: null},
    /* GET STACKED DIAGNOSTICS (PG->Oracle) */
    {s:'GET STACKED DIAGNOSTICS (PG)',t:'(removed)', fwd: null, rev: function(b) { return b.replace(/\bGET\s+STACKED\s+DIAGNOSTICS\s+\w+\s*=\s*PG_EXCEPTION_CONTEXT\s*;/gi, ''); }}
  ],

  /* ---------- Oracle <-> MySQL ---------- */
  oracleMysql: [
    /* DECODE -> CASE */
    {s:'DECODE(expr, v1, r1, ..., def)',t:'CASE expr WHEN v1 THEN r1 ... ELSE def END', fwd: _handleDecodeToCase, rev: null},
    /* NVL -> IFNULL */
    {s:'NVL(a, b)',t:'IFNULL(a, b)', fwd: _rf('NVL','IFNULL'), rev: _rf('IFNULL','NVL')},
    /* NVL2 -> IF() */
    {s:'NVL2(a, b, c)',t:'IF(a IS NOT NULL, b, c)', fwd: _handleNvl2ToMysqlIf, rev: function(b) { return b.replace(/\bIF\s*\(\s*([^,]+?)\s+IS\s+NOT\s+NULL\s*,\s*([^,]+),\s*([^)]+)\)/gi, 'NVL2($1, $2, $3)'); }},
    /* TO_NUMBER -> CAST AS SIGNED */
    {s:'TO_NUMBER(x)',t:'CAST(x AS SIGNED)', fwd: function(b) { return b.replace(/\bTO_NUMBER\s*\(\s*([^)]+)\s*\)/gi, 'CAST($1 AS SIGNED)'); }, rev: function(b) { return b.replace(/\bCAST\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\s+AS\s+SIGNED(?:\s+INTEGER)?\s*\)/gi, 'TO_NUMBER($1)'); }},
    /* SYSTIMESTAMP / SYSDATE -> NOW() */
    {s:'SYSTIMESTAMP',t:'NOW()', fwd: _rk('SYSTIMESTAMP','NOW()'), rev: null},
    {s:'SYSDATE',t:'NOW()', fwd: _rk('SYSDATE','NOW()'), rev: function(b) { b = b.replace(/\bNOW\s*\(\s*\)/gi, 'SYSDATE'); b = b.replace(/\bCURRENT_DATE\b(?!\s*\()/gi, 'SYSDATE'); return b; }},
    /* TO_CHAR with format */
    {s:'TO_CHAR(expr, fmt)',t:'DATE_FORMAT(expr, fmt) \u683c\u5f0f\u7b26\u8f6c\u6362', fwd: function(b) { return b.replace(/\bTO_CHAR\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "DATE_FORMAT(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'oracle', 'mysql') + "')"; }); }, rev: function(b) { return b.replace(/\bDATE_FORMAT\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "TO_CHAR(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'mysql', 'oracle') + "')"; }); }},
    /* TO_CHAR single arg */
    {s:'TO_CHAR(expr) \u5355\u53c2\u6570',t:'CAST(expr AS CHAR)', fwd: function(b) { return b.replace(/\bTO_CHAR\s*\(\s*([^,)]+)\s*\)/gi, 'CAST($1 AS CHAR)'); }, rev: null},
    /* TO_DATE */
    {s:'TO_DATE(expr, fmt)',t:'STR_TO_DATE(expr, fmt) \u683c\u5f0f\u7b26\u8f6c\u6362', fwd: function(b) { return b.replace(/\bTO_DATE\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "STR_TO_DATE(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'oracle', 'mysql') + "')"; }); }, rev: function(b) { return b.replace(/\bSTR_TO_DATE\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "TO_DATE(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'mysql', 'oracle') + "')"; }); }},
    /* SUBSTR -> SUBSTRING */
    {s:'SUBSTR(a, b, c)',t:'SUBSTRING(a, b, c)', fwd: _rf('SUBSTR','SUBSTRING'), rev: _rf('SUBSTRING','SUBSTR')},
    /* RAISE_APPLICATION_ERROR (must run BEFORE || -> CONCAT) */
    {s:'RAISE_APPLICATION_ERROR(-code, msg)',t:"SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = msg", fwd: _handleRaiseAppErrorToMysql, rev: _handleMysqlSignalToOracle},
    /* RAISE; re-throw -> RESIGNAL */
    {s:'RAISE; \u91cd\u65b0\u629b\u51fa',t:'RESIGNAL;', fwd: _handleRaiseToResignal, rev: _handleResignalToRaise},
    /* Pre-convert RAISE NOTICE / DBMS_OUTPUT before || -> CONCAT */
    {s:'DBMS_OUTPUT/RAISE NOTICE pre-convert',t:'SELECT (pre-convert)', fwd: _handlePreConvertRaiseNoticeDbmsToMysql, rev: null},
    /* || -> CONCAT */
    {s:'|| \u5b57\u7b26\u4e32\u62fc\u63a5',t:'CONCAT(a, b, ...)', fwd: _handlePipeConcatToFunction, rev: function(b) { return _convertConcatToPipe(b); }},
    /* DBMS_OUTPUT.PUT_LINE -> SELECT */
    {s:'DBMS_OUTPUT.PUT_LINE(expr)',t:'SELECT expr;', fwd: function(b) { return b.replace(/\bDBMS_OUTPUT\.PUT_LINE\s*\(\s*([^;]+)\)\s*;/gi, 'SELECT $1;'); }, rev: function(b) { return b.replace(/\bSELECT\s+(.+?)\s*;\s*(?=\n|$)/gi, function(m, expr) { if (/\b(INTO|FROM|WHERE)\b/i.test(expr)) return m; var cleanExpr = expr.trim().replace(/\s+AS\s+\w+\s*$/i, ''); return 'DBMS_OUTPUT.PUT_LINE(' + cleanExpr + '); -- [\u6ce8\u610f: \u539f MySQL SELECT \u8f93\u51fa, \u82e5\u4e3a\u7ed3\u679c\u96c6\u8bf7\u6539\u7528 SYS_REFCURSOR]'; }); }},
    /* EXCEPTION -> MySQL HANDLER */
    {s:'EXCEPTION WHEN OTHERS THEN ...',t:'DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN...END', fwd: _handleExceptionToMysqlHandler, rev: _handleMysqlHandlerToOracle},
    {s:'EXCEPTION WHEN NO_DATA_FOUND',t:'DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN...END', fwd: null, rev: null},
    /* ROWNUM -> LIMIT */
    {s:'ROWNUM <= n',t:'LIMIT n', fwd: _handleRownumToLimit, rev: null},
    /* VARCHAR2 in body */
    {s:'VARCHAR2',t:'VARCHAR', fwd: function(b) { return b.replace(/\bVARCHAR2\b/gi, 'VARCHAR'); }, rev: null},
    /* LIMIT -> FETCH FIRST */
    {s:'LIMIT -> FETCH FIRST',t:'FETCH FIRST', fwd: null, rev: _handleLimitToFetchFirst},
    /* EXECUTE IMMEDIATE */
    {s:'EXECUTE IMMEDIATE expr USING ...',t:'PREPARE/EXECUTE/DEALLOCATE \u6a21\u5f0f', fwd: _handleExecImmediateOracleToMysql, rev: _handleMysqlPrepExecToOraclePg('oracle')},
    /* := -> SET */
    {s:'var := expr;',t:'SET var = expr;', fwd: _handleAssignToSet, rev: _handleSetToAssign},
    /* SQL%ROWCOUNT -> ROW_COUNT() */
    {s:'SQL%ROWCOUNT',t:'ROW_COUNT()', fwd: function(b) { return b.replace(/\bSQL%ROWCOUNT\b/gi, 'ROW_COUNT()'); }, rev: function(b) { return b.replace(/\bROW_COUNT\s*\(\s*\)/gi, 'SQL%ROWCOUNT'); }},
    /* ELSIF -> ELSEIF */
    {s:'ELSIF',t:'ELSEIF', fwd: function(b) { return b.replace(/\bELSIF\b/gi, 'ELSEIF'); }, rev: function(b) { return b.replace(/\bELSEIF\b/gi, 'ELSIF'); }},
    /* WHILE LOOP -> WHILE DO */
    {s:'WHILE ... LOOP / END LOOP',t:'WHILE ... DO / END WHILE', fwd: _handleWhileLoopToMysql, rev: _handleWhileDoToLoop},
    {s:'LOOP / END LOOP \u57fa\u672c\u5faa\u73af',t:'label: LOOP / END LOOP label', fwd: null, rev: function(b) {
      /* MySQL label: LOOP -> Oracle <<label>> LOOP */
      b = b.replace(/(^|\n)(\s*)(\w+)\s*:\s*LOOP\b/gi, '$1$2<<$3>>\n$2LOOP');
      /* END LOOP label; -> END LOOP label; (Oracle accepts this) */
      return b;
    }},
    /* EXIT WHEN -> IF LEAVE */
    {s:'EXIT WHEN condition;',t:'IF condition THEN LEAVE label; END IF;', fwd: function(b) { b = b.replace(/\bEXIT\s+WHEN\s+(.+?)\s*;/gi, 'IF $1 THEN\n    LEAVE;\n  END IF;'); b = b.replace(/\bLEAVE\s*;/gi, 'LEAVE _loop1;'); return b; }, rev: function(b) {
      /* LEAVE label; -> EXIT label; */
      b = b.replace(/\bLEAVE\s+(\w+)\s*;/gi, 'EXIT $1;');
      b = b.replace(/\bLEAVE\s*;/gi, 'EXIT;');
      return b;
    }},
    /* Cursor attrs */
    {s:'cursor%NOTFOUND',t:'_done (\u914d\u5408 HANDLER FOR NOT FOUND)', fwd: _handleOracleCursorNotfoundToMysql, rev: function(b) {
      /* IF v_done THEN EXIT label; END IF; -> EXIT WHEN cursor%NOTFOUND; */
      b = b.replace(/\bIF\s+(?:v_done|_done)\s*(?:=\s*1\s*)?\s*THEN\s*\n?\s*EXIT\s+(\w+)\s*;\s*\n?\s*END\s+IF\s*;/gi, 'EXIT WHEN NOT FOUND;');
      b = b.replace(/\bIF\s+(?:v_done|_done)\s*(?:=\s*1\s*)?\s*THEN\s*\n?\s*EXIT\s*;\s*\n?\s*END\s+IF\s*;/gi, 'EXIT WHEN NOT FOUND;');
      /* IF v_done THEN (standalone boolean test) -> IF v_done = 1 THEN */
      b = b.replace(/\bIF\s+(v_done|_done)\s+THEN\b/gi, 'IF $1 = 1 THEN');
      return b;
    }},
    {s:'cursor%FOUND',t:'NOT _done', fwd: null, rev: null},
    {s:'cursor%ROWCOUNT',t:'ROW_COUNT()', fwd: null, rev: null},
    {s:'cursor%ISOPEN',t:'-- (MySQL \u65e0 %ISOPEN)', fwd: function(b) { return b.replace(/\bIF\s+(\w+)%ISOPEN\s+THEN\s+CLOSE\s+\1\s*;\s*END\s+IF\s*;/gi, '-- CLOSE $1 (safe close, MySQL has no %ISOPEN check)'); }, rev: null},
    /* Cursor declaration */
    {s:'CURSOR c IS SELECT ...',t:'DECLARE c CURSOR FOR SELECT ...', fwd: function(b) { return b.replace(/\bCURSOR\s+(\w+)\s+IS\b/gi, 'DECLARE $1 CURSOR FOR'); }, rev: function(b) { return b.replace(/\bDECLARE\s+(\w+)\s+CURSOR\s+FOR\b/gi, 'CURSOR $1 IS'); }},
    /* FOR i IN 1..10 LOOP -> WHILE with auto-increment */
    {s:'FOR i IN 1..10 LOOP',t:'DECLARE i INT DEFAULT 1; WHILE i<=10 DO ... SET i=i+1; END WHILE', fwd: function(b) {
      // Replace numeric FOR loops with WHILE and inject increment before END LOOP/END WHILE
      var result = b;
      var forRe = /(^|\n)(\s*)FOR\s+(\w+)\s+IN\s+(\S+?)\s*\.\.\s*(.+?)\s+LOOP\b/gi;
      var match;
      var replacements = [];
      while ((match = forRe.exec(b)) !== null) {
        var pre = match[1], indent = match[2], varName = match[3], startVal = match[4], endVal = match[5];
        // Find the matching END LOOP by tracking nesting depth
        var searchStart = match.index + match[0].length;
        var depth = 1;
        var endPos = -1;
        var endMatch;
        var scanRe = /\b(LOOP|DO)\b|\bEND\s+(LOOP|WHILE)\b/gi;
        scanRe.lastIndex = searchStart;
        while ((endMatch = scanRe.exec(b)) !== null) {
          if (/\bEND\s+(LOOP|WHILE)\b/i.test(endMatch[0])) {
            depth--;
            if (depth === 0) { endPos = endMatch.index; break; }
          } else {
            depth++;
          }
        }
        if (endPos >= 0) {
          replacements.push({
            varName: varName,
            startVal: startVal,
            endVal: endVal,
            headerStart: match.index,
            headerEnd: match.index + match[0].length,
            endLoopStart: endPos,
            endLoopEnd: endPos + b.substring(endPos).match(/\bEND\s+(LOOP|WHILE)\b\s*;?/i)[0].length,
            indent: indent,
            pre: pre
          });
        }
      }
      // Apply replacements in reverse order to preserve positions
      for (var ri = replacements.length - 1; ri >= 0; ri--) {
        var r = replacements[ri];
        // Replace END LOOP with increment + END WHILE
        var endReplacement = r.indent + '    SET ' + r.varName + ' = ' + r.varName + ' + 1;\n' + r.indent + 'END WHILE;';
        result = result.substring(0, r.endLoopStart) + endReplacement + result.substring(r.endLoopEnd);
        // Replace FOR header with DECLARE + WHILE
        var headerReplacement = r.pre + r.indent + 'DECLARE ' + r.varName + ' INT DEFAULT ' + r.startVal + ';\n' + r.indent + 'WHILE ' + r.varName + ' <= ' + r.endVal + ' DO';
        result = result.substring(0, r.headerStart) + headerReplacement + result.substring(r.headerEnd);
      }
      return result;
    }, rev: null},
    /* FOR r IN (SELECT...) LOOP -> cursor loop */
    {s:'FOR r IN (SELECT...) LOOP',t:'DECLARE CURSOR + OPEN + FETCH \u5faa\u73af', fwd: _handleOracleQueryForToMysql, rev: null},
    /* seq.NEXTVAL / CURRVAL */
    {s:'seq.NEXTVAL',t:'/* MySQL \u65e0\u5e8f\u5217, \u7528 AUTO_INCREMENT */', fwd: function(b) { b = b.replace(/\b(\w+)\.NEXTVAL\b/gi, "NULL /* [\u6ce8\u610f: MySQL \u65e0\u5e8f\u5217 ($1.NEXTVAL), \u8bf7\u4f7f\u7528 AUTO_INCREMENT \u6216 UUID()] */"); b = b.replace(/\b(\w+)\.CURRVAL\b/gi, 'LAST_INSERT_ID()'); return b; }, rev: null},
    {s:'seq.CURRVAL',t:'LAST_INSERT_ID()', fwd: null, rev: null},
    /* MONTHS_BETWEEN */
    {s:'MONTHS_BETWEEN(a, b)',t:'TIMESTAMPDIFF(MONTH, b, a)', fwd: _handleOracleMonthsBetweenToMysql, rev: _handleMysqlTimestampdiffToOracle},
    /* ADD_MONTHS */
    {s:'ADD_MONTHS(dt, n)',t:'DATE_ADD(dt, INTERVAL n MONTH)', fwd: function(b) { return b.replace(/\bADD_MONTHS\s*\(\s*([^,]+),\s*([^)]+)\)/gi, 'DATE_ADD($1, INTERVAL $2 MONTH)'); }, rev: function(b) { return b.replace(/\bDATE_ADD\s*\(\s*([^,]+),\s*INTERVAL\s+(\S+)\s+MONTH\s*\)/gi, function(m, dt, n) { return 'ADD_MONTHS(' + dt.trim() + ', ' + n.trim() + ')'; }); }},
    /* TRUNC date -> MySQL */
    {s:"TRUNC(dt, 'MM')",t:"CAST(DATE_FORMAT(dt, '%Y-%m-01') AS DATE)", fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*([^,]+),\s*'(?:MM|MON|MONTH)'\s*\)/gi, "CAST(DATE_FORMAT($1, '%Y-%m-01') AS DATE)"); }, rev: null},
    {s:"TRUNC(dt, 'YYYY')",t:"CAST(DATE_FORMAT(dt, '%Y-01-01') AS DATE)", fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*([^,]+),\s*'(?:YY|YYYY|YEAR)'\s*\)/gi, "CAST(DATE_FORMAT($1, '%Y-01-01') AS DATE)"); }, rev: null},
    {s:"TRUNC(dt, 'DD')",t:'CAST(dt AS DATE)', fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*([^,]+),\s*'(?:DD|DDD|DAY)'\s*\)/gi, "CAST($1 AS DATE)"); }, rev: null},
    /* TRUNC(SYSDATE) -> CURDATE() */
    {s:'TRUNC(SYSDATE)',t:'CURDATE()', fwd: function(b) { return b.replace(/\bTRUNC\s*\(\s*(?:SYSDATE|NOW\s*\(\s*\)|CURRENT_DATE|CURDATE\s*\(\s*\))\s*\)/gi, 'CURDATE()'); }, rev: null},
    /* TRUNC(x, n) numeric -> TRUNCATE */
    {s:'TRUNC(x, n) \u6570\u503c\u622a\u65ad',t:'TRUNCATE(x, n)', fwd: _handleTruncNumToMysql, rev: function(b) { return b.replace(/\bTRUNCATE\s*\(\s*([^,]+),\s*(\d+)\s*\)/gi, 'TRUNC($1, $2)'); }},
    /* LENGTH -> CHAR_LENGTH */
    {s:'LENGTH(x) \u5b57\u7b26\u957f\u5ea6',t:'CHAR_LENGTH(x)', fwd: function(b) { b = b.replace(/\bLENGTHB\s*\(/gi, '__BYTE_LENGTH__('); b = b.replace(/\bLENGTH\s*\(/gi, 'CHAR_LENGTH('); b = b.replace(/__BYTE_LENGTH__\s*\(/g, 'LENGTH('); return b; }, rev: function(b) { return b.replace(/\bCHAR_LENGTH\s*\(/gi, 'LENGTH('); }},
    /* LENGTHB -> LENGTH (MySQL) */
    {s:'LENGTHB(x)',t:'LENGTH(x)', fwd: null, rev: null},
    /* DBMS_RANDOM.VALUE */
    {s:'DBMS_RANDOM.VALUE',t:'RAND()', fwd: _handleDbmsRandomValueToFn('mysql'), rev: function(b) { return b.replace(/\bRAND\s*\(\s*\)/gi, 'DBMS_RANDOM.VALUE'); }},
    {s:'DBMS_RANDOM.VALUE(lo, hi)',t:'(lo + RAND() * (hi - lo))', fwd: null, rev: null},
    /* LISTAGG -> GROUP_CONCAT */
    {s:'LISTAGG(col, sep) WITHIN GROUP(ORDER BY x)',t:"GROUP_CONCAT(col ORDER BY x SEPARATOR sep)", fwd: function(b) { return b.replace(/\bLISTAGG\s*\(\s*([^,]+),\s*'([^']*)'\s*\)\s*WITHIN\s+GROUP\s*\(\s*ORDER\s+BY\s+([^)]+)\)/gi, function(m, col, sep, orderBy) { return "GROUP_CONCAT(" + col.trim() + " ORDER BY " + orderBy.trim() + " SEPARATOR '" + sep + "')"; }); }, rev: function(b) { return b.replace(/\bGROUP_CONCAT\s*\(\s*([^)]*?)\s+ORDER\s+BY\s+([^)]*?)\s+SEPARATOR\s+'([^']*)'\s*\)/gi, function(m, col, orderBy, sep) { return "LISTAGG(" + col.trim() + ", '" + sep + "') WITHIN GROUP (ORDER BY " + orderBy.trim() + ")"; }); }},
    /* REGEXP_LIKE */
    {s:'REGEXP_LIKE(expr, pat)',t:'expr REGEXP pat', fwd: function(b) { return b.replace(/\bREGEXP_LIKE\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*([^)]+)\)/gi, '$1 REGEXP $2'); }, rev: function(b) { return b.replace(/\b(\S+)\s+REGEXP\s+('(?:[^']*)'|\S+)/gi, 'REGEXP_LIKE($1, $2)'); }},
    /* INITCAP */
    {s:'INITCAP(x)',t:'CONCAT(UPPER(LEFT(x,1)), LOWER(SUBSTRING(x,2)))', fwd: function(b) { return b.replace(/\bINITCAP\s*\(\s*([^)]+)\)/gi, function(m, arg) { var a = arg.trim(); return 'CONCAT(UPPER(LEFT(' + a + ', 1)), LOWER(SUBSTRING(' + a + ", 2))) /* INITCAP: \u4ec5\u9996\u5b57\u6bcd\u5927\u5199, \u591a\u5355\u8bcd\u8bf7\u81ea\u5b9a\u4e49\u51fd\u6570 */"; }); }, rev: null},
    /* SQLCODE / SQLERRM */
    {s:'SQLCODE',t:'@_err_code', fwd: function(b) { b = b.replace(/\bSQLERRM\b/g, '@_err_msg'); b = b.replace(/\bSQLCODE\b/g, '@_err_code'); return b; }, rev: function(b) { b = b.replace(/@_err_msg\b/g, 'SQLERRM'); b = b.replace(/@_err_code\b/g, 'SQLCODE'); return b; }},
    {s:'SQLERRM',t:'@_err_msg', fwd: null, rev: null},
    /* DBMS_UTILITY.FORMAT_ERROR_BACKTRACE */
    {s:'DBMS_UTILITY.FORMAT_ERROR_BACKTRACE',t:"'' (MySQL \u65e0\u7b49\u4ef7\u51fd\u6570)", fwd: function(b) { return b.replace(/\bDBMS_UTILITY\.FORMAT_ERROR_BACKTRACE\b/gi, "/* [\u6ce8\u610f: MySQL \u65e0\u7b49\u4ef7\u7684\u9519\u8bef\u5806\u6808\u51fd\u6570] */ ''"); }, rev: null},
    /* MERGE INTO */
    {s:'MERGE INTO ... WHEN MATCHED/NOT MATCHED',t:'INSERT...ON DUPLICATE KEY UPDATE', fwd: _handleMergeToMysql, rev: function(b) {
      /* INSERT INTO tbl (cols) VALUES (vals) ON DUPLICATE KEY UPDATE col=VALUES(col), ... -> MERGE INTO */
      return b.replace(/\bINSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*\n?\s*VALUES\s*\(([^)]+)\)\s*\n?\s*ON\s+DUPLICATE\s+KEY\s+UPDATE\s+([\s\S]*?);/gi,
        function(m, tbl, cols, vals, updateClause) {
          var colArr = cols.split(/\s*,\s*/);
          var valArr = vals.split(/\s*,\s*/);
          var pk = colArr[0].trim();
          var srcCols = colArr.map(function(c, i) { return valArr[i].trim() + ' AS ' + c.trim(); }).join(', ');
          var updateParts = updateClause.replace(/\bVALUES\s*\(\s*(\w+)\s*\)/gi, 'src.$1').split(/\s*,\s*/);
          var updateSet = updateParts.map(function(p) { return 'tgt.' + p.trim().replace(/^(\w+)\s*=/, '$1 ='); }).join(',\n    ');
          var insertCols = colArr.join(', ');
          var insertVals = colArr.map(function(c) { return 'src.' + c.trim(); }).join(', ');
          return 'MERGE INTO ' + tbl + ' tgt\nUSING (SELECT ' + srcCols + ' FROM DUAL) src\nON (tgt.' + pk + ' = src.' + pk + ')\nWHEN MATCHED THEN UPDATE SET\n    ' + updateSet + '\nWHEN NOT MATCHED THEN INSERT (' + insertCols + ')\n    VALUES (' + insertVals + ');';
        });
    }},
    /* CONCAT_WS (reverse) */
    {s:'CONCAT_WS(sep, a, b)',t:'(a || sep || b)', fwd: null, rev: _handleConcatWsMysqlToOracle},
    /* MySQL IF(cond,a,b) -> CASE WHEN (reverse) */
    {s:'CASE WHEN cond THEN a ELSE b END',t:'IF(cond, a, b)', fwd: null, rev: _handleMysqlIfToCase},
    /* SUBSTRING_INDEX (reverse) */
    {s:'SUBSTRING_INDEX(str, d, n)',t:'(Oracle \u65e0, \u9700 SUBSTR+INSTR \u6216\u6b63\u5219)', fwd: null, rev: _handleSubstringIndexMysqlToOraclePg('oracle')},
    /* DATE_SUB (reverse MySQL->Oracle) */
    {s:'DATE_SUB(dt, INTERVAL n unit) (MySQL)',t:'(dt - INTERVAL n unit) (Oracle)', fwd: null, rev: function(b) { return b.replace(/\bDATE_SUB\s*\(\s*([^,]+),\s*INTERVAL\s+(\S+)\s+(\w+)\s*\)/gi, function(m, dt, n, unit) { if (/month/i.test(unit)) return 'ADD_MONTHS(' + dt.trim() + ', -' + n.trim() + ')'; return '(' + dt.trim() + " - INTERVAL '" + n.trim() + "' " + unit.trim() + ')'; }); }},
    /* CURRENT_TIMESTAMP -> Oracle SYSTIMESTAMP (reverse) */
    {s:'CURRENT_TIMESTAMP (MySQL)',t:'SYSTIMESTAMP (Oracle)', fwd: null, rev: function(b) { return b.replace(/\bCURRENT_TIMESTAMP\b/gi, 'SYSTIMESTAMP'); }},
    /* INSTR (MySQL supports natively) */
    {s:'INSTR(a, b)',t:'INSTR(a, b) (MySQL \u539f\u751f\u652f\u6301)', fwd: null, rev: null},
    /* LAST_DAY (MySQL supports natively) */
    {s:'LAST_DAY(dt)',t:'LAST_DAY(dt) (MySQL \u539f\u751f\u652f\u6301)', fwd: null, rev: null},
    /* PG ::TYPE (reverse via MySQL CAST) */
    {s:'::INTEGER (PG reverse)',t:'CAST AS SIGNED (MySQL reverse)', fwd: null, rev: null},
    /* COMMIT/ROLLBACK -> START TRANSACTION + COMMIT/ROLLBACK */
    {s:'COMMIT; / ROLLBACK;',t:'START TRANSACTION; ... COMMIT; / ROLLBACK;', fwd: function(b) {
      /* Oracle uses implicit transactions; MySQL stored procedures need explicit START TRANSACTION.
         Insert START TRANSACTION before the first COMMIT or ROLLBACK if not already present. */
      if (/\b(?:COMMIT|ROLLBACK)\s*;/i.test(b) && !/\bSTART\s+TRANSACTION\b/i.test(b)) {
        b = b.replace(/^(\s*)((?:INSERT|UPDATE|DELETE|MERGE)\b)/im, '$1START TRANSACTION;\n$1$2');
        /* If no DML found before COMMIT, prepend at start */
        if (!/\bSTART\s+TRANSACTION\b/i.test(b)) {
          b = '  START TRANSACTION;\n' + b;
        }
      }
      return b;
    }, rev: function(b) {
      /* MySQL -> Oracle: remove START TRANSACTION (Oracle auto-starts) */
      return b.replace(/^\s*START\s+TRANSACTION\s*;\s*\n?/gim, '');
    }},
    /* Type-only rules */
    {s:'NUMBER(p,s)',t:'DECIMAL(p,s)', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bNUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'DECIMAL($1,$2)'), _typeReplace(/\bNUMBER\s*\(\s*(\d+)\s*\)/gi, 'BIGINT'), _typeReplace(/\bNUMBER\b/gi, 'BIGINT')), typeRev: _typeChain(_typeReplace(/\bDECIMAL\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMBER($1,$2)'), _typeReplace(/\bBIGINT\b/gi, 'NUMBER(19)'), _typeReplace(/\bTINYINT\s*\(\s*1\s*\)/gi, 'NUMBER(1)'), _typeReplace(/\bTINYINT\b/gi, 'NUMBER(3)'), _typeReplace(/\bSMALLINT\b/gi, 'NUMBER(5)'), _typeReplace(/\bINT\b/gi, 'NUMBER(10)'), _typeReplace(/\bDOUBLE\b/gi, 'NUMBER'), _typeReplace(/\bFLOAT\b/gi, 'NUMBER'))},
    {s:'CLOB',t:'LONGTEXT', fwd: null, rev: null, typeFwd: _typeReplace(/\bCLOB\b/gi, 'LONGTEXT'), typeRev: _typeChain(_typeReplace(/\bLONGTEXT\b/gi, 'CLOB'), _typeReplace(/\bMEDIUMTEXT\b/gi, 'CLOB'), _typeReplace(/\bTEXT\b/gi, 'CLOB'))},
    {s:'BLOB',t:'LONGBLOB', fwd: null, rev: null, typeFwd: _typeReplace(/\bBLOB\b/gi, 'LONGBLOB'), typeRev: _typeReplace(/\bLONGBLOB\b/gi, 'BLOB')},
    {s:'DATE (Oracle)',t:'DATETIME', fwd: null, rev: null, typeFwd: _typeReplace(/\bDATE\b/gi, 'DATETIME'), typeRev: _typeChain(_typeReplace(/\bDATETIME\s*\(\s*\d+\s*\)/gi, 'TIMESTAMP'), _typeReplace(/\bDATETIME\b/gi, 'DATE'))},
    {s:'TIMESTAMP',t:'DATETIME(6)', fwd: null, rev: null, typeFwd: _typeReplace(/\bTIMESTAMP\b/gi, 'DATETIME(6)'), typeRev: null},
    {s:'PLS_INTEGER / BINARY_INTEGER',t:'INT', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bPLS_INTEGER\b/gi, 'INT'), _typeReplace(/\bBINARY_INTEGER\b/gi, 'INT')), typeRev: null},
    {s:'BOOLEAN',t:'TINYINT(1)', fwd: null, rev: null, typeFwd: _typeReplace(/\bBOOLEAN\b/gi, 'TINYINT(1)'), typeRev: _typeReplace(/\bBOOLEAN\b/gi, 'NUMBER(1)')},
    {s:'VARCHAR2 type',t:'VARCHAR type', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bVARCHAR2\s*\(([^)]+)\)/gi, 'VARCHAR($1)'), _typeReplace(/\bVARCHAR2\b/gi, 'VARCHAR(4000)'), _typeReplace(/\bNVARCHAR2\s*\(([^)]+)\)/gi, 'VARCHAR($1)')), typeRev: _typeChain(_typeReplace(/\bVARCHAR\b(?!\s*\()/gi, 'VARCHAR2(4000)'), _typeReplace(/\bVARCHAR\s*\(([^)]+)\)/gi, 'VARCHAR2($1)'))},
    {s:'%ROWTYPE',t:'VARCHAR(4000) (MySQL \u65e0\u7b49\u4ef7)', fwd: null, rev: null},
    {s:'REAL',t:'DOUBLE', fwd: null, rev: null, typeFwd: _typeReplace(/\bREAL\b/gi, 'DOUBLE'), typeRev: null},
    {s:'INTEGER',t:'INT', fwd: null, rev: null, typeFwd: _typeReplace(/\bINTEGER\b/gi, 'INT'), typeRev: null},
    {s:'NVARCHAR2(n)',t:'VARCHAR(n)', fwd: null, rev: null},
    {s:'\u683c\u5f0f\u7b26: YYYY MM DD HH24 MI SS',t:'\u683c\u5f0f\u7b26: %Y %m %d %H %i %s', fwd: null, rev: null}
  ],

  /* ---------- MySQL <-> PostgreSQL ---------- */
  mysqlPg: [
    /* IFNULL -> COALESCE */
    {s:'IFNULL(a, b)',t:'COALESCE(a, b)', fwd: _rf('IFNULL','COALESCE'), rev: _handleCoalescePgToMysql},
    /* CAST AS SIGNED -> CAST AS INTEGER */
    {s:'CAST(x AS SIGNED)',t:'CAST(x AS INTEGER)', fwd: function(b) { return b.replace(/\bCAST\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+)\s+AS\s+SIGNED(?:\s+INTEGER)?\s*\)/gi, 'CAST($1 AS INTEGER)'); }, rev: null},
    {s:'CAST(x AS UNSIGNED)',t:'CAST(x AS INTEGER)', fwd: null, rev: null},
    /* NOW -> CURRENT_DATE */
    {s:'NOW()',t:'CURRENT_DATE', fwd: function(b) { return b.replace(/\bNOW\s*\(\s*\)/gi, 'CURRENT_DATE'); }, rev: function(b) { b = b.replace(/\bCLOCK_TIMESTAMP\s*\(\s*\)/gi, 'NOW()'); b = b.replace(/\bCURRENT_DATE\b/gi, 'NOW()'); return b; }},
    {s:'CURRENT_TIMESTAMP',t:'CURRENT_TIMESTAMP \u4fdd\u6301', fwd: null, rev: null},
    /* DATE_FORMAT -> to_char */
    {s:'DATE_FORMAT(expr, fmt)',t:'to_char(expr, fmt) \u683c\u5f0f\u7b26\u8f6c\u6362', fwd: function(b) { return b.replace(/\bDATE_FORMAT\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "to_char(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'mysql', 'postgresql') + "')"; }); }, rev: function(b) { return b.replace(/\bTO_CHAR\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "DATE_FORMAT(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'postgresql', 'mysql') + "')"; }); }},
    /* STR_TO_DATE -> to_date */
    {s:'STR_TO_DATE(expr, fmt)',t:'to_date(expr, fmt) \u683c\u5f0f\u7b26\u8f6c\u6362', fwd: function(b) { return b.replace(/\bSTR_TO_DATE\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "to_date(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'mysql', 'postgresql') + "')"; }); }, rev: function(b) { return b.replace(/\bTO_DATE\s*\(\s*((?:[^,()]+|\((?:[^()]*|\([^()]*\))*\))+),\s*'([^']+)'\s*\)/gi, function(m, expr, fmt) { return "STR_TO_DATE(" + expr.trim() + ", '" + _convertDateFormat(fmt, 'postgresql', 'mysql') + "')"; }); }},
    /* SIGNAL -> RAISE EXCEPTION */
    {s:"SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT",t:"RAISE EXCEPTION msg USING ERRCODE = 'P0001'", fwd: _handleMysqlSignalToPg, rev: _handlePgRaiseExToMysql},
    /* RESIGNAL -> RAISE */
    {s:'RESIGNAL;',t:'RAISE;', fwd: _handleResignalToRaise, rev: _handleRaiseToResignal},
    /* Pre-convert RAISE NOTICE / DBMS_OUTPUT before || -> CONCAT (PG->MySQL) */
    {s:'RAISE NOTICE pre-convert (PG->MySQL)',t:'SELECT (pre-convert)', fwd: null, rev: _handlePreConvertRaiseNoticeDbmsToMysql},
    /* Pre-convert PG interval (dt + (n || ' unit')::interval) -> DATE_ADD BEFORE ||->CONCAT */
    {s:'PG interval pre-convert (PG->MySQL)',t:'DATE_ADD pre-convert', fwd: null, rev: function(b) {
      return b.replace(/\(\s*(\w+)\s*\+\s*\(\s*([^|]+?)\s*\|\|\s*'\s*(\w+)\s*'\s*\)\s*::interval\s*\)/gi, function(m, dt, n, unit) {
        return 'DATE_ADD(' + dt.trim() + ', INTERVAL ' + n.trim() + ' ' + unit.toUpperCase() + ')';
      });
    }},
    /* Pre-convert PG EXECUTE 'sql' || var -> MySQL PREPARE/EXECUTE BEFORE ||->CONCAT */
    {s:'PG EXECUTE pre-convert (PG->MySQL)',t:'PREPARE/EXECUTE pre-convert', fwd: null, rev: _handlePgExecuteToMysql},
    /* CONCAT -> || */
    {s:'CONCAT(a, b, ...)',t:'(a || b || ...)', fwd: function(b) { return _convertConcatToPipe(b); }, rev: _handlePipeConcatToFunction},
    /* DECLARE HANDLER -> EXCEPTION */
    {s:'DECLARE HANDLER FOR SQLEXCEPTION',t:'EXCEPTION WHEN OTHERS THEN', fwd: _handleMysqlHandlerToPg, rev: _handleExceptionToMysqlHandler},
    {s:'DECLARE HANDLER FOR NOT FOUND',t:'EXCEPTION WHEN NO_DATA_FOUND THEN', fwd: null, rev: null},
    /* DBMS_OUTPUT/SELECT -> RAISE NOTICE */
    {s:'SELECT expr (\u8c03\u8bd5\u8f93\u51fa)',t:"RAISE NOTICE '%', expr", fwd: function(b) { return b.replace(/\bSELECT\s+(.+?)\s*;\s*(?=\n|$)/gi, function(m, expr) { if (/\b(INTO|FROM|WHERE)\b/i.test(expr)) return m; var cleanExpr = expr.trim().replace(/\s+AS\s+\w+\s*$/i, ''); return "RAISE NOTICE '%', " + cleanExpr + ';'; }); }, rev: function(b) { b = b.replace(/\bRAISE\s+NOTICE\s+'[^']*',\s*([^;]+);/gi, 'SELECT $1;'); return b; }},
    /* ELSEIF -> ELSIF */
    {s:'ELSEIF',t:'ELSIF', fwd: function(b) { return b.replace(/\bELSEIF\b/gi, 'ELSIF'); }, rev: function(b) { return b.replace(/\bELSIF\b/gi, 'ELSEIF'); }},
    /* WHILE DO -> WHILE LOOP */
    {s:'WHILE ... DO / END WHILE',t:'WHILE ... LOOP / END LOOP', fwd: _handleWhileDoToLoop, rev: _handleWhileLoopToMysql},
    /* SET -> := */
    {s:'SET var = expr;',t:'var := expr;', fwd: _handleSetToAssign, rev: _handleAssignToSet},
    /* ROW_COUNT() -> GET DIAGNOSTICS */
    {s:'ROW_COUNT()',t:'GET DIAGNOSTICS var = ROW_COUNT', fwd: function(b) { return b.replace(/(\w+)\s*:=\s*ROW_COUNT\s*\(\s*\)\s*;/gi, function(m, v) { return 'GET DIAGNOSTICS ' + v + ' = ROW_COUNT;'; }); }, rev: function(b) { return b.replace(/\bGET\s+DIAGNOSTICS\s+(\w+)\s*=\s*ROW_COUNT\s*;/gi, 'SET $1 = ROW_COUNT();'); }},
    /* PREPARE/EXECUTE -> PG EXECUTE */
    {s:'PREPARE/EXECUTE/DEALLOCATE',t:'EXECUTE expr;', fwd: _handleMysqlPrepExecToOraclePg('postgresql'), rev: _handlePgExecuteToMysql},
    /* TIMESTAMPDIFF -> AGE/EXTRACT */
    {s:'TIMESTAMPDIFF(MONTH, a, b)',t:'EXTRACT(YEAR/MONTH FROM AGE(b, a))', fwd: _handleMysqlTimestampdiffToPg, rev: null},
    /* DATE_ADD -> interval */
    {s:'DATE_ADD(dt, INTERVAL n MONTH)',t:"(dt + (n || ' month')::interval)", fwd: function(b) { return b.replace(/\bDATE_ADD\s*\(\s*([^,]+),\s*INTERVAL\s+(\S+)\s+MONTH\s*\)/gi, function(m, dt, n) { return '(' + dt.trim() + ' + (' + n.trim() + " || ' month')::interval)"; }); }, rev: function(b) { return b.replace(/\(\s*([^+]+)\s*\+\s*\(\s*([^|]+)\s*\|\|\s*'\s*month\s*'\s*\)\s*::interval\s*\)/gi, function(m, dt, n) { return 'DATE_ADD(' + dt.trim() + ', INTERVAL ' + n.trim() + ' MONTH)'; }); }},
    /* LAST_DAY */
    {s:'LAST_DAY(dt)',t:"(date_trunc('month', dt) + interval '1 month' - interval '1 day')", fwd: function(b) { return b.replace(/\bLAST_DAY\s*\(\s*([^)]+)\)/gi, "(date_trunc('month', $1) + interval '1 month' - interval '1 day')"); }, rev: function(b) { return b.replace(/\(\s*date_trunc\s*\(\s*'month'\s*,\s*([^)]+)\)\s*\+\s*interval\s*'1 month'\s*-\s*interval\s*'1 day'\s*\)/gi, 'LAST_DAY($1)'); }},
    /* TRUNCATE -> TRUNC */
    {s:'TRUNCATE(x, n)',t:'TRUNC(x, n)', fwd: function(b) { return b.replace(/\bTRUNCATE\s*\(\s*([^,]+),\s*(\d+)\s*\)/gi, 'TRUNC($1, $2)'); }, rev: _handleTruncNumToMysql},
    /* CHAR_LENGTH -> LENGTH */
    {s:'CHAR_LENGTH(x)',t:'LENGTH(x)', fwd: function(b) { return b.replace(/\bCHAR_LENGTH\s*\(/gi, 'LENGTH('); }, rev: function(b) { return b.replace(/\bLENGTH\s*\(/gi, 'CHAR_LENGTH('); }},
    /* RAND -> random */
    {s:'RAND()',t:'random()', fwd: function(b) { return b.replace(/\bRAND\s*\(\s*\)/gi, 'random()'); }, rev: function(b) { return b.replace(/\brandom\s*\(\s*\)/gi, 'RAND()'); }},
    /* GROUP_CONCAT -> string_agg */
    {s:'GROUP_CONCAT(col ORDER BY x SEPARATOR sep)',t:'string_agg(col::TEXT, sep ORDER BY x)', fwd: function(b) { return b.replace(/\bGROUP_CONCAT\s*\(\s*([^)]*?)\s+ORDER\s+BY\s+([^)]*?)\s+SEPARATOR\s+'([^']*)'\s*\)/gi, function(m, col, orderBy, sep) { var c = col.trim(); if (!/::TEXT$/i.test(c)) c = c + '::TEXT'; return "string_agg(" + c + ", '" + sep + "' ORDER BY " + orderBy.trim() + ")"; }); }, rev: function(b) { return b.replace(/\bstring_agg\s*\(\s*([^,]+),\s*'([^']*)'\s+ORDER\s+BY\s+([^)]+)\)/gi, function(m, col, sep, orderBy) { var c = col.trim().replace(/::TEXT$/i, ''); return "GROUP_CONCAT(" + c + " ORDER BY " + orderBy.trim() + " SEPARATOR '" + sep + "')"; }); }},
    /* Cursor declaration */
    {s:'DECLARE c CURSOR FOR SELECT ...',t:'c CURSOR FOR SELECT ...', fwd: function(b) { return b.replace(/\bDECLARE\s+(\w+)\s+CURSOR\s+FOR\b/gi, '$1 CURSOR FOR'); }, rev: function(b) { return b.replace(/\b(\w+)\s+CURSOR\s+FOR\b/gi, 'DECLARE $1 CURSOR FOR'); }},
    /* REGEXP */
    {s:'expr REGEXP pat',t:'expr ~ pat', fwd: function(b) { return b.replace(/\b(\S+)\s+REGEXP\s+('(?:[^']*)'|\S+)/gi, '$1 ~ $2'); }, rev: function(b) { return b.replace(/\b(\S+)\s+~\s+('(?:[^']*)'|\S+)/gi, function(m, expr, pat) { return expr + ' REGEXP ' + pat; }); }},
    /* LIMIT OFFSET (keep) */
    {s:'LIMIT n OFFSET m',t:'LIMIT n OFFSET m \u4fdd\u6301', fwd: null, rev: null},
    /* ON DUPLICATE KEY UPDATE -> ON CONFLICT */
    {s:'ON DUPLICATE KEY UPDATE col=VALUES(col)',t:'ON CONFLICT (pk) DO UPDATE SET col=EXCLUDED.col', fwd: function(b) { return b.replace(/(INSERT\s+INTO\s+(\w+)\s*\(\s*([\w\s,]+)\)\s*\n?\s*VALUES\s*\([^)]*\)\s*\n?\s*)ON\s+DUPLICATE\s+KEY\s+UPDATE\b([\s\S]*?)(?=;)/gim, function(m, insertPart, tableName, colList, updateClause) {
      /* Determine conflict columns: use columns in UPDATE SET that are NOT being updated (i.e. likely PK/unique).
         Heuristic: columns in the INSERT column list that do NOT appear on the left side of assignments in the UPDATE clause are the key columns. */
      var insertCols = colList.split(',').map(function(c) { return c.trim().toUpperCase(); });
      var updateAssignments = updateClause.split(',');
      var updatedCols = {};
      for (var ui = 0; ui < updateAssignments.length; ui++) {
        var parts = updateAssignments[ui].trim().split(/\s*=\s*/);
        if (parts.length >= 2) updatedCols[parts[0].trim().toUpperCase()] = true;
      }
      var conflictCols = [];
      for (var ic = 0; ic < insertCols.length; ic++) {
        if (!updatedCols[insertCols[ic]]) conflictCols.push(insertCols[ic].toLowerCase());
      }
      if (conflictCols.length === 0) conflictCols.push(insertCols[0].toLowerCase());
      /* Convert VALUES(col) and _new.col to EXCLUDED.col */
      var converted = updateClause.replace(/\bVALUES\s*\(\s*(\w+)\s*\)/gi, 'EXCLUDED.$1');
      converted = converted.replace(/\b_new\.(\w+)/gi, 'EXCLUDED.$1');
      return insertPart + 'ON CONFLICT (' + conflictCols.join(', ') + ') DO UPDATE SET' + converted;
    }); }, rev: null},
    /* INSERT IGNORE -> ON CONFLICT DO NOTHING */
    {s:'INSERT IGNORE INTO',t:'INSERT INTO ... ON CONFLICT DO NOTHING', fwd: function(b) { return b.replace(/\bINSERT\s+IGNORE\s+INTO\b/gi, 'INSERT INTO'); }, rev: null},
    /* label: LOOP -> <<label>> LOOP */
    {s:'label: LOOP',t:'<<label>> LOOP', fwd: function(b) { b = b.replace(/^\s*(\w+)\s*:\s*LOOP\b/gim, '    <<$1>> LOOP'); return b; }, rev: null},
    /* LEAVE -> EXIT */
    {s:'LEAVE label;',t:'EXIT label;', fwd: function(b) { b = b.replace(/\bLEAVE\s+(\w+)\s*;/gi, 'EXIT $1;'); b = b.replace(/\bLEAVE\s*;/gi, 'EXIT;'); return b; }, rev: null},
    {s:'LEAVE;',t:'EXIT;', fwd: null, rev: null},
    /* IF _done THEN LEAVE -> EXIT WHEN NOT FOUND */
    {s:'IF _done THEN LEAVE ...',t:'EXIT WHEN NOT FOUND;', fwd: function(b) { b = b.replace(/\bIF\s+(?:v_done|_done)\s+(?:=\s*1\s+)?THEN\s+EXIT\s+\w+\s*;\s*END\s+IF\s*;/gi, 'EXIT WHEN NOT FOUND;'); b = b.replace(/\bIF\s+(?:v_done|_done)\s+THEN\s+EXIT\s*;\s*END\s+IF\s*;/gi, 'EXIT WHEN NOT FOUND;'); return b; }, rev: null},
    /* NOT FOUND handling (PG -> MySQL) */
    {s:'NOT FOUND (PG->MySQL)',t:'_done handler', fwd: null, rev: function(b) { b = b.replace(/<<(\w+)>>\s*LOOP\b/gi, '$1: LOOP'); if (/\bNOT\s+FOUND\b/i.test(b) && !/\bDECLARE\s+_done\b/i.test(b)) { b = 'DECLARE _done INT DEFAULT 0;\nDECLARE CONTINUE HANDLER FOR NOT FOUND SET _done = 1;\n' + b; } b = b.replace(/\bIF\s+NOT\s+FOUND\s+THEN\b/gi, 'IF _done THEN'); b = b.replace(/\bEXIT\s+WHEN\s+NOT\s+FOUND\s*;/gi, 'IF _done THEN\n    LEAVE;\n  END IF;'); return b; }},
    /* SQLERRM / SQLSTATE */
    {s:'@_err_msg',t:'SQLERRM', fwd: function(b) { b = b.replace(/\b@_err_msg\b/g, 'SQLERRM'); b = b.replace(/\b@_err_code\b/g, 'SQLSTATE'); return b; }, rev: function(b) { b = b.replace(/\bSQLERRM\b/g, '@_err_msg'); b = b.replace(/\bSQLSTATE\b(?!\s*')/g, '@_err_state'); return b; }},
    {s:'@_err_code',t:'SQLSTATE', fwd: null, rev: null},
    /* CAST AS SIGNED/UNSIGNED -> AS INTEGER */
    {s:'AS SIGNED/UNSIGNED',t:'AS INTEGER', fwd: function(b) { b = b.replace(/\bAS\s+SIGNED\s+INTEGER\b/gi, 'AS INTEGER'); b = b.replace(/\bAS\s+SIGNED\b/gi, 'AS INTEGER'); b = b.replace(/\bAS\s+UNSIGNED\s+INTEGER\b/gi, 'AS INTEGER'); b = b.replace(/\bAS\s+UNSIGNED\b/gi, 'AS INTEGER'); return b; }, rev: null},
    /* START TRANSACTION */
    {s:'START TRANSACTION',t:'(PG \u8fc7\u7a0b\u5185\u4e8b\u52a1\u7ba1\u7406\u4e0d\u540c, \u81ea\u52a8\u79fb\u9664)', fwd: function(b) { return b.replace(/^\s*START\s+TRANSACTION\s*;/gim, ''); }, rev: null},
    /* CURRENT_TIMESTAMP(n) -> CLOCK_TIMESTAMP() */
    {s:'CURRENT_TIMESTAMP(n)',t:'CLOCK_TIMESTAMP()', fwd: function(b) { return b.replace(/\bCURRENT_TIMESTAMP\s*\(\s*\d*\s*\)/gi, 'CLOCK_TIMESTAMP()'); }, rev: null},
    /* MySQL IF(cond,a,b) -> CASE WHEN */
    {s:'IF(cond, a, b)',t:'CASE WHEN cond THEN a ELSE b END', fwd: _handleMysqlIfToCase, rev: null},
    /* PG query FOR loop -> MySQL cursor */
    {s:'FOR r IN SELECT... LOOP (PG)',t:'DECLARE CURSOR + OPEN + FETCH', fwd: null, rev: null},
    /* PG date_trunc -> MySQL */
    {s:'date_trunc (PG->MySQL)',t:'DATE_FORMAT/CAST', fwd: null, rev: _handlePgDateTruncToMysql},
    /* GET STACKED DIAGNOSTICS (PG->MySQL) */
    {s:'GET STACKED DIAGNOSTICS (PG)',t:'(removed)', fwd: null, rev: function(b) { return b.replace(/\bGET\s+STACKED\s+DIAGNOSTICS\s+\w+\s*=\s*PG_EXCEPTION_CONTEXT\s*;/gi, ''); }},
    /* PG ::TYPE cast -> MySQL CAST */
    {s:'expr::TEXT (PG \u7c7b\u578b\u8f6c\u6362)',t:'CAST(expr AS CHAR)', fwd: null, rev: null},
    {s:'expr::INTEGER',t:'CAST(expr AS SIGNED)', fwd: null, rev: null},
    {s:'expr::NUMERIC',t:'CAST(expr AS DECIMAL)', fwd: null, rev: null},
    {s:'expr::DATE',t:'CAST(expr AS DATE)', fwd: null, rev: null},
    /* PG ::TYPE handlers (fwd = mysql->pg does nothing here, rev = pg->mysql) */
    {s:'PG ::TYPE casts (reverse)',t:'MySQL CASTs', fwd: null, rev: function(b) { b = b.replace(/(\w+)::TEXT\b/gi, function(m, v) { return 'CAST(' + v + ' AS CHAR)'; }); b = b.replace(/(\w+)::INTEGER\b/gi, function(m, v) { return 'CAST(' + v + ' AS SIGNED)'; }); b = b.replace(/(\w+)::NUMERIC\b/gi, function(m, v) { return 'CAST(' + v + ' AS DECIMAL)'; }); b = b.replace(/(\w+)::DATE\b/gi, function(m, v) { return 'CAST(' + v + ' AS DATE)'; }); return b; }},
    /* SUBSTRING_INDEX */
    {s:'SUBSTRING_INDEX(str, d, n)',t:'(PG \u65e0, \u9700 SUBSTR+INSTR \u6216\u6b63\u5219)', fwd: _handleSubstringIndexMysqlToOraclePg('postgresql'), rev: null},
    /* CONCAT_WS */
    {s:'CONCAT_WS(sep, a, b)',t:'concat_ws(sep, a, b) (PG \u539f\u751f\u652f\u6301)', fwd: _handleConcatWsMysqlToPg, rev: null},
    /* DATE_SUB (MySQL -> PG) */
    {s:'DATE_SUB(dt, INTERVAL n unit)',t:"(dt - INTERVAL 'n unit')", fwd: function(b) { return b.replace(/\bDATE_SUB\s*\(\s*([^,]+),\s*INTERVAL\s+(\S+)\s+(\w+)\s*\)/gi, function(m, dt, n, unit) { return '(' + dt.trim() + " - INTERVAL '" + n.trim() + ' ' + unit.trim().toLowerCase() + "')"; }); }, rev: null},
    /* SUBSTR -> SUBSTRING FROM FOR */
    {s:'SUBSTRING(a, b, c)',t:'SUBSTRING(a FROM b FOR c)', fwd: null, rev: function(b) { return b.replace(/\bSUBSTRING\s*\(\s*((?:[^,()]+|\([^)]*\))+?)\s+FROM\s+(\S+)\s+FOR\s+(\S+)\s*\)/gi, 'SUBSTR($1, $2, $3)'); }},
    /* INITCAP */
    {s:'INITCAP(x) (PG \u539f\u751f)',t:'CONCAT(UPPER(LEFT(x,1)), LOWER(SUBSTRING(x,2)))', fwd: null, rev: function(b) { return b.replace(/\bINITCAP\s*\(\s*([^)]+)\)/gi, function(m, arg) { var a = arg.trim(); return 'CONCAT(UPPER(LEFT(' + a + ', 1)), LOWER(SUBSTRING(' + a + ", 2))) /* INITCAP: \u4ec5\u9996\u5b57\u6bcd\u5927\u5199, \u591a\u5355\u8bcd\u8bf7\u81ea\u5b9a\u4e49\u51fd\u6570 */"; }); }},
    /* strpos -> INSTR */
    {s:'strpos(a, b) (PG)',t:'INSTR(a, b) (MySQL)', fwd: null, rev: null},
    /* FOR i IN .. -> WHILE */
    {s:'FOR i IN 1..10 DO (\u6a21\u62df)',t:'FOR i IN 1..10 LOOP', fwd: null, rev: null},
    /* Type-only rules */
    {s:'DECIMAL(p,s)',t:'NUMERIC(p,s)', fwd: null, rev: null, typeFwd: _typeReplace(/\bDECIMAL\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMERIC($1,$2)'), typeRev: _typeReplace(/\bNUMERIC\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'DECIMAL($1,$2)')},
    {s:'TINYINT(1)',t:'BOOLEAN', fwd: null, rev: null, typeFwd: _typeReplace(/\bTINYINT\s*\(\s*1\s*\)/gi, 'BOOLEAN'), typeRev: _typeReplace(/\bBOOLEAN\b/gi, 'TINYINT(1)')},
    {s:'TINYINT',t:'SMALLINT', fwd: null, rev: null, typeFwd: _typeReplace(/\bTINYINT\b/gi, 'SMALLINT'), typeRev: null},
    {s:'INT',t:'INTEGER', fwd: null, rev: null, typeFwd: _typeReplace(/\bINT\b/gi, 'INTEGER'), typeRev: _typeReplace(/\bINTEGER\b/gi, 'INT')},
    {s:'DOUBLE',t:'DOUBLE PRECISION', fwd: null, rev: null, typeFwd: _typeReplace(/\bDOUBLE\b/gi, 'DOUBLE PRECISION'), typeRev: _typeReplace(/\bDOUBLE PRECISION\b/gi, 'DOUBLE')},
    {s:'LONGTEXT / MEDIUMTEXT',t:'TEXT', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bLONGTEXT\b/gi, 'TEXT'), _typeReplace(/\bMEDIUMTEXT\b/gi, 'TEXT')), typeRev: _typeReplace(/\bTEXT\b/gi, 'LONGTEXT')},
    {s:'LONGBLOB',t:'BYTEA', fwd: null, rev: null, typeFwd: _typeReplace(/\bLONGBLOB\b/gi, 'BYTEA'), typeRev: _typeReplace(/\bBYTEA\b/gi, 'LONGBLOB')},
    {s:'DATETIME',t:'TIMESTAMP', fwd: null, rev: null, typeFwd: _typeChain(_typeReplace(/\bDATETIME\s*\(\s*\d+\s*\)/gi, 'TIMESTAMP'), _typeReplace(/\bDATETIME\b/gi, 'TIMESTAMP')), typeRev: _typeReplace(/\bTIMESTAMP\b/gi, 'DATETIME')},
    {s:'DATETIME(n)',t:'TIMESTAMP(n)', fwd: null, rev: null},
    {s:'\u683c\u5f0f\u7b26: %Y %m %d %H %i %s',t:'\u683c\u5f0f\u7b26: YYYY MM DD HH24 MI SS', fwd: null, rev: null},
    {s:'SERIAL',t:'INT AUTO_INCREMENT', fwd: null, rev: null, typeFwd: null, typeRev: _typeChain(_typeReplace(/\bSERIAL\b/gi, 'INT AUTO_INCREMENT'), _typeReplace(/\bBIGSERIAL\b/gi, 'BIGINT AUTO_INCREMENT'))},
    {s:'BIGSERIAL',t:'BIGINT AUTO_INCREMENT', fwd: null, rev: null},
    {s:'RECORD (PG)',t:'VARCHAR(4000) (MySQL \u65e0\u7b49\u4ef7)', fwd: null, rev: null, typeFwd: null, typeRev: _typeReplace(/\bRECORD\b/gi, "VARCHAR(4000) /* [\u6ce8\u610f: PG RECORD \u7c7b\u578b, MySQL \u65e0\u7b49\u4ef7\u7c7b\u578b] */")},
    {s:'VARCHAR type',t:'VARCHAR type', fwd: null, rev: null, typeFwd: null, typeRev: _typeReplace(/\bVARCHAR\b(?!\s*\()/gi, 'VARCHAR(4000)')},
    {s:'NUMERIC type',t:'DECIMAL type', fwd: null, rev: null, typeFwd: null, typeRev: _typeReplace(/\bNUMERIC\b/gi, 'DECIMAL')}
  ]
};

/* ===== BODY RULES DEFAULT SNAPSHOT (preserves function refs, for reset) ===== */
function _deepCloneBodyRules(src) {
  var result = {};
  for (var key in src) {
    if (!src.hasOwnProperty(key)) continue;
    result[key] = src[key].map(function(r) {
      var clone = {s: r.s, t: r.t, fwd: r.fwd, rev: r.rev};
      if (r.typeFwd !== undefined) clone.typeFwd = r.typeFwd;
      if (r.typeRev !== undefined) clone.typeRev = r.typeRev;
      return clone;
    });
  }
  return result;
}
var _bodyRulesDefault = _deepCloneBodyRules(_bodyRulesData);
