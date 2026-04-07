/* ===== app.js — 核心解析引擎 + Vue 应用 ===== */

import { DB_LABELS } from './samples.js';
import { _ddlRulesData, _bodyRulesData, _bodyRulesDefault } from './rules.js';

/* ----- IR (Intermediate Representation) ----- */
/* ===== IR (Intermediate Representation) ===== */
function makeTable() {
  return { name:'', comment:'', columns:[], primaryKey:null, uniqueKeys:[], indexes:[], foreignKeys:[], partition:null, extra:{} };
}
function makeColumn() {
  return { name:'', type:'', precision:null, scale:null, length:null, nullable:true, defaultValue:null, comment:'', autoIncrement:false, rawType:'', extra:{} };
}

/* Helper: split statements on ; respecting quotes and comments (-- and block) */
function splitStatements(sql) {
  const result = []; let buf = '', inSQ = false, inDQ = false, inBlock = false, i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    // Inside /* */ block comment
    if (inBlock) {
      if (ch === '*' && i + 1 < sql.length && sql[i + 1] === '/') { inBlock = false; buf += ' '; i += 2; } else { i++; }
      continue;
    }
    // Single-quoted string
    if (ch === "'" && !inDQ) { buf += ch; if (inSQ && i+1 < sql.length && sql[i+1] === "'") { buf += "'"; i += 2; continue; } inSQ = !inSQ; i++; continue; }
    // Double-quoted identifier
    if (ch === '"' && !inSQ) { buf += ch; inDQ = !inDQ; i++; continue; }
    // Outside any quote
    if (!inSQ && !inDQ) {
      // Block comment start
      if (ch === '/' && i + 1 < sql.length && sql[i + 1] === '*') { inBlock = true; i += 2; continue; }
      // Line comment
      if (ch === '-' && i + 1 < sql.length && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; buf += '\n'; continue; }
      // Statement separator
      if (ch === ';') { const s = buf.trim(); if (s && !/^--/.test(s)) result.push(s); buf = ''; i++; continue; }
    }
    buf += ch; i++;
  }
  const tail = buf.trim(); if (tail && !/^--/.test(tail)) result.push(tail);
  return result;
}

/* Helper: split column defs on , respecting parens */
function splitColumnDefs(body) {
  const result = []; let buf = '', depth = 0, inQ = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'" && !inQ) { inQ = true; buf += ch; continue; }
    if (ch === "'" && inQ) { if (i+1 < body.length && body[i+1] === "'") { buf += "''"; i++; } else inQ = false; buf += ch; continue; }
    if (inQ) { buf += ch; continue; }
    if (ch === '(') { depth++; buf += ch; continue; }
    if (ch === ')') { depth--; buf += ch; continue; }
    if (ch === ',' && depth === 0) { result.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) result.push(buf.trim());
  return result;
}

/* Helper: extract body between first matching parens, handling nesting */
function extractParenBody(str) {
  const start = str.indexOf('(');
  if (start === -1) return null;
  let depth = 0, inQ = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inQ) { inQ = true; continue; }
    if (ch === "'" && inQ) { if (i+1 < str.length && str[i+1] === "'") { i++; } else { inQ = false; } continue; }
    if (inQ) continue;
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0) return str.slice(start + 1, i); }
  }
  return str.slice(start + 1);
}

/* Helper: split comma-separated list values, respecting quotes */
function splitListValues(str) {
  const result = []; let buf = '', inQ = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inQ) { inQ = true; buf += ch; continue; }
    if (ch === "'" && inQ) { if (i+1 < str.length && str[i+1] === "'") { buf += "''"; i++; } else { inQ = false; } buf += ch; continue; }
    if (ch === ',' && !inQ) { result.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) result.push(buf.trim());
  return result;
}

function pad(s, n) { return s + ' '.repeat(Math.max(0, n - s.length)); }

/* ===== ORACLE PARSER ===== */
function parseOracleDDL(sql) {
  const tables = [];
  const clean = sql.replace(/\/\s*$/gm, '').replace(/\r\n/g, '\n');
  const stmts = splitStatements(clean);

  for (const stmt of stmts) {
    const s = stmt.trim();
    const ctHeader = s.match(/^CREATE\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(/i);
    if (!ctHeader) continue;
    const tbl = makeTable();
    tbl.name = ctHeader[1];
    const openIdx = s.indexOf('(', ctHeader[0].length - 1);
    let depth = 0, inQ = false, bodyEnd = -1;
    for (let i = openIdx; i < s.length; i++) {
      const ch = s[i];
      if (ch === "'" && !inQ) { inQ = true; continue; }
      if (ch === "'" && inQ) { if (i+1 < s.length && s[i+1] === "'") { i++; } else { inQ = false; } continue; }
      if (inQ) continue;
      if (ch === '(') depth++;
      if (ch === ')') { depth--; if (depth === 0) { bodyEnd = i; break; } }
    }
    if (bodyEnd === -1) continue;
    let body = s.slice(openIdx + 1, bodyEnd);
    const afterParen = s.slice(bodyEnd + 1).trim();
    const partHeaderM = afterParen.match(/PARTITION\s+BY\s+(RANGE|LIST|HASH)\s*\(([^)]+)\)/i);
    if (partHeaderM) {
      const partType = partHeaderM[1].toUpperCase();
      const partCols = partHeaderM[2].split(',').map(c=>c.trim());
      tbl.partition = { type: partType, columns: partCols, partitions: [], hashCount: null };
      const afterHeader = afterParen.slice(afterParen.indexOf(partHeaderM[0]) + partHeaderM[0].length).trim();
      if (partType === 'HASH') {
        const hashM = afterHeader.match(/PARTITIONS\s+(\d+)/i);
        if (hashM) tbl.partition.hashCount = parseInt(hashM[1]);
      } else {
        const pBody = extractParenBody(afterHeader);
        if (pBody) {
          if (partType === 'RANGE') {
            const pRe = /PARTITION\s+(\w+)\s+VALUES\s+LESS\s+THAN\s*/gi;
            let pm;
            while ((pm = pRe.exec(pBody))) {
              const pName = pm[1];
              const rest = pBody.slice(pRe.lastIndex).trim();
              let val;
              if (rest.startsWith('(')) { val = extractParenBody(rest); }
              else { const mxM = rest.match(/^(MAXVALUE)\b/i); val = mxM ? 'MAXVALUE' : ''; if (mxM) pRe.lastIndex = pm.index + pm[0].length + mxM[0].length; }
              tbl.partition.partitions.push({ name: pName, value: (val || '').trim() });
            }
          } else if (partType === 'LIST') {
            const pRe = /PARTITION\s+(\w+)\s+VALUES\s*/gi;
            let pm;
            while ((pm = pRe.exec(pBody))) {
              const pName = pm[1];
              const rest = pBody.slice(pRe.lastIndex).trim();
              let vals;
              if (rest.startsWith('(')) { vals = extractParenBody(rest); } else { vals = ''; }
              tbl.partition.partitions.push({ name: pName, values: splitListValues(vals || '') });
            }
          }
        }
      }
    }

    const parts = splitColumnDefs(body);
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      const pkm = p.match(/^CONSTRAINT\s+(\w+)\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkm) { tbl.primaryKey = { name: pkm[1], columns: pkm[2].split(',').map(c=>c.trim()) }; continue; }
      const pkm2 = p.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkm2) { tbl.primaryKey = { name: 'PK_'+tbl.name, columns: pkm2[1].split(',').map(c=>c.trim()) }; continue; }
      const uqm = p.match(/^(?:CONSTRAINT\s+(\w+)\s+)?UNIQUE\s*\(([^)]+)\)/i);
      if (uqm) { tbl.uniqueKeys.push({ name: uqm[1]||'UQ_'+tbl.name, columns: uqm[2].split(',').map(c=>c.trim()) }); continue; }
      const fkm = p.match(/^(?:CONSTRAINT\s+(\w+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i);
      if (fkm) { tbl.foreignKeys.push({ name: fkm[1]||'FK_'+tbl.name, columns: fkm[2].split(',').map(c=>c.trim()), refTable: fkm[3], refColumns: fkm[4].split(',').map(c=>c.trim()), onDelete: fkm[5]||null, onUpdate: fkm[6]||null }); continue; }
      if (/^(CHECK)\b/i.test(p)) continue;
      const col = parseOracleColumn(p);
      if (col) {
        if (col._inlinePK) { tbl.primaryKey = { name: 'PK_'+tbl.name, columns: [col.name] }; delete col._inlinePK; }
        tbl.columns.push(col);
      }
    }
    tables.push(tbl);
  }

  // Phase 2: COMMENT ON
  for (const stmt of stmts) {
    const s = stmt.trim();
    const tcm = s.match(/^COMMENT\s+ON\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i);
    if (tcm) { const tbl = tables.find(t => t.name.toUpperCase() === tcm[1].toUpperCase()); if (tbl) tbl.comment = tcm[2].replace(/''/g, "'"); continue; }
    const ccm = s.match(/^COMMENT\s+ON\s+COLUMN\s+(?:[\w"]+\.)?["']?(\w+)["']?\.["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i);
    if (ccm) { const tbl = tables.find(t => t.name.toUpperCase() === ccm[1].toUpperCase()); if (tbl) { const col = tbl.columns.find(c => c.name.toUpperCase() === ccm[2].toUpperCase()); if (col) col.comment = ccm[3].replace(/''/g, "'"); } }
  }

  // Phase 3: CREATE INDEX
  for (const stmt of stmts) {
    const s = stmt.trim();
    const im = s.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)/i);
    if (!im) continue;
    const unique = !!im[1]; const idxName = im[2], tblName = im[3], cols = im[4].split(',').map(c=>c.trim());
    const tbl = tables.find(t => t.name.toUpperCase() === tblName.toUpperCase());
    if (!tbl) continue;
    if (unique) tbl.uniqueKeys.push({ name: idxName, columns: cols });
    else tbl.indexes.push({ name: idxName, columns: cols });
  }

  // Phase 4: ALTER TABLE ADD PRIMARY KEY
  for (const stmt of stmts) {
    const s = stmt.trim();
    const am = s.match(/^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+ADD\s+(?:CONSTRAINT\s+(\w+)\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (!am) continue;
    const tbl = tables.find(t => t.name.toUpperCase() === am[1].toUpperCase());
    if (tbl && !tbl.primaryKey) tbl.primaryKey = { name: am[2]||'PK_'+tbl.name, columns: am[3].split(',').map(c=>c.trim()) };
  }

  // Phase 5: ALTER TABLE ADD FOREIGN KEY
  for (const stmt of stmts) {
    const s = stmt.trim();
    const fm = s.match(/^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+ADD\s+(?:CONSTRAINT\s+(\w+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i);
    if (!fm) continue;
    const tbl = tables.find(t => t.name.toUpperCase() === fm[1].toUpperCase());
    if (tbl) tbl.foreignKeys.push({ name: fm[2]||'FK_'+tbl.name, columns: fm[3].split(',').map(c=>c.trim()), refTable: fm[4], refColumns: fm[5].split(',').map(c=>c.trim()), onDelete: fm[6]||null, onUpdate: fm[7]||null });
  }

  return tables;
}

function parseOracleColumn(def) {
  const m = def.match(/^["']?(\w+)["']?\s+(.+)$/i);
  if (!m) return null;
  const col = makeColumn();
  col.name = m[1];
  let rest = m[2].trim();
  const tm = rest.match(/^(LONG\s+RAW|TIMESTAMP\s+WITH\s+(?:LOCAL\s+)?TIME\s+ZONE|INTERVAL\s+(?:YEAR|DAY)\s+TO\s+(?:MONTH|SECOND)|DOUBLE\s+PRECISION|BINARY[_ ]FLOAT|BINARY[_ ]DOUBLE|\w+)(?:\(([^)]+)\))?/i);
  if (!tm) return null;
  col.rawType = tm[0];
  const tname = tm[1].toUpperCase().replace(/\s+/g, ' ');
  col.type = tname;
  if (tm[2]) {
    const nums = tm[2].split(',').map(s=>s.trim());
    if (tname === 'NUMBER' || tname === 'FLOAT' || tname === 'DECIMAL') {
      col.precision = parseInt(nums[0]) || null;
      col.scale = nums[1] !== undefined ? parseInt(nums[1]) : null;
    } else {
      col.length = parseInt(nums[0]) || null;
    }
  }
  rest = rest.slice(tm[0].length).trim();
  // GENERATED [ALWAYS | BY DEFAULT [ON NULL]] AS IDENTITY
  const identityM = rest.match(/\bGENERATED\s+(?:ALWAYS|BY\s+DEFAULT(?:\s+ON\s+NULL)?)\s+AS\s+IDENTITY/i);
  if (identityM) { col.autoIncrement = true; rest = rest.slice(rest.indexOf(identityM[0]) + identityM[0].length).trim(); }
  // DEFAULT
  const dm = rest.match(/^DEFAULT\s+(.+?)(?=\s+NOT\s+NULL|\s+NULL|\s+CONSTRAINT|\s+CHECK|\s+UNIQUE|\s+PRIMARY|$)/i);
  if (dm) { col.defaultValue = dm[1].trim().replace(/,\s*$/, ''); rest = rest.slice(rest.indexOf(dm[0]) + dm[0].length).trim(); }
  if (/\bNOT\s+NULL\b/i.test(rest)) col.nullable = false;
  else if (/\bNULL\b/i.test(rest) && !/\bNOT\s+NULL\b/i.test(rest)) col.nullable = true;
  if (/\bPRIMARY\s+KEY\b/i.test(rest)) col._inlinePK = true;
  return col;
}

/* ===== MYSQL PARSER ===== */
function parseMySQLDDL(sql) {
  const tables = [];
  const clean = sql.replace(/\r\n/g, '\n');
  const stmts = splitStatements(clean);

  for (const stmt of stmts) {
    const s = stmt.trim();
    const ctHeader = s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(/i);
    if (!ctHeader) continue;
    const tbl = makeTable();
    tbl.name = ctHeader[1];
    const openIdx = s.indexOf('(', ctHeader[0].length - 1);
    let depth = 0, inQ = false, bodyEnd = -1;
    for (let i = openIdx; i < s.length; i++) {
      const ch = s[i];
      if (ch === "'" && !inQ) { inQ = true; continue; }
      if (ch === "'" && inQ) { if (i+1 < s.length && s[i+1] === "'") { i++; } else { inQ = false; } continue; }
      if (inQ) continue;
      if (ch === '(') depth++;
      if (ch === ')') { depth--; if (depth === 0) { bodyEnd = i; break; } }
    }
    if (bodyEnd === -1) continue;
    const bodyContent = s.slice(openIdx + 1, bodyEnd);
    const opts = s.slice(bodyEnd + 1).trim();
    const tcm = opts.match(/COMMENT\s*=?\s*'((?:''|[^'])*)'/i);
    if (tcm) tbl.comment = tcm[1].replace(/''/g, "'");
    const partTypeM = opts.match(/PARTITION\s+BY\s+(RANGE|LIST|HASH)\s*/i);
    if (partTypeM) {
      const partType = partTypeM[1].toUpperCase();
      const afterType = opts.slice(opts.indexOf(partTypeM[0]) + partTypeM[0].length).trim();
      let colStr, restAfterCols;
      const colsKwM = afterType.match(/^COLUMNS\s*\(/i);
      if (colsKwM) {
        colStr = extractParenBody(afterType);
        restAfterCols = afterType.slice(afterType.indexOf('('));
        let d=0,q=false;
        for(let i=0;i<restAfterCols.length;i++){const c=restAfterCols[i];if(c==="'"&&!q){q=true;continue;}if(c==="'"&&q){if(i+1<restAfterCols.length&&restAfterCols[i+1]==="'"){i++;}else{q=false;}continue;}if(q)continue;if(c==='(')d++;if(c===')'){d--;if(d===0){restAfterCols=restAfterCols.slice(i+1).trim();break;}}}
      } else if (afterType.startsWith('(')) {
        colStr = extractParenBody(afterType);
        restAfterCols = afterType.slice(afterType.indexOf('('));
        let d=0,q=false;
        for(let i=0;i<restAfterCols.length;i++){const c=restAfterCols[i];if(c==="'"&&!q){q=true;continue;}if(c==="'"&&q){if(i+1<restAfterCols.length&&restAfterCols[i+1]==="'"){i++;}else{q=false;}continue;}if(q)continue;if(c==='(')d++;if(c===')'){d--;if(d===0){restAfterCols=restAfterCols.slice(i+1).trim();break;}}}
      } else { colStr = ''; restAfterCols = afterType; }
      let partCols;
      const fnM = (colStr||'').match(/^\w+\s*\(\s*[`"']?(\w+)[`"']?\s*\)$/i);
      if (fnM) { partCols = [fnM[1]]; } else { partCols = (colStr||'').split(',').map(c=>c.trim().replace(/[`"']/g,'')); }
      tbl.partition = { type: partType, columns: partCols, partitions: [], hashCount: null };
      if (partType === 'HASH') {
        const hashM = opts.match(/PARTITIONS\s+(\d+)/i);
        if (hashM) tbl.partition.hashCount = parseInt(hashM[1]);
      } else {
        const pBody = extractParenBody(restAfterCols);
        if (pBody) {
          if (partType === 'RANGE') {
            const pRe = /PARTITION\s+[`"']?(\w+)[`"']?\s+VALUES\s+LESS\s+THAN\s*/gi;
            let pm;
            while ((pm = pRe.exec(pBody))) {
              const pName = pm[1]; const rest2 = pBody.slice(pRe.lastIndex).trim();
              let val;
              if (rest2.startsWith('(')) { val = extractParenBody(rest2); }
              else { const mxM = rest2.match(/^(MAXVALUE)\b/i); val = mxM ? 'MAXVALUE' : ''; if (mxM) pRe.lastIndex = pm.index + pm[0].length + mxM[0].length; }
              tbl.partition.partitions.push({ name: pName, value: (val || '').trim() });
            }
          } else if (partType === 'LIST') {
            const pRe = /PARTITION\s+[`"']?(\w+)[`"']?\s+VALUES\s+IN\s*/gi;
            let pm;
            while ((pm = pRe.exec(pBody))) {
              const pName = pm[1]; const rest2 = pBody.slice(pRe.lastIndex).trim();
              let vals;
              if (rest2.startsWith('(')) { vals = extractParenBody(rest2); } else { vals = ''; }
              tbl.partition.partitions.push({ name: pName, values: splitListValues(vals || '') });
            }
          }
        }
      }
    }
    const parts = splitColumnDefs(bodyContent);
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      const pkm = p.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkm) { tbl.primaryKey = { name: 'PK_'+tbl.name, columns: pkm[1].split(',').map(c=>c.trim().replace(/[`"']/g,'')) }; continue; }
      const ukm = p.match(/^UNIQUE\s+(?:KEY|INDEX)\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i);
      if (ukm) { tbl.uniqueKeys.push({ name: ukm[1], columns: ukm[2].split(',').map(c=>c.trim().replace(/[`"']/g,'')) }); continue; }
      const km = p.match(/^(?:KEY|INDEX)\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i);
      if (km) { tbl.indexes.push({ name: km[1], columns: km[2].split(',').map(c=>c.trim().replace(/[`"']/g,'')) }); continue; }
      const cpk = p.match(/^CONSTRAINT\s+[`"']?(\w+)[`"']?\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (cpk) { tbl.primaryKey = { name: cpk[1], columns: cpk[2].split(',').map(c=>c.trim().replace(/[`"']/g,'')) }; continue; }
      const fkm1 = p.match(/^(?:CONSTRAINT\s+[`"']?(\w+)[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i);
      if (fkm1) { tbl.foreignKeys.push({ name: fkm1[1]||'FK_'+tbl.name, columns: fkm1[2].split(',').map(c=>c.trim().replace(/[`"']/g,'')), refTable: fkm1[3], refColumns: fkm1[4].split(',').map(c=>c.trim().replace(/[`"']/g,'')), onDelete: fkm1[5]||null, onUpdate: fkm1[6]||null }); continue; }
      if (/^(CHECK)\b/i.test(p)) continue;
      const col = parseMySQLColumn(p);
      if (col) tbl.columns.push(col);
    }
    tables.push(tbl);
  }
  return tables;
}

function parseMySQLColumn(def) {
  const m = def.match(/^[`"']?(\w+)[`"']?\s+(.+)$/i);
  if (!m) return null;
  const col = makeColumn();
  col.name = m[1];
  let rest = m[2].trim();
  const tm = rest.match(/^(\w+)(?:\(([^)]+)\))?/i);
  if (!tm) return null;
  col.rawType = tm[0]; col.type = tm[1].toUpperCase();
  if (tm[2]) {
    const nums = tm[2].split(',').map(s=>s.trim());
    if (/DECIMAL|NUMERIC|FLOAT|DOUBLE|INT|BIGINT|TINYINT|SMALLINT|MEDIUMINT/i.test(col.type)) {
      col.precision = parseInt(nums[0]) || null; col.scale = nums[1] !== undefined ? parseInt(nums[1]) : null;
    } else { col.length = parseInt(nums[0]) || null; }
  }
  rest = rest.slice(tm[0].length).trim();
  if (/\bUNSIGNED\b/i.test(rest)) { col.extra.unsigned = true; rest = rest.replace(/\bUNSIGNED\b/i, '').trim(); }
  rest = rest.replace(/\bCHARACTER\s+SET\s+\w+/i, '').trim();
  rest = rest.replace(/\bCOLLATE\s+\w+/i, '').trim();
  if (/\bAUTO_INCREMENT\b/i.test(rest)) { col.autoIncrement = true; rest = rest.replace(/\bAUTO_INCREMENT\b/i, '').trim(); }
  const dm = rest.match(/\bDEFAULT\s+('(?:''|[^'])*'|[\w()]+(?:\(\d*\))?)/i);
  if (dm) { col.defaultValue = dm[1].trim(); rest = rest.replace(dm[0], '').trim(); }
  rest = rest.replace(/\bON\s+UPDATE\s+\S+/i, '').trim();
  if (/\bNOT\s+NULL\b/i.test(rest)) col.nullable = false;
  const cm = rest.match(/\bCOMMENT\s+'((?:''|[^'])*)'/i);
  if (cm) col.comment = cm[1].replace(/''/g, "'");
  return col;
}

/* ===== POSTGRESQL PARSER ===== */
function parsePostgreSQLDDL(sql) {
  const tables = [];
  const clean = sql.replace(/\r\n/g, '\n');
  const stmts = splitStatements(clean);
  for (const stmt of stmts) {
    const s = stmt.trim();
    if (/^CREATE\s+TABLE\s+\w+\s+PARTITION\s+OF\b/i.test(s)) {
      const pm = s.match(/^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+FOR\s+VALUES\s+FROM\s+\((?:'([^']*)'|(\w+))\)\s+TO\s+\((?:'([^']*)'|(\w+))\)/i);
      if (pm) { const parent = tables.find(t => t.name.toLowerCase() === pm[2].toLowerCase()); if (parent && parent.partition) parent.partition.partitions.push({ name: pm[1], valueFrom: pm[3] || pm[4], valueTo: pm[5] || pm[6] }); continue; }
      const lm = s.match(/^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+FOR\s+VALUES\s+IN\s*\(([^)]+)\)/i);
      if (lm) { const parent = tables.find(t => t.name.toLowerCase() === lm[2].toLowerCase()); if (parent && parent.partition) parent.partition.partitions.push({ name: lm[1], values: splitListValues(lm[3]) }); continue; }
      const hm = s.match(/^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+FOR\s+VALUES\s+WITH\s*\(\s*modulus\s+(\d+)\s*,\s*remainder\s+(\d+)\s*\)/i);
      if (hm) { const parent = tables.find(t => t.name.toLowerCase() === hm[2].toLowerCase()); if (parent && parent.partition) { parent.partition.partitions.push({ name: hm[1], modulus: parseInt(hm[3]), remainder: parseInt(hm[4]) }); if (!parent.partition.hashCount || parseInt(hm[3]) > parent.partition.hashCount) parent.partition.hashCount = parseInt(hm[3]); } continue; }
      const dm2 = s.match(/^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+DEFAULT/i);
      if (dm2) { const parent = tables.find(t => t.name.toLowerCase() === dm2[2].toLowerCase()); if (parent && parent.partition) parent.partition.partitions.push({ name: dm2[1], isDefault: true }); continue; }
      continue;
    }
    const ctHeader = s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?["']?(\w+)["']?\s*\(/i);
    if (!ctHeader) continue;
    const tbl = makeTable();
    tbl.name = ctHeader[1];
    const openIdx = s.indexOf('(', ctHeader[0].length - 1);
    let _depth = 0, _inQ = false, _bodyEnd = -1;
    for (let i = openIdx; i < s.length; i++) {
      const ch = s[i];
      if (ch === "'" && !_inQ) { _inQ = true; continue; }
      if (ch === "'" && _inQ) { if (i+1 < s.length && s[i+1] === "'") { i++; } else { _inQ = false; } continue; }
      if (_inQ) continue;
      if (ch === '(') _depth++;
      if (ch === ')') { _depth--; if (_depth === 0) { _bodyEnd = i; break; } }
    }
    if (_bodyEnd === -1) continue;
    const pgBody = s.slice(openIdx + 1, _bodyEnd);
    const afterParen = s.slice(_bodyEnd + 1).trim();
    const partM = afterParen.match(/PARTITION\s+BY\s+(RANGE|LIST|HASH)\s*\(([^)]+)\)/i);
    if (partM) tbl.partition = { type: partM[1].toUpperCase(), columns: partM[2].split(',').map(c=>c.trim().replace(/["']/g,'')), partitions: [], hashCount: null };
    const parts = splitColumnDefs(pgBody);
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      const pkm = p.match(/^CONSTRAINT\s+["']?(\w+)["']?\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkm) { tbl.primaryKey = { name: pkm[1], columns: pkm[2].split(',').map(c=>c.trim().replace(/["']/g,'')) }; continue; }
      const pkm2 = p.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkm2) { tbl.primaryKey = { name: 'pk_'+tbl.name, columns: pkm2[1].split(',').map(c=>c.trim().replace(/["']/g,'')) }; continue; }
      const uqm = p.match(/^(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?UNIQUE\s*\(([^)]+)\)/i);
      if (uqm) { tbl.uniqueKeys.push({ name: uqm[1]||'uq_'+tbl.name, columns: uqm[2].split(',').map(c=>c.trim().replace(/["']/g,'')) }); continue; }
      const fkm2 = p.match(/^(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i);
      if (fkm2) { tbl.foreignKeys.push({ name: fkm2[1]||'fk_'+tbl.name, columns: fkm2[2].split(',').map(c=>c.trim().replace(/["']/g,'')), refTable: fkm2[3], refColumns: fkm2[4].split(',').map(c=>c.trim().replace(/["']/g,'')), onDelete: fkm2[5]||null, onUpdate: fkm2[6]||null }); continue; }
      if (/^(CHECK|EXCLUDE)\b/i.test(p)) continue;
      const col = parsePGColumn(p);
      if (col) tbl.columns.push(col);
    }
    tables.push(tbl);
  }
  // COMMENT ON
  for (const stmt of stmts) {
    const s = stmt.trim();
    const tcm = s.match(/^COMMENT\s+ON\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i);
    if (tcm) { const t = tables.find(t => t.name.toLowerCase() === tcm[1].toLowerCase()); if (t) t.comment = tcm[2].replace(/''/g,"'"); continue; }
    const ccm = s.match(/^COMMENT\s+ON\s+COLUMN\s+(?:[\w"]+\.)?["']?(\w+)["']?\.["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i);
    if (ccm) { const t = tables.find(t => t.name.toLowerCase() === ccm[1].toLowerCase()); if (t) { const c = t.columns.find(c => c.name.toLowerCase() === ccm[2].toLowerCase()); if (c) c.comment = ccm[3].replace(/''/g,"'"); } }
  }
  // CREATE INDEX
  for (const stmt of stmts) {
    const s = stmt.trim();
    const im = s.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s+ON\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)/i);
    if (!im) continue;
    const tbl = tables.find(t => t.name.toLowerCase() === im[3].toLowerCase());
    if (!tbl) continue;
    const cols = im[4].split(',').map(c=>c.trim().replace(/["']/g,''));
    if (im[1]) tbl.uniqueKeys.push({ name: im[2], columns: cols });
    else tbl.indexes.push({ name: im[2], columns: cols });
  }
  // ALTER TABLE ADD FOREIGN KEY
  for (const stmt of stmts) {
    const s = stmt.trim();
    const fm = s.match(/^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+ADD\s+(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i);
    if (!fm) continue;
    const tbl = tables.find(t => t.name.toLowerCase() === fm[1].toLowerCase());
    if (tbl) tbl.foreignKeys.push({ name: fm[2]||'fk_'+tbl.name, columns: fm[3].split(',').map(c=>c.trim().replace(/["']/g,'')), refTable: fm[4], refColumns: fm[5].split(',').map(c=>c.trim().replace(/["']/g,'')), onDelete: fm[6]||null, onUpdate: fm[7]||null });
  }
  return tables;
}

function parsePGColumn(def) {
  const m = def.match(/^["']?(\w+)["']?\s+(.+)$/i);
  if (!m) return null;
  const col = makeColumn();
  col.name = m[1];
  let rest = m[2].trim();
  if (/^BIGSERIAL\b/i.test(rest)) { col.type = 'BIGSERIAL'; col.autoIncrement = true; rest = rest.replace(/^BIGSERIAL/i,'').trim(); }
  else if (/^SERIAL\b/i.test(rest)) { col.type = 'SERIAL'; col.autoIncrement = true; rest = rest.replace(/^SERIAL/i,'').trim(); }
  else if (/^SMALLSERIAL\b/i.test(rest)) { col.type = 'SMALLSERIAL'; col.autoIncrement = true; rest = rest.replace(/^SMALLSERIAL/i,'').trim(); }
  else {
    const tm = rest.match(/^(DOUBLE\s+PRECISION|CHARACTER\s+VARYING|TIMESTAMP\s+WITH(?:OUT)?\s+TIME\s+ZONE|INTERVAL\s+(?:YEAR|DAY)\s+TO\s+(?:MONTH|SECOND)|BIT\s+VARYING|\w+)(?:\(([^)]+)\))?\s*(?:\[\s*\])?\s*(?=DEFAULT|NOT|NULL|CONSTRAINT|CHECK|UNIQUE|PRIMARY|REFERENCES|GENERATED|,|\)|$)/i);
    if (tm) {
      col.type = tm[1].trim().toUpperCase();
      if (tm[2]) {
        const nums = tm[2].split(',').map(s=>s.trim());
        if (/NUMERIC|DECIMAL/i.test(col.type)) { col.precision = parseInt(nums[0])||null; col.scale = nums[1] !== undefined ? parseInt(nums[1]) : null; }
        else if (/TIMESTAMP|TIME/i.test(col.type)) { col.precision = parseInt(nums[0])||null; }
        else { col.length = parseInt(nums[0])||null; }
      }
      rest = rest.slice(tm[0].length).trim();
    }
  }
  col.rawType = col.type + (col.length ? '('+col.length+')' : col.precision ? '('+col.precision+(col.scale!=null?','+col.scale:'')+')' : '');
  const dm = rest.match(/\bDEFAULT\s+('(?:''|[^'])*'|[\w():.']+(?:\([\d]*\))?)/i);
  if (dm) { col.defaultValue = dm[1].trim(); rest = rest.replace(dm[0],'').trim(); }
  if (/\bNOT\s+NULL\b/i.test(rest)) col.nullable = false;
  return col;
}


/* ----- Rule-Driven Type Matching Engine ----- */

/* ===== RULE-DRIVEN TYPE MATCHING ENGINE ===== */
function _parseDdlSource(src) {
  var s = src.trim();
  var cond = null;
  var cm = s.match(/\s*\[p([<>]=?)(\d+)\]\s*$/);
  if (cm) { cond = {op:cm[1], val:parseInt(cm[2])}; s = s.replace(/\s*\[.*\]$/, '').trim(); }
  var hasN=false, hasP=false, hasPS=false, specificVal=null;
  var pm = s.match(/^(.+?)\(([^)]*)\)$/);
  if (pm) {
    var params = pm[2].trim();
    s = pm[1].trim();
    if (params === 'n') hasN = true;
    else if (params === 'p,s') hasPS = true;
    else if (params === 'p') hasP = true;
    else if (params === 'p,0') { hasP = true; /* special: precision with fixed 0 scale */ }
    else if (/^\d+$/.test(params)) specificVal = parseInt(params);
  }
  var types = s.split(/\s*\/\s*/).map(function(t){return t.trim().toUpperCase();});
  return {types:types, hasN:hasN, hasP:hasP, hasPS:hasPS, specificVal:specificVal, cond:cond};
}

function _matchDdlSource(col, parsed) {
  var t = col.type.toUpperCase();
  var matched = false;
  for (var i=0; i<parsed.types.length; i++) {
    var pt = parsed.types[i];
    if (t === pt) { matched=true; break; }
    if (pt === 'TIMESTAMP' && t.indexOf('TIMESTAMP') === 0) { matched=true; break; }
  }
  if (!matched) return false;
  if (parsed.specificVal !== null) {
    var cv = col.precision != null ? col.precision : col.length;
    if (cv !== parsed.specificVal) return false;
  }
  if (parsed.hasPS) { if (!col.precision || col.scale == null) return false; }
  if (parsed.hasP) { if (!col.precision) return false; if (col.scale != null && col.scale !== 0) return false; }
  if (parsed.hasN) { if (!col.length) return false; }
  if (parsed.cond) {
    var p = col.precision; if (!p) return false;
    if (parsed.cond.op === '<=' && !(p <= parsed.cond.val)) return false;
    if (parsed.cond.op === '>=' && !(p >= parsed.cond.val)) return false;
    if (parsed.cond.op === '<' && !(p < parsed.cond.val)) return false;
    if (parsed.cond.op === '>' && !(p > parsed.cond.val)) return false;
  }
  return true;
}

function _applyDdlTarget(col, targetStr) {
  var s = targetStr.trim();
  var pm = s.match(/^(.+?)\(([^)]*)\)$/);
  if (!pm) return s;
  var base = pm[1].trim(), inner = pm[2].trim();
  if (inner === 'n') return base + '(' + (col.length || 255) + ')';
  if (inner === 'p,s') return base + '(' + (col.precision||38) + ',' + (col.scale!=null?col.scale:0) + ')';
  if (inner === 'p,0') return base + '(' + (col.precision||38) + ',0)';
  if (inner === 'p') return base + '(' + (col.precision||38) + ')';
  return s;
}

function _mapTypeByRules(col, rules) {
  if (!rules || !rules.length) return (col.rawType || col.type) + ' /* [注意: 无可用映射规则, 请人工确认] */';
  for (var i=0; i<rules.length; i++) {
    var r = rules[i];
    if (!r.source || !r.target) continue;
    var parsed = _parseDdlSource(r.source);
    if (_matchDdlSource(col, parsed)) return _applyDdlTarget(col, r.target);
  }
  return (col.rawType || col.type) + ' /* [注意: 未匹配到映射规则, 类型原样保留] */';
}

/* ===== TYPE MAPPER WRAPPERS (read from _ddlRulesData) ===== */
function oracleTypeToMySQL(col) { return _mapTypeByRules(col, _ddlRulesData.oracleToMysql); }
function oracleTypeToPG(col)    { return _mapTypeByRules(col, _ddlRulesData.oracleToPg); }
function mysqlTypeToOracle(col) { return _mapTypeByRules(col, _ddlRulesData.mysqlToOracle); }
function mysqlTypeToPG(col)     { return _mapTypeByRules(col, _ddlRulesData.mysqlToPg); }
function pgTypeToOracle(col)    { return _mapTypeByRules(col, _ddlRulesData.pgToOracle); }
function pgTypeToMySQL(col)     { return _mapTypeByRules(col, _ddlRulesData.pgToMysql); }

/* Default value conversion */
function convertDefault(val, from, to) {
  if (!val) return null;
  const v = val.toUpperCase().trim();
  if (from === 'oracle') {
    if (v === 'SYSDATE' || v === 'SYSTIMESTAMP') return to === 'mysql' ? 'CURRENT_TIMESTAMP(6)' : 'CLOCK_TIMESTAMP()';
    if (v === 'SYS_GUID()') return to === 'mysql' ? 'UUID()' : 'gen_random_uuid()';
  }
  if (from === 'mysql') {
    if (v === 'CURRENT_TIMESTAMP' || v.startsWith('CURRENT_TIMESTAMP(') || v === 'NOW()' || v.startsWith('NOW(')) return to === 'oracle' ? 'SYSTIMESTAMP' : 'CLOCK_TIMESTAMP()';
    if (v === 'UUID()') return to === 'oracle' ? 'SYS_GUID()' : 'gen_random_uuid()';
    if (v === 'TRUE') return to === 'oracle' ? '1' : 'TRUE';
    if (v === 'FALSE') return to === 'oracle' ? '0' : 'FALSE';
  }
  if (from === 'postgresql') {
    if (v === 'CLOCK_TIMESTAMP()' || v === 'NOW()' || v === 'CURRENT_TIMESTAMP') return to === 'oracle' ? 'SYSTIMESTAMP' : 'CURRENT_TIMESTAMP(6)';
    if (v === 'GEN_RANDOM_UUID()') return to === 'oracle' ? 'SYS_GUID()' : 'UUID()';
    if (v === 'TRUE') return to === 'oracle' ? '1' : 'TRUE';
    if (v === 'FALSE') return to === 'oracle' ? '0' : 'FALSE';
  }
  return val;
}

/* ===== ORACLE GENERATOR ===== */
function generateOracleDDL(tables, fromDb) {
  const typeMap = fromDb === 'mysql' ? mysqlTypeToOracle : pgTypeToOracle;
  const lines = [];
  for (const tbl of tables) {
    const tname = tbl.name.toUpperCase();
    lines.push('-- ' + (tbl.comment || tname));
    lines.push('CREATE TABLE ' + tname + ' (');
    const colLines = [];
    for (const col of tbl.columns) {
      const cname = col.name.toUpperCase();
      let t = typeMap(col);
      let line = '    ' + pad(cname, 18) + ' ' + pad(t, 20);
      if (col.autoIncrement) line += ' GENERATED BY DEFAULT ON NULL AS IDENTITY';
      const dv = convertDefault(col.defaultValue, fromDb, 'oracle');
      if (dv && !col.autoIncrement) line += ' DEFAULT ' + dv;
      if (!col.nullable) line += ' NOT NULL';
      colLines.push(line);
    }
    if (tbl.primaryKey) colLines.push('    CONSTRAINT ' + tbl.primaryKey.name.toUpperCase() + ' PRIMARY KEY (' + tbl.primaryKey.columns.map(c=>c.toUpperCase()).join(', ') + ')');
    lines.push(colLines.join(',\n'));
    if (tbl.partition) {
      const partType = tbl.partition.type;
      lines.push(')');
      if (partType === 'HASH') {
        const count = tbl.partition.hashCount || tbl.partition.partitions.length || 4;
        lines.push('PARTITION BY HASH (' + tbl.partition.columns.map(c=>c.toUpperCase()).join(', ') + ') PARTITIONS ' + count + ';');
      } else if (partType === 'LIST') {
        lines.push('PARTITION BY LIST (' + tbl.partition.columns.map(c=>c.toUpperCase()).join(', ') + ') (');
        const pLines = [];
        for (const p of tbl.partition.partitions) {
          const vals = p.values ? p.values.join(',') : (p.value || '');
          pLines.push('    PARTITION ' + p.name.toUpperCase() + ' VALUES (' + vals + ')');
        }
        lines.push(pLines.join(',\n'));
        lines.push(');');
      } else {
        lines.push('PARTITION BY ' + partType + ' (' + tbl.partition.columns.map(c=>c.toUpperCase()).join(', ') + ') (');
        const pLines = [];
        for (const p of tbl.partition.partitions) {
          if (p.isDefault) { pLines.push('    PARTITION ' + p.name.toUpperCase() + ' VALUES LESS THAN (MAXVALUE)'); continue; }
          let val = p.value || '';
          if (p.valueFrom && p.valueTo) { val = "TO_DATE('" + p.valueTo + "', 'YYYY-MM-DD')"; }
          else if (/^TO_DAYS\(/i.test(val)) { const dm = val.match(/TO_DAYS\s*\(\s*'([^']*)'\s*\)/i); val = dm ? "TO_DATE('" + dm[1] + "', 'YYYY-MM-DD')" : val; }
          else if (val.toUpperCase() === 'MAXVALUE' || val === '') { val = 'MAXVALUE'; }
          pLines.push('    PARTITION ' + p.name.toUpperCase() + ' VALUES LESS THAN (' + val + ')');
        }
        lines.push(pLines.join(',\n'));
        lines.push(');');
      }
    } else { lines.push(');'); }
    lines.push('');
    if (tbl.comment) lines.push("COMMENT ON TABLE " + tname + " IS '" + tbl.comment.replace(/'/g, "''") + "';");
    for (const col of tbl.columns) { if (col.comment) lines.push("COMMENT ON COLUMN " + tname + "." + col.name.toUpperCase() + " IS '" + col.comment.replace(/'/g, "''") + "';"); }
    if (tbl.columns.some(c=>c.comment) || tbl.comment) lines.push('');
    for (const uk of tbl.uniqueKeys) lines.push('CREATE UNIQUE INDEX ' + uk.name.toUpperCase() + ' ON ' + tname + '(' + uk.columns.map(c=>c.toUpperCase()).join(', ') + ');');
    for (const idx of tbl.indexes) lines.push('CREATE INDEX ' + idx.name.toUpperCase() + ' ON ' + tname + '(' + idx.columns.map(c=>c.toUpperCase()).join(', ') + ');');
    if (tbl.uniqueKeys.length || tbl.indexes.length) lines.push('');
    for (const fk of tbl.foreignKeys) {
      let fkLine = 'ALTER TABLE ' + tname + ' ADD CONSTRAINT ' + fk.name.toUpperCase() + ' FOREIGN KEY (' + fk.columns.map(c=>c.toUpperCase()).join(', ') + ') REFERENCES ' + fk.refTable.toUpperCase() + '(' + fk.refColumns.map(c=>c.toUpperCase()).join(', ') + ')';
      if (fk.onDelete) fkLine += ' ON DELETE ' + fk.onDelete.toUpperCase();
      if (fk.onUpdate) fkLine += ' /* [注意: Oracle 不支持 ON UPDATE ' + fk.onUpdate.toUpperCase() + ', 需通过触发器实现] */';
      lines.push(fkLine + ';');
    }
    if (tbl.foreignKeys.length) lines.push('');
  }
  return lines.join('\n').trim();
}

/* ===== MYSQL GENERATOR ===== */
function generateMySQLDDL(tables, fromDb) {
  const typeMap = fromDb === 'oracle' ? oracleTypeToMySQL : pgTypeToMySQL;
  const lines = [];
  for (const tbl of tables) {
    const tname = tbl.name.toLowerCase();
    lines.push('-- ' + (tbl.comment || tname));
    lines.push('CREATE TABLE `' + tname + '` (');
    const colLines = [];
    for (const col of tbl.columns) {
      const cname = col.name.toLowerCase();
      let t = typeMap(col);
      let line = '    `' + cname + '`' + ' '.repeat(Math.max(1, 18 - cname.length)) + pad(t, 20);
      const dv = convertDefault(col.defaultValue, fromDb, 'mysql');
      if (dv) line += ' DEFAULT ' + dv;
      if (col.autoIncrement) line += ' AUTO_INCREMENT';
      if (!col.nullable) line += ' NOT NULL';
      if (col.comment) line += " COMMENT '" + col.comment.replace(/'/g, "''") + "'";
      colLines.push(line);
    }
    if (tbl.primaryKey) {
      var pkCols = tbl.primaryKey.columns.map(c => c.toLowerCase());
      // MySQL requires partition column in primary key when table is partitioned
      if (tbl.partition && tbl.partition.columns) {
        tbl.partition.columns.forEach(function(pc) {
          if (pkCols.indexOf(pc.toLowerCase()) === -1) pkCols.push(pc.toLowerCase());
        });
      }
      colLines.push('    PRIMARY KEY (' + pkCols.map(c=>'`'+c+'`').join(', ') + ')');
    }
    for (const uk of tbl.uniqueKeys) colLines.push('    UNIQUE KEY `' + uk.name.toLowerCase() + '` (' + uk.columns.map(c=>'`'+c.toLowerCase()+'`').join(', ') + ')');
    for (const idx of tbl.indexes) colLines.push('    KEY `' + idx.name.toLowerCase() + '` (' + idx.columns.map(c=>'`'+c.toLowerCase()+'`').join(', ') + ')');
    for (const fk of tbl.foreignKeys) {
      let fkLine = '    CONSTRAINT `' + fk.name.toLowerCase() + '` FOREIGN KEY (' + fk.columns.map(c=>'`'+c.toLowerCase()+'`').join(', ') + ') REFERENCES `' + fk.refTable.toLowerCase() + '`(' + fk.refColumns.map(c=>'`'+c.toLowerCase()+'`').join(', ') + ')';
      if (fk.onDelete) fkLine += ' ON DELETE ' + fk.onDelete.toUpperCase();
      if (fk.onUpdate) fkLine += ' ON UPDATE ' + fk.onUpdate.toUpperCase();
      colLines.push(fkLine);
    }
    lines.push(colLines.join(',\n'));
    let optLine = ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (tbl.comment) optLine += "\n  COMMENT='" + tbl.comment.replace(/'/g, "''") + "'";
    if (tbl.partition) {
      lines.push(optLine);
      const pType = tbl.partition.type;
      const pCols = tbl.partition.columns.map(c=>'`'+c.toLowerCase()+'`').join(', ');
      if (pType === 'HASH') {
        const count = tbl.partition.hashCount || tbl.partition.partitions.length || 4;
        lines.push('  PARTITION BY HASH (' + pCols + ')');
        lines.push('  PARTITIONS ' + count + ';');
      } else if (pType === 'LIST') {
        lines.push('  PARTITION BY LIST COLUMNS(' + pCols + ') (');
        const pLines = [];
        for (const p of tbl.partition.partitions) { const vals = p.values ? p.values.join(',') : (p.value || ''); pLines.push('    PARTITION `' + p.name.toLowerCase() + '` VALUES IN (' + vals + ')'); }
        lines.push(pLines.join(',\n'));
        lines.push('  );');
      } else if (pType === 'RANGE') {
        const isDate = tbl.columns.some(c => tbl.partition.columns.some(pc => pc.toUpperCase() === c.name.toUpperCase()) && /DATE|DATETIME|TIMESTAMP/i.test(typeMap(c)));
        if (isDate) lines.push('  PARTITION BY RANGE (TO_DAYS(' + pCols + ')) (');
        else lines.push('  PARTITION BY RANGE (' + pCols + ') (');
        const pLines = [];
        for (const p of tbl.partition.partitions) {
          if (p.isDefault) { pLines.push('    PARTITION `' + p.name.toLowerCase() + '` VALUES LESS THAN MAXVALUE'); continue; }
          let val = p.value || '';
          if (p.valueFrom && p.valueTo) { val = "TO_DAYS('" + p.valueTo + "')"; }
          else if (/TO_DATE\s*\(\s*'([^']*)'/i.test(val)) { const dm = val.match(/TO_DATE\s*\(\s*'([^']*)'/i); val = "TO_DAYS('" + dm[1] + "')"; }
          else if (val.toUpperCase() === 'MAXVALUE') { val = 'MAXVALUE'; }
          if (val === 'MAXVALUE') pLines.push('    PARTITION `' + p.name.toLowerCase() + '` VALUES LESS THAN MAXVALUE');
          else pLines.push('    PARTITION `' + p.name.toLowerCase() + '` VALUES LESS THAN (' + val + ')');
        }
        lines.push(pLines.join(',\n'));
        lines.push('  );');
      }
    } else { lines.push(optLine + ';'); }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/* ===== POSTGRESQL GENERATOR ===== */
function generatePostgreSQLDDL(tables, fromDb) {
  const typeMap = fromDb === 'oracle' ? oracleTypeToPG : mysqlTypeToPG;
  const lines = [];
  for (const tbl of tables) {
    const tname = tbl.name.toLowerCase();
    lines.push('-- ' + (tbl.comment || tname));
    lines.push('CREATE TABLE ' + tname + ' (');
    const colLines = [];
    for (const col of tbl.columns) {
      const cname = col.name.toLowerCase();
      let t;
      if (col.autoIncrement) {
        const baseT = typeMap(col);
        if (/BIGINT/i.test(baseT) || /NUMBER\(18\)/i.test(col.rawType) || col.type === 'BIGSERIAL') t = 'BIGSERIAL';
        else if (/SMALLINT/i.test(baseT)) t = 'SMALLSERIAL';
        else t = 'SERIAL';
      } else { t = typeMap(col); }
      let line = '    ' + pad(cname, 18) + ' ' + pad(t, 20);
      if (!col.autoIncrement) { const dv = convertDefault(col.defaultValue, fromDb, 'postgresql'); if (dv) line += ' DEFAULT ' + dv; }
      if (!col.nullable) line += ' NOT NULL';
      colLines.push(line);
    }
    if (tbl.primaryKey) colLines.push('    CONSTRAINT ' + tbl.primaryKey.name.toLowerCase() + ' PRIMARY KEY (' + tbl.primaryKey.columns.map(c=>c.toLowerCase()).join(', ') + ')');
    lines.push(colLines.join(',\n'));
    if (tbl.partition) {
      const partType = tbl.partition.type;
      lines.push(') PARTITION BY ' + partType + ' (' + tbl.partition.columns.map(c=>c.toLowerCase()).join(', ') + ');');
      lines.push('');
      if (partType === 'HASH') {
        const count = tbl.partition.hashCount || tbl.partition.partitions.length || 4;
        for (let i = 0; i < count; i++) {
          const pName = tbl.partition.partitions[i] ? tbl.partition.partitions[i].name.toLowerCase() : tname + '_p' + i;
          lines.push('CREATE TABLE ' + pName + ' PARTITION OF ' + tname);
          lines.push('    FOR VALUES WITH (modulus ' + count + ', remainder ' + i + ');');
        }
        lines.push('');
      } else if (partType === 'LIST') {
        for (const p of tbl.partition.partitions) {
          if (p.isDefault) { lines.push('CREATE TABLE ' + tname + '_' + p.name.toLowerCase() + ' PARTITION OF ' + tname + ' DEFAULT;'); continue; }
          const vals = p.values ? p.values.join(',') : (p.value || '');
          lines.push('CREATE TABLE ' + tname + '_' + p.name.toLowerCase() + ' PARTITION OF ' + tname);
          lines.push('    FOR VALUES IN (' + vals + ');');
        }
        lines.push('');
      } else {
        const rangePartitions = [];
        for (const p of tbl.partition.partitions) {
          if (p.isDefault) { rangePartitions.push({ name: p.name, isDefault: true }); continue; }
          if (p.valueFrom && p.valueTo) { rangePartitions.push({ name: p.name, from: p.valueFrom, to: p.valueTo }); continue; }
          const val = (p.value || '').trim();
          if (val.toUpperCase() === 'MAXVALUE') { rangePartitions.push({ name: p.name, isDefault: true }); continue; }
          const dm = val.match(/TO_DATE\s*\(\s*'([^']*)'/i) || val.match(/TO_DAYS\s*\(\s*'([^']*)'/i);
          let valTo = dm ? dm[1] : val;
          rangePartitions.push({ name: p.name, to: valTo });
        }
        let prevTo = null;
        for (const rp of rangePartitions) {
          if (rp.isDefault) { lines.push('CREATE TABLE ' + tname + '_' + rp.name.toLowerCase() + ' PARTITION OF ' + tname + ' DEFAULT;'); continue; }
          if (rp.from && rp.to) {
            lines.push('CREATE TABLE ' + tname + '_' + rp.name.toLowerCase() + ' PARTITION OF ' + tname);
            const fromExpr = rp.from.toUpperCase() === 'MINVALUE' ? 'MINVALUE' : "'" + rp.from + "'";
            const toExpr = rp.to.toUpperCase() === 'MAXVALUE' ? 'MAXVALUE' : "'" + rp.to + "'";
            lines.push("    FOR VALUES FROM (" + fromExpr + ") TO (" + toExpr + ");");
            prevTo = rp.to;
          } else if (rp.to) {
            lines.push('CREATE TABLE ' + tname + '_' + rp.name.toLowerCase() + ' PARTITION OF ' + tname);
            if (prevTo) lines.push("    FOR VALUES FROM ('" + prevTo + "') TO ('" + rp.to + "');");
            else lines.push("    FOR VALUES FROM (MINVALUE) TO ('" + rp.to + "');");
            prevTo = rp.to;
          }
        }
        lines.push('');
      }
    } else { lines.push(');'); lines.push(''); }
    if (tbl.comment) lines.push("COMMENT ON TABLE " + tname + " IS '" + tbl.comment.replace(/'/g, "''") + "';");
    for (const col of tbl.columns) { if (col.comment) lines.push("COMMENT ON COLUMN " + tname + "." + col.name.toLowerCase() + " IS '" + col.comment.replace(/'/g, "''") + "';"); }
    if (tbl.columns.some(c=>c.comment) || tbl.comment) lines.push('');
    for (const uk of tbl.uniqueKeys) lines.push('CREATE UNIQUE INDEX ' + uk.name.toLowerCase() + ' ON ' + tname + '(' + uk.columns.map(c=>c.toLowerCase()).join(', ') + ');');
    for (const idx of tbl.indexes) lines.push('CREATE INDEX ' + idx.name.toLowerCase() + ' ON ' + tname + '(' + idx.columns.map(c=>c.toLowerCase()).join(', ') + ');');
    if (tbl.uniqueKeys.length || tbl.indexes.length) lines.push('');
    for (const fk of tbl.foreignKeys) {
      let fkLine = 'ALTER TABLE ' + tname + ' ADD CONSTRAINT ' + fk.name.toLowerCase() + ' FOREIGN KEY (' + fk.columns.map(c=>c.toLowerCase()).join(', ') + ') REFERENCES ' + fk.refTable.toLowerCase() + '(' + fk.refColumns.map(c=>c.toLowerCase()).join(', ') + ')';
      if (fk.onDelete) fkLine += ' ON DELETE ' + fk.onDelete.toUpperCase();
      if (fk.onUpdate) fkLine += ' ON UPDATE ' + fk.onUpdate.toUpperCase();
      lines.push(fkLine + ';');
    }
    if (tbl.foreignKeys.length) lines.push('');
  }
  return lines.join('\n').trim();
}

/* ===== EXTRA DDL PARSER (SEQUENCE, ALTER TABLE) ===== */
function parseExtraDDL(sql, sourceDb) {
  const result = { sequences: [], alterSequences: [], alterColumns: [], addColumns: [] };
  if (!sql || !sql.trim()) return result;
  const stmts = splitStatements(sql);

  for (const stmt of stmts) {
    const s = stmt.trim();

    // --- CREATE SEQUENCE ---
    const seqM = s.match(/^CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?["']?([\w]+)["']?\s*([\s\S]*)/i);
    if (seqM) {
      const name = seqM[1];
      const body = seqM[2] || '';
      const seq = { name: name, startWith: null, incrementBy: null, minValue: null, maxValue: null, cache: null, cycle: false };
      const startM = body.match(/START\s+(?:WITH\s+)?(\d+)/i);
      if (startM) seq.startWith = parseInt(startM[1]);
      const incM = body.match(/INCREMENT\s+(?:BY\s+)?(-?\d+)/i);
      if (incM) seq.incrementBy = parseInt(incM[1]);
      const minM = body.match(/MINVALUE\s+(\d+)/i);
      if (minM) seq.minValue = parseInt(minM[1]);
      const noMinM = body.match(/NO\s*MINVALUE/i);
      if (noMinM) seq.minValue = null;
      const maxM = body.match(/MAXVALUE\s+(\d+)/i);
      if (maxM) seq.maxValue = parseInt(maxM[1]);
      const noMaxM = body.match(/NO\s*MAXVALUE/i);
      if (noMaxM) seq.maxValue = null;
      const cacheM = body.match(/CACHE\s+(\d+)/i);
      if (cacheM) seq.cache = parseInt(cacheM[1]);
      if (/\bCYCLE\b/i.test(body) && !/\bNO\s*CYCLE\b/i.test(body)) seq.cycle = true;
      if (/\bNOCYCLE\b/i.test(body)) seq.cycle = false;
      result.sequences.push(seq);
      continue;
    }

    // --- ALTER SEQUENCE ---
    const altSeqM = s.match(/^ALTER\s+SEQUENCE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s*([\s\S]*)/i);
    if (altSeqM) {
      const name = altSeqM[1];
      const body = altSeqM[2] || '';
      const seq = { name: name, incrementBy: null, maxValue: null, cache: null, restartWith: null };
      const incM = body.match(/INCREMENT\s+(?:BY\s+)?(-?\d+)/i);
      if (incM) seq.incrementBy = parseInt(incM[1]);
      const maxM = body.match(/MAXVALUE\s+(\d+)/i);
      if (maxM) seq.maxValue = parseInt(maxM[1]);
      const cacheM = body.match(/CACHE\s+(\d+)/i);
      if (cacheM) seq.cache = parseInt(cacheM[1]);
      const restartM = body.match(/RESTART\s+(?:WITH\s+)?(\d+)/i);
      if (restartM) seq.restartWith = parseInt(restartM[1]);
      result.alterSequences.push(seq);
      continue;
    }

    // --- ALTER TABLE ... MODIFY / ALTER COLUMN (change type) ---
    if (sourceDb === 'oracle') {
      const modM = s.match(/^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+MODIFY\s+\(?\s*["']?([\w]+)["']?\s+([\w]+(?:\s*\([^)]*\))?)\s*\)?/i);
      if (modM) { result.alterColumns.push(parseAlterColType(modM[1], modM[2], modM[3], 'modify')); continue; }
    } else if (sourceDb === 'mysql') {
      const modM = s.match(/^ALTER\s+TABLE\s+[`"]?([\w]+)[`"]?\s+MODIFY\s+(?:COLUMN\s+)?[`"]?([\w]+)[`"]?\s+([\w]+(?:\s*\([^)]*\))?)/i);
      if (modM) { result.alterColumns.push(parseAlterColType(modM[1], modM[2], modM[3], 'modify')); continue; }
    } else if (sourceDb === 'postgresql') {
      const modM = s.match(/^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+ALTER\s+COLUMN\s+["']?([\w]+)["']?\s+(?:SET\s+DATA\s+)?TYPE\s+([\w]+(?:\s*\([^)]*\))?)/i);
      if (modM) { result.alterColumns.push(parseAlterColType(modM[1], modM[2], modM[3], 'modify')); continue; }
    }

    // --- ALTER TABLE ... ADD column ---
    if (sourceDb === 'oracle') {
      const addM = s.match(/^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+ADD\s+\(?\s*["']?([\w]+)["']?\s+([\w]+(?:\s*\([^)]*\))?)([^)]*)\)?/i);
      if (addM && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|INDEX|CHECK)\b/i.test(addM[2])) {
        result.addColumns.push(parseAddCol(addM[1], addM[2], addM[3], addM[4])); continue;
      }
    } else if (sourceDb === 'mysql') {
      const addM = s.match(/^ALTER\s+TABLE\s+[`"]?([\w]+)[`"]?\s+ADD\s+(?:COLUMN\s+)?[`"]?([\w]+)[`"]?\s+([\w]+(?:\s*\([^)]*\))?)(.*)/i);
      if (addM && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CHECK)\b/i.test(addM[2])) {
        result.addColumns.push(parseAddCol(addM[1], addM[2], addM[3], addM[4])); continue;
      }
    } else if (sourceDb === 'postgresql') {
      const addM = s.match(/^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?([\w]+)["']?\s+([\w]+(?:\s*\([^)]*\))?)(.*)/i);
      if (addM && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|INDEX|CHECK)\b/i.test(addM[2])) {
        result.addColumns.push(parseAddCol(addM[1], addM[2], addM[3], addM[4])); continue;
      }
    }
  }

  return result;
}

function parseAlterColType(table, column, typeStr, action) {
  const result = { table: table, column: column, newType: '', newLength: null, newPrecision: null, newScale: null, action: action };
  const tm = typeStr.match(/^([\w]+)(?:\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?/i);
  if (tm) {
    result.newType = tm[1].toUpperCase();
    if (tm[2] && tm[3]) { result.newPrecision = parseInt(tm[2]); result.newScale = parseInt(tm[3]); }
    else if (tm[2]) { result.newLength = parseInt(tm[2]); }
  }
  return result;
}

function parseAddCol(table, column, typeStr, rest) {
  const col = { table: table, column: column, type: '', length: null, precision: null, scale: null, nullable: true, defaultValue: null };
  const tm = typeStr.match(/^([\w]+)(?:\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?/i);
  if (tm) {
    col.type = tm[1].toUpperCase();
    if (tm[2] && tm[3]) { col.precision = parseInt(tm[2]); col.scale = parseInt(tm[3]); }
    else if (tm[2]) { col.length = parseInt(tm[2]); }
  }
  if (rest) {
    if (/NOT\s+NULL/i.test(rest)) col.nullable = false;
    const defM = rest.match(/DEFAULT\s+('(?:[^']*)'|[\w.()]+)/i);
    if (defM) col.defaultValue = defM[1];
  }
  return col;
}

function convertExtraColType(typeStr, length, precision, scale, sourceDb, targetDb) {
  // Build a pseudo-column object compatible with existing type mapping functions
  const col = { type: typeStr, length: length, precision: precision, scale: scale };
  if (sourceDb === 'oracle' && targetDb === 'mysql') return oracleTypeToMySQL(col);
  if (sourceDb === 'oracle' && targetDb === 'postgresql') return oracleTypeToPG(col);
  if (sourceDb === 'mysql' && targetDb === 'oracle') return mysqlTypeToOracle(col);
  if (sourceDb === 'mysql' && targetDb === 'postgresql') return mysqlTypeToPG(col);
  if (sourceDb === 'postgresql' && targetDb === 'oracle') return pgTypeToOracle(col);
  if (sourceDb === 'postgresql' && targetDb === 'mysql') return pgTypeToMySQL(col);
  // fallback
  if (length) return typeStr + '(' + length + ')';
  if (precision && scale) return typeStr + '(' + precision + ',' + scale + ')';
  if (precision) return typeStr + '(' + precision + ')';
  return typeStr;
}

function generateExtraDDL(parsed, sourceDb, targetDb) {
  const lines = [];

  // --- Sequences ---
  if (parsed.sequences.length) {
    lines.push('-- ========== SEQUENCES ==========');
    for (const seq of parsed.sequences) {
      if (targetDb === 'mysql') {
        lines.push('-- MySQL 不原生支持 CREATE SEQUENCE (可使用 AUTO_INCREMENT 替代)');
        lines.push('-- 原序列: ' + seq.name + ' START WITH ' + (seq.startWith || 1) + ' INCREMENT BY ' + (seq.incrementBy || 1));
      } else if (targetDb === 'oracle') {
        let s = 'CREATE SEQUENCE ' + seq.name;
        if (seq.startWith != null) s += ' START WITH ' + seq.startWith;
        if (seq.incrementBy != null) s += ' INCREMENT BY ' + seq.incrementBy;
        if (seq.minValue != null) s += ' MINVALUE ' + seq.minValue;
        if (seq.maxValue != null) s += ' MAXVALUE ' + seq.maxValue;
        if (seq.cache != null) s += ' CACHE ' + seq.cache;
        s += seq.cycle ? ' CYCLE' : ' NOCYCLE';
        lines.push(s + ';');
      } else {
        let s = 'CREATE SEQUENCE ' + seq.name;
        if (seq.startWith != null) s += ' START WITH ' + seq.startWith;
        if (seq.incrementBy != null) s += ' INCREMENT BY ' + seq.incrementBy;
        if (seq.minValue != null) s += ' MINVALUE ' + seq.minValue;
        else lines.push('');  // just spacing
        if (seq.maxValue != null) s += ' MAXVALUE ' + seq.maxValue;
        if (seq.cache != null) s += ' CACHE ' + seq.cache;
        s += seq.cycle ? ' CYCLE' : ' NO CYCLE';
        lines.push(s + ';');
      }
    }
    lines.push('');
  }

  // --- ALTER SEQUENCE ---
  if (parsed.alterSequences.length) {
    lines.push('-- ========== ALTER SEQUENCES ==========');
    for (const seq of parsed.alterSequences) {
      if (targetDb === 'mysql') {
        lines.push('-- MySQL 不原生支持 ALTER SEQUENCE');
        lines.push('-- 原序列: ALTER SEQUENCE ' + seq.name);
      } else if (targetDb === 'oracle') {
        let s = 'ALTER SEQUENCE ' + seq.name;
        if (seq.incrementBy != null) s += ' INCREMENT BY ' + seq.incrementBy;
        if (seq.maxValue != null) s += ' MAXVALUE ' + seq.maxValue;
        if (seq.cache != null) s += ' CACHE ' + seq.cache;
        // Oracle does not support RESTART, note it
        if (seq.restartWith != null) s += ' /* RESTART WITH ' + seq.restartWith + ' - Oracle 不支持 RESTART, 需 DROP/CREATE */';
        lines.push(s + ';');
      } else {
        let s = 'ALTER SEQUENCE ' + seq.name;
        if (seq.incrementBy != null) s += ' INCREMENT BY ' + seq.incrementBy;
        if (seq.maxValue != null) s += ' MAXVALUE ' + seq.maxValue;
        if (seq.cache != null) s += ' CACHE ' + seq.cache;
        if (seq.restartWith != null) s += ' RESTART WITH ' + seq.restartWith;
        lines.push(s + ';');
      }
    }
    lines.push('');
  }

  // --- ALTER TABLE MODIFY/ALTER COLUMN ---
  if (parsed.alterColumns.length) {
    lines.push('-- ========== ALTER COLUMN TYPE ==========');
    for (const ac of parsed.alterColumns) {
      const newType = convertExtraColType(ac.newType, ac.newLength, ac.newPrecision, ac.newScale, sourceDb, targetDb);
      if (targetDb === 'oracle') {
        lines.push('ALTER TABLE ' + ac.table + ' MODIFY (' + ac.column + ' ' + newType + ');');
      } else if (targetDb === 'mysql') {
        lines.push('ALTER TABLE ' + ac.table + ' MODIFY COLUMN ' + ac.column + ' ' + newType + ';');
      } else {
        lines.push('ALTER TABLE ' + ac.table + ' ALTER COLUMN ' + ac.column + ' TYPE ' + newType + ';');
      }
    }
    lines.push('');
  }

  // --- ALTER TABLE ADD COLUMN ---
  if (parsed.addColumns.length) {
    lines.push('-- ========== ADD COLUMN ==========');
    for (const ac of parsed.addColumns) {
      const newType = convertExtraColType(ac.type, ac.length, ac.precision, ac.scale, sourceDb, targetDb);
      let def = '';
      if (ac.defaultValue != null) def = ' DEFAULT ' + ac.defaultValue;
      let nullable = ac.nullable ? '' : ' NOT NULL';
      if (targetDb === 'oracle') {
        lines.push('ALTER TABLE ' + ac.table + ' ADD (' + ac.column + ' ' + newType + def + nullable + ');');
      } else if (targetDb === 'mysql') {
        lines.push('ALTER TABLE ' + ac.table + ' ADD COLUMN ' + ac.column + ' ' + newType + def + nullable + ';');
      } else {
        lines.push('ALTER TABLE ' + ac.table + ' ADD COLUMN ' + ac.column + ' ' + newType + def + nullable + ';');
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/* ===== MAIN CONVERT ===== */
function convertDDL(input, sourceDb, targetDb) {
  if (!input.trim()) return '-- 请输入 DDL 语句';
  if (input.length > 5 * 1024 * 1024) return '-- 输入内容过大（超过5MB），请分批处理';
  if (sourceDb === targetDb) return '-- 源数据库与目标数据库相同，无需转换';
  let tables;
  try {
    if (sourceDb === 'oracle') tables = parseOracleDDL(input);
    else if (sourceDb === 'mysql') tables = parseMySQLDDL(input);
    else if (sourceDb === 'postgresql') tables = parsePostgreSQLDDL(input);
    else return '-- 不支持的源数据库: ' + sourceDb;
  } catch (e) { return '-- 解析失败: ' + e.message + '\n-- 请检查输入的 DDL 语法是否正确'; }

  // Parse extra DDL (sequences, alter table, etc.)
  let extraParsed;
  try { extraParsed = parseExtraDDL(input, sourceDb); } catch(e) { extraParsed = { sequences: [], alterSequences: [], alterColumns: [], addColumns: [] }; }
  const hasExtra = extraParsed.sequences.length || extraParsed.alterSequences.length || extraParsed.alterColumns.length || extraParsed.addColumns.length;

  if ((!tables || !tables.length) && !hasExtra) return '-- 未识别到 CREATE TABLE 语句，请检查输入格式';

  let output = '';
  if (tables && tables.length) {
    try {
      if (targetDb === 'oracle') output = generateOracleDDL(tables, sourceDb);
      else if (targetDb === 'mysql') output = generateMySQLDDL(tables, sourceDb);
      else if (targetDb === 'postgresql') output = generatePostgreSQLDDL(tables, sourceDb);
      else return '-- 不支持的目标数据库: ' + targetDb;
    } catch (e) { return '-- 生成失败: ' + e.message; }
  }

  // Generate extra DDL
  let extraOutput = '';
  if (hasExtra) {
    try { extraOutput = generateExtraDDL(extraParsed, sourceDb, targetDb); } catch(e) { extraOutput = '-- 额外DDL生成失败: ' + e.message; }
  }

  const tableCount = (tables && tables.length) ? tables.length : 0;
  const header = '-- ============================================================\n'
    + '-- 自动生成: ' + DB_LABELS[sourceDb] + ' → ' + DB_LABELS[targetDb] + '\n'
    + '-- 表数量: ' + tableCount + (hasExtra ? ' (含序列/ALTER语句)' : '') + '\n'
    + '-- 生成时间: ' + new Date().toISOString().slice(0,19).replace('T',' ') + '\n'
    + '-- 请检查类型映射和分区语法是否符合目标库版本要求\n'
    + '-- ============================================================\n\n';

  let result = header;
  if (output) result += output;
  if (extraOutput) { if (output) result += '\n\n'; result += extraOutput; }
  return result;
}

/* ===== SHARED UTILITIES FOR FUNCTION & PROCEDURE ENGINES ===== */



/* ----- Storage, Transformation & Translation Engines ----- */

/* ===== localStorage persistence for rules ===== */
var _STORAGE_KEY_DDL  = 'ojw_ddlRules';
var _STORAGE_KEY_BODY = 'ojw_bodyRules';

var _persistError = '';
function _saveDdlRulesToStorage() {
  try { localStorage.setItem(_STORAGE_KEY_DDL, JSON.stringify(_ddlRulesData)); return true; }
  catch(e) { _persistError = e.message || '未知错误'; return false; }
}
function _saveBodyRulesToStorage() {
  var out = {};
  for (var k in _bodyRulesData) {
    out[k] = _bodyRulesData[k].map(function(r) { return { s: r.s, t: r.t }; });
  }
  try { localStorage.setItem(_STORAGE_KEY_BODY, JSON.stringify(out)); return true; }
  catch(e) { _persistError = e.message || '未知错误'; return false; }
}
function _persistRules() {
  _persistError = '';
  var a = _saveDdlRulesToStorage();
  var b = _saveBodyRulesToStorage();
  return a && b;
}

function _loadDdlRulesFromStorage() {
  try {
    var s = localStorage.getItem(_STORAGE_KEY_DDL);
    if (s) { var d = JSON.parse(s); if (d && typeof d === 'object') return d; }
  } catch(e) {}
  return null;
}
function _loadBodyRulesFromStorage() {
  try {
    var s = localStorage.getItem(_STORAGE_KEY_BODY);
    if (!s) return null;
    var saved = JSON.parse(s);
    if (!saved || typeof saved !== 'object') return null;
    var result = {};
    for (var pair in saved) {
      if (!_bodyRulesDefault[pair]) continue;
      var defLookup = {};
      _bodyRulesDefault[pair].forEach(function(r) {
        defLookup[r.s + '\x00' + r.t] = r;
      });
      result[pair] = saved[pair].map(function(sr) {
        var def = defLookup[sr.s + '\x00' + sr.t];
        if (def) return { s: sr.s, t: sr.t, fwd: def.fwd, rev: def.rev, typeFwd: def.typeFwd || null, typeRev: def.typeRev || null };
        return { s: sr.s, t: sr.t, fwd: null, rev: null };
      });
    }
    return result;
  } catch(e) {}
  return null;
}

// Hydrate from localStorage on script load
(function _hydrateRules() {
  var ddl = _loadDdlRulesFromStorage();
  if (ddl) { for (var k in ddl) { if (_ddlRulesData.hasOwnProperty(k)) _ddlRulesData[k] = ddl[k]; } }
  var body = _loadBodyRulesFromStorage();
  if (body) { for (var k in body) { if (_bodyRulesData.hasOwnProperty(k)) _bodyRulesData[k] = body[k]; } }
})();

/* ===== New rule-driven mapParamType ===== */
function mapParamType(typeStr, fromDb, toDb) {
  if (!typeStr) return typeStr;
  var t = typeStr.trim();
  // Handle %ROWTYPE (Oracle cursor row type)
  if (/%ROWTYPE\b/i.test(t)) {
    if (toDb === 'postgresql') return 'RECORD';
    if (toDb === 'mysql') return 'VARCHAR(4000) /* [\u6ce8\u610f: \u539f\u4e3a ' + t + ', MySQL \u65e0 %ROWTYPE] */';
    return t;
  }
  if (fromDb === toDb) return t;

  // Determine which rule category and direction to use
  var cats = _getTypeCategories(fromDb, toDb);
  for (var ci = 0; ci < cats.length; ci++) {
    var cat = cats[ci];
    var rules = _bodyRulesData[cat.name];
    if (!rules) continue;
    for (var ri = 0; ri < rules.length; ri++) {
      var fn = cat.forward ? rules[ri].typeFwd : rules[ri].typeRev;
      if (fn) t = fn(t);
    }
  }
  return t;
}

function _getTypeCategories(fromDb, toDb) {
  if (fromDb === 'oracle' && toDb === 'postgresql') return [{name:'oraclePg', forward:true}];
  if (fromDb === 'postgresql' && toDb === 'oracle') return [{name:'oraclePg', forward:false}];
  if (fromDb === 'oracle' && toDb === 'mysql') return [{name:'oracleMysql', forward:true}];
  if (fromDb === 'mysql' && toDb === 'oracle') return [{name:'oracleMysql', forward:false}];
  if (fromDb === 'mysql' && toDb === 'postgresql') return [{name:'mysqlPg', forward:true}];
  if (fromDb === 'postgresql' && toDb === 'mysql') return [{name:'mysqlPg', forward:false}];
  return [];
}

/* ===== New rule-driven transformBody ===== */
function transformBody(body, fromDb, toDb) {
  if (!body || fromDb === toDb) return body;
  var b = body;

  var cats = _getTypeCategories(fromDb, toDb);
  for (var ci = 0; ci < cats.length; ci++) {
    var cat = cats[ci];
    var rules = _bodyRulesData[cat.name];
    if (!rules) continue;
    for (var ri = 0; ri < rules.length; ri++) {
      var fn = cat.forward ? rules[ri].fwd : rules[ri].rev;
      if (fn) b = fn(b);
    }
  }
  return b;
}


/* --- Parameter parsers --- */

function _parseOracleParam(paramStr) {
  const s = paramStr.trim();
  if (!s) return null;
  const m = s.match(/^(\w+)\s+(IN\s+OUT|IN|OUT)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
  if (m) {
    return { name: m[1], direction: m[2].replace(/\s+/g, ' ').toUpperCase(), type: m[3].trim(), defaultVal: m[4] || null };
  }
  const m2 = s.match(/^(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
  if (!m2) return null;
  return { name: m2[1], direction: 'IN', type: m2[2].trim(), defaultVal: m2[3] || null };
}

function _parseMySQLParam(paramStr) {
  const s = paramStr.trim();
  if (!s) return null;
  const m = s.match(/^(IN\s*OUT|INOUT|IN|OUT)\s+(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
  if (m) {
    let dir = m[1].toUpperCase().replace(/\s+/g, ' ');
    if (dir === 'INOUT') dir = 'IN OUT';
    return { name: m[2], direction: dir, type: m[3].trim(), defaultVal: m[4] || null };
  }
  const m2 = s.match(/^(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
  if (!m2) return null;
  return { name: m2[1], direction: 'IN', type: m2[2].trim(), defaultVal: m2[3] || null };
}

function _parsePGParam(paramStr) {
  const s = paramStr.trim();
  if (!s) return null;
  // PG format can be: direction name type  OR  name direction type  OR  name type
  // Try direction-first: IN/OUT/INOUT name type
  const mDir = s.match(/^(IN\s*OUT|INOUT|IN|OUT)\s+(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
  if (mDir) {
    let dir = mDir[1].toUpperCase().replace(/\s+/g, ' ');
    if (dir === 'INOUT') dir = 'IN OUT';
    return { name: mDir[2], direction: dir, type: mDir[3].trim(), defaultVal: mDir[4] || null };
  }
  // Try name-first: name IN/OUT type
  const m = s.match(/^(\w+)\s+(IN\s*OUT|INOUT|IN|OUT)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
  if (m) {
    let dir2 = m[2].toUpperCase().replace(/\s+/g, ' ');
    if (dir2 === 'INOUT') dir2 = 'IN OUT';
    return { name: m[1], direction: dir2, type: m[3].trim(), defaultVal: m[4] || null };
  }
  // No direction: name type (OUT keyword as name is unlikely)
  const m2 = s.match(/^(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i);
  if (!m2) return null;
  return { name: m2[1], direction: 'IN', type: m2[2].trim(), defaultVal: m2[3] || null };
}

function _parseOracleVarDecl(declBlock) {
  const vars = [];
  if (!declBlock) return vars;
  const parts = declBlock.split(';');
  for (let i = 0; i < parts.length; i++) {
    const s = parts[i].trim();
    if (!s) continue;
    if (/^--/.test(s)) { vars.push({ raw: s + ';' }); continue; }
    // Detect cursor declarations: CURSOR name IS query
    const cursorMatch = s.match(/^CURSOR\s+(\w+)\s+IS\s+([\s\S]+)$/i);
    if (cursorMatch) {
      vars.push({ cursor: true, name: cursorMatch[1], query: cursorMatch[2].trim() });
      continue;
    }
    const m = s.match(/^(\w+)\s+(.+?)(?:\s*:=\s*(.+))?$/i);
    if (m) {
      vars.push({ name: m[1], type: m[2].trim(), defaultVal: m[3] ? m[3].trim() : null });
    } else {
      vars.push({ raw: s + ';' });
    }
  }
  return vars;
}

/* ===== FUNCTION TRANSLATION ENGINE ===== */

function convertFunction(input, sourceDb, targetDb) {
  if (!input || !input.trim()) return '-- 请在左侧输入区粘贴源函数定义';
  if (input.length > 5 * 1024 * 1024) return '-- 错误：输入超过5MB限制\n';
  if (sourceDb === targetDb) return '-- 源库与目标库相同 (' + DB_LABELS[sourceDb] + ')，无需翻译\n\n' + input.trim();

  const blocks = input.split(/\n(?=\s*CREATE\b)/i).filter(function(b) { return /\bCREATE\b/i.test(b); });
  const results = [];
  let errCount = 0;

  for (let i = 0; i < blocks.length; i++) {
    try {
      results.push(_convertSingleFunction(blocks[i].trim(), sourceDb, targetDb));
    } catch (e) {
      errCount++;
      results.push('-- 翻译失败: ' + e.message + '\n-- 原始代码:\n' + blocks[i].trim());
    }
  }

  const header = '-- 函数翻译: ' + DB_LABELS[sourceDb] + ' \u2192 ' + DB_LABELS[targetDb] +
    ' | 共 ' + results.length + ' 个函数' +
    (errCount > 0 ? ' (' + errCount + ' 个失败)' : '') +
    ' | ' + new Date().toISOString().slice(0,19).replace('T',' ') + '\n';

  return header + '\n' + results.join('\n\n');
}

function _convertSingleFunction(input, sourceDb, targetDb) {
  let parsed;
  if (sourceDb === 'oracle') parsed = _parseOracleFunction(input);
  else if (sourceDb === 'mysql') parsed = _parseMySQLFunction(input);
  else parsed = _parsePGFunction(input);

  if (!parsed) throw new Error('无法解析函数定义，请检查语法');

  const mappedParams = parsed.params.map(function(p) {
    return { name: p.name, direction: p.direction, type: mapParamType(p.type, sourceDb, targetDb), defaultVal: p.defaultVal };
  });
  const mappedReturnType = mapParamType(parsed.returnType, sourceDb, targetDb);
  const transformedBody = transformBody(parsed.body, sourceDb, targetDb);
  const mappedVars = parsed.vars.map(function(v) {
    if (v.raw) return v;
    if (v.cursor) return { cursor: true, name: v.name, query: transformBody(v.query, sourceDb, targetDb) };
    return { name: v.name, type: mapParamType(v.type, sourceDb, targetDb), defaultVal: v.defaultVal };
  });

  if (targetDb === 'oracle') return _genOracleFunction(parsed.name, mappedParams, mappedReturnType, mappedVars, transformedBody);
  if (targetDb === 'mysql') return _genMySQLFunction(parsed.name, mappedParams, mappedReturnType, mappedVars, transformedBody);
  return _genPGFunction(parsed.name, mappedParams, mappedReturnType, mappedVars, transformedBody);
}

/* --- Function parsers --- */

function _parseOracleFunction(input) {
  let src = input.replace(/\s*\/\s*$/, '').trim();
  // Strip trailing comments after the function body
  src = src.replace(/(\bEND\b\s*\w*\s*;?)\s*(?:\/\s*)?\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1');
  // Find CREATE FUNCTION name( handling nested parens in params
  const prefixRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s*\(/i;
  const pm = src.match(prefixRe);
  let name, paramStr, afterParams;
  if (pm) {
    name = pm[1];
    const paramStart = pm.index + pm[0].length;
    let depth = 1, pi = paramStart;
    while (pi < src.length && depth > 0) {
      if (src[pi] === '(') depth++;
      else if (src[pi] === ')') depth--;
      if (depth > 0) pi++;
    }
    paramStr = src.substring(paramStart, pi);
    afterParams = src.substring(pi + 1).trim();
  } else {
    // Try parameterless function: CREATE [OR REPLACE] FUNCTION name RETURN ...
    const noParen = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s+/i;
    const npm = src.match(noParen);
    if (!npm) throw new Error('无法解析Oracle函数头');
    name = npm[1];
    paramStr = '';
    afterParams = src.substring(npm.index + npm[0].length).trim();
  }
  // Match RETURN type IS|AS
  const returnRe = /^RETURN\s+(\S+(?:\s*\([^)]*\))?)\s+(IS|AS)\b/i;
  const rm = afterParams.match(returnRe);
  if (!rm) throw new Error('无法解析Oracle函数头 RETURN');
  const returnType = rm[1];
  const afterHeader = afterParams.substring(rm[0].length);
  const beginIdx = afterHeader.search(/\bBEGIN\b/i);
  let declBlock = '', bodyPart = afterHeader;
  if (beginIdx >= 0) { declBlock = afterHeader.substring(0, beginIdx).trim(); bodyPart = afterHeader.substring(beginIdx); }
  const params = _splitParamList(paramStr).map(_parseOracleParam).filter(Boolean);
  const vars = _parseOracleVarDecl(declBlock);
  const bodyMatch = bodyPart.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i);
  const body = bodyMatch ? bodyMatch[1] : bodyPart;
  return { name: name, params: params, returnType: returnType, vars: vars, body: body };
}

function _parseMySQLFunction(input) {
  let src = input.replace(/^\s*DELIMITER\s+\S+\s*$/gim, '').trim();
  src = src.replace(/\$\$/g, '').trim();
  // Strip trailing comments that come after END
  src = src.replace(/(\bEND\b\s*\w*\s*;?)\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1');
  // Find CREATE FUNCTION name( and extract params handling nested parens
  const prefixRe = /CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?FUNCTION\s+(\w+)\s*\(/i;
  const pm = src.match(prefixRe);
  if (!pm) throw new Error('无法解析MySQL函数头');
  const name = pm[1];
  const paramStart = pm.index + pm[0].length;
  // Find matching closing paren
  let depth = 1, pi = paramStart;
  while (pi < src.length && depth > 0) {
    if (src[pi] === '(') depth++;
    else if (src[pi] === ')') depth--;
    if (depth > 0) pi++;
  }
  const paramStr = src.substring(paramStart, pi);
  const afterParams = src.substring(pi + 1).trim();
  // Match RETURNS type and optional keywords
  const returnsRe = /^RETURNS\s+(\S+(?:\s*\([^)]*\))?)\s*(?:DETERMINISTIC\s*)?(?:READS\s+SQL\s+DATA\s*)?(?:CONTAINS\s+SQL\s*)?(?:NO\s+SQL\s*)?(?:MODIFIES\s+SQL\s+DATA\s*)?/i;
  const rm = afterParams.match(returnsRe);
  if (!rm) throw new Error('无法解析MySQL函数头 RETURNS');
  const returnType = rm[1];
  const afterHeader = afterParams.substring(rm[0].length);
  const bodyMatch = afterHeader.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i);
  if (!bodyMatch) throw new Error('无法找到MySQL函数体 BEGIN...END');
  const bodyContent = bodyMatch[1];
  const vars = [], bodyLines = bodyContent.split('\n'), nonDeclLines = [];
  for (let i = 0; i < bodyLines.length; i++) {
    // Skip DECLARE HANDLER and DECLARE CURSOR lines (keep in body for transformBody)
    if (/^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER\b/i.test(bodyLines[i]) ||
        /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(bodyLines[i])) {
      nonDeclLines.push(bodyLines[i]);
      continue;
    }
    const declMatch = bodyLines[i].match(/^\s*DECLARE\s+(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+?))?\s*;\s*$/i);
    if (declMatch) {
      vars.push({ name: declMatch[1], type: declMatch[2].trim(), defaultVal: declMatch[3] ? declMatch[3].trim() : null });
    } else { nonDeclLines.push(bodyLines[i]); }
  }
  const params = _splitParamList(paramStr).map(_parseMySQLParam).filter(Boolean);
  return { name: name, params: params, returnType: returnType, vars: vars, body: nonDeclLines.join('\n') };
}

function _parsePGFunction(input) {
  let src = input.trim();
  // Strip trailing comments
  src = src.replace(/(\$\$\s*;?)\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1');
  // Find CREATE FUNCTION name( with nested paren handling
  const prefixRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s*\(/i;
  const pm = src.match(prefixRe);
  if (!pm) throw new Error('无法解析PostgreSQL函数头');
  const name = pm[1];
  const paramStart = pm.index + pm[0].length;
  let depth = 1, pi = paramStart;
  while (pi < src.length && depth > 0) {
    if (src[pi] === '(') depth++;
    else if (src[pi] === ')') depth--;
    if (depth > 0) pi++;
  }
  const paramStr = src.substring(paramStart, pi);
  const afterParams = src.substring(pi + 1).trim();
  // Match RETURNS type ... AS $$  or  RETURNS type LANGUAGE ... AS $$
  let returnsRe = /^RETURNS\s+(\S+(?:\s*\([^)]*\))?)\s*(?:LANGUAGE\s+\w+\s*)?AS\s*\$\$/i;
  let rm = afterParams.match(returnsRe);
  if (!rm) {
    // Try: RETURNS type AS $$ ... LANGUAGE
    returnsRe = /^RETURNS\s+(\S+(?:\s*\([^)]*\))?)\s*AS\s*\$\$/i;
    rm = afterParams.match(returnsRe);
    if (!rm) throw new Error('无法解析PostgreSQL函数头 RETURNS');
  }
  const returnType = rm[1];
  const afterHeader = afterParams.substring(rm[0].length);
  let inner = afterHeader.replace(/\$\$\s*;?\s*$/g, '').replace(/\bLANGUAGE\s+\w+\s*;?\s*$/gi, '').trim();
  inner = inner.replace(/\$\$\s*LANGUAGE\s+\w+\s*;?\s*$/gi, '').trim();
  const vars = [];
  const declareMatch = inner.match(/\bDECLARE\b([\s\S]*?)\bBEGIN\b/i);
  if (declareMatch) {
    const declParts = declareMatch[1].split(';');
    for (let i = 0; i < declParts.length; i++) {
      const s = declParts[i].trim();
      if (!s) continue;
      // Check for cursor declaration: name CURSOR FOR query
      const cursorMatch = s.match(/^(\w+)\s+CURSOR\s+FOR\s+([\s\S]+)$/i);
      if (cursorMatch) {
        vars.push({ name: cursorMatch[1], cursor: true, query: cursorMatch[2].trim(), type: 'CURSOR' });
        continue;
      }
      const vm = s.match(/^(\w+)\s+(.+?)(?:\s*:=\s*(.+))?$/i);
      if (vm) vars.push({ name: vm[1], type: vm[2].trim(), defaultVal: vm[3] ? vm[3].trim() : null });
    }
  }
  const bodyMatch = inner.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*;?\s*$/i);
  const body = bodyMatch ? bodyMatch[1] : inner;
  const params = _splitParamList(paramStr).map(_parsePGParam).filter(Boolean);
  return { name: name, params: params, returnType: returnType, vars: vars, body: body };
}

/* --- Function generators --- */

function _genOracleFunction(name, params, returnType, vars, body) {
  let out = 'CREATE OR REPLACE FUNCTION ' + name + '(\n';
  const pLines = params.map(function(p) {
    let line = '  ' + p.name;
    line += ' ' + (p.direction || 'IN');
    line += ' ' + p.type;
    if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal;
    return line;
  });
  out += pLines.join(',\n') + ')\nRETURN ' + returnType + '\nIS\n';
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i];
    if (v.raw) { out += '  ' + v.raw + '\n'; continue; }
    if (v.cursor) { out += '  CURSOR ' + v.name + ' IS ' + v.query + ';\n'; continue; }
    out += '  ' + v.name + ' ' + v.type;
    if (v.defaultVal) out += ' := ' + v.defaultVal;
    out += ';\n';
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '');
  // Remove any leading BEGIN if body already has it
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '');
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/,'') + '\n';
  // Ensure proper END
  if (!/\bEND\b/i.test(out.split('BEGIN').pop())) out += 'END;\n';
  else out = out.replace(/\bEND\b\s*\w*\s*;?\s*$/i, 'END;\n');
  out += '/';
  return out;
}

function _genMySQLFunction(name, params, returnType, vars, body) {
  let out = 'DELIMITER $$\nCREATE FUNCTION ' + name + '(\n';
  const filteredParams = [];
  let hasOutNote = false;
  for (let i = 0; i < params.length; i++) {
    if (params[i].direction === 'OUT' || params[i].direction === 'IN OUT') { hasOutNote = true; continue; }
    filteredParams.push(params[i]);
  }
  const pLines = filteredParams.map(function(p) { return '  ' + p.name + ' ' + p.type; });
  out += pLines.join(',\n') + ')\nRETURNS ' + returnType + '\nDETERMINISTIC\nBEGIN\n';
  if (hasOutNote) out += '  -- 注意: MySQL函数不支持OUT参数，已移除OUT/IN OUT参数\n';
  for (let j = 0; j < vars.length; j++) {
    const v = vars[j];
    if (v.raw) { out += '  ' + v.raw + '\n'; continue; }
    if (v.cursor) { out += '  DECLARE ' + v.name + ' CURSOR FOR ' + v.query + ';\n'; continue; }
    out += '  DECLARE ' + v.name + ' ' + v.type;
    if (v.defaultVal) out += ' DEFAULT ' + v.defaultVal;
    out += ';\n';
  }
  // Clean body: remove leading/trailing whitespace and any extra BEGIN
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '').replace(/^\s*BEGIN\b/i, '');
  // MySQL requires all DECLARE at top of BEGIN block - extract DECLAREs from body
  // Handle DECLARE EXIT/CONTINUE HANDLER ... BEGIN...END; as a multi-line block
  const bodyDeclares = [];
  const bodyOther = [];
  const bodyLines = cleanBody.replace(/^\n+/,'').split('\n');
  let inHandler = false;
  let handlerDepth = 0;
  let handlerLines = [];
  for (let li = 0; li < bodyLines.length; li++) {
    const line = bodyLines[li];
    if (inHandler) {
      handlerLines.push(line);
      if (/\bBEGIN\b/i.test(line)) handlerDepth++;
      if (/\bEND\b\s*;/i.test(line)) {
        handlerDepth--;
        if (handlerDepth <= 0) {
          bodyDeclares.push(handlerLines.join('\n'));
          handlerLines = [];
          inHandler = false;
        }
      }
    } else if (/^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+/i.test(line)) {
      // Check if single-line handler (no BEGIN block, ends with ;)
      if (/;\s*$/.test(line) && !/\bBEGIN\b/i.test(line)) {
        bodyDeclares.push(line);
      } else {
        inHandler = true;
        handlerDepth = 0;
        handlerLines = [line];
        if (/\bBEGIN\b/i.test(line)) handlerDepth++;
        if (/\bEND\b\s*;/i.test(line)) {
          bodyDeclares.push(handlerLines.join('\n'));
          handlerLines = [];
          inHandler = false;
        }
      }
    } else if (/^\s*DECLARE\s+/i.test(line)) {
      bodyDeclares.push(line);
    } else {
      bodyOther.push(line);
    }
  }
  if (bodyDeclares.length > 0) {
    // Sort: variables first, cursors second, handlers last (MySQL requirement)
    bodyDeclares.sort(function(a, b) {
      var aIsHandler = /^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(a);
      var bIsHandler = /^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(b);
      var aIsCursor = /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(a);
      var bIsCursor = /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(b);
      var aOrder = aIsHandler ? 2 : (aIsCursor ? 1 : 0);
      var bOrder = bIsHandler ? 2 : (bIsCursor ? 1 : 0);
      return aOrder - bOrder;
    });
    out += bodyDeclares.join('\n') + '\n';
  }
  out += bodyOther.join('\n') + '\n';
  // Ensure it ends with END$$
  out = out.replace(/\s+$/, '\n');
  // Remove any trailing END with name (not inside comments), normalize
  // First strip trailing comment-only lines
  out = out.replace(/(\n\s*--[^\n]*)+\s*$/g, '\n');
  out = out.replace(/\bEND\b\s*\w*\s*;\s*(?:\/\s*)?\s*$/i, '');
  out += 'END$$\n';
  out += 'DELIMITER ;';
  return out;
}

function _genPGFunction(name, params, returnType, vars, body) {
  let out = 'CREATE OR REPLACE FUNCTION ' + name + '(\n';
  const pLines = params.map(function(p) {
    let line = '  ' + p.name;
    if (p.direction) line += ' ' + p.direction;
    line += ' ' + p.type;
    if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal;
    return line;
  });
  out += pLines.join(',\n') + ')\nRETURNS ' + returnType + '\nLANGUAGE plpgsql\nAS $$\n';
  // Detect FOR loop variables that need RECORD declarations
  var forVarRe = /\bFOR\s+(\w+)\s+IN\b/gi;
  var forVarMatch, forVarNames = [];
  while ((forVarMatch = forVarRe.exec(body)) !== null) {
    var fvn = forVarMatch[1].toUpperCase();
    // Skip numeric FOR (already has a counter variable, not a record)
    var afterFor = body.substring(forVarMatch.index + forVarMatch[0].length, forVarMatch.index + forVarMatch[0].length + 20);
    if (/^\s*\d/.test(afterFor) || /^\s*REVERSE\b/i.test(afterFor)) continue;
    if (forVarNames.indexOf(fvn) < 0) forVarNames.push(fvn);
  }
  // Extract cursor declarations from body and move to DECLARE section (for MySQL->PG)
  var cursorDecls = [];
  body = body.replace(/(^|\n)\s*(\w+)\s+CURSOR\s+FOR\s+([\s\S]*?);/gim, function(m, pre, curName, curQuery) {
    cursorDecls.push({ name: curName, query: curQuery.trim() });
    return pre;
  });
  var needsDeclare = vars.length > 0 || body.indexOf('_pg_rowcount') >= 0 || forVarNames.length > 0 || cursorDecls.length > 0;
  if (needsDeclare) {
    out += 'DECLARE\n';
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i];
      if (v.raw) { out += '  ' + v.raw + '\n'; continue; }
      if (v.cursor) { out += '  ' + v.name + ' CURSOR FOR ' + v.query + ';\n'; continue; }
      out += '  ' + v.name + ' ' + v.type;
      if (v.defaultVal) out += ' := ' + v.defaultVal;
      out += ';\n';
    }
    for (var ci = 0; ci < cursorDecls.length; ci++) {
      out += '  ' + cursorDecls[ci].name + ' CURSOR FOR ' + cursorDecls[ci].query + ';\n';
    }
    if (body.indexOf('_pg_rowcount') >= 0) out += '  _pg_rowcount BIGINT;\n';
    for (var fi = 0; fi < forVarNames.length; fi++) {
      // Only add if not already declared
      var alreadyDeclared = vars.some(function(v) { return v.name && v.name.toUpperCase() === forVarNames[fi]; });
      if (!alreadyDeclared) out += '  ' + forVarNames[fi] + ' RECORD;\n';
    }
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '');
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '');
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/,'') + '\n';
  // Ensure the function body ends with END; before $$;
  var trimmedOut = out.replace(/\s+$/, '');
  if (/\bEND\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut + '\n$$;';
  } else if (/\bEND\b\s*\w+\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut.replace(/\bEND\b\s*\w+\s*;?\s*$/i, 'END;') + '\n$$;';
  } else {
    out = trimmedOut + '\nEND;\n$$;';
  }
  return out;
}

/* ===== STORED PROCEDURE TRANSLATION ENGINE ===== */

function convertProcedure(input, sourceDb, targetDb) {
  if (!input || !input.trim()) return '-- 请在左侧输入区粘贴源存储过程定义';
  if (input.length > 5 * 1024 * 1024) return '-- 错误：输入超过5MB限制\n';
  if (sourceDb === targetDb) return '-- 源库与目标库相同 (' + DB_LABELS[sourceDb] + ')，无需翻译\n\n' + input.trim();

  const blocks = input.split(/\n(?=\s*CREATE\b)/i).filter(function(b) { return /\bCREATE\b/i.test(b); });
  const results = [];
  let errCount = 0;

  for (let i = 0; i < blocks.length; i++) {
    try {
      results.push(_convertSingleProcedure(blocks[i].trim(), sourceDb, targetDb));
    } catch (e) {
      errCount++;
      results.push('-- 翻译失败: ' + e.message + '\n-- 原始代码:\n' + blocks[i].trim());
    }
  }

  const header = '-- 存储过程翻译: ' + DB_LABELS[sourceDb] + ' \u2192 ' + DB_LABELS[targetDb] +
    ' | 共 ' + results.length + ' 个存储过程' +
    (errCount > 0 ? ' (' + errCount + ' 个失败)' : '') +
    ' | ' + new Date().toISOString().slice(0,19).replace('T',' ') + '\n';

  return header + '\n' + results.join('\n\n');
}

function _convertSingleProcedure(input, sourceDb, targetDb) {
  let parsed;
  if (sourceDb === 'oracle') parsed = _parseOracleProcedure(input);
  else if (sourceDb === 'mysql') parsed = _parseMySQLProcedure(input);
  else parsed = _parsePGProcedure(input);

  if (!parsed) throw new Error('无法解析存储过程定义，请检查语法');

  const mappedParams = parsed.params.map(function(p) {
    return { name: p.name, direction: p.direction, type: mapParamType(p.type, sourceDb, targetDb), defaultVal: p.defaultVal };
  });
  const transformedBody = transformBody(parsed.body, sourceDb, targetDb);
  const mappedVars = parsed.vars.map(function(v) {
    if (v.raw) return v;
    if (v.cursor) return { cursor: true, name: v.name, query: transformBody(v.query, sourceDb, targetDb) };
    return { name: v.name, type: mapParamType(v.type, sourceDb, targetDb), defaultVal: v.defaultVal };
  });

  if (targetDb === 'oracle') return _genOracleProcedure(parsed.name, mappedParams, mappedVars, transformedBody);
  if (targetDb === 'mysql') return _genMySQLProcedure(parsed.name, mappedParams, mappedVars, transformedBody);
  return _genPGProcedure(parsed.name, mappedParams, mappedVars, transformedBody);
}

/* --- Procedure parsers --- */

function _parseOracleProcedure(input) {
  let src = input.replace(/\s*\/\s*$/, '').trim();
  src = src.replace(/(\bEND\b\s*\w*\s*;?)\s*(?:\/\s*)?\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1');
  // Try to find CREATE PROCEDURE name(
  const prefixRe = /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)\s*\(/i;
  const pm = src.match(prefixRe);
  if (!pm) {
    // Try without params
    const headerRe2 = /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)\s*(IS|AS)\b/i;
    const m2 = src.match(headerRe2);
    if (!m2) throw new Error('无法解析Oracle存储过程头');
    const name = m2[1];
    const afterHeader = src.substring(m2.index + m2[0].length);
    const beginIdx = afterHeader.search(/\bBEGIN\b/i);
    let declBlock = '', bodyPart = afterHeader;
    if (beginIdx >= 0) { declBlock = afterHeader.substring(0, beginIdx).trim(); bodyPart = afterHeader.substring(beginIdx); }
    const vars = _parseOracleVarDecl(declBlock);
    const bodyMatch = bodyPart.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i);
    const body = bodyMatch ? bodyMatch[1] : bodyPart;
    return { name: name, params: [], vars: vars, body: body };
  }
  const name = pm[1];
  const paramStart = pm.index + pm[0].length;
  let depth = 1, pi = paramStart;
  while (pi < src.length && depth > 0) {
    if (src[pi] === '(') depth++;
    else if (src[pi] === ')') depth--;
    if (depth > 0) pi++;
  }
  const paramStr = src.substring(paramStart, pi);
  const afterParams = src.substring(pi + 1).trim();
  // Match IS|AS
  const isAsRe = /^\s*(IS|AS)\b/i;
  const iam = afterParams.match(isAsRe);
  if (!iam) throw new Error('无法解析Oracle存储过程头 IS/AS');
  const afterHeader = afterParams.substring(iam[0].length);
  const beginIdx = afterHeader.search(/\bBEGIN\b/i);
  let declBlock = '', bodyPart = afterHeader;
  if (beginIdx >= 0) { declBlock = afterHeader.substring(0, beginIdx).trim(); bodyPart = afterHeader.substring(beginIdx); }
  const params = _splitParamList(paramStr).map(_parseOracleParam).filter(Boolean);
  const vars = _parseOracleVarDecl(declBlock);
  const bodyMatch = bodyPart.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i);
  const body = bodyMatch ? bodyMatch[1] : bodyPart;
  return { name: name, params: params, vars: vars, body: body };
}

function _parseMySQLProcedure(input) {
  let src = input.replace(/^\s*DELIMITER\s+\S+\s*$/gim, '').trim();
  src = src.replace(/\$\$/g, '').trim();
  src = src.replace(/(\bEND\b\s*\w*\s*;?)\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1');
  // Find CREATE PROCEDURE name( and extract params handling nested parens
  const prefixRe = /CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?PROCEDURE\s+(\w+)\s*\(/i;
  const pm = src.match(prefixRe);
  if (!pm) throw new Error('无法解析MySQL存储过程头');
  const name = pm[1];
  const paramStart = pm.index + pm[0].length;
  let depth = 1, pi = paramStart;
  while (pi < src.length && depth > 0) {
    if (src[pi] === '(') depth++;
    else if (src[pi] === ')') depth--;
    if (depth > 0) pi++;
  }
  const paramStr = src.substring(paramStart, pi);
  const afterHeader = src.substring(pi + 1).trim();
  const bodyMatch = afterHeader.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i);
  if (!bodyMatch) throw new Error('无法找到MySQL存储过程体 BEGIN...END');
  const bodyContent = bodyMatch[1];
  const vars = [], bodyLines = bodyContent.split('\n'), nonDeclLines = [];
  for (let i = 0; i < bodyLines.length; i++) {
    // Skip DECLARE HANDLER and DECLARE CURSOR lines (keep in body for transformBody)
    if (/^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER\b/i.test(bodyLines[i]) ||
        /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(bodyLines[i])) {
      nonDeclLines.push(bodyLines[i]);
      continue;
    }
    const declMatch = bodyLines[i].match(/^\s*DECLARE\s+(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+?))?\s*;\s*$/i);
    if (declMatch) {
      vars.push({ name: declMatch[1], type: declMatch[2].trim(), defaultVal: declMatch[3] ? declMatch[3].trim() : null });
    } else { nonDeclLines.push(bodyLines[i]); }
  }
  const params = _splitParamList(paramStr).map(_parseMySQLParam).filter(Boolean);
  return { name: name, params: params, vars: vars, body: nonDeclLines.join('\n') };
}

function _parsePGProcedure(input) {
  let src = input.trim();
  src = src.replace(/(\$\$\s*;?)\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1');
  // Find CREATE PROCEDURE name( with nested paren handling
  const prefixRe = /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)\s*\(/i;
  const pm = src.match(prefixRe);
  if (!pm) throw new Error('无法解析PostgreSQL存储过程头');
  const name = pm[1];
  const paramStart = pm.index + pm[0].length;
  let depth = 1, pi = paramStart;
  while (pi < src.length && depth > 0) {
    if (src[pi] === '(') depth++;
    else if (src[pi] === ')') depth--;
    if (depth > 0) pi++;
  }
  const paramStr = src.substring(paramStart, pi);
  const afterParams = src.substring(pi + 1).trim();
  // Match LANGUAGE ... AS $$ or just AS $$
  let asRe = /^(?:LANGUAGE\s+\w+\s*)?AS\s*\$\$/i;
  let am = afterParams.match(asRe);
  if (!am) {
    asRe = /^AS\s*\$\$/i;
    am = afterParams.match(asRe);
    if (!am) throw new Error('无法解析PostgreSQL存储过程头 AS $$');
  }
  const afterHeader = afterParams.substring(am[0].length);
  let inner = afterHeader.replace(/\$\$\s*;?\s*$/g, '').replace(/\bLANGUAGE\s+\w+\s*;?\s*$/gi, '').trim();
  inner = inner.replace(/\$\$\s*LANGUAGE\s+\w+\s*;?\s*$/gi, '').trim();
  const vars = [];
  const declareMatch = inner.match(/\bDECLARE\b([\s\S]*?)\bBEGIN\b/i);
  if (declareMatch) {
    const declParts = declareMatch[1].split(';');
    for (let i = 0; i < declParts.length; i++) {
      const s = declParts[i].trim();
      if (!s) continue;
      // Check for cursor declaration: name CURSOR FOR query
      const cursorMatch = s.match(/^(\w+)\s+CURSOR\s+FOR\s+([\s\S]+)$/i);
      if (cursorMatch) {
        vars.push({ name: cursorMatch[1], cursor: true, query: cursorMatch[2].trim(), type: 'CURSOR' });
        continue;
      }
      const vm = s.match(/^(\w+)\s+(.+?)(?:\s*:=\s*(.+))?$/i);
      if (vm) vars.push({ name: vm[1], type: vm[2].trim(), defaultVal: vm[3] ? vm[3].trim() : null });
    }
  }
  const bodyMatch = inner.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*;?\s*$/i);
  const body = bodyMatch ? bodyMatch[1] : inner;
  const params = _splitParamList(paramStr).map(_parsePGParam).filter(Boolean);
  return { name: name, params: params, vars: vars, body: body };
}

/* --- Procedure generators --- */

function _genOracleProcedure(name, params, vars, body) {
  let out = 'CREATE OR REPLACE PROCEDURE ' + name;
  if (params.length > 0) {
    out += '(\n';
    const pLines = params.map(function(p) {
      let line = '  ' + p.name;
      line += ' ' + (p.direction || 'IN');
      line += ' ' + p.type;
      if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal;
      return line;
    });
    out += pLines.join(',\n') + ')\n';
  } else {
    out += '\n';
  }
  out += 'IS\n';
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i];
    if (v.raw) { out += '  ' + v.raw + '\n'; continue; }
    if (v.cursor) { out += '  CURSOR ' + v.name + ' IS ' + v.query + ';\n'; continue; }
    out += '  ' + v.name + ' ' + v.type;
    if (v.defaultVal) out += ' := ' + v.defaultVal;
    out += ';\n';
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '');
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '');
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/,'') + '\n';
  if (!/\bEND\b/i.test(out.split('BEGIN').pop())) out += 'END;\n';
  else out = out.replace(/\bEND\b\s*\w*\s*;?\s*$/i, 'END;\n');
  out += '/';
  return out;
}

function _genMySQLProcedure(name, params, vars, body) {
  let out = 'DELIMITER $$\nCREATE PROCEDURE ' + name + '(\n';
  const pLines = params.map(function(p) {
    let dir = p.direction || 'IN';
    if (dir === 'IN OUT') dir = 'INOUT';
    return '  ' + dir + ' ' + p.name + ' ' + p.type;
  });
  out += pLines.join(',\n') + ')\nBEGIN\n';
  // Collect all declarations from vars
  var allDeclares = [];
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i];
    if (v.raw) {
      allDeclares.push('  ' + v.raw);
      continue;
    }
    if (v.cursor) { allDeclares.push('  DECLARE ' + v.name + ' CURSOR FOR ' + v.query + ';'); continue; }
    var decl = '  DECLARE ' + v.name + ' ' + v.type;
    if (v.defaultVal) decl += ' DEFAULT ' + v.defaultVal;
    decl += ';';
    allDeclares.push(decl);
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '').replace(/^\s*BEGIN\b/i, '');
  // MySQL requires all DECLARE at top of BEGIN block - extract DECLAREs from body
  // Handle DECLARE EXIT/CONTINUE HANDLER ... BEGIN...END; as a multi-line block
  const bodyOther = [];
  const bodyLines = cleanBody.replace(/^\n+/,'').split('\n');
  let inHandler = false;
  let handlerDepth = 0;
  let handlerLines = [];
  for (let li = 0; li < bodyLines.length; li++) {
    const line = bodyLines[li];
    if (inHandler) {
      handlerLines.push(line);
      if (/\bBEGIN\b/i.test(line)) handlerDepth++;
      if (/\bEND\b\s*;/i.test(line)) {
        handlerDepth--;
        if (handlerDepth <= 0) {
          allDeclares.push(handlerLines.join('\n'));
          handlerLines = [];
          inHandler = false;
        }
      }
    } else if (/^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+/i.test(line)) {
      if (/;\s*$/.test(line) && !/\bBEGIN\b/i.test(line)) {
        allDeclares.push(line);
      } else {
        inHandler = true;
        handlerDepth = 0;
        handlerLines = [line];
        if (/\bBEGIN\b/i.test(line)) handlerDepth++;
        if (/\bEND\b\s*;/i.test(line)) {
          allDeclares.push(handlerLines.join('\n'));
          handlerLines = [];
          inHandler = false;
        }
      }
    } else if (/^\s*DECLARE\s+/i.test(line)) {
      allDeclares.push(line);
    } else {
      bodyOther.push(line);
    }
  }
  // MySQL requires: variable DECLAREs, then cursor DECLAREs, then handler DECLAREs
  if (allDeclares.length > 0) {
    allDeclares.sort(function(a, b) {
      var aIsHandler = /DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(a);
      var bIsHandler = /DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(b);
      var aIsCursor = /DECLARE\s+\w+\s+CURSOR\b/i.test(a) || /\bCURSOR\s+\w+\s+IS\b/i.test(a);
      var bIsCursor = /DECLARE\s+\w+\s+CURSOR\b/i.test(b) || /\bCURSOR\s+\w+\s+IS\b/i.test(b);
      var aOrder = aIsHandler ? 2 : (aIsCursor ? 1 : 0);
      var bOrder = bIsHandler ? 2 : (bIsCursor ? 1 : 0);
      return aOrder - bOrder;
    });
    out += allDeclares.join('\n') + '\n';
  }
  out += bodyOther.join('\n') + '\n';
  // Strip trailing comment-only lines
  out = out.replace(/(\n\s*--[^\n]*)+\s*$/g, '\n');
  out = out.replace(/\s+$/, '\n');
  // Strip trailing END name; (but not inside comments)
  out = out.replace(/\bEND\b\s*\w*\s*;\s*(?:\/\s*)?$/i, '');
  out += 'END$$\n';
  out += 'DELIMITER ;';
  return out;
}

function _genPGProcedure(name, params, vars, body) {
  // PG requires OUT params not to appear after params with DEFAULT values
  // Sort: params without default first, then OUT params, then params with default
  var sortedParams = params.slice().sort(function(a, b) {
    var aIsOut = (a.direction || '').toUpperCase() === 'OUT' || (a.direction || '').toUpperCase() === 'INOUT';
    var bIsOut = (b.direction || '').toUpperCase() === 'OUT' || (b.direction || '').toUpperCase() === 'INOUT';
    var aHasDefault = !!a.defaultVal;
    var bHasDefault = !!b.defaultVal;
    // Order: IN without default, OUT, IN with default
    var aOrder = aIsOut ? 1 : (aHasDefault ? 2 : 0);
    var bOrder = bIsOut ? 1 : (bHasDefault ? 2 : 0);
    return aOrder - bOrder;
  });
  let out = 'CREATE OR REPLACE PROCEDURE ' + name + '(\n';
  const pLines = sortedParams.map(function(p) {
    let line = '  ' + p.name;
    if (p.direction) line += ' ' + p.direction;
    line += ' ' + p.type;
    if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal;
    return line;
  });
  out += pLines.join(',\n') + ')\nLANGUAGE plpgsql\nAS $$\n';
  // Detect FOR loop variables that need RECORD declarations
  var forVarRe = /\bFOR\s+(\w+)\s+IN\b/gi;
  var forVarMatch, forVarNames = [];
  while ((forVarMatch = forVarRe.exec(body)) !== null) {
    var fvn = forVarMatch[1].toUpperCase();
    var afterFor = body.substring(forVarMatch.index + forVarMatch[0].length, forVarMatch.index + forVarMatch[0].length + 20);
    if (/^\s*\d/.test(afterFor) || /^\s*REVERSE\b/i.test(afterFor)) continue;
    if (forVarNames.indexOf(fvn) < 0) forVarNames.push(fvn);
  }
  // Extract cursor declarations from body and move to DECLARE section (for MySQL->PG)
  var cursorDecls = [];
  body = body.replace(/(^|\n)\s*(\w+)\s+CURSOR\s+FOR\s+([\s\S]*?);/gim, function(m, pre, curName, curQuery) {
    cursorDecls.push({ name: curName, query: curQuery.trim() });
    return pre;
  });
  var needsDeclare = vars.length > 0 || body.indexOf('_pg_rowcount') >= 0 || forVarNames.length > 0 || cursorDecls.length > 0;
  if (needsDeclare) {
    out += 'DECLARE\n';
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i];
      if (v.raw) { out += '  ' + v.raw + '\n'; continue; }
      if (v.cursor) { out += '  ' + v.name + ' CURSOR FOR ' + v.query + ';\n'; continue; }
      out += '  ' + v.name + ' ' + v.type;
      if (v.defaultVal) out += ' := ' + v.defaultVal;
      out += ';\n';
    }
    for (var ci = 0; ci < cursorDecls.length; ci++) {
      out += '  ' + cursorDecls[ci].name + ' CURSOR FOR ' + cursorDecls[ci].query + ';\n';
    }
    if (body.indexOf('_pg_rowcount') >= 0) out += '  _pg_rowcount BIGINT;\n';
    for (var fi = 0; fi < forVarNames.length; fi++) {
      var alreadyDeclared = vars.some(function(v) { return v.name && v.name.toUpperCase() === forVarNames[fi]; });
      if (!alreadyDeclared) out += '  ' + forVarNames[fi] + ' RECORD;\n';
    }
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '');
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '');
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/,'') + '\n';
  // Ensure the procedure body ends with END; before $$;
  var trimmedOut = out.replace(/\s+$/, '');
  if (/\bEND\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut + '\n$$;';
  } else if (/\bEND\b\s*\w+\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut.replace(/\bEND\b\s*\w+\s*;?\s*$/i, 'END;') + '\n$$;';
  } else {
    out = trimmedOut + '\nEND;\n$$;';
  }
  return out;
}

export { convertDDL, convertFunction, convertProcedure };

