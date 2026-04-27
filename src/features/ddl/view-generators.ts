interface DdlViewModelLike {
  name: string
  columns: string[]
  query: string
  comment?: string
  withCheckOption?: boolean
  checkOptionType?: string | null
  readOnly?: boolean
  algorithm?: string | null
}

type QueryTransformer = (query: string, fromDb: string, toDb: string) => string

function escapeLiteral(value: unknown): string {
  return String(value || '').replace(/'/g, "''")
}

export function generateOracleViewStatements(
  viewsValue: DdlViewModelLike[],
  fromDbValue: unknown,
  transformQuery: QueryTransformer
): string {
  const views = Array.isArray(viewsValue) ? viewsValue : []
  const fromDb = String(fromDbValue || '')
  const lines: string[] = []

  for (const view of views) {
    const viewName = String(view.name || '').toUpperCase()
    if (view.comment) lines.push(`-- ${view.comment}`)
    let header = `CREATE OR REPLACE VIEW ${viewName}`
    if (view.columns?.length) {
      header += ` (${view.columns.map((item) => String(item || '').toUpperCase()).join(', ')})`
    }
    header += ' AS'
    lines.push(header)
    const query = transformQuery(String(view.query || ''), fromDb, 'oracle')
    lines.push(query)
    if (view.readOnly) {
      lines[lines.length - 1] += '\nWITH READ ONLY'
    } else if (view.withCheckOption) {
      lines[lines.length - 1] += '\nWITH CHECK OPTION'
    }
    lines.push(';')
    lines.push('')
    if (view.comment) {
      lines.push(`COMMENT ON TABLE ${viewName} IS '${escapeLiteral(view.comment)}';`)
      lines.push('')
    }
  }

  return lines.join('\n').trim()
}

export function generateMySqlViewStatements(
  viewsValue: DdlViewModelLike[],
  fromDbValue: unknown,
  transformQuery: QueryTransformer
): string {
  const views = Array.isArray(viewsValue) ? viewsValue : []
  const fromDb = String(fromDbValue || '')
  const lines: string[] = []

  for (const view of views) {
    const viewName = String(view.name || '').toLowerCase()
    if (view.comment) lines.push(`-- ${view.comment}`)
    let header = 'CREATE OR REPLACE'
    if (view.algorithm) header += ` ALGORITHM = ${String(view.algorithm).toUpperCase()}`
    header += ` VIEW \`${viewName}\``
    if (view.columns?.length) {
      header += ` (${view.columns.map((item) => `\`${String(item || '').toLowerCase()}\``).join(', ')})`
    }
    header += ' AS'
    lines.push(header)
    const query = transformQuery(String(view.query || ''), fromDb, 'mysql')
    lines.push(query)
    if (view.withCheckOption) {
      const optionType = view.checkOptionType || 'CASCADED'
      lines[lines.length - 1] += `\nWITH ${String(optionType).toUpperCase()} CHECK OPTION`
    } else if (view.readOnly) {
      lines.push('/* [注意: MySQL 不支持 WITH READ ONLY，请通过权限控制实现只读] */')
    }
    lines.push(';')
    lines.push('')
  }

  return lines.join('\n').trim()
}

export function generatePostgresViewStatements(
  viewsValue: DdlViewModelLike[],
  fromDbValue: unknown,
  transformQuery: QueryTransformer
): string {
  const views = Array.isArray(viewsValue) ? viewsValue : []
  const fromDb = String(fromDbValue || '')
  const lines: string[] = []

  for (const view of views) {
    const viewName = String(view.name || '').toLowerCase()
    if (view.comment) lines.push(`-- ${view.comment}`)
    let header = `CREATE OR REPLACE VIEW ${viewName}`
    if (view.columns?.length) {
      header += ` (${view.columns.map((item) => String(item || '').toLowerCase()).join(', ')})`
    }
    header += ' AS'
    lines.push(header)
    const query = transformQuery(String(view.query || ''), fromDb, 'postgresql')
    lines.push(query)
    if (view.withCheckOption) {
      const optionType = view.checkOptionType || 'LOCAL'
      lines[lines.length - 1] += `\nWITH ${String(optionType).toUpperCase()} CHECK OPTION`
    } else if (view.readOnly) {
      lines.push(
        '/* [注意: PostgreSQL 不支持 WITH READ ONLY，可通过 security_barrier 或 GRANT 控制] */'
      )
    }
    lines.push(';')
    lines.push('')
    if (view.comment) {
      lines.push(`COMMENT ON VIEW ${viewName} IS '${escapeLiteral(view.comment)}';`)
      lines.push('')
    }
  }

  return lines.join('\n').trim()
}
