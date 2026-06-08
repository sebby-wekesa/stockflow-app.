---
name: sales-orders
description: Use this skill when creating or fixing customer orders, sale order lines, invoices, fulfillment, packaging handoff, or customer stock allocation in StockFlow.
---

# Sales Orders Skill

Sales orders connect customers, stock, packaging, and fulfillment.

## Sale Order Statuses

Common flow:

```text
DRAFT -> INVOICED -> FULFILLED
```

Cancelled flow:

```text
DRAFT or INVOICED -> CANCELLED
```

## Sales Responsibilities

Sales users can:

- create customer orders
- add sale order lines
- check available finished goods
- request fulfillment
- view order status

Packaging users can:

- see orders ready for packaging
- pack items
- mark fulfillment complete

## Rules

- Validate customer belongs to the organization.
- Validate products belong to the organization.
- Check available stock before fulfillment.
- Reserve stock where the business flow requires it.
- Do not mark fulfilled unless packaging is complete.
- Record stock movement after fulfillment.

## UI Notes

For sales screens:

- show customer
- order number
- branch
- status
- line items
- available stock
- fulfillment state
