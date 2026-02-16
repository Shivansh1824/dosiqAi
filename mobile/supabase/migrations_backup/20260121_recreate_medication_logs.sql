-- Re-create medication_logs table to reference medication_schedules
create table if not exists public.medication_logs (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    medication_id uuid not null references public.medication_schedules(id) on delete cascade,
    scheduled_date date not null,
    scheduled_time text not null,
    taken_at timestamp with time zone,
    status text not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    
    constraint medication_logs_pkey primary key (id),
    constraint unique_log_entry unique (medication_id, scheduled_date, scheduled_time)
);

alter table public.medication_logs enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own medication logs" on public.medication_logs;
drop policy if exists "Users can insert their own medication logs" on public.medication_logs;
drop policy if exists "Users can update their own medication logs" on public.medication_logs;
drop policy if exists "Users can delete their own medication logs" on public.medication_logs;

create policy "Users can view their own medication logs"
on public.medication_logs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own medication logs"
on public.medication_logs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own medication logs"
on public.medication_logs for update
to authenticated
using (auth.uid() = user_id);

create policy "Users can delete their own medication logs"
on public.medication_logs for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists idx_med_logs_user_date on public.medication_logs(user_id, scheduled_date);
create index if not exists idx_med_logs_medication on public.medication_logs(medication_id);
