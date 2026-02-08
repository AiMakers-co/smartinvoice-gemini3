# Ormandy UI/UX Conventions

> **IMPORTANT:** Read this before making any UI changes!

## Layout Rules

### 1. FULL WIDTH PAGES (Default)

All dashboard pages should use the **full available width**. The sidebar already constrains the space.

```tsx
// ✅ CORRECT - No max-width constraint
<div className="flex-1 p-4 overflow-auto">
  <div className="space-y-4">
    {/* Content fills available width */}
  </div>
</div>

// ❌ WRONG - Don't constrain width
<div className="flex-1 p-4 overflow-auto">
  <div className="max-w-4xl mx-auto space-y-4">  {/* DON'T DO THIS */}
    {/* Content is artificially narrow */}
  </div>
</div>
```

### 2. Standard Page Structure

```tsx
export default function MyPage() {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Page Title" />
      <div className="flex-1 p-4 overflow-auto">
        <div className="space-y-4">
          {/* Page content here */}
        </div>
      </div>
    </div>
  );
}
```

### 3. When max-width IS Okay (Rare)

Only use `max-w-*` for:
- Single-column forms (`/accounts/new` → `max-w-md`)
- Admin settings pages (`max-w-3xl`)
- Centered dialogs/modals

**NEVER** use on:
- Data tables
- Lists
- Dashboards
- Upload pages
- Any page with grids/cards

## Color Palette

| Purpose | Class | Hex |
|---------|-------|-----|
| Primary (Ormandy Red) | `bg-ormandy-red` | #E31B54 |
| Page Background | `bg-slate-50` | - |
| Card Background | `bg-white` | - |
| Primary Text | `text-slate-900` | - |
| Secondary Text | `text-slate-500` | - |
| Borders | `border-slate-200` | - |

## Component Patterns

### Cards
```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-base">Title</CardTitle>
    <CardDescription className="text-xs">Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Responsive Grids
```tsx
// Let grids expand on wider screens
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards expand to fill space */}
</div>
```

### Buttons
```tsx
// Primary action
<Button>Save</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Danger action
<Button variant="destructive">Delete</Button>

// Small buttons in tables/lists
<Button variant="ghost" size="sm" className="h-8">
  <Icon className="h-4 w-4" />
</Button>
```

## Text Sizes

| Element | Class |
|---------|-------|
| Page titles | `text-base font-semibold` (in Header component) |
| Card titles | `text-base font-semibold` |
| Card descriptions | `text-xs text-slate-500` |
| Body text | `text-sm` |
| Small labels | `text-xs` |
| Table headers | `text-xs font-medium` |

## Spacing

- Page padding: `p-4`
- Card padding: Default (via CardHeader/CardContent)
- Between cards: `space-y-4` or `gap-4`
- Between sections: `space-y-6`

## Icons

Using Lucide React icons:
```tsx
import { FileText, Upload, CheckCircle2 } from "lucide-react";

// Standard sizes
<Icon className="h-4 w-4" />  // In buttons, inline
<Icon className="h-5 w-5" />  // In cards, lists
<Icon className="h-8 w-8" />  // Featured/hero areas
```

---

**Remember:** Wide layouts = better data visibility = happier users! 🎉

