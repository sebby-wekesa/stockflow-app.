---
name: stockflow-roles
description: Use this skill when implementing role-based dashboards, permissions, navigation, or workflow behavior for StockFlow ERP users.
---

# StockFlow Roles Skill

StockFlow users should only see and do what their role allows.

## Roles

### ADMIN

Can:
- manage system settings
- view reports
- manage users
- manage master data

### MANAGER

Can:
- review production orders
- approve production
- reject production
- monitor production progress

### OPERATOR

Can:
- see assigned department queue
- log stage input and output
- record scrap

Should not:
- approve own production orders
- see unrelated department tasks unless allowed

### SALES

Can:
- manage customers
- create sale orders
- view finished goods availability
- initiate fulfillment process

### PACKAGING

Can:
- view orders ready for packaging
- pack items
- mark order as fulfilled after packaging

### WAREHOUSE

Can:
- receive raw materials
- record suppliers and receipts
- update raw material intake records

## Rules

- Enforce role permissions on the server, not only in the UI.
- Navigation should hide unauthorized pages.
- Route handlers and server actions must validate authorization.
- Organization and branch scoping still apply after role checks.
