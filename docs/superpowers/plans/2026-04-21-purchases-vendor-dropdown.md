# Purchases Vendor Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the two plain text supplier inputs on the purchases page with a searchable vendor dropdown that filters from existing vendors.

**Architecture:** Inline combobox component within the purchases page. Fetch vendors on dialog open, filter client-side. On selection, populate both `supplierId` (entityCode) and `supplierName` (entityName) form fields. No new files or dependencies needed.

**Tech Stack:** Next.js 14 App Router, React 18, shadcn/ui Input/Label/Button components, TypeScript

---

### Task 1: Add vendor state and fetch logic

**Files:**
- Modify: `app/(dashboard)/accounting/purchases/page.tsx`

Add vendor-related state variables and a function to fetch vendors from the API.

- [ ] **Step 1: Add Vendor interface and new state variables**

Add after the existing `search` state variable (line 19):

```typescript
interface Vendor {
  id: string;
  entityCode: string;
  entityName: string;
}

const [vendors, setVendors] = useState<Vendor[]>([]);
const [isVendorsLoading, setIsVendorsLoading] = useState(false);
const [showDropdown, setShowDropdown] = useState(false);
const [searchTerm, setSearchTerm] = useState('');
```

- [ ] **Step 2: Add vendor fetch function**

Add after the `fetchData` function (after line 50):

```typescript
async function fetchVendors() {
  setIsVendorsLoading(true);
  try {
    const res = await fetch('/api/accounting/vendors');
    const data = await res.json() as Vendor[];
    setVendors(data);
  } catch (err) {
    console.error('Error fetching vendors:', err);
  } finally {
    setIsVendorsLoading(false);
  }
}
```

- [ ] **Step 3: Fetch vendors when dialog opens**

Replace the `Dialog` component's `onOpenChange` handler to also fetch vendors. Change line 115 from:

```tsx
<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
```

to:

```tsx
<Dialog open={isDialogOpen} onOpenChange={(open) => {
  setIsDialogOpen(open);
  if (open) {
    setSearchTerm('');
    setShowDropdown(false);
    fetchVendors();
  }
}}>
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/accounting/purchases/page.tsx
git commit -m "feat: add vendor state and fetch logic to purchases page"
```

---

### Task 2: Implement combobox logic and click-outside handler

**Files:**
- Modify: `app/(dashboard)/accounting/purchases/page.tsx`

Add the filtering logic, vendor selection handler, and click-outside listener.

- [ ] **Step 1: Add filtered vendors derived state**

Add after the `fetchVendors` function (after the closing brace of `fetchVendors`):

```typescript
const filteredVendors = vendors.filter(v =>
  v.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  v.entityCode.toLowerCase().includes(searchTerm.toLowerCase())
).slice(0, 10);
```

- [ ] **Step 2: Add vendor selection handler**

Add after `filteredVendors`:

```typescript
function handleSelectVendor(vendor: Vendor) {
  setFormData(prev => ({
    ...prev,
    supplierId: vendor.entityCode,
    supplierName: vendor.entityName,
  }));
  setSearchTerm(vendor.entityName);
  setShowDropdown(false);
}
```

- [ ] **Step 3: Add click-outside handler to close dropdown**

Add after `handleSelectVendor`:

```typescript
useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-combobox]')) {
      setShowDropdown(false);
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/accounting/purchases/page.tsx
git commit -m "feat: add combobox filtering and click-outside handler"
```

---

### Task 3: Replace supplier inputs with combobox UI

**Files:**
- Modify: `app/(dashboard)/accounting/purchases/page.tsx`

Replace the two supplier input fields (lines 122-131) with a single searchable combobox.

- [ ] **Step 1: Replace supplier input section**

Replace lines 122-131:

```jsx
<div className="grid grid-cols-3 gap-4">
  <div className="space-y-2 col-span-3">
    <Label>Supplier</Label>
    <div className="relative" data-combobox>
      <Input
        placeholder="Search vendor by name or code..."
        value={searchTerm}
        onChange={e => {
          setSearchTerm(e.target.value);
          setShowDropdown(true);
          setFormData(prev => ({ ...prev, supplierId: '', supplierName: '' }));
        }}
        onFocus={() => {
          if (!isVendorsLoading) setShowDropdown(true);
        }}
        className="bg-background"
      />
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isVendorsLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading vendors...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              No vendors found. Add vendors from Vendor Management first.
            </div>
          ) : (
            filteredVendors.map(vendor => (
              <div
                key={vendor.id}
                className="p-3 hover:bg-muted cursor-pointer flex items-center gap-2 border-b last:border-b-0"
                onClick={() => handleSelectVendor(vendor)}
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0">{vendor.entityCode}</span>
                <span className="font-medium truncate">{vendor.entityName}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Make supplier field not required**

The combobox replaces the two `required` inputs. The `supplierId` and `supplierName` form fields are still submitted but are no longer required at the input level. Remove the `required` attribute from the old inputs (they're being replaced entirely).

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/accounting/purchases/page.tsx
git commit -m "feat: replace supplier inputs with searchable vendor combobox"
```

---

### Task 4: Verify and test

**Files:**
- `app/(dashboard)/accounting/purchases/page.tsx`

- [ ] **Step 1: Run lint**

```bash
npm run lint -- app/(dashboard)/accounting/purchases/page.tsx
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

```bash
npm run build
```

- [ ] **Step 3: Manual testing checklist**
  - Open purchases page, click "New Bill"
  - Vendor list should load and dropdown should appear on focus
  - Type to filter vendors by name or code
  - Click a vendor — both supplierId and supplierName should populate
  - Submit form — bill should save with correct supplier data
  - Click outside dropdown — it should close
  - Reset form after submission — supplier fields should clear

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add app/(dashboard)/accounting/purchases/page.tsx
git commit -m "fix: address lint or build issues from vendor combobox"
```

---

## Plan Self-Review

**Spec coverage check:**
- Single vendor dropdown replacing two inputs → Task 3
- Search/filter by name or code → Task 2 (filteredVendors)
- Show up to 10 results → Task 2 (.slice(0, 10))
- "No vendors found" message → Task 3 UI
- Populate supplierId (entityCode) + supplierName (entityName) → Task 2 (handleSelectVendor)
- Fetch on dialog open → Task 1 (onOpenChange handler)
- Loading state → Task 3 UI
- Click-outside to close → Task 2 (useEffect)
- Form reset clears supplier → Already handled by existing reset logic (line 88-92)

**Placeholder scan:** No TBD, TODO, or vague references found. All code is concrete.

**Type consistency:** Vendor interface defined in Task 1, used consistently in Tasks 2-3. State variable names match across all tasks.

**Edge cases covered:** No vendors → shown in UI. Loading → shown in UI. Click-outside → handled by useEffect. Form reset → existing reset logic already clears supplierId/supplierName.

**Scope check:** Single file modified, no schema/API changes needed. Focused and complete.
