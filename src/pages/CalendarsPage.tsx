import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Building, MapPin, Plus, Users, Edit, Trash2, CalendarRange, Loader, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CreateCalendarModal from '../components/modals/CreateCalendarModal';
import CreateSpecialtyModal from '../components/modals/CreateSpecialtyModal';
import CreateProfessionalModal from '../components/modals/CreateProfessionalModal';
import EditCalendarModal from '../components/modals/EditCalendarModal';
import EditSpecialtyModal from '../components/modals/EditSpecialtyModal';
import EditProfessionalModal from '../components/modals/EditProfessionalModal';
import ShareCalendarModal from '../components/modals/ShareCalendarModal';
import { Calendar, Professional, Specialty } from '../types';
import toast, { Toaster } from 'react-hot-toast';

const CalendarsPage = () => {
  const { user } = useAuth();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [showCreateCalendar, setShowCreateCalendar] = useState(false);
  const [showCreateSpecialty, setShowCreateSpecialty] = useState(false);
  const [showCreateProfessional, setShowCreateProfessional] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [sharingCalendar, setSharingCalendar] = useState<Calendar | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (!user) {
        setCalendars([]);
        setSpecialties([]);
        setProfessionals([]);
        return;
      }

      const { data: calendarsData, error: calendarsError } = await supabase
        .from('calendars')
        .select('*')
        .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (calendarsError) throw calendarsError;
      setCalendars(calendarsData || []);

      const calendarIds = (calendarsData || []).map((c) => c.id);

      const { data: specialtiesData, error: specialtiesError } = await supabase
        .from('specialties')
        .select('*')
        .in('calendar_id', calendarIds);

      if (specialtiesError) throw specialtiesError;
      setSpecialties(specialtiesData || []);

      const { data: professionalsData, error: professionalsError } = await supabase
        .from('professionals')
        .select('*')
        .in('calendar_id', calendarIds);

      if (professionalsError) throw professionalsError;
      setProfessionals(professionalsData || []);

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [user]);

  const handleDeleteCalendar = async (id: string) => {
    try {
      const { error } = await supabase.from('calendars').delete().eq('id', id);
      if (error) throw error;
      setCalendars(calendars.filter((calendar) => calendar.id !== id));
      toast.success('Calendar deleted successfully');
    } catch (error) {
      console.error('Error deleting calendar:', error);
      toast.error('Failed to delete calendar');
    }
  };

  const handleDeleteSpecialty = async (id: string) => {
    try {
      const { error } = await supabase.from('specialties').delete().eq('id', id);
      if (error) throw error;
      setSpecialties(specialties.filter((specialty) => specialty.id !== id));
      toast.success('Specialty deleted successfully');
    } catch (error) {
      console.error('Error deleting specialty:', error);
      toast.error('Failed to delete specialty');
    }
  };

  const handleDeleteProfessional = async (id: string) => {
    try {
      const { error } = await supabase.from('professionals').delete().eq('id', id);
      if (error) throw error;
      setProfessionals(professionals.filter((professional) => professional.id !== id));
      toast.success('Professional deleted successfully');
    } catch (error) {
      console.error('Error deleting professional:', error);
      toast.error('Failed to delete professional');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center text-error-500">
          Error loading data. Please try again later.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Toaster />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendars</h1>
          <p className="text-gray-600">Manage your locations and specialties</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreateCalendar(true)}>
          New Calendar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        {calendars.map((calendar) => {
          const calendarSpecialties = specialties.filter((s) => s.calendar_id === calendar.id);
          const calendarProfessionals = professionals.filter((p) => p.calendar_id === calendar.id);

          return (
            <Card key={calendar.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="bg-primary-100 p-2 rounded-full mr-4">
                      <Building className="h-8 w-8 text-primary-600" />
                    </div>
                    <div>
                      <CardTitle>{calendar.name}</CardTitle>
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <MapPin size={14} className="mr-1" />
                        <span>{calendar.location_id || 'Location not set'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Share2 size={14} />}
                      onClick={() => setSharingCalendar(calendar)}
                    >
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Edit size={14} />}
                      onClick={() => setEditingCalendar(calendar)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-error-500 border-error-500 hover:bg-error-50"
                      leftIcon={<Trash2 size={14} />}
                      onClick={() => handleDeleteCalendar(calendar.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium flex items-center">
                        <CalendarRange size={18} className="mr-2 text-gray-500" /> Specialties
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Plus size={14} />}
                        onClick={() => {
                          setSelectedCalendarId(calendar.id);
                          setShowCreateSpecialty(true);
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      {calendarSpecialties.length > 0 ? (
                        <ul className="space-y-2">
                          {calendarSpecialties.map((specialty) => (
                            <li
                              key={specialty.id}
                              className="flex justify-between items-center p-2 bg-white rounded border border-gray-200"
                            >
                              <div>
                                <p className="font-medium">{specialty.name}</p>
                                <p className="text-sm text-gray-500">
                                  {specialty.duration} min {specialty.price && `• $${specialty.price}`}
                                </p>
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  className="p-1 text-gray-500 hover:text-gray-700"
                                  onClick={() => setEditingSpecialty(specialty)}
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  className="p-1 text-gray-500 hover:text-error-500"
                                  onClick={() => handleDeleteSpecialty(specialty.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-center text-gray-500 py-4">No specialties added yet</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium flex items-center">
                        <Users size={18} className="mr-2 text-gray-500" /> Professionals
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Plus size={14} />}
                        onClick={() => {
                          setSelectedCalendarId(calendar.id);
                          setShowCreateProfessional(true);
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      {calendarProfessionals.length > 0 ? (
                        <ul className="space-y-2">
                          {calendarProfessionals.map((professional) => {
                            const specialty = specialties.find((s) => s.id === professional.specialty_id);
                            return (
                              <li
                                key={professional.id}
                                className="flex justify-between items-center p-2 bg-white rounded border border-gray-200"
                              >
                                <div className="flex items-center">
                                  <img
                                    src={professional.avatar || 'https://via.placeholder.com/40'}
                                    alt={professional.name}
                                    className="w-10 h-10 rounded-full mr-3 object-cover"
                                  />
                                  <div>
                                    <p className="font-medium">{professional.name}</p>
                                    <p className="text-sm text-gray-500">
                                      {specialty?.name || 'No specialty assigned'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex space-x-1">
                                  <button
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                    onClick={() => setEditingProfessional(professional)}
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    className="p-1 text-gray-500 hover:text-error-500"
                                    onClick={() => handleDeleteProfessional(professional.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-center text-gray-500 py-4">No professionals added yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showCreateCalendar && (
        <CreateCalendarModal onClose={() => setShowCreateCalendar(false)} onSuccess={fetchData} />

      )}

      {showCreateSpecialty && selectedCalendarId && (
        <CreateSpecialtyModal
          calendarId={selectedCalendarId}
          onClose={() => {
            setShowCreateSpecialty(false);
            setSelectedCalendarId(null);
          }}
          onSuccess={fetchData}
        />
      )}

      {showCreateProfessional && selectedCalendarId && (
        <CreateProfessionalModal
          calendarId={selectedCalendarId}
          specialties={specialties.filter((s) => s.calendar_id === selectedCalendarId)}
          onClose={() => {
            setShowCreateProfessional(false);
            setSelectedCalendarId(null);
          }}
          onSuccess={fetchData}
        />
      )}

      {editingCalendar && (
        <EditCalendarModal
          calendar={editingCalendar}
          onClose={() => setEditingCalendar(null)}
          onSuccess={fetchData}
        />
      )}

      {editingSpecialty && (
        <EditSpecialtyModal
          specialty={editingSpecialty}
          onClose={() => setEditingSpecialty(null)}
          onSuccess={fetchData}
        />
      )}

      {editingProfessional && (
        <EditProfessionalModal
          professional={editingProfessional}
          specialties={specialties.filter((s) => s.calendar_id === editingProfessional.calendar_id)}
          onClose={() => setEditingProfessional(null)}
          onSuccess={fetchData}
        />
      )}

      {sharingCalendar && (
        <ShareCalendarModal calendar={sharingCalendar} onClose={() => setSharingCalendar(null)} />
      )}
    </DashboardLayout>
  );
};

export default CalendarsPage;