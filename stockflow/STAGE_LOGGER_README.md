# Stage Logging Component - StockFlow

A production-grade React component for factory floor weight logging with real-time traceability validation, built for StockFlow manufacturing management system.

## Features

✅ **Real-time Weight Validation** - Ensures input weight equals output weight + scrap weight  
✅ **Balance Offset Display** - Shows weight difference with color-coded feedback  
✅ **Dark Mode UI** - High-contrast design optimized for factory floor lighting  
✅ **Touch-Optimized** - Large, easy-to-tap input fields and buttons  
✅ **Smooth Animations** - Framer Motion transitions between orders  
✅ **Confetti Celebration** - Visual feedback on successful submissions  
✅ **Toast Notifications** - Clear success/error messaging  
✅ **Role-Based Access** - Integrated with StockFlow auth system  

## Installation

All dependencies are already included in StockFlow:

```bash
npm install  # Already includes:
# - framer-motion (animations)
# - canvas-confetti (celebrations)
# - lucide-react (icons)
# - react-hook-form (form management)
# - zod (validation)
```

## Component Props

```typescript
interface StageLoggingProps {
  activeOrders: Order[]      // Array of production orders
  currentDepartment: string  // Department name (e.g., 'CUTTING')
  onSuccess?: () => void     // Callback after successful submission
}

interface Order {
  id: string
  code: string
  weight: number
  designName: string
}
```

## Usage Example

```tsx
import { StageLoggingForm } from '@/components/StageLoggingForm'

export default function DashboardPage() {
  const activeOrders = [
    {
      id: '1',
      code: 'ORD-001',
      weight: 5.5,
      designName: 'Steel Gear',
    },
    // ... more orders
  ]

  return (
    <StageLoggingForm
      activeOrders={activeOrders}
      currentDepartment="CUTTING"
      onSuccess={() => console.log('Stage logged!')}
    />
  )
}
```

## Form Fields

| Field | Type | Description |
|-------|------|-------------|
| Order Selection | Dropdown | Select from active production orders |
| Input Weight | Read-only Display | Weight received from previous stage |
| Output Weight | Number (0.01 increments) | Weight of finished pieces |
| Scrap Weight | Number (0.01 increments) | Weight of waste/offcuts |

## Validation Logic

The component enforces strict traceability validation:

```
✓ Valid: Input (5.5 kg) = Output (5.0 kg) + Scrap (0.5 kg)
✓ Valid: Input (5.5 kg) = Output (5.501 kg) + Scrap (0.0 kg)  [tolerance: ±0.01kg]
✗ Invalid: Input (5.5 kg) ≠ Output (5.2 kg) + Scrap (0.2 kg)   [difference: 0.1 kg]
```

The "Complete Stage" button is disabled until the weights balance within a tolerance of ±0.01kg.

## API Integration

### POST /api/logs

Submits a new stage log entry.

**Request Body:**
```json
{
  "orderId": "ord-123",
  "department": "CUTTING",
  "inputWeight": 5.5,
  "outputWeight": 5.0,
  "scrapWeight": 0.5,
  "timestamp": "2026-04-13T10:30:00Z"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Stage log created successfully",
  "data": {
    "id": "log-456",
    "orderId": "ord-123",
    "stageName": "CUTTING",
    "kgIn": 5.5,
    "kgOut": 5.0,
    "kgScrap": 0.5,
    "completedAt": "2026-04-13T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - User not authenticated
- `422 Unprocessable Entity` - Weight does not balance
- `500 Internal Server Error` - Database or server error

### GET /api/logs

Retrieves stage logs (requires MANAGER or ADMIN role).

**Query Parameters:**
- `stageName` (optional) - Filter by department/stage name
- `limit` (optional, default: 20) - Number of records to return

**Example:**
```
GET /api/logs?stageName=CUTTING&limit=50
```

## Styling & Customization

The component uses Tailwind CSS with a dark slate color scheme:

- **Background**: `bg-slate-900` (dark card)
- **Text**: `text-white` (primary), `text-slate-300` (secondary)
- **Accents**: `text-amber-400` (highlights), `text-green-400` (success)
- **Borders**: `border-slate-700` (default), `border-green-500` (valid), `border-red-500` (error)

To customize colors, edit the Tailwind classes in `StageLoggingForm.tsx`.

## Animations

The component uses Framer Motion for smooth transitions:

- **Container Entry**: Fade-in with scale transition (0.4s)
- **Field Transitions**: Staggered appearance with x-axis slide
- **Order Switch**: AnimatePresence for mount/unmount animations
- **Button Interactions**: Scale on hover/tap

## Accessibility Features

- ✅ Semantic HTML structure
- ✅ ARIA labels on inputs
- ✅ Keyboard navigation support
- ✅ Focus states visible on all interactive elements
- ✅ Color contrast meets WCAG AA standards
- ✅ Error messages clearly associated with fields

## Performance Considerations

- Component uses React Hook Form for efficient form state management
- useCallback and memo patterns prevent unnecessary re-renders
- Real-time validation uses efficient numeric calculations
- API requests are debounced where applicable

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

*Note: Confetti effect requires canvas support*

## Troubleshooting

### "Module not found: can't resolve 'lucide-react'"
```bash
npm install lucide-react
npm install framer-motion canvas-confetti
```

### Toast notifications not showing
Ensure the `Toast` provider is wrapped around your component:
```tsx
import { Toast } from '@/components/Toast'

<StageLoggingForm {...props} />
<Toast />
```

### Weight validation failing
- Check that values are entered as numbers (not text)
- Verify the sum tolerates ±0.01 kg difference
- Clear browser console for error details

### API returns 401 Unauthorized
- User must be logged in
- User must have role: OPERATOR, MANAGER, or ADMIN
- Check authentication token in cookies/headers

## Database Schema

The component integrates with these Prisma models:

```prisma
model StageLog {
  id        String   @id @default(cuid())
  orderId   String
  order     ProductionOrder @relation(fields: [orderId], references: [id])
  stageName String
  sequence  Int
  kgIn      Float
  kgOut     Float
  kgScrap   Float
  operatorId String
  operator  User @relation(fields: [operatorId], references: [id])
  notes     String?
  completedAt DateTime @default(now())
}
```

## Files Included

- `components/StageLoggingForm.tsx` - Main component
- `app/api/logs/route.ts` - API endpoints
- `app/(dashboard)/stage-logger/page.tsx` - Demo page
- `STAGE_LOGGER_README.md` - This documentation

## Security Features

- ✅ Role-based access control (RBAC)
- ✅ User authentication required
- ✅ Server-side weight validation
- ✅ CSRF protection via Next.js
- ✅ Input sanitization via Zod
- ✅ Audit trail via StageLog records

## Future Enhancements

- [ ] Batch weight logging
- [ ] Historical trend charts
- [ ] Photo capture for documentation
- [ ] Barcode/QR code scanning
- [ ] Multi-language support
- [ ] Offline mode with sync
- [ ] Integration with IoT scales
- [ ] Predictive alerts for anomalies

## Support

For issues or questions, please refer to the main StockFlow documentation or contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: April 13, 2026  
**Maintainer**: StockFlow Team
