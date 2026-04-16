# Manager Approval Queue Component - StockFlow

A production-grade React component for managers to review and approve production orders before they're released to the factory floor, with rejection workflows and real-time status updates.

## Features

✅ **Pending Orders List** - Display all orders awaiting manager approval  
✅ **Rich Order Details** - Order number, design name, weight, quantity, and priority  
✅ **Yield Estimates** - Target yield percentage based on design specifications  
✅ **Approve & Release** - Send orders directly to production with one click  
✅ **Rejection Workflow** - Modal-based rejection with required reason capture  
✅ **Priority Filtering** - Filter by All, High Priority, or Urgent orders  
✅ **Loading Skeleton** - Professional loading states during data fetch  
✅ **Role-Based Access** - Only MANAGER and ADMIN roles can approve/reject  
✅ **Real-time Updates** - Orders removed from queue immediately after action  
✅ **Toast Notifications** - Clear success/error feedback for all operations  
✅ **Routing Indicator** - Shows that approved orders automatically route to Cutting Department  
✅ **Statistics Panel** - Overview of pending, urgent, and high-priority counts  

## Installation

The component uses dependencies already included in StockFlow:

```bash
# Already includes:
npm install  # framer-motion, lucide-react, react-hook-form, zod
```

## Component Usage

### Basic Implementation

```tsx
import { ManagerApprovalQueue } from '@/components/ManagerApprovalQueue'

export default function ApprovalsPage() {
  return (
    <div className="p-6">
      <ManagerApprovalQueue userRole="MANAGER" />
    </div>
  )
}
```

### With Server-Side Role Verification

```tsx
import { ManagerApprovalQueue } from '@/components/ManagerApprovalQueue'
import { requireRole } from '@/lib/auth'

export default async function ApprovalsPage() {
  let userRole = null
  try {
    const user = await requireRole('MANAGER', 'ADMIN')
    userRole = user.role
  } catch (error) {
    // Redirect or show permission error
  }

  return <ManagerApprovalQueue userRole={userRole} />
}
```

## Component Props

```typescript
interface ManagerApprovalQueueProps {
  userRole?: string | null  // User's role (MANAGER, ADMIN, etc.)
}
```

## Data Display

### Order Card Layout

Each order displays:

| Field | Type | Example |
|-------|------|---------|
| Order Number | String | ORD-ABC123 |
| Design Name | String | Hex Bolt M12 |
| Weight (kg) | Number | 5.25 |
| Quantity | Integer | 10 |
| Priority Badge | Enum | LOW, MEDIUM, HIGH, URGENT |
| Target Yield | Percentage | 88% |
| Routing Indicator | Info | → Cutting Dept |

### Priority Logic

Priority is determined by weight:
- **URGENT**: Manually set (highest priority)
- **HIGH**: Weight > 10 kg
- **MEDIUM**: Weight 5-10 kg
- **LOW**: Weight < 5 kg

### Yield Estimate Calculation

```javascript
yieldEstimate = (targetKg / designTargetWeight) * 100
```

## API Endpoints

### GET /api/production-orders

Retrieves pending production orders.

**Query Parameters:**
- `status` (string, default: "PENDING") - Filter by status
- `priority` (string, optional) - Filter by priority level
- `limit` (number, default: 50) - Records per page
- `offset` (number, default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ord-123",
      "code": "ORD-ABC123",
      "designName": "Hex Bolt M12",
      "targetKg": 5.5,
      "quantity": 10,
      "priority": "HIGH",
      "yieldEstimate": 88,
      "status": "PENDING"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "pages": 1
  }
}
```

### PATCH /api/production-orders/[id]/status

Updates order status to RELEASED or REJECTED.

**Required Role:** MANAGER or ADMIN

**Request Body:**
```json
{
  "status": "RELEASED",
  "rejectionReason": "Optional reason if rejecting"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Order approved and released successfully",
  "data": {
    "id": "ord-123",
    "status": "IN_PRODUCTION",
    "approvedBy": "user-456",
    "approvedAt": "2026-04-13T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing/invalid status
- `401 Unauthorized` - User lacks MANAGER/ADMIN role
- `404 Not Found` - Order not found
- `500 Internal Server Error` - Server error

## Workflows

### Approval Flow

```
1. User clicks "Approve" button
2. Component sends PATCH request to update status
3. Loading state shows on button
4. On success:
   - Order removed from list
   - Success toast displayed
   - Stats updated
5. Order automatically routed to Cutting Department
```

### Rejection Flow

```
1. User clicks "Reject" button
2. Modal appears with rejection reason textarea
3. User enters reason (5-200 characters required)
4. User clicks "Confirm Rejection"
5. Component sends PATCH request with rejection data
6. On success:
   - Order removed from list
   - Success toast displayed
   - Rejection reason stored in database
```

## UI/UX Components

### Statistics Panel

Shows real-time counts:
- **Pending**: Total orders awaiting approval
- **Urgent**: Orders with URGENT priority
- **High+**: Orders with HIGH or URGENT priority

### Filter Tabs

Three filter options:
- **All Orders** - Show all pending orders
- **High Priority** - Show HIGH and URGENT only
- **Urgent** - Show only URGENT orders

### Loading Skeleton

Professional loading state with animated pulse effect:
```tsx
<motion.div
  variants={skeletonVariants}
  animate="pulse"
  className="bg-slate-800 rounded-lg h-32"
/>
```

### Rejection Modal

Modal form for capturing rejection reason:
- Text area (5-200 character limit)
- Character counter
- Cancel and Confirm buttons
- Loading state during submission

## Styling & Customization

Component uses Tailwind CSS with amber theme for pending orders:

**Color Scheme:**
- **Primary Background**: `bg-slate-900` (dark cards)
- **Border**: `border-amber-700/50` (pending theme)
- **Accents**: `text-amber-400` (highlights)
- **Success**: `bg-green-600`, `text-green-400`
- **Error**: `bg-red-600`, `text-red-400`

**Responsive:** 
- Desktop: Full grid layout
- Scales order card columns from 12 to responsive on smaller screens

## Security Features

- ✅ Role-based access control (RBAC)
- ✅ User authentication required
- ✅ Server-side validation of status changes
- ✅ Rejection reasons stored for audit trail
- ✅ User ID captured with all actions
- ✅ Timestamp recorded for all changes
- ✅ Audit logs created automatically

## Performance Optimizations

- Component uses React Hook Form for efficient form state
- Optimistic updates (remove from list immediately)
- Framer Motion for smooth animations
- Lazy loading of order data
- Pagination support for scalability
- Minimal re-renders with proper state management

## Database Integration

### Required Tables

```prisma
model ProductionOrder {
  id        String   @id @default(cuid())
  status    String   // PENDING, APPROVED, IN_PRODUCTION, COMPLETED, REJECTED
  designId  String
  targetKg  Float
  quantity  Int
  approvedBy String?
  approvedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id    String @id @default(cuid())
  role  String // MANAGER, ADMIN, etc.
  email String @unique
}
```

## Error Handling

The component gracefully handles:
- ✅ Network errors
- ✅ Invalid status responses
- ✅ Missing required fields
- ✅ Missing orders
- ✅ Unauthorized access (displays permission message)
- ✅ Server errors (500+)

## Keyboard Shortcuts

While not explicitly implemented, the component supports:
- Tab navigation through buttons
- Enter to submit forms
- Escape to close modals

## Accessibility

- Semantic HTML structure
- ARIA labels on buttons
- Focus states visible on interactive elements
- Color contrast meets WCAG AA standards
- Keyboard navigation support
- Loading states announced to screen readers

## Testing Considerations

### Mock Data Example

```javascript
const mockOrders = [
  {
    id: '1',
    code: 'ORD-001',
    designName: 'Hex Bolt M12',
    targetKg: 5.5,
    quantity: 10,
    priority: 'HIGH',
    yieldEstimate: 88,
    status: 'PENDING',
  },
]
```

### API Mocking

```javascript
// Mock approval
fetch('/api/production-orders/1/status', {
  method: 'PATCH',
  body: JSON.stringify({ status: 'RELEASED' })
})
```

## Troubleshooting

### Orders Not Loading
- Check `/api/production-orders` endpoint responds correctly
- Verify status filter matches database values
- Check browser console for fetch errors

### Approve/Reject Not Working
- Verify user has MANAGER or ADMIN role
- Check `/api/production-orders/[id]/status` endpoint
- Ensure database connection is active

### Styling Issues
- Verify Tailwind CSS is properly configured
- Check that `bg-slate-900` and other classes are available
-Rebuild CSS with `npm run build`

### Rejection Modal Not Showing
- Check that `setShowRejectionModal` is being called
- Verify `AnimatePresence` wrapper is in place
- Check browser console for React errors

## Future Enhancements

- [ ] Batch approval of multiple orders
- [ ] Advanced filtering (by design, date range, etc.)
- [ ] Order details modal with full specifications
- [ ] SLA time tracking and alerts
- [ ] Assignment to specific departments
- [ ] Comments/notes on approvals
- [ ] Approval history and audit log view
- [ ] Email notifications on status changes
- [ ] Integration with IoT scales for auto-weight verification
- [ ] Predictive alerts for yield issues

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Files Included

- `components/ManagerApprovalQueue.tsx` - Main component
- `app/api/production-orders/route.ts` - Enhanced with GET filtering
- `app/api/production-orders/[id]/status/route.ts` - Status update endpoint
- `app/(dashboard)/approvals/page.tsx` - Demo page
- `MANAGER_APPROVAL_QUEUE_README.md` - This documentation

## Support

For issues or questions, please refer to the main StockFlow documentation or contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: April 13, 2026  
**Component Type**: Client Component  
**Maintainer**: StockFlow Team
