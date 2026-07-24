import { getStockTransferHistoryVisibilityWhere } from './stock-transfer-history'

describe('stock transfer history visibility', () => {
  it('shows a branch user transfers sent from or received by their branch', () => {
    expect(getStockTransferHistoryVisibilityWhere('WAREHOUSE', ['branch-a'])).toEqual({
      OR: [
        { sourceBranchId: { in: ['branch-a'] } },
        { destinationBranchId: { in: ['branch-a'] } },
      ],
    })
  })

  it('keeps users without an assigned branch from seeing transfer history', () => {
    expect(getStockTransferHistoryVisibilityWhere('WAREHOUSE', [])).toEqual({
      id: { in: [] },
    })
  })

  it.each(['ADMIN', 'MANAGER'] as const)('%s can review all tenant transfers', (role) => {
    expect(getStockTransferHistoryVisibilityWhere(role, [])).toEqual({})
  })
})
