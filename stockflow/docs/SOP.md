# StockFlow ERP – Standard Operating Procedure (SOP)

**Document Version:** 1.0
**System:** StockFlow ERP
**Purpose:** Standardize operations across warehouse, sales, production, packaging, inventory, accounting, and management teams.

---

# 1. Purpose

StockFlow manages the complete manufacturing lifecycle:

1. Raw Material Receiving
2. Warehouse Management
3. Sales Order Processing
4. Production Planning & Approval
5. Multi-Stage Manufacturing
6. Finished Goods Management
7. Packaging & Dispatch
8. Accounting & Reporting

The objective is to ensure:

* Full inventory visibility
* Production traceability
* Scrap accountability
* Accurate stock valuation
* Operational efficiency
* Management oversight

---

# 2. User Roles & Responsibilities

| Role                | Responsibility                                             |
| ------------------- | ---------------------------------------------------------- |
| Admin               | System configuration, user management, inventory oversight |
| Warehouse Officer   | Raw material receiving and inventory management            |
| Sales Officer       | Customer orders and quotations                             |
| Production Manager  | Production approval and monitoring                         |
| Department Operator | Stage-by-stage production execution                        |
| Packaging Officer   | Packaging and dispatch                                     |
| Finance Officer     | Cost tracking and accounting                               |
| Management          | Reporting and decision making                              |

---

# 3. Raw Material Receiving SOP

## Step 1: Receive Materials

Warehouse Officer receives materials from supplier.

Example:

* Steel Rods = 1,000 kg
* Aluminum Bars = 500 kg

## Step 2: Verify Delivery

Confirm:

* Material Type
* Quantity
* Supplier
* Delivery Note

## Step 3: Create Material Receipt

Navigate:

```text
Warehouse
→ Material Receipts
→ New Receipt
```

Capture:

* Supplier
* Material
* Quantity
* Unit Cost
* Receipt Date

## Step 4: Stock Update

System automatically updates:

* Raw Material Inventory
* Warehouse Balance
* Audit Trail

---

# 4. Sales Order SOP

## Step 1: Customer Inquiry

Sales Officer receives:

* Product Requirement
* Quantity
* Delivery Date

## Step 2: Create Sales Order

Navigate:

```text
Sales
→ Sales Orders
→ New Order
```

Enter:

* Customer
* Product Design
* Quantity
* Branch

## Step 3: Determine Production Requirement

### Scenario A: Finished Goods Available

System checks inventory.

If stock exists:

```text
Reserve Stock
→ Send to Packaging
```

No production required.

### Scenario B: Stock Not Available

System creates:

```text
Production Requirement
```

Order status becomes:

```text
Pending Production
```

---

# 5. Production Approval SOP

## Step 1: Manager Review

Production Manager reviews:

* Product
* Quantity
* Materials Required
* Delivery Deadline

## Step 2: Material Availability Check

System validates:

```text
Required Material
vs
Available Material
```

## Step 3: Approve Production

Manager clicks:

```text
Approve Production
```

System automatically:

* Creates Production Order
* Reserves Materials
* Places Job in Production Queue

Status Flow:

```text
Pending
→ Approved
→ In Production
```

---

# 6. Production Tracking SOP

## Production Flow

```text
Sales Order
        ↓
Production Order
        ↓
Cutting
        ↓
Forging
        ↓
Threading
        ↓
Finishing
        ↓
Finished Goods
        ↓
Packaging
```

## Stage Logging Rules

Every operator must record:

### Input Quantity

```text
KG Received
```

### Output Quantity

```text
KG Produced
```

### Scrap Quantity

```text
KG Lost
```

Example:

```text
Cutting Stage

Input: 1000kg
Output: 950kg
Scrap: 50kg
```

## Stage Completion

Operator clicks:

```text
Complete Stage
```

System:

* Updates inventory
* Records scrap
* Sends job to next department

---

# 7. Production Dashboard SOP

Managers can view:

### Production Orders

* Pending
* Approved
* Active
* Completed

### Live Stage Status

```text
Cutting     ✓ Complete
Forging     ✓ Complete
Threading   In Progress
Packaging   Waiting
```

### Metrics

* Production Efficiency
* Material Consumption
* Scrap Analysis
* Department Performance

---

# 8. Finished Goods SOP

## Automatic Completion

When final stage completes:

System creates Finished Goods Inventory.

Example:

```text
5000 Bolts
```

## Inventory Update

StockFlow updates:

* Finished Goods Stock
* Branch Inventory
* Available Quantity

---

# 9. Packaging SOP

## Step 1: Receive Packaging Request

Packaging receives:

* Sales Order
  OR
* Completed Production Order

## Step 2: Verify Quantity

Confirm:

* Product
* Quantity
* Packaging Type

## Step 3: Package Goods

Record:

* Quantity Packed
* Packaging Date
* Packaging Officer

## Step 4: Mark Fulfilled

Status:

```text
Ready for Dispatch
```

---

# 10. Dispatch SOP

## Step 1: Verify Order

Confirm:

* Customer
* Quantity
* Packaging Status

## Step 2: Dispatch Goods

Create:

```text
Delivery Note
```

Record:

* Vehicle
* Driver
* Dispatch Date

## Step 3: Complete Sale

Status:

```text
Fulfilled
```

Inventory automatically reduces.

---

# 11. Scrap Management SOP

All scrap must be recorded.

Scrap Reasons:

* Machine Fault
* Material Defect
* Human Error
* Process Loss

Example:

```text
Forging

Input: 950kg
Output: 920kg
Scrap: 30kg

Reason:
Material Defect
```

---

# 12. Inventory Control SOP

## Daily Checks

Warehouse Officer verifies:

* Raw Materials
* Work In Progress
* Finished Goods

## Monthly Stock Count

Conduct:

```text
Physical Count
```

Compare with:

```text
System Quantity
```

Investigate variances.

---

# 13. Accounting Integration SOP

## Material Purchase

```text
DR Inventory
CR Accounts Payable
```

## Production Consumption

```text
DR Work In Progress
CR Raw Material Inventory
```

## Finished Goods Completion

```text
DR Finished Goods
CR Work In Progress
```

## Sale

```text
DR Accounts Receivable
CR Sales Revenue
```

## Cost of Goods Sold

```text
DR Cost of Goods Sold
CR Finished Goods Inventory
```

---

# 14. Reporting SOP

Management reviews weekly:

### Sales Reports

* Revenue
* Orders
* Customers

### Production Reports

* Output
* Scrap
* Efficiency

### Inventory Reports

* Stock Levels
* Material Usage
* Fast Moving Items

### Financial Reports

* Profit & Loss
* Cost of Production
* Inventory Valuation

---

# 15. End-to-End StockFlow Workflow

```text
WAREHOUSE
│
├─ Receive Raw Materials
│
▼

SALES
│
├─ Create Sales Order
│
▼

SYSTEM
│
├─ Check Finished Goods Stock
│
├─ Available?
│     │
│     ├─ YES → Packaging
│     │
│     └─ NO
│
▼

MANAGER
│
├─ Review Production Requirement
├─ Approve Production
│
▼

PRODUCTION
│
├─ Cutting
├─ Forging
├─ Threading
├─ Finishing
│
▼

FINISHED GOODS
│
├─ Inventory Updated
│
▼

PACKAGING
│
├─ Pack Products
│
▼

DISPATCH
│
├─ Deliver Goods
│
▼

CUSTOMER
```

---

# Document Approval

| Role               | Name | Signature | Date |
| ------------------ | ---- | --------- | ---- |
| Operations Manager |      |           |      |
| Production Manager |      |           |      |
| Finance Manager    |      |           |      |
| Managing Director  |      |           |      |

---

**End of Document**