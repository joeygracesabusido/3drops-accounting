import { differenceInMonths, differenceInYears } from "date-fns";

export enum DepreciationMethod {
  STRAIGHT_LINE = "STRAIGHT_LINE",
  DECLINING_BALANCE = "DECLINING_BALANCE",
  NONE = "NONE",
}

export interface DepreciationParams {
  purchaseCost: number;
  residualValue: number;
  usefulLife: number; // In years
  purchaseDate: Date;
  method: string;
  asOfDate?: Date;
}

/**
 * Calculates the current Net Book Value (NBV) and Accumulated Depreciation 
 * based on IAS 16 / Fixed Asset standards.
 */
export function calculateDepreciation({
  purchaseCost,
  residualValue,
  usefulLife,
  purchaseDate,
  method,
  asOfDate = new Date(),
}: DepreciationParams) {
  if (usefulLife <= 0 || method === DepreciationMethod.NONE) {
    return {
      accumulatedDepreciation: 0,
      netBookValue: purchaseCost,
    };
  }

  const depreciableAmount = purchaseCost - residualValue;
  const monthsElapsed = differenceInMonths(asOfDate, purchaseDate);
  const yearsElapsedFraction = Math.max(0, monthsElapsed / 12);

  // Determine if asset is fully depreciated based on useful life
  if (yearsElapsedFraction >= usefulLife) {
    return {
      accumulatedDepreciation: depreciableAmount,
      netBookValue: residualValue,
    };
  }

  let accumulatedDepreciation = 0;

  switch (method) {
    case DepreciationMethod.STRAIGHT_LINE: {
      // Annual depreciation = Depreciable Amount / Useful Life
      const annualDepreciation = depreciableAmount / usefulLife;
      accumulatedDepreciation = annualDepreciation * yearsElapsedFraction;
      break;
    }
    case DepreciationMethod.DECLINING_BALANCE: {
      // Typically 2x Straight Line Rate
      const straightLineRate = 1 / usefulLife;
      const decliningRate = straightLineRate * 2;
      
      let nbv = purchaseCost;
      const fullYears = Math.floor(yearsElapsedFraction);
      const remainingFraction = yearsElapsedFraction - fullYears;
      
      // Calculate year by year
      for (let i = 0; i < fullYears; i++) {
        const depreciationExpense = nbv * decliningRate;
        nbv -= depreciationExpense;
      }
      
      // Calculate fraction of current year
      if (remainingFraction > 0) {
        const depreciationExpense = nbv * decliningRate * remainingFraction;
        nbv -= depreciationExpense;
      }
      
      accumulatedDepreciation = purchaseCost - nbv;
      
      // Ensure NBV doesn't fall below residual value
      if (nbv < residualValue) {
        accumulatedDepreciation = purchaseCost - residualValue;
      }
      break;
    }
    default:
      return {
        accumulatedDepreciation: 0,
        netBookValue: purchaseCost,
      };
  }

  const netBookValue = Math.max(
    residualValue,
    purchaseCost - accumulatedDepreciation
  );

  return {
    accumulatedDepreciation: Number(accumulatedDepreciation.toFixed(2)),
    netBookValue: Number(netBookValue.toFixed(2)),
    monthsElapsed: Math.max(0, differenceInMonths(asOfDate, purchaseDate)),
  };
}
