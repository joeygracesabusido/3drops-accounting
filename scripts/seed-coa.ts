import prisma from '@/lib/prisma'
import type { AccountType } from '@prisma/client'

interface AccountData {
  code: string
  name: string
  type: AccountType
  normalBalance: 'DEBIT' | 'CREDIT'
  parentCode?: string
  description: string
  hasSubsidiaryLedger?: boolean
  subsidiaryType?: 'CUSTOMER' | 'SUPPLIER' | 'INVENTORY_ITEM' | 'ASSET' | 'EMPLOYEE'
}

const accounts: AccountData[] = [
  // ==================== ASSETS (1000-1999) ====================
  // Current Assets
  { code: '1000', name: 'Current Assets', type: 'ASSET', normalBalance: 'DEBIT', description: 'Current Assets heading' },
  { code: '1100', name: 'Cash and Cash Equivalents', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Cash on hand and in banks' },
  { code: '1110', name: 'Cash on Hand', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100', description: 'Petty cash and cash in register' },
  { code: '1120', name: 'Cash in Bank', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100', description: 'Bank accounts (checking, savings)' },
  { code: '1130', name: 'Payroll Checking', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100', description: 'Separate account for payroll disbursements' },
  
  // CONTROL ACCOUNT with Subsidiary Ledger: CUSTOMER
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Amounts owed by customers', hasSubsidiaryLedger: true, subsidiaryType: 'CUSTOMER' },
  { code: '1210', name: 'Customers Receivable', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1200', description: 'Trade accounts receivable - subsidiary details' },
  
  // CONTROL ACCOUNT with Subsidiary Ledger: EMPLOYEE
  { code: '1220', name: 'Employees Receivable', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Employee loans and advances', hasSubsidiaryLedger: true, subsidiaryType: 'EMPLOYEE' },
  
  // CONTROL ACCOUNT with Subsidiary Ledger: INVENTORY_ITEM
  { code: '1300', name: 'Inventory', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Merchandise and raw materials', hasSubsidiaryLedger: true, subsidiaryType: 'INVENTORY_ITEM' },
  { code: '1310', name: 'Merchandise Inventory', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1300', description: 'Finished goods for sale' },
  { code: '1320', name: 'Raw Materials', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1300', description: 'Raw materials for production' },
  { code: '1330', name: 'Work in Progress', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1300', description: 'Goods in production' },
  
  { code: '1400', name: 'Prepaid Expenses', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Expenses paid in advance' },
  { code: '1410', name: 'Prepaid Insurance', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1400', description: 'Insurance premiums paid in advance' },
  { code: '1420', name: 'Prepaid Rent', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1400', description: 'Rent paid in advance' },
  { code: '1430', name: 'Prepaid Supplies', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1400', description: 'Office supplies prepaid' },
  
  { code: '1500', name: 'Tax Receivable', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Tax refunds receivable' },
  { code: '1510', name: 'VAT Receivable', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500', description: 'Value Added Tax receivable from BIR' },
  
  // Fixed Assets
  // CONTROL ACCOUNT with Subsidiary Ledger: ASSET
  { code: '1600', name: 'Fixed Assets', type: 'ASSET', normalBalance: 'DEBIT', description: 'Fixed Assets heading', hasSubsidiaryLedger: true, subsidiaryType: 'ASSET' },
  { code: '1610', name: 'Land', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1600', description: 'Land and improvements' },
  { code: '1620', name: 'Buildings', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1600', description: 'Office and warehouse buildings' },
  { code: '1630', name: 'Furniture and Fixtures', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1600', description: 'Office furniture and fixtures' },
  { code: '1640', name: 'Equipment', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1600', description: 'Office and production equipment' },
  { code: '1650', name: 'Motor Vehicles', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1600', description: 'Company vehicles' },
  { code: '1660', name: 'Computer Equipment', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1600', description: 'Computers and peripherals' },
  { code: '1670', name: 'Accumulated Depreciation - Buildings', type: 'ASSET', normalBalance: 'CREDIT', parentCode: '1600', description: 'Contra-asset for buildings depreciation' },
  { code: '1680', name: 'Accumulated Depreciation - Equipment', type: 'ASSET', normalBalance: 'CREDIT', parentCode: '1600', description: 'Contra-asset for equipment depreciation' },
  { code: '1690', name: 'Accumulated Depreciation - Vehicles', type: 'ASSET', normalBalance: 'CREDIT', parentCode: '1600', description: 'Contra-asset for vehicles depreciation' },
  
  // Deferred Charges
  { code: '1700', name: 'Deferred Charges', type: 'ASSET', normalBalance: 'DEBIT', description: 'Long-term prepaid expenses' },
  { code: '1710', name: 'Organization Costs', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1700', description: 'Startup and incorporation costs' },
  { code: '1720', name: 'Trademark and Patents', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1700', description: 'Intangible assets' },

  // ==================== LIABILITIES (2000-2999) ====================
  // Current Liabilities
  { code: '2000', name: 'Current Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT', description: 'Current Liabilities heading' },
  
  // CONTROL ACCOUNT with Subsidiary Ledger: SUPPLIER
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Amounts owed to suppliers', hasSubsidiaryLedger: true, subsidiaryType: 'SUPPLIER' },
  { code: '2110', name: 'Trade Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2100', description: 'Suppliers and vendors payable - subsidiary details' },
  { code: '2120', name: 'Accrued Expenses', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Expenses incurred but not paid' },
  { code: '2130', name: 'Salaries and Wages Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2120', description: 'Employee salaries and wages due' },
  { code: '2140', name: 'Accrued Interest', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2120', description: 'Interest accrued on loans' },
  
  // Payroll Liabilities (Philippine specific)
  { code: '2200', name: 'Payroll Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Payroll withholdings and remittances' },
  { code: '2210', name: 'SSS Employee Withholding', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Social Security System - Employee share' },
  { code: '2220', name: 'SSS Employer Withholding', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Social Security System - Employer share' },
  { code: '2230', name: 'PhilHealth Employee Withholding', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Philippine Health Insurance - Employee share' },
  { code: '2240', name: 'PhilHealth Employer Withholding', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Philippine Health Insurance - Employer share' },
  { code: '2250', name: 'Pag-IBIG Employee Withholding', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Home Development Mutual Fund - Employee share' },
  { code: '2260', name: 'Pag-IBIG Employer Withholding', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Home Development Mutual Fund - Employer share' },
  { code: '2270', name: 'Withholding Tax on Compensation', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Employee income tax withholding' },
  { code: '2280', name: 'Withholding Tax on Third Party', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2200', description: 'Withholding tax on payments to contractors' },
  
  // Tax Liabilities
  { code: '2300', name: 'Tax Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Taxes payable to government' },
  { code: '2310', name: 'VAT Output Tax', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2300', description: 'Value Added Tax on sales' },
  { code: '2320', name: 'VAT Input Tax', type: 'LIABILITY', normalBalance: 'DEBIT', parentCode: '2300', description: 'Value Added Tax on purchases (deductible)' },
  { code: '2330', name: 'Percentage Tax Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2300', description: 'Percentage tax for non-VAT registered' },
  { code: '2340', name: 'Expanded Withholding Tax', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2300', description: 'Creditable withholding tax' },
  { code: '2350', name: 'Amortized Withholding Tax', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2300', description: 'Amortized creditable withholding tax' },
  { code: '2360', name: 'Local Business Tax', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2300', description: 'Mayor\'s permit and local taxes' },
  
  // Other Current Liabilities
  { code: '2400', name: 'Notes Payable (Short-term)', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Promissory notes due within one year' },
  { code: '2410', name: 'Bank Loans Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2400', description: 'Short-term bank loans' },
  { code: '2420', name: 'Credit Card Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Credit card balances' },
  { code: '2430', name: 'Dividends Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Dividends declared but not paid' },
  { code: '2440', name: 'Unearned Revenue', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Advance payments from customers' },
  
  // Long-term Liabilities
  { code: '2500', name: 'Long-term Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT', description: 'Long-term Liabilities heading' },
  { code: '2510', name: 'Notes Payable (Long-term)', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2500', description: 'Promissory notes due after one year' },
  { code: '2520', name: 'Mortgage Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2500', description: 'Mortgage loans on real estate' },
  { code: '2530', name: 'Bonds Payable', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2500', description: 'Corporate bonds issued' },
  { code: '2540', name: 'Deferred Tax Liability', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2500', description: 'Future tax obligations' },
  { code: '2550', name: 'Employee Benefit Obligation', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2500', description: 'Retirement and benefit obligations' },

  // ==================== EQUITY (3000-3999) ====================
  { code: '3000', name: "Owner's Equity", type: 'EQUITY', normalBalance: 'CREDIT', description: "Owner's Equity heading" },
  { code: '3100', name: 'Capital Stock', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000', description: 'Common stock issued' },
  { code: '3110', name: 'Common Stock', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3100', description: 'Common shares' },
  { code: '3120', name: 'Preferred Stock', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3100', description: 'Preferred shares' },
  { code: '3200', name: 'Additional Paid-in Capital', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000', description: 'Capital in excess of par value' },
  { code: '3300', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000', description: 'Accumulated profits not distributed' },
  { code: '3310', name: 'Current Year Earnings', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3300', description: 'Net income for current year' },
  { code: '3320', name: 'Prior Years Earnings', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3300', description: 'Accumulated retained earnings' },
  { code: '3400', name: 'Treasury Stock', type: 'EQUITY', normalBalance: 'DEBIT', parentCode: '3000', description: 'Company stock repurchased (contra-equity)' },
  { code: '3500', name: 'Owner\'s Drawing', type: 'EQUITY', normalBalance: 'DEBIT', parentCode: '3000', description: 'Owner withdrawals (contra-equity)' },

  // ==================== REVENUE (4000-4999) ====================
  { code: '4000', name: 'Income', type: 'REVENUE', normalBalance: 'CREDIT', description: 'Income heading' },
  { code: '4100', name: 'Sales', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Revenue from operations' },
  { code: '4110', name: 'Sales of Merchandise', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4100', description: 'Product sales' },
  { code: '4120', name: 'Service Income', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4100', description: 'Service revenue' },
  { code: '4130', name: 'Sales Returns and Allowances', type: 'REVENUE', normalBalance: 'DEBIT', parentCode: '4100', description: 'Returns and discounts given (contra-revenue)' },
  { code: '4200', name: 'Other Income', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Non-operating income' },
  { code: '4210', name: 'Interest Income', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4200', description: 'Interest earned on deposits' },
  { code: '4220', name: 'Dividend Income', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4200', description: 'Dividends from investments' },
  { code: '4230', name: 'Rental Income', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4200', description: 'Income from leased properties' },
  { code: '4240', name: 'Gain on Sale of Assets', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4200', description: 'Profit from asset disposals' },
  { code: '4250', name: 'Miscellaneous Income', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4200', description: 'Other incidental income' },

  // ==================== EXPENSES (5000-5999) ====================
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', normalBalance: 'DEBIT', description: 'Direct costs of products sold' },
  { code: '5100', name: 'Direct Materials', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5000', description: 'Raw materials used in production' },
  { code: '5110', name: 'Direct Labor', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5000', description: 'Wages of production workers' },
  { code: '5120', name: 'Factory Overhead', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5000', description: 'Manufacturing overhead costs' },
  { code: '5130', name: 'Inventory Adjustment', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5000', description: 'Inventory shrinkage and adjustments' },

  { code: '5200', name: 'Operating Expenses', type: 'EXPENSE', normalBalance: 'DEBIT', description: 'Operating Expenses heading' },
  
  // Personnel Expenses
  { code: '5210', name: 'Personnel Services', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Salaries and wages of office staff' },
  { code: '5211', name: 'Salaries and Wages', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5210', description: 'Employee compensation' },
  { code: '5212', name: 'Overtime Pay', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5210', description: 'Overtime compensation' },
  { code: '5213', name: '13th Month Pay', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5210', description: 'Mandatory 13th month pay' },
  { code: '5214', name: 'Holiday Pay', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5210', description: 'Holiday pay and premiums' },
  { code: '5215', name: 'Night Differential', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5210', description: 'Night shift differential pay' },
  
  // Government Contributions (Employer Share)
  { code: '5220', name: 'Government Contributions', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Statutory employer contributions' },
  { code: '5221', name: 'SSS Employer Share', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5220', description: 'Employer contribution to SSS' },
  { code: '5222', name: 'PhilHealth Employer Share', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5220', description: 'Employer contribution to PhilHealth' },
  { code: '5223', name: 'Pag-IBIG Employer Share', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5220', description: 'Employer contribution to Pag-IBIG' },
  { code: '5224', name: 'Withholding Tax Expense', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5220', description: 'Employer withholding tax expense' },
  
  // Employee Benefits
  { code: '5230', name: 'Employee Benefits', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Benefits and allowances' },
  { code: '5231', name: 'Cash Bonuses', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5230', description: 'Performance and profit sharing bonuses' },
  { code: '5232', name: 'Allowances', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5230', description: 'Transportation and meal allowances' },
  { code: '5233', name: 'Leave Credits', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5230', description: 'Unused leave encashment' },
  { code: '5234', name: 'Separation Pay', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5230', description: 'Retirement and separation benefits' },
  
  // Professional Services
  { code: '5240', name: 'Professional Services', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'External professional fees' },
  { code: '5241', name: 'Legal and Accounting Fees', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5240', description: 'Lawyer and CPA fees' },
  { code: '5242', name: 'Consulting Fees', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5240', description: 'Management and technical consulting' },
  { code: '5243', name: 'Audit Fees', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5240', description: 'External audit fees' },
  
  // Occupancy Expenses
  { code: '5250', name: 'Occupancy Expenses', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Facility-related costs' },
  { code: '5251', name: 'Rent Expense', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5250', description: 'Office and warehouse rent' },
  { code: '5252', name: 'Property Tax', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5250', description: 'Real property taxes' },
  { code: '5253', name: 'Building Maintenance', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5250', description: 'Repairs and maintenance' },
  { code: '5254', name: 'Security Services', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5250', description: 'Security guard services' },
  
  // Utilities
  { code: '5260', name: 'Utilities', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Utility expenses' },
  { code: '5261', name: 'Electricity', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5260', description: 'Electric power consumption' },
  { code: '5262', name: 'Water', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5260', description: 'Water consumption' },
  { code: '5263', name: 'Telephone', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5260', description: 'Landline and mobile phone' },
  { code: '5264', name: 'Internet', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5260', description: 'Internet connectivity' },
  
  // Office Expenses
  { code: '5270', name: 'Office Expenses', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Office supplies and materials' },
  { code: '5271', name: 'Office Supplies', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5270', description: 'Paper, pens, and consumables' },
  { code: '5272', name: 'Printing and Binding', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5270', description: 'Document printing and copying' },
  { code: '5273', name: 'Postage and Delivery', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5270', description: 'Courier and postal services' },
  { code: '5274', name: 'Subscription', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5270', description: 'Magazines and software subscriptions' },
  
  // Advertising and Promotion
  { code: '5280', name: 'Advertising and Promotion', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Marketing expenses' },
  { code: '5281', name: 'Advertising', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5280', description: 'Print and online advertising' },
  { code: '5282', name: 'Promotional Materials', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5280', description: 'Brochures and promotional items' },
  { code: '5283', name: 'Website and Social Media', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5280', description: 'Digital marketing costs' },
  
  // Transportation and Travel
  { code: '5290', name: 'Transportation and Travel', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Travel and vehicle expenses' },
  { code: '5291', name: 'Gasoline and Oil', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5290', description: 'Fuel for company vehicles' },
  { code: '5292', name: 'Tolls and Parking', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5290', description: 'Toll fees and parking' },
  { code: '5293', name: 'Vehicle Repairs', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5290', description: 'Vehicle maintenance' },
  { code: '5294', name: 'Travel Expenses', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5290', description: 'Business travel and lodging' },
  { code: '5295', name: 'Transportation', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5290', description: 'Public transportation and delivery' },
  
  // Meals and Entertainment
  { code: '5300', name: 'Meals and Entertainment', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Food and entertainment' },
  { code: '5301', name: 'Meals', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5300', description: 'Employee meals and client dining' },
  { code: '5302', name: 'Entertainment', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5300', description: 'Client entertainment' },
  { code: '5303', name: 'Representation', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5300', description: 'Business representation expenses' },
  
  // Bank and Finance Charges
  { code: '5310', name: 'Bank and Finance Charges', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Banking costs' },
  { code: '5311', name: 'Bank Service Charges', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5310', description: 'Bank fees and charges' },
  { code: '5312', name: 'Interest Expense', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5310', description: 'Interest on loans' },
  
  // Insurance
  { code: '5320', name: 'Insurance', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Insurance premiums' },
  { code: '5321', name: 'Fire and Casualty Insurance', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5320', description: 'Property insurance' },
  { code: '5322', name: 'Employee Insurance', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5320', description: 'Group insurance for employees' },
  
  // Depreciation
  { code: '5330', name: 'Depreciation Expense', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Asset depreciation' },
  { code: '5331', name: 'Depreciation - Buildings', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5330', description: 'Building depreciation' },
  { code: '5332', name: 'Depreciation - Equipment', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5330', description: 'Equipment depreciation' },
  { code: '5333', name: 'Depreciation - Vehicles', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5330', description: 'Vehicle depreciation' },
  { code: '5334', name: 'Depreciation - Computer Equipment', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5330', description: 'Computer depreciation' },
  
  // Taxes and Licenses
  { code: '5340', name: 'Taxes and Licenses', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Business taxes and permits' },
  { code: '5341', name: 'Local Business Tax', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5340', description: 'Annual business permit fees' },
  { code: '5342', name: 'Professional Tax', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5340', description: 'Professional regulatory fees' },
  { code: '5343', name: 'Documentary Stamp Tax', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5340', description: 'DST on documents' },
  
  // Other Expenses
  { code: '5350', name: 'Other Expenses', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5200', description: 'Miscellaneous operating expenses' },
  { code: '5351', name: 'Bad Debts Expense', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5350', description: 'Uncollectible accounts' },
  { code: '5352', name: 'Loss on Sale of Assets', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5350', description: 'Loss from asset disposals' },
  { code: '5353', name: 'Donations and Contributions', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5350', description: 'Charitable donations' },
  { code: '5354', name: 'Miscellaneous Expense', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5350', description: 'Other incidental expenses' },

  // Non-Operating Expenses
  { code: '5400', name: 'Non-Operating Expenses', type: 'EXPENSE', normalBalance: 'DEBIT', description: 'Non-operating expenses heading' },
  { code: '5410', name: 'Interest Expense (Non-Operating)', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5400', description: 'Interest on long-term debt' },
];

async function main() {
  console.log('Starting Chart of Accounts seeding...');
  
  let count = 0;
  
  for (const acc of accounts) {
    try {
      await prisma.account.upsert({
        where: { code: acc.code },
        update: {
          name: acc.name,
          type: acc.type,
          normalBalance: acc.normalBalance,
          parentCode: acc.parentCode,
          description: acc.description,
          hasSubsidiaryLedger: acc.hasSubsidiaryLedger,
          subsidiaryType: acc.subsidiaryType,
        },
        create: {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          normalBalance: acc.normalBalance,
          parentCode: acc.parentCode,
          description: acc.description,
          hasSubsidiaryLedger: acc.hasSubsidiaryLedger || false,
          subsidiaryType: acc.subsidiaryType,
        },
      });
      count++;
      process.stdout.write(`\rInserted ${count}/${accounts.length} accounts...`);
    } catch (error) {
      console.error(`\nError inserting account ${acc.code}:`, error);
    }
  }
  
  console.log(`\n\nSuccessfully seeded ${count} accounts!`);
  console.log('\nControl Accounts with Subsidiary Ledgers:');
  console.log('- 1200: Accounts Receivable (Customer Ledger)');
  console.log('- 1220: Employees Receivable (Employee Ledger)');
  console.log('- 1300: Inventory (Inventory Item Ledger)');
  console.log('- 1600: Fixed Assets (Asset Ledger)');
  console.log('- 2100: Accounts Payable (Supplier Ledger)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
