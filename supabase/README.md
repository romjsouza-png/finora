# Supabase setup

This directory contains the database migrations and Edge Function needed for
shared and personal Finora workspaces. Supabase support is activated only when
the browser app is configured with the project's URL and anon key. Existing
localStorage data is not migrated automatically.

## Data access model

- Every account has a personal workspace created automatically at signup.
- A user can also belong to one or more group workspaces.
- Group members can read and edit records in their workspaces.
- An account owner or group admin can grant a specific user read-only access to
  one account. Followed accounts are shown separately and are excluded from
  personal totals.
- A platform admin can manage platform access but cannot read other groups'
  financial records unless added as a member. The creator is an owner of groups
  they create.
- Membership changes and email invitations must be performed by a trusted
  server-side function using the Supabase service role. Never put that key in
  browser code.

## Apply the migration

1. Create a Supabase project and link its project directory with the Supabase
   CLI.
2. Apply both SQL migrations in `migrations/` in filename order.
3. Create the first user through Supabase Auth.
4. Promote that user to platform admin from the Supabase SQL editor:

   ```sql
   insert into public.platform_admins (user_id)
   values ('AUTH_USER_UUID');
   ```

5. Configure signup, email confirmation, password reset, and allowed redirect
   URLs in Supabase Auth before inviting other users.
6. Deploy the access-management Edge Function and configure its invite redirect
   URL if needed:

   ```sh
   supabase functions deploy access-management
   supabase secrets set INVITE_REDIRECT_URL=https://your-app.example/
   ```

   The function uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` from the Supabase Edge Function environment.

The function `public.create_group_workspace(name)` creates a group and makes
the caller its owner. It is restricted to platform admins. The access-management
Edge Function handles platform-admin promotion, group invitations, and
account-specific read-only follows. Membership and follow writes are never
available directly to browser users.

## Before connecting the frontend

The frontend needs the Supabase project URL and publishable/anon key in
`js/supabase-config.js`. The service-role key must remain server-side. Users
can create accounts and groups from the app after the first platform admin has
been promoted through the SQL editor.