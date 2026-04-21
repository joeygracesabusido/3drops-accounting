'use client';

import { useState, useEffect } from 'react';
import { MapPin, Settings, Save, Trash2, Globe, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [mounted, setMounted] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius: '5',
  });

  useEffect(() => {
    setMounted(true);
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    setUserRole(cookies.userRole || '');
  }, []);

  useEffect(() => {
    if (mounted && (userRole === 'ADMIN' || userRole === 'HR')) {
      fetchLocations();
    }
  }, [mounted, userRole]);

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/office-location', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setNewLocation(prev => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your current location. Please enter coordinates manually.');
      }
    );
  };

  const handleCreateLocation = async () => {
    if (!newLocation.name || !newLocation.latitude || !newLocation.longitude) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const res = await fetch('/api/office-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLocation.name,
          latitude: parseFloat(newLocation.latitude),
          longitude: parseFloat(newLocation.longitude),
          radius: parseInt(newLocation.radius),
        }),
      });

      if (res.ok) {
        alert('Office location created successfully');
        setNewLocation({ name: '', latitude: '', longitude: '', radius: '5' });
        fetchLocations();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create location');
      }
    } catch (error) {
      console.error('Error creating location:', error);
      alert('Failed to create location');
    }
  };

  const handleUpdateLocation = async (id: string) => {
    const location = locations.find(loc => loc.id === id);
    if (!location) return;

    try {
      const res = await fetch('/api/office-location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          radius: location.radius,
          isActive: location.isActive,
        }),
      });

      if (res.ok) {
        alert('Location updated successfully');
        setEditingId(null);
        fetchLocations();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update location');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Failed to update location');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/office-location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          isActive: !currentStatus,
        }),
      });

      if (res.ok) {
        fetchLocations();
      }
    } catch (error) {
      console.error('Error toggling location:', error);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      const res = await fetch(`/api/office-location?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('Location deleted successfully');
        fetchLocations();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete location');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
  };

  const handleEditClick = (location: OfficeLocation) => {
    setEditingId(location.id);
    setNewLocation({
      name: location.name,
      latitude: location.latitude.toFixed(6),
      longitude: location.longitude.toFixed(6),
      radius: location.radius.toString(),
    });
  };

  const handleUpdateFromEdit = async (id: string) => {
    if (!newLocation.name || !newLocation.latitude || !newLocation.longitude) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const res = await fetch('/api/office-location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: newLocation.name,
          latitude: parseFloat(newLocation.latitude),
          longitude: parseFloat(newLocation.longitude),
          radius: parseInt(newLocation.radius),
        }),
      });

      if (res.ok) {
        alert('Location updated successfully');
        setEditingId(null);
        setNewLocation({ name: '', latitude: '', longitude: '', radius: '5' });
        fetchLocations();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update location');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Failed to update location');
    }
  };

  if (!mounted) return null;

  const canAccess = userRole === 'ADMIN' || userRole === 'HR';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Configure system settings</p>
      </div>

      {!canAccess ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Access Denied</p>
              <p className="text-sm">Only Admin and HR users can access settings</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* GPS Location Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <CardTitle>GPS Location Settings</CardTitle>
              </div>
              <CardDescription>
                Set office location for clock-in/out geofencing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create New Location */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-900">Add Office Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Location Name</Label>
                    <Input
                      id="name"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Main Office"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="radius">Radius (meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      value={newLocation.radius}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, radius: e.target.value }))}
                      min="1"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <div className="flex gap-2">
                      <Input
                        id="latitude"
                        value={newLocation.latitude}
                        onChange={(e) => setNewLocation(prev => ({ ...prev, latitude: e.target.value }))}
                        placeholder="14.5995"
                      />
                    </div>
                    <p className="text-xs text-gray-500">-90 to 90</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <div className="flex gap-2">
                      <Input
                        id="longitude"
                        value={newLocation.longitude}
                        onChange={(e) => setNewLocation(prev => ({ ...prev, longitude: e.target.value }))}
                        placeholder="120.9842"
                      />
                    </div>
                    <p className="text-xs text-gray-500">-180 to 180</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    variant="outline"
                    className="gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Use My Location
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateLocation}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4" />
                    Save Location
                  </Button>
                </div>
              </div>

              {/* Existing Locations */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Existing Locations</h3>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : locations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No office locations configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locations.map((location) => (
                      <div key={location.id} className="border rounded-lg p-4 space-y-3">
                        {editingId === location.id ? (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Input
                                value={newLocation.name}
                                onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Name"
                              />
                              <Input
                                value={newLocation.latitude}
                                onChange={(e) => setNewLocation(prev => ({ ...prev, latitude: e.target.value }))}
                                placeholder="Latitude"
                              />
                              <Input
                                value={newLocation.longitude}
                                onChange={(e) => setNewLocation(prev => ({ ...prev, longitude: e.target.value }))}
                                placeholder="Longitude"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                onClick={() => handleUpdateFromEdit(location.id)}
                                size="sm"
                                className="gap-2"
                              >
                                <Check className="w-4 h-4" />
                                Save
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setNewLocation({ name: '', latitude: '', longitude: '', radius: '5' });
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
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${location.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                                  <MapPin className={`w-5 h-5 ${location.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{location.name}</p>
                                  <p className="text-sm text-gray-500">
                                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${location.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {location.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {location.radius}m radius
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                onClick={() => handleEditClick(location)}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleToggleActive(location.id, location.isActive)}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                              >
                                {location.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleDeleteLocation(location.id)}
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
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
