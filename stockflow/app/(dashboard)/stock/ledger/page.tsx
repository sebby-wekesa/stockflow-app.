import { StockLedger } from '@/components/stock/StockLedger'

interface PageProps {
  searchParams: Promise<{ productId?: string }>
}

export default async function StockLedgerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const productId = params.productId

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Stock Ledger</div>
          <div className="section-sub">
            Track inventory movements and stock history
          </div>
        </div>
      </div>

      <StockLedger productId={productId} />
    </div>
  )
}