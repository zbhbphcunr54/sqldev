/* ===== app.js — 核心解析引擎 + Vue 应用 ===== */

/* ----- IR (Intermediate Representation) ----- */
/* ===== IR (Intermediate Representation) ===== */
function makeTable() {
  return { name:'', comment:'', columns:[], primaryKey:null, uniqueKeys:[], indexes:[], foreignKeys:[], partition:null, extra:{} };
}
function makeColumn() {
  return { name:'', type:'', precision:null, scale:null, length:null, nullable:true, defaultValue:null, comment:'', autoIncrement:false, rawType:'', extra:{} };
}
function makeView() {
  return { name:'', columns:[], query:'', comment:'', withCheckOption:false, checkOptionType:null, readOnly:false, orReplace:true, force:false, algorithm:null };
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
  var onUpdateMatch = rest.match(/\bON\s+UPDATE\s+(\S+(?:\(\d*\))?)/i);
  if (onUpdateMatch) { col.extra.onUpdate = onUpdateMatch[1]; }
  rest = rest.replace(/\bON\s+UPDATE\s+\S+(?:\(\d*\))?/i, '').trim();
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
    if (v === 'TRUE') return to === 'oracle' ? '1' : (to === 'mysql' ? '1' : 'TRUE');
    if (v === 'FALSE') return to === 'oracle' ? '0' : (to === 'mysql' ? '0' : 'FALSE');
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
      if (col.extra && col.extra.onUpdate) line += ' /* [注意: MySQL ON UPDATE ' + col.extra.onUpdate + ' — Oracle 无等价功能, 需用触发器实现] */';
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
      if (col.extra && col.extra.onUpdate) line += ' /* [注意: MySQL ON UPDATE ' + col.extra.onUpdate + ' — PostgreSQL 无等价功能, 需用触发器实现] */';
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

/* ===== VIEW PARSER ===== */
function parseViews(sql, sourceDb) {
  var views = [];
  var clean = sql.replace(/\/\s*$/gm, '').replace(/\r\n/g, '\n');
  var stmts = splitStatements(clean);

  for (var si = 0; si < stmts.length; si++) {
    var s = stmts[si].trim();
    var viewRe = /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:(FORCE|NOFORCE)\s+)?(?:ALGORITHM\s*=\s*(\w+)\s+)?(?:(?:TEMP|TEMPORARY)\s+)?(?:(?:DEFINER\s*=\s*\S+)\s+)?(?:SQL\s+SECURITY\s+\w+\s+)?VIEW\s+(?:[\w"`]+\.)?["`]?(\w+)["`]?\s*/i;
    var vm = s.match(viewRe);
    if (!vm) continue;

    var view = makeView();
    view.name = vm[3];
    if (vm[1]) view.force = vm[1].toUpperCase() === 'FORCE';
    if (vm[2]) view.algorithm = vm[2].toUpperCase();
    view.orReplace = /OR\s+REPLACE/i.test(s);

    var rest = s.slice(vm[0].length);

    // Check for column alias list
    if (rest.charAt(0) === '(') {
      var depth = 0, ci = 0;
      for (; ci < rest.length; ci++) {
        if (rest[ci] === '(') depth++;
        if (rest[ci] === ')') { depth--; if (depth === 0) break; }
      }
      var colBody = rest.slice(1, ci);
      view.columns = colBody.split(',').map(function(c) { return c.trim().replace(/["`]/g, ''); });
      rest = rest.slice(ci + 1).trim();
    }

    // Skip AS keyword
    var asMatch = rest.match(/^AS\s+/i);
    if (asMatch) rest = rest.slice(asMatch[0].length);

    var query = rest;

    // Check for WITH READ ONLY (Oracle)
    var readOnlyMatch = query.match(/\s+WITH\s+READ\s+ONLY\s*$/i);
    if (readOnlyMatch) {
      view.readOnly = true;
      query = query.slice(0, readOnlyMatch.index);
    }

    // Check for WITH [CASCADED|LOCAL] CHECK OPTION
    var checkMatch = query.match(/\s+WITH\s+(CASCADED\s+|LOCAL\s+)?CHECK\s+OPTION\s*$/i);
    if (checkMatch) {
      view.withCheckOption = true;
      view.checkOptionType = checkMatch[1] ? checkMatch[1].trim().toUpperCase() : null;
      query = query.slice(0, checkMatch.index);
    }

    view.query = query.trim();
    views.push(view);
  }

  // Parse COMMENT ON VIEW / COMMENT ON TABLE (for views)
  for (var ci2 = 0; ci2 < stmts.length; ci2++) {
    var s2 = stmts[ci2].trim();
    var tcm = s2.match(/^COMMENT\s+ON\s+(?:TABLE|VIEW)\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i);
    if (tcm) {
      var vw = views.find(function(v) { return v.name.toUpperCase() === tcm[1].toUpperCase(); });
      if (vw) vw.comment = tcm[2].replace(/''/g, "'");
    }
  }

  return views;
}

/* ===== VIEW QUERY TRANSFORMER ===== */
function transformViewQuery(query, fromDb, toDb) {
  if (!query || fromDb === toDb) return query;
  var q = query;

  // Use existing body rules for common transformations (NVL, DECODE, ||, etc.)
  q = transformBody(q, fromDb, toDb);

  // Additional view-specific: FROM DUAL removal for Oracle → PostgreSQL
  if (fromDb === 'oracle' && toDb === 'postgresql') {
    q = q.replace(/\s+FROM\s+DUAL\b/gi, '');
  }

  return q;
}

/* ===== VIEW GENERATORS ===== */
function generateOracleViews(views, fromDb) {
  var lines = [];
  for (var i = 0; i < views.length; i++) {
    var vw = views[i];
    var vname = vw.name.toUpperCase();
    if (vw.comment) lines.push('-- ' + vw.comment);
    var header = 'CREATE OR REPLACE VIEW ' + vname;
    if (vw.columns.length > 0) {
      header += ' (' + vw.columns.map(function(c) { return c.toUpperCase(); }).join(', ') + ')';
    }
    header += ' AS';
    lines.push(header);
    var q = transformViewQuery(vw.query, fromDb, 'oracle');
    lines.push(q);
    if (vw.readOnly) {
      lines[lines.length - 1] += '\nWITH READ ONLY';
    } else if (vw.withCheckOption) {
      lines[lines.length - 1] += '\nWITH CHECK OPTION';
    }
    lines.push(';');
    lines.push('');
    if (vw.comment) {
      lines.push("COMMENT ON TABLE " + vname + " IS '" + vw.comment.replace(/'/g, "''") + "';");
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}

function generateMySQLViews(views, fromDb) {
  var lines = [];
  for (var i = 0; i < views.length; i++) {
    var vw = views[i];
    var vname = vw.name.toLowerCase();
    if (vw.comment) lines.push('-- ' + vw.comment);
    var header = 'CREATE OR REPLACE';
    if (vw.algorithm) header += ' ALGORITHM = ' + vw.algorithm;
    header += ' VIEW `' + vname + '`';
    if (vw.columns.length > 0) {
      header += ' (' + vw.columns.map(function(c) { return '`' + c.toLowerCase() + '`'; }).join(', ') + ')';
    }
    header += ' AS';
    lines.push(header);
    var q = transformViewQuery(vw.query, fromDb, 'mysql');
    lines.push(q);
    if (vw.withCheckOption) {
      var optType = vw.checkOptionType || 'CASCADED';
      lines[lines.length - 1] += '\nWITH ' + optType + ' CHECK OPTION';
    } else if (vw.readOnly) {
      lines.push('/* [注意: MySQL 不支持 WITH READ ONLY, 请通过权限控制实现只读] */');
    }
    lines.push(';');
    lines.push('');
  }
  return lines.join('\n').trim();
}

function generatePGViews(views, fromDb) {
  var lines = [];
  for (var i = 0; i < views.length; i++) {
    var vw = views[i];
    var vname = vw.name.toLowerCase();
    if (vw.comment) lines.push('-- ' + vw.comment);
    var header = 'CREATE OR REPLACE VIEW ' + vname;
    if (vw.columns.length > 0) {
      header += ' (' + vw.columns.map(function(c) { return c.toLowerCase(); }).join(', ') + ')';
    }
    header += ' AS';
    lines.push(header);
    var q = transformViewQuery(vw.query, fromDb, 'postgresql');
    lines.push(q);
    if (vw.withCheckOption) {
      var optType = vw.checkOptionType || 'LOCAL';
      lines[lines.length - 1] += '\nWITH ' + optType + ' CHECK OPTION';
    } else if (vw.readOnly) {
      lines.push('/* [注意: PostgreSQL 不支持 WITH READ ONLY, 可通过 security_barrier 或 GRANT 控制] */');
    }
    lines.push(';');
    lines.push('');
    if (vw.comment) {
      lines.push("COMMENT ON VIEW " + vname + " IS '" + vw.comment.replace(/'/g, "''") + "';");
      lines.push('');
    }
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

  // Parse views
  let views;
  try { views = parseViews(input, sourceDb); } catch(e) { views = []; }

  // Parse extra DDL (sequences, alter table, etc.)
  let extraParsed;
  try { extraParsed = parseExtraDDL(input, sourceDb); } catch(e) { extraParsed = { sequences: [], alterSequences: [], alterColumns: [], addColumns: [] }; }
  const hasExtra = extraParsed.sequences.length || extraParsed.alterSequences.length || extraParsed.alterColumns.length || extraParsed.addColumns.length;
  const hasViews = views && views.length > 0;

  if ((!tables || !tables.length) && !hasExtra && !hasViews) return '-- 未识别到 CREATE TABLE / CREATE VIEW 语句，请检查输入格式';

  let output = '';
  if (tables && tables.length) {
    try {
      if (targetDb === 'oracle') output = generateOracleDDL(tables, sourceDb);
      else if (targetDb === 'mysql') output = generateMySQLDDL(tables, sourceDb);
      else if (targetDb === 'postgresql') output = generatePostgreSQLDDL(tables, sourceDb);
      else return '-- 不支持的目标数据库: ' + targetDb;
    } catch (e) { return '-- 生成失败: ' + e.message; }
  }

  // Generate view DDL
  let viewOutput = '';
  if (hasViews) {
    try {
      if (targetDb === 'oracle') viewOutput = generateOracleViews(views, sourceDb);
      else if (targetDb === 'mysql') viewOutput = generateMySQLViews(views, sourceDb);
      else if (targetDb === 'postgresql') viewOutput = generatePGViews(views, sourceDb);
    } catch (e) { viewOutput = '-- 视图生成失败: ' + e.message; }
  }
  let extraOutput = '';
  if (hasExtra) {
    try { extraOutput = generateExtraDDL(extraParsed, sourceDb, targetDb); } catch(e) { extraOutput = '-- 额外DDL生成失败: ' + e.message; }
  }

  const tableCount = (tables && tables.length) ? tables.length : 0;
  const viewCount = hasViews ? views.length : 0;
  var countDesc = '表数量: ' + tableCount;
  if (viewCount > 0) countDesc += ', 视图: ' + viewCount;
  if (hasExtra) countDesc += ' (含序列/ALTER语句)';
  const header = '-- ============================================================\n'
    + '-- 自动生成: ' + DB_LABELS[sourceDb] + ' → ' + DB_LABELS[targetDb] + '\n'
    + '-- ' + countDesc + '\n'
    + '-- 生成时间: ' + new Date().toISOString().slice(0,19).replace('T',' ') + '\n'
    + '-- 请检查类型映射和分区语法是否符合目标库版本要求\n'
    + '-- ============================================================\n\n';

  let result = header;
  if (output) result += output;
  if (viewOutput) { if (output) result += '\n\n'; result += viewOutput; }
  if (extraOutput) { if (output || viewOutput) result += '\n\n'; result += extraOutput; }
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
  let transformedBody = transformBody(parsed.body, sourceDb, targetDb);
  let mappedVars = parsed.vars.map(function(v) {
    if (v.raw) return v;
    if (v.cursor) return { cursor: true, name: v.name, query: transformBody(v.query, sourceDb, targetDb) };
    return { name: v.name, type: mapParamType(v.type, sourceDb, targetDb), defaultVal: v.defaultVal };
  });

  // Expand %ROWTYPE variables for MySQL: replace single record var with individual column vars
  if (targetDb === 'mysql' && (sourceDb === 'oracle' || sourceDb === 'postgresql')) {
    var _rowtypeResult = _expandRowTypeVarsForMySQL(parsed.vars, mappedVars, transformedBody);
    mappedVars = _rowtypeResult.vars;
    transformedBody = _rowtypeResult.body;
  }

  // Fix PG RECORD -> Oracle cursor%ROWTYPE (function variant)
  if (targetDb === 'oracle' && (sourceDb === 'postgresql' || sourceDb === 'mysql')) {
    var _cursorNamesF = [];
    for (var ri = 0; ri < mappedVars.length; ri++) {
      if (mappedVars[ri].cursor) _cursorNamesF.push(mappedVars[ri].name);
    }
    if (_cursorNamesF.length > 0) {
      for (var ri2 = 0; ri2 < mappedVars.length; ri2++) {
        var rv = mappedVars[ri2];
        if (rv.type && /\bRECORD\b/i.test(rv.type)) {
          var fetchRe = new RegExp('\\bFETCH\\s+(\\w+)\\s+INTO\\s+' + rv.name + '\\b', 'i');
          var fm = transformedBody.match(fetchRe);
          if (fm && _cursorNamesF.indexOf(fm[1]) >= 0) {
            mappedVars[ri2] = { name: rv.name, type: fm[1] + '%ROWTYPE', defaultVal: rv.defaultVal };
          } else if (_cursorNamesF.length === 1) {
            mappedVars[ri2] = { name: rv.name, type: _cursorNamesF[0] + '%ROWTYPE', defaultVal: rv.defaultVal };
          }
        }
      }
    }
  }

  /* Detect semantic divergence: warn when converted body uses fundamentally different
     algorithmic patterns that may not produce equivalent results across databases.
     Examples: Oracle sequence-based token vs PG FOR-loop+random token generation. */
  var _semanticWarnings = [];
  var _srcBody = parsed.body;
  /* Sequence-based vs random-based logic divergence */
  if (/\b\w+\.NEXTVAL\b/i.test(_srcBody) && !/\brandom\b/i.test(_srcBody) && /\brandom\b|\bRAND\s*\(/i.test(transformedBody)) {
    _semanticWarnings.push('源函数使用序列(SEQUENCE)生成值, 但目标数据库转换为随机数, 两者语义不同');
  }
  if (/\brandom\b|\bRAND\s*\(/i.test(_srcBody) && !/\brandom\b|\bRAND\s*\(/i.test(transformedBody)) {
    _semanticWarnings.push('源函数使用随机数, 但目标数据库可能使用不同的生成逻辑');
  }
  /* FOR loop vs cursor loop divergence */
  if (/\bFOR\s+\w+\s+IN\b/i.test(_srcBody) && /\bCURSOR\b/i.test(transformedBody) && !/\bCURSOR\b/i.test(_srcBody)) {
    _semanticWarnings.push('源函数使用 FOR-IN 循环, 目标已转换为游标循环, 请验证行为等价性');
  }
  var _warnComment = '';
  if (_semanticWarnings.length > 0) {
    _warnComment = '/* [语义差异警告]\n';
    for (var wi = 0; wi < _semanticWarnings.length; wi++) {
      _warnComment += '   - ' + _semanticWarnings[wi] + '\n';
    }
    _warnComment += '   请人工审查转换后的逻辑是否满足业务需求 */\n';
  }

  if (targetDb === 'oracle') return _warnComment + _genOracleFunction(parsed.name, mappedParams, mappedReturnType, mappedVars, transformedBody);
  if (targetDb === 'mysql') return _warnComment + _genMySQLFunction(parsed.name, mappedParams, mappedReturnType, mappedVars, transformedBody);
  return _warnComment + _genPGFunction(parsed.name, mappedParams, mappedReturnType, mappedVars, transformedBody);
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
  let inner = afterHeader.replace(/\$\$\s*;?\s*$/g, '').replace(/\bLANGUAGE\s+\w+\s*;?\s*$/gi, '').replace(/\$\$\s*;?\s*$/g, '').trim();
  inner = inner.replace(/\$\$\s*LANGUAGE\s+\w+\s*;?\s*$/gi, '').replace(/\$\$\s*;?\s*$/g, '').trim();
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
    /* Oracle formal params: strip size from VARCHAR2/CHAR/NVARCHAR2/RAW */
    var ptype = p.type;
    ptype = ptype.replace(/\b(VARCHAR2|VARCHAR|NVARCHAR2|CHAR|NCHAR|RAW)\s*\(\s*\d+\s*(?:\s+(?:BYTE|CHAR))?\s*\)/gi, '$1');
    line += ' ' + ptype;
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
  // Ensure proper END — only match standalone END; (not END IF/LOOP/CASE)
  var afterBeginF = out.split('BEGIN').pop();
  if (!/^\s*END\s*;\s*$/im.test(afterBeginF)) out += 'END;\n';
  else out = out.replace(/\bEND\b\s*;?\s*$/i, 'END;\n');
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
    // Deduplicate declarations
    var _seenFnDecl = {};
    var _dedupedFnDeclares = [];
    for (var fdi = 0; fdi < bodyDeclares.length; fdi++) {
      var _normFnDecl = bodyDeclares[fdi].trim().replace(/\s+/g, ' ').toUpperCase();
      if (!_seenFnDecl[_normFnDecl]) {
        _seenFnDecl[_normFnDecl] = true;
        _dedupedFnDeclares.push(bodyDeclares[fdi]);
      }
    }
    // Sort: variables first, cursors second, handlers last (MySQL requirement)
    _dedupedFnDeclares.sort(function(a, b) {
      var aIsHandler = /^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(a);
      var bIsHandler = /^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(b);
      var aIsCursor = /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(a);
      var bIsCursor = /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(b);
      var aOrder = aIsHandler ? 2 : (aIsCursor ? 1 : 0);
      var bOrder = bIsHandler ? 2 : (bIsCursor ? 1 : 0);
      return aOrder - bOrder;
    });
    out += _dedupedFnDeclares.join('\n') + '\n';
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

/* --- Expand %ROWTYPE vars into individual column variables for MySQL --- */
function _expandRowTypeVarsForMySQL(originalVars, mappedVars, body) {
  // Build cursor name → { colNames, colExprs } map
  var cursorCols = {};
  for (var i = 0; i < originalVars.length; i++) {
    var ov = originalVars[i];
    if (ov.cursor && ov.query) {
      var selMatch = ov.query.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\s/i);
      if (selMatch) {
        var cols = [];
        var colExprs = [];
        var parts = selMatch[1].split(',');
        for (var ci = 0; ci < parts.length; ci++) {
          var colExpr = parts[ci].trim();
          var aliasMatch = colExpr.match(/\bAS\s+(\w+)\s*$/i);
          if (aliasMatch) {
            cols.push(aliasMatch[1]);
          } else {
            var lastWord = colExpr.match(/(\w+)\s*$/);
            if (lastWord) cols.push(lastWord[1]);
          }
          colExprs.push(colExpr);
        }
        cursorCols[ov.name.toUpperCase()] = { names: cols, exprs: colExprs };
      }
    }
  }

  /* Infer a MySQL-compatible type from a cursor SELECT expression.
     Uses heuristics on the expression text — not a full type resolver,
     but much better than the old blanket VARCHAR(4000). */
  function _inferColType(expr) {
    var e = expr.trim().toUpperCase();
    /* Aggregates that return numeric results */
    if (/^COUNT\s*\(/i.test(e)) return 'BIGINT';
    if (/^SUM\s*\(/i.test(e) || /^AVG\s*\(/i.test(e)) return 'DECIMAL(18,2)';
    if (/^MAX\s*\(|^MIN\s*\(/i.test(e)) return 'VARCHAR(4000) /* [注意: MAX/MIN 类型依赖源列, 请按实际调整] */';
    /* CAST expressions */
    var castMatch = e.match(/\bCAST\s*\(.*?\bAS\s+([\w()]+)/i);
    if (castMatch) return castMatch[1];
    /* Common column name patterns (heuristic) */
    var colName = e.replace(/^.*\.\s*/, ''); /* strip table alias prefix */
    if (/^(ID|_ID|SEQ|NUM|NO)$/i.test(colName) || /_ID$/i.test(colName)) return 'BIGINT';
    if (/AMOUNT|BALANCE|PRICE|RATE|TOTAL|SUM|QTY|QUANTITY/i.test(colName)) return 'DECIMAL(18,2)';
    if (/DATE|TIME|_AT$/i.test(colName)) return 'DATETIME';
    if (/^(STATUS|FLAG|IS_|HAS_)/i.test(colName) || /STATUS$/i.test(colName)) return 'INT';
    /* Fallback */
    return 'VARCHAR(4000)';
  }

  // Find %ROWTYPE variables and expand them
  var newVars = [];
  var rowtypeExpansions = []; // { varName, cursorName, colNames }
  for (var i = 0; i < originalVars.length; i++) {
    var ov = originalVars[i];
    var mv = mappedVars[i];
    if (ov.type && /%ROWTYPE\b/i.test(ov.type)) {
      // Extract cursor name from type like "C_ITEMS%ROWTYPE"
      var cursorRef = ov.type.replace(/%ROWTYPE\b/i, '').trim();
      var cursorKey = cursorRef.toUpperCase();
      if (cursorCols[cursorKey]) {
        var info = cursorCols[cursorKey];
        var cols = info.names;
        rowtypeExpansions.push({ varName: ov.name, cursorName: cursorRef, colNames: cols });
        // Generate individual column variable declarations with inferred types
        for (var ci = 0; ci < cols.length; ci++) {
          var inferredType = _inferColType(info.exprs[ci] || cols[ci]);
          newVars.push({ name: '_' + ov.name.toLowerCase() + '_' + cols[ci].toLowerCase(), type: inferredType, defaultVal: null });
        }
      } else {
        newVars.push(mv);
      }
    } else {
      newVars.push(mv);
    }
  }

  // Replace FETCH cursor INTO rowtype_var with individual vars
  var newBody = body;
  for (var ri = 0; ri < rowtypeExpansions.length; ri++) {
    var exp = rowtypeExpansions[ri];
    var fetchVars = exp.colNames.map(function(c) { return '_' + exp.varName.toLowerCase() + '_' + c.toLowerCase(); }).join(', ');
    // Replace: FETCH cursor_name INTO rowtype_var;
    var fetchRe = new RegExp('(FETCH\\s+' + exp.cursorName + '\\s+INTO\\s+)' + exp.varName + '\\s*;', 'gi');
    newBody = newBody.replace(fetchRe, '$1' + fetchVars + ';');
    // Replace field access: rowtype_var.column_name
    for (var ci = 0; ci < exp.colNames.length; ci++) {
      var fieldRe = new RegExp('\\b' + exp.varName + '\\.' + exp.colNames[ci] + '\\b', 'gi');
      newBody = newBody.replace(fieldRe, '_' + exp.varName.toLowerCase() + '_' + exp.colNames[ci].toLowerCase());
    }
  }

  return { vars: newVars, body: newBody };
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
  let transformedBody = transformBody(parsed.body, sourceDb, targetDb);
  let mappedVars = parsed.vars.map(function(v) {
    if (v.raw) return v;
    if (v.cursor) return { cursor: true, name: v.name, query: transformBody(v.query, sourceDb, targetDb) };
    return { name: v.name, type: mapParamType(v.type, sourceDb, targetDb), defaultVal: v.defaultVal };
  });

  // Expand %ROWTYPE variables for MySQL: replace single record var with individual column vars
  if (targetDb === 'mysql' && (sourceDb === 'oracle' || sourceDb === 'postgresql')) {
    var _rowtypeResult = _expandRowTypeVarsForMySQL(parsed.vars, mappedVars, transformedBody);
    mappedVars = _rowtypeResult.vars;
    transformedBody = _rowtypeResult.body;
  }

  // Fix PG RECORD -> Oracle cursor%ROWTYPE: match RECORD vars to cursors via FETCH patterns
  if (targetDb === 'oracle' && (sourceDb === 'postgresql' || sourceDb === 'mysql')) {
    var _cursorNames = [];
    for (var ri = 0; ri < mappedVars.length; ri++) {
      if (mappedVars[ri].cursor) _cursorNames.push(mappedVars[ri].name);
    }
    if (_cursorNames.length > 0) {
      for (var ri2 = 0; ri2 < mappedVars.length; ri2++) {
        var rv = mappedVars[ri2];
        if (rv.type && /\bRECORD\b/i.test(rv.type)) {
          /* Find FETCH cursor_name INTO this_var in body to determine associated cursor */
          var fetchRe = new RegExp('\\bFETCH\\s+(\\w+)\\s+INTO\\s+' + rv.name + '\\b', 'i');
          var fm = transformedBody.match(fetchRe);
          if (fm && _cursorNames.indexOf(fm[1]) >= 0) {
            mappedVars[ri2] = { name: rv.name, type: fm[1] + '%ROWTYPE', defaultVal: rv.defaultVal };
          } else if (_cursorNames.length === 1) {
            /* Only one cursor declared — safe to assume */
            mappedVars[ri2] = { name: rv.name, type: _cursorNames[0] + '%ROWTYPE', defaultVal: rv.defaultVal };
          }
        }
      }
    }
  }

  // Fix BOOLEAN 0/1 -> FALSE/TRUE when targeting PostgreSQL (or Oracle)
  if (targetDb === 'postgresql' || targetDb === 'oracle') {
    var _boolVarNames = [];
    for (var bi = 0; bi < mappedVars.length; bi++) {
      var bv = mappedVars[bi];
      if (bv.type && /\bBOOLEAN\b/i.test(bv.type)) {
        _boolVarNames.push(bv.name);
        if (bv.defaultVal === '0') bv.defaultVal = 'FALSE';
        else if (bv.defaultVal === '1') bv.defaultVal = 'TRUE';
      }
    }
    // Convert body assignments for known BOOLEAN variables: var := 0/1 -> var := FALSE/TRUE
    if (_boolVarNames.length > 0) {
      var _boolRe = new RegExp('\\b(' + _boolVarNames.join('|') + ')\\s*:=\\s*(0|1)\\s*;', 'gi');
      transformedBody = transformedBody.replace(_boolRe, function(m, vname, val) {
        return vname + ' := ' + (val === '1' ? 'TRUE' : 'FALSE') + ';';
      });
    }
  }

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
  let inner = afterHeader.replace(/\$\$\s*;?\s*$/g, '').replace(/\bLANGUAGE\s+\w+\s*;?\s*$/gi, '').replace(/\$\$\s*;?\s*$/g, '').trim();
  inner = inner.replace(/\$\$\s*LANGUAGE\s+\w+\s*;?\s*$/gi, '').replace(/\$\$\s*;?\s*$/g, '').trim();
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
      /* Oracle formal params: strip size from VARCHAR2/CHAR/NVARCHAR2/RAW */
      var ptype = p.type;
      ptype = ptype.replace(/\b(VARCHAR2|VARCHAR|NVARCHAR2|CHAR|NCHAR|RAW)\s*\(\s*\d+\s*(?:\s+(?:BYTE|CHAR))?\s*\)/gi, '$1');
      line += ' ' + ptype;
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
  /* Fix #1: Extract cursor declarations from body (MySQL DECLARE CURSOR FOR -> Oracle IS section) */
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '');
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '');
  var cursorExtracted = [];
  cleanBody = cleanBody.replace(/(^|\n)\s*CURSOR\s+(\w+)\s+IS\s+([\s\S]*?)\s*;/gi, function(m, pre, curName, curQuery) {
    cursorExtracted.push({ name: curName, query: curQuery.trim() });
    return pre;
  });
  /* Also extract MySQL-syntax cursor declarations left in body */
  cleanBody = cleanBody.replace(/(^|\n)\s*DECLARE\s+(\w+)\s+CURSOR\s+FOR\s+([\s\S]*?)\s*;/gi, function(m, pre, curName, curQuery) {
    cursorExtracted.push({ name: curName, query: curQuery.trim() });
    return pre;
  });
  /* Append extracted cursors to IS section (before BEGIN) */
  for (var ci = 0; ci < cursorExtracted.length; ci++) {
    out += '  CURSOR ' + cursorExtracted[ci].name + ' IS ' + cursorExtracted[ci].query + ';\n';
  }
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/,'') + '\n';
  /* Fix #8: Robust END; detection — only match standalone END; (not END IF/LOOP/CASE) */
  var afterBegin = out.substring(out.lastIndexOf('BEGIN'));
  var hasEnd = /^\s*END\s*;\s*$/im.test(afterBegin);
  if (!hasEnd) {
    /* Strip trailing whitespace before adding END; */
    out = out.replace(/\s*$/, '\n');
    out += 'END;\n';
  } else {
    out = out.replace(/\bEND\s*;\s*$/i, 'END;\n');
  }
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
  // Deduplicate declarations by normalized content
  var _seenDecl = {};
  var _dedupedDeclares = [];
  for (var di = 0; di < allDeclares.length; di++) {
    var _normDecl = allDeclares[di].trim().replace(/\s+/g, ' ').toUpperCase();
    if (!_seenDecl[_normDecl]) {
      _seenDecl[_normDecl] = true;
      _dedupedDeclares.push(allDeclares[di]);
    }
  }
  allDeclares = _dedupedDeclares;
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

/* ===== VUE 3 APP ===== */
const { createApp, ref, computed, watch, nextTick, onMounted, onUnmounted, triggerRef } = Vue;

const app = createApp({
  setup() {
    // ===== DB Picker state =====
    const dbDropdown = ref('');
    const dbAbbr = { oracle: 'ORA', mysql: 'MY', postgresql: 'PG' };
    const dbOptions = [
      { value: 'oracle', label: 'Oracle', abbr: 'ORA' },
      { value: 'mysql', label: 'MySQL', abbr: 'MY' },
      { value: 'postgresql', label: 'PostgreSQL', abbr: 'PG' }
    ];
    const PAGE_ROUTE_SEGMENTS = Object.freeze({
      ddl: 'ddl',
      func: 'function',
      proc: 'procedure',
      idTool: 'id-tool',
      ziweiTool: 'ziwei',
      rules: 'rules',
      bodyRules: 'body-rules'
    });
    const ROUTE_SEGMENT_TO_PAGE = Object.freeze((function() {
      var map = {};
      var keys = Object.keys(PAGE_ROUTE_SEGMENTS);
      for (var i = 0; i < keys.length; i++) {
        map[PAGE_ROUTE_SEGMENTS[keys[i]]] = keys[i];
      }
      return map;
    })());
    const ROUTE_WORKBENCH_PREFIX = '/workbench';
    const ROUTE_SPLASH_PATH = '/splash';
    const ROUTE_PAGE_KEYS = Object.freeze(Object.keys(PAGE_ROUTE_SEGMENTS));
    function normalizeEmail(value) {
      return String(value || '').trim().toLowerCase();
    }
    function parseEmailAllowList(raw) {
      if (Array.isArray(raw)) {
        return raw.map(normalizeEmail).filter(Boolean);
      }
      if (typeof raw === 'string') {
        return raw.split(',').map(normalizeEmail).filter(Boolean);
      }
      return [];
    }
    const ZIWEI_ALLOWED_EMAILS = Object.freeze((function() {
      if (typeof window === 'undefined') return [];
      var configured = window.SQDEV_ZIWEI_ALLOWED_EMAILS;
      if (configured == null || configured === '') configured = window.__SQDEV_ZIWEI_ALLOWED_EMAILS;
      return parseEmailAllowList(configured);
    })());
    function readCurrentAuthEmail() {
      try {
        if (typeof window === 'undefined' || !window.authApi || typeof window.authApi.getUserSync !== 'function') return '';
        var authUser = window.authApi.getUserSync();
        return normalizeEmail(authUser && authUser.email);
      } catch (_err) {
        return '';
      }
    }
    function _readZiweiShareModeFromLocation() {
      try {
        if (typeof window === 'undefined' || !window.location) return false;
        var search = new URLSearchParams(String(window.location.search || ''));
        var raw = search.get('ziwei_share') || search.get('zwshare') || '';
        if (!raw && String(window.location.hash || '').indexOf('?') >= 0) {
          var hashQuery = String(window.location.hash || '').split('?')[1] || '';
          var hashParams = new URLSearchParams(hashQuery);
          raw = hashParams.get('ziwei_share') || hashParams.get('zwshare') || '';
        }
        var flag = String(raw || '').trim().toLowerCase();
        return flag === '1' || flag === 'true' || flag === 'yes';
      } catch (_err) {
        return false;
      }
    }
    const ziweiShareMode = ref(_readZiweiShareModeFromLocation());
    const currentUserEmail = ref(readCurrentAuthEmail());
    const canAccessZiweiTool = computed(function() {
      if (ziweiShareMode.value) return true;
      var email = normalizeEmail(currentUserEmail.value);
      if (!email) return false;
      if (!ZIWEI_ALLOWED_EMAILS.length) return true;
      return ZIWEI_ALLOWED_EMAILS.indexOf(email) >= 0;
    });
    const isZiweiShareMode = computed(function() {
      return ziweiShareMode.value === true;
    });

    function normalizePageKey(page) {
      var key = String(page || '').trim();
      return ROUTE_PAGE_KEYS.indexOf(key) >= 0 ? key : 'ddl';
    }
    function normalizeAccessiblePage(page) {
      var key = normalizePageKey(page);
      if (ziweiShareMode.value) return 'ziweiTool';
      if (key === 'ziweiTool' && !canAccessZiweiTool.value) return 'idTool';
      return key;
    }

    function normalizeRoutePath(path) {
      var value = String(path || '').trim();
      if (!value) return '/';
      if (value.charAt(0) !== '/') value = '/' + value;
      value = value.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
      return value || '/';
    }

    function parseRouteInfoFromPath(path) {
      var normalized = normalizeRoutePath(path);
      if (/(?:^|\/)splash(?:\/)?$/i.test(normalized)) {
        return { view: 'splash' };
      }
      var match = normalized.match(/(?:^|\/)workbench(?:\/([^/?#]+))?/i);
      if (!match) return null;
      var segment = String(match[1] || 'ddl').toLowerCase();
      return { view: 'workbench', page: ROUTE_SEGMENT_TO_PAGE[segment] || 'ddl' };
    }

    function parseRouteInfoFromLocation() {
      if (typeof window === 'undefined' || !window.location) return null;
      var hashPath = normalizeRoutePath(String(window.location.hash || '').replace(/^#/, ''));
      var infoFromHash = parseRouteInfoFromPath(hashPath);
      if (infoFromHash) return infoFromHash;
      return parseRouteInfoFromPath(window.location.pathname || '/');
    }

    function buildWorkbenchHash(page) {
      var normalizedPage = normalizePageKey(page);
      var segment = PAGE_ROUTE_SEGMENTS[normalizedPage] || PAGE_ROUTE_SEGMENTS.ddl;
      return '#' + ROUTE_WORKBENCH_PREFIX + '/' + segment;
    }

    function syncRouteForPage(page, replaceUrl) {
      if (typeof window === 'undefined' || !window.location) return;
      var targetHash = buildWorkbenchHash(page);
      var currentHashRaw = String(window.location.hash || '').replace(/^#/, '');
      var currentHash = currentHashRaw ? ('#' + normalizeRoutePath(currentHashRaw)) : '';
      if (currentHash === targetHash) return;
      var nextUrl = window.location.pathname + window.location.search + targetHash;
      try {
        if (window.history) {
          if (replaceUrl && typeof window.history.replaceState === 'function') {
            window.history.replaceState({ view: 'workbench', page: normalizePageKey(page) }, '', nextUrl);
            return;
          }
          if (!replaceUrl && typeof window.history.pushState === 'function') {
            window.history.pushState({ view: 'workbench', page: normalizePageKey(page) }, '', nextUrl);
            return;
          }
        }
      } catch (_historyErr) {}
      window.location.hash = targetHash.slice(1);
    }

    const initialRouteInfo = parseRouteInfoFromLocation();
    const activePage = ref(
      initialRouteInfo && initialRouteInfo.view === 'workbench'
        ? normalizeAccessiblePage(initialRouteInfo.page)
        : 'ddl'
    );
    const sidebarOpen = ref(false);
    const sidebarCollapsed = ref(false);
    function handleSidebarHover(open) {
      if (window.innerWidth <= 1024) return;
      sidebarOpen.value = !!open;
      if (!open) sidebarSettingsOpen.value = false;
    }
    function toggleSidebar() {
      sidebarCollapsed.value = !sidebarCollapsed.value;
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed.value ? '1' : '0');
    }
    const NAV_PAGES = ['ddl', 'func', 'proc'];
    const TEST_TOOL_PAGES = ['idTool', 'ziweiTool'];
    const testToolsExpanded = ref(TEST_TOOL_PAGES.indexOf(activePage.value) >= 0);
    function toggleTestToolsMenu() {
      testToolsExpanded.value = !testToolsExpanded.value;
      if (!testToolsExpanded.value && TEST_TOOL_PAGES.indexOf(activePage.value) >= 0) {
        setPage('ddl');
      }
    }
    function applyPageState(page, options) {
      var opts = options || {};
      var normalizedPage = normalizeAccessiblePage(page);
      activePage.value = normalizedPage;
      if (TEST_TOOL_PAGES.indexOf(normalizedPage) >= 0) {
        testToolsExpanded.value = true;
      }
      if (normalizedPage === 'idTool') {
        ensureRegionDataLoaded();
      }
      if (opts.syncRoute !== false) {
        syncRouteForPage(normalizedPage, !!opts.replaceRoute);
      }
      if (!opts.keepSidebarOnMobile && window.innerWidth <= 1024) sidebarOpen.value = false;
    }
    function setPage(page) {
      applyPageState(page, { syncRoute: true, replaceRoute: false });
    }
    function ensureWorkbenchVisibleForRoute() {
      if (typeof document === 'undefined') return;
      if (!document.body.classList.contains('splash-active')) return;
      if (typeof window !== 'undefined' && window.splashApi && typeof window.splashApi.enterWorkbench === 'function') {
        window.splashApi.enterWorkbench(true);
        return;
      }
      document.documentElement.classList.add('startup-workbench');
      document.body.classList.remove('splash-active');
      var poster = document.getElementById('splash-poster');
      if (poster) poster.style.display = 'none';
    }
    function applyRouteFromLocation() {
      ziweiShareMode.value = _readZiweiShareModeFromLocation();
      var routeInfo = parseRouteInfoFromLocation();
      if (!routeInfo) return;
      if (routeInfo.view === 'splash') {
        if (ziweiShareMode.value) {
          ensureWorkbenchVisibleForRoute();
          applyPageState('ziweiTool', { syncRoute: true, replaceRoute: true, keepSidebarOnMobile: true });
          return;
        }
        if (typeof document !== 'undefined' && !document.body.classList.contains('splash-active')) {
          goSplashHome();
        }
        return;
      }
      ensureWorkbenchVisibleForRoute();
      if (ziweiShareMode.value) {
        if (activePage.value !== 'ziweiTool') {
          applyPageState('ziweiTool', { syncRoute: true, replaceRoute: true, keepSidebarOnMobile: true });
        }
        return;
      }
      if (routeInfo.page === 'ziweiTool' && !canAccessZiweiTool.value) {
        applyPageState('idTool', { syncRoute: true, replaceRoute: true, keepSidebarOnMobile: true });
        return;
      }
      if (routeInfo.page !== activePage.value) {
        applyPageState(routeInfo.page, { syncRoute: false, keepSidebarOnMobile: true });
      }
    }
    /* navKeydown removed: sidebar is now role="navigation" with aria-current, not tablist */
    const showRulesMenu = ref(false);
    const sidebarSettingsOpen = ref(false);
    const actionBarCollapsed = ref(false);
    const isWorkbenchPage = computed(() => NAV_PAGES.indexOf(activePage.value) >= 0);
    /* ARIA menu keyboard: arrow cycle, Home/End, Escape, auto-focus first item */
    function handleMenuKey(e) {
      var items = e.currentTarget.querySelectorAll('[role="menuitem"]');
      if (!items.length) return;
      var idx = Array.prototype.indexOf.call(items, document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); showRulesMenu.value = false; var t = document.getElementById('settings-trigger'); if (t) t.focus(); }
    }
    watch(showRulesMenu, function(open) {
      if (open) { nextTick(function() { var el = document.querySelector('.settings-menu [role="menuitem"]'); if (el) el.focus(); }); }
    });

    // Theme: 'system' | 'light' | 'dark'
    const themeMode = ref(localStorage.getItem('theme') || 'system');
    const isMacPlatform = computed(() => {
      try {
        if (navigator.userAgentData && typeof navigator.userAgentData.platform === 'string') {
          return /mac/i.test(navigator.userAgentData.platform);
        }
      } catch (_err) {}
      var platform = String(navigator.platform || navigator.userAgent || '');
      return /mac|iphone|ipad|ipod/i.test(platform);
    });
    const primaryShortcutLabel = computed(() => isMacPlatform.value ? '⌘+Enter' : 'Ctrl+Enter');
    const themeLabel = computed(() => {
      if (themeMode.value === 'dark') return '切换到亮色模式';
      if (themeMode.value === 'light') return '切换到跟随系统';
      return '切换到深色模式';
    });
    const themeMenuLabel = computed(() => {
      if (themeMode.value === 'dark') return '切换到亮色模式';
      if (themeMode.value === 'light') return '切换到跟随系统';
      return '切换到深色模式';
    });
    function applyTheme(mode) {
      const root = document.documentElement;
      if (mode === 'dark') root.setAttribute('data-theme', 'dark');
      else if (mode === 'light') root.setAttribute('data-theme', 'light');
      else {
        /* system mode: detect OS preference and set data-theme accordingly
           so all [data-theme="light"] / [data-theme="dark"] CSS rules apply */
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      }
    }
    function toggleTheme() {
      const order = ['system', 'dark', 'light'];
      const idx = order.indexOf(themeMode.value);
      themeMode.value = order[(idx + 1) % order.length];
      localStorage.setItem('theme', themeMode.value);
      applyTheme(themeMode.value);
    }
    applyTheme(themeMode.value);
    /* Listen for system color-scheme changes so 'system' mode updates in real time */
    try {
      var mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', function() {
        if (themeMode.value === 'system') applyTheme('system');
      });
    } catch(e) {}
    /* Sync theme if poster forced dark after Vue mounted */
    window.addEventListener('sp-theme-sync', function(e) {
      themeMode.value = e.detail || 'system';
      applyTheme(themeMode.value);
    });
    const refCollapsed = ref(true);
    const ruleSearchQuery = ref('');
    const ruleFilterDir = ref('all');
    const ddlRuleTab = ref('oracleToMysql');
    const bodyRuleTab = ref('oracleToMysql');

    // DDL state
    const sourceDb = ref('oracle');
    const targetDb = ref('postgresql');
    const inputDdl = ref('');
    const outputDdl = ref('');

    // Function state
    const funcSourceDb = ref('oracle');
    const funcTargetDb = ref('postgresql');
    const funcInput = ref('');
    const funcOutput = ref('');

    // Procedure state
    const procSourceDb = ref('oracle');
    const procTargetDb = ref('postgresql');
    const procInput = ref('');
    const procOutput = ref('');

    // Test tools state
    // Use local administrative region data to avoid online latency.
    const REGION_DATA_LOCAL_FILE = './region_codes_2024.json';
    const REGION_WARMUP_DELAY_MS = 350;
    const REGION_IDLE_TIMEOUT_MS = 1600;
    const regionLoading = ref(false);
    const regionReady = ref(false);
    const regionLoadError = ref('');
    const provinces = ref([]);
    const citiesByProvince = ref({});
    const countiesByCity = ref({});
    const regionCodeSet = ref(new Set());
    const provinceCodeSet = ref(new Set());
    let regionLoadPromise = null;
    let regionWarmupHandle = null;

    const idProvinceCode = ref('');
    const idCityCode = ref('');
    const idCountyCode = ref('');
    const idBirthDate = ref('');
    const idBirthYear = ref('1990');
    const idBirthMonth = ref('01');
    const idBirthDay = ref('01');
    const idGender = ref('male');
    const idGeneratedNumber = ref('');
    const idGenerateResult = ref({ type: 'info', text: '' });
    const idVerifyInput = ref('');
    const idVerifyResult = ref({ type: 'info', text: '' });
    const idCopyDone = ref(false);
    const idVerifyDone = ref(false);
    const idLastVerifyInput = ref('');
    const idLastVerifySignature = ref('');

    const usccProvinceCode = ref('');
    const usccCityCode = ref('');
    const usccCountyCode = ref('');
    const usccCodeMode = ref('uscc18');
    const usccDeptCode = ref('9');
    const usccOrgTypeCode = ref('1');
    const usccGeneratedCode = ref('');
    const usccLegacyGenerated = ref(null);
    const usccCopyPayload = ref('');
    const usccGenerateResult = ref({ type: 'info', text: '' });
    const usccVerifyInput = ref('');
    const usccVerifyResult = ref({ type: 'info', text: '' });
    const usccCopyDone = ref(false);
    const usccVerifyDone = ref(false);
    const usccLastVerifyInput = ref('');
    const usccLastVerifySignature = ref('');
    let idCopyTimer = 0;
    let idVerifyTimer = 0;
    let usccCopyTimer = 0;
    let usccVerifyTimer = 0;
    let ziweiCopyTimer = 0;
    let ziweiAiCopyTimer = 0;
    let ziweiGenerateTimer = 0;

    // Zi Wei Dou Shu state
    const ZW_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const ZW_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const ZW_RING = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']; // clockwise
    const ZW_PALACE_NAMES = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫'];
    const ZW_BOARD_ORDER = ['巳', '午', '未', '申', '辰', '酉', '卯', '戌', '寅', '丑', '子', '亥'];
    const ZW_BOARD_AREA = {
      '巳': 'zw-si', '午': 'zw-wu', '未': 'zw-wei', '申': 'zw-shen',
      '辰': 'zw-chen', '酉': 'zw-you', '卯': 'zw-mao', '戌': 'zw-xu',
      '寅': 'zw-yin', '丑': 'zw-chou', '子': 'zw-zi', '亥': 'zw-hai'
    };
    const ZW_SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const ZW_WUHU_START_STEM = { '甲': '丙', '己': '丙', '乙': '戊', '庚': '戊', '丙': '庚', '辛': '庚', '丁': '壬', '壬': '壬', '戊': '甲', '癸': '甲' };
    const ZW_BUREAU_BY_ELEMENT = { '水': 2, '木': 3, '金': 4, '土': 5, '火': 6 };
    const ZW_YEAR_STEM_YINYANG = { '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴', '戊': '阳', '己': '阴', '庚': '阳', '辛': '阴', '壬': '阳', '癸': '阴' };
    const ZW_MAIN_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
    const ZW_LUNAR_MONTH_LABEL = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    const ZW_LUNAR_DAY_LABEL = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
      '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
    const ZW_TIME_SLOT = [
      { label: '子时', start: '23:00', end: '00:59' }, { label: '丑时', start: '01:00', end: '02:59' },
      { label: '寅时', start: '03:00', end: '04:59' }, { label: '卯时', start: '05:00', end: '06:59' },
      { label: '辰时', start: '07:00', end: '08:59' }, { label: '巳时', start: '09:00', end: '10:59' },
      { label: '午时', start: '11:00', end: '12:59' }, { label: '未时', start: '13:00', end: '14:59' },
      { label: '申时', start: '15:00', end: '16:59' }, { label: '酉时', start: '17:00', end: '18:59' },
      { label: '戌时', start: '19:00', end: '20:59' }, { label: '亥时', start: '21:00', end: '22:59' }
    ];
    const ZW_NAYIN_BY_JIAZI = {
      '甲子': '海中金', '乙丑': '海中金', '丙寅': '炉中火', '丁卯': '炉中火', '戊辰': '大林木', '己巳': '大林木',
      '庚午': '路旁土', '辛未': '路旁土', '壬申': '剑锋金', '癸酉': '剑锋金', '甲戌': '山头火', '乙亥': '山头火',
      '丙子': '涧下水', '丁丑': '涧下水', '戊寅': '城头土', '己卯': '城头土', '庚辰': '白蜡金', '辛巳': '白蜡金',
      '壬午': '杨柳木', '癸未': '杨柳木', '甲申': '泉中水', '乙酉': '泉中水', '丙戌': '屋上土', '丁亥': '屋上土',
      '戊子': '霹雳火', '己丑': '霹雳火', '庚寅': '松柏木', '辛卯': '松柏木', '壬辰': '长流水', '癸巳': '长流水',
      '甲午': '砂石金', '乙未': '砂石金', '丙申': '山下火', '丁酉': '山下火', '戊戌': '平地木', '己亥': '平地木',
      '庚子': '壁上土', '辛丑': '壁上土', '壬寅': '金箔金', '癸卯': '金箔金', '甲辰': '覆灯火', '乙巳': '覆灯火',
      '丙午': '天河水', '丁未': '天河水', '戊申': '大驿土', '己酉': '大驿土', '庚戌': '钗钏金', '辛亥': '钗钏金',
      '壬子': '桑柘木', '癸丑': '桑柘木', '甲寅': '大溪水', '乙卯': '大溪水', '丙辰': '沙中土', '丁巳': '沙中土',
      '戊午': '天上火', '己未': '天上火', '庚申': '石榴木', '辛酉': '石榴木', '壬戌': '大海水', '癸亥': '大海水'
    };
    const ZW_KUI_YUE_BY_STEM = {
      '甲': { kui: '丑', yue: '未' }, '戊': { kui: '丑', yue: '未' }, '庚': { kui: '丑', yue: '未' },
      '乙': { kui: '子', yue: '申' }, '己': { kui: '子', yue: '申' },
      '丙': { kui: '亥', yue: '酉' }, '丁': { kui: '亥', yue: '酉' },
      '壬': { kui: '卯', yue: '巳' }, '癸': { kui: '卯', yue: '巳' },
      '辛': { kui: '午', yue: '寅' }
    };
    const ZW_LUCUN_YANG_TUO_BY_STEM = {
      '甲': { lucun: '寅', yang: '卯', tuo: '丑' }, '乙': { lucun: '卯', yang: '辰', tuo: '寅' },
      '丙': { lucun: '巳', yang: '午', tuo: '辰' }, '丁': { lucun: '午', yang: '未', tuo: '巳' },
      '戊': { lucun: '巳', yang: '午', tuo: '辰' }, '己': { lucun: '午', yang: '未', tuo: '巳' },
      '庚': { lucun: '申', yang: '酉', tuo: '未' }, '辛': { lucun: '酉', yang: '戌', tuo: '申' },
      '壬': { lucun: '亥', yang: '子', tuo: '戌' }, '癸': { lucun: '子', yang: '丑', tuo: '亥' }
    };
    const ZW_FIRE_BELL_BY_YEAR_BRANCH = {
      '寅': { fire: '丑', bell: '卯' }, '午': { fire: '丑', bell: '卯' }, '戌': { fire: '丑', bell: '卯' },
      '申': { fire: '寅', bell: '戌' }, '子': { fire: '寅', bell: '戌' }, '辰': { fire: '寅', bell: '戌' },
      '巳': { fire: '卯', bell: '戌' }, '酉': { fire: '卯', bell: '戌' }, '丑': { fire: '卯', bell: '戌' },
      '亥': { fire: '酉', bell: '戌' }, '卯': { fire: '酉', bell: '戌' }, '未': { fire: '酉', bell: '戌' }
    };
    const ZW_HUA_BY_STEM = {
      '甲': { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
      '乙': { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
      '丙': { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
      '丁': { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
      '戊': { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
      '己': { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
      '庚': { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
      '辛': { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
      '壬': { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
      '癸': { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' }
    };
    const ZW_HUA_TAG_ITEMS = [
      { key: 'lu', tag: '禄' },
      { key: 'quan', tag: '权' },
      { key: 'ke', tag: '科' },
      { key: 'ji', tag: '忌' }
    ];
    const ZW_TIANMA_BY_YEAR_BRANCH = {
      '寅': '申', '午': '申', '戌': '申',
      '申': '寅', '子': '寅', '辰': '寅',
      '巳': '亥', '酉': '亥', '丑': '亥',
      '亥': '巳', '卯': '巳', '未': '巳'
    };
    const ZW_MINGZHU_BY_BRANCH = { '子': '贪狼', '丑': '巨门', '寅': '禄存', '卯': '文曲', '辰': '廉贞', '巳': '武曲', '午': '破军', '未': '武曲', '申': '廉贞', '酉': '文曲', '戌': '禄存', '亥': '巨门' };
    const ZW_SHENZHU_BY_YEAR_BRANCH = { '子': '火星', '丑': '天相', '寅': '天梁', '卯': '天同', '辰': '文昌', '巳': '天机', '午': '火星', '未': '天相', '申': '天梁', '酉': '天同', '戌': '文昌', '亥': '天机' };
    const ZW_BRIGHTNESS = {
      '紫微': { '寅': '庙', '卯': '旺', '辰': '得', '巳': '旺', '午': '庙', '未': '旺', '申': '得', '酉': '平', '戌': '平', '亥': '平', '子': '旺', '丑': '庙' },
      '天机': { '寅': '旺', '卯': '庙', '辰': '得', '巳': '平', '午': '陷', '未': '平', '申': '旺', '酉': '庙', '戌': '得', '亥': '平', '子': '陷', '丑': '平' },
      '太阳': { '寅': '旺', '卯': '庙', '辰': '旺', '巳': '庙', '午': '庙', '未': '旺', '申': '平', '酉': '陷', '戌': '陷', '亥': '陷', '子': '平', '丑': '平' },
      '武曲': { '寅': '平', '卯': '平', '辰': '庙', '巳': '旺', '午': '庙', '未': '旺', '申': '庙', '酉': '旺', '戌': '庙', '亥': '平', '子': '陷', '丑': '得' },
      '天同': { '寅': '平', '卯': '旺', '辰': '庙', '巳': '旺', '午': '陷', '未': '平', '申': '平', '酉': '陷', '戌': '平', '亥': '庙', '子': '旺', '丑': '平' },
      '廉贞': { '寅': '平', '卯': '利', '辰': '庙', '巳': '陷', '午': '旺', '未': '平', '申': '平', '酉': '利', '戌': '庙', '亥': '陷', '子': '平', '丑': '旺' },
      '天府': { '寅': '庙', '卯': '旺', '辰': '庙', '巳': '旺', '午': '庙', '未': '旺', '申': '庙', '酉': '旺', '戌': '庙', '亥': '旺', '子': '庙', '丑': '旺' },
      '太阴': { '寅': '平', '卯': '平', '辰': '平', '巳': '陷', '午': '陷', '未': '平', '申': '旺', '酉': '庙', '戌': '旺', '亥': '庙', '子': '庙', '丑': '旺' },
      '贪狼': { '寅': '平', '卯': '旺', '辰': '庙', '巳': '旺', '午': '平', '未': '陷', '申': '平', '酉': '旺', '戌': '庙', '亥': '旺', '子': '平', '丑': '陷' },
      '巨门': { '寅': '旺', '卯': '平', '辰': '庙', '巳': '陷', '午': '陷', '未': '平', '申': '旺', '酉': '平', '戌': '庙', '亥': '旺', '子': '平', '丑': '陷' },
      '天相': { '寅': '旺', '卯': '平', '辰': '庙', '巳': '旺', '午': '庙', '未': '旺', '申': '庙', '酉': '旺', '戌': '庙', '亥': '平', '子': '陷', '丑': '平' },
      '天梁': { '寅': '庙', '卯': '旺', '辰': '庙', '巳': '平', '午': '旺', '未': '庙', '申': '旺', '酉': '平', '戌': '陷', '亥': '平', '子': '旺', '丑': '庙' },
      '七杀': { '寅': '平', '卯': '陷', '辰': '旺', '巳': '庙', '午': '旺', '未': '平', '申': '庙', '酉': '旺', '戌': '平', '亥': '陷', '子': '平', '丑': '旺' },
      '破军': { '寅': '陷', '卯': '平', '辰': '旺', '巳': '庙', '午': '旺', '未': '平', '申': '庙', '酉': '旺', '戌': '平', '亥': '陷', '子': '平', '丑': '旺' }
    };
    const ZW_CHANGSHENG_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
    const ZW_CHANGSHENG_START_BY_ELEMENT = {
      '水': '申',
      '木': '亥',
      '金': '巳',
      '土': '申',
      '火': '寅'
    };
    const ZW_TIANFU_MIRROR = {
      '寅': '寅', '卯': '丑', '辰': '子', '巳': '亥', '午': '戌', '未': '酉',
      '申': '申', '酉': '未', '戌': '午', '亥': '巳', '子': '辰', '丑': '卯'
    };
    const ZW_SMALL_LIMIT_RULE_MALE = {
      '子': { start: '辰', dir: 1 }, '辰': { start: '辰', dir: 1 }, '申': { start: '辰', dir: 1 },
      '寅': { start: '辰', dir: 1 }, '午': { start: '辰', dir: 1 }, '戌': { start: '辰', dir: 1 },
      '丑': { start: '未', dir: -1 }, '巳': { start: '未', dir: -1 }, '酉': { start: '未', dir: -1 },
      '亥': { start: '戌', dir: 1 }, '卯': { start: '戌', dir: 1 }, '未': { start: '戌', dir: 1 }
    };
    const ZW_CLOCK_MODE_OPTIONS = [
      { value: 'standard', label: '标准时间' },
      { value: 'trueSolar', label: '真太阳时（经度+时差方程）' }
    ];
    const ZW_XIAOXIAN_RULE_OPTIONS = [
      { value: 'yearBranch', label: '年支起小限（传统）' },
      { value: 'mingStart', label: '命宫起小限（简化）' }
    ];
    const ZW_LIUNIAN_RULE_OPTIONS = [
      { value: 'yearForward', label: '年支顺排（默认）' },
      { value: 'followDaXian', label: '随大限顺逆' }
    ];

    const ziweiCalendarType = ref('solar');
    const ziweiSolarYear = ref('1990');
    const ziweiSolarMonth = ref('01');
    const ziweiSolarDay = ref('01');
    const ziweiLunarYear = ref('1990');
    const ziweiLunarMonth = ref('1');
    const ziweiLunarDay = ref('1');
    const ziweiLunarLeap = ref(false);
    const ziweiBirthHour = ref('12');
    const ziweiBirthMinute = ref('00');
    const ziweiGender = ref('male');
    const ziweiAdvancedOpen = ref(false);
    const ziweiClockMode = ref('standard');
    const ziweiTimezoneOffset = ref('8');
    const ziweiLongitude = ref('120.000');
    const ziweiXiaoXianRule = ref('yearBranch');
    const ziweiLiuNianRule = ref('yearForward');
    const ziweiProfileName = ref('');
    const ziweiProMode = ref(false);
    const ziweiSchool = ref('traditional');
    const ziweiFocusBranch = ref('');
    const ziweiChart = ref(null);
    const ziweiAnalysis = ref([]);
    const ziweiAnalysisActiveKey = ref('');
    const ziweiHistory = ref([]);
    const ziweiHistoryPickedId = ref('');
    const ziweiStatus = ref({ type: 'info', text: '' });
    const ziweiAiLoading = ref(false);
    const ziweiAiDone = ref(false);
    const ziweiAiError = ref('');
    const ziweiAiResult = ref(null);
    const ziweiAiUpdatedAt = ref(0);
    const ziweiAiLastDurationMs = ref(0);
    const ziweiAiCooldownUntil = ref(0);
    const ziweiAiCooldownHint = ref('');
    const ziweiAiLastRequestAt = ref(0);
    const ziweiLastAiSignature = ref('');
    const _ziweiAiCache = new Map();
    const _ZIWEI_AI_CACHE_MAX = 12;
    const _ZIWEI_AI_MIN_INTERVAL_MS = 2200;
    const _ZIWEI_AI_RATE_LIMIT_COOLDOWN_MS = 30000;
    const _ZIWEI_AI_PRIMARY_PAYLOAD = (function() {
      var raw = String(window.SQDEV_ZIWEI_AI_PRIMARY_PAYLOAD || 'lite').trim().toLowerCase();
      return raw === 'compact' ? 'compact' : 'lite';
    })();
    var _ziweiAiInFlightPromise = null;
    var _ziweiAiInFlightSignature = '';
    var _ziweiAiCooldownTimer = 0;
    /*
    const LEGACY_UNUSED_QA_LIST = [
      '请解读我今年事业和收入变化重点',
      '请解读我当前大限的机会与风险',
      '请解读感情关系中最需要注意的点',
      '请给我未来三个月可执行建议',
      '请解读我这个命盘的长期优势和短板'
    ];
    const LEGACY_UNUSED_QA_TEMPLATE = [
      '你是专业紫微斗数命盘顾问，回答必须使用简体中文。',
      '请严格按照以下结构输出：',
      '【问题】{{question}}',
      '【核心结论】用1-2句给出明确判断。',
      '【命盘证据】至少2条，必须引用宫位/星曜/四化/大限/流年中的具体信息。',
      '【行动建议】给出3条可执行建议，按优先级排序。',
      '【风险提示】给出1-2条需规避事项。',
      '不要输出markdown标题，不要输出代码块。'
    ].join('\n');
    */
    const ziweiAiQaSuggestions = ref([]);
    /* legacy qa hint config removed
      if (typeof window === 'undefined') return '问答模板由服务端 Secrets 控制；前端仅配置建议问题与提示语。';
      var raw = null;
      var text = typeof raw === 'string' ? raw.trim() : '';
      return text || '问答模板由服务端 Secrets 控制；前端仅配置建议问题与提示语。';
    })()); */
    /* legacy qa suggestion hint config removed
      if (typeof window === 'undefined') return {};
      var raw = null;
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    })()); */
    const ziweiAiQuestionInput = ref('');
    const ziweiAiQuestionAnswer = ref('');
    const ziweiAiQuestionLoading = ref(false);
    const ziweiAiSuggestionOpen = ref(false);
    const ziweiAiQaInputWrapRef = ref(null);
    const ziweiAiSuggestionPlacement = ref('down');
    const ziweiAiSuggestionMaxHeight = ref(320);
    const ziweiExporting = ref(false);
    const ziweiSharing = ref(false);
    const ziweiSharePosterDataUrl = ref('');
    const ziweiGenerating = ref(false);
    const ziweiGenerateDone = ref(false);
    const ziweiCopyDone = ref(false);
    const ziweiAiCopyDone = ref(false);
    const ziweiLastGenerateSignature = ref('');
    const ZW_HISTORY_KEY = 'sqldev_ziwei_history_v1';
    const ziweiIntlSupported = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';
    const _zwLunarFmt = ziweiIntlSupported ? new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric', month: 'numeric', day: 'numeric' }) : null;
    const _zwSolarToLunarCache = new Map();
    const _zwLunarToSolarCache = new Map();
    const _zwLeapMonthCache = new Map();
    const _zwLunarMonthDaysCache = new Map();

    const idBirthMin = '1900-01-01';
    const idBirthMax = computed(() => {
      var now = new Date();
      var y = now.getFullYear();
      var m = String(now.getMonth() + 1).padStart(2, '0');
      var d = String(now.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    });

    const usccDeptOptions = [
      { value: '9', label: '市场监管' },
      { value: '1', label: '机构编制' },
      { value: '5', label: '民政' },
      { value: 'A', label: '其他登记部门A' },
      { value: 'N', label: '其他登记部门N' },
      { value: 'Y', label: '其他登记部门Y' }
    ];
    const usccModeOptions = [
      { value: 'uscc18', label: '统一社会信用代码（18位）' },
      { value: 'legacy3', label: '旧版三证（工商/组织机构/税务）' }
    ];
    const usccOrgTypeOptions = [
      { value: '1', label: '企业' },
      { value: '2', label: '个体工商户' },
      { value: '3', label: '农民专业合作社' },
      { value: '9', label: '其他组织' }
    ];

    const ID_CHECK_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const ID_CHECK_MAP = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    const USCC_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY';
    const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
    const USCC_DEPT_ALLOWED = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'N', 'Y']);
    const ORG_CODE_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const ORG_CODE_WEIGHTS = [3, 7, 9, 10, 5, 8, 4, 2];
    const usccCharIndexMap = {};
    for (var usccIdx = 0; usccIdx < USCC_CHARSET.length; usccIdx++) {
      usccCharIndexMap[USCC_CHARSET[usccIdx]] = usccIdx;
    }

    const idCityOptions = computed(function() {
      return citiesByProvince.value[idProvinceCode.value] || [];
    });
    const idCountyOptions = computed(function() {
      return countiesByCity.value[idCityCode.value] || [];
    });
    const usccCityOptions = computed(function() {
      return citiesByProvince.value[usccProvinceCode.value] || [];
    });
    const usccCountyOptions = computed(function() {
      return countiesByCity.value[usccCityCode.value] || [];
    });
    const idBirthYearOptions = computed(function() {
      var currentYear = Number(idBirthMax.value.slice(0, 4)) || new Date().getFullYear();
      var list = [];
      for (var y = currentYear; y >= 1900; y--) list.push(y);
      return list;
    });
    const idBirthMonthOptions = computed(function() {
      var list = [];
      for (var m = 1; m <= 12; m++) {
        list.push({ value: String(m).padStart(2, '0'), label: String(m).padStart(2, '0') });
      }
      return list;
    });
    const idBirthDayOptions = computed(function() {
      var year = Number(idBirthYear.value || '1990');
      var month = Number(idBirthMonth.value || '1');
      if (!Number.isInteger(year) || year < 1900) year = 1990;
      if (!Number.isInteger(month) || month < 1 || month > 12) month = 1;
      var monthDays = [31, (_isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      var maxDay = monthDays[month - 1];
      var list = [];
      for (var d = 1; d <= maxDay; d++) {
        var txt = String(d).padStart(2, '0');
        list.push({ value: txt, label: txt });
      }
      return list;
    });
    const usccOutputPlaceholder = computed(function() {
      return usccCodeMode.value === 'legacy3' ? '主输出显示旧版工商注册号' : '生成结果将显示在这里';
    });
    const usccVerifyPlaceholder = computed(function() {
      return usccCodeMode.value === 'legacy3'
        ? '例如：110105123456789 或 A1B2C3D4-5'
        : '例如：91310106MA1FY4BN0X';
    });
    const ziweiYearOptions = computed(function() {
      var years = [];
      for (var y = 2100; y >= 1900; y--) years.push(String(y));
      return years;
    });
    const ziweiMonthOptions = computed(function() {
      var months = [];
      for (var m = 1; m <= 12; m++) {
        var mm = String(m).padStart(2, '0');
        months.push({ value: mm, label: mm });
      }
      return months;
    });
    const ziweiHourOptions = computed(function() {
      var hours = [];
      for (var h = 0; h <= 23; h++) {
        var hh = String(h).padStart(2, '0');
        hours.push({ value: hh, label: hh });
      }
      return hours;
    });
    const ziweiMinuteOptions = computed(function() {
      var minutes = [];
      for (var m = 0; m <= 59; m++) {
        var mm = String(m).padStart(2, '0');
        minutes.push({ value: mm, label: mm });
      }
      return minutes;
    });
    const ziweiClockModeOptions = computed(function() {
      return ZW_CLOCK_MODE_OPTIONS.slice();
    });
    const ziweiTimezoneOptions = computed(function() {
      var out = [];
      for (var step = -24; step <= 28; step++) {
        var t = step / 2;
        var txt = (t >= 0 ? '+' : '') + String(t);
        out.push({ value: String(t), label: 'UTC' + txt });
      }
      return out;
    });
    const ziweiXiaoXianRuleOptions = computed(function() {
      return ZW_XIAOXIAN_RULE_OPTIONS.slice();
    });
    const ziweiLiuNianRuleOptions = computed(function() {
      return ZW_LIUNIAN_RULE_OPTIONS.slice();
    });
    const ziweiSolarDayOptions = computed(function() {
      var year = Number(ziweiSolarYear.value || '1990');
      var month = Number(ziweiSolarMonth.value || '1');
      if (!Number.isInteger(year) || year < 1900) year = 1990;
      if (year > 2100) year = 2100;
      if (!Number.isInteger(month) || month < 1 || month > 12) month = 1;
      var max = new Date(year, month, 0).getDate();
      var list = [];
      for (var d = 1; d <= max; d++) {
        var dd = String(d).padStart(2, '0');
        list.push({ value: dd, label: dd });
      }
      return list;
    });
    const ziweiLunarDayOptions = computed(function() {
      var max = 30;
      var year = Number(ziweiLunarYear.value || '1990');
      var month = Number(ziweiLunarMonth.value || '1');
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
        max = _zwGetLunarMonthDays(year, month, !!ziweiLunarLeap.value);
      }
      if (!Number.isInteger(max) || max < 29 || max > 30) max = 30;
      var list = [];
      for (var d = 1; d <= max; d++) {
        list.push({
          value: String(d),
          label: ZW_LUNAR_DAY_LABEL[d] || ('初' + d)
        });
      }
      return list;
    });
    const ziweiLeapMonthForYear = computed(function() {
      var year = Number(ziweiLunarYear.value || '0');
      if (!Number.isInteger(year) || year < 1900 || year > 2100) return 0;
      return _zwGetLeapMonth(year);
    });
    const ziweiCanUseLeapMonth = computed(function() {
      var leap = ziweiLeapMonthForYear.value;
      var month = Number(ziweiLunarMonth.value || '0');
      return leap > 0 && leap === month;
    });
    const ziweiLunarMonthLabel = computed(function() {
      var m = Number(ziweiLunarMonth.value || '1');
      if (!Number.isInteger(m) || m < 1 || m > 12) m = 1;
      var monthText = ZW_LUNAR_MONTH_LABEL[m - 1] || String(m);
      return (ziweiLunarLeap.value ? '闰' : '') + monthText + '月';
    });
    const ziweiCalendarTypeLabel = computed(function() {
      return ziweiCalendarType.value === 'lunar' ? '农历输入' : '公历输入';
    });
    const ziweiSchoolLabel = computed(function() {
      return ziweiSchool.value === 'flying' ? '飞星四化' : '传统四化';
    });
    const ziweiClockModeLabel = computed(function() {
      return ziweiClockMode.value === 'trueSolar' ? '真太阳时（经度+时差方程）' : '标准时间';
    });
    const ziweiClockHint = computed(function() {
      if (ziweiClockMode.value !== 'trueSolar') return '默认使用标准时间排盘。';
      var tz = Number(ziweiTimezoneOffset.value || '8');
      if (!Number.isFinite(tz)) tz = 8;
      return '真太阳时校正：总修正 = 经度修正 + 时差方程(EoT)。当前时区 UTC' + (tz >= 0 ? '+' : '') + String(tz) + '。';
    });
    const ziweiAdvancedSummary = computed(function() {
      return [
        ziweiClockModeLabel.value,
        _zwXiaoXianRuleToLabel(ziweiXiaoXianRule.value),
        _zwLiuNianRuleToLabel(ziweiLiuNianRule.value)
      ].join(' / ');
    });
    const ziweiSifangBranches = computed(function() {
      var branch = String(ziweiFocusBranch.value || '');
      if (!branch) return [];
      var list = [
        branch,
        _zwOffset(branch, 4),
        _zwOffset(branch, 8),
        _zwOffset(branch, 6)
      ];
      var uniq = [];
      list.forEach(function(it) {
        if (it && uniq.indexOf(it) < 0) uniq.push(it);
      });
      return uniq;
    });
    const ziweiFocusCell = computed(function() {
      if (!ziweiChart.value || !Array.isArray(ziweiChart.value.boardCells)) return null;
      var branch = String(ziweiFocusBranch.value || '');
      if (!branch) return null;
      for (var i = 0; i < ziweiChart.value.boardCells.length; i++) {
        if (ziweiChart.value.boardCells[i].branch === branch) return ziweiChart.value.boardCells[i];
      }
      return null;
    });
    const ziweiSifangCells = computed(function() {
      if (!ziweiChart.value || !Array.isArray(ziweiChart.value.boardCells)) return [];
      var branches = ziweiSifangBranches.value;
      var out = [];
      branches.forEach(function(branch) {
        for (var i = 0; i < ziweiChart.value.boardCells.length; i++) {
          var cell = ziweiChart.value.boardCells[i];
          if (cell && cell.branch === branch) {
            out.push(cell);
            break;
          }
        }
      });
      return out;
    });
    const ziweiCenterTitle = computed(function() {
      var chart = ziweiChart.value;
      if (!chart || !Array.isArray(chart.boardCells)) return '命盘信息';
      var mingBranch = chart.center && chart.center.mingBranch ? String(chart.center.mingBranch) : '';
      var mingCell = null;
      for (var i = 0; i < chart.boardCells.length; i++) {
        var cell = chart.boardCells[i];
        if (cell && String(cell.branch) === mingBranch) {
          mingCell = cell;
          break;
        }
      }
      var stars = mingCell && Array.isArray(mingCell.mainStars) ? mingCell.mainStars : [];
      var names = stars.slice(0, 2).map(function(st) { return st && st.name ? String(st.name) : ''; }).filter(Boolean);
      return names.length ? names.join('') : '命盘信息';
    });
    const ziweiJieqiPillarsText = computed(function() {
      var center = ziweiChart.value && ziweiChart.value.center ? ziweiChart.value.center : null;
      var list = center && Array.isArray(center.jieqiPillars) ? center.jieqiPillars : [];
      if (!list.length) return '--';
      return list
        .map(function(item) {
          if (item && typeof item === 'object') {
            var text = String(item.text || '');
            if (text) return text;
            return String(item.stem || '') + String(item.branch || '');
          }
          return String(item || '');
        })
        .filter(Boolean)
        .join(' ');
    });
    const ziweiNonJieqiPillarsText = computed(function() {
      var center = ziweiChart.value && ziweiChart.value.center ? ziweiChart.value.center : null;
      var list = center && Array.isArray(center.nonJieqiPillars) ? center.nonJieqiPillars : [];
      if (!list.length) return '--';
      return list
        .map(function(item) {
          if (item && typeof item === 'object') {
            var text = String(item.text || '');
            if (text) return text;
            return String(item.stem || '') + String(item.branch || '');
          }
          return String(item || '');
        })
        .filter(Boolean)
        .join(' ');
    });
    function _zwBuildPillarPartText(list, part) {
      var source = Array.isArray(list) ? list : [];
      if (!source.length) return '--';
      var tokens = source
        .slice(0, 4)
        .map(function(item) {
          if (item && typeof item === 'object') {
            if (part === 'stem') return String(item.stem || '').trim();
            if (part === 'branch') return String(item.branch || '').trim();
            return String(item.text || '').trim();
          }
          var raw = String(item || '');
          if (part === 'stem') return raw.slice(0, 1).trim();
          if (part === 'branch') return raw.slice(1, 2).trim();
          return raw.trim();
        })
        .filter(Boolean);
      return tokens.length ? tokens.join(' ') : '--';
    }
    const ziweiJieqiPillarStemText = computed(function() {
      var center = ziweiChart.value && ziweiChart.value.center ? ziweiChart.value.center : null;
      return _zwBuildPillarPartText(center && center.jieqiPillars, 'stem');
    });
    const ziweiJieqiPillarBranchText = computed(function() {
      var center = ziweiChart.value && ziweiChart.value.center ? ziweiChart.value.center : null;
      return _zwBuildPillarPartText(center && center.jieqiPillars, 'branch');
    });
    const ziweiNonJieqiPillarStemText = computed(function() {
      var center = ziweiChart.value && ziweiChart.value.center ? ziweiChart.value.center : null;
      return _zwBuildPillarPartText(center && center.nonJieqiPillars, 'stem');
    });
    const ziweiNonJieqiPillarBranchText = computed(function() {
      var center = ziweiChart.value && ziweiChart.value.center ? ziweiChart.value.center : null;
      return _zwBuildPillarPartText(center && center.nonJieqiPillars, 'branch');
    });
    const ziweiCenterDaXianPreview = computed(function() {
      var chart = ziweiChart.value;
      if (!chart || !Array.isArray(chart.daXianTimeline)) return [];
      var activeLabel = chart.center && chart.center.currentDaXianLabel ? String(chart.center.currentDaXianLabel) : '';
      return chart.daXianTimeline.slice(0, 8).map(function(item) {
        var range = item && item.range ? String(item.range) : '--';
        return {
          range: range,
          branch: item && item.branch ? String(item.branch) : '--',
          palaceName: item && item.palaceName ? String(item.palaceName) : '',
          active: activeLabel && activeLabel.indexOf(range) === 0
        };
      });
    });
    const ziweiFocusTracks = computed(function() {
      var chart = ziweiChart.value;
      if (!chart || !Array.isArray(chart.huaTracks)) return [];
      var tracks = chart.huaTracks.slice();
      var focus = String(ziweiFocusBranch.value || '');
      if (ziweiSchool.value === 'flying' && focus) {
        var scoped = tracks.filter(function(track) {
          return track && (track.sourceBranch === focus || track.targetBranch === focus);
        });
        if (scoped.length) return scoped;
      }
      return tracks.slice(0, ziweiSchool.value === 'flying' ? 24 : 12);
    });
    const ziweiFocusTrackCount = computed(function() {
      var list = ziweiFocusTracks.value;
      return Array.isArray(list) ? (String(list.length) + ' 条') : '0 条';
    });
    const ziweiHistoryCountText = computed(function() {
      var count = Array.isArray(ziweiHistory.value) ? ziweiHistory.value.length : 0;
      return String(count) + ' 条';
    });
    const ziweiHistoryNameOptions = computed(function() {
      var list = Array.isArray(ziweiHistory.value) ? ziweiHistory.value : [];
      if (!list.length) return [];
      return list.map(function(item) {
        var id = String((item && item.id) || '');
        var label = String((item && (item.label || item.profileName)) || '').trim() || '未命名命例';
        var timeText = formatZiweiHistoryTime(item && item.createdAt);
        var value = label + '（' + timeText + '）';
        return {
          id: id,
          label: label,
          value: value,
          meta: '保存时间：' + timeText
        };
      });
    });
    const ziweiActiveAnalysis = computed(function() {
      var list = Array.isArray(ziweiAnalysis.value) ? ziweiAnalysis.value : [];
      var key = String(ziweiAnalysisActiveKey.value || '');
      if (!key) return list.length ? list[0] : null;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].key === key) return list[i];
      }
      return list.length ? list[0] : null;
    });
    const idCopyButtonLabel = computed(function() {
      return idCopyDone.value ? '\u5df2\u590d\u5236' : '\u590d\u5236';
    });
    const usccCopyButtonLabel = computed(function() {
      return usccCopyDone.value ? '\u5df2\u590d\u5236' : '\u590d\u5236';
    });
    const idVerifyButtonLabel = computed(function() {
      return idVerifyDone.value ? '\u5df2\u6821\u9a8c' : '\u6821\u9a8c';
    });
    const usccVerifyButtonLabel = computed(function() {
      return usccVerifyDone.value ? '\u5df2\u6821\u9a8c' : '\u6821\u9a8c';
    });
    const ziweiGenerateButtonLabel = computed(function() {
      if (ziweiGenerating.value) return '\u6392\u76d8\u4e2d...';
      return ziweiGenerateDone.value ? '\u5df2\u6392\u76d8' : '\u6392\u76d8';
    });
    const ziweiCopyButtonLabel = computed(function() {
      return ziweiCopyDone.value ? '\u5df2\u590d\u5236' : '\u590d\u5236\u6587\u5b57\u547d\u76d8';
    });
    const ziweiAiCopyButtonLabel = computed(function() {
      return ziweiAiCopyDone.value ? '\u5df2\u590d\u5236\u89e3\u8bfb' : '\u590d\u5236\u89e3\u8bfb';
    });
    const ziweiExportButtonLabel = computed(function() {
      return ziweiExporting.value ? '\u5bfc\u51fa\u4e2d...' : '\u5bfc\u51fa\u547d\u76d8\u56fe\u7247';
    });
    const ziweiShareButtonLabel = computed(function() {
      return ziweiSharing.value ? '生成中...' : '分享海报';
    });
    const ziweiAiCooldownActive = computed(function() {
      return Number(ziweiAiCooldownUntil.value || 0) > Date.now();
    });
    const ziweiAiCooldownSeconds = computed(function() {
      if (!ziweiAiCooldownActive.value) return 0;
      var remainMs = Math.max(0, Number(ziweiAiCooldownUntil.value || 0) - Date.now());
      return Math.max(1, Math.ceil(remainMs / 1000));
    });
    const ziweiAiRequestBlocked = computed(function() {
      return ziweiAiLoading.value || ziweiAiQuestionLoading.value || ziweiAiCooldownActive.value;
    });
    const ziweiAiButtonLabel = computed(function() {
      if (ziweiAiLoading.value) return 'AI 解读中...';
      if (ziweiAiCooldownActive.value) return 'AI 请稍后（' + String(ziweiAiCooldownSeconds.value) + 's）';
      return ziweiAiDone.value ? '已生成 AI 解读' : 'AI 深度解盘';
    });
    const ziweiAiUpdatedAtText = computed(function() {
      return ziweiAiUpdatedAt.value ? formatZiweiHistoryTime(ziweiAiUpdatedAt.value) : '';
    });
    const ziweiAiDurationText = computed(function() {
      return formatZiweiDurationText(ziweiAiLastDurationMs.value);
    });
    const ziweiShareLink = computed(function() {
      return buildZiweiShareLink();
    });
    const ziweiAiSuggestionsFiltered = computed(function() {
      var source = Array.isArray(ziweiAiQaSuggestions.value) ? ziweiAiQaSuggestions.value : [];
      if (!source.length) return [];
      var q = String(ziweiAiQuestionInput.value || '').trim().toLowerCase();
      if (!q) return source.slice(0, 8);
      return source
        .filter(function(item) { return String(item || '').toLowerCase().indexOf(q) >= 0; })
        .slice(0, 8);
    });
    /*
    const legacyUnusedHintText = computed(function() {
      return '问答模板由服务端 Secrets 控制；前端仅配置建议问题与提示语。';
    });

    const ziweiAiSuggestionsView = computed(function() {
      var source = Array.isArray(ziweiAiQaSuggestions.value) ? ziweiAiQaSuggestions.value : [];
      if (!source.length) return [];
      var hintMap = {};
      var mapped = source.map(function(item) {
        var text = String(item || '').trim();
        var hint = String((hintMap && hintMap[text]) || '').trim();
        return { text: text, hint: hint };
      }).filter(function(item) { return !!item.text; });
      if (!mapped.length) return [];
      var q = String(ziweiAiQuestionInput.value || '').trim().toLowerCase();
      if (!q) return mapped.slice(0, 8);
      return mapped.filter(function(item) {
        return String(item.text || '').toLowerCase().indexOf(q) >= 0 ||
          String(item.hint || '').toLowerCase().indexOf(q) >= 0;
      }).slice(0, 8);
    });
    const legacyUnusedHintView = computed(function() {
      var text = '';
      if (text) return text;
      return '问答模板由服务端 Secrets 控制；前端仅配置建议问题与提示语。';
    });

    */
    function _sortRegionByCode(list) {
      return (list || []).slice().sort(function(a, b) {
        return String(a.code || '').localeCompare(String(b.code || ''));
      });
    }

    function _ensureAddressSelection(provinceRef, cityRef, countyRef) {
      var cityList = citiesByProvince.value[provinceRef.value] || [];
      if (!cityList.some(function(c) { return c.code === cityRef.value; })) {
        cityRef.value = cityList.length ? cityList[0].code : '';
      }
      var countyList = countiesByCity.value[cityRef.value] || [];
      if (!countyList.some(function(c) { return c.code === countyRef.value; })) {
        countyRef.value = countyList.length ? countyList[0].code : '';
      }
    }

    function _normalizeRegionTreeData(treeRows) {
      var pRows = Array.isArray(treeRows) ? treeRows : [];
      var provs = [];
      var provSet = new Set();
      var codeSet = new Set();
      var cityMap = {};
      var countyMap = {};

      pRows.forEach(function(p) {
        if (!p || !/^\d{6}$/.test(String(p.code || ''))) return;
        var provinceCode = String(p.code);
        var provinceName = String(p.name || provinceCode);
        provs.push({ code: provinceCode, name: provinceName });
        provSet.add(provinceCode.slice(0, 2));
        codeSet.add(provinceCode);
        cityMap[provinceCode] = [];

        var cityRows = Array.isArray(p.cityList) ? p.cityList : [];
        cityRows.forEach(function(c) {
          var cityCodeRaw = String((c && c.code) || '');
          var cityCode = /^\d{6}$/.test(cityCodeRaw) ? cityCodeRaw : provinceCode;
          var cityName = String((c && c.name) || cityCode);
          cityMap[provinceCode].push({
            code: cityCode,
            name: cityName,
            provinceCode: provinceCode
          });
          codeSet.add(cityCode);
          if (!countyMap[cityCode]) countyMap[cityCode] = [];

          var areaRows = Array.isArray(c && c.areaList) ? c.areaList : [];
          areaRows.forEach(function(a) {
            var areaCode = String((a && a.code) || '');
            if (!/^\d{6}$/.test(areaCode)) return;
            countyMap[cityCode].push({
              code: areaCode,
              name: String((a && a.name) || areaCode),
              cityCode: cityCode
            });
            codeSet.add(areaCode);
          });
        });
        cityMap[provinceCode] = _sortRegionByCode(cityMap[provinceCode]);
      });

      Object.keys(countyMap).forEach(function(cityCode) {
        countyMap[cityCode] = _sortRegionByCode(countyMap[cityCode]);
      });

      return {
        provinces: _sortRegionByCode(provs),
        citiesByProvince: cityMap,
        countiesByCity: countyMap,
        regionCodeSet: codeSet,
        provinceCodeSet: provSet
      };
    }

    var _idBirthSyncing = false;
    function _syncIdBirthDateFromParts() {
      if (_idBirthSyncing) return;
      _idBirthSyncing = true;
      try {
        var year = Number(idBirthYear.value || '1990');
        var month = Number(idBirthMonth.value || '1');
        var day = Number(idBirthDay.value || '1');
        if (!Number.isInteger(year) || year < 1900) year = 1990;
        if (!Number.isInteger(month) || month < 1 || month > 12) month = 1;
        var monthDays = [31, (_isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var maxDay = monthDays[month - 1];
        if (!Number.isInteger(day) || day < 1) day = 1;
        if (day > maxDay) day = maxDay;
        var nextDay = String(day).padStart(2, '0');
        if (idBirthDay.value !== nextDay) idBirthDay.value = nextDay;
        var next = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + nextDay;
        if (idBirthDate.value !== next) idBirthDate.value = next;
      } finally {
        _idBirthSyncing = false;
      }
    }
    function _syncIdBirthPartsFromDate() {
      if (_idBirthSyncing) return;
      _idBirthSyncing = true;
      try {
        var dateText = String(idBirthDate.value || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) dateText = '1990-01-01';
        var parts = dateText.split('-');
        var year = Number(parts[0]);
        var month = Number(parts[1]);
        var day = Number(parts[2]);
        if (!Number.isInteger(year) || year < 1900) year = 1990;
        var maxYear = Number(idBirthMax.value.slice(0, 4)) || new Date().getFullYear();
        if (year > maxYear) year = maxYear;
        if (!Number.isInteger(month) || month < 1 || month > 12) month = 1;
        var monthDays = [31, (_isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var maxDay = monthDays[month - 1];
        if (!Number.isInteger(day) || day < 1) day = 1;
        if (day > maxDay) day = maxDay;
        idBirthYear.value = String(year);
        idBirthMonth.value = String(month).padStart(2, '0');
        idBirthDay.value = String(day).padStart(2, '0');
        var normalized = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        if (idBirthDate.value !== normalized) idBirthDate.value = normalized;
      } finally {
        _idBirthSyncing = false;
      }
    }

    function _initIdToolDefaults() {
      if (!provinces.value.length) return;
      if (!idProvinceCode.value) idProvinceCode.value = provinces.value[0].code;
      if (!usccProvinceCode.value) usccProvinceCode.value = provinces.value[0].code;
      _ensureAddressSelection(idProvinceCode, idCityCode, idCountyCode);
      _ensureAddressSelection(usccProvinceCode, usccCityCode, usccCountyCode);
      if (!idBirthDate.value) idBirthDate.value = '1990-01-01';
      _syncIdBirthPartsFromDate();
    }

    function cancelRegionWarmup() {
      if (!regionWarmupHandle) return;
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(regionWarmupHandle);
      } else {
        clearTimeout(regionWarmupHandle);
      }
      regionWarmupHandle = null;
    }

    function scheduleRegionWarmup() {
      if (regionReady.value || regionLoadPromise || regionWarmupHandle) return;
      if (typeof navigator !== 'undefined') {
        var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && (conn.saveData || /2g/i.test(String(conn.effectiveType || '')))) return;
      }
      var runWarmup = function() {
        regionWarmupHandle = null;
        ensureRegionDataLoaded(false);
      };
      if (typeof window.requestIdleCallback === 'function') {
        regionWarmupHandle = window.requestIdleCallback(runWarmup, { timeout: REGION_IDLE_TIMEOUT_MS });
      } else {
        regionWarmupHandle = window.setTimeout(runWarmup, REGION_WARMUP_DELAY_MS);
      }
    }

    async function ensureRegionDataLoaded(forceReload) {
      if (regionReady.value && !forceReload) return;
      if (regionLoadPromise) return regionLoadPromise;
      cancelRegionWarmup();
      regionLoading.value = true;
      regionLoadError.value = '';
      regionLoadPromise = (async function() {
        try {
          var res = await fetch(REGION_DATA_LOCAL_FILE, {
            method: 'GET',
            cache: 'force-cache',
            credentials: 'same-origin'
          });
          if (!res.ok) throw new Error('HTTP ' + res.status + ' @ ' + REGION_DATA_LOCAL_FILE);
          var rows = await res.json();
          var normalized = _normalizeRegionTreeData(rows);
          if (!normalized.provinces.length) throw new Error('行政区划数据为空');
          provinces.value = normalized.provinces;
          citiesByProvince.value = normalized.citiesByProvince;
          countiesByCity.value = normalized.countiesByCity;
          regionCodeSet.value = normalized.regionCodeSet;
          provinceCodeSet.value = normalized.provinceCodeSet;
          regionReady.value = true;
          _initIdToolDefaults();
        } catch (err) {
          regionReady.value = false;
          regionLoadError.value = '行政区划数据加载失败，请检查本地文件后重试：' + String((err && err.message) || err || '');
        } finally {
          regionLoading.value = false;
          regionLoadPromise = null;
        }
      })();
      return regionLoadPromise;
    }

    function reloadRegionData() {
      regionReady.value = false;
      ensureRegionDataLoaded(true);
    }

    watch(idProvinceCode, function() {
      _ensureAddressSelection(idProvinceCode, idCityCode, idCountyCode);
    });
    watch(idCityCode, function() {
      _ensureAddressSelection(idProvinceCode, idCityCode, idCountyCode);
    });
    watch(usccProvinceCode, function() {
      _ensureAddressSelection(usccProvinceCode, usccCityCode, usccCountyCode);
    });
    watch(usccCityCode, function() {
      _ensureAddressSelection(usccProvinceCode, usccCityCode, usccCountyCode);
    });
    watch(idBirthDate, function() {
      _syncIdBirthPartsFromDate();
    });
    watch([idBirthYear, idBirthMonth, idBirthDay], function() {
      _syncIdBirthDateFromParts();
    });
    watch(usccCodeMode, function() {
      usccGeneratedCode.value = '';
      usccCopyPayload.value = '';
      usccLegacyGenerated.value = null;
      usccGenerateResult.value = { type: 'info', text: '' };
      usccVerifyResult.value = { type: 'info', text: '' };
      usccCopyDone.value = false;
      usccVerifyDone.value = false;
      usccLastVerifyInput.value = '';
      usccLastVerifySignature.value = '';
    });
    watch([ziweiSolarYear, ziweiSolarMonth], function() {
      _zwNormalizeSolarDay();
    });
    watch(ziweiSolarDay, function() {
      _zwNormalizeSolarDay();
    });
    watch([ziweiLunarYear, ziweiLunarMonth], function() {
      _zwNormalizeLunarInput();
    });
    watch(ziweiLunarLeap, function(next) {
      if (next && !ziweiCanUseLeapMonth.value) ziweiLunarLeap.value = false;
      _zwNormalizeLunarInput();
    });
    watch(ziweiCalendarType, function() {
      ziweiStatus.value = { type: 'info', text: '' };
    });
    watch(ziweiClockMode, function(next) {
      if (next === 'trueSolar') ziweiAdvancedOpen.value = true;
    });
    watch([
      ziweiSolarYear, ziweiSolarMonth, ziweiSolarDay,
      ziweiLunarYear, ziweiLunarMonth, ziweiLunarDay, ziweiLunarLeap,
      ziweiBirthHour, ziweiBirthMinute, ziweiGender,
      ziweiClockMode, ziweiTimezoneOffset, ziweiLongitude,
      ziweiXiaoXianRule, ziweiLiuNianRule,
      ziweiCalendarType
    ], function() {
      ziweiGenerateDone.value = false;
      ziweiCopyDone.value = false;
      ziweiAiDone.value = false;
      ziweiAiError.value = '';
      ziweiAiResult.value = null;
      ziweiAiUpdatedAt.value = 0;
      ziweiLastAiSignature.value = '';
      ziweiAiQuestionAnswer.value = '';
      ziweiAiSuggestionOpen.value = false;
    });
    watch(ziweiAiSuggestionOpen, function(open) {
      if (open) scheduleZiweiAiSuggestionLayout();
    });
    watch(ziweiAiQuestionInput, function() {
      if (ziweiAiSuggestionOpen.value) scheduleZiweiAiSuggestionLayout();
    });
    watch(ziweiAiSuggestionsFiltered, function() {
      if (ziweiAiSuggestionOpen.value) scheduleZiweiAiSuggestionLayout();
    });
    watch(ziweiSchool, function() {
      if (ziweiChart.value) {
        generateZiweiChart({ saveHistory: false, silent: true });
      }
    });
    watch(ziweiChart, function(next) {
      if (!next || !Array.isArray(next.boardCells)) {
        ziweiAnalysis.value = [];
        ziweiAnalysisActiveKey.value = '';
        ziweiFocusBranch.value = '';
        ziweiAiDone.value = false;
        ziweiAiError.value = '';
        ziweiAiResult.value = null;
        ziweiAiUpdatedAt.value = 0;
        ziweiLastAiSignature.value = '';
        ziweiAiQuestionAnswer.value = '';
        return;
      }
      var prevKey = String(ziweiAnalysisActiveKey.value || '');
      ziweiAnalysis.value = _zwBuildAnalysisPro(next);
      var hasPrev = false;
      for (var i = 0; i < ziweiAnalysis.value.length; i++) {
        if (ziweiAnalysis.value[i] && ziweiAnalysis.value[i].key === prevKey) {
          hasPrev = true;
          break;
        }
      }
      ziweiAnalysisActiveKey.value = hasPrev
        ? prevKey
        : (ziweiAnalysis.value[0] ? ziweiAnalysis.value[0].key : '');
      if (!ziweiFocusBranch.value) {
        ziweiFocusBranch.value = next.center && next.center.mingBranch ? next.center.mingBranch : next.boardCells[0].branch;
      }
    });
    ziweiHistory.value = _zwLoadHistory();

    function _pickBestRegionCode(provinceCode, cityCode, countyCode) {
      var county = String(countyCode || '');
      var city = String(cityCode || '');
      var province = String(provinceCode || '');
      if (/^\d{6}$/.test(county) && regionCodeSet.value.has(county)) return county;
      if (/^\d{6}$/.test(city) && regionCodeSet.value.has(city)) return city;
      if (/^\d{6}$/.test(province) && regionCodeSet.value.has(province)) return province;
      return '';
    }

    function _isLeapYear(year) {
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    function _isValidDateParts(year, month, day) {
      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
      if (month < 1 || month > 12 || day < 1) return false;
      var monthDays = [31, (_isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      return day <= monthDays[month - 1];
    }

    function _parseYmdFromIsoDate(value) {
      var dateText = String(value || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return '';
      var parts = dateText.split('-');
      var y = Number(parts[0]);
      var m = Number(parts[1]);
      var d = Number(parts[2]);
      if (!_isValidDateParts(y, m, d)) return '';
      return parts.join('');
    }

    function _validateBirthYmd8(ymd8) {
      if (!/^\d{8}$/.test(ymd8)) return false;
      var y = Number(ymd8.slice(0, 4));
      var m = Number(ymd8.slice(4, 6));
      var d = Number(ymd8.slice(6, 8));
      if (!_isValidDateParts(y, m, d)) return false;
      var today = Number(idBirthMax.value.replace(/-/g, ''));
      var currentYear = new Date().getFullYear();
      if (y < 1900 || y > currentYear) return false;
      if (Number(ymd8) > today) return false;
      return true;
    }

    function _calcIdCheckDigit(id17) {
      if (!/^\d{17}$/.test(id17)) return '';
      var sum = 0;
      for (var i = 0; i < 17; i++) {
        sum += Number(id17[i]) * ID_CHECK_WEIGHTS[i];
      }
      return ID_CHECK_MAP[sum % 11];
    }

    function _randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function _randomSeqByGender(gender) {
      // 顺序码: 001-999，第17位(顺序码最后1位)男奇女偶
      var seqNum = _randomInt(1, 999);
      if (gender === 'female' && seqNum % 2 !== 0) seqNum += 1;
      if (gender !== 'female' && seqNum % 2 === 0) seqNum += 1;
      if (seqNum > 999) seqNum -= 2;
      if (seqNum < 1) seqNum = gender === 'female' ? 2 : 1;
      return String(seqNum).padStart(3, '0');
    }

    function _flashButtonState(flagRef, timerName, durationMs) {
      if (timerName === 'idCopy') {
        if (idCopyTimer) clearTimeout(idCopyTimer);
        flagRef.value = true;
        idCopyTimer = window.setTimeout(function() { flagRef.value = false; }, durationMs || 1400);
        return;
      }
      if (timerName === 'idVerify') {
        if (idVerifyTimer) clearTimeout(idVerifyTimer);
        flagRef.value = true;
        idVerifyTimer = window.setTimeout(function() { flagRef.value = false; }, durationMs || 1400);
        return;
      }
      if (timerName === 'usccCopy') {
        if (usccCopyTimer) clearTimeout(usccCopyTimer);
        flagRef.value = true;
        usccCopyTimer = window.setTimeout(function() { flagRef.value = false; }, durationMs || 1400);
        return;
      }
      if (timerName === 'usccVerify') {
        if (usccVerifyTimer) clearTimeout(usccVerifyTimer);
        flagRef.value = true;
        usccVerifyTimer = window.setTimeout(function() { flagRef.value = false; }, durationMs || 1400);
        return;
      }
      if (timerName === 'ziweiCopy') {
        if (ziweiCopyTimer) clearTimeout(ziweiCopyTimer);
        flagRef.value = true;
        ziweiCopyTimer = window.setTimeout(function() { flagRef.value = false; }, durationMs || 1400);
        return;
      }
      if (timerName === 'ziweiAiCopy') {
        if (ziweiAiCopyTimer) clearTimeout(ziweiAiCopyTimer);
        flagRef.value = true;
        ziweiAiCopyTimer = window.setTimeout(function() { flagRef.value = false; }, durationMs || 1400);
        return;
      }
      if (timerName === 'ziweiGenerate') {
        if (ziweiGenerateTimer) clearTimeout(ziweiGenerateTimer);
        flagRef.value = true;
        ziweiGenerateTimer = window.setTimeout(function() { flagRef.value = false; }, durationMs || 1400);
      }
    }

    function _setIdVerifyResult(type, text) {
      var normalizedInput = String(idVerifyInput.value || '').trim().toUpperCase();
      var signature = String(type || '') + '|' + String(text || '');
      if (normalizedInput && normalizedInput === idLastVerifyInput.value && signature === idLastVerifySignature.value) {
        idVerifyResult.value = { type: 'info', text: '\u5df2\u91cd\u65b0\u6821\u9a8c\uff0c\u7ed3\u679c\u4e0e\u4e0a\u6b21\u4e00\u81f4\uff1a' + text };
      } else {
        idVerifyResult.value = { type: type, text: text };
      }
      idLastVerifyInput.value = normalizedInput;
      idLastVerifySignature.value = signature;
      _flashButtonState(idVerifyDone, 'idVerify');
    }

    function _setUsccVerifyResult(type, text) {
      var normalizedInput = String(usccVerifyInput.value || '').trim().toUpperCase();
      var signature = String(type || '') + '|' + String(text || '');
      if (normalizedInput && normalizedInput === usccLastVerifyInput.value && signature === usccLastVerifySignature.value) {
        usccVerifyResult.value = { type: 'info', text: '\u5df2\u91cd\u65b0\u6821\u9a8c\uff0c\u7ed3\u679c\u4e0e\u4e0a\u6b21\u4e00\u81f4\uff1a' + text };
      } else {
        usccVerifyResult.value = { type: type, text: text };
      }
      usccLastVerifyInput.value = normalizedInput;
      usccLastVerifySignature.value = signature;
      _flashButtonState(usccVerifyDone, 'usccVerify');
    }

    function generateIdNumber() {
      if (!regionReady.value) {
        idGenerateResult.value = { type: 'error', text: regionLoadError.value || '行政区划数据尚未就绪，请稍后再试' };
        return;
      }
      var regionCode = _pickBestRegionCode(idProvinceCode.value, idCityCode.value, idCountyCode.value);
      if (!regionCode) {
        idGenerateResult.value = { type: 'error', text: '请选择有效的省市区' };
        return;
      }
      var ymd = _parseYmdFromIsoDate(idBirthDate.value);
      if (!ymd) {
        idGenerateResult.value = { type: 'error', text: '请输入合法的出生日期' };
        return;
      }
      if (!_validateBirthYmd8(ymd)) {
        idGenerateResult.value = { type: 'error', text: '出生日期不在合理范围内' };
        return;
      }
      var seq = _randomSeqByGender(idGender.value);
      var id17 = regionCode + ymd + seq;
      var check = _calcIdCheckDigit(id17);
      if (!check) {
        idGenerateResult.value = { type: 'error', text: '生成失败，请重试' };
        return;
      }
      idGeneratedNumber.value = id17 + check;
      idGenerateResult.value = { type: 'success', text: '已生成合法身份证号码' };
    }

    function validateIdNumber() {
      var rawInput = String(idVerifyInput.value || '').trim().toUpperCase();
      if (!rawInput) {
        _setIdVerifyResult('error', '\u8bf7\u8f93\u5165\u5f85\u6821\u9a8c\u7684\u8eab\u4efd\u8bc1\u53f7\u7801');
        return;
      }
      if (!/^\d{17}[\dX]$/.test(rawInput)) {
        _setIdVerifyResult('error', '\u683c\u5f0f\u9519\u8bef\uff1a\u5e94\u4e3a18\u4f4d\uff0817\u4f4d\u6570\u5b57 + \u6700\u540e1\u4f4d\u6570\u5b57\u6216X\uff09');
        return;
      }
      if (!regionCodeSet.value.has(rawInput.slice(0, 6))) {
        _setIdVerifyResult('error', '\u884c\u653f\u533a\u5212\u4ee3\u7801\u4e0d\u5b58\u5728\uff1a' + rawInput.slice(0, 6));
        return;
      }
      var birthYmd = rawInput.slice(6, 14);
      if (!_validateBirthYmd8(birthYmd)) {
        _setIdVerifyResult('error', '\u51fa\u751f\u65e5\u671f\u4e0d\u5408\u6cd5\uff1a' + birthYmd);
        return;
      }
      var expectedCheck = _calcIdCheckDigit(rawInput.slice(0, 17));
      if (!expectedCheck || expectedCheck !== rawInput[17]) {
        _setIdVerifyResult('error', '\u6821\u9a8c\u7801\u9519\u8bef\uff1a\u5e94\u4e3a ' + expectedCheck + '\uff0c\u5b9e\u9645\u4e3a ' + rawInput[17]);
        return;
      }
      _setIdVerifyResult('success', '\u6821\u9a8c\u901a\u8fc7\uff1a\u8eab\u4efd\u8bc1\u53f7\u7801\u5408\u6cd5');
      return;

    }

    function copyGeneratedIdNumber() {
      if (!idGeneratedNumber.value) {
        idGenerateResult.value = { type: 'info', text: '请先生成身份证号码' };
        return;
      }
      clipboardWrite(idGeneratedNumber.value).then(function(ok) {
        if (ok) _flashButtonState(idCopyDone, 'idCopy');
      });
      return;
    }

    function _calcUsccCheckChar(base17) {
      if (!/^[0-9A-HJ-NPQRTUWXY]{17}$/.test(base17)) return '';
      var sum = 0;
      for (var i = 0; i < 17; i++) {
        var v = usccCharIndexMap[base17[i]];
        if (typeof v !== 'number') return '';
        sum += v * USCC_WEIGHTS[i];
      }
      var checkIndex = (31 - (sum % 31)) % 31;
      return USCC_CHARSET[checkIndex];
    }

    function _randomUsccBody(len) {
      var out = '';
      for (var i = 0; i < len; i++) {
        out += USCC_CHARSET[_randomInt(0, USCC_CHARSET.length - 1)];
      }
      return out;
    }

    function _randomOrgCodeBody(len) {
      var out = '';
      for (var i = 0; i < len; i++) {
        out += ORG_CODE_CHARSET[_randomInt(0, ORG_CODE_CHARSET.length - 1)];
      }
      return out;
    }

    function _calcOrgCodeCheckChar(base8) {
      if (!/^[0-9A-Z]{8}$/.test(base8)) return '';
      var sum = 0;
      for (var i = 0; i < 8; i++) {
        var idx = ORG_CODE_CHARSET.indexOf(base8[i]);
        if (idx < 0) return '';
        sum += idx * ORG_CODE_WEIGHTS[i];
      }
      var c9 = 11 - (sum % 11);
      if (c9 === 10) return 'X';
      if (c9 === 11) return '0';
      if (c9 === 12) return '0';
      return String(c9);
    }

    function _generateLegacyThreeCert(regionCode) {
      var businessRegNo = String(regionCode) + String(_randomInt(0, 999999999)).padStart(9, '0');
      var orgBody = _randomOrgCodeBody(8);
      var orgCheck = _calcOrgCodeCheckChar(orgBody);
      if (!orgCheck) return null;
      var orgCode = orgBody + '-' + orgCheck;
      var taxNo = String(regionCode) + orgBody + orgCheck;
      return {
        businessRegNo: businessRegNo,
        orgCode: orgCode,
        taxNo: taxNo
      };
    }

    function _validateUscc18(raw) {
      if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(raw)) {
        return { ok: false, msg: '格式错误：应为18位，仅允许数字及大写字母（不含 I/O/S/V/Z）' };
      }
      if (!USCC_DEPT_ALLOWED.has(raw[0])) {
        return { ok: false, msg: '登记管理部门代码不合法：' + raw[0] };
      }
      if (!USCC_CHARSET.includes(raw[1])) {
        return { ok: false, msg: '机构类别代码不合法：' + raw[1] };
      }
      var regionCode = raw.slice(2, 8);
      if (!regionCodeSet.value.has(regionCode)) {
        return { ok: false, msg: '行政区划码不存在：' + regionCode };
      }
      var expected = _calcUsccCheckChar(raw.slice(0, 17));
      if (!expected || expected !== raw[17]) {
        return { ok: false, msg: '校验码错误：应为 ' + expected + '，实际为 ' + raw[17] };
      }
      return { ok: true, msg: '校验通过：统一社会信用代码合法' };
    }

    function _validateOrgCode(raw) {
      var normalized = String(raw || '').toUpperCase().replace(/-/g, '');
      if (!/^[0-9A-Z]{8}[0-9X]$/.test(normalized)) {
        return { ok: false, msg: '组织机构代码格式错误：应为 8位主体码 + 校验位（支持中划线）' };
      }
      var expected = _calcOrgCodeCheckChar(normalized.slice(0, 8));
      if (!expected || expected !== normalized[8]) {
        return { ok: false, msg: '组织机构代码校验位错误：应为 ' + expected + '，实际为 ' + normalized[8] };
      }
      return { ok: true, msg: '校验通过：组织机构代码合法' };
    }

    function _validateLegacy15(raw) {
      if (!/^\d{15}$/.test(raw)) {
        return { ok: false, msg: '旧版15位号码格式错误：应为15位数字' };
      }
      var regionCode = raw.slice(0, 6);
      if (!regionCodeSet.value.has(regionCode)) {
        return { ok: false, msg: '行政区划码不存在：' + regionCode };
      }
      return { ok: true, msg: '校验通过：15位旧版号码格式合法' };
    }

    function _validateUsccOrLegacyToken(raw) {
      if (/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(raw)) return _validateUscc18(raw);
      if (/^[0-9A-Z]{8}-?[0-9X]$/.test(raw)) return _validateOrgCode(raw);
      if (/^\d{15}$/.test(raw)) return _validateLegacy15(raw);
      return { ok: false, msg: '无法识别的编码格式：' + raw };
    }

    function generateUsccCode() {
      if (!regionReady.value) {
        usccGenerateResult.value = { type: 'error', text: regionLoadError.value || '行政区划数据尚未就绪，请稍后再试' };
        return;
      }
      if (!USCC_DEPT_ALLOWED.has(usccDeptCode.value)) {
        usccGenerateResult.value = { type: 'error', text: '登记管理部门代码无效' };
        return;
      }
      if (!USCC_CHARSET.includes(usccOrgTypeCode.value)) {
        usccGenerateResult.value = { type: 'error', text: '机构类别代码无效' };
        return;
      }
      var regionCode = _pickBestRegionCode(usccProvinceCode.value, usccCityCode.value, usccCountyCode.value);
      if (!regionCode) {
        usccGenerateResult.value = { type: 'error', text: '请选择有效的登记机关行政区划' };
        return;
      }
      if (usccCodeMode.value === 'legacy3') {
        var legacy = _generateLegacyThreeCert(regionCode);
        if (!legacy) {
          usccGenerateResult.value = { type: 'error', text: '旧版三证生成失败，请重试' };
          return;
        }
        usccLegacyGenerated.value = legacy;
        usccGeneratedCode.value = legacy.businessRegNo;
        usccCopyPayload.value =
          '工商注册号：' + legacy.businessRegNo + '\n' +
          '组织机构代码：' + legacy.orgCode + '\n' +
          '税务登记号：' + legacy.taxNo;
        usccGenerateResult.value = { type: 'success', text: '已生成旧版三证号码（工商/组织机构/税务）' };
        return;
      }
      var body9 = _randomUsccBody(9);
      var base17 = String(usccDeptCode.value) + String(usccOrgTypeCode.value) + regionCode + body9;
      var check = _calcUsccCheckChar(base17);
      if (!check) {
        usccGenerateResult.value = { type: 'error', text: '生成失败，请重试' };
        return;
      }
      usccLegacyGenerated.value = null;
      usccGeneratedCode.value = base17 + check;
      usccCopyPayload.value = usccGeneratedCode.value;
      usccGenerateResult.value = { type: 'success', text: '已生成统一社会信用代码' };
    }

    function validateUsccCode() {
      var rawInput = String(usccVerifyInput.value || '').trim().toUpperCase();
      if (!rawInput) {
        _setUsccVerifyResult('error', '\u8bf7\u8f93\u5165\u5f85\u6821\u9a8c\u7684\u4ee3\u7801');
        return;
      }
      var tokens = rawInput.match(/[0-9A-HJ-NPQRTUWXY]{18}|[0-9A-Z]{8}-?[0-9X]|\d{15}/g);
      if (tokens && tokens.length > 1) {
        var lines = [];
        var allOk = true;
        for (var idx = 0; idx < tokens.length; idx++) {
          var token = tokens[idx];
          var checkRes = _validateUsccOrLegacyToken(token);
          lines.push((checkRes.ok ? '\u221a ' : '\u00d7 ') + token + '\uff1a' + checkRes.msg.replace(/^\u6821\u9a8c\u901a\u8fc7\uff1a/, ''));
          if (!checkRes.ok) allOk = false;
        }
        _setUsccVerifyResult(allOk ? 'success' : 'info', lines.join('\uff1b'));
        return;
      }
      var verifyRes = _validateUsccOrLegacyToken(rawInput);
      _setUsccVerifyResult(verifyRes.ok ? 'success' : 'error', verifyRes.msg);
      return;

    }

    function copyGeneratedUsccCode() {
      var payload = String(usccCopyPayload.value || usccGeneratedCode.value || '').trim();
      if (!payload) {
        usccGenerateResult.value = { type: 'info', text: '请先生成代码' };
        return;
      }
      clipboardWrite(payload).then(function(ok) {
        if (ok) _flashButtonState(usccCopyDone, 'usccCopy');
      });
      return;
    }

    function _zwNormalizeSolarDay() {
      var year = Number(ziweiSolarYear.value || '1990');
      var month = Number(ziweiSolarMonth.value || '1');
      var day = Number(ziweiSolarDay.value || '1');
      if (!Number.isInteger(year) || year < 1900) year = 1900;
      if (year > 2100) year = 2100;
      if (!Number.isInteger(month) || month < 1 || month > 12) month = 1;
      var max = new Date(year, month, 0).getDate();
      if (!Number.isInteger(day) || day < 1) day = 1;
      if (day > max) day = max;
      ziweiSolarYear.value = String(year);
      ziweiSolarMonth.value = String(month).padStart(2, '0');
      ziweiSolarDay.value = String(day).padStart(2, '0');
    }

    function _zwNormalizeLunarInput() {
      var year = Number(ziweiLunarYear.value || '1990');
      var month = Number(ziweiLunarMonth.value || '1');
      var day = Number(ziweiLunarDay.value || '1');
      if (!Number.isInteger(year) || year < 1900) year = 1900;
      if (year > 2100) year = 2100;
      if (!Number.isInteger(month) || month < 1 || month > 12) month = 1;
      var leapMonth = _zwGetLeapMonth(year);
      var canLeap = leapMonth > 0 && leapMonth === month;
      if (ziweiLunarLeap.value && !canLeap) ziweiLunarLeap.value = false;
      var maxDay = _zwGetLunarMonthDays(year, month, !!ziweiLunarLeap.value);
      if (!Number.isInteger(maxDay) || maxDay < 29 || maxDay > 30) maxDay = 30;
      if (!Number.isInteger(day) || day < 1) day = 1;
      if (day > maxDay) day = maxDay;
      ziweiLunarYear.value = String(year);
      ziweiLunarMonth.value = String(month);
      ziweiLunarDay.value = String(day);
    }

    function _zwRingIndex(branch) {
      return ZW_RING.indexOf(branch);
    }

    function _zwOffset(branch, step) {
      var idx = _zwRingIndex(branch);
      if (idx < 0) return '';
      var next = (idx + step) % 12;
      if (next < 0) next += 12;
      return ZW_RING[next];
    }

    function _zwGetShiChenIndex0(hour) {
      var h = Number(hour);
      if (!Number.isInteger(h) || h < 0 || h > 23) return -1;
      if (h === 23 || h === 0) return 0;
      return Math.floor((h + 1) / 2);
    }

    function _zwGetShiChenLabel(hour) {
      var idx = _zwGetShiChenIndex0(hour);
      if (idx < 0 || idx >= ZW_SHICHEN_NAMES.length) return '';
      return ZW_SHICHEN_NAMES[idx] + '时';
    }

    function _zwParseLunarParts(dateObj) {
      if (!_zwLunarFmt || !(dateObj instanceof Date)) return null;
      if (Number.isNaN(dateObj.getTime())) return null;
      var parts = _zwLunarFmt.formatToParts(dateObj);
      var monthRaw = '';
      var dayRaw = '';
      var yearRaw = '';
      parts.forEach(function(part) {
        if (!part || typeof part.value !== 'string') return;
        if (part.type === 'month') monthRaw = part.value;
        if (part.type === 'day') dayRaw = part.value;
        if (part.type === 'relatedYear' || part.type === 'year') yearRaw = part.value;
      });
      var monthNum = Number(String(monthRaw).replace(/[^0-9]/g, ''));
      var dayNum = Number(String(dayRaw).replace(/[^0-9]/g, ''));
      var yearNum = Number(String(yearRaw).replace(/[^0-9]/g, ''));
      if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) return null;
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 30) return null;
      if (!Number.isInteger(yearNum) || yearNum < 1800 || yearNum > 2200) return null;
      return {
        lunarYear: yearNum,
        lunarMonth: monthNum,
        lunarDay: dayNum,
        isLeapMonth: /bis/i.test(monthRaw)
      };
    }

    function _zwSolarToLunar(year, month, day) {
      var y = Number(year);
      var m = Number(month);
      var d = Number(day);
      if (!_isValidDateParts(y, m, d)) return null;
      var key = String(y) + '-' + String(m) + '-' + String(d);
      if (_zwSolarToLunarCache.has(key)) return _zwSolarToLunarCache.get(key);
      var dateObj = new Date(y, m - 1, d, 12, 0, 0, 0);
      var lunar = _zwParseLunarParts(dateObj);
      _zwSolarToLunarCache.set(key, lunar);
      return lunar;
    }

    function _zwLunarToSolar(lunarYear, lunarMonth, lunarDay, isLeapMonth) {
      var ly = Number(lunarYear);
      var lm = Number(lunarMonth);
      var ld = Number(lunarDay);
      var leap = !!isLeapMonth;
      if (!Number.isInteger(ly) || ly < 1900 || ly > 2100) return null;
      if (!Number.isInteger(lm) || lm < 1 || lm > 12) return null;
      if (!Number.isInteger(ld) || ld < 1 || ld > 30) return null;
      var key = [ly, lm, ld, leap ? 1 : 0].join('-');
      if (_zwLunarToSolarCache.has(key)) return _zwLunarToSolarCache.get(key);
      var start = new Date(ly - 1, 10, 1, 12, 0, 0, 0);
      var end = new Date(ly + 1, 2, 1, 12, 0, 0, 0);
      var result = null;
      for (var ts = start.getTime(); ts <= end.getTime(); ts += 86400000) {
        var solarDate = new Date(ts);
        var lunar = _zwParseLunarParts(solarDate);
        if (!lunar) continue;
        if (lunar.lunarYear !== ly) continue;
        if (lunar.lunarMonth !== lm) continue;
        if (lunar.lunarDay !== ld) continue;
        if (lunar.isLeapMonth !== leap) continue;
        result = {
          year: solarDate.getFullYear(),
          month: solarDate.getMonth() + 1,
          day: solarDate.getDate()
        };
        break;
      }
      _zwLunarToSolarCache.set(key, result);
      return result;
    }

    function _zwGetLeapMonth(lunarYear) {
      var year = Number(lunarYear);
      if (!Number.isInteger(year) || year < 1900 || year > 2100) return 0;
      if (_zwLeapMonthCache.has(year)) return _zwLeapMonthCache.get(year);
      var start = new Date(year - 1, 10, 1, 12, 0, 0, 0);
      var end = new Date(year + 1, 2, 1, 12, 0, 0, 0);
      var leapMonth = 0;
      for (var ts = start.getTime(); ts <= end.getTime(); ts += 86400000) {
        var lunar = _zwParseLunarParts(new Date(ts));
        if (!lunar || lunar.lunarYear !== year || !lunar.isLeapMonth) continue;
        leapMonth = lunar.lunarMonth;
        break;
      }
      _zwLeapMonthCache.set(year, leapMonth);
      return leapMonth;
    }

    function _zwGetLunarMonthDays(lunarYear, lunarMonth, isLeapMonth) {
      var year = Number(lunarYear);
      var month = Number(lunarMonth);
      var leap = !!isLeapMonth;
      if (!Number.isInteger(year) || year < 1900 || year > 2100) return 30;
      if (!Number.isInteger(month) || month < 1 || month > 12) return 30;
      var key = [year, month, leap ? 1 : 0].join('-');
      if (_zwLunarMonthDaysCache.has(key)) return _zwLunarMonthDaysCache.get(key);
      var start = new Date(year - 1, 10, 1, 12, 0, 0, 0);
      var end = new Date(year + 1, 2, 1, 12, 0, 0, 0);
      var maxDay = 0;
      for (var ts = start.getTime(); ts <= end.getTime(); ts += 86400000) {
        var lunar = _zwParseLunarParts(new Date(ts));
        if (!lunar || lunar.lunarYear !== year) continue;
        if (lunar.lunarMonth !== month || lunar.isLeapMonth !== leap) continue;
        if (lunar.lunarDay > maxDay) maxDay = lunar.lunarDay;
      }
      if (maxDay !== 29 && maxDay !== 30) maxDay = 30;
      _zwLunarMonthDaysCache.set(key, maxDay);
      return maxDay;
    }

    function _zwSolarAddDays(solar, deltaDays) {
      if (!solar) return null;
      var d = new Date(Number(solar.year), Number(solar.month) - 1, Number(solar.day), 12, 0, 0, 0);
      if (Number.isNaN(d.getTime())) return null;
      d.setDate(d.getDate() + Number(deltaDays || 0));
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate()
      };
    }

    function _zwComputeExactAge(birthYear, birthMonth, birthDay, nowDate) {
      var y = Number(birthYear);
      var m = Number(birthMonth);
      var d = Number(birthDay);
      var now = nowDate instanceof Date ? nowDate : new Date();
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return NaN;
      if (Number.isNaN(now.getTime())) return NaN;
      var age = now.getFullYear() - y;
      var nm = now.getMonth() + 1;
      var nd = now.getDate();
      if (nm < m || (nm === m && nd < d)) age -= 1;
      return age;
    }

    function _zwClockModeToLabel(mode) {
      return mode === 'trueSolar' ? '真太阳时（经度+时差方程）' : '标准时间';
    }

    function _zwXiaoXianRuleToLabel(rule) {
      return rule === 'mingStart' ? '命宫起小限（简化）' : '年支起小限（传统）';
    }

    function _zwLiuNianRuleToLabel(rule) {
      return rule === 'followDaXian' ? '随大限顺逆' : '年支顺排（默认）';
    }

    function _zwGetDayOfYear(year, month, day) {
      var y = Number(year);
      var m = Number(month);
      var d = Number(day);
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return NaN;
      var start = new Date(y, 0, 1, 12, 0, 0, 0);
      var target = new Date(y, m - 1, d, 12, 0, 0, 0);
      if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime())) return NaN;
      var diffDays = Math.floor((target.getTime() - start.getTime()) / 86400000) + 1;
      return diffDays;
    }

    function _zwComputeEquationOfTimeMinutes(year, month, day) {
      var n = _zwGetDayOfYear(year, month, day);
      if (!Number.isInteger(n) || n < 1 || n > 366) return 0;
      var b = (2 * Math.PI * (n - 81)) / 364;
      return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    }

    function _zwApplyClockCorrection(baseSolar, hour, minute, mode, longitudeRaw, timezoneRaw) {
      if (!baseSolar) return { ok: false, error: '出生日期缺失，无法校时。' };
      var h = Number(hour);
      var min = Number(minute);
      if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(min) || min < 0 || min > 59) {
        return { ok: false, error: '出生时分不合法，无法校时。' };
      }
      var dateObj = new Date(Number(baseSolar.year), Number(baseSolar.month) - 1, Number(baseSolar.day), h, min, 0, 0);
      if (Number.isNaN(dateObj.getTime())) {
        return { ok: false, error: '出生日期无效，无法校时。' };
      }
      var correctionMinutes = 0;
      var longitudeCorrectionMinutes = 0;
      var equationOfTimeMinutes = 0;
      var longitude = null;
      var timezoneOffset = null;
      if (mode === 'trueSolar') {
        longitude = Number(longitudeRaw);
        timezoneOffset = Number(timezoneRaw);
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          return { ok: false, error: '真太阳时校正失败：经度需在 -180 到 180 之间。' };
        }
        if (!Number.isFinite(timezoneOffset) || timezoneOffset < -12 || timezoneOffset > 14) {
          return { ok: false, error: '真太阳时校正失败：时区需在 UTC-12 到 UTC+14 之间。' };
        }
        var centralMeridian = timezoneOffset * 15;
        longitudeCorrectionMinutes = (longitude - centralMeridian) * 4;
        equationOfTimeMinutes = _zwComputeEquationOfTimeMinutes(baseSolar.year, baseSolar.month, baseSolar.day);
        correctionMinutes = longitudeCorrectionMinutes + equationOfTimeMinutes;
        var shiftMs = Math.round(correctionMinutes * 60000);
        dateObj = new Date(dateObj.getTime() + shiftMs);
        correctionMinutes = shiftMs / 60000;
      }
      return {
        ok: true,
        mode: mode === 'trueSolar' ? 'trueSolar' : 'standard',
        correctionMinutes: correctionMinutes,
        longitudeCorrectionMinutes: longitudeCorrectionMinutes,
        equationOfTimeMinutes: equationOfTimeMinutes,
        longitude: longitude,
        timezoneOffset: timezoneOffset,
        solar: {
          year: dateObj.getFullYear(),
          month: dateObj.getMonth() + 1,
          day: dateObj.getDate()
        },
        hour: dateObj.getHours(),
        minute: dateObj.getMinutes()
      };
    }

    function _zwGetYearGanZhi(lunarYear) {
      var y = Number(lunarYear);
      if (!Number.isInteger(y)) return '';
      var stem = ZW_STEMS[(y - 4) % 10 >= 0 ? (y - 4) % 10 : ((y - 4) % 10) + 10];
      var branch = ZW_BRANCHES[(y - 4) % 12 >= 0 ? (y - 4) % 12 : ((y - 4) % 12) + 12];
      return String(stem || '') + String(branch || '');
    }

    function _zwMod(n, m) {
      var x = Number(n);
      var y = Number(m);
      if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return 0;
      var r = x % y;
      return r < 0 ? r + y : r;
    }

    function _zwGetMonthBranchByLunarMonth(lunarMonth) {
      var m = Number(lunarMonth);
      if (!Number.isInteger(m) || m < 1 || m > 12) m = 1;
      return ZW_RING[m - 1] || '寅';
    }

    // Approximation for jieqi month branch:
    // 1) Feb starts 寅月, Jan is 丑月
    // 2) If day<4, fallback to previous month branch to reduce boundary error.
    function _zwGetMonthBranchBySolarApprox(solarMonth, solarDay) {
      var sm = Number(solarMonth);
      var sd = Number(solarDay);
      if (!Number.isInteger(sm) || sm < 1 || sm > 12) sm = 1;
      if (!Number.isInteger(sd) || sd < 1 || sd > 31) sd = 15;
      var idx = _zwMod(sm + 10, 12);
      if (sd < 4) idx = _zwMod(idx - 1, 12);
      return ZW_RING[idx] || '寅';
    }

    function _zwGetMonthGanZhiByYearStem(yearStem, monthBranch) {
      var ys = String(yearStem || '').slice(0, 1);
      var mb = String(monthBranch || '');
      var startStem = ZW_WUHU_START_STEM[ys] || '丙';
      var startIdx = ZW_STEMS.indexOf(startStem);
      if (startIdx < 0) startIdx = 2;
      var monthIndex = ZW_RING.indexOf(mb);
      if (monthIndex < 0) monthIndex = 0;
      var stem = ZW_STEMS[_zwMod(startIdx + monthIndex, 10)] || '';
      return stem + mb;
    }

    // Gregorian -> day ganzhi (1900-2100 practical range).
    function _zwGetDayGanZhiBySolar(year, month, day) {
      var y = Number(year);
      var m = Number(month);
      var d = Number(day);
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '';
      if (m < 1 || m > 12 || d < 1 || d > 31) return '';
      var yy = y;
      var mm = m;
      if (mm <= 2) {
        yy -= 1;
        mm += 12;
      }
      var c = Math.floor(yy / 100);
      var y2 = yy % 100;
      var g = _zwMod((4 * c) + Math.floor(c / 4) + 5 * y2 + Math.floor(y2 / 4) + Math.floor((3 * (mm + 1)) / 5) + d - 3, 10);
      var z = _zwMod((8 * c) + Math.floor(c / 4) + 5 * y2 + Math.floor(y2 / 4) + Math.floor((3 * (mm + 1)) / 5) + d + 7, 12);
      return (ZW_STEMS[g] || '') + (ZW_BRANCHES[z] || '');
    }

    function _zwGetHourGanZhiByDayGan(dayGanZhi, hour) {
      var gz = String(dayGanZhi || '');
      if (!gz) return '';
      var dayStem = gz.slice(0, 1);
      var baseStem = '甲';
      if (dayStem === '甲' || dayStem === '己') baseStem = '甲';
      else if (dayStem === '乙' || dayStem === '庚') baseStem = '丙';
      else if (dayStem === '丙' || dayStem === '辛') baseStem = '戊';
      else if (dayStem === '丁' || dayStem === '壬') baseStem = '庚';
      else if (dayStem === '戊' || dayStem === '癸') baseStem = '壬';
      var baseStemIdx = ZW_STEMS.indexOf(baseStem);
      if (baseStemIdx < 0) baseStemIdx = 0;
      var idx0 = _zwGetShiChenIndex0(hour);
      if (idx0 < 0) idx0 = 0;
      var stem = ZW_STEMS[_zwMod(baseStemIdx + idx0, 10)] || '';
      var branch = ZW_BRANCHES[idx0] || '';
      return stem + branch;
    }

    function _zwSplitGanZhi(gz) {
      var text = String(gz || '');
      return {
        stem: text.slice(0, 1) || '--',
        branch: text.slice(1, 2) || '--',
        text: text || '--'
      };
    }

    function _zwGetJieQiYearApprox(solarYear, solarMonth, solarDay) {
      var y = Number(solarYear);
      var m = Number(solarMonth);
      var d = Number(solarDay);
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return y;
      if (m < 2 || (m === 2 && d < 4)) return y - 1;
      return y;
    }

    function _zwResolveBureauByGanZhi(gz) {
      var nayin = ZW_NAYIN_BY_JIAZI[gz] || '';
      var element = '';
      if (nayin.indexOf('水') >= 0) element = '水';
      else if (nayin.indexOf('木') >= 0) element = '木';
      else if (nayin.indexOf('金') >= 0) element = '金';
      else if (nayin.indexOf('土') >= 0) element = '土';
      else if (nayin.indexOf('火') >= 0) element = '火';
      var bureau = ZW_BUREAU_BY_ELEMENT[element] || 5;
      return { element: element || '土', bureau: bureau, nayin: nayin || '' };
    }

    function _zwLocateZiWeiPos(lunarDay, bureauNum) {
      var day = Number(lunarDay);
      var bureau = Number(bureauNum);
      if (!Number.isInteger(day) || day < 1) day = 1;
      if (day > 30) day = 30;
      if (!Number.isInteger(bureau) || bureau < 2) bureau = 5;
      var q = Math.floor(day / bureau);
      var r = day % bureau;
      var pos;
      if (r === 0) {
        pos = q;
      } else {
        pos = q + 1;
        var needOdd = bureau - r;
        while (needOdd > 0) {
          pos += 1;
          var normalized = ((pos - 1) % 12 + 12) % 12 + 1;
          if (normalized % 2 === 1) needOdd -= 1;
        }
      }
      return ((pos - 1) % 12 + 12) % 12 + 1;
    }

    function _zwInstallTwelvePalaces(mingBranch) {
      var result = {};
      for (var i = 0; i < ZW_PALACE_NAMES.length; i++) {
        var branch = _zwOffset(mingBranch, -i);
        if (branch) result[branch] = ZW_PALACE_NAMES[i];
      }
      return result;
    }

    function _zwBuildBranchStemMap(yearStem) {
      var startStem = ZW_WUHU_START_STEM[yearStem] || '丙';
      var startIdx = ZW_STEMS.indexOf(startStem);
      if (startIdx < 0) startIdx = 2;
      var map = {};
      for (var i = 0; i < ZW_RING.length; i++) {
        map[ZW_RING[i]] = ZW_STEMS[(startIdx + i) % 10];
      }
      return map;
    }

    function _zwBuildDaXianMap(mingBranch, startAge, direction) {
      var out = {};
      var dir = direction >= 0 ? 1 : -1;
      for (var i = 0; i < 12; i++) {
        var branch = _zwOffset(mingBranch, dir * i);
        var from = startAge + (i * 10);
        out[branch] = String(from) + '-' + String(from + 9);
      }
      return out;
    }

    function _zwBuildXiaoXianMap(yearBranch, gender, mingBranch, ruleType) {
      var type = ruleType === 'mingStart' ? 'mingStart' : 'yearBranch';
      var start = '辰';
      var dir = 1;
      if (type === 'mingStart') {
        start = mingBranch || '寅';
        dir = (gender === 'female' ? -1 : 1);
      } else {
        var rule = ZW_SMALL_LIMIT_RULE_MALE[yearBranch] || { start: '辰', dir: 1 };
        start = rule.start;
        dir = (gender === 'female' ? -rule.dir : rule.dir);
      }
      var out = {};
      for (var age = 1; age <= 12; age++) {
        var branch = _zwOffset(start, dir * (age - 1));
        out[branch] = String(age) + '岁';
      }
      return out;
    }

    function _zwParseAgeValue(value) {
      var text = String(value || '');
      var m = text.match(/\d+/);
      return m ? Number(m[0]) : NaN;
    }

    function _zwBuildAgeSeries(firstAge, maxAge, step) {
      var first = Number(firstAge);
      var max = Number(maxAge);
      var jump = Number(step || 12);
      if (!Number.isInteger(first) || first < 1) return [];
      if (!Number.isInteger(max) || max < first) max = first;
      if (!Number.isInteger(jump) || jump < 1) jump = 12;
      var out = [];
      for (var age = first; age <= max; age += jump) out.push(age);
      return out;
    }

    function _zwBuildLiuNianFirstAgeMap(yearBranch, direction, ruleType) {
      var out = {};
      var type = ruleType === 'followDaXian' ? 'followDaXian' : 'yearForward';
      var dir = type === 'followDaXian'
        ? (direction >= 0 ? 1 : -1)
        : 1;
      for (var i = 0; i < 12; i++) {
        var branch = _zwOffset(yearBranch, dir * i);
        out[branch] = i + 1;
      }
      return out;
    }

    function _zwBuildChangShengMap(element) {
      var startBranch = ZW_CHANGSHENG_START_BY_ELEMENT[element] || '申';
      var out = {};
      for (var i = 0; i < ZW_CHANGSHENG_NAMES.length; i++) {
        var branch = _zwOffset(startBranch, i);
        out[branch] = ZW_CHANGSHENG_NAMES[i];
      }
      return out;
    }

    function _zwBuildDaXianTimeline(mingBranch, startAge, direction, palaceNameByBranch, count) {
      var total = Number(count || 10);
      if (!Number.isInteger(total) || total < 1) total = 10;
      var dir = direction >= 0 ? 1 : -1;
      var out = [];
      for (var i = 0; i < total; i++) {
        var branch = _zwOffset(mingBranch, dir * i);
        var from = Number(startAge) + (i * 10);
        out.push({
          branch: branch,
          palaceName: (palaceNameByBranch && palaceNameByBranch[branch]) || '',
          range: String(from) + '-' + String(from + 9)
        });
      }
      return out;
    }

    function _zwFindLiuNianBranchByAge(liuNianFirstAgeMap, age) {
      var map = liuNianFirstAgeMap || {};
      var targetAge = Number(age);
      if (!Number.isInteger(targetAge) || targetAge < 1) return '';
      var keys = Object.keys(map);
      for (var i = 0; i < keys.length; i++) {
        var branch = keys[i];
        var first = Number(map[branch]);
        if (!Number.isInteger(first) || first < 1) continue;
        if (targetAge >= first && ((targetAge - first) % 12 === 0)) return branch;
      }
      return '';
    }

    function _zwBuildLiuNianTimeline(birthSolarYear, startAge, count, liuNianFirstAgeMap, palaceNameByBranch) {
      var baseYear = Number(birthSolarYear);
      var age0 = Number(startAge);
      var total = Number(count || 10);
      if (!Number.isInteger(baseYear)) baseYear = new Date().getFullYear();
      if (!Number.isInteger(age0) || age0 < 1) age0 = 1;
      if (!Number.isInteger(total) || total < 1) total = 10;
      var out = [];
      for (var i = 0; i < total; i++) {
        var age = age0 + i;
        var year = baseYear + age - 1;
        var branch = _zwFindLiuNianBranchByAge(liuNianFirstAgeMap, age);
        out.push({
          year: year,
          age: age,
          ganzhi: _zwGetYearGanZhi(year),
          branch: branch,
          palaceName: (palaceNameByBranch && palaceNameByBranch[branch]) || ''
        });
      }
      return out;
    }

    function _zwBuildHuaTracks(school, yearStem, yearBranch, branchStemMap, starBranchMap, palaceNameByBranch) {
      var tracks = [];
      function appendTrack(item, sourceBranch, sourceStem, sourceLabel) {
        if (!item) return;
        var star = item.star;
        var targetBranch = starBranchMap[star] || '';
        var sourcePalace = sourceBranch ? (palaceNameByBranch[sourceBranch] || '') : '';
        var targetPalace = targetBranch ? (palaceNameByBranch[targetBranch] || '') : '';
        tracks.push({
          tag: item.tag,
          star: star,
          sourceBranch: sourceBranch || '',
          sourceStem: sourceStem || '',
          sourceLabel: sourceLabel || '',
          sourcePalaceName: sourcePalace,
          targetBranch: targetBranch,
          targetPalaceName: targetPalace,
          sourceText: sourceBranch ? (sourceBranch + (sourcePalace ? (' ' + sourcePalace) : '')) : (sourceLabel || ''),
          targetText: targetBranch ? (targetBranch + (targetPalace ? (' ' + targetPalace) : '')) : '未知宫位',
          traceText: (sourceBranch ? sourceBranch : (sourceLabel || '生年')) + ' → ' + (targetBranch || '未知')
        });
      }

      if (school === 'flying') {
        ZW_RING.forEach(function(branch) {
          var stem = (branchStemMap && branchStemMap[branch]) || '';
          var rule = ZW_HUA_BY_STEM[stem];
          if (!rule) return;
          ZW_HUA_TAG_ITEMS.forEach(function(def) {
            appendTrack({
              tag: def.tag,
              star: rule[def.key]
            }, branch, stem, '宫干飞化');
          });
        });
      } else {
        var yearRule = ZW_HUA_BY_STEM[yearStem];
        if (yearRule) {
          ZW_HUA_TAG_ITEMS.forEach(function(def) {
            appendTrack({
              tag: def.tag,
              star: yearRule[def.key]
            }, yearBranch, yearStem, '生年四化');
          });
        }
      }
      return tracks;
    }

    function _zwGetCellByPalaceName(chart, palaceName) {
      if (!chart || !Array.isArray(chart.boardCells)) return null;
      for (var i = 0; i < chart.boardCells.length; i++) {
        if (chart.boardCells[i] && chart.boardCells[i].palaceName === palaceName) return chart.boardCells[i];
      }
      return null;
    }

    function _zwGetCellByBranch(chart, branch) {
      if (!chart || !Array.isArray(chart.boardCells)) return null;
      for (var i = 0; i < chart.boardCells.length; i++) {
        if (chart.boardCells[i] && chart.boardCells[i].branch === branch) return chart.boardCells[i];
      }
      return null;
    }

    function _zwStarsBrief(cell, limit) {
      if (!cell) return '无';
      var names = [];
      (cell.mainStars || []).forEach(function(s) { if (s && s.name) names.push(s.name); });
      if (!names.length) return '无主星';
      var max = Number(limit || 3);
      if (!Number.isInteger(max) || max < 1) max = 3;
      return names.slice(0, max).join('、');
    }

    function _zwEstimatePalaceScore(cell) {
      if (!cell) return 0;
      var score = 0;
      (cell.mainStars || []).forEach(function(star) {
        var lv = String((star && star.brightness) || '');
        if (lv === '庙') score += 3;
        else if (lv === '旺') score += 2;
        else if (lv === '得') score += 1;
        else if (lv === '陷') score -= 2;
      });
      return score;
    }

    function _zwBuildAnalysis(chart) {
      if (!chart) return [];
      var sections = [];
      var ming = _zwGetCellByPalaceName(chart, '命宫');
      var guan = _zwGetCellByPalaceName(chart, '官禄宫');
      var cai = _zwGetCellByPalaceName(chart, '财帛宫');
      var fuqi = _zwGetCellByPalaceName(chart, '夫妻宫');
      var qianyi = _zwGetCellByPalaceName(chart, '迁移宫');
      var jiebing = _zwGetCellByPalaceName(chart, '疾厄宫');

      var mingScore = _zwEstimatePalaceScore(ming);
      var mingTone = mingScore >= 4 ? '主星格局偏强' : mingScore >= 1 ? '主星格局中上' : mingScore >= -1 ? '主星格局中平' : '主星格局偏保守';
      sections.push({
        key: 'core',
        title: '命格总览',
        text: '命宫位于' + (chart.center.mingBranch || '--') + '，主星为' + _zwStarsBrief(ming, 4) + '，' + mingTone + '。身宫落在' + (chart.center.shenPalaceName || '--') + '，处事倾向会更多体现在该宫位主题上。'
      });

      sections.push({
        key: 'career',
        title: '事业发展',
        text: '官禄宫主星' + _zwStarsBrief(guan, 3) + '，财帛宫主星' + _zwStarsBrief(cai, 3) + '。建议把职业路径与变现方式联动规划，优先选择能沉淀专业势能的赛道。'
      });
      sections.push({
        key: 'relation',
        title: '关系与合作',
        text: '夫妻宫主星' + _zwStarsBrief(fuqi, 3) + '，迁移宫主星' + _zwStarsBrief(qianyi, 3) + '。在人际协作中，先定边界再谈投入，会更稳。'
      });
      sections.push({
        key: 'health',
        title: '节奏与健康',
        text: '疾厄宫主星' + _zwStarsBrief(jiebing, 3) + '。建议以“稳定作息 + 持续运动 + 定期体检”作为长期底盘，避免阶段性透支。'
      });
      sections.push({
        key: 'school',
        title: '流派说明',
        text: (chart.center.schoolLabel || '传统四化') + '模式已启用。若观察飞化影响，建议结合“飞化落宫追踪”面板与三方四正一起判断。'
      });
      if (chart.center.huaSummary && chart.center.huaSummary.length) {
        sections.push({
          key: 'hua',
          title: '四化提示',
          text: '本命四化为：' + chart.center.huaSummary.map(function(item) { return item.label; }).join('、') + '。实际判断建议结合大限与流年同宫星曜综合看。'
        });
      }
      return sections;
    }

    function _zwBuildAnalysisPro(chart) {
      if (!chart || !chart.center) return [];

      function scoreLevel(score) {
        if (score >= 6) return { grade: '强势', tone: '主轴驱动力高，适合主动承担关键职责与放大影响力。' };
        if (score >= 2) return { grade: '稳健', tone: '整体结构较均衡，适合稳步积累、持续升级。' };
        if (score >= 0) return { grade: '中平', tone: '宜稳扎稳打，避免连续高压和多线并行透支。' };
        return { grade: '保守', tone: '先做风控与底盘修复，再考虑扩张与加杠杆。' };
      }

      function starsWithBrightness(cell, limit) {
        if (!cell || !Array.isArray(cell.mainStars) || !cell.mainStars.length) return '无主星';
        var max = Number(limit || 3);
        if (!Number.isInteger(max) || max < 1) max = 3;
        return cell.mainStars.slice(0, max).map(function(star) {
          if (!star || !star.name) return '';
          return star.brightness ? (star.name + '(' + star.brightness + ')') : star.name;
        }).filter(Boolean).join('、') || '无主星';
      }

      function branchPalaceLabel(branch) {
        var cell = _zwGetCellByBranch(chart, branch);
        if (!cell) return branch || '--';
        return String(branch || '--') + '宫' + (cell.palaceName ? ('·' + cell.palaceName) : '');
      }

      function allStarNames(cell) {
        if (!cell) return [];
        var list = [];
        function pushFrom(arr) {
          (arr || []).forEach(function(star) {
            if (star && star.name) list.push(star.name);
          });
        }
        pushFrom(cell.mainStars);
        pushFrom(cell.assistStars);
        pushFrom(cell.miscStars);
        return list;
      }

      function hasStar(cell, name) {
        if (!cell || !name) return false;
        return allStarNames(cell).indexOf(name) >= 0;
      }

      function hasAnyStar(cell, names) {
        if (!Array.isArray(names) || !names.length) return false;
        for (var i = 0; i < names.length; i++) {
          if (hasStar(cell, names[i])) return true;
        }
        return false;
      }

      function hasHuaTag(cell, tag) {
        if (!cell || !tag) return false;
        var groups = [cell.mainStars, cell.assistStars, cell.miscStars];
        for (var i = 0; i < groups.length; i++) {
          var arr = groups[i] || [];
          for (var j = 0; j < arr.length; j++) {
            var star = arr[j];
            if (!star || !Array.isArray(star.huaTags)) continue;
            if (star.huaTags.indexOf(tag) >= 0) return true;
          }
        }
        return false;
      }

      function parseRange(rangeText) {
        var text = String(rangeText || '');
        var m = text.match(/(\d+)\s*-\s*(\d+)/);
        if (!m) return null;
        var from = Number(m[1]);
        var to = Number(m[2]);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
        return { from: from, to: to };
      }

      function pickActiveDaXian(timeline, age) {
        var list = Array.isArray(timeline) ? timeline : [];
        for (var i = 0; i < list.length; i++) {
          var item = list[i];
          if (!item) continue;
          var range = parseRange(item.range);
          if (!range) continue;
          if (age >= range.from && age <= range.to) return item;
        }
        return list.length ? list[0] : null;
      }

      function pickCurrentLiuNianCell(cells, age) {
        var list = Array.isArray(cells) ? cells : [];
        for (var i = 0; i < list.length; i++) {
          var cell = list[i];
          if (!cell || !Array.isArray(cell.liuNianSeries)) continue;
          if (cell.liuNianSeries.indexOf(age) >= 0) return cell;
        }
        return null;
      }

      var ming = _zwGetCellByPalaceName(chart, '命宫');
      var guan = _zwGetCellByPalaceName(chart, '官禄宫');
      var cai = _zwGetCellByPalaceName(chart, '财帛宫');
      var fuqi = _zwGetCellByPalaceName(chart, '夫妻宫');
      var qianyi = _zwGetCellByPalaceName(chart, '迁移宫');
      var jiebing = _zwGetCellByPalaceName(chart, '疾厄宫');
      var fude = _zwGetCellByPalaceName(chart, '福德宫');

      var mingScore = _zwEstimatePalaceScore(ming);
      var guanScore = _zwEstimatePalaceScore(guan);
      var caiScore = _zwEstimatePalaceScore(cai);
      var relationScore = _zwEstimatePalaceScore(fuqi) + _zwEstimatePalaceScore(qianyi);
      var healthScore = _zwEstimatePalaceScore(jiebing) + _zwEstimatePalaceScore(fude);
      var careerScore = guanScore + caiScore;

      var coreLevel = scoreLevel(mingScore);
      var careerLevel = scoreLevel(careerScore);
      var relationLevel = scoreLevel(relationScore);
      var healthLevel = scoreLevel(healthScore);

      var mingBranch = String(chart.center.mingBranch || '');
      var sifang = mingBranch
        ? [mingBranch, _zwOffset(mingBranch, 4), _zwOffset(mingBranch, 8), _zwOffset(mingBranch, 6)]
        : [];
      var sifangText = sifang.filter(Boolean).map(branchPalaceLabel).join(' / ') || '--';

      var daXianHead = Array.isArray(chart.daXianTimeline) ? chart.daXianTimeline.slice(0, 3) : [];
      var daXianText = daXianHead.map(function(item) {
        if (!item) return '';
        return (item.range || '--') + ' ' + (item.branch || '--') + (item.palaceName ? ('·' + item.palaceName) : '');
      }).filter(Boolean).join(' | ') || '--';
      var huaSummaryText = (chart.center.huaSummary || []).map(function(item) {
        return item && item.label ? item.label : '';
      }).filter(Boolean).join('、');
      var flyTrackCount = Array.isArray(chart.huaTracks) ? chart.huaTracks.length : 0;
      var currentYear = new Date().getFullYear();
      var birthYear = Number(chart.center.birthYearForAge);
      var birthMonth = Number(chart.center.birthMonthForAge);
      var birthDay = Number(chart.center.birthDayForAge);
      if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || !Number.isInteger(birthDay)) {
        var birthYearMatch = String(chart.center.solarText || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (birthYearMatch) {
          birthYear = Number(birthYearMatch[1]);
          birthMonth = Number(birthYearMatch[2]);
          birthDay = Number(birthYearMatch[3]);
        }
      }
      var age = _zwComputeExactAge(birthYear, birthMonth, birthDay, new Date());
      if (!Number.isInteger(age) || age < 1) age = 1;
      var activeDaXian = pickActiveDaXian(chart.daXianTimeline, age);
      var activeDaXianCell = activeDaXian ? _zwGetCellByBranch(chart, activeDaXian.branch) : null;
      var currentLiuNianCell = pickCurrentLiuNianCell(chart.boardCells, age);
      var currentYearGanZhi = _zwGetYearGanZhi(currentYear);
      var yearGanZhi = String(chart.center.yearGanZhi || '');
      var yearStem = yearGanZhi.slice(0, 1);
      var yangStems = ['甲', '丙', '戊', '庚', '壬'];
      var yinYangGender = (yangStems.indexOf(yearStem) >= 0 ? '阳' : '阴') + (chart.center.genderLabel === '女' ? '女' : '男');
      var activeDaXianLabel = activeDaXian
        ? ((activeDaXian.range || '--') + '岁 ' + (activeDaXian.branch || '--') + (activeDaXian.palaceName ? ('宫·' + activeDaXian.palaceName) : '宫'))
        : '大限待确认';
      var liuNianLabel = currentLiuNianCell
        ? (currentYear + '年(' + currentYearGanZhi + ')流年落 ' + currentLiuNianCell.branch + '宫·' + currentLiuNianCell.palaceName)
        : (currentYear + '年(' + currentYearGanZhi + ')流年落宫待确认');
      var introText = '这是' +
        (Number.isFinite(birthYear) ? (String(birthYear) + '年生 ') : '') +
        yinYangGender + '，' +
        String(chart.center.lunarText || '--') + '，' +
        String(chart.center.bureauLabel || '--') + '。命主' + (chart.center.mingZhu || '--') +
        '，身主' + (chart.center.shenZhu || '--') + '，身宫落' + (chart.center.shenPalaceName || '--') +
        '。当前' + String(currentYear) + '年你约' + String(age) + '岁，正走' + activeDaXianLabel + '。';
      var mingPatternTags = [];
      if (hasStar(ming, '天梁')) mingPatternTags.push('专业清贵');
      if (hasStar(ming, '紫微') || hasStar(ming, '天府')) mingPatternTags.push('统筹掌盘');
      if (hasStar(ming, '武曲')) mingPatternTags.push('执行理财');
      if (hasStar(ming, '巨门')) mingPatternTags.push('思辨表达');
      if (hasAnyStar(ming, ['七杀', '破军'])) mingPatternTags.push('变革开创');
      if (!mingPatternTags.length) mingPatternTags.push(coreLevel.grade === '强势' ? '主星发力' : '稳步积累');

      var coreExplain = [
        '命宫主星为「' + starsWithBrightness(ming, 4) + '」，格局标签偏「' + mingPatternTags.join(' / ') + '」。',
        coreLevel.tone,
        '身宫落在「' + (chart.center.shenPalaceName || '--') + '」，说明你的人生重心会不断回到这个宫位主题。'
      ];
      if (hasStar(ming, '天梁')) coreExplain.push('天梁入命通常代表责任感与原则感强，适合做需要专业公信力的长期路线。');
      if (hasAnyStar(ming, ['擎羊', '陀罗'])) coreExplain.push('命宫夹煞时，执行力会很硬，但表达容易过直，需避免“正确但难合作”的沟通方式。');
      if (chart.center.shenPalaceName === '夫妻宫') coreExplain.push('身宫落夫妻宫，重大决策会自然优先考虑关系与家庭稳定。');

      var careerExplain = [
        '官禄宫看岗位职责，财帛宫看变现结构；你当前呈现「' + careerLevel.grade + '」节奏。',
        careerLevel.tone,
        '当前大限落点：' + activeDaXianLabel + '，对应主星「' + starsWithBrightness(activeDaXianCell, 3) + '」。'
      ];
      if (hasStar(cai, '紫微') && hasStar(cai, '天府')) careerExplain.push('财帛宫见紫微+天府，偏“稳守财库”模型，宜长期攒资产、做复利。');
      if (hasAnyStar(guan, ['巨门', '文昌', '文曲'])) careerExplain.push('官禄宫带巨门/昌曲时，靠表达、知识输出、咨询培训、专业沟通的赛道更容易出成绩。');
      if (hasAnyStar(guan, ['七杀', '破军', '贪狼'])) careerExplain.push('官禄宫开创星重，意味着你在“新方向/新项目/高变化岗位”中更能放大优势。');
      if (hasHuaTag(activeDaXianCell, '权')) careerExplain.push('当前大限带化权，通常对应管理职责或资源调度权上升，是争取话语权的窗口期。');

      var relationExplain = [
        '夫妻宫主星「' + starsWithBrightness(fuqi, 3) + '」，迁移宫主星「' + starsWithBrightness(qianyi, 3) + '」。',
        relationLevel.tone,
        '关系议题关键在“先对齐预期，再投入承诺”，比事后补救更有效。'
      ];
      if (hasAnyStar(fuqi, ['巨门', '擎羊', '陀罗'])) relationExplain.push('夫妻宫带巨门/羊陀时，沟通里容易出现“话没错但情绪受伤”，需要更柔和的表达节奏。');
      if (hasAnyStar(fuqi, ['天同', '太阴', '天府'])) relationExplain.push('夫妻宫见温和型主星，长期关系的稳定性较好，适合通过日常经营积累安全感。');
      if (chart.center.shenPalaceName === '夫妻宫') relationExplain.push('身宫在夫妻宫会放大你对亲密关系的投入度，关系稳定就是你的能量补给。');

      var healthExplain = [
        '疾厄宫主星「' + starsWithBrightness(jiebing, 3) + '」，福德宫主星「' + starsWithBrightness(fude, 3) + '」。',
        healthLevel.tone,
        '健康管理重点不是“硬扛”，而是维持可持续节奏与恢复能力。'
      ];
      if (hasAnyStar(jiebing, ['擎羊', '陀罗', '火星', '铃星'])) healthExplain.push('疾厄宫煞曜较重时，易有炎症、劳损或急性不适，务必压住熬夜与连续超负荷。');
      if (hasAnyStar(jiebing, ['天机', '巨门'])) healthExplain.push('神经压力与思虑负担偏高，建议固定运动和睡眠窗口，减少“脑子停不下来”的消耗。');
      if (hasAnyStar(jiebing, ['太阴', '天同'])) healthExplain.push('偏内耗体质时，情绪管理与规律作息会直接影响身体状态。');

      var annualExplain = [
        liuNianLabel + '，主星「' + starsWithBrightness(currentLiuNianCell, 3) + '」。',
        '本命四化：' + (huaSummaryText || '暂无四化摘要') + '。',
        '飞化追踪条数：' + String(flyTrackCount) + '（' + (chart.center.schoolLabel || '传统四化') + '）。'
      ];
      if (currentLiuNianCell && hasAnyStar(currentLiuNianCell, ['禄存', '天相', '左辅', '右弼'])) {
        annualExplain.push('流年宫位见辅佐与禄星，利于借团队/同业资源放大成果。');
      }
      if (currentLiuNianCell && hasAnyStar(currentLiuNianCell, ['巨门'])) {
        annualExplain.push('流年需格外重视沟通与合同细节，避免因表达或条款疏漏引发反复。');
      }
      if (hasHuaTag(currentLiuNianCell, '忌')) {
        annualExplain.push('流年宫位见化忌，建议少做高杠杆承诺，先保现金流与节奏稳定。');
      }
      var overviewPlain = [
        '一句话结论：你现在走「' + activeDaXianLabel + '」，建议先稳住底盘，再逐步放大成果。',
        '你的人生重点会不断回到「' + (chart.center.shenPalaceName || '--') + '」相关议题，这是你的长期主线。',
        '今年最值得优先守住三件事：现金流、身体恢复力、核心关系稳定。'
      ];
      var corePlain = [
        '你的底色偏「' + mingPatternTags.join(' / ') + '」，做事认真、有担当，适合长期深耕。',
        hasAnyStar(ming, ['擎羊', '陀罗'])
          ? '优势是执行力强，短板是说话容易过硬，建议把“结论”改成“结论+台阶”。'
          : '优势是稳定推进和持续积累，避免为了求快而打乱长期节奏。',
        '这张盘更适合“长期主义路线”，不适合频繁高风险短线冲刺。'
      ];
      var careerPlain = [
        '事业与财运整体是「' + careerLevel.grade + '」节奏，关键是把职业能力和变现能力一起升级。',
        '当前十年主线是「' + activeDaXianLabel + '」，更适合做可复利的资产，而不是只追热点。',
        '多个机会同时出现时，优先选“能提高你长期话语权”的机会。'
      ];
      var relationPlain = [
        '关系上最有效的策略是：先定边界，再谈投入，这样冲突会少很多。',
        chart.center.shenPalaceName === '夫妻宫'
          ? '你对亲密关系投入度高，家庭稳定会直接提升你的工作状态。'
          : '你需要在关系里保持“有温度但有边界”的平衡，避免过度消耗。',
        '发生争执时先降语气再谈对错，通常比硬碰硬更快解决问题。'
      ];
      var healthPlain = [
        '健康是你这张盘的底盘变量，先保恢复力，运势才稳。',
        '近期重点放在睡眠、饮食、规律运动三个基础项，别用透支换效率。',
        '只要节奏守住，你的整体状态会比短期猛冲更可持续。'
      ];
      var flowPlain = [
        '今年主题是「' + liuNianLabel + '」，重点在节奏和风险控制。',
        '重大决策先看风险是否可控，再看收益是否诱人，先活下来再赢更大。',
        '如果出现反复卡顿，优先检查沟通细节、执行节奏和资源分配。'
      ];

      var sections = [];
      sections.push({
        key: 'overview',
        title: '命盘总论',
        text: introText,
        plain: overviewPlain,
        level: '当前主线：' + activeDaXianLabel,
        metrics: [
          { label: '出生信息', value: (chart.center.solarText || '--') },
          { label: '命主/身主', value: (chart.center.mingZhu || '--') + ' / ' + (chart.center.shenZhu || '--') },
          { label: '当前年龄', value: String(age) + ' 岁（' + String(currentYear) + '）' }
        ],
        evidence: [
          '农历信息：' + (chart.center.lunarText || '--'),
          '命宫/身宫：' + (chart.center.mingBranch || '--') + ' / ' + (chart.center.shenBranch || '--') + '（身宫落' + (chart.center.shenPalaceName || '--') + '）',
          '当前大限：' + activeDaXianLabel
        ],
        explain: [
          '总论用于先定“人生主轴”和“当前十年重点”，再展开性格、事业、关系和健康的分层判断。',
          '你的盘面当前更适合“做深做稳、逐步放大”，而不是短线高风险冲刺。'
        ],
        suggestions: [
          '把当前十年目标拆成三层：底盘稳定（现金流/健康）→ 能力升级（专业壁垒）→ 结构放大（团队/资产）。',
          '每年固定复盘一次：主赛道是否仍与命盘优势同频。'
        ],
        risks: []
      });

      sections.push({
        key: 'core',
        title: '核心性格与命格基调',
        text: '命宫「' + starsWithBrightness(ming, 4) + '」，格局偏「' + mingPatternTags.join(' / ') + '」，当前评级「' + coreLevel.grade + '」。',
        plain: corePlain,
        level: '评级：' + coreLevel.grade,
        metrics: [
          { label: '命宫评分', value: String(mingScore) },
          { label: '身宫落点', value: chart.center.shenPalaceName || '--' },
          { label: '五行局', value: chart.center.bureauLabel || '--' }
        ],
        evidence: [
          '命宫位置：' + (chart.center.mingBranch || '--') + '宫；主星：' + starsWithBrightness(ming, 4),
          '身宫位置：' + (chart.center.shenBranch || '--') + '宫；落宫主题：' + (chart.center.shenPalaceName || '--'),
          '三方四正：' + sifangText
        ],
        explain: coreExplain,
        suggestions: [
          '把年度目标拆成“主轴能力 + 可量化结果”双指标，每月复盘一次，减少无效忙碌。',
          '保留“强执行”优势的同时，强化表达柔性，避免因沟通过硬影响合作质量。'
        ],
        risks: mingScore < 0 ? ['命宫评分偏弱阶段，避免并行过多高风险决策。'] : []
      });

      sections.push({
        key: 'career',
        title: '事业财运解析',
        text: '官禄宫「' + starsWithBrightness(guan, 3) + '」+ 财帛宫「' + starsWithBrightness(cai, 3) + '」，当前十年主线：' + activeDaXianLabel + '。',
        plain: careerPlain,
        level: '评级：' + careerLevel.grade,
        metrics: [
          { label: '官禄评分', value: String(guanScore) },
          { label: '财帛评分', value: String(caiScore) },
          { label: '大限方向', value: chart.center.daXianDirectionLabel || '--' }
        ],
        evidence: [
          '官禄宫主星：' + starsWithBrightness(guan, 3),
          '财帛宫主星：' + starsWithBrightness(cai, 3),
          '当前大限前段：' + daXianText,
          '当前所处大限：' + activeDaXianLabel
        ],
        explain: careerExplain,
        suggestions: [
          '建立“主业收入 + 可复制副引擎”的双曲线，避免单点依赖。',
          '把关键机会放在“可持续复利”的资产上（专业能力、客户资产、房产/长期配置），而非短线博弈。',
          '每季度做一次岗位价值盘点：产出、不可替代性、市场价格三维对齐。'
        ],
        risks: careerScore < 0 ? ['事业与变现节奏不一致时，先降固定成本，再做方向升级。'] : []
      });

      sections.push({
        key: 'relation',
        title: '感情婚姻与合作关系',
        text: '夫妻宫「' + starsWithBrightness(fuqi, 3) + '」与迁移宫「' + starsWithBrightness(qianyi, 3) + '」共同定义你的亲密关系与合作边界。',
        plain: relationPlain,
        level: '评级：' + relationLevel.grade,
        metrics: [
          { label: '关系评分', value: String(relationScore) },
          { label: '夫妻宫', value: starsWithBrightness(fuqi, 2) },
          { label: '迁移宫', value: starsWithBrightness(qianyi, 2) }
        ],
        evidence: [
          '夫妻宫对应亲密关系与长期合作契约。',
          '迁移宫对应外部环境适配、跨团队协同与出差/迁移适应力。'
        ],
        explain: relationExplain,
        suggestions: [
          '合作前固定使用一页纸约定：目标、分工、节奏、退出机制。',
          '关系紧张时优先修“说话方式”，再修“事情对错”，冲突成本会明显下降。',
          '高压阶段把沟通频次提高，减少信息不对称造成的误读。'
        ],
        risks: relationScore < 0 ? ['避免情绪化承诺；先验证稳定性再增加合作深度。'] : []
      });

      sections.push({
        key: 'health',
        title: '健康与节奏管理',
        text: '疾厄宫「' + starsWithBrightness(jiebing, 3) + '」+ 福德宫「' + starsWithBrightness(fude, 3) + '」，重点是守住“恢复力”。',
        plain: healthPlain,
        level: '评级：' + healthLevel.grade,
        metrics: [
          { label: '健康评分', value: String(healthScore) },
          { label: '疾厄宫', value: starsWithBrightness(jiebing, 2) },
          { label: '福德宫', value: starsWithBrightness(fude, 2) }
        ],
        evidence: [
          '疾厄宫看身体负荷与恢复阈值，福德宫看精神容量与内在稳定度。',
          '当两宫不同步时，常见表现是“身体可撑住，但精神先透支”。'
        ],
        explain: healthExplain,
        suggestions: [
          '建立周节律：高强度日不超过3天，至少保留1天低负荷恢复日。',
          '每半年做一次体检与压力评估，把风险前置。',
          '如果当前应酬/熬夜增多，先把睡眠和饮食质量拉回基线，再谈提速。'
        ],
        risks: healthScore < 0 ? ['近期不建议长期熬夜+高压并行，优先保恢复能力。'] : []
      });

      sections.push({
        key: 'flow',
        title: String(currentYear) + '流年与四化焦点',
        text: liuNianLabel + '；当前排盘模式为「' + (chart.center.schoolLabel || '传统四化') + '」。',
        plain: flowPlain,
        level: '当前十年：' + activeDaXianLabel,
        metrics: [
          { label: '当前流年', value: String(currentYear) + ' ' + currentYearGanZhi },
          { label: '流派', value: chart.center.schoolLabel || '--' },
          { label: '飞化追踪', value: String(flyTrackCount) + ' 条' },
          { label: '本命四化', value: huaSummaryText || '--' }
        ],
        evidence: [
          '当前大限：' + activeDaXianLabel,
          '大限前段：' + daXianText,
          '本命四化：' + (huaSummaryText || '--'),
          '建议重点观察“化忌落点”与目标宫位是否同频。'
        ],
        explain: annualExplain.concat([
          '传统四化适合看“底层倾向”，飞星四化适合看“动态路径与触发点”。',
          '判断顺序建议：主星结构 → 四化流向 → 大限流年叠加。'
        ]),
        suggestions: [
          '为每个重点宫位建立“触发条件—行为策略—复盘指标”的闭环。',
          '今年做重要决策时，优先看“现金流安全 + 关系稳定 + 体能边界”三条底线。',
          '把飞化落宫追踪与三方四正同时看，避免单点解读。'
        ],
        risks: []
      });

      return sections;
    }

    function _zwLoadHistory() {
      try {
        var raw = localStorage.getItem(ZW_HISTORY_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.filter(function(item) {
          return item && typeof item === 'object' && item.id && item.createdAt;
        }).slice(0, 30);
      } catch (_err) {
        return [];
      }
    }

    function _zwSaveHistory(historyList) {
      try {
        localStorage.setItem(ZW_HISTORY_KEY, JSON.stringify(historyList || []));
      } catch (_err) {}
    }

    function _zwBuildHistoryLabel() {
      var base = String(ziweiProfileName.value || '').trim();
      if (base) return base;
      var sex = ziweiGender.value === 'female' ? '女' : '男';
      var solar = String(ziweiSolarYear.value || '') + '-' + String(ziweiSolarMonth.value || '') + '-' + String(ziweiSolarDay.value || '');
      return '命例-' + sex + '-' + solar;
    }

    function _zwPushHistory(chart) {
      if (!chart || !chart.center) return;
      var record = {
        id: 'zw-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
        createdAt: Date.now(),
        label: _zwBuildHistoryLabel(),
        profileName: String(ziweiProfileName.value || '').trim(),
        calendarType: ziweiCalendarType.value,
        solarYear: String(ziweiSolarYear.value || ''),
        solarMonth: String(ziweiSolarMonth.value || ''),
        solarDay: String(ziweiSolarDay.value || ''),
        lunarYear: String(ziweiLunarYear.value || ''),
        lunarMonth: String(ziweiLunarMonth.value || ''),
        lunarDay: String(ziweiLunarDay.value || ''),
        lunarLeap: !!ziweiLunarLeap.value,
        birthHour: String(ziweiBirthHour.value || ''),
        birthMinute: String(ziweiBirthMinute.value || ''),
        gender: ziweiGender.value,
        clockMode: ziweiClockMode.value === 'trueSolar' ? 'trueSolar' : 'standard',
        timezoneOffset: String(ziweiTimezoneOffset.value || '8'),
        longitude: String(ziweiLongitude.value || '120.000'),
        xiaoXianRule: ziweiXiaoXianRule.value === 'mingStart' ? 'mingStart' : 'yearBranch',
        liuNianRule: ziweiLiuNianRule.value === 'followDaXian' ? 'followDaXian' : 'yearForward',
        school: ziweiSchool.value === 'flying' ? 'flying' : 'traditional',
        summary: {
          yearGanZhi: chart.center.yearGanZhi || '',
          bureau: chart.center.bureauLabel || '',
          mingBranch: chart.center.mingBranch || '',
          shenBranch: chart.center.shenBranch || ''
        }
      };
      var list = _zwLoadHistory();
      list.unshift(record);
      if (list.length > 30) list = list.slice(0, 30);
      ziweiHistory.value = list;
      _zwSaveHistory(list);
    }

    function applyZiweiHistoryFromInput() {
      var raw = String(ziweiProfileName.value || '').trim();
      if (!raw) return;
      var options = Array.isArray(ziweiHistoryNameOptions.value) ? ziweiHistoryNameOptions.value : [];
      if (!options.length) return;
      var matched = null;
      for (var i = 0; i < options.length; i++) {
        if (options[i] && options[i].value === raw) {
          matched = options[i];
          break;
        }
      }
      if (!matched || !matched.id) return;
      loadZiweiHistory(matched.id, {
        fromInputPicker: true
      });
    }

    function applyZiweiHistoryFromSelect() {
      var id = String(ziweiHistoryPickedId.value || '').trim();
      if (!id) return;
      loadZiweiHistory(id, { fromInputPicker: true });
      ziweiHistoryPickedId.value = '';
    }

    function loadZiweiHistory(itemId, options) {
      var opt = options || {};
      var id = String(itemId || '');
      if (!id) return;
      var list = _zwLoadHistory();
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) { found = list[i]; break; }
      }
      if (!found) {
        ziweiStatus.value = { type: 'error', text: '历史命例不存在或已被删除。' };
        return;
      }
      ziweiProfileName.value = String(found.profileName || '');
      ziweiCalendarType.value = found.calendarType === 'lunar' ? 'lunar' : 'solar';
      ziweiSolarYear.value = String(found.solarYear || '1990');
      ziweiSolarMonth.value = String(found.solarMonth || '01');
      ziweiSolarDay.value = String(found.solarDay || '01');
      ziweiLunarYear.value = String(found.lunarYear || '1990');
      ziweiLunarMonth.value = String(found.lunarMonth || '1');
      ziweiLunarDay.value = String(found.lunarDay || '1');
      ziweiLunarLeap.value = !!found.lunarLeap;
      ziweiBirthHour.value = String(found.birthHour || '12');
      ziweiBirthMinute.value = String(found.birthMinute || '00');
      ziweiGender.value = found.gender === 'female' ? 'female' : 'male';
      ziweiClockMode.value = found.clockMode === 'trueSolar' ? 'trueSolar' : 'standard';
      ziweiTimezoneOffset.value = String(found.timezoneOffset || '8');
      ziweiLongitude.value = String(found.longitude || '120.000');
      ziweiXiaoXianRule.value = found.xiaoXianRule === 'mingStart' ? 'mingStart' : 'yearBranch';
      ziweiLiuNianRule.value = found.liuNianRule === 'followDaXian' ? 'followDaXian' : 'yearForward';
      ziweiSchool.value = found.school === 'flying' ? 'flying' : 'traditional';
      generateZiweiChart({ saveHistory: false });
      ziweiStatus.value = {
        type: 'success',
        text: opt.fromInputPicker ? '已从命例名称下拉载入历史命例并重新排盘。' : '已载入历史命例并重新排盘。'
      };
    }

    function removeZiweiHistory(itemId) {
      var id = String(itemId || '');
      if (!id) return;
      var list = _zwLoadHistory().filter(function(item) { return item && item.id !== id; });
      ziweiHistory.value = list;
      _zwSaveHistory(list);
      ziweiStatus.value = { type: 'info', text: '历史命例已删除。' };
    }

    function clearZiweiHistory() {
      ziweiHistory.value = [];
      ziweiHistoryPickedId.value = '';
      _zwSaveHistory([]);
      ziweiStatus.value = { type: 'info', text: '历史命例已清空。' };
    }

    function formatZiweiHistoryTime(ts) {
      var ms = Number(ts);
      if (!Number.isFinite(ms) || ms <= 0) return '--';
      var d = new Date(ms);
      if (Number.isNaN(d.getTime())) return '--';
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
    }

    function formatZiweiDurationText(ms) {
      var value = Number(ms || 0);
      if (!Number.isFinite(value) || value <= 0) return '';
      var totalSeconds = Math.max(1, Math.round(value / 1000));
      var minutes = Math.floor(totalSeconds / 60);
      var seconds = totalSeconds % 60;
      return String(minutes) + '分' + String(seconds).padStart(2, '0') + '秒';
    }

    function buildZiweiShareLink() {
      if (typeof window === 'undefined' || !window.location) return '';
      var origin = window.location.origin || '';
      var path = window.location.pathname || '/';
      return origin + path + '?ziwei_share=1#/workbench/ziwei';
    }

    function focusZiweiBranch(branch) {
      var b = String(branch || '');
      if (!b) return;
      ziweiFocusBranch.value = b;
    }

    function updateZiweiAiSuggestionLayout() {
      var wrapEl = ziweiAiQaInputWrapRef.value;
      if (!wrapEl || typeof wrapEl.getBoundingClientRect !== 'function') return;
      var wrapRect = wrapEl.getBoundingClientRect();
      var viewportH = Number(window.innerHeight || document.documentElement.clientHeight || 0);
      if (!Number.isFinite(viewportH) || viewportH <= 0) viewportH = 800;

      var spaceBelow = Math.max(0, viewportH - wrapRect.bottom - 12);
      var spaceAbove = Math.max(0, wrapRect.top - 12);
      var shouldOpenUp = spaceBelow < 260 && spaceAbove > spaceBelow;
      ziweiAiSuggestionPlacement.value = shouldOpenUp ? 'up' : 'down';
      var available = shouldOpenUp ? spaceAbove : spaceBelow;
      var itemCount = Array.isArray(ziweiAiSuggestionsFiltered.value)
        ? ziweiAiSuggestionsFiltered.value.length
        : 0;
      var desired = Math.max(1, Math.min(itemCount, 10)) * 40 + 10;
      var nextHeight = Math.floor(Math.min(available, desired));
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) nextHeight = desired;
      ziweiAiSuggestionMaxHeight.value = Math.max(140, Math.min(560, nextHeight));
    }

    function scheduleZiweiAiSuggestionLayout() {
      nextTick(function() {
        window.requestAnimationFrame(updateZiweiAiSuggestionLayout);
      });
    }

    function openZiweiAiSuggestions() {
      ziweiAiSuggestionOpen.value = true;
      scheduleZiweiAiSuggestionLayout();
    }

    function pickZiweiAiSuggestion(value) {
      var text = '';
      if (value && typeof value === 'object') {
        text = String(value.text || value.label || '').trim();
      } else {
        text = String(value || '').trim();
      }
      if (!text) return;
      ziweiAiQuestionInput.value = text;
      ziweiAiSuggestionOpen.value = false;
    }

    function isLikelyMojibakeZh(text) {
      var t = String(text || '');
      if (!t) return false;
      var hit = (t.match(/[锛銆鍙闂璇鎴浠鐨鎬]/g) || []).length;
      return hit >= 2;
    }

    async function loadZiweiAiServerConfig() {
      if (!window.authApi || typeof window.authApi.invokeFunction !== 'function') return;
      if (typeof window.authApi.getUserSync === 'function' && !window.authApi.getUserSync()) return;
      try {
        var result = await window.authApi.invokeFunction('ziwei-analysis', {
          mode: 'config'
        });
        if (result && result.error) return;
        var data = result ? result.data : null;
        var cfg = data && data.config && typeof data.config === 'object' ? data.config : null;
        if (!cfg) return;

        if (Array.isArray(cfg.suggestions)) {
          var suggestions = cfg.suggestions
            .map(function(item) { return String(item || '').trim(); })
            .filter(function(item) { return !isLikelyMojibakeZh(item); })
            .filter(Boolean)
            .slice(0, 12);
          ziweiAiQaSuggestions.value = suggestions;
        }

      } catch (_err) {
        // keep empty server config when fetch fails
      }
    }

    async function submitZiweiAiQuestion() {
      if (!ziweiChart.value) {
        ziweiStatus.value = { type: 'info', text: '\u8bf7\u5148\u5b8c\u6210\u6392\u76d8\u3002' };
        return;
      }
      if (ziweiAiQuestionLoading.value) return;
      if ((!window.authApi || typeof window.authApi.invokeFunction !== 'function') &&
          typeof window.__loadSqldevAuthNow === 'function') {
        try {
          await window.__loadSqldevAuthNow();
        } catch (_authLoadErr) {}
      }
      if (!window.authApi || typeof window.authApi.invokeFunction !== 'function') {
        ziweiStatus.value = { type: 'error', text: '\u8ba4\u8bc1\u6a21\u5757\u672a\u521d\u59cb\u5316\uff0c\u65e0\u6cd5\u53d1\u9001 AI \u95ee\u7b54\u3002' };
        return;
      }
      if (typeof window.authApi.getUserSync === 'function' && !window.authApi.getUserSync()) {
        if (typeof window.authApi.openAuthModal === 'function') {
          window.authApi.openAuthModal('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u4f7f\u7528 AI \u95ee\u7b54');
        }
        ziweiStatus.value = { type: 'error', text: '\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u4f7f\u7528 AI \u95ee\u7b54\u3002' };
        return;
      }

      var question = String(ziweiAiQuestionInput.value || '').trim();
      if (!question) {
        ziweiStatus.value = { type: 'info', text: '\u8bf7\u8f93\u5165\u95ee\u9898\u540e\u518d\u53d1\u9001\u3002' };
        openZiweiAiSuggestions();
        return;
      }
      if (!_zwEnsureAiRequestAllowed()) return;

      ziweiAiQuestionLoading.value = true;
      ziweiAiSuggestionOpen.value = false;
      ziweiAiResult.value = null;
      ziweiAiDone.value = false;
      ziweiAiError.value = '';
      ziweiAiQuestionAnswer.value = '';
      ziweiStatus.value = { type: 'info', text: 'AI \u6b63\u5728\u601d\u8003\u4e2d\uff0c\u8bf7\u7a0d\u540e...' };
      var startedAt = Date.now();
      try {
        var signature = _zwBuildAiSignature(ziweiChart.value) + '|qa|' + question.slice(0, 64);
        var result = await window.authApi.invokeFunction('ziwei-analysis', {
          signature: signature,
          style: 'pro',
          mode: 'qa',
          question: question,
          chart: _zwBuildAiPayloadCompact(ziweiChart.value)
        });
        if (result && result.error) {
          var parsed = await _zwParseInvokeError(result.error);
          var detail = String(parsed.detail || (result.error && result.error.message) || result.error || '\u8bf7\u6c42\u5931\u8d25');
          throw new Error(detail || '\u8bf7\u6c42\u5931\u8d25');
        }
        var data = result ? result.data : null;
        var answer = '';
        if (data && typeof data.answer === 'string') answer = String(data.answer || '').trim();
        if (!answer && data && data.analysis && typeof data.analysis.overview === 'string') {
          answer = String(data.analysis.overview || '').trim();
        }
        if (!answer) throw new Error('\u0041\u0049 \u672a\u8fd4\u56de\u53ef\u7528\u95ee\u7b54\u5185\u5bb9');
        ziweiAiQuestionAnswer.value = answer;
        var elapsedMs = Date.now() - startedAt;
        ziweiAiLastDurationMs.value = elapsedMs;
        ziweiStatus.value = { type: 'success', text: '\u0041\u0049 \u95ee\u7b54\u5df2\u751f\u6210\uff08\u601d\u8003\u8017\u65f6 ' + formatZiweiDurationText(elapsedMs) + '\uff09\u3002' };
      } catch (err) {
        var msg = String((err && err.message) || err || '\u0041\u0049 \u95ee\u7b54\u5931\u8d25');
        if (_zwIsAiRateLimitErrorMessage(msg)) {
          _zwStartAiCooldown(_ZIWEI_AI_RATE_LIMIT_COOLDOWN_MS, '您的账户已达到速率限制，请稍后再试。');
          msg = ziweiAiCooldownHint.value || msg;
        }
        if (!_zwIsAiRateLimitErrorMessage(msg)) msg = _zwMapAiErrorMessage(msg);
        ziweiStatus.value = { type: 'error', text: '\u0041\u0049 \u95ee\u7b54\u5931\u8d25\uff1a' + msg };
      } finally {
        ziweiAiQuestionLoading.value = false;
      }
    }

    function toggleZiweiAnalysis(key) {
      var k = String(key || '');
      if (!k) return;
      ziweiAnalysisActiveKey.value = k;
    }

    function _zwTrimText(value, maxLen) {
      var text = String(value == null ? '' : value);
      var limit = Number(maxLen || 0);
      if (!Number.isFinite(limit) || limit <= 0) return text.trim();
      if (text.length <= limit) return text.trim();
      return text.slice(0, limit).trim();
    }

    function _zwBuildAiSignature(chart) {
      if (!chart || !chart.center) return '';
      return [
        String(ziweiLastGenerateSignature.value || _zwBuildGenerateSignature()),
        String(chart.center.school || ''),
        String(chart.center.clockMode || ''),
        String(chart.center.liuNianRule || ''),
        String(chart.center.xiaoXianRule || '')
      ].join('|');
    }

    function _zwBuildAiPayload(chart) {
      var center = chart && chart.center ? chart.center : {};
      var boardCells = Array.isArray(chart && chart.boardCells) ? chart.boardCells : [];
      var palaces = boardCells.map(function(cell) {
        var mainStars = Array.isArray(cell && cell.mainStars) ? cell.mainStars : [];
        var assistStars = Array.isArray(cell && cell.assistStars) ? cell.assistStars : [];
        var miscStars = Array.isArray(cell && cell.miscStars) ? cell.miscStars : [];
        var liuNianSeries = Array.isArray(cell && cell.liuNianSeries) ? cell.liuNianSeries : [];
        var xiaoXianSeries = Array.isArray(cell && cell.xiaoXianSeries) ? cell.xiaoXianSeries : [];
        return {
          branch: String(cell && cell.branch || ''),
          palaceName: String(cell && cell.palaceName || ''),
          area: String(cell && cell.area || ''),
          stemBranch: String(cell && cell.stemBranch || ''),
          isMing: Boolean(cell && cell.isMing),
          isShen: Boolean(cell && cell.isShen),
          mainStars: mainStars.map(function(star) {
            return {
              name: String(star && star.name || ''),
              brightness: String(star && star.brightness || ''),
              huaTags: Array.isArray(star && star.huaTags) ? star.huaTags.slice(0, 4) : []
            };
          }),
          assistStars: assistStars.map(function(star) {
            return {
              name: String(star && star.name || ''),
              huaTags: Array.isArray(star && star.huaTags) ? star.huaTags.slice(0, 4) : []
            };
          }),
          miscStars: miscStars.map(function(star) {
            return {
              name: String(star && star.name || ''),
              huaTags: Array.isArray(star && star.huaTags) ? star.huaTags.slice(0, 4) : []
            };
          }),
          mainStarsText: _zwTrimText(cell && cell.mainStarsText, 220),
          assistStarsText: _zwTrimText(cell && cell.assistStarsText, 220),
          miscStarsText: _zwTrimText(cell && cell.miscStarsText, 220),
          daXian: String(cell && cell.daXian || ''),
          xiaoXian: String(cell && cell.xiaoXian || ''),
          changSheng: String(cell && cell.changSheng || ''),
          currentLiuNian: Number(cell && cell.currentLiuNian || 0),
          currentXiaoXian: Number(cell && cell.currentXiaoXian || 0),
          liuNianSeries: liuNianSeries.slice(0, 12),
          xiaoXianSeries: xiaoXianSeries.slice(0, 12),
          liuNianSeriesText: _zwTrimText(cell && cell.liuNianSeriesText, 240),
          xiaoXianSeriesText: _zwTrimText(cell && cell.xiaoXianSeriesText, 240),
          outgoingHuaCount: Number(cell && cell.outgoingHuaCount || 0),
          incomingHuaCount: Number(cell && cell.incomingHuaCount || 0)
        };
      });
      var huaTracks = Array.isArray(chart && chart.huaTracks)
        ? chart.huaTracks.slice(0, 96).map(function(track) {
          return {
            tag: String(track && track.tag || ''),
            star: String(track && track.star || ''),
            sourceBranch: String(track && track.sourceBranch || ''),
            sourceText: String(track && track.sourceText || ''),
            targetBranch: String(track && track.targetBranch || ''),
            targetText: String(track && track.targetText || '')
          };
        })
        : [];
      var baseAnalysis = Array.isArray(ziweiAnalysis.value) ? ziweiAnalysis.value : [];
      var ruleSummary = baseAnalysis.slice(0, 8).map(function(item) {
        return {
          key: String(item && item.key || ''),
          title: String(item && item.title || ''),
          level: String(item && item.level || ''),
          text: _zwTrimText(item && item.text, 320),
          plain: Array.isArray(item && item.plain) ? item.plain.slice(0, 3).map(function(line) { return _zwTrimText(line, 160); }) : [],
          evidence: Array.isArray(item && item.evidence) ? item.evidence.slice(0, 3).map(function(line) { return _zwTrimText(line, 160); }) : []
        };
      });
      return {
        payloadVersion: 'ziwei-ai-v2',
        generatedAt: Number(chart && chart.generatedAt || Date.now()),
        profileName: _zwTrimText(ziweiProfileName.value, 80),
        center: {
          genderLabel: String(center.genderLabel || ''),
          yinYangGenderLabel: String(center.yinYangGenderLabel || ''),
          calendarInputType: String(center.calendarInputType || ''),
          schoolLabel: String(center.schoolLabel || ''),
          solarText: String(center.solarText || ''),
          inputClockText: String(center.inputClockText || ''),
          lunarText: String(center.lunarText || ''),
          naYinLabel: String(center.naYinLabel || ''),
          yearGanZhi: String(center.yearGanZhi || ''),
          bureauLabel: String(center.bureauLabel || ''),
          mingBranch: String(center.mingBranch || ''),
          mingPalaceName: String(center.mingPalaceName || ''),
          shenBranch: String(center.shenBranch || ''),
          shenPalaceName: String(center.shenPalaceName || ''),
          ziweiBranch: String(center.ziweiBranch || ''),
          tianfuBranch: String(center.tianfuBranch || ''),
          monthLabel: String(center.monthLabel || ''),
          shichenLabel: String(center.shichenLabel || ''),
          mingZhu: String(center.mingZhu || ''),
          shenZhu: String(center.shenZhu || ''),
          daXianDirectionLabel: String(center.daXianDirectionLabel || ''),
          clockMode: String(center.clockMode || ''),
          clockModeLabel: String(center.clockModeLabel || ''),
          timeCorrectionText: String(center.timeCorrectionText || ''),
          timezoneOffset: String(center.timezoneOffset || ''),
          longitude: Number(center.longitude || 0),
          longitudeCorrectionMinutes: Number(center.longitudeCorrectionMinutes || 0),
          equationOfTimeMinutes: Number(center.equationOfTimeMinutes || 0),
          xiaoXianRuleLabel: String(center.xiaoXianRuleLabel || ''),
          liuNianRuleLabel: String(center.liuNianRuleLabel || ''),
          currentYearLabel: String(center.currentYearLabel || ''),
          currentYearGanZhiLabel: String(center.currentYearGanZhiLabel || ''),
          currentAgeLabel: String(center.currentAgeLabel || ''),
          currentDaXianLabel: String(center.currentDaXianLabel || ''),
          currentLiuNianPalaceLabel: String(center.currentLiuNianPalaceLabel || ''),
          qiYunText: String(center.qiYunText || ''),
          school: String(center.school || ''),
          shiftedByZiHour: Boolean(center.shiftedByZiHour),
          birthYearForAge: Number(center.birthYearForAge || 0),
          birthMonthForAge: Number(center.birthMonthForAge || 0),
          birthDayForAge: Number(center.birthDayForAge || 0),
          nonJieqiPillars: Array.isArray(center.nonJieqiPillars) ? center.nonJieqiPillars.slice(0, 4) : [],
          jieqiPillars: Array.isArray(center.jieqiPillars) ? center.jieqiPillars.slice(0, 4) : [],
          decadeMarks: Array.isArray(center.decadeMarks) ? center.decadeMarks.slice(0, 8) : [],
          huaSummary: Array.isArray(center.huaSummary) ? center.huaSummary.map(function(item) {
            return String(item && item.label || '');
          }) : []
        },
        daXianTimeline: Array.isArray(chart && chart.daXianTimeline)
          ? chart.daXianTimeline.slice(0, 12).map(function(item) {
            return {
              range: String(item && item.range || ''),
              branch: String(item && item.branch || ''),
              palaceName: String(item && item.palaceName || '')
            };
          })
          : [],
        liuNianTimeline: Array.isArray(chart && chart.liuNianTimeline)
          ? chart.liuNianTimeline.slice(0, 36).map(function(item) {
            return {
              year: Number(item && item.year || 0),
              age: Number(item && item.age || 0),
              ganzhi: String(item && item.ganzhi || ''),
              branch: String(item && item.branch || ''),
              palaceName: String(item && item.palaceName || '')
            };
          })
          : [],
        palaces: palaces,
        huaTracks: huaTracks,
        ruleSummary: ruleSummary,
        chartText: _zwTrimText(chart && chart.text, 12000)
      };
    }

    function _zwLegacyBuildAiPayloadCompact(chart) {
      var payload = _zwBuildAiPayload(chart);
      if (!payload || typeof payload !== 'object') return payload;
      payload.payloadVersion = 'ziwei-ai-v2-compact';
      payload.chartText = '';
      payload.ruleSummary = Array.isArray(payload.ruleSummary) ? payload.ruleSummary.slice(0, 4) : [];
      payload.huaTracks = Array.isArray(payload.huaTracks) ? payload.huaTracks.slice(0, 48) : [];
      payload.liuNianTimeline = Array.isArray(payload.liuNianTimeline) ? payload.liuNianTimeline.slice(0, 12) : [];
      payload.daXianTimeline = Array.isArray(payload.daXianTimeline) ? payload.daXianTimeline.slice(0, 8) : [];
      payload.palaces = Array.isArray(payload.palaces)
        ? payload.palaces.map(function(item) {
          var palace = Object.assign({}, item || {});
          palace.mainStars = Array.isArray(palace.mainStars) ? palace.mainStars.slice(0, 6) : [];
          palace.assistStars = Array.isArray(palace.assistStars) ? palace.assistStars.slice(0, 8) : [];
          palace.miscStars = Array.isArray(palace.miscStars) ? palace.miscStars.slice(0, 8) : [];
          palace.liuNianSeries = Array.isArray(palace.liuNianSeries) ? palace.liuNianSeries.slice(0, 4) : [];
          palace.xiaoXianSeries = Array.isArray(palace.xiaoXianSeries) ? palace.xiaoXianSeries.slice(0, 4) : [];
          palace.liuNianSeriesText = '';
          palace.xiaoXianSeriesText = '';
          return palace;
        })
        : [];
      return payload;
    }

    async function _zwParseInvokeError(err) {
      var status = 0;
      var detail = '';
      if (!err) return { status: 0, detail: '' };
      try {
        var ctx = err.context;
        if (ctx && typeof ctx.status === 'number') status = ctx.status;
        if (ctx && typeof ctx.clone === 'function') {
          var txt = await ctx.clone().text();
          if (txt) {
            try {
              var obj = JSON.parse(txt);
              detail = String((obj && (obj.error || obj.message)) || txt || '');
            } catch (_parseErr) {
              detail = String(txt || '');
            }
          }
        }
      } catch (_ctxErr) {
        // ignore
      }
      if (!detail) detail = String((err && err.message) || err || '');
      return { status: status, detail: detail };
    }
    function _zwIsComputeResourceErrorMessage(raw) {
      var text = String(raw || '').toLowerCase();
      if (!text) return false;
      return text.indexOf('compute resources') >= 0
        || text.indexOf('not having enough compute resources') >= 0
        || text.indexOf('out of memory') >= 0
        || text.indexOf('memory limit') >= 0
        || text.indexOf('resource exhausted') >= 0;
    }
    function _zwIsAiRateLimitErrorMessage(raw) {
      var text = String(raw || '').toLowerCase();
      if (!text) return false;
      return text.indexOf('429') >= 0
        || text.indexOf('rate limit') >= 0
        || text.indexOf('速率限制') >= 0
        || text.indexOf('请求频率') >= 0
        || text.indexOf('"code":"1302"') >= 0
        || text.indexOf("'code':'1302'") >= 0;
    }
    function _zwAiCooldownRemainingSeconds() {
      var remainMs = Math.max(0, Number(ziweiAiCooldownUntil.value || 0) - Date.now());
      return Math.max(0, Math.ceil(remainMs / 1000));
    }
    function _zwStartAiCooldown(ms, reasonText) {
      var cooldownMs = Math.max(1000, Number(ms || _ZIWEI_AI_RATE_LIMIT_COOLDOWN_MS));
      ziweiAiCooldownUntil.value = Date.now() + cooldownMs;
      var sec = Math.max(1, Math.ceil(cooldownMs / 1000));
      var reason = String(reasonText || '').trim();
      ziweiAiCooldownHint.value = reason || ('AI 请求过于频繁，请 ' + String(sec) + ' 秒后重试。');
      if (_ziweiAiCooldownTimer) clearTimeout(_ziweiAiCooldownTimer);
      _ziweiAiCooldownTimer = window.setTimeout(function() {
        ziweiAiCooldownUntil.value = 0;
        ziweiAiCooldownHint.value = '';
        _ziweiAiCooldownTimer = 0;
      }, cooldownMs + 120);
    }
    function _zwEnsureAiRequestAllowed() {
      var cooldownSec = _zwAiCooldownRemainingSeconds();
      if (cooldownSec > 0) {
        var msg = ziweiAiCooldownHint.value || ('AI 请求过于频繁，请 ' + String(cooldownSec) + ' 秒后重试。');
        ziweiStatus.value = { type: 'info', text: msg };
        return false;
      }
      var now = Date.now();
      var delta = now - Number(ziweiAiLastRequestAt.value || 0);
      if (delta > 0 && delta < _ZIWEI_AI_MIN_INTERVAL_MS) {
        _zwStartAiCooldown(_ZIWEI_AI_MIN_INTERVAL_MS - delta + 500, '请求过快，请稍后再试。');
        ziweiStatus.value = { type: 'info', text: ziweiAiCooldownHint.value || '请求过快，请稍后再试。' };
        return false;
      }
      ziweiAiLastRequestAt.value = now;
      return true;
    }
    function _zwMapAiErrorMessage(raw) {
      var code = String(raw || '').trim().toLowerCase();
      if (!code) return 'AI 服务暂时不可用，请稍后重试。';
      if (code === 'rate_limited') return '当前请求较多，触发了服务端限流，请稍后再试。';
      if (code === 'ai_upstream_rate_limited') return 'AI 上游服务限流或配额不足，请稍后重试。';
      if (code.indexOf('429') >= 0 || code.indexOf('rate limit') >= 0) {
        return 'AI 请求过于频繁，请稍后重试。';
      }
      if (code === 'forbidden_user') return '当前账号未开通紫微工具权限。';
      if (code === 'unauthorized') return '登录状态已失效，请重新登录后重试。';
      if (code === 'invalid_json' || code === 'invalid_payload' || code === 'chart_payload_too_small') return '命盘数据不完整，请重新排盘后再试。';
      if (code === 'invalid_question') return '请输入有效问题后再发送。';
      if (code === 'ai_request_timeout' || code === 'ai_upstream_timeout') return 'AI 思考超时，请稍后重试。';
      if (code === 'ai_upstream_not_found') return 'AI 服务配置异常，请联系管理员。';
      if (code === 'ai_upstream_auth_failed') return 'AI 服务鉴权失败，请检查 API Key、余额或模型权限。';
      if (code === 'ai_upstream_unavailable') return 'AI 上游服务暂时不可用，请稍后重试。';
      if (code === 'ai_upstream_bad_response') return 'AI 返回异常，请检查 AI_BASE_URL 与模型配置。';
      if (code === 'ai_response_invalid' || code === 'ai_response_empty' || code === 'ai_analysis_failed') return 'AI 返回结果异常，请稍后重试。';
      return 'AI 服务暂时不可用，请稍后重试。';
    }

    function _zwBuildAiPayloadCompact(chart) {
      var payload = _zwBuildAiPayload(chart);
      if (!payload || typeof payload !== 'object') return payload;
      payload.payloadVersion = 'ziwei-ai-v2-compact-v2';
      payload.chartText = '';
      payload.ruleSummary = [];
      payload.huaTracks = Array.isArray(payload.huaTracks) ? payload.huaTracks.slice(0, 20) : [];
      payload.liuNianTimeline = Array.isArray(payload.liuNianTimeline) ? payload.liuNianTimeline.slice(0, 8) : [];
      payload.daXianTimeline = Array.isArray(payload.daXianTimeline) ? payload.daXianTimeline.slice(0, 6) : [];
      if (payload.center && typeof payload.center === 'object') {
        payload.center.timeCorrectionText = '';
        payload.center.longitude = 0;
        payload.center.longitudeCorrectionMinutes = 0;
        payload.center.equationOfTimeMinutes = 0;
        payload.center.nonJieqiPillars = [];
        payload.center.jieqiPillars = [];
        payload.center.decadeMarks = [];
      }
      payload.palaces = Array.isArray(payload.palaces)
        ? payload.palaces.map(function(item) {
          return {
            branch: String(item && item.branch || ''),
            palaceName: String(item && item.palaceName || ''),
            stemBranch: String(item && item.stemBranch || ''),
            daXian: String(item && item.daXian || ''),
            xiaoXian: String(item && item.xiaoXian || ''),
            currentLiuNian: Number(item && item.currentLiuNian || 0),
            mainStars: Array.isArray(item && item.mainStars) ? item.mainStars.slice(0, 4) : [],
            assistStars: Array.isArray(item && item.assistStars) ? item.assistStars.slice(0, 4) : [],
            miscStars: Array.isArray(item && item.miscStars) ? item.miscStars.slice(0, 4) : []
          };
        })
        : [];
      return payload;
    }

    function _zwBuildAiPayloadLite(chart) {
      var payload = _zwBuildAiPayloadCompact(chart);
      if (!payload || typeof payload !== 'object') return payload;
      payload.payloadVersion = 'ziwei-ai-v2-lite-v2';
      payload.huaTracks = [];
      payload.liuNianTimeline = [];
      payload.daXianTimeline = [];
      payload.palaces = Array.isArray(payload.palaces)
        ? payload.palaces.map(function(item) {
          return {
            branch: String(item && item.branch || ''),
            palaceName: String(item && item.palaceName || ''),
            stemBranch: String(item && item.stemBranch || ''),
            mainStars: Array.isArray(item && item.mainStars) ? item.mainStars.slice(0, 2) : [],
            assistStars: Array.isArray(item && item.assistStars) ? item.assistStars.slice(0, 2) : [],
            miscStars: Array.isArray(item && item.miscStars) ? item.miscStars.slice(0, 2) : []
          };
        })
        : [];
      return payload;
    }

    async function requestZiweiAiAnalysis(options) {
      var opt = options || {};
      var force = opt.force === true;
      var silent = opt.silent === true;
      if (!ziweiChart.value) {
        if (!silent) ziweiStatus.value = { type: 'info', text: '\u8bf7\u5148\u5b8c\u6210\u6392\u76d8\u3002' };
        return;
      }
      if ((!window.authApi || typeof window.authApi.invokeFunction !== 'function') &&
          typeof window.__loadSqldevAuthNow === 'function') {
        try {
          await window.__loadSqldevAuthNow();
        } catch (_authLoadErr) {}
      }
      if (!window.authApi || typeof window.authApi.invokeFunction !== 'function') {
        if (!silent) ziweiStatus.value = { type: 'error', text: '\u8ba4\u8bc1\u6a21\u5757\u672a\u521d\u59cb\u5316\uff0c\u65e0\u6cd5\u8c03\u7528 AI \u89e3\u8bfb\u3002' };
        return;
      }
      if (typeof window.authApi.getUserSync === 'function' && !window.authApi.getUserSync()) {
        if (!silent) {
          if (typeof window.authApi.openAuthModal === 'function') {
            window.authApi.openAuthModal('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u4f7f\u7528 AI \u6df1\u5ea6\u89e3\u76d8');
          }
          ziweiStatus.value = { type: 'error', text: '\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u8c03\u7528 AI \u6df1\u5ea6\u89e3\u76d8\u3002' };
        }
        return;
      }
      if (!_zwEnsureAiRequestAllowed()) return;

      var aiSignature = _zwBuildAiSignature(ziweiChart.value);
      if (!force && aiSignature && _ziweiAiCache.has(aiSignature)) {
        var cached = _ziweiAiCache.get(aiSignature);
        ziweiAiResult.value = cached;
        ziweiAiDone.value = true;
        ziweiAiError.value = '';
        ziweiAiUpdatedAt.value = Date.now();
        ziweiLastAiSignature.value = aiSignature;
        if (!silent) ziweiStatus.value = { type: 'success', text: '\u5df2\u52a0\u8f7d\u7f13\u5b58\u7684 AI \u4e2a\u6027\u5316\u89e3\u76d8\u3002' };
        return;
      }
      if (_ziweiAiInFlightPromise) {
        if (!silent) ziweiStatus.value = { type: 'info', text: 'AI \u6b63\u5728\u601d\u8003\u4e2d\uff0c\u8bf7\u52ff\u91cd\u590d\u70b9\u51fb\u3002' };
        return _ziweiAiInFlightPromise;
      }
      if (ziweiAiLoading.value) {
        if (!silent) ziweiStatus.value = { type: 'info', text: 'AI \u6b63\u5728\u601d\u8003\u4e2d\uff0c\u8bf7\u7a0d\u540e...' };
        return;
      }

      var invokeAnalysis = async function(payload) {
        return await window.authApi.invokeFunction('ziwei-analysis', {
          signature: aiSignature,
          style: 'pro',
          chart: payload
        });
      };
      var primaryPayloadBuilder = _ZIWEI_AI_PRIMARY_PAYLOAD === 'compact'
        ? _zwBuildAiPayloadCompact
        : _zwBuildAiPayloadLite;
      var secondaryPayloadBuilder = _ZIWEI_AI_PRIMARY_PAYLOAD === 'compact'
        ? _zwBuildAiPayloadLite
        : _zwBuildAiPayloadCompact;
      var getErrorDetail = async function(rawErr) {
        var parsed = await _zwParseInvokeError(rawErr);
        return String(parsed.detail || (rawErr && rawErr.message) || rawErr || '\u8bf7\u6c42\u5931\u8d25');
      };

      ziweiAiLoading.value = true;
      ziweiAiError.value = '';
      ziweiAiLastDurationMs.value = 0;
      var startedAt = Date.now();
      if (!silent) ziweiStatus.value = { type: 'info', text: 'AI \u6b63\u5728\u601d\u8003\u4e2d\uff0c\u8bf7\u7a0d\u540e...' };
      try {
        _ziweiAiInFlightSignature = aiSignature;
        var result = null;
        try {
          _ziweiAiInFlightPromise = invokeAnalysis(primaryPayloadBuilder(ziweiChart.value));
          result = await _ziweiAiInFlightPromise;
          if (result && result.error) throw result.error;
        } catch (firstErr) {
          var firstDetail = await getErrorDetail(firstErr);
          if (_zwIsAiRateLimitErrorMessage(firstDetail)) throw new Error(firstDetail || '\u8bf7\u6c42\u5931\u8d25');
          if (!_zwIsComputeResourceErrorMessage(firstDetail)) throw new Error(firstDetail || '\u8bf7\u6c42\u5931\u8d25');
          _ziweiAiInFlightPromise = invokeAnalysis(secondaryPayloadBuilder(ziweiChart.value));
          result = await _ziweiAiInFlightPromise;
          if (result && result.error) {
            var secondDetail = await getErrorDetail(result.error);
            throw new Error(secondDetail || '\u8bf7\u6c42\u5931\u8d25');
          }
        }

        var data = result ? result.data : null;
        var analysis = data && data.analysis ? data.analysis : null;
        if (!analysis || typeof analysis.overview !== 'string' || !Array.isArray(analysis.sections)) {
          throw new Error('AI \u8fd4\u56de\u683c\u5f0f\u5f02\u5e38');
        }

        ziweiAiResult.value = analysis;
        ziweiAiDone.value = true;
        ziweiAiError.value = '';
        ziweiAiUpdatedAt.value = Date.now();
        ziweiLastAiSignature.value = aiSignature;
        if (aiSignature) {
          _ziweiAiCache.set(aiSignature, analysis);
          if (_ziweiAiCache.size > _ZIWEI_AI_CACHE_MAX) {
            var firstKey = _ziweiAiCache.keys().next().value;
            if (firstKey) _ziweiAiCache.delete(firstKey);
          }
        }
        var elapsedMs = Date.now() - startedAt;
        ziweiAiLastDurationMs.value = elapsedMs;
        if (!silent) ziweiStatus.value = { type: 'success', text: 'AI \u4e2a\u6027\u5316\u89e3\u76d8\u5df2\u751f\u6210\uff08\u601d\u8003\u8017\u65f6 ' + formatZiweiDurationText(elapsedMs) + '\uff09\u3002' };
      } catch (err) {
        var msg = String((err && err.message) || err || 'AI \u8bf7\u6c42\u5931\u8d25');
        if (_zwIsAiRateLimitErrorMessage(msg)) {
          _zwStartAiCooldown(_ZIWEI_AI_RATE_LIMIT_COOLDOWN_MS, '您的账户已达到速率限制，请稍后再试。');
          msg = ziweiAiCooldownHint.value || msg;
        }
        if (!_zwIsAiRateLimitErrorMessage(msg)) msg = _zwMapAiErrorMessage(msg);
        ziweiAiDone.value = false;
        ziweiAiError.value = msg;
        ziweiAiLastDurationMs.value = Date.now() - startedAt;
        if (!silent) ziweiStatus.value = { type: 'error', text: 'AI \u6df1\u5ea6\u89e3\u76d8\u5931\u8d25\uff1a' + msg };
      } finally {
        ziweiAiLoading.value = false;
        _ziweiAiInFlightPromise = null;
        _ziweiAiInFlightSignature = '';
      }
    }

    function _zwBuildChartText(chart) {
      if (!chart) return '';
      var lines = [];
      lines.push('【紫微斗数命盘】');
      lines.push('性别：' + chart.center.genderLabel);
      lines.push('公历：' + chart.center.solarText);
      lines.push('农历：' + chart.center.lunarText);
      lines.push('生年干支：' + chart.center.yearGanZhi);
      lines.push('流派：' + chart.center.schoolLabel);
      lines.push('五行局：' + chart.center.bureauLabel);
      lines.push('校时模式：' + (chart.center.clockModeLabel || '标准时间'));
      if (chart.center.timeCorrectionText) lines.push('校时修正：' + chart.center.timeCorrectionText);
      if (typeof chart.center.longitudeCorrectionMinutes === 'number' || typeof chart.center.equationOfTimeMinutes === 'number') {
        var lc = Number(chart.center.longitudeCorrectionMinutes || 0);
        var ec = Number(chart.center.equationOfTimeMinutes || 0);
        lines.push('校时分解：经度修正 ' + (lc >= 0 ? '+' : '') + lc.toFixed(2) + ' 分钟；时差方程 ' + (ec >= 0 ? '+' : '') + ec.toFixed(2) + ' 分钟');
      }
      lines.push('小限起法：' + (chart.center.xiaoXianRuleLabel || '--'));
      lines.push('流年起法：' + (chart.center.liuNianRuleLabel || '--'));
      lines.push('大限方向：' + chart.center.daXianDirectionLabel);
      lines.push('命宫/身宫：' + chart.center.mingBranch + ' / ' + chart.center.shenBranch + '（身宫落' + chart.center.shenPalaceName + '）');
      lines.push('命主/身主：' + chart.center.mingZhu + ' / ' + chart.center.shenZhu);
      if (chart.center.huaSummary && chart.center.huaSummary.length) {
        lines.push('本命四化：' + chart.center.huaSummary.map(function(item) { return item.label; }).join('  '));
      }
      lines.push('');
      chart.boardCells.forEach(function(cell) {
        var title = '[' + cell.branch + '宫] ' + (cell.palaceName || '—') + ' / ' + (cell.stemBranch || '');
        var mains = cell.mainStars.map(function(star) {
          var s = star.name;
          if (star.brightness) s += '(' + star.brightness + ')';
          if (star.huaTags && star.huaTags.length) s += '[' + star.huaTags.join('/') + ']';
          return s;
        });
        var assists = cell.assistStars.map(function(star) {
          var s = star.name;
          if (star.huaTags && star.huaTags.length) s += '[' + star.huaTags.join('/') + ']';
          return s;
        });
        var misc = cell.miscStars.map(function(star) {
          var s = star.name;
          if (star.huaTags && star.huaTags.length) s += '[' + star.huaTags.join('/') + ']';
          return s;
        });
        lines.push(title);
        lines.push('  主星：' + (mains.length ? mains.join('、') : '无'));
        lines.push('  辅星：' + (assists.length ? assists.join('、') : '无'));
        lines.push('  杂曜：' + (misc.length ? misc.join('、') : '无'));
        lines.push('  大限：' + (cell.daXian || '--') + '  小限：' + (cell.xiaoXian || '--') + '  十二长生：' + (cell.changSheng || '--'));
        lines.push('  流年序列：' + (cell.liuNianSeriesText || '--'));
        lines.push('  小限序列：' + (cell.xiaoXianSeriesText || '--'));
        if (typeof cell.outgoingHuaCount === 'number' && typeof cell.incomingHuaCount === 'number') {
          lines.push('  飞化：飞出' + cell.outgoingHuaCount + ' / 飞入' + cell.incomingHuaCount);
        }
      });
      lines.push('');
      lines.push('【大限总览】');
      (chart.daXianTimeline || []).forEach(function(item) {
        lines.push('  ' + item.range + '  ' + (item.branch || '') + (item.palaceName ? (' ' + item.palaceName) : ''));
      });
      lines.push('【流年总览】');
      (chart.liuNianTimeline || []).forEach(function(item) {
        var branchText = item && item.branch ? (' ' + item.branch + (item.palaceName ? (' ' + item.palaceName) : '')) : '';
        lines.push('  ' + item.year + '年 ' + item.ganzhi + ' ' + item.age + '岁' + branchText);
      });
      if (chart.huaTracks && chart.huaTracks.length) {
        lines.push('【飞化落宫追踪】');
        chart.huaTracks.slice(0, 48).forEach(function(track) {
          lines.push('  化' + track.tag + ' ' + track.star + '：' + track.sourceText + ' -> ' + track.targetText);
        });
      }
      return lines.join('\n');
    }

    function _zwBrightnessClass(level) {
      var text = String(level || '');
      if (text === '庙' || text === '旺' || text === '得') return 'good';
      if (text === '陷' || text === '不得') return 'bad';
      return 'normal';
    }

    function _zwBuildGenerateSignature() {
      return [
        String(ziweiCalendarType.value || ''),
        String(ziweiSolarYear.value || ''),
        String(ziweiSolarMonth.value || ''),
        String(ziweiSolarDay.value || ''),
        String(ziweiLunarYear.value || ''),
        String(ziweiLunarMonth.value || ''),
        String(ziweiLunarDay.value || ''),
        ziweiLunarLeap.value ? '1' : '0',
        String(ziweiBirthHour.value || ''),
        String(ziweiBirthMinute.value || ''),
        String(ziweiGender.value || ''),
        String(ziweiClockMode.value || ''),
        String(ziweiTimezoneOffset.value || ''),
        String(ziweiLongitude.value || ''),
        String(ziweiXiaoXianRule.value || ''),
        String(ziweiLiuNianRule.value || ''),
        String(ziweiSchool.value || ''),
        'pro'
      ].join('|');
    }

    async function generateZiweiChart(options) {
      var opt = options || {};
      var saveHistory = opt.saveHistory !== false;
      var silent = opt.silent === true;
      var generateSignature = _zwBuildGenerateSignature();
      var repeatGenerate = !!(ziweiChart.value && generateSignature && generateSignature === ziweiLastGenerateSignature.value);
      if (!silent) {
        ziweiGenerating.value = true;
        ziweiStatus.value = {
          type: 'info',
          text: repeatGenerate ? '检测到参数未变化，正在重新排盘校验...' : '正在排盘，请稍候...'
        };
        await nextTick();
      }
      try {
        if (!ziweiIntlSupported) {
          ziweiStatus.value = { type: 'error', text: '当前浏览器不支持农历转换（Intl Chinese Calendar），请升级浏览器后重试。' };
          return;
        }

        _zwNormalizeSolarDay();
        _zwNormalizeLunarInput();

      var inputHour = Number(ziweiBirthHour.value || '0');
      var inputMinute = Number(ziweiBirthMinute.value || '0');
      if (!Number.isInteger(inputHour) || inputHour < 0 || inputHour > 23 || !Number.isInteger(inputMinute) || inputMinute < 0 || inputMinute > 59) {
        ziweiStatus.value = { type: 'error', text: '出生时间格式无效，请重新选择时分。' };
        return;
      }

      var baseSolar = null;
      if (ziweiCalendarType.value === 'lunar') {
        var ly = Number(ziweiLunarYear.value || '0');
        var lm = Number(ziweiLunarMonth.value || '0');
        var ld = Number(ziweiLunarDay.value || '0');
        var leap = !!ziweiLunarLeap.value;
        if (!Number.isInteger(ly) || ly < 1900 || ly > 2100 || !Number.isInteger(lm) || lm < 1 || lm > 12 || !Number.isInteger(ld) || ld < 1 || ld > 30) {
          ziweiStatus.value = { type: 'error', text: '农历出生日期不合法，请检查年/月/日输入。' };
          return;
        }
        if (leap && !ziweiCanUseLeapMonth.value) {
          ziweiStatus.value = { type: 'error', text: '所选年份无该闰月，请取消闰月或修改月份。' };
          return;
        }
        var solarFromLunar = _zwLunarToSolar(ly, lm, ld, leap);
        if (!solarFromLunar) {
          ziweiStatus.value = { type: 'error', text: '农历转公历失败，请检查日期（含闰月）是否存在。' };
          return;
        }
        baseSolar = solarFromLunar;
      } else {
        var sy = Number(ziweiSolarYear.value || '0');
        var sm = Number(ziweiSolarMonth.value || '0');
        var sd = Number(ziweiSolarDay.value || '0');
        if (!_isValidDateParts(sy, sm, sd) || sy < 1900 || sy > 2100) {
          ziweiStatus.value = { type: 'error', text: '公历出生日期不合法，请检查输入范围（1900-2100）。' };
          return;
        }
        baseSolar = { year: sy, month: sm, day: sd };
      }

      var clockMode = ziweiClockMode.value === 'trueSolar' ? 'trueSolar' : 'standard';
      var clockRes = _zwApplyClockCorrection(
        baseSolar,
        inputHour,
        inputMinute,
        clockMode,
        ziweiLongitude.value,
        ziweiTimezoneOffset.value
      );
      if (!clockRes || !clockRes.ok) {
        ziweiStatus.value = { type: 'error', text: (clockRes && clockRes.error) || '校时失败，请检查输入。' };
        return;
      }

      var workingSolar = clockRes.solar;
      var workingLunar = _zwSolarToLunar(workingSolar.year, workingSolar.month, workingSolar.day);
      if (!workingLunar) {
        ziweiStatus.value = { type: 'error', text: '校时后的日期无法转换农历，请检查输入。' };
        return;
      }

      var calcHour = Number(clockRes.hour);
      var calcMinute = Number(clockRes.minute);
      var effectiveSolar = workingSolar;
      var effectiveLunar = workingLunar;
      var shiftedByZiHour = false;
      if (calcHour === 23) {
        shiftedByZiHour = true;
        effectiveSolar = _zwSolarAddDays(workingSolar, 1);
        effectiveLunar = _zwSolarToLunar(effectiveSolar.year, effectiveSolar.month, effectiveSolar.day);
        if (!effectiveLunar) {
          ziweiStatus.value = { type: 'error', text: '子时换日处理失败，请重试。' };
          return;
        }
      }

      var shichenIndex0 = _zwGetShiChenIndex0(calcHour);
      var shichenIndex1 = shichenIndex0 + 1;
      if (shichenIndex0 < 0 || shichenIndex1 < 1 || shichenIndex1 > 12) {
        ziweiStatus.value = { type: 'error', text: '出生时辰计算失败。' };
        return;
      }

      var lunarMonth = Number(effectiveLunar.lunarMonth);
      var lunarDay = Number(effectiveLunar.lunarDay);
      var yearGanZhi = _zwGetYearGanZhi(effectiveLunar.lunarYear);
      var yearStem = yearGanZhi.slice(0, 1);
      var yearBranch = yearGanZhi.slice(1, 2);
      var lunarMonthBranch = _zwGetMonthBranchByLunarMonth(lunarMonth);
      var lunarMonthGanZhi = _zwGetMonthGanZhiByYearStem(yearStem, lunarMonthBranch);
      var dayGanZhi = _zwGetDayGanZhiBySolar(effectiveSolar.year, effectiveSolar.month, effectiveSolar.day);
      var hourGanZhi = _zwGetHourGanZhiByDayGan(dayGanZhi, calcHour);
      var jieqiYear = _zwGetJieQiYearApprox(effectiveSolar.year, effectiveSolar.month, effectiveSolar.day);
      var jieqiYearGanZhi = _zwGetYearGanZhi(jieqiYear);
      var jieqiYearStem = jieqiYearGanZhi.slice(0, 1);
      var jieqiMonthBranch = _zwGetMonthBranchBySolarApprox(effectiveSolar.month, effectiveSolar.day);
      var jieqiMonthGanZhi = _zwGetMonthGanZhiByYearStem(jieqiYearStem, jieqiMonthBranch);
      var nonJieqiPillars = [yearGanZhi, lunarMonthGanZhi, dayGanZhi, hourGanZhi];
      var jieqiPillars = [jieqiYearGanZhi, jieqiMonthGanZhi, dayGanZhi, hourGanZhi];
      var currentSchool = ziweiSchool.value === 'flying' ? 'flying' : 'traditional';
      if (!yearStem || !yearBranch) {
        ziweiStatus.value = { type: 'error', text: '生年干支计算失败。' };
        return;
      }

      var mingPos = ((lunarMonth + 1 - shichenIndex1) % 12 + 12) % 12;
      if (mingPos === 0) mingPos = 12;
      var shenPos = ((lunarMonth - 1 + shichenIndex1) % 12 + 12) % 12;
      if (shenPos === 0) shenPos = 12;
      var mingBranch = ZW_RING[mingPos - 1];
      var shenBranch = ZW_RING[shenPos - 1];

      var palaceNameByBranch = _zwInstallTwelvePalaces(mingBranch);
      var branchStemMap = _zwBuildBranchStemMap(yearStem);
      var mingGan = branchStemMap[mingBranch] || '甲';
      var mingGanZhi = mingGan + mingBranch;
      var bureauInfo = _zwResolveBureauByGanZhi(mingGanZhi);
      var bureauNum = bureauInfo.bureau;
      var bureauLabel = bureauInfo.element + String(bureauNum) + '局';
      var ziweiPos = _zwLocateZiWeiPos(lunarDay, bureauNum);
      var ziweiBranch = ZW_RING[ziweiPos - 1];
      var tianfuBranch = ZW_TIANFU_MIRROR[ziweiBranch] || _zwOffset(ziweiBranch, 6);

      var palaceStars = {};
      ZW_RING.forEach(function(branch) {
        palaceStars[branch] = { main: [], assist: [], misc: [], huaByStar: {} };
      });
      var starBranchMap = {};

      function addStar(starName, branch, group) {
        if (!starName || !branch || !palaceStars[branch]) return;
        var bucket = palaceStars[branch][group];
        if (!bucket || !Array.isArray(bucket)) return;
        if (bucket.indexOf(starName) < 0) bucket.push(starName);
        starBranchMap[starName] = branch;
      }

      // 紫微星系
      addStar('紫微', ziweiBranch, 'main');
      addStar('天机', _zwOffset(ziweiBranch, -1), 'main');
      addStar('太阳', _zwOffset(ziweiBranch, -3), 'main');
      addStar('武曲', _zwOffset(ziweiBranch, -4), 'main');
      addStar('天同', _zwOffset(ziweiBranch, -5), 'main');
      addStar('廉贞', _zwOffset(ziweiBranch, -8), 'main');

      // 天府星系
      addStar('天府', tianfuBranch, 'main');
      addStar('太阴', _zwOffset(tianfuBranch, 1), 'main');
      addStar('贪狼', _zwOffset(tianfuBranch, 2), 'main');
      addStar('巨门', _zwOffset(tianfuBranch, 3), 'main');
      addStar('天相', _zwOffset(tianfuBranch, 4), 'main');
      addStar('天梁', _zwOffset(tianfuBranch, 5), 'main');
      addStar('七杀', _zwOffset(tianfuBranch, 6), 'main');
      addStar('破军', _zwOffset(tianfuBranch, 10), 'main');

      // 辅曜
      addStar('左辅', _zwOffset('辰', lunarMonth - 1), 'assist');
      addStar('右弼', _zwOffset('戌', -(lunarMonth - 1)), 'assist');
      addStar('文昌', _zwOffset('戌', -shichenIndex0), 'assist');
      addStar('文曲', _zwOffset('辰', shichenIndex0), 'assist');

      var kuiYue = ZW_KUI_YUE_BY_STEM[yearStem];
      if (kuiYue) {
        addStar('天魁', kuiYue.kui, 'assist');
        addStar('天钺', kuiYue.yue, 'assist');
      }
      var lyt = ZW_LUCUN_YANG_TUO_BY_STEM[yearStem];
      if (lyt) {
        addStar('禄存', lyt.lucun, 'assist');
        addStar('擎羊', lyt.yang, 'assist');
        addStar('陀罗', lyt.tuo, 'assist');
      }
      var fireBell = ZW_FIRE_BELL_BY_YEAR_BRANCH[yearBranch];
      if (fireBell) {
        addStar('火星', _zwOffset(fireBell.fire, shichenIndex0), 'assist');
        addStar('铃星', _zwOffset(fireBell.bell, shichenIndex0), 'assist');
      }
      addStar('地劫', _zwOffset('亥', shichenIndex0), 'assist');
      addStar('天空', _zwOffset('亥', -shichenIndex0), 'assist');

      // 杂曜
      addStar('天马', ZW_TIANMA_BY_YEAR_BRANCH[yearBranch], 'misc');
      var yearBranchIndex = ZW_BRANCHES.indexOf(yearBranch);
      if (yearBranchIndex < 0) yearBranchIndex = 0;
      var hongLuanBranch = _zwOffset('卯', -yearBranchIndex);
      addStar('红鸾', hongLuanBranch, 'misc');
      addStar('天喜', _zwOffset(hongLuanBranch, 6), 'misc');
      addStar('天刑', _zwOffset('酉', lunarMonth - 1), 'misc');
      addStar('天姚', _zwOffset('丑', lunarMonth - 1), 'misc');

      // 四化
      var huaRule = ZW_HUA_BY_STEM[yearStem] || null;
      if (currentSchool === 'flying') {
        ZW_RING.forEach(function(branch) {
          var stemForBranch = (branchStemMap && branchStemMap[branch]) || '';
          var flyRule = ZW_HUA_BY_STEM[stemForBranch];
          if (!flyRule) return;
          ZW_HUA_TAG_ITEMS.forEach(function(item) {
            var starName = flyRule[item.key];
            var targetBranch = starBranchMap[starName];
            if (!targetBranch || !palaceStars[targetBranch]) return;
            if (!palaceStars[targetBranch].huaByStar[starName]) palaceStars[targetBranch].huaByStar[starName] = [];
            if (palaceStars[targetBranch].huaByStar[starName].indexOf(item.tag) < 0) {
              palaceStars[targetBranch].huaByStar[starName].push(item.tag);
            }
          });
        });
      } else if (huaRule) {
        ZW_HUA_TAG_ITEMS.forEach(function(item) {
          var starName = huaRule[item.key];
          var branch = starBranchMap[starName];
          if (!branch || !palaceStars[branch]) return;
          if (!palaceStars[branch].huaByStar[starName]) palaceStars[branch].huaByStar[starName] = [];
          if (palaceStars[branch].huaByStar[starName].indexOf(item.tag) < 0) {
            palaceStars[branch].huaByStar[starName].push(item.tag);
          }
        });
      }

      var isYangYear = ZW_YEAR_STEM_YINYANG[yearStem] === '阳';
      var isMale = ziweiGender.value === 'male';
      var daXianDirection = (isYangYear && isMale) || (!isYangYear && !isMale) ? 1 : -1;
      var daXianMap = _zwBuildDaXianMap(mingBranch, bureauNum, daXianDirection);
      var xiaoXianRule = ziweiXiaoXianRule.value === 'mingStart' ? 'mingStart' : 'yearBranch';
      var liuNianRule = ziweiLiuNianRule.value === 'followDaXian' ? 'followDaXian' : 'yearForward';
      var xiaoXianMap = _zwBuildXiaoXianMap(yearBranch, isMale ? 'male' : 'female', mingBranch, xiaoXianRule);
      var liuNianFirstAgeMap = _zwBuildLiuNianFirstAgeMap(yearBranch, daXianDirection, liuNianRule);
      var changShengMap = _zwBuildChangShengMap(bureauInfo.element);
      var daXianTimeline = _zwBuildDaXianTimeline(mingBranch, bureauNum, daXianDirection, palaceNameByBranch, 10);
      var liuNianTimeline = _zwBuildLiuNianTimeline(effectiveSolar.year, bureauNum, 10, liuNianFirstAgeMap, palaceNameByBranch);
      var huaSummary = [];
      if (huaRule) {
        huaSummary = [
          { tag: '禄', star: huaRule.lu, label: '禄:' + huaRule.lu },
          { tag: '权', star: huaRule.quan, label: '权:' + huaRule.quan },
          { tag: '科', star: huaRule.ke, label: '科:' + huaRule.ke },
          { tag: '忌', star: huaRule.ji, label: '忌:' + huaRule.ji }
        ];
      }
      var huaTracks = _zwBuildHuaTracks(currentSchool, yearStem, yearBranch, branchStemMap, starBranchMap, palaceNameByBranch);
      if (currentSchool === 'flying') {
        var flySummary = [];
        var seenHua = {};
        for (var hi = 0; hi < huaTracks.length; hi++) {
          var track = huaTracks[hi];
          if (!track) continue;
          var key = String(track.tag || '') + '|' + String(track.star || '');
          if (!track.tag || !track.star || seenHua[key]) continue;
          seenHua[key] = true;
          flySummary.push({
            tag: track.tag,
            star: track.star,
            label: String(track.tag || '') + String(track.star || '')
          });
          if (flySummary.length >= 12) break;
        }
        huaSummary = flySummary;
      }

      var boardCells = ZW_BOARD_ORDER.map(function(branch) {
        var pack = palaceStars[branch] || { main: [], assist: [], misc: [], huaByStar: {} };
        var main = pack.main.map(function(star) {
          var brightness = (ZW_BRIGHTNESS[star] && ZW_BRIGHTNESS[star][branch]) || '';
          var huaTags = pack.huaByStar[star] || [];
          return {
            name: star,
            brightness: brightness,
            brightnessClass: _zwBrightnessClass(brightness),
            huaTags: huaTags
          };
        });
        var assist = pack.assist.map(function(star) {
          return { name: star, huaTags: pack.huaByStar[star] || [] };
        });
        var misc = pack.misc.map(function(star) {
          return { name: star, huaTags: pack.huaByStar[star] || [] };
        });
        var xiaoFirstAge = _zwParseAgeValue(xiaoXianMap[branch]);
        var liuFirstAge = _zwParseAgeValue(liuNianFirstAgeMap[branch]);
        var xiaoSeries = _zwBuildAgeSeries(xiaoFirstAge, 120, 12);
        var liuSeries = _zwBuildAgeSeries(liuFirstAge, 120, 12);
        var outgoingTracks = huaTracks.filter(function(track) { return track && track.sourceBranch === branch; });
        var incomingTracks = huaTracks.filter(function(track) { return track && track.targetBranch === branch; });
        var mainStarsText = main.length
          ? main.map(function(s) { return s.name + (s.brightness ? ('(' + s.brightness + ')') : ''); }).join('、')
          : '无';
        var assistStarsText = assist.length ? assist.map(function(s) { return s.name; }).join('、') : '无';
        var miscStarsText = misc.length ? misc.map(function(s) { return s.name; }).join('、') : '无';
        return {
          branch: branch,
          area: ZW_BOARD_AREA[branch] || '',
          palaceName: palaceNameByBranch[branch] || '',
          stemBranch: (branchStemMap[branch] || '') + branch,
          isMing: branch === mingBranch,
          isShen: branch === shenBranch,
          mainStars: main,
          assistStars: assist,
          miscStars: misc,
          daXian: daXianMap[branch] || '--',
          xiaoXian: xiaoXianMap[branch] || '--',
          changSheng: changShengMap[branch] || '',
          liuNianSeries: liuSeries,
          xiaoXianSeries: xiaoSeries,
          mainStarsText: mainStarsText,
          assistStarsText: assistStarsText,
          miscStarsText: miscStarsText,
          liuNianSeriesText: liuSeries.length ? liuSeries.join(',') : '',
          xiaoXianSeriesText: xiaoSeries.length ? xiaoSeries.join(',') : '',
          currentLiuNian: null,
          currentXiaoXian: null,
          outgoingHuaCount: outgoingTracks.length,
          incomingHuaCount: incomingTracks.length
        };
      });

      var inputSolarDateText = [
        String(baseSolar.year).padStart(4, '0'),
        String(baseSolar.month).padStart(2, '0'),
        String(baseSolar.day).padStart(2, '0')
      ].join('-');
      var inputClockText = inputSolarDateText + ' ' + String(inputHour).padStart(2, '0') + ':' + String(inputMinute).padStart(2, '0');
      var solarText = [
        String(effectiveSolar.year).padStart(4, '0'),
        String(effectiveSolar.month).padStart(2, '0'),
        String(effectiveSolar.day).padStart(2, '0')
      ].join('-') + ' ' + String(calcHour).padStart(2, '0') + ':' + String(calcMinute).padStart(2, '0');
      var lunarMonthLabel = ZW_LUNAR_MONTH_LABEL[effectiveLunar.lunarMonth - 1] || String(effectiveLunar.lunarMonth);
      var lunarDayLabel = ZW_LUNAR_DAY_LABEL[effectiveLunar.lunarDay] || String(effectiveLunar.lunarDay);
      var lunarText = String(effectiveLunar.lunarYear) + '年' +
        (effectiveLunar.isLeapMonth ? '闰' : '') +
        lunarMonthLabel + '月' +
        lunarDayLabel +
        ' ' + _zwGetShiChenLabel(calcHour) +
        ' (' + String(calcHour).padStart(2, '0') + ':' + String(calcMinute).padStart(2, '0') + ')';
      var correctionText = '';
      if (clockMode === 'trueSolar') {
        var cm = Number(clockRes.correctionMinutes || 0);
        var lonCm = Number(clockRes.longitudeCorrectionMinutes || 0);
        var eotCm = Number(clockRes.equationOfTimeMinutes || 0);
        var tz = Number(clockRes.timezoneOffset);
        var lon = Number(clockRes.longitude);
        correctionText = (cm >= 0 ? '+' : '') + cm.toFixed(2) + ' 分钟（经度修正 ' +
          (lonCm >= 0 ? '+' : '') + lonCm.toFixed(2) + '，时差方程 ' +
          (eotCm >= 0 ? '+' : '') + eotCm.toFixed(2) + '；经度 ' + lon.toFixed(3) +
          '°，时区 UTC' + (tz >= 0 ? '+' : '') + String(tz) + '）';
      }
      var nowDate = new Date();
      var currentYearNum = Number(nowDate.getFullYear());
      var currentAge = currentYearNum - Number(baseSolar.year);
      var nowMonth = Number(nowDate.getMonth()) + 1;
      var nowDay = Number(nowDate.getDate());
      if (nowMonth < Number(baseSolar.month) || (nowMonth === Number(baseSolar.month) && nowDay < Number(baseSolar.day))) {
        currentAge -= 1;
      }
      if (!Number.isFinite(currentAge) || currentAge < 0) currentAge = 0;
      var currentDaXianItem = null;
      for (var di = 0; di < daXianTimeline.length; di++) {
        var diItem = daXianTimeline[di];
        if (!diItem || !diItem.range) continue;
        var rg = String(diItem.range).match(/(\d+)\s*-\s*(\d+)/);
        if (!rg) continue;
        var rf = Number(rg[1]);
        var rt = Number(rg[2]);
        if (Number.isFinite(rf) && Number.isFinite(rt) && currentAge >= rf && currentAge <= rt) {
          currentDaXianItem = diItem;
          break;
        }
      }
      if (!currentDaXianItem && daXianTimeline.length) currentDaXianItem = daXianTimeline[0];
      var currentLiuNianItem = null;
      for (var li = 0; li < liuNianTimeline.length; li++) {
        var ln = liuNianTimeline[li];
        if (ln && Number(ln.year) === currentYearNum) {
          currentLiuNianItem = ln;
          break;
        }
      }
      for (var ci = 0; ci < boardCells.length; ci++) {
        var cell = boardCells[ci];
        var liuSeriesCur = Array.isArray(cell.liuNianSeries) ? cell.liuNianSeries : [];
        var xiaoSeriesCur = Array.isArray(cell.xiaoXianSeries) ? cell.xiaoXianSeries : [];
        cell.currentLiuNian = liuSeriesCur.indexOf(currentYearNum) >= 0
          ? currentYearNum
          : (liuSeriesCur.length ? liuSeriesCur[0] : null);
        cell.currentXiaoXian = xiaoSeriesCur.indexOf(currentAge) >= 0
          ? currentAge
          : (xiaoSeriesCur.length ? xiaoSeriesCur[0] : null);
      }
      var decadeMarks = daXianTimeline.slice(0, 8).map(function(item) {
        var range = String(item && item.range || '--');
        var startAgeMatch = range.match(/^\d+/);
        var startAge = startAgeMatch ? Number(startAgeMatch[0]) : NaN;
        var markerYear = Number(baseSolar.year) + (Number.isFinite(startAge) ? startAge : 0);
        return {
          year: Number.isFinite(markerYear) && markerYear > 0 ? String(markerYear) : '--',
          ganzhi: Number.isFinite(markerYear) && markerYear > 0 ? _zwGetYearGanZhi(markerYear) : '--',
          range: range
        };
      });
      var qiYunText = '出生后' + String(Math.max(2, Number(bureauNum) || 2)) + '岁起运';
      var center = {
        genderLabel: isMale ? '男' : '女',
        yinYangGenderLabel: String(ZW_YEAR_STEM_YINYANG[yearStem] || '') + (isMale ? '男' : '女'),
        solarText: solarText,
        lunarText: lunarText,
        inputClockText: inputClockText,
        calendarInputType: ziweiCalendarType.value === 'lunar' ? '农历输入' : '公历输入',
        yearGanZhi: yearGanZhi,
        naYinLabel: String(bureauInfo.nayin || ''),
        mingZhu: ZW_MINGZHU_BY_BRANCH[mingBranch] || '',
        shenZhu: ZW_SHENZHU_BY_YEAR_BRANCH[yearBranch] || '',
        bureauLabel: bureauLabel,
        mingBranch: mingBranch,
        mingPalaceName: palaceNameByBranch[mingBranch] || '',
        shenBranch: shenBranch,
        shenPalaceName: palaceNameByBranch[shenBranch] || '',
        ziweiBranch: ziweiBranch,
        tianfuBranch: tianfuBranch,
        monthLabel: lunarMonthLabel + '月',
        shichenLabel: _zwGetShiChenLabel(calcHour),
        nonJieqiPillars: nonJieqiPillars.map(_zwSplitGanZhi),
        jieqiPillars: jieqiPillars.map(_zwSplitGanZhi),
        qiYunText: qiYunText,
        decadeMarks: decadeMarks,
        daXianDirectionLabel: daXianDirection > 0 ? '顺行' : '逆行',
        clockMode: clockMode,
        clockModeLabel: _zwClockModeToLabel(clockMode),
        timeCorrectionMinutes: Number(clockRes.correctionMinutes || 0),
        longitudeCorrectionMinutes: Number(clockRes.longitudeCorrectionMinutes || 0),
        equationOfTimeMinutes: Number(clockRes.equationOfTimeMinutes || 0),
        timeCorrectionText: correctionText,
        timezoneOffset: clockRes.timezoneOffset,
        longitude: clockRes.longitude,
        xiaoXianRule: xiaoXianRule,
        xiaoXianRuleLabel: _zwXiaoXianRuleToLabel(xiaoXianRule),
        liuNianRule: liuNianRule,
        liuNianRuleLabel: _zwLiuNianRuleToLabel(liuNianRule),
        currentYearLabel: String(currentYearNum) + '年',
        currentAgeLabel: String(currentAge) + '岁',
        currentYearGanZhiLabel: _zwGetYearGanZhi(currentYearNum),
        currentDaXianLabel: currentDaXianItem
          ? ((currentDaXianItem.range || '--') + ' ' + (currentDaXianItem.branch || '--') + (currentDaXianItem.palaceName ? ('·' + currentDaXianItem.palaceName) : ''))
          : '--',
        currentLiuNianPalaceLabel: currentLiuNianItem
          ? ((currentLiuNianItem.branch || '--') + (currentLiuNianItem.palaceName ? ('·' + currentLiuNianItem.palaceName) : ''))
          : '--',
        birthYearForAge: Number(baseSolar.year),
        birthMonthForAge: Number(baseSolar.month),
        birthDayForAge: Number(baseSolar.day),
        school: currentSchool,
        schoolLabel: currentSchool === 'flying' ? '飞星四化' : '传统四化',
        huaSummary: huaSummary,
        shiftedByZiHour: shiftedByZiHour
      };

      var chart = {
        generatedAt: Date.now(),
        boardCells: boardCells,
        center: center,
        daXianTimeline: daXianTimeline,
        liuNianTimeline: liuNianTimeline,
        huaTracks: huaTracks
      };
        chart.text = _zwBuildChartText(chart);
        ziweiChart.value = chart;
        ziweiFocusBranch.value = mingBranch;
        ziweiLastGenerateSignature.value = generateSignature;
        ziweiCopyDone.value = false;
        if (saveHistory) _zwPushHistory(chart);
        if (!silent) {
          _flashButtonState(ziweiGenerateDone, 'ziweiGenerate');
          var suffix = clockMode === 'trueSolar'
            ? ('已按真太阳时校正（总修正' + (clockRes.correctionMinutes >= 0 ? '+' : '') + Number(clockRes.correctionMinutes || 0).toFixed(2) + '分钟，含时差方程）。')
            : '';
          ziweiStatus.value = {
            type: 'success',
            text: shiftedByZiHour
              ? ('排盘完成（23:00后子时已按次日换日）。' + suffix)
              : ((repeatGenerate ? '参数未变化，已重新排盘完成。' : '排盘完成。') + suffix)
          };
        }
      } finally {
        if (!silent) ziweiGenerating.value = false;
      }
    }

    function copyZiweiChartText() {
      if (!ziweiChart.value) {
        ziweiStatus.value = { type: 'info', text: '请先完成排盘。' };
        return;
      }
      var payload = String(ziweiChart.value.text || '').trim();
      if (!payload) {
        ziweiStatus.value = { type: 'error', text: '命盘文本为空，无法复制。' };
        return;
      }
      clipboardWrite(payload).then(function(ok) {
        if (ok) _flashButtonState(ziweiCopyDone, 'ziweiCopy');
        ziweiStatus.value = ok
          ? { type: 'success', text: '命盘文本已复制。' }
          : { type: 'error', text: '复制失败，请手动复制。' };
      });
    }

    function copyZiweiAnalysisText() {
      var lines = ['【AI个性化解盘】'];
      var ai = ziweiAiResult.value;
      if (ai && typeof ai === 'object') {
        if (ai.overview) lines.push(String(ai.overview));
        if (Array.isArray(ai.sections)) {
          ai.sections.forEach(function(sec) {
            if (!sec) return;
            if (sec.title) lines.push('\n【' + String(sec.title) + '】');
            if (sec.summary) lines.push(String(sec.summary));
            if (Array.isArray(sec.evidence) && sec.evidence.length) lines.push('依据：' + sec.evidence.join('；'));
            if (Array.isArray(sec.advice) && sec.advice.length) lines.push('建议：' + sec.advice.join('；'));
          });
        }
        if (ai.yearFocus && typeof ai.yearFocus === 'object') {
          lines.push('\n【年度焦点】');
          if (ai.yearFocus.summary) lines.push(String(ai.yearFocus.summary));
          if (Array.isArray(ai.yearFocus.opportunities) && ai.yearFocus.opportunities.length) {
            lines.push('机会：' + ai.yearFocus.opportunities.join('；'));
          }
          if (Array.isArray(ai.yearFocus.risks) && ai.yearFocus.risks.length) {
            lines.push('风险：' + ai.yearFocus.risks.join('；'));
          }
        }
      } else if (ziweiActiveAnalysis.value) {
        var active = ziweiActiveAnalysis.value;
        lines.push(String(active.title || '摘要解盘'));
        lines.push(String(active.text || ''));
      } else {
        ziweiStatus.value = { type: 'info', text: '暂无可复制的解读内容，请先排盘并生成 AI 解读。' };
        return;
      }
      var payload = lines.join('\n').trim();
      if (!payload) {
        ziweiStatus.value = { type: 'info', text: '暂无可复制的解读内容，请先排盘并生成 AI 解读。' };
        return;
      }
      clipboardWrite(payload).then(function(ok) {
        if (ok) _flashButtonState(ziweiAiCopyDone, 'ziweiAiCopy');
        ziweiStatus.value = ok
          ? { type: 'success', text: 'AI 解读已复制。' }
          : { type: 'error', text: '复制失败，请手动复制。' };
      });
    }

    var _zwHtml2CanvasLoader = null;
    function _zwEnsureHtml2Canvas() {
      if (typeof window === 'undefined') return Promise.reject(new Error('当前环境不支持导出'));
      if (window.html2canvas) return Promise.resolve(window.html2canvas);
      if (_zwHtml2CanvasLoader) return _zwHtml2CanvasLoader;
      _zwHtml2CanvasLoader = new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.async = true;
        script.onload = function() {
          if (window.html2canvas) resolve(window.html2canvas);
          else reject(new Error('html2canvas 加载失败'));
        };
        script.onerror = function() {
          reject(new Error('html2canvas 脚本加载失败'));
        };
        document.head.appendChild(script);
      }).catch(function(err) {
        _zwHtml2CanvasLoader = null;
        throw err;
      });
      return _zwHtml2CanvasLoader;
    }

    async function exportZiweiChartImage() {
      if (!ziweiChart.value) {
        ziweiStatus.value = { type: 'info', text: '请先完成排盘。' };
        return;
      }
      var target = document.getElementById('ziwei-image-export') || document.getElementById('ziwei-board-export');
      if (!target) {
        ziweiStatus.value = { type: 'error', text: '未找到命盘画布区域，无法导出。' };
        return;
      }
      ziweiExporting.value = true;
      try {
        var html2canvas = await _zwEnsureHtml2Canvas();
        var canvas = await html2canvas(target, {
          backgroundColor: null,
          scale: Math.min(window.devicePixelRatio || 1.5, 2),
          useCORS: true,
          logging: false
        });
        var link = document.createElement('a');
        var stamp = new Date();
        var file = 'ziwei-chart-' +
          String(stamp.getFullYear()) +
          String(stamp.getMonth() + 1).padStart(2, '0') +
          String(stamp.getDate()).padStart(2, '0') +
          '-' +
          String(stamp.getHours()).padStart(2, '0') +
          String(stamp.getMinutes()).padStart(2, '0') +
          '.png';
        link.href = canvas.toDataURL('image/png');
        link.download = file;
        link.click();
        ziweiStatus.value = { type: 'success', text: '命盘图片导出成功。' };
      } catch (err) {
        ziweiStatus.value = { type: 'error', text: '命盘图片导出失败：' + String((err && err.message) || err || '') };
      } finally {
        ziweiExporting.value = false;
      }
    }

    function closeZiweiSharePoster() {
      ziweiSharePosterDataUrl.value = '';
    }

    function downloadZiweiSharePoster() {
      if (!ziweiSharePosterDataUrl.value) return;
      var link = document.createElement('a');
      link.href = ziweiSharePosterDataUrl.value;
      link.download = 'ziwei-share-poster.png';
      link.click();
    }

    async function _zwLegacyGenerateZiweiSharePoster() {
      return generateZiweiSharePoster();
    }

    async function generateZiweiSharePoster() {
      if (!ziweiChart.value) {
        ziweiStatus.value = { type: 'info', text: '\u8bf7\u5148\u5b8c\u6210\u6392\u76d8\u3002' };
        return;
      }
      ziweiSharing.value = true;
      try {
        var posterW = 1200;
        var posterH = 1880;
        var shareLink = buildZiweiShareLink();
        var canvas = document.createElement('canvas');
        canvas.width = posterW;
        canvas.height = posterH;
        var ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('\u6d77\u62a5\u753b\u5e03\u521b\u5efa\u5931\u8d25');
        var drawRoundRect = function(x, y, w, h, r) {
          var radius = Math.max(0, Number(r) || 0);
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radius);
            return;
          }
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + w, y, x + w, y + h, radius);
          ctx.arcTo(x + w, y + h, x, y + h, radius);
          ctx.arcTo(x, y + h, x, y, radius);
          ctx.arcTo(x, y, x + w, y, radius);
          ctx.closePath();
        };

        var bg = ctx.createLinearGradient(0, 0, posterW, posterH);
        bg.addColorStop(0, '#060d1f');
        bg.addColorStop(0.52, '#0b1531');
        bg.addColorStop(1, '#111f44');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, posterW, posterH);

        function drawGlow(x, y, r, color) {
          var g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        drawGlow(190, 240, 320, 'rgba(79,125,249,.32)');
        drawGlow(1020, 360, 360, 'rgba(95,180,255,.2)');
        drawGlow(640, 1520, 420, 'rgba(139,92,246,.24)');

        ctx.fillStyle = 'rgba(255,255,255,.08)';
        for (var gx = 0; gx <= posterW; gx += 36) {
          ctx.fillRect(gx, 0, 1, posterH);
        }
        for (var gy = 0; gy <= posterH; gy += 36) {
          ctx.fillRect(0, gy, posterW, 1);
        }

        ctx.fillStyle = '#c8d8ff';
        ctx.font = '600 24px "JetBrains Mono","Noto Sans SC",monospace';
        ctx.fillText('Z I W E I  D O U  S H U', 84, 118);

        ctx.fillStyle = '#edf2ff';
        ctx.font = '700 78px "Noto Sans SC","PingFang SC",sans-serif';
        ctx.fillText('\u7d2b\u5fae\u6597\u6570\u547d\u76d8', 84, 212);

        ctx.fillStyle = 'rgba(214,226,255,.9)';
        ctx.font = '500 34px "Noto Sans SC","PingFang SC",sans-serif';
        ctx.fillText('\u4e13\u4e1a\u6392\u76d8 + AI \u6df1\u5ea6\u89e3\u8bfb + \u4e00\u952e\u5206\u4eab', 84, 266);

        var featureCards = [
          { title: '\u5b8c\u6574\u547d\u76d8\u5206\u6790', desc: '\u652f\u6301\u4e3b\u661f/\u8f85\u661f/\u6742\u66dc/\u56db\u5316\u3001\u5927\u9650/\u6d41\u5e74/\u5c0f\u9650', color: '#7aa8ff' },
          { title: 'AI \u4e2a\u6027\u5316\u89e3\u76d8', desc: '\u4e00\u952e\u751f\u6210\u4e13\u4e1a\u7ed3\u6784\u5316\u89e3\u8bfb\uff0c\u5e76\u652f\u6301\u8ffd\u95ee', color: '#7ce7d8' },
          { title: '\u4e91\u7aef\u914d\u7f6e\u6a21\u677f', desc: '\u89e3\u8bfb\u6a21\u677f\u3001\u95ee\u7b54\u5efa\u8bae\u7531\u670d\u52a1\u7aef\u7edf\u4e00\u63a7\u5236', color: '#fcbf74' },
          { title: '\u5206\u4eab\u53cb\u597d\u4f53\u9a8c', desc: '\u751f\u6210\u4e13\u5c5e\u5206\u4eab\u5165\u53e3\uff0c\u8bbf\u5ba2\u53ef\u76f4\u8fbe\u547d\u76d8\u754c\u9762', color: '#c69cff' }
        ];

        var cardX = 78;
        var cardY = 334;
        var cardW = posterW - cardX * 2;
        var cardH = 216;
        for (var fi = 0; fi < featureCards.length; fi++) {
          var item = featureCards[fi];
          var y = cardY + fi * (cardH + 20);
          ctx.fillStyle = 'rgba(10,20,45,.74)';
          ctx.strokeStyle = 'rgba(129,140,248,.3)';
          ctx.lineWidth = 2;
          drawRoundRect(cardX, y, cardW, cardH, 18);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.arc(cardX + 40, y + 44, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f2f6ff';
          ctx.font = '700 40px "Noto Sans SC","PingFang SC",sans-serif';
          ctx.fillText(item.title, cardX + 72, y + 58);
          ctx.fillStyle = 'rgba(202,216,248,.95)';
          ctx.font = '500 30px "Noto Sans SC","PingFang SC",sans-serif';
          ctx.fillText(item.desc, cardX + 72, y + 116);
        }

        ctx.fillStyle = 'rgba(255,255,255,.86)';
        ctx.font = '600 32px "Noto Sans SC","PingFang SC",sans-serif';
        ctx.fillText('\u4f53\u9a8c\u5165\u53e3', 84, 1338);

        ctx.fillStyle = 'rgba(15,24,52,.82)';
        ctx.strokeStyle = 'rgba(129,140,248,.45)';
        ctx.lineWidth = 2;
        drawRoundRect(84, 1368, posterW - 168, 184, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#d6e3ff';
        ctx.font = '500 27px "JetBrains Mono","Noto Sans SC",monospace';
        var linkText = shareLink.length > 74 ? (shareLink.slice(0, 74) + '...') : shareLink;
        ctx.fillText(linkText, 116, 1452);

        ctx.fillStyle = 'rgba(178,196,233,.95)';
        ctx.font = '500 26px "Noto Sans SC","PingFang SC",sans-serif';
        ctx.fillText('\u626b\u7801\u6216\u6253\u5f00\u94fe\u63a5\uff0c\u5373\u53ef\u8fdb\u5165\u547d\u76d8\u754c\u9762\u4f53\u9a8c\u5b8c\u6574\u529f\u80fd', 116, 1506);

        ctx.fillStyle = '#f8fbff';
        ctx.font = '700 30px "Noto Sans SC","PingFang SC",sans-serif';
        ctx.fillText('SQLDev \u00d7 \u7d2b\u5fae\u6597\u6570\u5de5\u5177', 84, 1718);
        ctx.fillStyle = 'rgba(199,214,247,.88)';
        ctx.font = '500 22px "JetBrains Mono","Noto Sans SC",monospace';
        ctx.fillText('AI Powered Professional Charting Platform', 84, 1760);

        ziweiSharePosterDataUrl.value = canvas.toDataURL('image/png');
        clipboardWrite(shareLink).then(function(ok) {
          ziweiStatus.value = ok
            ? { type: 'success', text: '\u5206\u4eab\u6d77\u62a5\u5df2\u751f\u6210\uff0c\u5206\u4eab\u94fe\u63a5\u5df2\u590d\u5236\u3002' }
            : { type: 'success', text: '\u5206\u4eab\u6d77\u62a5\u5df2\u751f\u6210\u3002' };
        });
      } catch (err) {
        ziweiStatus.value = { type: 'error', text: '\u751f\u6210\u5206\u4eab\u6d77\u62a5\u5931\u8d25\uff1a' + String((err && err.message) || err || '') };
      } finally {
        ziweiSharing.value = false;
      }
    }

    function pickDb(refName, val) {
      var refs = {sourceDb:sourceDb, targetDb:targetDb, funcSourceDb:funcSourceDb, funcTargetDb:funcTargetDb, procSourceDb:procSourceDb, procTargetDb:procTargetDb};
      if (refs[refName]) refs[refName].value = val;
      dbDropdown.value = '';
    }

    const statusText = ref('工作台已就绪');
    watch(canAccessZiweiTool, function(allowed) {
      if (!allowed && activePage.value === 'ziweiTool') {
        applyPageState('idTool', { syncRoute: true, replaceRoute: true, keepSidebarOnMobile: true });
        statusText.value = '当前账号无权限访问紫微斗数命盘工具';
      }
    }, { immediate: true });
    var _persistWarnShown = false;
    var _frontendRulesRevision = 0;
    var _frontendRulesCache = { revision: -1, payload: null };
    var _convertResultCache = new Map();
    var _CONVERT_RESULT_CACHE_MAX = 24;
    function _doPersist() {
      _frontendRulesRevision += 1;
      _convertResultCache.clear();
      if (!_persistRules()) {
        var msg = '⚠ 规则未能持久化（' + _persistError + '），当前修改仅在本次会话有效';
        if (statusText.value) statusText.value += '  ' + msg;
        else statusText.value = msg;
        if (!_persistWarnShown) {
          _persistWarnShown = true;
          alert('注意：规则保存到本地存储失败（' + _persistError + '）。\n可能原因：隐私/无痕模式、存储空间已满。\n当前修改仅在本次会话内有效，关闭页面后将丢失。');
        }
      }
    }
    const fileInput = ref(null);
    const fileEncoding = ref(localStorage.getItem('fileEncoding') || 'UTF-8');
    const ENCODING_OPTIONS = [
      { value: 'UTF-8', label: 'UTF-8' },
      { value: 'GBK', label: 'GBK / GB2312 / GB18030' },
      { value: 'Big5', label: 'Big5 (繁体)' },
      { value: 'Shift_JIS', label: 'Shift_JIS (日文)' }
    ];
    watch(fileEncoding, function(value) {
      localStorage.setItem('fileEncoding', value);
    });

    // --- DDL Rules state (reads from global _ddlRulesData, shared with engine) ---
    const ddlRules = ref(_ddlRulesData);

    // --- Undo history for rules ---
    var _ruleUndoStack = [];
    var _UNDO_MAX = 50;

    function _snapshotDdlRules() {
      return JSON.parse(JSON.stringify(ddlRules.value));
    }
    function _snapshotBodyRules() {
      return _deepCloneBodyRules(_bodyRulesRef.value);
    }
    function _pushUndo(type) {
      // type: 'ddl' | 'body'
      var snap = { type: type };
      if (type === 'ddl') {
        snap.data = _snapshotDdlRules();
      } else {
        snap.data = _snapshotBodyRules();
      }
      _ruleUndoStack.push(snap);
      if (_ruleUndoStack.length > _UNDO_MAX) _ruleUndoStack.shift();
      canUndoRule.value = true;
    }
    const canUndoRule = ref(false);

    function undoRule() {
      if (_ruleUndoStack.length === 0) return;
      var snap = _ruleUndoStack.pop();
      if (snap.type === 'ddl') {
        // Restore DDL rules — must update _ddlRulesData in-place for engine
        var restored = snap.data;
        for (var k in restored) { _ddlRulesData[k] = restored[k]; }
        for (var k2 in _ddlRulesData) { if (!(k2 in restored)) delete _ddlRulesData[k2]; }
        ddlRules.value = _ddlRulesData;
        triggerRef(ddlRules);
      } else {
        // Restore body rules — update _bodyRulesData in-place for engine
        var restored2 = snap.data;
        for (var k3 in restored2) { _bodyRulesData[k3] = restored2[k3]; }
        for (var k4 in _bodyRulesData) { if (!(k4 in restored2)) delete _bodyRulesData[k4]; }
        _bodyRulesRef.value = _bodyRulesData;
        triggerRef(_bodyRulesRef);
      }
      canUndoRule.value = _ruleUndoStack.length > 0;
      statusText.value = '已撤销上一步规则操作';
      _doPersist();
    }

    function resetDdlRules() {
      _pushUndo('ddl');
      var fresh = JSON.parse(JSON.stringify(_ddlRulesDefault));
      for (var k in fresh) { _ddlRulesData[k] = fresh[k]; }
      for (var k2 in _ddlRulesData) { if (!(k2 in fresh)) delete _ddlRulesData[k2]; }
      ddlRules.value = _ddlRulesData;
      triggerRef(ddlRules);
      statusText.value = 'DDL 映射规则已重置为默认';
      _doPersist();
    }

    function resetBodyRules() {
      _pushUndo('body');
      var fresh = _deepCloneBodyRules(_bodyRulesDefault);
      for (var k in fresh) { _bodyRulesData[k] = fresh[k]; }
      for (var k2 in _bodyRulesData) { if (!(k2 in fresh)) delete _bodyRulesData[k2]; }
      _bodyRulesRef.value = _bodyRulesData;
      triggerRef(_bodyRulesRef);
      statusText.value = '程序块映射规则已重置为默认';
      _doPersist();
    }

    function addRule(category) {
      _pushUndo('ddl');
      ddlRules.value[category].unshift({source:'',target:''});
      _doPersist();
    }
    function deleteRule(category, index) {
      _pushUndo('ddl');
      ddlRules.value[category].splice(index, 1);
      _doPersist();
    }
    function saveRule(category, index) {
      var desc = ddlRules.value[category][index].source + ' → ' + ddlRules.value[category][index].target;
      statusText.value = '规则已保存: ' + desc;
      _doPersist();
    }

    // --- Body (Function/Procedure) Rules state (reactive wrapper, shared with engine) ---
    const _bodyRulesRef = ref(_bodyRulesData);
    const bodyRules = computed(function() {
      var result = {};
      for (var i = 0; i < BODY_CATS_ALL.length; i++) {
        var cat = BODY_CATS_ALL[i];
        var rules = _bodyRulesRef.value[cat.pair] || [];
        if (cat.forward) {
          result[cat.key] = rules.map(function(r, idx) { return {source: r.s, target: r.t, _idx: idx}; });
        } else {
          result[cat.key] = rules.map(function(r, idx) { return {source: r.t, target: r.s, _idx: idx}; });
        }
      }
      return result;
    });


    function addBodyRule(category) {
      _pushUndo('body');
      var info = _bodyDirInfo(category);
      if (!info) return;
      _bodyRulesRef.value[info.pair].unshift({s:'', t:'', fwd:null, rev:null});
      _doPersist();
    }
    function deleteBodyRule(category, index) {
      _pushUndo('body');
      var info = _bodyDirInfo(category);
      if (!info) return;
      _bodyRulesRef.value[info.pair].splice(index, 1);
      _doPersist();
    }
    function saveBodyRule(category, index) {
      var info = _bodyDirInfo(category);
      if (!info) return;
      var r = _bodyRulesRef.value[info.pair][index];
      statusText.value = '规则已保存: ' + r.s + ' → ' + r.t;
      _doPersist();
    }

    // --- Rule Modal state ---
    const ruleModal = ref({
      visible: false,
      type: '', // 'ddl' or 'body'
      category: '', // 'oraclePg', 'oracleMysql', 'mysqlPg'
      index: -1, // -1 = new
      source: '',
      target: '',
      dragStyle: {}
    });
    const ruleModalRef = ref(null);

    const alertModal = ref({ visible: false, title: '', message: '', dragStyle: {} });
    const alertModalRef = ref(null);

    const confirmModal = ref({ visible: false, title: '', message: '', dragStyle: {}, _resolve: null });
    const confirmModalRef = ref(null);

    function _showConfirm(title, message) {
      _modalTriggerEl = document.activeElement;
      return new Promise(resolve => {
        confirmModal.value = { visible: true, title, message, dragStyle: {}, _resolve: resolve };
      });
    }
    function confirmModalOk() {
      if (confirmModal.value._resolve) confirmModal.value._resolve(true);
      confirmModal.value.visible = false;
    }
    function confirmModalCancel() {
      if (confirmModal.value._resolve) confirmModal.value._resolve(false);
      confirmModal.value.visible = false;
    }

    function _showAlert(title, message) {
      _modalTriggerEl = document.activeElement;
      alertModal.value = { visible: true, title: title, message: message, dragStyle: {} };
    }

    // --- Drag logic for modals ---
    var _dragState = null;
    function startDrag(e, which) {
      if (e.button !== 0) return;
      var modalEl = which === 'rule' ? ruleModalRef.value : which === 'confirm' ? confirmModalRef.value : alertModalRef.value;
      if (!modalEl) return;
      var rect = modalEl.getBoundingClientRect();
      _dragState = { which: which, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top, w: rect.width, h: rect.height };
      e.preventDefault();
    }
    function _onDragMove(e) {
      if (!_dragState) return;
      var dx = e.clientX - _dragState.startX;
      var dy = e.clientY - _dragState.startY;
      var newLeft = _dragState.origLeft + dx;
      var newTop = _dragState.origTop + dy;
      var style = { position: 'fixed', left: newLeft + 'px', top: newTop + 'px', margin: '0' };
      if (_dragState.which === 'rule') { ruleModal.value.dragStyle = style; }
      else if (_dragState.which === 'confirm') { confirmModal.value.dragStyle = style; }
      else { alertModal.value.dragStyle = style; }
    }
    function _onDragEnd() { _dragState = null; }

    /* ===== Modal Accessibility: Focus Trap, Escape, Auto-focus, Restore ===== */
    var _modalTriggerEl = null; // element that opened the modal, for focus restore

    var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function _trapFocus(e, modalRef) {
      var el = modalRef.value;
      if (!el) return;
      var focusables = el.querySelectorAll(FOCUSABLE);
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }

    function _focusFirstIn(modalRef) {
      nextTick(function() {
        var el = modalRef.value;
        if (!el) return;
        var target = el.querySelector(FOCUSABLE);
        if (target) target.focus();
      });
    }

    function _restoreTriggerFocus() {
      var el = _modalTriggerEl;
      _modalTriggerEl = null;
      if (el && typeof el.focus === 'function') {
        nextTick(function() { el.focus(); });
      }
    }

    // Watch modal visibility for auto-focus and focus restore
    watch(function() { return alertModal.value.visible; }, function(visible) {
      if (visible) {
        // Focus the primary action button for alert
        nextTick(function() {
          var el = alertModalRef.value;
          if (!el) return;
          var btn = el.querySelector('.btn-modal.primary');
          if (btn) btn.focus(); else _focusFirstIn(alertModalRef);
        });
      } else { _restoreTriggerFocus(); }
    });
    watch(function() { return confirmModal.value.visible; }, function(visible) {
      if (visible) {
        // Focus the primary action button for confirm
        nextTick(function() {
          var el = confirmModalRef.value;
          if (!el) return;
          var btn = el.querySelector('.btn-modal.primary');
          if (btn) btn.focus(); else _focusFirstIn(confirmModalRef);
        });
      } else { _restoreTriggerFocus(); }
    });
    watch(function() { return ruleModal.value.visible; }, function(visible) {
      if (visible) {
        // Focus first input for better form UX
        nextTick(function() {
          var el = ruleModalRef.value;
          if (!el) return;
          var input = el.querySelector('input');
          if (input) input.focus(); else _focusFirstIn(ruleModalRef);
        });
      } else { _restoreTriggerFocus(); }
    });

    function openRuleModal(type, category, index) {
      _modalTriggerEl = document.activeElement;
      ruleModal.value.type = type;
      ruleModal.value.category = category;
      ruleModal.value.index = index;
      if (index >= 0) {
        if (type === 'body') {
          var info = _bodyDirInfo(category);
          var r = _bodyRulesRef.value[info.pair][index];
          ruleModal.value.source = info.forward ? r.s : r.t;
          ruleModal.value.target = info.forward ? r.t : r.s;
        } else {
          var rule = ddlRules.value[category][index];
          ruleModal.value.source = rule.source;
          ruleModal.value.target = rule.target;
        }
      } else {
        ruleModal.value.source = '';
        ruleModal.value.target = '';
      }
      ruleModal.value.dragStyle = {};
      ruleModal.value.visible = true;
    }


    function confirmRuleModal() {
      var m = ruleModal.value;
      var src = m.source.trim();
      var tgt = m.target.trim();
      // Skip undo for no-op (both empty on new rule)
      var isNoOp = (m.index === -1 && !src && !tgt);
      if (m.type === 'body') {
        var info = _bodyDirInfo(m.category);
        var arr = _bodyRulesRef.value[info.pair];
        var sVal = info.forward ? src : tgt;
        var tVal = info.forward ? tgt : src;
        if (m.index === -1) {
          if (!src && !tgt) { ruleModal.value.visible = false; return; }
          _pushUndo('body');
          arr.unshift({s: sVal, t: tVal, fwd: null, rev: null});
          triggerRef(_bodyRulesRef);
          statusText.value = '已新增规则: ' + src + ' → ' + tgt;
        } else {
          if (!src && !tgt) {
            _pushUndo('body');
            arr.splice(m.index, 1);
            triggerRef(_bodyRulesRef);
            statusText.value = '已删除规则';
          } else {
            _pushUndo('body');
            arr[m.index].s = sVal;
            arr[m.index].t = tVal;
            triggerRef(_bodyRulesRef);
            statusText.value = '已保存规则: ' + src + ' → ' + tgt;
          }
        }
      } else {
        var store = ddlRules;
        if (m.index === -1) {
          if (!src && !tgt) { ruleModal.value.visible = false; return; }
          _pushUndo('ddl');
          store.value[m.category].unshift({source: src, target: tgt});
          statusText.value = '已新增规则: ' + src + ' → ' + tgt;
        } else {
          if (!src && !tgt) {
            _pushUndo('ddl');
            store.value[m.category].splice(m.index, 1);
            statusText.value = '已删除规则';
          } else {
            _pushUndo('ddl');
            store.value[m.category][m.index].source = src;
            store.value[m.category][m.index].target = tgt;
            statusText.value = '已保存规则: ' + src + ' → ' + tgt;
          }
        }
      }
      ruleModal.value.visible = false;
      _doPersist();
    }
    const outputStatus = computed(() => {
      var output = '';
      if (activePage.value === 'ddl') output = outputDdl.value;
      else if (activePage.value === 'func') output = funcOutput.value;
      else if (activePage.value === 'proc') output = procOutput.value;
      var cls = _classifyResult(output);
      return { type: cls.level, text: cls.summary };
    });

    // --- DDL rule category labels ---
    const DDL_CATS = [
      {key:'oracleToMysql', label:'Oracle → MySQL', pair:'oracleMysql'},
      {key:'mysqlToOracle', label:'MySQL → Oracle', pair:'oracleMysql'},
      {key:'oracleToPg', label:'Oracle → PostgreSQL', pair:'oraclePg'},
      {key:'pgToOracle', label:'PostgreSQL → Oracle', pair:'oraclePg'},
      {key:'mysqlToPg', label:'MySQL → PostgreSQL', pair:'mysqlPg'},
      {key:'pgToMysql', label:'PostgreSQL → MySQL', pair:'mysqlPg'}
    ];
    const DDL_CATS_ALL = DDL_CATS;
    const BODY_CATS = ['oraclePg','oracleMysql','mysqlPg'];
    const BODY_CATS_ALL = [
      {key:'oracleToMysql', label:'Oracle → MySQL', pair:'oracleMysql', forward:true},
      {key:'mysqlToOracle', label:'MySQL → Oracle', pair:'oracleMysql', forward:false},
      {key:'oracleToPg', label:'Oracle → PostgreSQL', pair:'oraclePg', forward:true},
      {key:'pgToOracle', label:'PostgreSQL → Oracle', pair:'oraclePg', forward:false},
      {key:'mysqlToPg', label:'MySQL → PostgreSQL', pair:'mysqlPg', forward:true},
      {key:'pgToMysql', label:'PostgreSQL → MySQL', pair:'mysqlPg', forward:false}
    ];
    function _bodyDirInfo(catKey) {
      for (var i = 0; i < BODY_CATS_ALL.length; i++) {
        if (BODY_CATS_ALL[i].key === catKey) return BODY_CATS_ALL[i];
      }
      return null;
    }
    const ddlRuleCats = computed(function() {
      var dir = ruleFilterDir.value;
      if (dir === 'all') return DDL_CATS;
      return DDL_CATS.filter(function(c) { return c.key === dir || c.key === _pairReverse(dir); });
    });
    const ddlRuleCatsFiltered = computed(function() {
      var tab = ddlRuleTab.value;
      return DDL_CATS.filter(function(c) { return c.key === tab; });
    });
    const bodyCatsFiltered = computed(function() {
      var tab = bodyRuleTab.value;
      return BODY_CATS_ALL.filter(function(c) { return c.key === tab; });
    });
    function _pairReverse(dir) {
      var map = {oracleToMysql:'mysqlToOracle',mysqlToOracle:'oracleToMysql',
        oracleToPg:'pgToOracle',pgToOracle:'oracleToPg',
        mysqlToPg:'pgToMysql',pgToMysql:'mysqlToPg'};
      return map[dir] || '';
    }

    // --- Filtered rules for search ---
    function filterRules(rulesObj, dir, query) {
      var result = {};
      var cats = Object.keys(rulesObj);
      if (dir !== 'all') {
        // Map directional filter to matching category keys
        var dirToBiMap = {oracleToMysql:'oracleMysql',mysqlToOracle:'oracleMysql',
          oracleToPg:'oraclePg',pgToOracle:'oraclePg',
          mysqlToPg:'mysqlPg',pgToMysql:'mysqlPg'};
        var rev = _pairReverse(dir);
        var biKey = dirToBiMap[dir];
        cats = cats.filter(function(c) {
          return c === dir || c === rev || c === biKey || (rev && c === dirToBiMap[rev]);
        });
      }
      cats.forEach(function(cat) {
        if (rulesObj[cat]) {
          result[cat] = query ? rulesObj[cat].filter(function(r) {
            return r.source.toLowerCase().indexOf(query.toLowerCase()) !== -1 ||
                   r.target.toLowerCase().indexOf(query.toLowerCase()) !== -1;
          }) : rulesObj[cat];
        }
      });
      return result;
    }
    const filteredDdlRules = computed(() => filterRules(ddlRules.value, ruleFilterDir.value, ruleSearchQuery.value));
    const filteredBodyRules = computed(() => filterRules(bodyRules.value, ruleFilterDir.value, ruleSearchQuery.value));

    function toggleRef() { refCollapsed.value = !refCollapsed.value; }

    // --- Computed labels ---
    const sourceLabel = computed(() => DB_LABELS[sourceDb.value] || sourceDb.value);
    const targetLabel = computed(() => DB_LABELS[targetDb.value] || targetDb.value);
    const funcSourceLabel = computed(() => DB_LABELS[funcSourceDb.value] || funcSourceDb.value);
    const funcTargetLabel = computed(() => DB_LABELS[funcTargetDb.value] || funcTargetDb.value);
    const procSourceLabel = computed(() => DB_LABELS[procSourceDb.value] || procSourceDb.value);
    const procTargetLabel = computed(() => DB_LABELS[procTargetDb.value] || procTargetDb.value);
    const currentPageTitle = computed(() => {
      if (activePage.value === 'idTool') return '测试工具';
      if (activePage.value === 'ziweiTool') return '紫微斗数命盘';
      if (activePage.value === 'func') return '函数翻译';
      if (activePage.value === 'proc') return '存储过程翻译';
      if (activePage.value === 'rules') return 'DDL 映射规则管理';
      if (activePage.value === 'bodyRules') return '程序块映射规则管理';
      return 'DDL 语句翻译';
    });
    const currentPageSubtitle = computed(() => {
      if (activePage.value === 'idTool') return '身份证号码与统一社会信用代码生成 / 校验';
      if (activePage.value === 'ziweiTool') return '公历 / 农历输入，自动排出完整方盘命盘';
      if (activePage.value === 'func') return 'CREATE FUNCTION / CREATE OR REPLACE FUNCTION 兼容转换';
      if (activePage.value === 'proc') return 'CREATE PROCEDURE / CREATE OR REPLACE PROCEDURE 兼容转换';
      if (activePage.value === 'rules') return '维护前端与后端共享的 DDL 类型映射规则';
      if (activePage.value === 'bodyRules') return '维护函数与存储过程语句块映射规则';
      return '建表 · 注释 · 索引 · 主键 · 外键 · 分区';
    });
    const currentEngineLabel = computed(() => {
      if (activePage.value === 'func') return 'Function Parser v2.0';
      if (activePage.value === 'proc') return 'Procedure Parser v2.0';
      if (activePage.value === 'ziweiTool') return 'ZiWei Chart Engine v1.0';
      return 'DDL Parser v2.0';
    });
    const currentRuleCount = computed(() => {
      function countMap(map) {
        var total = 0;
        if (!map) return total;
        for (var key in map) {
          if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
          if (Array.isArray(map[key])) total += map[key].length;
        }
        return total;
      }
      var ddlCount = countMap(_ddlRulesData);
      var bodyCount = countMap(_bodyRulesData);
      if (activePage.value === 'func' || activePage.value === 'proc' || activePage.value === 'bodyRules') {
        return bodyCount + ' 条';
      }
      return ddlCount + ' 条';
    });

    function hasText(value) {
      return !!String(value || '').trim();
    }

    // --- Computed line counts and meta ---
    const ddlInputEmpty = computed(() => !hasText(inputDdl.value));
    const ddlOutputEmpty = computed(() => !hasText(outputDdl.value));
    const funcInputEmpty = computed(() => !hasText(funcInput.value));
    const funcOutputEmpty = computed(() => !hasText(funcOutput.value));
    const procInputEmpty = computed(() => !hasText(procInput.value));
    const procOutputEmpty = computed(() => !hasText(procOutput.value));
    const canRunPrimaryAction = computed(() => {
      if (activePage.value === 'func') return hasText(funcInput.value);
      if (activePage.value === 'proc') return hasText(procInput.value);
      if (activePage.value !== 'ddl') return false;
      return hasText(inputDdl.value);
    });
    const inputLineCount = computed(() => inputDdl.value ? inputDdl.value.split('\n').length : 0);
    const outputMeta = computed(() => {
      if (!outputDdl.value) return '\u7B49\u5F85\u7FFB\u8BD1';
      return outputDdl.value.split('\n').length + ' \u884C / ' + outputDdl.value.length + ' \u5B57\u7B26';
    });
    const funcInputLineCount = computed(() => funcInput.value ? funcInput.value.split('\n').length : 0);
    const funcOutputMeta = computed(() => {
      if (!funcOutput.value) return '\u7B49\u5F85\u7FFB\u8BD1';
      return funcOutput.value.split('\n').length + ' \u884C / ' + funcOutput.value.length + ' \u5B57\u7B26';
    });
    const procInputLineCount = computed(() => procInput.value ? procInput.value.split('\n').length : 0);
    const procOutputMeta = computed(() => {
      if (!procOutput.value) return '\u7B49\u5F85\u7FFB\u8BD1';
      return procOutput.value.split('\n').length + ' \u884C / ' + procOutput.value.length + ' \u5B57\u7B26';
    });

    // --- Clipboard helper ---
    function fallbackCopy(t) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try {
        document.execCommand('copy');
        statusText.value = '\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F';
        return true;
      } catch (e) {
        statusText.value = '\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9\u590D\u5236';
        return false;
      } finally {
        document.body.removeChild(ta);
      }
    }

    function clipboardWrite(text) {
      var content = String(text || '');
      if (!content.trim()) {
        statusText.value = '\u6682\u65E0\u53EF\u590D\u5236\u5185\u5BB9';
        return Promise.resolve(false);
      }
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(content)
          .then(function() {
            statusText.value = '\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F';
            return true;
          })
          .catch(function() {
            return fallbackCopy(content);
          });
      }
      return Promise.resolve(fallbackCopy(content));
    }

    function saveFile(text, prefix, dbKey) {
      if (!text.trim()) { statusText.value = '\u6682\u65E0\u53EF\u4FDD\u5B58\u5185\u5BB9'; return; }
      const ext = dbKey === 'mysql' ? 'mysql' : dbKey === 'postgresql' ? 'pgsql' : 'oracle';
      const fileName = prefix + '_' + ext + '_' + new Date().toISOString().slice(0,10) + '.sql';
      const blob = new Blob([text], { type: 'text/sql;charset=utf-8' });
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
      statusText.value = '\u5DF2\u4FDD\u5B58\u4E3A ' + fileName;
    }

    function formatSqlText(text, preserveBlocks) {
      var raw = String(text || '').replace(/\r\n/g, '\n').trim();
      if (!raw) return '';
      if (preserveBlocks) {
        return raw
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n');
      }
      var stmts = splitStatements(raw);
      if (!stmts.length) return raw;
      return stmts.map(function(stmt) {
        return stmt
          .replace(/\s+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }).join(';\n\n') + ';';
    }

    function formatActiveWorkbench() {
      var page = activePage.value;
      var before = '';
      var after = '';
      if (page === 'func') {
        before = funcInput.value && funcInput.value.trim() ? funcInput.value : funcOutput.value;
        after = formatSqlText(before, true);
        if (!after) { statusText.value = '当前没有可格式化的 SQL 内容'; return; }
        if (funcInput.value && funcInput.value.trim()) funcInput.value = after;
        else funcOutput.value = after;
      } else if (page === 'proc') {
        before = procInput.value && procInput.value.trim() ? procInput.value : procOutput.value;
        after = formatSqlText(before, true);
        if (!after) { statusText.value = '当前没有可格式化的 SQL 内容'; return; }
        if (procInput.value && procInput.value.trim()) procInput.value = after;
        else procOutput.value = after;
      } else {
        before = inputDdl.value && inputDdl.value.trim() ? inputDdl.value : outputDdl.value;
        after = formatSqlText(before, false);
        if (!after) { statusText.value = '当前没有可格式化的 SQL 内容'; return; }
        if (inputDdl.value && inputDdl.value.trim()) inputDdl.value = after;
        else outputDdl.value = after;
      }
      statusText.value = '已按语句块重新整理 SQL 格式';
    }

    // ========== Unified result classifier ==========
    var _RE_FAIL = /^-- (解析失败|生成失败|未识别|不支持的|请输入|输入内容过大|错误[：:]|翻译失败|转换异常|额外DDL生成失败)/m;
    var _RE_NO_CONV = /^-- 源(数据)?库与目标(数据)?库相同/m;
    var _RE_WARN = /\[注意/;
    var _RE_PARTIAL = /\(\d+ 个失败\)/;

    /**
     * Classify engine output into { level, summary }.
     * level: 'error' | 'info' | 'warning' | 'success'
     */
    function _classifyResult(output) {
      if (!output || !output.trim()) return { level: 'none', summary: '' };
      if (_RE_FAIL.test(output))    return { level: 'error',   summary: '转换遇到问题，请检查输出区域的提示信息' };
      if (_RE_NO_CONV.test(output)) return { level: 'info',    summary: '源库与目标库相同，无需转换' };
      var warnCount = (output.match(/\[注意/g) || []).length;
      var partial   = _RE_PARTIAL.test(output);
      if (partial)                  return { level: 'warning',  summary: '部分翻译失败，' + (warnCount > 0 ? '另有 ' + warnCount + ' 处需人工确认' : '请检查输出') };
      if (warnCount > 0)           return { level: 'warning',  summary: '发现 ' + warnCount + ' 处需人工确认' };
      return { level: 'success', summary: '未发现明显兼容问题' };
    }

    function _fastHashText(text) {
      var src = String(text || '');
      var h = 2166136261;
      for (var i = 0; i < src.length; i++) {
        h ^= src.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return (h >>> 0).toString(16);
    }

    function _buildFrontendRulesPayload() {
      if (_frontendRulesCache.payload && _frontendRulesCache.revision === _frontendRulesRevision) {
        return _frontendRulesCache.payload;
      }
      var ddlRules = null;
      var bodyRules = null;
      if (typeof _ddlRulesData === 'object' && _ddlRulesData) ddlRules = _ddlRulesData;
      else if (window._ddlRulesData && typeof window._ddlRulesData === 'object') ddlRules = window._ddlRulesData;
      if (typeof _bodyRulesData === 'object' && _bodyRulesData) bodyRules = _bodyRulesData;
      else if (window._bodyRulesData && typeof window._bodyRulesData === 'object') bodyRules = window._bodyRulesData;
      if (!ddlRules && !bodyRules) return null;

      var payload = { source: 'frontend', version: '', ddl: null, body: null };
      if (ddlRules) payload.ddl = JSON.parse(JSON.stringify(ddlRules));
      if (bodyRules) {
        var plainBody = {};
        for (var pair in bodyRules) {
          if (!Object.prototype.hasOwnProperty.call(bodyRules, pair)) continue;
          var list = Array.isArray(bodyRules[pair]) ? bodyRules[pair] : [];
          plainBody[pair] = list.map(function (r) {
            return { s: String((r && r.s) || ''), t: String((r && r.t) || '') };
          });
        }
        payload.body = plainBody;
      }

      var seed = JSON.stringify({ ddl: payload.ddl, body: payload.body });
      var hash = 0;
      for (var i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
      }
      payload.version = 'frontend-' + (hash >>> 0).toString(16);
      _frontendRulesCache = { revision: _frontendRulesRevision, payload: payload };
      return payload;
    }

    async function _convertViaBackend(kind, input, fromDb, toDb) {
      async function parseInvokeError(err) {
        var status = 0;
        var detail = '';
        if (!err) return { status: 0, detail: '' };
        try {
          var ctx = err.context;
          if (ctx && typeof ctx.status === 'number') status = ctx.status;
          if (ctx && typeof ctx.clone === 'function') {
            var txt = await ctx.clone().text();
            if (txt) {
              try {
                var obj = JSON.parse(txt);
                detail = String((obj && (obj.error || obj.message)) || txt || '');
              } catch (_parseErr) {
                detail = String(txt || '');
              }
            }
          }
        } catch (_ctxErr) {
          // ignore
        }
        if (!detail) detail = String((err && err.message) || err || '');
        return { status: status, detail: detail };
      }
      function mapConvertErrorMessage(code, status) {
        var errCode = String(code || '').trim().toLowerCase();
        if (status === 401 || errCode === 'unauthorized') return '登录状态失效，请重新登录后重试';
        if (status === 403) return '当前访问来源未被允许，请使用已授权域名访问';
        if (status === 413 || errCode === 'payload_too_large') return '请求内容过大，请精简后重试';
        if (status === 429 || errCode === 'rate_limited') return '请求过于频繁，请稍后再试';
        if (status === 503 || errCode === 'auth_unavailable') return '鉴权服务暂时不可用，请稍后重试';
        if (errCode === 'invalid_json' || errCode === 'payload_too_deep') return '请求格式不合法，请刷新页面后重试';
        if (errCode === 'invalid_rules' || errCode === 'rules_too_large') return '规则配置过大或格式不正确，请调整后重试';
        if (errCode === 'invalid_kind' || errCode === 'invalid_database_type') return '转换参数不合法，请检查数据库类型与转换对象';
        if (errCode === 'input_empty') return '请输入待转换 SQL';
        if (errCode === 'input_too_large') return '输入 SQL 过大（超过限制）';
        if (errCode === 'engine_not_ready' || errCode === 'server_not_ready') return '转换服务暂未就绪，请稍后重试';
        if (errCode === 'internal_error') return '转换服务暂时异常，请稍后重试';
        if (status >= 500) return '转换服务暂时异常，请稍后重试';
        if (status >= 400) return '转换请求失败，请检查输入后重试';
        return '转换请求失败，请稍后重试';
      }

      if (!window.authApi && typeof window.__loadSqldevAuthNow === 'function') {
        try {
          await window.__loadSqldevAuthNow();
        } catch (_authLoadErr) {}
      }
      if (!window.authApi) {
        throw new Error('认证模块未初始化');
      }
      function hasSignedUser() {
        return !!(window.authApi &&
          typeof window.authApi.getUserSync === 'function' &&
          window.authApi.getUserSync());
      }
      if (!hasSignedUser()) {
        if (typeof window.authApi.openAuthModal === 'function') {
          window.authApi.openAuthModal('请先注册/登录后再进行 SQL 转换');
        }
        throw new Error('未登录，无法调用后端转换服务');
      }
      if (typeof window.authApi.invokeFunction !== 'function') {
        throw new Error('认证模块版本过低，不支持 invokeFunction');
      }
      var frontendRules = _buildFrontendRulesPayload();
      var cacheKey = [
        kind,
        fromDb,
        toDb,
        (frontendRules && frontendRules.version) || 'no-rules',
        String(input || '').length,
        _fastHashText(input || '')
      ].join('|');
      if (_convertResultCache.has(cacheKey)) {
        return _convertResultCache.get(cacheKey);
      }
      var result;
      try {
        result = await window.authApi.invokeFunction('convert', {
          kind: kind,
          input: input,
          fromDb: fromDb,
          toDb: toDb,
          rules: frontendRules
        });
      } catch (networkErr) {
        var netMsg = (networkErr && networkErr.name === 'AbortError')
          ? '连接转换服务超时，请稍后重试'
          : '无法连接转换服务，请检查网络，或确认 Supabase Edge Function `convert` 已部署';
        throw new Error(netMsg);
      }
      if (result.error) {
        var parsedErr = await parseInvokeError(result.error);
        var errMsg = parsedErr.detail || String((result.error && result.error.message) || result.error || '');
        var errLower = errMsg.toLowerCase();
        if (parsedErr.status === 401 || errLower.indexOf('unauthorized') >= 0 || errLower.indexOf('401') >= 0 ||
            errLower.indexOf('invalid jwt') >= 0 || errLower.indexOf('jwt') >= 0) {
          // Try once more after force-refreshing the session
          try {
            if (typeof window.authApi.ensureAccessToken === 'function') {
              var refreshed = await window.authApi.ensureAccessToken(true);
              if (refreshed) {
                result = await window.authApi.invokeFunction('convert', {
                  kind: kind,
                  input: input,
                  fromDb: fromDb,
                  toDb: toDb,
                  rules: frontendRules
                });
              }
            }
          } catch (_retryErr) { /* fall through to error below */ }
        }
      }
      if (result.error) {
        var finalErr = await parseInvokeError(result.error);
        var status = Number(finalErr.status || 0);
        var msg = String(finalErr.detail || (result.error && result.error.message) || result.error || 'request_failed');
        throw new Error(mapConvertErrorMessage(msg, status));
      }
      var json = result.data;
      if (!json || typeof json.output !== 'string') {
        throw new Error('后端返回格式异常');
      }
      _convertResultCache.set(cacheKey, json.output);
      if (_convertResultCache.size > _CONVERT_RESULT_CACHE_MAX) {
        var firstKey = _convertResultCache.keys().next().value;
        if (firstKey) _convertResultCache.delete(firstKey);
      }
      return json.output;
    }

    // ========== DDL Methods ==========
    async function swapDbs() {
      if ((inputDdl.value.trim() || outputDdl.value.trim()) &&
          !(await _showConfirm('交换确认', '输入/输出区域存在未保存内容，交换后将覆盖，是否继续？'))) return;
      const tmp = sourceDb.value;
      sourceDb.value = targetDb.value;
      targetDb.value = tmp;
      const tmpDdl = inputDdl.value;
      inputDdl.value = outputDdl.value;
      outputDdl.value = tmpDdl;
      statusText.value = '\u5DF2\u4EA4\u6362: ' + sourceLabel.value + ' \u2192 ' + targetLabel.value;
    }

    function loadSample() {
      inputDdl.value = (typeof DDL_SAMPLES !== 'undefined' ? DDL_SAMPLES[sourceDb.value] : '') || '-- \u6682\u65E0 ' + sourceLabel.value + ' \u793A\u4F8B';
      outputDdl.value = '';
      statusText.value = '\u5DF2\u52A0\u8F7D ' + sourceLabel.value + ' DDL \u793A\u4F8B';
    }

    function clearAll() {
      inputDdl.value = ''; outputDdl.value = '';
      statusText.value = '\u5DF2\u6E05\u7A7A';
    }

    // ========== Conversion gate: require signed-in user ==========
    function _hasSignedUser() {
      return !!(window.authApi &&
        typeof window.authApi.getUserSync === 'function' &&
        window.authApi.getUserSync());
    }
    async function _ensureLoginForConversion() {
      if ((!window.authApi || typeof window.authApi.getUserSync !== 'function') &&
          typeof window.__loadSqldevAuthNow === 'function') {
        try {
          await window.__loadSqldevAuthNow();
        } catch (_authLoadErr) {}
      }
      if (_hasSignedUser()) return true;
      if (window.authApi && typeof window.authApi.openAuthModal === 'function') {
        window.authApi.openAuthModal('请先注册/登录后再进行 SQL 转换');
      } else {
        _showAlert('需要登录', '请先注册或登录后继续使用翻译功能。');
      }
      return false;
    }

    async function convert() {
      try {
        if (!inputDdl.value.trim()) {
          statusText.value = '请输入待转换的 DDL SQL';
          return;
        }
        if (!(await _ensureLoginForConversion())) {
          statusText.value = '请登录后继续使用翻译功能';
          return;
        }
        statusText.value = 'DDL 转换中，请稍候...';
        var result = await _convertViaBackend('ddl', inputDdl.value, sourceDb.value, targetDb.value);
        outputDdl.value = result;
        var cls = _classifyResult(result);
        statusText.value = cls.level === 'error'   ? cls.summary
                         : cls.level === 'info'    ? cls.summary
                         : cls.level === 'warning' ? 'DDL 翻译完成: ' + sourceLabel.value + ' → ' + targetLabel.value + ' (' + cls.summary + ')'
                         : 'DDL 翻译完成: ' + sourceLabel.value + ' → ' + targetLabel.value;
      } catch (e) {
        outputDdl.value = '-- \u8F6C\u6362\u5F02\u5E38: ' + e.message;
        statusText.value = '\u8F6C\u6362\u5F02\u5E38: ' + e.message;
      }
    }

    function copyOutput() { clipboardWrite(outputDdl.value); }
    function saveOutput() { saveFile(outputDdl.value, 'ddl', targetDb.value); }

    // ========== Function Methods ==========
    async function swapFuncDbs() {
      if ((funcInput.value.trim() || funcOutput.value.trim()) &&
          !(await _showConfirm('交换确认', '输入/输出区域存在未保存内容，交换后将覆盖，是否继续？'))) return;
      const tmp = funcSourceDb.value;
      funcSourceDb.value = funcTargetDb.value;
      funcTargetDb.value = tmp;
      const tmpF = funcInput.value;
      funcInput.value = funcOutput.value;
      funcOutput.value = tmpF;
      statusText.value = '\u5DF2\u4EA4\u6362: ' + funcSourceLabel.value + ' \u2192 ' + funcTargetLabel.value;
    }

    function loadFuncSample() {
      funcInput.value = (typeof FUNC_SAMPLES !== 'undefined' ? FUNC_SAMPLES[funcSourceDb.value] : '') || '-- \u6682\u65E0 ' + funcSourceLabel.value + ' \u51FD\u6570\u793A\u4F8B';
      funcOutput.value = '';
      statusText.value = '\u5DF2\u52A0\u8F7D ' + funcSourceLabel.value + ' \u51FD\u6570\u793A\u4F8B';
    }

    function clearFunc() {
      funcInput.value = ''; funcOutput.value = '';
      statusText.value = '\u5DF2\u6E05\u7A7A';
    }

    async function convertFunc() {
      try {
        if (!funcInput.value.trim()) {
          statusText.value = '请输入待转换的函数 SQL';
          return;
        }
        if (!(await _ensureLoginForConversion())) {
          statusText.value = '请登录后继续使用翻译功能';
          return;
        }
        statusText.value = '函数转换中，请稍候...';
        var result = await _convertViaBackend('func', funcInput.value, funcSourceDb.value, funcTargetDb.value);
        funcOutput.value = result;
        var cls = _classifyResult(result);
        statusText.value = cls.level === 'error'   ? cls.summary
                         : cls.level === 'info'    ? cls.summary
                         : cls.level === 'warning' ? '函数翻译完成: ' + funcSourceLabel.value + ' → ' + funcTargetLabel.value + ' (' + cls.summary + ')'
                         : '函数翻译完成: ' + funcSourceLabel.value + ' → ' + funcTargetLabel.value;
      } catch (e) {
        funcOutput.value = '-- \u8F6C\u6362\u5F02\u5E38: ' + e.message;
        statusText.value = '\u8F6C\u6362\u5F02\u5E38: ' + e.message;
      }
    }

    function copyFuncOutput() { clipboardWrite(funcOutput.value); }
    function saveFuncOutput() { saveFile(funcOutput.value, 'func', funcTargetDb.value); }

    // ========== Procedure Methods ==========
    async function swapProcDbs() {
      if ((procInput.value.trim() || procOutput.value.trim()) &&
          !(await _showConfirm('交换确认', '输入/输出区域存在未保存内容，交换后将覆盖，是否继续？'))) return;
      const tmp = procSourceDb.value;
      procSourceDb.value = procTargetDb.value;
      procTargetDb.value = tmp;
      const tmpP = procInput.value;
      procInput.value = procOutput.value;
      procOutput.value = tmpP;
      statusText.value = '\u5DF2\u4EA4\u6362: ' + procSourceLabel.value + ' \u2192 ' + procTargetLabel.value;
    }

    function loadProcSample() {
      procInput.value = (typeof PROC_SAMPLES !== 'undefined' ? PROC_SAMPLES[procSourceDb.value] : '') || '-- \u6682\u65E0 ' + procSourceLabel.value + ' \u5B58\u50A8\u8FC7\u7A0B\u793A\u4F8B';
      procOutput.value = '';
      statusText.value = '\u5DF2\u52A0\u8F7D ' + procSourceLabel.value + ' \u5B58\u50A8\u8FC7\u7A0B\u793A\u4F8B';
    }

    function clearProc() {
      procInput.value = ''; procOutput.value = '';
      statusText.value = '\u5DF2\u6E05\u7A7A';
    }

    async function convertProc() {
      try {
        if (!procInput.value.trim()) {
          statusText.value = '请输入待转换的存储过程 SQL';
          return;
        }
        if (!(await _ensureLoginForConversion())) {
          statusText.value = '请登录后继续使用翻译功能';
          return;
        }
        statusText.value = '存储过程转换中，请稍候...';
        var result = await _convertViaBackend('proc', procInput.value, procSourceDb.value, procTargetDb.value);
        procOutput.value = result;
        var cls = _classifyResult(result);
        statusText.value = cls.level === 'error'   ? cls.summary
                         : cls.level === 'info'    ? cls.summary
                         : cls.level === 'warning' ? '存储过程翻译完成: ' + procSourceLabel.value + ' → ' + procTargetLabel.value + ' (' + cls.summary + ')'
                         : '存储过程翻译完成: ' + procSourceLabel.value + ' → ' + procTargetLabel.value;
      } catch (e) {
        procOutput.value = '-- \u8F6C\u6362\u5F02\u5E38: ' + e.message;
        statusText.value = '\u8F6C\u6362\u5F02\u5E38: ' + e.message;
      }
    }

    function copyProcOutput() { clipboardWrite(procOutput.value); }
    function saveProcOutput() { saveFile(procOutput.value, 'proc', procTargetDb.value); }

    // ========== File upload (shared) ==========
    function uploadFile() {
      if (fileInput.value) { fileInput.value.value = ''; fileInput.value.click(); }
    }

    function closeSettingsMenu() {
      showRulesMenu.value = false;
    }

    function runPrimaryAction() {
      if (activePage.value === 'func') return convertFunc();
      if (activePage.value === 'proc') return convertProc();
      if (activePage.value === 'ddl') return convert();
      return;
    }

    function goSplashHome() {
      if (window.innerWidth <= 1024) sidebarOpen.value = false;
      if (typeof window !== 'undefined' && window.splashApi && typeof window.splashApi.showHome === 'function') {
        window.splashApi.showHome();
      } else {
        try { localStorage.setItem('sqldev_last_view', 'splash'); } catch (_err) {}
        document.documentElement.classList.remove('startup-workbench');
        var poster = document.getElementById('splash-poster');
        if (poster) {
          poster.style.display = '';
          poster.classList.remove('leaving');
          poster.scrollTop = 0;
        }
        document.body.classList.add('splash-active');
        try { window.scrollTo(0, 0); } catch (_scrollErr) {}
      }
      try {
        var splashHash = '#' + ROUTE_SPLASH_PATH;
        var currentHash = String(window.location.hash || '');
        if (currentHash !== splashHash) {
          var splashUrl = window.location.pathname + window.location.search + splashHash;
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState({ view: 'splash' }, '', splashUrl);
          } else {
            window.location.hash = splashHash.slice(1);
          }
        }
      } catch (_routeErr) {}
      statusText.value = '\u5df2\u8fd4\u56de\u9996\u9875';
      showRulesMenu.value = false;
    }

    function runWorkbenchAction(action) {
      // Theme toggle works on all pages
      if (action === 'theme') {
        toggleTheme();
        closeSettingsMenu();
        return;
      }
      if (action === 'feedback') {
        if (typeof window.openFeedbackModal === 'function') {
          window.openFeedbackModal('workbench-header');
        } else if (typeof window.__loadSqldevAuthNow === 'function') {
          window.__loadSqldevAuthNow().then(function() {
            if (typeof window.openFeedbackModal === 'function') {
              window.openFeedbackModal('workbench-header');
            } else {
              statusText.value = '反馈组件加载失败，请稍后重试';
            }
          }).catch(function() {
            statusText.value = '反馈组件加载失败，请稍后重试';
          });
        } else {
          statusText.value = '反馈组件未加载，请刷新页面后重试';
        }
        closeSettingsMenu();
        return;
      }
      var page = activePage.value;
      if (page !== 'ddl' && page !== 'func' && page !== 'proc') {
        statusText.value = '当前页面暂无此操作';
        closeSettingsMenu();
        return;
      }
      if (action === 'upload') {
        uploadFile();
        closeSettingsMenu();
        return;
      }
      if (action === 'format') {
        formatActiveWorkbench();
        closeSettingsMenu();
        return;
      }
      if (page === 'ddl') {
        if (action === 'sample') loadSample();
        else if (action === 'clear') clearAll();
        else if (action === 'copy') copyOutput();
        else if (action === 'save') saveOutput();
      } else if (page === 'func') {
        if (action === 'sample') loadFuncSample();
        else if (action === 'clear') clearFunc();
        else if (action === 'copy') copyFuncOutput();
        else if (action === 'save') saveFuncOutput();
      } else {
        if (action === 'sample') loadProcSample();
        else if (action === 'clear') clearProc();
        else if (action === 'copy') copyProcOutput();
        else if (action === 'save') saveProcOutput();
      }
      closeSettingsMenu();
    }

    function handleFileUpload(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { statusText.value = '\u6587\u4EF6\u8FC7\u5927\uFF08\u6700\u59275MB\uFF09'; return; }
      if (file.size === 0) { statusText.value = '\u6587\u4EF6\u4E3A\u7A7A'; return; }

      function _loadContent(content, enc) {
        if (content.length > 5 * 1024 * 1024) { statusText.value = '文件内容过大（最大5MB）'; return; }
        if (content && !/CREATE|ALTER|COMMENT|INSERT|DROP|TABLE|INDEX|FUNCTION|PROCEDURE/i.test(content.substring(0, 2000))) {
          statusText.value = '\u8B66\u544A: \u6587\u4EF6\u5185\u5BB9\u53EF\u80FD\u4E0D\u662F\u6709\u6548\u7684 SQL \u8BED\u53E5';
        } else {
          statusText.value = '\u5DF2\u52A0\u8F7D\u6587\u4EF6: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB, ' + enc + ')';
        }
        if (activePage.value === 'func') { funcInput.value = content; funcOutput.value = ''; }
        else if (activePage.value === 'proc') { procInput.value = content; procOutput.value = ''; }
        else { inputDdl.value = content; outputDdl.value = ''; }
      }

      function _readAs(enc) {
        var r = new FileReader();
        r.onload = function(ev) { _loadContent(ev.target.result, enc); };
        r.onerror = function() { statusText.value = '\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25'; };
        r.readAsText(file, enc);
      }
      _readAs(fileEncoding.value || 'UTF-8');
    }

    // ========== Scroll to top ==========
    const showScrollTop = ref(false);
    function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

    // (Suggestion box removed)

    // ========== Live2D Mascot (Hatsune Miku) ==========
    // Loaded via external live2d-widget, click canvas to switch outfit

    // ========== Lifecycle ==========
    let scrollHandler;
    let keyHandler;
    let outsideClickHandler;
    let routeChangeHandler;
    let authStateChangeHandler;
    let ziweiAiSuggestViewportHandler;
    let _scrollTicking = false;
    onMounted(() => {
      scrollHandler = () => {
        if (!_scrollTicking) {
          window.requestAnimationFrame(() => {
            showScrollTop.value = window.scrollY > 300;
            _scrollTicking = false;
          });
          _scrollTicking = true;
        }
      };
      window.addEventListener('scroll', scrollHandler, { passive: true });
      keyHandler = (e) => {
        /* --- Modal keyboard: Escape to close, Tab to trap focus --- */
        if (ruleModal.value.visible) {
          if (e.key === 'Escape') { e.preventDefault(); ruleModal.value.visible = false; return; }
          if (e.key === 'Tab') { _trapFocus(e, ruleModalRef); return; }
        }
        if (confirmModal.value.visible) {
          if (e.key === 'Escape') { e.preventDefault(); confirmModalCancel(); return; }
          if (e.key === 'Tab') { _trapFocus(e, confirmModalRef); return; }
        }
        if (alertModal.value.visible) {
          if (e.key === 'Escape') { e.preventDefault(); alertModal.value.visible = false; return; }
          if (e.key === 'Tab') { _trapFocus(e, alertModalRef); return; }
        }
        /* --- Existing handlers --- */
        if (e.key === 'Escape' && showRulesMenu.value) {
          e.preventDefault();
          showRulesMenu.value = false;
          var trigger = document.getElementById('settings-trigger');
          if (trigger) trigger.focus();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          if (ruleModal.value.visible || alertModal.value.visible || confirmModal.value.visible) return;
          if (activePage.value !== 'ddl' && activePage.value !== 'func' && activePage.value !== 'proc') return;
          e.preventDefault();
          if (activePage.value === 'func') convertFunc();
          else if (activePage.value === 'proc') convertProc();
          else convert();
        }
      };
      window.addEventListener('keydown', keyHandler);
      ziweiAiSuggestViewportHandler = function() {
        if (!ziweiAiSuggestionOpen.value) return;
        scheduleZiweiAiSuggestionLayout();
      };
      window.addEventListener('resize', ziweiAiSuggestViewportHandler, { passive: true });
      window.addEventListener('scroll', ziweiAiSuggestViewportHandler, true);
      // Close floating panels on outside click
      outsideClickHandler = function(e) {
        if (showRulesMenu.value && !e.target.closest('.settings-dropdown')) {
          showRulesMenu.value = false;
        }
        if (ziweiAiSuggestionOpen.value && !e.target.closest('.ziwei-ai-qa-input-wrap')) {
          ziweiAiSuggestionOpen.value = false;
        }
      };
      document.addEventListener('click', outsideClickHandler);
      // Drag event listeners for modals
      window.addEventListener('mousemove', _onDragMove);
      window.addEventListener('mouseup', _onDragEnd);
      scheduleRegionWarmup();
      loadZiweiAiServerConfig().catch(function() {});
      authStateChangeHandler = function(e) {
        var detail = e && e.detail ? e.detail : {};
        var authUser = detail.user || null;
        if (authUser && authUser.email) {
          currentUserEmail.value = normalizeEmail(authUser.email);
          loadZiweiAiServerConfig().catch(function() {});
          return;
        }
        currentUserEmail.value = readCurrentAuthEmail();
        loadZiweiAiServerConfig().catch(function() {});
      };
      window.addEventListener('auth:state-changed', authStateChangeHandler);
      routeChangeHandler = function() {
        applyRouteFromLocation();
      };
      window.addEventListener('popstate', routeChangeHandler);
      window.addEventListener('hashchange', routeChangeHandler);
      var initialRoute = parseRouteInfoFromLocation();
      if (initialRoute) {
        applyRouteFromLocation();
      } else if (!document.body.classList.contains('splash-active')) {
        syncRouteForPage(activePage.value, true);
      }
    });
    onUnmounted(() => {
      if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
      if (keyHandler) window.removeEventListener('keydown', keyHandler);
      if (outsideClickHandler) document.removeEventListener('click', outsideClickHandler);
      if (routeChangeHandler) {
        window.removeEventListener('popstate', routeChangeHandler);
        window.removeEventListener('hashchange', routeChangeHandler);
      }
      if (authStateChangeHandler) {
        window.removeEventListener('auth:state-changed', authStateChangeHandler);
      }
      if (ziweiAiSuggestViewportHandler) {
        window.removeEventListener('resize', ziweiAiSuggestViewportHandler);
        window.removeEventListener('scroll', ziweiAiSuggestViewportHandler, true);
      }
      window.removeEventListener('mousemove', _onDragMove);
      window.removeEventListener('mouseup', _onDragEnd);
      if (idCopyTimer) clearTimeout(idCopyTimer);
      if (idVerifyTimer) clearTimeout(idVerifyTimer);
      if (usccCopyTimer) clearTimeout(usccCopyTimer);
      if (usccVerifyTimer) clearTimeout(usccVerifyTimer);
      if (ziweiCopyTimer) clearTimeout(ziweiCopyTimer);
      if (ziweiAiCopyTimer) clearTimeout(ziweiAiCopyTimer);
      if (ziweiGenerateTimer) clearTimeout(ziweiGenerateTimer);
      if (_ziweiAiCooldownTimer) clearTimeout(_ziweiAiCooldownTimer);
      cancelRegionWarmup();
    });

    return {
      activePage, sidebarOpen, sidebarCollapsed, toggleSidebar, handleSidebarHover, setPage,
      canAccessZiweiTool, isZiweiShareMode,
      testToolsExpanded, toggleTestToolsMenu,
      sidebarSettingsOpen, actionBarCollapsed,
      // DB Picker
      dbDropdown, dbAbbr, dbOptions, pickDb,
      // Theme
      themeMode, themeLabel, themeMenuLabel, primaryShortcutLabel, toggleTheme,
      currentPageTitle, currentPageSubtitle, currentEngineLabel, currentRuleCount, runPrimaryAction, goSplashHome,
      // DDL
      sourceDb, targetDb, inputDdl, outputDdl,
      sourceLabel, targetLabel, inputLineCount, outputMeta, ddlInputEmpty, ddlOutputEmpty,
      swapDbs, loadSample, clearAll, convert, copyOutput, saveOutput,
      // Function
      funcSourceDb, funcTargetDb, funcInput, funcOutput,
      funcSourceLabel, funcTargetLabel, funcInputLineCount, funcOutputMeta, funcInputEmpty, funcOutputEmpty,
      swapFuncDbs, loadFuncSample, clearFunc, convertFunc, copyFuncOutput, saveFuncOutput,
      // Procedure
      procSourceDb, procTargetDb, procInput, procOutput,
      procSourceLabel, procTargetLabel, procInputLineCount, procOutputMeta, procInputEmpty, procOutputEmpty,
      swapProcDbs, loadProcSample, clearProc, convertProc, copyProcOutput, saveProcOutput,
      // Test tools
      regionLoading, regionReady, regionLoadError, reloadRegionData,
      provinces,
      idProvinceCode, idCityCode, idCountyCode, idCityOptions, idCountyOptions,
      idBirthDate, idBirthMin, idBirthMax, idBirthYear, idBirthMonth, idBirthDay,
      idBirthYearOptions, idBirthMonthOptions, idBirthDayOptions, idGender,
      idGeneratedNumber, idGenerateResult, idVerifyInput, idVerifyResult,
      idCopyButtonLabel, idVerifyButtonLabel, generateIdNumber, validateIdNumber, copyGeneratedIdNumber,
      usccProvinceCode, usccCityCode, usccCountyCode, usccCityOptions, usccCountyOptions,
      usccCodeMode, usccModeOptions,
      usccDeptCode, usccOrgTypeCode, usccDeptOptions, usccOrgTypeOptions,
      usccGeneratedCode, usccLegacyGenerated, usccOutputPlaceholder, usccVerifyPlaceholder,
      usccGenerateResult, usccVerifyInput, usccVerifyResult,
      usccCopyButtonLabel, usccVerifyButtonLabel, generateUsccCode, validateUsccCode, copyGeneratedUsccCode,
      ziweiCalendarType, ziweiCalendarTypeLabel,
      ziweiSolarYear, ziweiSolarMonth, ziweiSolarDay, ziweiSolarDayOptions,
      ziweiLunarYear, ziweiLunarMonth, ziweiLunarDay, ziweiLunarLeap,
      ziweiLunarDayOptions, ziweiLunarMonthLabel,
      ziweiLeapMonthForYear, ziweiCanUseLeapMonth,
      ziweiBirthHour, ziweiBirthMinute, ziweiGender,
      ziweiAdvancedOpen, ziweiAdvancedSummary,
      ziweiClockMode, ziweiClockModeLabel, ziweiClockModeOptions, ziweiClockHint,
      ziweiTimezoneOffset, ziweiTimezoneOptions, ziweiLongitude,
      ziweiXiaoXianRule, ziweiXiaoXianRuleOptions,
      ziweiLiuNianRule, ziweiLiuNianRuleOptions,
      ziweiProfileName, ziweiHistoryPickedId, ziweiProMode, ziweiSchool, ziweiSchoolLabel, ziweiFocusBranch, ziweiFocusCell,
      ziweiSifangBranches, ziweiSifangCells, ziweiCenterTitle, ziweiJieqiPillarsText, ziweiNonJieqiPillarsText,
      ziweiJieqiPillarStemText, ziweiJieqiPillarBranchText, ziweiNonJieqiPillarStemText, ziweiNonJieqiPillarBranchText, ziweiCenterDaXianPreview,
      ziweiYearOptions, ziweiMonthOptions, ziweiHourOptions, ziweiMinuteOptions,
      ziweiChart, ziweiAnalysis, ziweiHistory, ziweiHistoryCountText, ziweiHistoryNameOptions, ziweiFocusTracks, ziweiFocusTrackCount, ziweiStatus,
      ziweiActiveAnalysis, ziweiAnalysisActiveKey,
      ziweiExporting, ziweiSharing, ziweiSharePosterDataUrl, ziweiGenerating, ziweiAiLoading, ziweiAiDone, ziweiAiError, ziweiAiResult, ziweiAiUpdatedAtText, ziweiAiDurationText, ziweiShareLink,
      ziweiAiQuestionInput, ziweiAiQuestionAnswer, ziweiAiQuestionLoading, ziweiAiSuggestionOpen, ziweiAiRequestBlocked,
      ziweiAiQaInputWrapRef, ziweiAiSuggestionPlacement, ziweiAiSuggestionMaxHeight,
      ziweiAiSuggestionsFiltered,
      ziweiGenerateButtonLabel, ziweiCopyButtonLabel, ziweiAiCopyButtonLabel, ziweiExportButtonLabel, ziweiShareButtonLabel, ziweiAiButtonLabel,
      generateZiweiChart, copyZiweiChartText, copyZiweiAnalysisText, exportZiweiChartImage, generateZiweiSharePoster, closeZiweiSharePoster, downloadZiweiSharePoster, requestZiweiAiAnalysis,
      openZiweiAiSuggestions, pickZiweiAiSuggestion, submitZiweiAiQuestion,
      focusZiweiBranch, toggleZiweiAnalysis, applyZiweiHistoryFromInput, applyZiweiHistoryFromSelect, loadZiweiHistory, removeZiweiHistory, clearZiweiHistory, formatZiweiHistoryTime,
      // Shared
      statusText, fileInput, fileEncoding, ENCODING_OPTIONS, uploadFile, handleFileUpload,
      isWorkbenchPage, runWorkbenchAction, canRunPrimaryAction,
      showScrollTop, scrollToTop,
      // Rules
      ddlRules, addRule, deleteRule, saveRule,
      bodyRules, addBodyRule, deleteBodyRule, saveBodyRule,
      ruleModal, ruleModalRef, openRuleModal, confirmRuleModal,
      alertModal, alertModalRef, startDrag,
      confirmModal, confirmModalRef, confirmModalOk, confirmModalCancel,
      canUndoRule, undoRule, resetDdlRules, resetBodyRules,
      // New redesign state
      showRulesMenu, handleMenuKey, refCollapsed, ruleSearchQuery, ruleFilterDir,
      ddlRuleTab, bodyRuleTab, DDL_CATS_ALL, BODY_CATS_ALL,
      ddlRuleCatsFiltered, bodyCatsFiltered,
      outputStatus, filteredDdlRules, filteredBodyRules, toggleRef,
      ddlRuleCats
    };
  }
});

// ===== SQL Editor Component (CodeMirror wrapper) =====
app.component('sql-editor', {
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    ariaLabel: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  template: '<div ref="wrap" class="sql-editor-wrap"></div>',
  setup(props, { emit, attrs }) {
    const wrap = Vue.ref(null);
    let cm = null;
    let ignoreChange = false;
    const changeHandler = () => {
      if (ignoreChange) return;
      emit('update:modelValue', cm.getValue());
    };
    Vue.onMounted(() => {
      cm = CodeMirror(wrap.value, {
        value: props.modelValue || '',
        mode: 'text/x-sql',
        lineNumbers: true,
        lineWrapping: true,
        styleActiveLine: true,
        matchBrackets: true,
        placeholder: props.placeholder,
        indentWithTabs: false,
        tabSize: 2,
        indentUnit: 2
      });
      cm.on('change', changeHandler);
      // Forward aria-label to the actual editable textarea for accessibility
      const label = props.ariaLabel || attrs['aria-label'] || '';
      if (label) {
        cm.getInputField().setAttribute('aria-label', label);
      }
    });
    Vue.onUnmounted(() => {
      if (cm) {
        cm.off('change', changeHandler);
        const el = cm.getWrapperElement();
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
        cm = null;
      }
    });
    Vue.watch(() => props.modelValue, (val) => {
      if (cm && val !== cm.getValue()) {
        ignoreChange = true;
        const cursor = cm.getCursor();
        cm.setValue(val || '');
        cm.setCursor(cursor);
        ignoreChange = false;
      }
    });
    return { wrap };
  }
});

// v-click-outside directive for closing dropdowns
app.directive('click-outside', {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) binding.value(e);
    };
    document.addEventListener('click', el._clickOutside, true);
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true);
  }
});

app.mount('#app');
