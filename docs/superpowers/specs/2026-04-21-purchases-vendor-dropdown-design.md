# Purchases Page Vendor Dropdown Design Specification

## Overview

Replace the plain text Supplier ID and Supplier Name inputs on the purchases page with a searchable vendor dropdown (combobox) that filters from existing vendors and supports autocomplete as the user types.

## Requirements

### Functional Requirements

1. **Single Vendor Selection Field**
   - Replace two separate inputs (Supplier ID + Supplier Name) with one searchable combobox
   - Display vendor code and name in the dropdown (e.g., "SUP-0001 - ABC Supplies Inc.")
   - Show selected vendor name in the input field after selection

2. **Search & Filter**
   - As user types, filter vendors by entityName or entityCode (case-insensitive)
   - Show up to 10 matching results in dropdown
   - Show "No vendors found" when no matches exist
   - Allow creating a new bill without selecting a vendor (keep field optional, change to not required)

3. **Data Population**
   - When a vendor is selected, populate both `supplierId` and `supplierName` form fields
   - `supplierId` gets the vendor's `entityCode`
   - `supplierName` gets the vendor's `entityName`
   - On form reset (after successful submission), clear both fields

4. **Data Fetching**
   - Fetch all vendors from `/api/accounting/vendors` when the dialog opens
   - Cache vendors in component state — no re-fetch on each keystroke
   - Show loading state while fetching vendors

### Non-Functional Requirements

- Follow existing code patterns in the purchases page
- No new dependencies — use existing shadcn/ui components
- Client-side filtering (vendor list is small, <100 entries)
- TypeScript strict mode compliant

## Implementation Details

### Component Structure

The combobox will be implemented inline within `app/(dashboard)/accounting/purchases/page.tsx` — no separate component file needed. This keeps changes localized and follows the existing pattern where form logic lives in the page component.

### State Variables

- `vendors: Vendor[]` — fetched vendor list
- `isVendorsLoading: boolean` — loading state for vendor fetch
- `showDropdown: boolean` — whether dropdown is visible
- `filteredVendors: Vendor[]` — client-side filtered results

### Vendor Interface

```typescript
interface Vendor {
  id: string;
  entityCode: string;
  entityName: string;
}
```

### UI Layout

```html
<div className="space-y-2">
  <Label>Supplier</Label>
  <div className="relative">
    <Input
      placeholder="Search vendor by name or code..."
      value={selectedVendorName}
      onChange={handleSearch}
      onFocus={() => !isVendorsLoading && setShowDropdown(true)}
    />
    {showDropdown && (
      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
        {isVendorsLoading ? (
          <div className="p-3 text-sm text-muted-foreground">Loading vendors...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No vendors found</div>
        ) : (
          filteredVendors.map(vendor => (
            <div
              key={vendor.id}
              className="p-3 hover:bg-muted cursor-pointer flex items-center gap-2"
              onClick={() => handleSelectVendor(vendor)}
            >
              <span className="font-mono text-xs text-muted-foreground">{vendor.entityCode}</span>
              <span className="font-medium">{vendor.entityName}</span>
            </div>
          ))
        )}
      </div>
    )}
  </div>
</div>
```

### Behavior

1. **Dialog opens** → fetch vendors via `fetch('/api/accounting/vendors')`
2. **User types in input** → filter vendors by name/code, update dropdown
3. **User clicks a vendor** → set `supplierId = vendor.entityCode`, `supplierName = vendor.entityName`, close dropdown
4. **User clicks outside** → close dropdown (via click event listener)
5. **Form submits** → send formData with supplierId and supplierName populated
6. **Form resets** → clear supplierId and supplierName

### Edge Cases

- **No vendors exist** → show "No vendors found. Add vendors from Vendor Management first."
- **Vendor list loading** → show loading placeholder in dropdown
- **Duplicate vendor names** → filter shows all matches, user picks by code
- **Form reset after submission** → both supplierId and supplierName cleared

## Files Modified

- `app/(dashboard)/accounting/purchases/page.tsx` — replace supplier inputs with combobox

## Files NOT Modified

- Vendor API (`/api/accounting/vendors`) — no changes needed
- Prisma schema — no changes needed
- Other pages — no changes needed

</content> {