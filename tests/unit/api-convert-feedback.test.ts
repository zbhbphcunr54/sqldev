import { describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  invokeEdgeFunction: vi.fn()
}))

vi.mock('@/api/http', () => ({
  invokeEdgeFunction: apiMocks.invokeEdgeFunction
}))

describe('requestConvert', () => {
  it('normalizes a successful convert response', async () => {
    const { requestConvert } = await import('@/api/convert')
    apiMocks.invokeEdgeFunction.mockResolvedValue({
      output: 'create table demo(id int);',
      rulesSource: 'server-default',
      rulesVersion: 'v1'
    })

    await expect(
      requestConvert({
        sourceDialect: 'oracle',
        targetDialect: 'postgresql',
        sql: 'create table demo(id number);',
        kind: 'ddl'
      })
    ).resolves.toEqual({
      ok: true,
      outputSql: 'create table demo(id int);',
      warnings: [],
      rulesSource: 'server-default',
      rulesVersion: 'v1'
    })

    expect(apiMocks.invokeEdgeFunction).toHaveBeenCalledWith('convert', {
      kind: 'ddl',
      fromDb: 'oracle',
      toDb: 'postgresql',
      input: 'create table demo(id number);'
    })
  })

  it('returns invalid_response when convert output is missing', async () => {
    const { requestConvert } = await import('@/api/convert')
    apiMocks.invokeEdgeFunction.mockResolvedValue({})

    await expect(
      requestConvert({
        sourceDialect: 'mysql',
        targetDialect: 'oracle',
        sql: 'select 1'
      })
    ).resolves.toMatchObject({
      ok: false,
      error: 'invalid_response'
    })
  })
})

describe('submitFeedback', () => {
  it('forwards feedback payload to the feedback edge function', async () => {
    const { submitFeedback } = await import('@/api/feedback')
    apiMocks.invokeEdgeFunction.mockResolvedValue({ ok: true, id: 'fb_1' })

    await expect(
      submitFeedback({
        category: 'ux',
        content: '希望输入区提示更明显',
        source: 'workbench',
        scene: 'editor'
      })
    ).resolves.toEqual({ ok: true, id: 'fb_1' })

    expect(apiMocks.invokeEdgeFunction).toHaveBeenCalledWith('feedback', {
      category: 'ux',
      content: '希望输入区提示更明显',
      source: 'workbench',
      scene: 'editor'
    })
  })
})
