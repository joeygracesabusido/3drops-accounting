'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive: boolean;
}

interface BranchContextValue {
  selectedBranch: Branch | null;
  branches: Branch[];
  loading: boolean;
  setBranch: (branch: Branch | null) => void;
  refreshBranches: () => Promise<Branch[]>;
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranch: null,
  branches: [],
  loading: true,
  setBranch: () => {},
  refreshBranches: async () => [],
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/branches');
      const data = await res.json() as Branch[];
      setBranches(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const data = await refreshBranches();

      const cookies = document.cookie.split(';').reduce((acc, c) => {
        const [key, val] = c.trim().split('=');
        acc[key] = val;
        return acc;
      }, {} as Record<string, string>);

      const savedId = cookies['activeBranchId'];
      if (savedId && Array.isArray(data)) {
        const saved = data.find((b: Branch) => b.id === savedId);
        if (saved) setSelectedBranch(saved);
      }
      setLoading(false);
    }
    init();
  }, [refreshBranches]);

  const setBranch = useCallback((branch: Branch | null) => {
    setSelectedBranch(branch);
    if (branch) {
      document.cookie = `activeBranchId=${branch.id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    } else {
      document.cookie = 'activeBranchId=; path=/; max-age=0';
    }
  }, []);

  return (
    <BranchContext.Provider value={{ selectedBranch, branches, loading, setBranch, refreshBranches }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
