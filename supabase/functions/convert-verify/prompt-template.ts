export interface VerifyEnvironment {
  aiIdentity: string
  targetDbVersion: string
  sourceDbVersion?: string
  businessContext?: string
  specialRequirements?: string
}

export function buildVerifySystemPrompt(
  kind: string,
  fromDb: string,
  toDb: string,
  env: VerifyEnvironment
): string {
  const identityLine = env.aiIdentity
    || `senior database migration expert specializing in ${fromDb} → ${toDb} conversion`

  const versionContext = [
    `Source database: ${fromDb}${env.sourceDbVersion ? ` ${env.sourceDbVersion}` : ''}`,
    `Target database: ${toDb} ${env.targetDbVersion}`
  ].join('\n')

  const businessLine = env.businessContext
    ? `\nBusiness context: ${env.businessContext}`
    : ''

  const requirementsLine = env.specialRequirements
    ? `\nSpecial requirements from user: ${env.specialRequirements}`
    : ''

  return `You are a ${identityLine}.

${versionContext}${businessLine}${requirementsLine}

Your task is to verify a converted ${kind.toUpperCase()} statement for correctness.

Analyze the ORIGINAL ${fromDb} SQL and the CONVERTED ${toDb} SQL, then produce a verification report.

Output strictly one JSON object. No markdown, no code fence.

JSON schema:
{
  "overallScore": 0-100,
  "syntaxIssues": [
    {
      "line": <line number or 0>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description in Chinese>",
      "fix": "<suggested fix in Chinese>"
    }
  ],
  "semanticIssues": [
    {
      "severity": "error" | "warning" | "info",
      "message": "<issue description in Chinese>",
      "original": "<problematic original snippet>",
      "converted": "<problematic converted snippet>"
    }
  ],
  "logicRisks": [
    {
      "category": "performance" | "data_precision" | "charset" | "identifier" | "reserved_word" | "transaction" | "partition" | "other",
      "severity": "high" | "medium" | "low",
      "message": "<risk description in Chinese>",
      "impact": "<business impact in Chinese>"
    }
  ],
  "suggestions": [
    {
      "priority": "high" | "medium" | "low",
      "targetSql": "<suggested corrected SQL or fragment>",
      "explanation": "<explanation in Chinese>"
    }
  ],
  "summary": "<overall assessment in Chinese, 80-200 chars>"
}

Rules:
1) Focus on ${fromDb} ${env.sourceDbVersion || ''} → ${toDb} ${env.targetDbVersion} specific compatibility issues.
2) Check syntax compatibility with ${toDb} ${env.targetDbVersion} (keywords, types, functions).
3) Check semantic equivalence (NULL handling, type coercion, cursor behavior).
4) Check business logic risks (performance, precision, charset, reserved words).
5) Provide actionable fix suggestions with corrected SQL fragments.
6) Score: 100 = no issues, deduct points for each issue (error -15, warning -5, info -1).
7) Write all text in Simplified Chinese.
8) Be specific and reference actual SQL snippets, avoid generic advice.
9) Consider the target version ${env.targetDbVersion} when checking feature availability.`
}

export function buildVerifyUserPrompt(
  inputSql: string,
  outputSql: string
): string {
  return `Original SQL:
\`\`\`sql
${inputSql}
\`\`\`

Converted SQL:
\`\`\`sql
${outputSql}
\`\`\`

Please verify the converted SQL and output the JSON report.`
}

export const DEFAULT_ENVIRONMENTS: Record<string, VerifyEnvironment> = {
  'oracle:oracle': {
    aiIdentity: '资深 Oracle 数据库专家，精通 Oracle 内部特性和最佳实践',
    targetDbVersion: 'Oracle 21c'
  },
  'oracle:mysql': {
    aiIdentity: '资深 Oracle→MySQL 数据库迁移专家，精通两种数据库的语法差异、性能优化和数据类型映射',
    targetDbVersion: 'MySQL 8.0'
  },
  'oracle:postgresql': {
    aiIdentity: '资深 Oracle→PostgreSQL 数据库迁移专家，精通 PL/pgSQL 存储过程和 Oracle PL/SQL 的差异',
    targetDbVersion: 'PostgreSQL 16'
  },
  'mysql:mysql': {
    aiIdentity: '资深 MySQL 数据库专家，精通 MySQL 内部特性和最佳实践',
    targetDbVersion: 'MySQL 8.0'
  },
  'mysql:oracle': {
    aiIdentity: '资深 MySQL→Oracle 数据库迁移专家，精通 Oracle 的高级特性和 MySQL 的兼容性限制',
    targetDbVersion: 'Oracle 21c'
  },
  'mysql:postgresql': {
    aiIdentity: '资深 MySQL→PostgreSQL 数据库迁移专家，精通两种数据库的函数差异和性能特性',
    targetDbVersion: 'PostgreSQL 16'
  },
  'postgresql:postgresql': {
    aiIdentity: '资深 PostgreSQL 数据库专家，精通 PostgreSQL 内部特性和最佳实践',
    targetDbVersion: 'PostgreSQL 16'
  },
  'postgresql:oracle': {
    aiIdentity: '资深 PostgreSQL→Oracle 数据库迁移专家，精通 PL/SQL 和 PL/pgSQL 的转换',
    targetDbVersion: 'Oracle 21c'
  },
  'postgresql:mysql': {
    aiIdentity: '资深 PostgreSQL→MySQL 数据库迁移专家，精通两种数据库的存储过程差异',
    targetDbVersion: 'MySQL 8.0'
  }
}
