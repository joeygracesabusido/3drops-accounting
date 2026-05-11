'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  eachDayOfInterval, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import { 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical,
  ChevronDown,
  Settings2,
  Plus,
  RefreshCcw,
  AlertCircle,
  Users,
  Loader2
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetDescription 
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  isOff: boolean;
}

interface Employee {
  id: string;
  fullName: string;
  position: string;
  department: string;
}

interface ShiftSchedule {
  id: string;
  employeeId: string;
  shiftId: string;
  date: string;
  shift: Shift;
}

export default function ShiftSchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [isShiftSheetOpen, setIsShiftSheetOpen] = useState(false);
  const [newShift, setNewShift] = useState({
    name: '',
    startTime: '',
    endTime: '',
    isOff: false,
    color: 'bg-blue-100 border-blue-500 text-blue-700'
  });

  // Calculate the 7 days to display
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
  const startDateStr = format(startDate, 'yyyy-MM-dd'); // stable string key for deps
  const weekDays = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 6),
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const startStr = startDateStr;
      const endStr = format(addDays(new Date(startDateStr), 6), 'yyyy-MM-dd');

      console.log(`[Fetch] Range: ${startStr} to ${endStr}`);

      const [shiftsRes, schedulesRes] = await Promise.all([
        fetch('/api/shifts', { credentials: 'include' }),
        fetch(`/api/schedules?startDate=${startStr}&endDate=${endStr}`, { credentials: 'include' })
      ]);

      const checkResponse = async (res: Response, name: string) => {
        if (!res.ok) {
          const text = await res.text().catch(() => 'No detail');
          throw new Error(`${name} failed (${res.status}): ${text.substring(0, 100)}`);
        }
        return res.json();
      };

      const shiftsData = await checkResponse(shiftsRes, 'Shifts');
      const scheduleDataJson = await checkResponse(schedulesRes, 'Schedules');

      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
      setEmployees(Array.isArray(scheduleDataJson.employees) ? scheduleDataJson.employees : []);
      setSchedules(Array.isArray(scheduleDataJson.schedules) ? scheduleDataJson.schedules : []);

      console.log(`[Fetch] Loaded ${scheduleDataJson.employees?.length || 0} employees`);
    } catch (err: unknown) {
      console.error('[Fetch] Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [startDateStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift),
      });

      const data = await response.json();

      if (response.ok) {
        setShifts(prev => [...prev, data]);
        setNewShift({ name: '', startTime: '', endTime: '', isOff: false, color: 'bg-blue-100 border-blue-500 text-blue-700' });
        toast({ title: "Success", description: "Shift created successfully" });
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to create shift" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateShift = async (employeeId: string, shiftId: string, date: Date) => {
    try {
      console.log(`[Update] Employee: ${employeeId}, Shift: ${shiftId}, Date: ${format(date, 'yyyy-MM-dd')}`);
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, shiftId, date: format(date, 'yyyy-MM-dd') }),
      });

      if (response.ok) {
        const updated = await response.json();
        setSchedules(prev => {
          const next = [...prev];
          const idx = next.findIndex(s => s.employeeId === employeeId && isSameDay(parseISO(s.date), date));
          if (idx >= 0) next[idx] = updated;
          else next.push(updated);
          return next;
        });
        toast({ title: "Updated", description: "Shift assigned successfully." });
      } else {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast({ variant: "destructive", title: "Update Failed", description: err.error });
      }
    } catch (error) {
      console.error('[Update] Error:', error);
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    }
  };

  const handleFillWeek = async (employeeId: string, shiftId: string) => {
    try {
      setLoading(true);
      const items = weekDays.map(day => ({ employeeId, shiftId, date: format(day, 'yyyy-MM-dd') }));
      console.log(`[Bulk] Filling week for employee ${employeeId} with shift ${shiftId}`);
      
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });

      if (response.ok) {
        const results = await response.json();
        setSchedules(prev => {
          const next = [...prev];
          results.forEach((updated: ShiftSchedule) => {
            const idx = next.findIndex(s => s.employeeId === employeeId && isSameDay(parseISO(s.date), parseISO(updated.date)));
            if (idx >= 0) next[idx] = updated;
            else next.push(updated);
          });
          return next;
        });
        toast({ title: "Success", description: "Employee&apos;s week filled successfully" });
      } else {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast({ variant: "destructive", title: "Action Failed", description: err.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fill week" });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async (shiftId: string) => {
    if (!employees.length) {
      toast({ variant: "destructive", title: "No Employees", description: "There are no active employees to assign shifts to." });
      return;
    }
    
    try {
      setLoading(true);
      const allItems = employees.flatMap(emp => 
        weekDays.map(day => ({
          employeeId: emp.id,
          shiftId,
          date: format(day, 'yyyy-MM-dd')
        }))
      );

      console.log(`[Bulk] Assigning shift ${shiftId} to ${employees.length} employees (Total items: ${allItems.length})`);

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allItems),
      });

      if (response.ok) {
        const results = await response.json();
        // Update local state with the new results
        setSchedules(prev => {
          const next = [...prev];
          results.forEach((updated: ShiftSchedule) => {
            const idx = next.findIndex(s => s.employeeId === updated.employeeId && isSameDay(parseISO(s.date), parseISO(updated.date)));
            if (idx >= 0) next[idx] = updated;
            else next.push(updated);
          });
          return next;
        });
        toast({ title: "Bulk Action Success", description: `Assigned shift to all ${employees.length} employees for the week.` });
      } else {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast({ variant: "destructive", title: "Bulk Action Failed", description: err.error });
      }
    } catch (error) {
      console.error('[Bulk] Error:', error);
      toast({ variant: "destructive", title: "Error", description: "Bulk assignment failed" });
    } finally {
      setLoading(false);
    }
  };

  const getShiftForEmployeeAndDate = (employeeId: string, date: Date) => {
    return schedules.find(s => s.employeeId === employeeId && isSameDay(parseISO(s.date), date));
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4 bg-white min-h-screen text-slate-900">
      <div className="flex flex-col gap-1">
        <div className="text-sm text-gray-500 flex items-center gap-1">
          Home <ChevronRight className="w-3 h-3" /> Shift Schedule
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Shift Schedule</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl shadow-sm flex items-start justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-bold text-sm">System Connection Issue</p>
              <p className="text-xs font-medium bg-red-100/50 px-2 py-1 rounded mt-1 border border-red-200 inline-block font-mono">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="bg-white hover:bg-red-50 text-red-700 border-red-200 gap-2 font-bold whitespace-nowrap">
            <RefreshCcw className="w-4 h-4" /> Retry Connection
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="w-10 h-10"><Filter className="w-4 h-4 text-gray-500" /></Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="gap-2 border-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                disabled={true}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Bulk Assign (Disabled)
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider border-b mb-1">Apply to ALL for this week</div>
              {shifts.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-gray-500 italic">No shifts created yet</div>
              ) : (
                shifts.map(shift => (
                  <DropdownMenuItem key={shift.id} onClick={() => handleBulkAssign(shift.id)} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
                    <span className="font-bold text-xs uppercase">{shift.name}</span>
                    <span className="text-[10px] text-gray-500">{shift.startTime} - {shift.endTime}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet open={isShiftSheetOpen} onOpenChange={setIsShiftSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="default" className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm transition-all active:scale-95">
                <Settings2 className="w-4 h-4" /> Manage Shifts
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto" onPointerDownOutside={e => e.preventDefault()} onFocusOutside={e => e.preventDefault()}>
              <SheetHeader className="border-b pb-6 mb-6">
                <SheetTitle className="text-2xl font-bold text-blue-600">Shift Management</SheetTitle>
                <SheetDescription>Create and manage shift types for your organization.</SheetDescription>
              </SheetHeader>
              <div className="space-y-8">
                <section>
                  <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4">Create New Shift</h3>
                  <form onSubmit={handleCreateShift} className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="space-y-2">
                      <Label>Shift Name</Label>
                      <Input placeholder="e.g. MORNING_SHIFT" className="bg-white" value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <input type="time" className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newShift.startTime} onChange={e => setNewShift({...newShift, startTime: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <input type="time" className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newShift.endTime} onChange={e => setNewShift({...newShift, endTime: e.target.value})} required />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 py-2">
                      <input type="checkbox" id="isOffS" className="w-5 h-5 rounded border-gray-300 text-blue-600" checked={newShift.isOff} onChange={e => setNewShift({...newShift, isOff: e.target.checked})} />
                      <Label htmlFor="isOffS" className="cursor-pointer">Mark as Rest Day / Off</Label>
                    </div>
                    <Button type="submit" className="w-full bg-blue-600" disabled={creating}>{creating ? "Creating..." : "Create Shift"}</Button>
                  </form>
                </section>
                <section>
                  <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4">Existing Shifts</h3>
                  <div className="space-y-3">
                    {shifts.map(shift => (
                      <div key={shift.id} className="flex justify-between items-center p-4 bg-white border rounded-xl shadow-sm hover:border-blue-200 transition-colors">
                        <div>
                          <p className="font-bold">{shift.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{shift.startTime} - {shift.endTime}</span>
                             {shift.isOff && <span className="text-[10px] font-bold text-pink-600 uppercase">Off Day</span>}
                          </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border-b-2 ${shift.color}`}>{shift.name.split('_')[0]}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium px-2">{format(startDate, 'MMM d')} - {format(addDays(startDate, 6), 'MMM d, yyyy')}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-4 text-left font-medium text-gray-600 border-r min-w-[280px]"><div className="flex items-center gap-1">Employees <ChevronDown className="w-4 h-4" /></div></th>
                {weekDays.map(day => (<th key={day.toString()} className="p-4 text-left font-medium text-gray-600 min-w-[180px]"><span className="text-sm">{format(day, 'EEE, d MMM yyyy')}</span></th>))}
              </tr>
            </thead>
            <tbody>
              {loading && schedules.length === 0 ? (
                <tr><td colSpan={8} className="p-20 text-center"><div className="flex flex-col items-center gap-3"><RefreshCcw className="w-8 h-8 animate-spin text-blue-600" /><p className="text-gray-500 font-medium">Loading employee schedules...</p></div></td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8} className="p-20 text-center text-gray-500"><div className="max-w-xs mx-auto space-y-2"><p className="font-bold text-gray-900">No Employees Found</p><p className="text-sm">We couldn&apos;t find any active employees. Please check the Employees page.</p><Button variant="outline" size="sm" onClick={fetchData} className="mt-4">Refresh List</Button></div></td></tr>
              ) : (
                employees.map(employee => (
                  <tr key={employee.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 border-r">
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border bg-gray-50"><AvatarFallback className="text-xs font-bold">{getInitials(employee.fullName)}</AvatarFallback></Avatar>
                          <div><p className="font-bold text-gray-900 text-sm">{employee.fullName}</p><p className="text-[11px] text-gray-500 uppercase font-medium">{employee.position} • {employee.department}</p></div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56"><DropdownMenuSub><DropdownMenuSubTrigger className="text-xs font-medium">Fill Week with...</DropdownMenuSubTrigger><DropdownMenuPortal><DropdownMenuSubContent className="w-56">{shifts.map(shift => (<DropdownMenuItem key={shift.id} onClick={() => handleFillWeek(employee.id, shift.id)} className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer"><span className="font-bold text-[11px] uppercase">{shift.name}</span><span className="text-[10px] text-gray-500">{shift.startTime} - {shift.endTime}</span></DropdownMenuItem>))}</DropdownMenuSubContent></DropdownMenuPortal></DropdownMenuSub></DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                    {weekDays.map(day => {
                      const sch = getShiftForEmployeeAndDate(employee.id, day);
                      return (
                        <td key={day.toString()} className="p-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`w-full text-left p-2.5 rounded-lg border-b-4 transition-all hover:brightness-95 ${sch?.shift?.color || 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-[11px] font-bold uppercase tracking-tight">{sch?.shift?.name || 'No Shift'}</span><span className="text-[10px] opacity-80 font-medium">{sch?.shift?.startTime && sch?.shift?.endTime ? `${sch.shift.startTime} - ${sch.shift.endTime}` : '-'}</span></div><ChevronDown className="w-3 h-3 opacity-40" /></div>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">{shifts.map(shift => (<DropdownMenuItem key={shift.id} onClick={() => handleUpdateShift(employee.id, shift.id, day)} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"><span className="font-bold text-xs uppercase">{shift.name}</span><span className="text-[10px] text-gray-500">{shift.startTime} - {shift.endTime}</span></DropdownMenuItem>))}</DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-4 text-sm text-gray-500 border-t mt-4">
        <div>Showing {employees.length} Employees</div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 border-blue-200 font-bold">1</Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setCurrentDate(addDays(currentDate, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}
