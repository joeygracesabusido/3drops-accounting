'use client';

import { useBranch } from '@/lib/branch-context';
import { Building } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function BranchSelector({ showAllOption = true }: { showAllOption?: boolean }) {
  const { selectedBranch, branches, setBranch } = useBranch();

  const handleChange = (value: string) => {
    if (value === '__all__') {
      setBranch(null);
    } else {
      const branch = branches.find((b) => b.id === value);
      if (branch) setBranch(branch);
    }
  };

  const displayValue = selectedBranch?.id || '__all__';
  const displayLabel = selectedBranch ? selectedBranch.name : 'All Branches';

  return (
    <Select value={displayValue} onValueChange={handleChange}>
      <SelectTrigger className="w-[220px]">
        <Building className="h-4 w-4 mr-2" />
        <SelectValue>{displayLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (
          <SelectItem value="__all__">All Branches</SelectItem>
        )}
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
        {branches.length === 0 && (
          <SelectItem value="__empty__" disabled>
            No branches available
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
