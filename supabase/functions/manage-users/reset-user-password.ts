import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// هويات مالكي السيرفر الثابتة
const SERVER_OWNER_IDS = new Set([
  "1488410c-39a5-417b-92f6-c68ee55c886d",
  "489c60eb-5ae5-4611-96d6-b1d911e2686c",
]);

// صلاحيات المديرين
const permissionKeys = [
  "can_manage_menu",
  "can_manage_prices",
  "can_manage_products",
  "can_manage_orders",
  "can_manage_conversations",
  "can_manage_offers",
  "can_manage_coupons",
  "can_manage_branch_staff",
  "can_delete_staff",
] as const;

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function validUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function defaultPermissions(userId: string) {
  const permissions: Record<string, boolean | string> = {
    user_id: userId,
  };

  for (const key of permissionKeys) {
    permissions[key] = false;
  }

  return permissions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return response(
        { error: "إعدادات Supabase السرية غير مكتملة." },
        500,
      );
    }

    // التحقق من جلسة المستخدم
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return response({ error: "غير مصرح." }, 401);
    }

    const token = authHeader.slice(7);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser();

    if (authError || !authData.user) {
      return response({ error: "جلسة الدخول غير صالحة." }, 401);
    }

    const callerId = authData.user.id;
    const isServerOwner = SERVER_OWNER_IDS.has(callerId);

    // عميل الإدارة بصلاحية Service Role
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // جلب بيانات صاحب الطلب
    const { data: caller, error: callerError } = await admin
      .from("profiles")
      .select("id,email,full_name,role,branch_id")
      .eq("id", callerId)
      .maybeSingle();

    if (callerError || !caller) {
      return response(
        { error: "تعذر التحقق من صلاحية الحساب." },
        403,
      );
    }

    // صلاحية السيرفر تعتمد على UUID الثابت فقط
    const isOwner = isServerOwner || caller.role === "owner";
    const isManager = caller.role === "manager";

    if (!isOwner && !isManager) {
      return response(
        { error: "ليس لديك صلاحية إدارة المستخدمين." },
        403,
      );
    }

    // جلب صلاحيات المدير
    const { data: ownPermissions, error: ownPermissionsError } =
      await admin
        .from("manager_permissions")
        .select("*")
        .eq("user_id", callerId)
        .maybeSingle();

    if (ownPermissionsError) {
      throw ownPermissionsError;
    }

    const canManageBranchStaff =
      isManager &&
      ownPermissions?.can_manage_branch_staff === true;

    const canDeleteStaff =
      isManager &&
      ownPermissions?.can_delete_staff === true;

    const canManageCoupons =
      isManager &&
      ownPermissions?.can_manage_coupons === true;

    // قراءة بيانات الطلب
    let body: Record<string, any>;

    try {
      body = await req.json();
    } catch {
      return response({ error: "صيغة الطلب غير صحيحة." }, 400);
    }

    const action = body.action;

    // =========================================
    // تغيير كلمة مرور مستخدم آخر
    // =========================================

    if (action === "change_password") {
      if (!isOwner) {
        return response(
          { error: "ليس لديك صلاحية تغيير كلمات المرور." },
          403,
        );
      }

      const { userId, password } = body;

      if (!validUUID(userId)) {
        return response(
          { error: "معرّف المستخدم غير صحيح." },
          400,
        );
      }

      if (
        typeof password !== "string" ||
        password.length < 8
      ) {
        return response(
          { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." },
          400,
        );
      }

      // منع تغيير كلمة مرور الحساب الشخصي من هذه الشاشة
      if (userId === callerId) {
        return response(
          {
            error:
              "لا يمكنك تغيير كلمة مرور حسابك من شاشة إدارة المستخدمين.",
          },
          403,
        );
      }

      // حماية حسابَي مالكي السيرفر الثابتين
      if (SERVER_OWNER_IDS.has(userId)) {
        return response(
          {
            error:
              "لا يمكن تغيير كلمة مرور أحد مالكي السيرفر الثابتين من هنا.",
          },
          403,
        );
      }

      // جلب رتبة المستخدم المستهدف
      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError) throw targetError;

      if (!target) {
        return response(
          { error: "المستخدم غير موجود." },
          404,
        );
      }

      // صاحب المطعم يستطيع تغيير كلمات مرور المديرين
      // والموظفين والزبائن فقط
      if (
        !isServerOwner &&
        !["manager", "staff", "customer"].includes(target.role)
      ) {
        return response(
          {
            error:
              "لا تملك صلاحية تغيير كلمة مرور هذا الحساب.",
          },
          403,
        );
      }

      // تحديث كلمة المرور في Supabase Auth
      const { error: passwordError } =
        await admin.auth.admin.updateUserById(userId, {
          password,
        });

      if (passwordError) {
        return response(
          { error: "تعذر تحديث كلمة مرور الحساب." },
          400,
        );
      }

      return response({
        success: true,
        message: "تم تغيير كلمة مرور الحساب بنجاح.",
      });
    }

    // =========================================
    // عرض المستخدمين
    // =========================================

    if (action === "list") {
      if (isOwner) {
        const { data: users, error: usersError } = await admin
          .from("profiles")
          .select(
            "id,email,full_name,role,branch_id,created_at,updated_at",
          )
          .order("created_at", { ascending: false });

        if (usersError) throw usersError;

        const { data: permissions, error: permissionsError } =
          await admin
            .from("manager_permissions")
            .select("*");

        if (permissionsError) throw permissionsError;

        return response({
          users: users ?? [],
          permissions: permissions ?? [],
          ownPermissions: null,
          isOwner: true,
          isServerOwner,
          canManageBranchStaff: true,
          canDeleteStaff: true,
          canManageCoupons: true,
        });
      }

      if (!canManageBranchStaff || !caller.branch_id) {
        return response({
          users: [],
          permissions: [],
          ownPermissions,
          isOwner: false,
          isServerOwner: false,
          canManageBranchStaff: false,
          canDeleteStaff,
          canManageCoupons,
          warning:
            "لم تمنحك الإدارة صلاحية مشاهدة موظفي الفرع.",
        });
      }

      const { data: users, error: usersError } = await admin
        .from("profiles")
        .select("id,email,full_name,role,branch_id,created_at")
        .eq("role", "staff")
        .eq("branch_id", caller.branch_id)
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      return response({
        users: users ?? [],
        permissions: [],
        ownPermissions,
        isOwner: false,
        isServerOwner: false,
        canManageBranchStaff: true,
        canDeleteStaff,
        canManageCoupons,
      });
    }

    // =========================================
    // إنشاء مستخدم
    // =========================================

    if (action === "create") {
      if (!isOwner) {
        return response(
          { error: "ليس لديك صلاحية إنشاء الحسابات." },
          403,
        );
      }

      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();
      const branchId = String(body.branchId ?? "").trim();
      const role = body.role;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return response(
          { error: "يرجى إدخال بريد إلكتروني صحيح." },
          400,
        );
      }

      if (password.length < 8) {
        return response(
          { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." },
          400,
        );
      }

      if (!name) {
        return response(
          { error: "يرجى إدخال اسم المستخدم." },
          400,
        );
      }

      // لا يتم إنشاء مالك سيرفر جديد
      if (!["staff", "manager", "owner", "customer"].includes(role)) {
        return response(
          { error: "الرتبة المطلوبة غير مسموحة." },
          400,
        );
      }

      // إنشاء Owner جديد من صلاحية مالك السيرفر فقط
      if (role === "owner" && !isServerOwner) {
        return response(
          {
            error:
              "إنشاء صاحب مطعم جديد من صلاحية مالك السيرفر فقط.",
          },
          403,
        );
      }

      let finalBranchId: string | null = null;

      if (role === "staff" || role === "manager" || branchId) {
        if (!branchId) {
          return response(
            { error: "يرجى اختيار فرع المستخدم." },
            400,
          );
        }

        const { data: branch, error: branchError } = await admin
          .from("branches")
          .select("id")
          .eq("id", branchId)
          .maybeSingle();

        if (branchError) throw branchError;

        if (!branch) {
          return response(
            { error: "الفرع المحدد غير موجود." },
            400,
          );
        }

        finalBranchId = branchId;
      }

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name: name,
            full_name: name,
          },
        });

      if (createError || !created.user) {
        return response(
          {
            error:
              createError?.message || "تعذر إنشاء الحساب.",
          },
          400,
        );
      }

      const newUserId = created.user.id;

      const { error: profileError } = await admin
        .from("profiles")
        .upsert(
          {
            id: newUserId,
            email,
            full_name: name,
            role,
            branch_id: finalBranchId,
          },
          { onConflict: "id" },
        );

      if (profileError) {
        await admin.auth.admin.deleteUser(newUserId);
        throw profileError;
      }

      if (role === "manager") {
        const { error: permissionError } = await admin
          .from("manager_permissions")
          .upsert(defaultPermissions(newUserId), {
            onConflict: "user_id",
          });

        if (permissionError) {
          await admin.auth.admin.deleteUser(newUserId);
          throw permissionError;
        }
      }

      return response({
        success: true,
        user: {
          id: newUserId,
          email,
          full_name: name,
          role,
          branch_id: finalBranchId,
        },
        message: "تم إنشاء الحساب بنجاح.",
      });
    }

    // =========================================
    // تغيير رتبة المستخدم
    // =========================================

    if (action === "set_role") {
      if (!isOwner) {
        return response(
          { error: "ليس لديك صلاحية تغيير الرتب." },
          403,
        );
      }

      const { userId, role } = body;

      if (!validUUID(userId)) {
        return response(
          { error: "معرّف المستخدم غير صحيح." },
          400,
        );
      }

      if (!["owner", "manager", "staff", "customer"].includes(role)) {
        return response(
          { error: "الرتبة المطلوبة غير مسموحة." },
          400,
        );
      }

      if (SERVER_OWNER_IDS.has(userId)) {
        return response(
          {
            error:
              "لا يمكن تغيير رتبة أحد مالكي السيرفر الثابتين.",
          },
          403,
        );
      }

      if (userId === callerId) {
        return response(
          { error: "لا يمكن تغيير رتبة حسابك من هنا." },
          400,
        );
      }

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError || !target) {
        return response(
          { error: "المستخدم غير موجود." },
          404,
        );
      }

      // صاحب المطعم لا يستطيع تعديل Owner آخر
      if (target.role === "owner" && !isServerOwner) {
        return response(
          {
            error:
              "تغيير رتبة صاحب المطعم من صلاحية مالك السيرفر فقط.",
          },
          403,
        );
      }

      if (role === "owner" && !isServerOwner) {
        return response(
          {
            error:
              "ترقية المستخدم إلى صاحب مطعم من صلاحية مالك السيرفر فقط.",
          },
          403,
        );
      }

      if (role === "manager") {
        const { error } = await admin
          .from("manager_permissions")
          .upsert(defaultPermissions(userId), {
            onConflict: "user_id",
            ignoreDuplicates: true,
          });

        if (error) throw error;
      }

      const { error: updateError } = await admin
        .from("profiles")
        .update({ role })
        .eq("id", userId);

      if (updateError) throw updateError;

      if (role !== "manager") {
        const { error } = await admin
          .from("manager_permissions")
          .delete()
          .eq("user_id", userId);

        if (error) throw error;
      }

      return response({
        success: true,
        message: "تم تحديث رتبة المستخدم.",
      });
    }

    // =========================================
    // حفظ صلاحيات المدير
    // =========================================

    if (action === "save_permissions") {
      if (!isOwner) {
        return response(
          { error: "ليس لديك صلاحية تحديد الصلاحيات." },
          403,
        );
      }

      const { userId, permissions } = body;

      if (!validUUID(userId)) {
        return response(
          { error: "معرّف المستخدم غير صحيح." },
          400,
        );
      }

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError || !target || target.role !== "manager") {
        return response(
          { error: "المستخدم المحدد ليس مديراً." },
          400,
        );
      }

      const payload: Record<string, boolean | string> = {
        user_id: userId,
      };

      for (const key of permissionKeys) {
        payload[key] = permissions?.[key] === true;
      }

      const { error } = await admin
        .from("manager_permissions")
        .upsert(payload, {
          onConflict: "user_id",
        });

      if (error) throw error;

      return response({
        success: true,
        message: "تم حفظ صلاحيات المدير.",
      });
    }

    // =========================================
    // حذف مستخدم
    // =========================================

    if (action === "delete") {
      const { userId } = body;

      if (!validUUID(userId)) {
        return response(
          { error: "معرّف المستخدم غير صحيح." },
          400,
        );
      }

      if (SERVER_OWNER_IDS.has(userId)) {
        return response(
          {
            error:
              "حسابا مالكي السيرفر الثابتان محميان من الحذف.",
          },
          403,
        );
      }

      if (userId === callerId) {
        return response(
          { error: "لا يمكنك حذف حسابك من هنا." },
          403,
        );
      }

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id,role,branch_id")
        .eq("id", userId)
        .maybeSingle();

      if (targetError || !target) {
        return response(
          { error: "المستخدم غير موجود." },
          404,
        );
      }

      if (target.role === "owner" && !isServerOwner) {
        return response(
          {
            error:
              "حذف صاحب المطعم من صلاحية مالك السيرفر فقط.",
          },
          403,
        );
      }

      if (isOwner) {
        // مالك السيرفر يستطيع حذف جميع الحسابات غير المحمية
        // صاحب المطعم يستطيع حذف حسابات المطعم ما عدا Owner
      } else if (isManager) {
        if (!canDeleteStaff) {
          return response(
            {
              error:
                "لم تمنحك الإدارة صلاحية حذف الموظفين.",
            },
            403,
          );
        }

        if (target.role !== "staff") {
          return response(
            { error: "المدير يستطيع حذف الموظفين فقط." },
            403,
          );
        }

        if (
          !caller.branch_id ||
          target.branch_id !== caller.branch_id
        ) {
          return response(
            { error: "لا يمكنك حذف موظف من فرع آخر." },
            403,
          );
        }
      } else {
        return response(
          { error: "ليس لديك صلاحية الحذف." },
          403,
        );
      }

      const { error: deleteError } =
        await admin.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      return response({
        success: true,
        message: "تم حذف الحساب بنجاح.",
      });
    }

    // =========================================
    // عملية غير معروفة
    // =========================================

    return response(
      { error: "العملية المطلوبة غير معروفة." },
      400,
    );

  } catch (error) {
    console.error("manage-users error:", error);

    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ غير متوقع.",
      },
      500,
    );
  }
});