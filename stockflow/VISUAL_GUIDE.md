# CreateProductionOrderForm - Visual Guide

## 📱 Component Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  📦 Create Production Order                                            │
│  Initialize a new manufacturing order in the system                    │
│                                                                         │
│  ╔═════════════════════════════════════════════════════════════════╗  │
│  ║                                                                 ║  │
│  ║  Order Number                                                   ║  │
│  ║  ┌──────────────────────────────────────────────────────────┐  ║  │
│  ║  │ ORD-2026-0042                          [READ-ONLY]       │  ║  │
│  ║  │ Auto-generated • Read-only                               │  ║  │
│  ║  └──────────────────────────────────────────────────────────┘  ║  │
│  ║                                                                 ║  │
│  ║  Design Selection *                                             ║  │
│  ║  ┌──────────────────────────────────────────────────────────┐  ║  │
│  ║  │ Select a design...                                  ▼    │  ║  │
│  ║  │ • Widget A (50 kg)                                      │  ║  │
│  ║  │ • Widget B (75 kg)                                      │  ║  │
│  ║  │ • Component X (120 kg)                                  │  ║  │
│  ║  └──────────────────────────────────────────────────────────┘  ║  │
│  ║                                                                 ║  │
│  ║  Initial Weight (kg) *                                          ║  │
│  ║  ┌──────────────────────────────────────────────────────────┐  ║  │
│  ║  │ Enter weight in kilograms                                │  ║  │
│  ║  └──────────────────────────────────────────────────────────┘  ║  │
│  ║                                                                 ║  │
│  ║  Priority Level *                                               ║  │
│  ║  ┌───────────┐  ┌───────────┐  ┌───────────┐                  ║  │
│  ║  │ ◯ Low     │  │ ◐ Medium  │  │ ◯ High    │                  ║  │
│  ║  │ (Emerald) │  │ (Amber)   │  │ (Red)     │                  ║  │
│  ║  └───────────┘  └───────────┘  └───────────┘                  ║  │
│  ║                                                                 ║  │
│  ║  ⚡ Order Summary                                              ║  │
│  ║  ╔──────────────────────────────────────────────────────────╗ ║  │
│  ║  ║ Order Number:          ORD-2026-0042                    ║ ║  │
│  ║  ║ Design:                Widget A                         ║ ║  │
│  ║  ║ Initial Weight:        45.5 kg                          ║ ║  │
│  ║  ║ Priority:              High                             ║ ║  │
│  ║  ║ ─────────────────────────────────────────────────────  ║ ║  │
│  ║  ║ Total Weight Introduced:       45.5 kg                 ║ ║  │
│  ║  ╚──────────────────────────────────────────────────────────╝ ║  │
│  ║                                                                 ║  │
│  ║  ┌──────────────────────────────────────────────────────────┐  ║  │
│  ║  │  📦  Create Production Order                [Loading...]  │  ║  │
│  ║  └──────────────────────────────────────────────────────────┘  ║  │
│  ║                                                                 ║  │
│  ║  * Required fields • All data is validated before submission    ║  │
│  ║                                                                 ║  │
│  ╚═════════════════════════════════════════════════════════════════╝  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Color Scheme & States

### Normal State
```
Component Background:    Zinc 900/50 (dark semi-transparent)
Border Color:            Zinc 800
Text Color:              Zinc 100
Input Background:        Zinc 800/50
Focus Color:             Blue 500 (ring)
```

### Focus State
```
Border:                  Blue 500
Ring:                    Focus ring with blue glow
Background:              Slightly lighter
```

### Error State
```
Border:                  Red 500/50
Text:                    Red 400
Icon:                    Alert circle in red
Background:              Stays same
```

### Loading State
```
Button:                  Gradient from-blue-600 to-blue-500
Button Text:             "Creating Order..."
Button Icon:             Spinning loader
Button State:            Disabled (no click)
```

### Success State
```
Toast Background:        Emerald 900/10
Toast Border:            Emerald 500/30
Toast Text:              Emerald 100
Toast Icon:              Check circle in green
Duration:                4 seconds auto-dismiss
```

---

## 📊 Form Field Specifications

### 1. Order Number
```
Type:              Read-only text input
Format:            ORD-YYYY-NUMBER (e.g., ORD-2026-0042)
Width:             Full width
Height:            40px (py-2.5)
Padding:           px-4
Border:            1px solid zinc-700
Background:        bg-zinc-800/50
Cursor:            not-allowed (disabled)
Text Color:        text-zinc-400
Font Size:         Base (16px)
Help Text:         "Auto-generated • Read-only"
```

### 2. Design Selection Dropdown
```
Type:              HTML Select
Width:             Full width
Height:            40px (py-2.5)
Padding:           px-4
Border:            1px solid (zinc-700 or blue-500 on focus)
Background:        bg-zinc-800/50
Text Color:        text-zinc-200
Font Size:         Base (16px)
Options:           Fetched from designs API
Option Example:    "Widget A (50 kg)"
Focus Ring:        Blue 500 2px
Error State:       Border becomes red-500/50
Help Text:         "Design selection • Description if available"
```

### 3. Initial Weight Input
```
Type:              Number input
Width:             Full width
Height:            40px (py-2.5)
Padding:           px-4
Border:            1px solid (zinc-700 or blue-500 on focus)
Background:        bg-zinc-800/50
Text Color:        text-zinc-200
Placeholder:       "Enter weight in kilograms"
Placeholder Color: text-zinc-600
Step:              0.01
Min:               0
Max:               10000
Focus Ring:        Blue 500 2px
Error State:       Border becomes red-500/50
Validation Rules:  Positive number, max 10,000 kg
```

### 4. Priority Radio Buttons
```
Layout:            Grid 3 columns
Gap:               12px
Each Option:
  Type:            Radio button (hidden)
  Container:
    Border:        2px solid (zinc-700 or blue-500 if selected)
    Background:    bg-zinc-800/30 or bg-blue-900/20 if selected
    Padding:       p-3
    Radius:        rounded-lg
    Cursor:        pointer
  Indicator Ring:
    Size:          3x3 (h-3 w-3)
    Border:        2px
    Color:         zinc-600 or blue-400 if selected
    Fill:          blue-400 if selected
  Label:
    Size:          text-sm font-medium
    Color:         color-coded (emerald, amber, red)
```

---

## ✨ Interactive Elements

### Hover States
```
Design Dropdown (not focused):
  Border:        zinc-600 (lighter)
  
Priority Option (not selected):
  Background:    bg-zinc-800/50 (slightly lighter)
  Border:        zinc-600 (lighter)

Submit Button (enabled):
  Background:    Gradient slightly lighter
  Cursor:        pointer
  Shadow:        Light shadow on hover
```

### Focus States
```
All Inputs:
  Border:        Blue 500
  Ring:          Blue 500 2px ring
  Outline:       None (ring used instead)

Radio Buttons:
  State:         Selected (blue highlight)
  Animation:     Smooth transition
```

---

## 📱 Responsive Design

### Desktop (1024px+)
```
Width:             Max 2xl (672px)
Margin:            Auto centered
Padding:           24px (p-6)
Form Gaps:         24px (space-y-6)
Layout:            Single column (all fields full width)
```

### Tablet (768px - 1023px)
```
Width:             90% of viewport
Padding:           16px
Form Gaps:         16px
Layout:            Single column
```

### Mobile (< 768px)
```
Width:             100% (full screen)
Padding:           12px
Margin:            0
Form Gaps:         12px
Layout:            Single column, stacked
Font Size:         Readable (16px+ on inputs)
Touch Targets:     Min 44px (WCAG guideline)
```

---

## 🔄 Animation States

### Form Loading
```
Button:
  Animation:   Spinner rotation (360deg, infinite)
  Duration:    1s
  Timing:      Linear

Toast Entry:
  Animation:   Fade in + slide from right
  Duration:    300ms
  Easing:      ease-in-out
```

### Toast Exit
```
Animation:   Fade out
Duration:    300ms (on manual close)
Auto-dismissal: 4s default

Stacking:
  Position:   Fixed bottom-right
  Gaps:       8px between
  Max Stack:  Unlimited (recommend 3-5)
```

---

## 📋 Real-time Summary Display

Shows when: User has selected design OR entered weight

```
┌─────────────────────────────────────────┐
│ ⚡ Order Summary                        │
│                                         │
│ Order Number:     ORD-2026-0042         │
│ Design:           Widget A              │
│ Initial Weight:   45.5 kg               │
│ Priority:         High                  │
│ ─────────────────────────────────────  │
│ Total Weight:     45.5 kg               │
│                                         │
│ (Blue accent, semi-transparent bg)     │
└─────────────────────────────────────────┘
```

**Update Triggers:**
- Design selection changes
- Weight input updates
- Priority selection changes
- Form state is reset

---

## 🔔 Toast Notifications

### Success Toast
```
┌─────────────────────────────────────────────────────┐
│ ✓ Production order ORD-2026-0042 created            │ ✕
│   successfully!                                      │
└─────────────────────────────────────────────────────┘

Background:   Emerald 900/10 with emerald 500/30 border
Text:         Emerald 100
Icon:         Check circle (emerald 400)
Duration:     4s auto-dismiss
```

### Error Toast
```
┌─────────────────────────────────────────────────────┐
│ ⚠ Failed to create production order                 │ ✕
└─────────────────────────────────────────────────────┘

Background:   Red 900/10 with red 500/30 border
Text:         Red 100
Icon:         Alert circle (red 400)
Duration:     4s auto-dismiss
```

### Info Toast
```
┌─────────────────────────────────────────────────────┐
│ ℹ Order saved as draft                              │ ✕
└─────────────────────────────────────────────────────┘

Background:   Blue 900/10 with blue 500/30 border
Text:         Blue 100
Icon:         Info circle (blue 400)
Duration:     4s auto-dismiss
```

---

## 🎯 Validation Error Messages

### Design Error
```
Location:    Below dropdown
Text Color:  Red 400
Icon:        Alert circle
Message:     "Design is required"
```

### Weight Error
```
Scenarios:
  Missing:     "Weight is required"
  Negative:    "Initial weight must be a positive number"
  Too High:    "Initial weight cannot exceed 10,000 kg"
  Not Number:  "Invalid number format"

Display:     Inline below input field
Color:       Red 400
Icon:        Alert circle
```

### Priority Error
```
Text:        "Please select a priority level"
Display:     Below radio button group
Color:       Red 400
Icon:        Alert circle
```

---

## ♿ Accessibility Features

### Keyboard Navigation
```
Tab Order:
  1. Order Number (skip - disabled)
  2. Design Dropdown
  3. Weight Input
  4. Priority Radio 1
  5. Priority Radio 2
  6. Priority Radio 3
  7. Submit Button
  8. Copy to clipboard button (if applicable)

Keyboard Shortcuts:
  Enter:       Submit form (when focused on button)
  Esc:         Close dropdown (when open)
  Space:       Check radio button
  Tab:         Navigate fields
  Shift+Tab:   Navigate backwards
```

### Screen Reader Support
```
Form Labels:     All inputs have <label> tags
Link Text:       Descriptive text for buttons
Error Messages:  Associated with inputs via aria-describedby
Disabled State:  aria-disabled="true" on read-only field
Required:        aria-required="true" on form fields
Status:          Live regions for toast notifications
```

### Vision Support
```
Color Contrast:  WCAG AAA compliant (7:1 minimum)
Font Size:       16px minimum (readable on mobile)
Focus Indicators: Visible blue ring (2px)
Icons + Text:    Icons accompanied by text labels
```

---

## 📏 Spacing & Sizing

### Margins & Padding
```
Form Container:
  Padding:       24px (p-6)
  Border Radius: 12px (rounded-xl)
  
Field Groups:
  Gap between:   24px (space-y-6)
  
Input Fields:
  Padding:       10px 16px (py-2.5 px-4)
  Margin Bottom: 8px (for help text)
  
Labels:
  Margin Bottom: 8px (mb-2)
  
Buttons:
  Padding:       12px 16px (py-3 px-4)
  Full Width:    True
```

### Font Sizes
```
Title:          text-xl (20px) font-semibold
Labels:         text-sm (14px) font-medium
Input Text:     text-base (16px)
Help Text:      text-xs (12px)
Error Messages: text-sm (14px)
```

---

## 🔗 Data Relationships

```
Form ←→ Zod Schema
  ↓
React Hook Form
  ↓
Form Submission
  ↓
POST /api/production-orders
  ↓
Database (Prisma)
  ├─ productionOrder table
  └─ design relationship
  ↓
GET /api/production-orders
  ↓
Orders Table Display
  ├─ Order ID
  ├─ Design Name
  ├─ Weight
  ├─ Priority
  ├─ Status
  └─ Created Date
```

---

## 🖼️ Component States Matrix

| State | Button | Inputs | Summary | Toast |
|-------|--------|--------|---------|-------|
| Initial | Disabled | Enabled | Hidden | None |
| Filling | Disabled | Enabled | Shows | None |
| Valid | Enabled | Enabled | Full | None |
| Submitting | Loading | Disabled | Shown | None |
| Success | Enabled | Reset | Resets | Success |
| Error | Enabled | Enabled | Shown | Error |

---

## 🎬 User Walkthrough

### Step 1: Page Load
```
Timeline:  0ms - 500ms
- Page renders with loading state
- Designs fetched from API
- Dropdown populates
- Order number generates
```

### Step 2: User Selects Design
```
Timeline:  500ms - 1000ms
- Design dropdown opens
- User selects "Widget A"
- Summary appears with design info
- Weight input gets focus highlight
```

### Step 3: User Enters Weight
```
Timeline:  1000ms - 3000ms
- User types "45.5"
- Real-time validation passes
- Summary updates with weight
- Red error disappears (if any)
- Submit button remains enabled
```

### Step 4: User Selects Priority
```
Timeline:  3000ms - 4000ms
- User clicks "High" priority
- Radio button highlights blue
- Summary updates with priority
- Form is now complete and valid
- Submit button is actively ready
```

### Step 5: Form Submission
```
Timeline:  4000ms - 5000ms
- User clicks "Create Production Order"
- Button shows loading spinner
- API call to POST /api/production-orders
- New order created in database
- Success toast appears
- Form resets with new order number
- Orders list below refreshes
```

---

This visual guide complements the [PRODUCTION_ORDER_FORM.md](PRODUCTION_ORDER_FORM.md) with detailed visual specifications. Use this when styling, theming, or extending the component.
