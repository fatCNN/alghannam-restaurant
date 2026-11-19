import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SERVER_OWNER_IDS = new Set([
  "489c60eb-5ae5-4611-96d6-b1d911e2686c",
  "1488410c-39a5-417b-92f6-c68ee55c886d",
]);

const permissionKeys = [
  "can_manage_menu",
  "can_manage_prices",
  "can_manage_products",
  "can_manage_orders",
  "can_manage_conversations",
  "can_manage_offers",
  "can_manage_branch_staff",
  "can_delete_staff",
] as const;

type PermissionKey = typeof permissionKeys[number];

type CallerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  branch_id: string | null;
};

function response(
  data: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function validUUID(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(value);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// قراءة قيمة من أكثر من اسم لدعم camelCase و snake_case
function readText(
  body: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = cleanText(body[key]);
    if (value) return value;
  }

  return "";
}

function defaultPermissions() {
  return {
    can_manage_menu: false,
    can_manage_prices: false,
    can_manage_products: false,
    can_manage_orders: false,
    can_manage_conversations: false,
    can_manage_offers: false,
    can_manage_branch_staff: false,
    can_delete_staff: false,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String((error as { message: unknown }).message);
  }

  return "حدث خطأ غير متوقع";
}

function getSupabaseKey(names: string[]): string | null {
  for (const name of names) {
    const value = Deno.env.get(name);

    if (!value) continue;

    try {
      const parsed = JSON.parse(value);

      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.trim();
      }

      if (parsed && typeof parsed === "object") {
        const values = Object.values(parsed);
        const preferred =
          (parsed as Record<string, unknown>).default;

        if (typeof preferred === "string" && preferred.trim()) {
          return preferred.trim();
        }

        const found = values.find(
          (item) => typeof item === "string" && item.trim(),
        );

        if (typeof found === "string") {
          return found.trim();
        }
      }
    } catch {
      return value.trim();
    }
  }

  return null;
}

function hasPermission(
  permissions: Record<string, unknown> | null,
  key: PermissionKey,
): boolean {
  return permissions?.[key] === true;
}

async function cleanupCreatedUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  removeDriver = false,
) {
  if (removeDriver) {
    const { error } = await admin
      .from("delivery_drivers")
      .delete()
      .eq("id", userId);

    if (error) {
      console.error("Driver cleanup failed:", error.message);
    }
  }

  const { error: permissionsError } = await admin
    .from("manager_permissions")
    .delete()
    .eq("user_id", userId);

  if (permissionsError) {
    console.error(
      "Permissions cleanup failed:",
      permissionsError.message,
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    console.error("Profile cleanup failed:", profileError.message);
  }

  const { error: authError } =
    await admin.auth.admin.deleteUser(userId);

  if (authError) {
    console.error("Auth cleanup failed:", authError.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response(
      { success: false, message: "طريقة الطلب غير مسموحة" },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const anonKey = getSupabaseKey([
      "SUPABASE_PUBLISHABLE_KEYS",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
    ]);

    const secretKey = getSupabaseKey([
      "SUPABASE_SECRET_KEYS",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);

    if (!supabaseUrl || !anonKey || !secretKey) {
      return response(
        {
          success: false,
          message: "إعدادات Supabase غير مكتملة في إعدادات الخادم",
        },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return response(
        { success: false, message: "يجب تسجيل الدخول أولاً" },
        401,
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const admin = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return response(
        { success: false, message: "جلسة الدخول غير صالحة" },
        401,
      );
    }

    const isServerOwner = SERVER_OWNER_IDS.has(user.id);

    let caller: CallerProfile;

    if (isServerOwner) {
      caller = {
        id: user.id,
        email: user.email ?? null,
        full_name:
          user.user_metadata?.full_name ??
          user.user_metadata?.display_name ??
          null,
        role: "server_owner",
        branch_id: null,
      };
    } else {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id,email,full_name,role,branch_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        return response(
          {
            success: false,
            message: "تعذر التحقق من صلاحيات حسابك",
          },
          403,
        );
      }

      caller = profile as CallerProfile;
    }

    const isOwner = isServerOwner || caller.role === "owner";
    const isManager = caller.role === "manager";

    if (!isOwner && !isManager) {
      return response(
        {
          success: false,
          message: "ليس لديك صلاحية إدارة المستخدمين",
        },
        403,
      );
    }

    let managerPermissions: Record<string, unknown> | null = null;

    if (isManager) {
      const {
        data: permissions,
        error: permissionsError,
      } = await admin
        .from("manager_permissions")
        .select("*")
        .eq("user_id", caller.id)
        .maybeSingle();

      if (permissionsError) {
        return response(
          {
            success: false,
            message: "تعذر تحميل صلاحيات المدير: " +
              permissionsError.message,
          },
          400,
        );
      }

      managerPermissions = permissions;

      if (
        !hasPermission(
          managerPermissions,
          "can_manage_branch_staff",
        )
      ) {
        return response(
          {
            success: false,
            message: "ليس لديك صلاحية إدارة موظفي الفرع",
          },
          403,
        );
      }
    }

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return response(
        { success: false, message: "بيانات الطلب غير صالحة" },
        400,
      );
    }

    const action = cleanText(body.action);

    // ==========================================
    // LIST USERS
    // ==========================================

    if (action === "list") {
      let query = admin
        .from("profiles")
        .select(
          "id,email,full_name,role,branch_id,created_at",
        )
        .order("created_at", { ascending: false });

      if (isServerOwner) {
        // مالك السيرفر يرى جميع الحسابات.
      } else if (caller.role === "owner") {
        query = query.neq("role", "server_owner");
      } else {
        query = query
          .eq("branch_id", caller.branch_id)
          .eq("role", "staff");
      }

      const { data: users, error: usersError } = await query;

      if (usersError) {
        return response(
          {
            success: false,
            message: "تعذر تحميل قائمة المستخدمين: " +
              usersError.message,
          },
          400,
        );
      }

      const userIds = (users ?? []).map((item) => item.id);

      let permissionsByManager: Record<string, unknown>[] = [];

      if (isServerOwner && userIds.length > 0) {
        const {
          data: permissions,
          error: permissionsError,
        } = await admin
          .from("manager_permissions")
          .select("*")
          .in("user_id", userIds);

        if (permissionsError) {
          return response(
            {
              success: false,
              message: "تعذر تحميل صلاحيات المديرين: " +
                permissionsError.message,
            },
            400,
          );
        }

        permissionsByManager = permissions ?? [];
      }

      return response({
        success: true,
        users: users ?? [],
        permissions: permissionsByManager,
        caller: {
          id: caller.id,
          role: caller.role,
          branch_id: caller.branch_id,
        },
      });
    }

    // ==========================================
    // CREATE USER
    // ==========================================

    if (action === "create") {
      if (!isOwner) {
        return response(
          {
            success: false,
            message: "إنشاء الحسابات متاح لمالك النظام فقط",
          },
          403,
        );
      }

      const email = cleanText(body.email).toLowerCase();
      const password = typeof body.password === "string"
        ? body.password
        : "";
      const name = cleanText(body.name);
      const role = cleanText(body.role);
      const branchId = readText(body, "branch_id", "branchId") || null;
      const phone = cleanText(body.phone) || null;

      if (
        !email ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return response(
          {
            success: false,
            message: "يرجى إدخال بريد إلكتروني صحيح",
          },
          400,
        );
      }

      if (password.length < 8) {
        return response(
          {
            success: false,
            message: "كلمة المرور يجب ألا تقل عن 8 أحرف",
          },
          400,
        );
      }

      if (!name || name.length > 150) {
        return response(
          {
            success: false,
            message: "يرجى إدخال الاسم الكامل بشكل صحيح",
          },
          400,
        );
      }

      if (phone && phone.length > 30) {
        return response(
          {
            success: false,
            message: "رقم الهاتف طويل جداً",
          },
          400,
        );
      }

      const allowedRoles = isServerOwner
        ? [
          "staff",
          "manager",
          "owner",
          "customer",
          "delivery_driver",
        ]
        : ["staff"];

      if (!allowedRoles.includes(role)) {
        return response(
          {
            success: false,
            message: "ليس لديك صلاحية إنشاء هذا النوع من الحسابات",
          },
          403,
        );
      }

      if (role === "delivery_driver" && !isServerOwner) {
        return response(
          {
            success: false,
            message: "إضافة حسابات المندوبين متاحة لمالك السيرفر فقط",
          },
          403,
        );
      }

      const requiresBranch = [
        "staff",
        "manager",
        "delivery_driver",
      ].includes(role);

      if (requiresBranch && !branchId) {
        return response(
          {
            success: false,
            message: "يجب تحديد الفرع لهذا الحساب",
          },
          400,
        );
      }

      if (requiresBranch && branchId) {
        const { data: branch, error: branchError } = await admin
          .from("branches")
          .select("id")
          .eq("id", branchId)
          .maybeSingle();

        if (branchError || !branch) {
          return response(
            {
              success: false,
              message: "الفرع المحدد غير موجود أو تعذر التحقق منه",
            },
            400,
          );
        }
      }

      const {
        data: createdAuth,
        error: createAuthError,
      } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: name,
          full_name: name,
        },
      });

      if (createAuthError || !createdAuth.user) {
        return response(
          {
            success: false,
            message: createAuthError?.message ??
              "تعذر إنشاء حساب تسجيل الدخول",
          },
          400,
        );
      }

      const newUserId = createdAuth.user.id;

      const { error: profileInsertError } = await admin
        .from("profiles")
        .upsert({
          id: newUserId,
          email,
          full_name: name,
          role,
          branch_id: branchId,
        });

      if (profileInsertError) {
        await cleanupCreatedUser(admin, newUserId);

        return response(
          {
            success: false,
            message: "تعذر إنشاء ملف المستخدم: " +
              profileInsertError.message,
          },
          400,
        );
      }

      if (role === "delivery_driver") {
        const { error: driverInsertError } = await admin
          .from("delivery_drivers")
          .insert({
            id: newUserId,
            full_name: name,
            phone,
            branch_id: branchId,
            is_active: true,
          });

        if (driverInsertError) {
          await cleanupCreatedUser(admin, newUserId, true);

          return response(
            {
              success: false,
              message: "تعذر تسجيل بيانات المندوب: " +
                driverInsertError.message,
            },
            400,
          );
        }
      }

      if (role === "manager") {
        const { error: permissionsError } = await admin
          .from("manager_permissions")
          .upsert({
            user_id: newUserId,
            ...defaultPermissions(),
            updated_at: new Date().toISOString(),
          });

        if (permissionsError) {
          await cleanupCreatedUser(admin, newUserId);

          return response(
            {
              success: false,
              message: "تعذر إعداد صلاحيات المدير: " +
                permissionsError.message,
            },
            400,
          );
        }
      }

      return response({
        success: true,
        message: role === "delivery_driver"
          ? "تم إنشاء حساب المندوب بنجاح"
          : "تم إنشاء الحساب بنجاح",
        user: {
          id: newUserId,
          email,
          full_name: name,
          role,
          branch_id: branchId,
          phone,
        },
      });
    }

    // ==========================================
    // CHANGE USER ROLE
    // ==========================================

    if (action === "set_role") {
      if (!isOwner) {
        return response(
          {
            success: false,
            message: "غير مصرح لك بتغيير الأدوار",
          },
          403,
        );
      }

      const userId = readText(body, "user_id", "userId");
      const newRole = cleanText(body.role);

      if (!validUUID(userId)) {
        return response(
          {
            success: false,
            message: "معرف المستخدم غير صحيح",
          },
          400,
        );
      }

      if (userId === caller.id) {
        return response(
          {
            success: false,
            message: "لا يمكنك تغيير صلاحيات حسابك من هنا",
          },
          403,
        );
      }

      if (SERVER_OWNER_IDS.has(userId)) {
        return response(
          {
            success: false,
            message: "لا يمكن تعديل حساب مالك السيرفر",
          },
          403,
        );
      }

      const allowedRoles = [
        "owner",
        "manager",
        "staff",
        "customer",
      ];

      if (!allowedRoles.includes(newRole)) {
        return response(
          {
            success: false,
            message: "الدور المحدد غير مسموح",
          },
          400,
        );
      }

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id,role,branch_id")
        .eq("id", userId)
        .maybeSingle();

      if (targetError || !target) {
        return response(
          {
            success: false,
            message: "المستخدم غير موجود",
          },
          404,
        );
      }

      if (
        target.role === "delivery_driver" ||
        newRole === "delivery_driver"
      ) {
        return response(
          {
            success: false,
            message: "حسابات المندوبين محمية، ولا يمكن تغيير أدوارها من إدارة المستخدمين العامة",
          },
          403,
        );
      }

      if (target.role === "server_owner") {
        return response(
          {
            success: false,
            message: "لا يمكن تعديل حساب مالك السيرفر",
          },
          403,
        );
      }

      if (
        !isServerOwner &&
        (
          target.role === "owner" ||
          newRole === "owner" ||
          newRole === "manager"
        )
      ) {
        return response(
          {
            success: false,
            message: "لا تملك صلاحية تعيين هذا الدور",
          },
          403,
        );
      }

      const { error: updateRoleError } = await admin
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (updateRoleError) {
        return response(
          {
            success: false,
            message: "تعذر تحديث الدور: " +
              updateRoleError.message,
          },
          400,
        );
      }

      if (newRole === "manager") {
        const { error: permissionError } = await admin
          .from("manager_permissions")
          .upsert({
            user_id: userId,
            ...defaultPermissions(),
            updated_at: new Date().toISOString(),
          });

        if (permissionError) {
          return response(
            {
              success: false,
              message: "تم تحديث الدور لكن تعذر إعداد صلاحيات المدير: " +
                permissionError.message,
            },
            400,
          );
        }
      } else if (target.role === "manager") {
        const { error: deletePermissionsError } = await admin
          .from("manager_permissions")
          .delete()
          .eq("user_id", userId);

        if (deletePermissionsError) {
          return response(
            {
              success: false,
              message: "تم تحديث الدور لكن تعذر حذف صلاحيات المدير: " +
                deletePermissionsError.message,
            },
            400,
          );
        }
      }

      return response({
        success: true,
        message: "تم تحديث دور المستخدم بنجاح",
      });
    }

    // ==========================================
    // SAVE MANAGER PERMISSIONS
    // ==========================================

    if (action === "save_permissions") {
      if (!isOwner) {
        return response(
          {
            success: false,
            message: "غير مصرح لك بتعديل الصلاحيات",
          },
          403,
        );
      }

      const managerId = readText(
        body,
        "manager_id",
        "managerId",
      );

      if (!validUUID(managerId)) {
        return response(
          {
            success: false,
            message: "معرف المدير غير صحيح",
          },
          400,
        );
      }

      const { data: manager, error: managerError } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", managerId)
        .maybeSingle();

      if (
        managerError ||
        !manager ||
        manager.role !== "manager"
      ) {
        return response(
          {
            success: false,
            message: "حساب المدير غير موجود",
          },
          404,
        );
      }

      const permissions: Record<string, boolean> = {};

      for (const key of permissionKeys) {
        permissions[key] = body[key] === true;
      }

      const { error: saveError } = await admin
        .from("manager_permissions")
        .upsert({
          user_id: managerId,
          ...permissions,
          updated_at: new Date().toISOString(),
        });

      if (saveError) {
        return response(
          {
            success: false,
            message: "تعذر حفظ الصلاحيات: " + saveError.message,
          },
          400,
        );
      }

      return response({
        success: true,
        message: "تم حفظ صلاحيات المدير بنجاح",
      });
    }

    // ==========================================
    // DELETE USER
    // ==========================================

    if (action === "delete") {
      const userId = readText(body, "user_id", "userId");

      if (!validUUID(userId)) {
        return response(
          {
            success: false,
            message: "معرف المستخدم غير صحيح",
          },
          400,
        );
      }

      if (userId === caller.id) {
        return response(
          {
            success: false,
            message: "لا يمكنك حذف حسابك الحالي",
          },
          403,
        );
      }

      if (SERVER_OWNER_IDS.has(userId)) {
        return response(
          {
            success: false,
            message: "لا يمكن حذف حساب مالك السيرفر",
          },
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
          {
            success: false,
            message: "المستخدم غير موجود",
          },
          404,
        );
      }

      if (target.role === "server_owner") {
        return response(
          {
            success: false,
            message: "لا يمكن حذف حساب مالك السيرفر",
          },
          403,
        );
      }

      if (target.role === "delivery_driver") {
        return response(
          {
            success: false,
            message: "حساب المندوب محمي. حذفه يحتاج إجراء مخصص لإدارة المندوبين",
          },
          403,
        );
      }

      if (isManager) {
        if (
          !hasPermission(managerPermissions, "can_delete_staff") ||
          target.role !== "staff" ||
          target.branch_id !== caller.branch_id
        ) {
          return response(
            {
              success: false,
              message: "لا تملك صلاحية حذف هذا المستخدم",
            },
            403,
          );
        }
      } else if (!isServerOwner) {
        const allowedDeleteRoles = [
          "manager",
          "staff",
          "customer",
        ];

        if (!allowedDeleteRoles.includes(target.role)) {
          return response(
            {
              success: false,
              message: "لا تملك صلاحية حذف هذا الحساب",
            },
            403,
          );
        }
      } else {
        const allowedDeleteRoles = [
          "owner",
          "manager",
          "staff",
          "customer",
        ];

        if (!allowedDeleteRoles.includes(target.role)) {
          return response(
            {
              success: false,
              message: "لا يمكن حذف هذا النوع من الحسابات",
            },
            403,
          );
        }
      }

      const { error: deleteError } =
        await admin.auth.admin.deleteUser(userId);

      if (deleteError) {
        return response(
          {
            success: false,
            message: "تعذر حذف الحساب: " + deleteError.message,
          },
          400,
        );
      }

      return response({
        success: true,
        message: "تم حذف الحساب بنجاح",
      });
    }

    return response(
      {
        success: false,
        message: "الإجراء المطلوب غير معروف",
      },
      400,
    );
  } catch (error) {
    console.error("manage-users error:", getErrorMessage(error));

    return response(
      {
        success: false,
        message: getErrorMessage(error),
      },
      500,
    );
  }
});
