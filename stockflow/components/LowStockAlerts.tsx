'use client'

import { useCallback, useEffect, useState } from 'react'
import { getLowStockAlerts } from '@/app/actions/stock-alerts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { LowStockAlert } from '@/app/actions/stock-alerts'

export function LowStockAlerts() {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLowStockAlerts()
      setAlerts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAlerts()
  }, [])

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'default'
      default:
        return 'default'
    }
  }

  const getDaysRemainingText = (days: number) => {
    if (days === 999) return 'Unknown'
    if (days < 1) return '< 1 day'
    return `${days} days`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading stock alerts...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-green-600" />
            Stock Alerts
          </CardTitle>
          <CardDescription>All materials are sufficiently stocked</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {alerts.some(a => a.alertLevel === 'critical') ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : alerts.some(a => a.alertLevel === 'warning') ? (
            <AlertCircle className="h-5 w-5 text-amber-600" />
          ) : (
            <Info className="h-5 w-5 text-blue-600" />
          )}
          Low Stock Alerts ({alerts.length})
        </CardTitle>
        <CardDescription>
          Materials requiring attention based on consumption trends
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.materialId} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getAlertIcon(alert.alertLevel)}
                <div>
                  <div className="font-medium">{alert.materialName}</div>
                  <div className="text-sm text-gray-600">
                    {alert.availableStock.toFixed(1)} kg available
                    {alert.reservedStock > 0 && ` (${alert.reservedStock.toFixed(1)} kg reserved)`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={getAlertColor(alert.alertLevel)}>
                  {getDaysRemainingText(alert.daysRemaining)}
                </Badge>
                <div className="text-xs text-gray-500 mt-1">
                  Order: {alert.recommendedOrderKg.toFixed(1)} kg
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-gray-500">
            Alerts based on 30-day consumption trends. Critical: ≤3 days, Warning: ≤7 days, Info: ≤14 days
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
