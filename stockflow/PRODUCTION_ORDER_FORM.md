# CreateProductionOrderForm - Implementation Guide

## Overview
A production-ready React form component for creating manufacturing production orders in the StockFlow system. Built with Next.js, React Hook Form, Zod validation, and Tailwind CSS.

## Features

### ✅ Core Features
- **Auto-generated Order Numbers**: Unique identifiers (e.g., `ORD-2026-001`)
- **Live Design Selection**: Dropdown with design details and descriptions
- **Weight Input Validation**: Ensures positive numbers up to 10,000 kg
- **Priority Levels**: Low, Medium, and High with visual indicators
- **Real-time Summary**: Shows total weight and order details
- **Toast Notifications**: Success/error feedback with auto-dismiss
- **Loading States**: Visual feedback during submission
- **Responsive Design**: Mobile-friendly dark-mode interface

### 🎨 Styling
- **Dark Mode Compatible**: Zinc/slate color palette with blue accents
- **Modern Card Layout**: Rounded borders with subtle shadows
- **Accessibility**: Proper labels, ARIA attributes, and keyboard navigation
- **Visual Hierarchy**: Clear typography and spacing

## File Structure

```
components/
├── Toast.tsx                      # Toast provider and notifications
└── CreateProductionOrderForm.tsx  # Main form component

app/
├── api/
│   ├── production-orders/
│   │   └── route.ts              # Production order API endpoint
│   └── designs/
│       └── route.ts              # Designs API endpoint
└── (dashboard)/
    └── orders/
        └── page.tsx              # Orders page using the form
```

## Installation

### 1. Install Dependencies
```bash
npm install react-hook-form @hookform/resolvers zod lucide-react
```

### 2. Ensure Tailwind CSS is Configured
The form uses Tailwind utilities. Verify your `tailwind.config.ts` includes:
```typescript
content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}']
```

### 3. Set Up Toast Provider
Wrap your layout with the `ToastProvider` in `layout.tsx`:
```tsx
import { ToastProvider } from '@/components/Toast'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
```

## Usage

### Basic Implementation
```tsx
import { CreateProductionOrderForm } from '@/components/CreateProductionOrderForm'

export default function OrdersPage() {
  const [designs, setDesigns] = useState([])

  return (
    <CreateProductionOrderForm
      designs={designs}
      onSuccess={() => console.log('Order created successfully')}
    />
  )
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `designs` | `Design[]` | Yes | Array of design objects |
| `onSuccess` | `() => void` | No | Callback when order is created |

### Design Object Structure
```typescript
interface Design {
  id: string
  name: string
  targetWeight?: number
  description?: string
}
```

## Form Fields

### 1. Order Number
- **Type**: Read-only text input
- **Format**: `ORD-YYYY-####` (e.g., `ORD-2026-0042`)
- **Auto-generated**: New number on form reset
- **Validation**: None (read-only)

### 2. Design Selection
- **Type**: Dropdown select
- **Required**: Yes
- **Validation**: Must select a valid design
- **Display**: Shows design name with optional target weight

### 3. Initial Weight
- **Type**: Number input
- **Unit**: Kilograms (kg)
- **Required**: Yes
- **Validation**:
  - Must be a positive number
  - Minimum: 0.01 kg
  - Maximum: 10,000 kg
- **Step**: 0.01 (allows decimals)

### 4. Priority Level
- **Type**: Radio button group
- **Options**: LOW, MEDIUM, HIGH
- **Required**: Yes
- **Visual Indicators**: Color-coded (emerald, amber, red)

## Validation Schema

The form uses Zod for runtime validation:

```typescript
const createProductionOrderSchema = z.object({
  designId: z.string().min(1, 'Design is required'),
  initialWeight: z.coerce
    .number()
    .positive('Initial weight must be a positive number')
    .max(10000, 'Initial weight cannot exceed 10,000 kg'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH'])
})
```

## Summary Section

Displays order details in real-time:
- Order Number
- Selected Design
- Initial Weight
- Priority Level
- **Total Weight Introduced**: Prominently displayed

### When It Appears
- After selecting a design OR entering weight
- Updates in real-time as values change
- Styled with blue accent border

## API Integration

### Production Orders Endpoint

**POST** `/api/production-orders`

Request body:
```json
{
  "orderNumber": "ORD-2026-0042",
  "designId": "design-id-123",
  "initialWeight": 45.5,
  "priority": "HIGH"
}
```

Response (201 Created):
```json
{
  "message": "Production order created successfully",
  "order": {
    "id": "order-123",
    "orderNumber": "ORD-2026-0042",
    "designId": "design-id-123",
    "targetKg": 45.5,
    "priority": "HIGH",
    "status": "PENDING",
    "createdAt": "2026-04-13T12:00:00Z"
  }
}
```

### Designs Endpoint

**GET** `/api/designs`

Response (200 OK):
```json
[
  {
    "id": "design-123",
    "name": "Widget A",
    "description": "Standard widget design",
    "targetWeight": 50
  }
]
```

## Toast Notifications

### useToast Hook
```typescript
import { useToast } from '@/components/Toast'

function MyComponent() {
  const { showToast } = useToast()

  const handleSuccess = () => {
    showToast('Operation successful!', 'success')
  }

  const handleError = () => {
    showToast('Something went wrong', 'error')
  }

  return (
    <>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
    </>
  )
}
```

### Toast Types
- **success**: Green checkmark (4s duration)
- **error**: Red alert icon (4s duration)
- **info**: Blue info icon (4s duration)

## Styling Customization

### Color Palette
```
Primary:    Blue (600-500)
Border:     Zinc 700-800
Background: Zinc 900/50 with 800/30 variants
Text:       Zinc 100-300
Accent:     Blue 400
Success:    Emerald 400
Warning:    Amber 400
Error:      Red 400
```

### Dark Mode
The component is built with dark mode as default using Tailwind classes:
- `bg-zinc-900/50` - Semi-transparent black
- `text-zinc-100` - Bright text
- `border-zinc-800` - Dark borders

## Error Handling

### Validation Errors
- Displayed inline under each field
- Red border highlighting invalid fields
- Clear error messages with validation context

### Submission Errors
- Toast notification with error message
- Console logging for debugging
- Non-blocking - user can retry

### Example Error Messages
- "Design is required"
- "Initial weight must be a positive number"
- "Initial weight cannot exceed 10,000 kg"

## Loading States

### During Submission
- Button displays "Creating Order..." text
- Spinner animation on button
- Form remains visible for reference
- Submit button disabled to prevent double-submission

## Accessibility Features

- Semantic HTML form structure
- Proper `<label>` associations
- Required field indicators (*)
- Error message positioning near inputs
- Keyboard navigation support
- Auto-focus on first invalid field
- ARIA-compliant error messages

## Performance Considerations

1. **Memoization**: Form respects React optimization patterns
2. **Debouncing**: Summary updates are instant but efficient
3. **API Calls**: Non-blocking with proper error handling
4. **Re-rendering**: Minimized through React Hook Form

## Common Use Cases

### 1. Creating a Single Order
```tsx
<CreateProductionOrderForm
  designs={myDesigns}
  onSuccess={() => console.log('Created!')}
/>
```

### 2. Integrating with a Modal
```tsx
<Modal isOpen={isOpen} onClose={onClose}>
  <CreateProductionOrderForm
    designs={designs}
    onSuccess={onClose}
  />
</Modal>
```

### 3. Custom Success Handling
```tsx
const handleOrderSuccess = () => {
  // Refresh orders list
  // Redirect user
  // Log event
}

<CreateProductionOrderForm
  designs={designs}
  onSuccess={handleOrderSuccess}
/>
```

## Troubleshooting

### Form Not Submitting
- Check that all required fields are filled
- Verify Zod validation schema
- Check browser console for errors

### Toast Notifications Not Showing
- Ensure ToastProvider wraps the component
- Check z-index conflicts with other elements
- Verify Lucide icons are imported

### Styles Not Applying
- Confirm Tailwind CSS is properly configured
- Clear build cache: `npm run build`
- Restart development server

### API Endpoint Returns 404
- Verify files exist in `app/api/production-orders/route.ts`
- Check file naming conventions
- Restart Next.js dev server

## Testing

### Mock Form Data
```typescript
const mockData = {
  designId: 'design-123',
  initialWeight: 45.5,
  priority: 'HIGH'
}
```

### Manual Testing Checklist
- [ ] Form loads without errors
- [ ] Design dropdown populates
- [ ] Weight validation triggers on blur
- [ ] Priority selection updates UI
- [ ] Summary displays all values
- [ ] Submit button enables when form is valid
- [ ] Success toast appears on submission
- [ ] Form resets after success
- [ ] New order number generates on reset

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## Dependencies

```json
{
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "next": "^16.2.3",
  "react-hook-form": "^7.x",
  "@hookform/resolvers": "^3.x",
  "zod": "^4.3.6",
  "lucide-react": "latest"
}
```

## Future Enhancements

- [ ] Batch order creation
- [ ] Order templates
- [ ] Quantity optimization suggestions
- [ ] Design requirements preview
- [ ] Cost estimation
- [ ] Schedule order for later
- [ ] Duplicate last order quick-create

## Support & Issues

For issues or feature requests, refer to:
1. Validation errors in browser console
2. API responses from `/api/production-orders`
3. React Hook Form documentation
4. Zod schema documentation
