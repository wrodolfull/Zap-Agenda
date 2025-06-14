// @ts-ignore: Deno runtime handles remote module imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Deno handles npm imports internally
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Get available slots
    if (req.method === 'GET' && path === 'available-slots') {
      const params = url.searchParams;
      const professionalId = params.get('professionalId');
      const date = params.get('date');
      const specialtyId = params.get('specialtyId');

      if (!professionalId || !date || !specialtyId) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: workingHours, error: workingHoursError } = await supabaseClient
        .from('working_hours')
        .select('*')
        .eq('professional_id', professionalId)
        .eq('day_of_week', new Date(`${date}T00:00:00Z`).getUTCDay());

      if (workingHoursError) throw workingHoursError;

      const { data: specialty, error: specialtyError } = await supabaseClient
        .from('specialties')
        .select('duration')
        .eq('id', specialtyId)
        .single();

      if (specialtyError) throw specialtyError;

      const { data: appointments, error: appointmentsError } = await supabaseClient
        .from('appointments')
        .select('start_time, end_time')
        .eq('professional_id', professionalId)
        .eq('status', 'confirmed')
        .gte('start_time', `${date}T00:00:00`)
        .lte('start_time', `${date}T23:59:59`);

      if (appointmentsError) throw appointmentsError;

      const slots = [];
      const workingHour = workingHours?.[0];
      
      if (workingHour?.is_working_day && workingHour.start_time && workingHour.end_time) {
        const startTime = new Date(`${date}T${workingHour.start_time}`);
        const endTime = new Date(`${date}T${workingHour.end_time}`);
        const duration = specialty.duration;

        while (startTime < endTime) {
          const slotEnd = new Date(startTime.getTime() + duration * 60000);
          
          const isAvailable = !appointments?.some(apt => {
            const aptStart = new Date(apt.start_time);
            const aptEnd = new Date(apt.end_time);
            return (startTime < aptEnd && slotEnd > aptStart);
          });

          if (isAvailable) {
            slots.push({
              start: startTime.toISOString(),
              end: slotEnd.toISOString(),
            });
          }

          startTime.setMinutes(startTime.getMinutes() + duration);
        }
      }

      return new Response(
        JSON.stringify({ slots }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get appointment details
    if (req.method === 'GET' && path === 'details') {
      const appointmentId = url.searchParams.get('id');

      if (!appointmentId) {
        return new Response(
          JSON.stringify({ error: 'Appointment ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabaseClient
        .from('appointments')
        .select(`
          *,
          client:clients(name, email, phone),
          professional:professionals(name, email),
          specialty:specialties(name, duration, price)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Book new appointment
    if (req.method === 'POST' && path === 'book') {
      try {
        const json = await req.json();
        console.log('📦 Corpo recebido no /book:', JSON.stringify(json, null, 2));
    
        const {
          professionalId,
          clientId,
          specialtyId,
          startTime,
          endTime,
          notes,
          calendarId,
        } = json;
        
        // Buscar o owner_id do calendário
        const { data: calendarInfo, error: calendarError } = await supabaseClient
          .from('calendars')
          .select('owner_id')
          .eq('id', calendarId)
          .single();
        
        if (calendarError || !calendarInfo) {
          console.error('Erro ao buscar owner_id do calendário:', calendarError?.message);
          return new Response(
            JSON.stringify({ error: 'Failed to resolve calendar owner' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const userId = calendarInfo.owner_id;
    
        if (!professionalId || !clientId || !specialtyId || !startTime || !endTime || !calendarId) {
          console.error('❌ Campos obrigatórios ausentes:', {
            professionalId,
            clientId,
            specialtyId,
            startTime,
            endTime,
            calendarId
          });
    
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
    
        console.log('✅ Inserindo no banco com dados:', {
          professionalId,
          clientId,
          specialtyId,
          calendarId,
          userId,
          startTime,
          endTime,
          notes
        });
    
        const { data, error } = await supabaseClient
          .from('appointments')
          .insert({
            professional_id: professionalId,
            client_id: clientId,
            specialty_id: specialtyId,
            calendar_id: calendarId,
            user_id: userId || null,
            start_time: startTime,
            end_time: endTime,
            notes,
            status: 'confirmed',
          })
          .select()
          .single();
    
        if (error) {
          console.error('🔥 Erro ao inserir agendamento:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
    
          return new Response(
            JSON.stringify({
              error: error.message,
              details: error.details,
              hint: error.hint
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
    
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    
      } catch (error) {
        console.error('💥 Erro inesperado:', error.message || error.toString());
        return new Response(
          JSON.stringify({ error: error.message || 'Internal Server Error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Reschedule appointment
    if (req.method === 'PUT' && path === 'reschedule') {
      const { id, startTime, endTime } = await req.json();

      const { data, error } = await supabaseClient
        .from('appointments')
        .update({
          start_time: startTime,
          end_time: endTime,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cancel appointment
    if (req.method === 'PUT' && path === 'cancel') {
      const { id } = await req.json();

      const { data, error } = await supabaseClient
        .from('appointments')
        .update({ status: 'canceled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});