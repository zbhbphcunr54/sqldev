import { formatSqlText, splitSqlStatements } from './sql-format'

declare global {
  interface Window {
    SQLDEV_SQL_UTILS?: {
      formatSqlText: typeof formatSqlText
      splitStatements: typeof splitSqlStatements
    }
  }
}

window.SQLDEV_SQL_UTILS = Object.freeze({
  formatSqlText,
  splitStatements: splitSqlStatements
})
