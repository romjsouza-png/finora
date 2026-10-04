import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Autenticação necessária." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[access-management] Variáveis obrigatórias do Supabase ausentes.");
    return jsonResponse({ error: "O serviço de compartilhamento não está configurado." }, 500);
  }

  const callerClient = createClient(supabaseUrl, anonKey);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) return jsonResponse({ error: "Sessão inválida ou expirada." }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ error: "Corpo da solicitação inválido." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Corpo da solicitação inválido." }, 400);
  }

  const action = body.action;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!emailPattern.test(email)) return jsonResponse({ error: "Informe um e-mail válido." }, 400);

  const callerId = callerData.user.id;
  const { data: platformAdmin, error: platformAdminError } = await serviceClient
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", callerId)
    .maybeSingle();
  if (platformAdminError) {
    console.error("[access-management] Falha ao verificar administrador.", platformAdminError);
    return jsonResponse({ error: "Não foi possível validar as permissões." }, 500);
  }
  const isPlatformAdmin = Boolean(platformAdmin);

  const resolveOrInviteUser = async () => {
    const { data: existingId, error: resolveError } = await serviceClient.rpc("resolve_auth_user_id", {
      target_email: email,
    });
    if (resolveError) throw resolveError;
    if (existingId) return { userId: existingId as string, invited: false };

    const redirectTo = Deno.env.get("INVITE_REDIRECT_URL");
    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) throw error;
    if (!data.user) throw new Error("O convite não retornou o usuário criado.");
    return { userId: data.user.id, invited: true };
  };

  try {
    if (action === "promote_platform_admin") {
      if (!isPlatformAdmin) return jsonResponse({ error: "Apenas um administrador da plataforma pode conceder esse acesso." }, 403);
      const target = await resolveOrInviteUser();
      const { error } = await serviceClient.from("platform_admins").upsert(
        { user_id: target.userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
      if (error) throw error;
      return jsonResponse({ invited: target.invited });
    }

    if (action === "invite_workspace_member") {
      const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
      if (!uuidPattern.test(workspaceId)) return jsonResponse({ error: "Grupo inválido." }, 400);

      const { data: workspace, error: workspaceError } = await serviceClient
        .from("workspaces")
        .select("id, kind")
        .eq("id", workspaceId)
        .maybeSingle();
      if (workspaceError) throw workspaceError;
      if (!workspace || workspace.kind !== "group") return jsonResponse({ error: "Grupo não encontrado." }, 404);

      if (!isPlatformAdmin) {
        const { data: membership, error } = await serviceClient
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", workspaceId)
          .eq("user_id", callerId)
          .maybeSingle();
        if (error) throw error;
        if (!membership || !["owner", "admin"].includes(membership.role)) {
          return jsonResponse({ error: "Somente administradores do grupo podem convidar membros." }, 403);
        }
      }

      const target = await resolveOrInviteUser();
      if (target.userId === callerId) return jsonResponse({ error: "Você já tem acesso a este grupo." }, 409);
      const { data: existingMembership, error: membershipError } = await serviceClient
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", target.userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (existingMembership) return jsonResponse({ error: "Esse usuário já participa do grupo." }, 409);

      const { error } = await serviceClient.from("workspace_members").insert({
        workspace_id: workspaceId,
        user_id: target.userId,
        role: "member",
      });
      if (error?.code === "23505") return jsonResponse({ error: "Esse usuário já participa do grupo." }, 409);
      if (error) throw error;
      return jsonResponse({ invited: target.invited });
    }

    if (action === "follow_account") {
      const accountId = typeof body.accountId === "string" ? body.accountId : "";
      if (!uuidPattern.test(accountId)) return jsonResponse({ error: "Conta inválida." }, 400);

      const { data: account, error: accountError } = await serviceClient
        .from("accounts")
        .select("id, workspace_id, created_by")
        .eq("id", accountId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return jsonResponse({ error: "Conta não encontrada." }, 404);

      if (account.created_by !== callerId) {
        const { data: membership, error } = await serviceClient
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", account.workspace_id)
          .eq("user_id", callerId)
          .maybeSingle();
        if (error) throw error;
        if (!membership || !["owner", "admin"].includes(membership.role)) {
          return jsonResponse({ error: "Somente quem criou a conta ou administra o grupo pode liberar o acompanhamento." }, 403);
        }
      }

      const target = await resolveOrInviteUser();
      if (target.userId === callerId) return jsonResponse({ error: "Você já tem acesso a esta conta." }, 409);
      const { error } = await serviceClient.from("account_followers").insert({
        account_id: accountId,
        user_id: target.userId,
        granted_by: callerId,
      });
      if (error?.code === "23505") return jsonResponse({ error: "Esse usuário já acompanha a conta." }, 409);
      if (error) throw error;
      return jsonResponse({ invited: target.invited });
    }

    if (action === "revoke_account_follow") {
      const accountId = typeof body.accountId === "string" ? body.accountId : "";
      if (!uuidPattern.test(accountId)) return jsonResponse({ error: "Conta inválida." }, 400);

      const { data: account, error: accountError } = await serviceClient
        .from("accounts")
        .select("id, workspace_id, created_by")
        .eq("id", accountId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return jsonResponse({ error: "Conta não encontrada." }, 404);

      if (account.created_by !== callerId) {
        const { data: membership, error } = await serviceClient
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", account.workspace_id)
          .eq("user_id", callerId)
          .maybeSingle();
        if (error) throw error;
        if (!membership || !["owner", "admin"].includes(membership.role)) {
          return jsonResponse({ error: "Somente quem criou a conta ou administra o grupo pode revogar o acompanhamento." }, 403);
        }
      }

      const { data: targetId, error: resolveError } = await serviceClient.rpc("resolve_auth_user_id", {
        target_email: email,
      });
      if (resolveError) throw resolveError;
      if (!targetId) return jsonResponse({ error: "Não há usuário cadastrado com esse e-mail." }, 404);
      const { data: removed, error } = await serviceClient
        .from("account_followers")
        .delete()
        .eq("account_id", accountId)
        .eq("user_id", targetId)
        .select("account_id");
      if (error) throw error;
      if (!removed?.length) return jsonResponse({ error: "Esse usuário não acompanha esta conta." }, 404);
      return jsonResponse({ revoked: true });
    }

    return jsonResponse({ error: "Ação desconhecida." }, 400);
  } catch (error) {
    console.error("[access-management] Falha na operação de acesso.", error);
    return jsonResponse({ error: "Não foi possível concluir a operação de acesso." }, 500);
  }
});
