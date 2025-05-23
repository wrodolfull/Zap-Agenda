import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { useAuth } from '../../contexts/AuthContext';
import { addMinutes } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Specialty {
  id: string;
  name: string;
  duration: number;
  price?: number;
}

interface Professional {
  id: string;
  name: string;
  specialty_id: string;
  calendar_id: string;
}

interface CreateAppointmentFormData {
  clientId: string;
  professionalId: string;
  specialtyId: string;
  startTime: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  clientPhone?: string;
}

interface CreateAppointmentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
}

const CreateAppointmentModal: React.FC<CreateAppointmentModalProps> = ({ onClose, onSuccess, initialDate }) => {
  const { user } = useAuth();
  const [clientsData, setClientsData] = useState<Client[]>([]);
  const [specialtiesData, setSpecialtiesData] = useState<Specialty[]>([]);
  const [professionalsData, setProfessionalsData] = useState<Professional[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateAppointmentFormData>({
    defaultValues: {
      status: 'pending',
    },
  });

  const watchClientId = watch('clientId');

  useEffect(() => {
    if (watchClientId) {
      const selectedClient = clientsData.find((c) => c.id === watchClientId);
      if (selectedClient) {
        setValue('clientPhone', selectedClient.phone || '');
      }
    }
  }, [watchClientId, clientsData, setValue]);

  const watchSpecialtyId = watch('specialtyId');

  useEffect(() => {
    if (initialDate) {
      const iso = initialDate.toISOString().slice(0, 16); // formato yyyy-MM-ddTHH:mm
      setValue('startTime', iso);
    }
  }, [initialDate, setValue]);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        // Buscar calendários do usuário
        const { data: calendars, error: calendarsError } = await supabase
          .from('calendars')
          .select('id')
          .eq('owner_id', user.id);

        if (calendarsError) throw calendarsError;
        if (!calendars || calendars.length === 0) {
          toast.error('No calendar found. Please create a calendar first.');
          setLoading(false);
          return;
        }

        const calendarIds = calendars.map((c) => c.id);

        // Buscar clientes
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .eq('owner_id', user.id);
        if (clientsError) throw clientsError;
        setClientsData(clients || []);

        // Buscar especialidades
        const { data: specialties, error: specialtiesError } = await supabase
          .from('specialties')
          .select('*')
          .in('calendar_id', calendarIds);
        if (specialtiesError) throw specialtiesError;
        setSpecialtiesData(specialties || []);

        // Buscar profissionais
        const { data: professionals, error: professionalsError } = await supabase
          .from('professionals')
          .select('*')
          .in('calendar_id', calendarIds);
        if (professionalsError) throw professionalsError;
        setProfessionalsData(professionals || []);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load data');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    setSelectedSpecialty(watchSpecialtyId);
  }, [watchSpecialtyId]);

  const onSubmit = async (data: CreateAppointmentFormData) => {
    try {
      if (!user) throw new Error('User not authenticated');

      // Atualiza telefone do cliente, se preenchido
      if (data.clientPhone) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ phone: data.clientPhone })
          .eq('id', data.clientId);
        if (updateError) throw updateError;
      }

      const specialty = specialtiesData.find((s) => s.id === data.specialtyId);
      if (!specialty) throw new Error('Specialty not found');

      const startTime = new Date(data.startTime);
      const endTime = addMinutes(startTime, specialty.duration);

      const professional = professionalsData.find((p) => p.id === data.professionalId);
      if (!professional) throw new Error('Professional not found');

      const { error } = await supabase.from('appointments').insert({
        client_id: data.clientId,
        professional_id: data.professionalId,
        specialty_id: data.specialtyId,
        calendar_id: professional.calendar_id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: data.status,
        notes: data.notes,
        user_id: user.id,
      });

      if (error) throw error;

      toast.success('Appointment created successfully');
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create appointment');
      console.error('Error creating appointment:', err);
    }
  };

  const filteredProfessionals = professionalsData.filter(
    (p) => !selectedSpecialty || p.specialty_id === selectedSpecialty
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Toaster />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>New Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              name="clientId"
              control={control}
              rules={{ required: 'Client is required' }}
              render={({ field }) => (
                <Select
                  label="Client"
                  options={clientsData.map((client) => ({
                    value: client.id,
                    label: `${client.name} (${client.email}${client.phone ? `, 📱 ${client.phone}` : ''})`,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.clientId?.message}
                  disabled={loading}
                />
              )}
            />

            <Input
              type="text"
              label="WhatsApp Number"
              {...register('clientPhone')}
              placeholder="e.g. +5511999999999"
              disabled={loading}
            />

            <Controller
              name="specialtyId"
              control={control}
              rules={{ required: 'Specialty is required' }}
              render={({ field }) => (
                <Select
                  label="Service"
                  options={specialtiesData.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.duration}min${s.price ? ` - $${s.price}` : ''})`,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.specialtyId?.message}
                  disabled={loading}
                />
              )}
            />

            <Controller
              name="professionalId"
              control={control}
              rules={{ required: 'Professional is required' }}
              render={({ field }) => (
                <Select
                  label="Professional"
                  options={filteredProfessionals.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.professionalId?.message}
                  disabled={loading}
                />
              )}
            />

            <Input
              type="datetime-local"
              label="Start Time"
              {...register('startTime', { required: 'Start time is required' })}
              error={errors.startTime?.message}
              disabled={loading}
            />

            <Controller
              name="status"
              control={control}
              defaultValue="pending"
              render={({ field }) => (
                <Select
                  label="Status"
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'confirmed', label: 'Confirmed' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'canceled', label: 'Canceled' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={loading}
                />
              )}
            />

            <Input
              label="Notes"
              {...register('notes')}
              error={errors.notes?.message}
              disabled={loading}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || loading}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting || loading} disabled={loading}>
                Create
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateAppointmentModal;
