---
name: inventory-management
description: Use this skill when working on raw materials, finished goods, branch stock, reservations, stock movements, stock adjustments, receipts, or inventory reports in StockFlow.
---

# Inventory Management Skill

StockFlow tracks inventory by organization and branch.

## Inventory Areas

- Raw materials
- Consumables
- Finished goods
- Branch stock
- Reserved stock
- Available stock
- Stock movements
- Stock adjustments
- Material receipts
- Product receipts

## Core Rules

- Always scope inventory by organization.
- Scope by branch where applicable.
- Do not mix raw materials and finished goods logic.
- Use stock movement records for auditability.
- Do not directly mutate stock quantities without recording why.

## Stock Concepts

Available quantity:

```text
available = onHand - reserved
```

When sales reserve stock:

- increase reserved quantity
- do not reduce on-hand until fulfillment or dispatch

When packaging fulfills stock:

- reduce on-hand
- reduce reserved quantity if stock was reserved
- create a stock movement

## Raw Material Receipts

When warehouse receives materials:

1. Create receipt record.
2. Increase raw material balance.
3. Record supplier if available.
4. Record branch and organization.
5. Create audit trail.

## Safety

- Prevent negative stock unless explicitly allowed by business rules.
- Validate units of measure.
- Keep tenant-aware access through `getTenantPrisma(organizationId)`.
