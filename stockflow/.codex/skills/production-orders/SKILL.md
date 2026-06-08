---
name: production-orders
description: Use this skill when building or fixing production orders, job cards, production stages, approvals, scrap tracking, or finished-goods flow in StockFlow.
---

# Production Orders Skill

StockFlow is a manufacturing ERP. Production must preserve traceability from raw materials to finished goods.

## Main Workflow

WAREHOUSE  
→ MANAGER APPROVAL  
→ CUTTING  
→ FORGING  
→ THREADING  
→ FINISHED GOODS  
→ SALES  
→ PACKAGING

## Production Status Flow

Normal flow:

```text
PENDING -> APPROVED -> IN_PRODUCTION -> COMPLETED
```

Rejected flow:

```text
PENDING -> REJECTED
```

Cancelled flow:

```text
PENDING or APPROVED -> CANCELLED
```

## Stage Tracking

Each production stage should track:

- `kgIn`
- `kgOut`
- `kgScrap`
- `scrapReason`
- operator/user
- timestamp
- production order or job card reference

## Scrap Reasons

Valid reasons:

- `MACHINE_FAULT`
- `MATERIAL_DEFECT`
- `HUMAN_ERROR`
- `PROCESS_LOSS`

## Rules

- Managers approve production before operators start work.
- Operators should only see their department queue.
- Stage output should feed the next stage input.
- Finished goods should only increase after completion.
- Scrap must be recorded and auditable.
- Never lose organization or branch context.
