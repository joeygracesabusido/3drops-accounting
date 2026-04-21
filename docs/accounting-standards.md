# GAAP & Accounting Standards Reference (QuickBooks/Xero Alignment)

This document provides the accounting standards used in this system to ensure that financial records—specifically Asset Management and Depreciation—align with Generally Accepted Accounting Principles (GAAP) and the logic used by software like QuickBooks and Xero.

## 1. Fixed Asset Management
Assets are recorded as **Capital Expenditures (CapEx)** rather than operating expenses when they provide value over multiple years.

### Asset Lifecycle
- **Acquisition:** Recorded at historical cost (Purchase price + delivery + installation + setup).
- **Depreciation:** The process of allocating the cost of a tangible asset over its useful life.
- **Disposal:** Removing the asset from the books and calculating the Gain or Loss on Disposal.
  - `Gain/Loss = Proceeds from Sale - Net Book Value`

## 2. Depreciation Methods
The system implements the following standard GAAP methods:

### Straight-Line Depreciation (SLD)
The most common method. The value of the asset is reduced by the same amount every year.
- **Formula:** `(Cost - Residual Value) / Useful Life`
- **Usage:** Best for assets where the utility is consumed evenly over time (e.g., office furniture).

### Declining Balance (Accelerated Depreciation)
The asset depreciates more rapidly in the early years of its life.
- **Formula:** `Current Book Value * Depreciation Rate`
- **Usage:** Best for assets that lose value quickly or have high early-year utility (e.g., computers, vehicles).

### Key Terms
- **Historical Cost:** The original purchase price of the asset.
- **Residual Value (Salvage Value):** The estimated value of the asset at the end of its useful life.
- **Net Book Value (NBV):** The current value of the asset on the balance sheet.
  - `NBV = Historical Cost - Accumulated Depreciation`
- **Accumulated Depreciation:** The total amount of depreciation taken on the asset since it was acquired.

## 3. Transaction Categorization
All asset-related movements must be recorded as transactions for audit trails (similar to the "Journal" in QuickBooks/Xero):
- **Acquisition:** Increase in Asset account, Decrease in Cash/Increase in Liability.
- **Depreciation Entry:** Increase in Depreciation Expense, Increase in Accumulated Depreciation (Contra-Asset account).
- **Maintenance:** Recorded as an Operating Expense (OpEx) unless it significantly extends the asset's useful life (then it's capitalized).
- **Disposal:** Remove Asset and Accumulated Depreciation; record Cash received and Gain/Loss.

## 4. Audit Trail & Integrity
- **Immutable Logs:** Transactions cannot be deleted; they must be reversed with a correcting entry to maintain a professional audit trail.
- **Consistency:** Once a depreciation method is chosen for an asset, it must be applied consistently throughout the asset's life.

---
*Note: This reference ensures that the Asset Inventory module produces reports compatible with professional accounting software.*
