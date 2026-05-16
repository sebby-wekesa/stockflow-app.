/**
 * @deprecated
 *
 * This file was written against an older schema (JobCard, productionOrderStage,
 * rawMaterialBalance, etc) that no longer exists. The current schema uses
 * ProductionOrder + Stage + StageLog + MaterialConsumptionLog.
 *
 * Active production workflow lives in:
 *   - app/actions/production.ts (job creation, status updates)
 *   - app/actions/production-order.ts (order approval, BOM consumption)
 *   - app/actions/material-consumption.ts (stage-by-stage consumption)
 *
 * Keeping this file empty so no other code accidentally imports the stale
 * exports. If you need a function from the old API, search the active
 * production files first.
 */

export {}
