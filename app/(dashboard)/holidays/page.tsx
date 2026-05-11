'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Plus, Trash2, Edit2, Check, X, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface Holiday {
  id: string
  name: string
  date: string
  year: number
  type: 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK'
  branchId: string | null
  isActive: boolean
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [mounted, setMounted] = useState(false)
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    type: 'REGULAR' as 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK',
    isActive: true,
  })

  useEffect(() => {
    setMounted(true)
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    setUserRole(cookies.userRole || '')
  }, [])

  const fetchHolidays = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterYear !== 'all') params.append('year', filterYear)
      if (filterType !== 'all') params.append('type', filterType)

      const res = await fetch(`/api/holidays?${params}`)
      if (res.ok) {
        const data = await res.json()
        setHolidays(data)
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
    } finally {
      setLoading(false)
    }
  }, [filterYear, filterType]);

  useEffect(() => {
    if (mounted) {
      fetchHolidays()
    }
  }, [mounted, fetchHolidays]);

  const handleCreateHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      alert('Please fill in all fields')
      return
    }

    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHoliday),
      })

      if (res.ok) {
        alert('Holiday created successfully')
        setNewHoliday({ name: '', date: '', type: 'REGULAR', isActive: true })
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create holiday')
      }
    } catch (error) {
      console.error('Error creating holiday:', error)
      alert('Failed to create holiday')
    }
  }

  const handleUpdateHoliday = async (id: string) => {
    try {
      const res = await fetch('/api/holidays', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...newHoliday }),
      })

      if (res.ok) {
        alert('Holiday updated successfully')
        setEditingId(null)
        setNewHoliday({ name: '', date: '', type: 'REGULAR', isActive: true })
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to update holiday')
      }
    } catch (error) {
      console.error('Error updating holiday:', error)
      alert('Failed to update holiday')
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/holidays', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      })

      if (res.ok) {
        fetchHolidays()
      }
    } catch (error) {
      console.error('Error toggling holiday:', error)
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return

    try {
      const res = await fetch(`/api/holidays?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        alert('Holiday deleted successfully')
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete holiday')
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      alert('Failed to delete holiday')
    }
  }

  const handleImportHolidays = async () => {
    if (!confirm('Import official Philippine holidays? Existing holidays will be kept.')) return

    try {
      const res = await fetch('/api/holidays/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        const data = await res.json()
        alert(data.message)
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to import holidays')
      }
    } catch (error) {
      console.error('Error importing holidays:', error)
      alert('Failed to import holidays')
    }
  }

  const handleEditClick = (holiday: Holiday) => {
    setEditingId(holiday.id)
    setNewHoliday({
      name: holiday.name,
      date: holiday.date.split('T')[0],
      type: holiday.type,
      isActive: holiday.isActive,
    })
  }

  if (!mounted) return null

  const canEdit = userRole === 'ADMIN' || userRole === 'HR'

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'REGULAR': return 'bg-red-100 text-red-700'
      case 'SPECIAL': return 'bg-yellow-100 text-yellow-700'
      case 'SPECIAL_NON_WORK': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Holidays</h1>
        <p className="text-gray-500">Manage company holidays</p>
      </div>

      {!canEdit ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Access Denied</p>
              <p className="text-sm">Only Admin and HR users can manage holidays</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Add New Holiday</CardTitle>
                  <CardDescription>Create a new company holiday</CardDescription>
                </div>
                <Button onClick={handleImportHolidays} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Import PH Holidays
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Holiday Name</Label>
                  <Input
                    id="name"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., New Year&apos;s Day"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newHoliday.type}
                    onValueChange={(value: 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK') => setNewHoliday(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR">Regular Holiday</SelectItem>
                      <SelectItem value="SPECIAL">Special Holiday</SelectItem>
                      <SelectItem value="SPECIAL_NON_WORK">Special Non-Working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreateHoliday} className="gap-2 w-full">
                    <Plus className="w-4 h-4" />
                    Add Holiday
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Holiday List</CardTitle>
                  <CardDescription>View and manage existing holidays</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="REGULAR">Regular</SelectItem>
                      <SelectItem value="SPECIAL">Special</SelectItem>
                      <SelectItem value="SPECIAL_NON_WORK">Special Non-Working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : holidays.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No holidays found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {holidays.map((holiday) => (
                    <div key={holiday.id} className="border rounded-lg p-4">
                      {editingId === holiday.id ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <Input
                              value={newHoliday.name}
                              onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Name"
                            />
                            <Input
                              type="date"
                              value={newHoliday.date}
                              onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                            />
                            <Select
                              value={newHoliday.type}
                              onValueChange={(value: 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK') => setNewHoliday(prev => ({ ...prev, type: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="REGULAR">Regular</SelectItem>
                                <SelectItem value="SPECIAL">Special</SelectItem>
                                <SelectItem value="SPECIAL_NON_WORK">Special Non-Working</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleUpdateHoliday(holiday.id)} size="sm" className="gap-2">
                              <Check className="w-4 h-4" />
                              Save
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingId(null)
                                setNewHoliday({ name: '', date: '', type: 'REGULAR', isActive: true })
                              }}
                              variant="outline"
                              size="sm"
                              className="gap-2"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{holiday.name}</p>
                                <p className="text-sm text-gray-500">
                                  {new Date(holiday.date).toLocaleDateString('en-PH', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeBadgeClass(holiday.type)}`}>
                                {holiday.type === 'REGULAR' ? 'Regular' : holiday.type === 'SPECIAL' ? 'Special' : 'Special Non-Working'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Active:</span>
                                <Switch
                                  checked={holiday.isActive}
                                  onCheckedChange={() => handleToggleActive(holiday.id, holiday.isActive)}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button onClick={() => handleEditClick(holiday)} variant="outline" size="sm" className="gap-2">
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              variant="outline"
                              size="sm"
                              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
