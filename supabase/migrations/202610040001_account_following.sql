create table public.account_followers (
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index account_followers_user_idx
  on public.account_followers (user_id, account_id);
create index transactions_account_date_idx
  on public.transactions (account_id, date desc);

alter table public.account_followers enable row level security;

create or replace function public.is_account_follower(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_followers
    where account_id = target_account_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.resolve_auth_user_id(target_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(target_email))
  limit 1;
$$;

drop policy "Workspace members can read accounts" on public.accounts;
create policy "Workspace members and followers can read accounts"
  on public.accounts for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (select public.is_account_follower(id))
  );

drop policy "Workspace members can read transactions" on public.transactions;
create policy "Workspace members and followers can read transactions"
  on public.transactions for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (select public.is_account_follower(account_id))
  );

create policy "Users can read their own account follows"
  on public.account_followers for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.account_followers to authenticated;
grant select, insert, delete on public.account_followers to service_role;
grant execute on function public.is_account_follower(uuid) to authenticated;
revoke execute on function public.resolve_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.resolve_auth_user_id(text) to service_role;

revoke execute on function public.is_account_follower(uuid) from public, anon;
