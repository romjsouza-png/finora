# Supabase setup

This directory contains the first database migration for shared and personal
Finora workspaces. The current browser app still uses localStorage; adding this
schema does not connect the app to Supabase or migrate existing browser data.

## Data access model

- Every account has a personal workspace created automatically at signup.
- A user can also belong to one or more group workspaces.
- Every member can read and edit financial records in their workspaces.
- A platform admin can create groups and inspect workspace membership, but is
   not automatically a member and cannot read financial records.
- Membership changes and email invitations must be performed by a trusted
  server-side function using the Supabase service role. Never put that key in
  browser code.

## Apply the migration

1. Create a Supabase project and link its project directory with the Supabase
   CLI.
2. Apply `migrations/202610030001_initial_schema.sql` to the project.
3. Create the first user through Supabase Auth.
4. Promote that user to platform admin from the Supabase SQL editor:

   ```sql
   insert into public.platform_admins (user_id)
   values ('AUTH_USER_UUID');
   ```

5. Configure signup, email confirmation, password reset, and allowed redirect
   URLs in Supabase Auth before inviting other users.

The function `public.create_group_workspace(name)` creates a group and makes
the caller its owner. It is restricted to platform admins. Adding or removing
members and sending invitations still requires a trusted server-side function;
the migration intentionally does not expose membership writes to browser users.

## Before connecting the frontend

The frontend needs the Supabase project URL and publishable/anon key. The
service-role key must remain server-side. Authentication, workspace selection,
data loading/saving, migration of existing localStorage data, and invitation
Edge Functions are follow-up implementation work; do not treat this migration
alone as a production-ready multi-user release.