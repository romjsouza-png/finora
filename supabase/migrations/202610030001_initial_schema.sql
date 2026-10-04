create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  currency text not null default 'BRL' check (currency in ('BRL', 'USD', 'EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('personal', 'group')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('checking', 'savings', 'cash', 'credit')),
  initial_balance numeric(14, 2) not null default 0,
  color text not null default '#5b5ce2',
  archived boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid not null,
  category_id text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  description text not null default '',
  recurring boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, account_id)
    references public.accounts (workspace_id, id) on delete cascade
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category_id text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  month date not null check (extract(day from month) = 1),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, category_id, month)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  target numeric(14, 2) not null check (target > 0),
  saved numeric(14, 2) not null default 0 check (saved >= 0),
  deadline date,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);
create index transactions_workspace_date_idx
  on public.transactions (workspace_id, date desc);
create index goals_workspace_idx
  on public.goals (workspace_id);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.create_group_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_platform_admin() then
    raise exception 'Platform admin role required';
  end if;
  if workspace_name is null or length(trim(workspace_name)) = 0 then
    raise exception 'Workspace name is required';
  end if;

  insert into public.workspaces (name, kind, created_by)
  values (trim(workspace_name), 'group', current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  return new_workspace_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  personal_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));

  insert into public.workspaces (name, kind, created_by)
  values ('Meu espaço', 'personal', new.id)
  returning id into personal_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (personal_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create or replace function public.set_record_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger accounts_set_audit_fields
  before insert or update on public.accounts
  for each row execute procedure public.set_record_audit_fields();

create trigger transactions_set_audit_fields
  before insert or update on public.transactions
  for each row execute procedure public.set_record_audit_fields();

create trigger budgets_set_audit_fields
  before insert or update on public.budgets
  for each row execute procedure public.set_record_audit_fields();

create trigger goals_set_audit_fields
  before insert or update on public.goals
  for each row execute procedure public.set_record_audit_fields();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;

create policy "Users can read profiles in their workspaces"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members as mine
      join public.workspace_members as theirs
        on theirs.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = profiles.id
    )
  );

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members and platform admins can read workspace metadata"
  on public.workspaces for select to authenticated
  using (
    public.is_workspace_member(id)
    or (select public.is_platform_admin())
  );

create policy "Workspace admins can update workspace metadata"
  on public.workspaces for update to authenticated
  using (
    public.is_workspace_admin(id)
    or (select public.is_platform_admin())
  )
  with check (
    public.is_workspace_admin(id)
    or (select public.is_platform_admin())
  );

create policy "Members and platform admins can read workspace memberships"
  on public.workspace_members for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (select public.is_platform_admin())
  );

create policy "Users can read their own platform admin status"
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Workspace members can read accounts"
  on public.accounts for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "Workspace members can create accounts"
  on public.accounts for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can update accounts"
  on public.accounts for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can delete accounts"
  on public.accounts for delete to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read transactions"
  on public.transactions for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "Workspace members can create transactions"
  on public.transactions for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can update transactions"
  on public.transactions for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can delete transactions"
  on public.transactions for delete to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read budgets"
  on public.budgets for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "Workspace members can create budgets"
  on public.budgets for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can update budgets"
  on public.budgets for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can delete budgets"
  on public.budgets for delete to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read goals"
  on public.goals for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "Workspace members can create goals"
  on public.goals for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can update goals"
  on public.goals for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "Workspace members can delete goals"
  on public.goals for delete to authenticated
  using (public.is_workspace_member(workspace_id));

grant select on public.profiles to authenticated;
grant update (display_name, currency) on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select on public.platform_admins to authenticated;
grant select, insert, update, delete on
  public.accounts, public.transactions, public.budgets, public.goals
  to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.create_group_workspace(text) to authenticated;

revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.is_workspace_admin(uuid) from public;
revoke execute on function public.create_group_workspace(text) from public;