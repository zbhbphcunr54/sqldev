export interface DbMeta {
  slug: string
  label: string
  abbr: string
}

export const DB_META_MAP: Record<string, DbMeta> = {
  oracle: { slug: 'oracle', label: 'Oracle', abbr: 'ORA' },
  mysql: { slug: 'mysql', label: 'MySQL', abbr: 'MY' },
  postgresql: { slug: 'postgresql', label: 'PostgreSQL', abbr: 'PG' },
  kingbasees: { slug: 'kingbasees', label: 'KingbaseES', abbr: 'KB' },
  dm8: { slug: 'dm8', label: 'DM8', abbr: 'DM' },
  yashan: { slug: 'yashan', label: 'YashanDB', abbr: 'YS' },
  gaussdb: { slug: 'gaussdb', label: 'GaussDB', abbr: 'GD' },
  goldendb: { slug: 'goldendb', label: 'GoldenDB', abbr: 'GN' },
  oceanbase_oracle: { slug: 'oceanbase_oracle', label: 'OceanBase(Oracle)', abbr: 'OBO' },
  oceanbase_mysql: { slug: 'oceanbase_mysql', label: 'OceanBase(MySQL)', abbr: 'OBM' },
  tdsql_mysql: { slug: 'tdsql_mysql', label: 'TDSQL(MySQL)', abbr: 'TM' },
  tdsql_pg: { slug: 'tdsql_pg', label: 'TDSQL(PG)', abbr: 'TP' },
  tidb: { slug: 'tidb', label: 'TiDB', abbr: 'TD' },
  gbase_8a: { slug: 'gbase_8a', label: 'GBase 8a', abbr: 'G8' },
  gbase_8c: { slug: 'gbase_8c', label: 'GBase 8c', abbr: 'GC' },
  gbase_8s: { slug: 'gbase_8s', label: 'GBase 8s', abbr: 'GS' },
  hivesql: { slug: 'hivesql', label: 'HiveSQL', abbr: 'HV' }
}
