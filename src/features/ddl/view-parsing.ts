interface DdlViewLike {
  name: string
  columns: string[]
  query: string
  comment: string
  withCheckOption: boolean
  checkOptionType: string | null
  readOnly: boolean
  orReplace: boolean
  force: boolean
  algorithm: string | null
}

type ViewFactory = () => DdlViewLike
type SplitStatements = (sql: string) => string[]
type BodyTransformer = (query: string, fromDb: string, toDb: string) => string

export function parseViewStatements(
  sqlValue: unknown,
  splitStatements: SplitStatements,
  createViewModel: ViewFactory
): DdlViewLike[] {
  const sql = String(sqlValue || '')
  const views: DdlViewLike[] = []
  const clean = sql.replace(/\/\s*$/gm, '').replace(/\r\n/g, '\n')
  const statements = splitStatements(clean)

  for (const statement of statements) {
    const sqlStatement = String(statement || '').trim()
    const viewRegex =
      /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:(FORCE|NOFORCE)\s+)?(?:ALGORITHM\s*=\s*(\w+)\s+)?(?:(?:TEMP|TEMPORARY)\s+)?(?:(?:DEFINER\s*=\s*\S+)\s+)?(?:SQL\s+SECURITY\s+\w+\s+)?VIEW\s+(?:[\w"`]+\.)?["`]?(\w+)["`]?\s*/i
    const viewMatch = sqlStatement.match(viewRegex)
    if (!viewMatch) continue

    const view = createViewModel()
    view.name = viewMatch[3]
    if (viewMatch[1]) view.force = viewMatch[1].toUpperCase() === 'FORCE'
    if (viewMatch[2]) view.algorithm = viewMatch[2].toUpperCase()
    view.orReplace = /OR\s+REPLACE/i.test(sqlStatement)

    let rest = sqlStatement.slice(viewMatch[0].length)
    if (rest.charAt(0) === '(') {
      let depth = 0
      let closeIndex = 0
      for (; closeIndex < rest.length; closeIndex += 1) {
        if (rest[closeIndex] === '(') depth += 1
        if (rest[closeIndex] === ')') {
          depth -= 1
          if (depth === 0) break
        }
      }
      const columnBody = rest.slice(1, closeIndex)
      view.columns = columnBody
        .split(',')
        .map((item) => item.trim().replace(/["`]/g, ''))
        .filter(Boolean)
      rest = rest.slice(closeIndex + 1).trim()
    }

    const asMatch = rest.match(/^AS\s+/i)
    if (asMatch) rest = rest.slice(asMatch[0].length)

    let query = rest
    const readOnlyMatch = query.match(/\s+WITH\s+READ\s+ONLY\s*$/i)
    if (readOnlyMatch) {
      view.readOnly = true
      query = query.slice(0, readOnlyMatch.index)
    }

    const checkOptionMatch = query.match(/\s+WITH\s+(CASCADED\s+|LOCAL\s+)?CHECK\s+OPTION\s*$/i)
    if (checkOptionMatch) {
      view.withCheckOption = true
      view.checkOptionType = checkOptionMatch[1] ? checkOptionMatch[1].trim().toUpperCase() : null
      query = query.slice(0, checkOptionMatch.index)
    }

    view.query = query.trim()
    views.push(view)
  }

  for (const statement of statements) {
    const sqlStatement = String(statement || '').trim()
    const commentMatch = sqlStatement.match(
      /^COMMENT\s+ON\s+(?:TABLE|VIEW)\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i
    )
    if (!commentMatch) continue

    const view = views.find((item) => item.name.toUpperCase() === commentMatch[1].toUpperCase())
    if (view) view.comment = commentMatch[2].replace(/''/g, "'")
  }

  return views
}

export function transformViewQueryText(
  queryValue: unknown,
  fromDbValue: unknown,
  toDbValue: unknown,
  transformBody: BodyTransformer
): string {
  const query = String(queryValue || '')
  const fromDb = String(fromDbValue || '')
  const toDb = String(toDbValue || '')
  if (!query || fromDb === toDb) return query

  let transformed = transformBody(query, fromDb, toDb)
  if (fromDb === 'oracle' && toDb === 'postgresql') {
    transformed = transformed.replace(/\s+FROM\s+DUAL\b/gi, '')
  }
  return transformed
}
