# Schedule of PPE Report - Design Specification

## Overview
Create a new report page under Asset Inventory to display assets in the Schedule of Property, Plant & Equipment (PPE) format, with quarterly depreciation tracking per the Excel template provided.

## Background
- Existing asset inventory stores assets in MongoDB with: purchase cost, residual value, useful life, depreciation method, purchase date
- User wants a report format matching `CLFASC-fixed asset.xlsx` which shows quarterly depreciation by category
- Target: `/asset-inventory/reports` page with export capability

## UI/UX Specification

### Layout Structure
- **Route**: `/asset-inventory/reports`
- **Navigation**: Added via sidebar under Asset Inventory
- **Page sections**:
  1. Header with title and controls
  2. Year selector dropdown
  3. PPE Schedule table (grouped by category)
  4. Export button

### Visual Design
- Use existing UI components (Card, Table, Button, Select)
- Color scheme: Default shadcn/ui (neutral grays)
- Typography: Same as existing pages
- Spacing: Consistent with asset-inventory/page.tsx

### Components
1. **Year Selector**: Dropdown with years (current year - 2 to current year + 2)
2. **PPE Table**: Grouped by category, with subtotals per group
3. **Export Button**: Downloads Excel matching the template format
4. **Category Rows**: Group header + individual asset rows + subtotal row

### Responsive Breakpoints
- Desktop: Full table with all columns visible
- Tablet/Mobile: Horizontal scroll for table

## Functionality Specification

### Core Features

#### 1. Report Page (`/asset-inventory/reports`)
- Fetch all active assets from API
- Group by `AssetCategory.name`
- For each asset, calculate:
  - Monthly depreciation: `(purchaseCost - residualValue) / (usefulLife * 12)`
  - Quarterly accumulated depreciation for each quarter in selected year
  - Net book value per quarter end

#### 2. Quarterly Depreciation Calculation
For selected year Y (e.g., 2025):
- **Q1** (Jan-Mar): Accumulated depreciation as of March 31, Y
- **Q2** (Apr-Jun): Accumulated depreciation as of June 30, Y
- **Q3** (Jul-Sep): Accumulated depreciation as of Sept 30, Y
- **Q4** (Oct-Dec): Accumulated depreciation as of Dec 31, Y

Formula per quarter:
```
monthsFromPurchaseToQuarterEnd = min(purchaseDate to quarterEnd, usefulLifeMonths)
accumulatedDepreciation = monthlyDepreciation * monthsFromPurchaseToQuarterEnd
netBookValue = purchaseCost - accumulatedDepreciation (min to residualValue)
```

#### 3. Export to Excel
Generate Excel matching template columns:
| Column | Description |
|--------|-------------|
| QTY | asset.quantity |
| UNIT OF MEASURE | From category.unit or "PC" default |
| PARTICULARS/DESCRIPTION | asset.name |
| Date of Purchase | asset.purchaseDate (MM/DD/YYYY) |
| UNIT COST | asset.purchaseCost |
| VAT INPUT | asset.vatInput (0 if not set) |
| AMOUNT | UNIT COST + VAT INPUT |
| USEFUL LIFE | asset.usefulLife * 12 (months) |
| MONTHLY DEPRECIATION | Calculated |
| Q1-Q4 columns | Quarterly: Depreciation, Accumulated, Net Book Value |

#### 4. Subtotals
Per category group:
- Total Amount (sum of AMOUNT)
- Total Accumulated Depreciation (per quarter)
- Total Net Book Value (per quarter)

### Data Handling
- **API**: Use existing `/api/assets` endpoint (GET with no params returns all)
- **Filtering**: Only include assets with status = ACTIVE
- **Sorting**: By category, then by purchase date

### Edge Cases
- Assets with no category: Group as "UNCATEGORIZED"
- Assets fully depreciated: Show 0 monthly, full accumulated
- Future purchase dates: Skip depreciation calculation
- Zero useful life: Default to 60 months (5 years)

## Acceptance Criteria

1. **Page loads** at `/asset-inventory/reports` with year selector defaulted to current year
2. **Table displays** assets grouped by category with all columns
3. **Depreciation values** calculate correctly (match manual calculation)
4. **Export button** downloads Excel file with proper format
5. **Subtotals** show correctly per category
6. **Category "LAND"** shows no depreciation (useful life = 0 or special handling)

## Technical Notes
- Use existing `calculateDepreciation` from `@/lib/depreciation`
- Add `vatInput` field to Asset model if needed (optional)
- Reuse existing xlsx export pattern from asset-inventory/page.tsx
- Add route to layout.tsx navigation