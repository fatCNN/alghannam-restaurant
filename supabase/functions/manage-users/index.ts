
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================================================
   مطعم الغنّام — إدارة المستخدمين
   Supabase Edge Function: manage-users

   الأدوار:
   server_owner : مالك السيرفر
   owner        : صاحب المطعم
   manager      : مدير الفرع
   staff        : موظف
   customer     : زبون
========================================================= */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* =========================================================
   حسابات مالكي السيرفر
========================================================= */

const SERVER_OWNER_IDS = new Set([
  "489c60eb-5ae5-4611-96d6-b1d911e2686c",
  "1488410c-39a5-417b-92f6-c68ee55c886d",
]);

/* =========================================================
   الصلاحيات المتاحة للمدير
========================================================= */

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

/* =========================================================
   أنواع البيانات
========================================================= */

type CallerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  branch_id: string | null;
};

type ApiKeyDictionary = Record<string, string>;

/* =========================================================
   أدوات مساعدة
========================================================= */

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(error.message);
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "تعذر تحديد تفاصيل الخطأ.";
  }
}

/* =========================================================
   قراءة مفاتيح Supabase

   المفاتيح الجديدة:
   SUPABASE_SECRET_KEYS
   SUPABASE_PUBLISHABLE_KEYS

   هذه المتغيرات تحتوي JSON Dictionary،
   وليست مفتاح API نصياً مباشراً.

   ندعم أيضاً المفاتيح القديمة عند الحاجة.
========================================================= */

function getApiKeyFromDictionary(
  envName: string,
): string | null {
  const rawValue = Deno.env.get(envName);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as ApiKeyDictionary;

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      // المفتاح الافتراضي إن وجد
      if (
        typeof parsed.default === "string" &&
        parsed.default.trim()
      ) {
        return parsed.default.trim();
      }

      // إذا لم يوجد default نبحث عن أول مفتاح صالح
      const firstValidKey = Object.values(parsed).find(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0,
      );

      if (firstValidKey) {
        return firstValidKey.trim();
      }
    }
  } catch {
    // قد تكون القيمة مفتاحاً مباشراً وليس JSON
    const trimmed = rawValue.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function getSupabaseKeys() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  // المفتاح العام الجديد
  const publishableKey =
    getApiKeyFromDictionary("SUPABASE_PUBLISHABLE_KEYS") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY");

  // المفتاح السري الجديد
  const secretKey =
    getApiKeyFromDictionary("SUPABASE_SECRET_KEYS") ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  return {
    supabaseUrl,
    publishableKey,
    secretKey,
  };
}

/* =========================================================
   تشغيل الدالة
========================================================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return response(
      { error: "Method not allowed" },
      405,
    );
  }

  try {
    /* =====================================================
       01 — إعدادات Supabase
    ===================================================== */

    const {
      supabaseUrl,
      publishableKey,
      secretKey,
    } = getSupabaseKeys();

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Missing Supabase configuration:", {
        hasUrl: Boolean(supabaseUrl),
        hasPublishableKey: Boolean(publishableKey),
        hasSecretKey: Boolean(secretKey),
      });

      return response(
        {
          error:
            "إعدادات Supabase غير مكتملة. تحقق من إعدادات مفاتيح المشروع.",
        },
        500,
      );
    }

    /* =====================================================
       02 — التحقق من جلسة المستخدم
    ===================================================== */

    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return response(
        { error: "غير مصرح." },
        401,
      );
    }

    const token = authHeader.slice(7);

    const authClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: authData,
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !authData.user) {
      console.error(
        "Authentication error:",
        authError,
      );

      return response(
        { error: "جلسة الدخول غير صالحة." },
        401,
      );
    }

    const callerId = authData.user.id;

    /* =====================================================
       03 — إنشاء عميل الإدارة
    ===================================================== */

    const admin = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    /* =====================================================
       04 — التحقق من مالك السيرفر أولاً
    ===================================================== */

    const isServerOwner =
      SERVER_OWNER_IDS.has(callerId);

    let caller: CallerProfile;

    if (isServerOwner) {
      caller = {
        id: callerId,
        email: authData.user.email ?? null,
        full_name:
          authData.user.user_metadata?.full_name ??
          authData.user.user_metadata?.display_name ??
          "Server Owner",
        role: "server_owner",
        branch_id: null,
      };
    } else {
      const {
        data: profile,
        error: profileError,
      } = await admin
        .from("profiles")
        .select("id,email,full_name,role,branch_id")
        .eq("id", callerId)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Profile lookup error:",
          profileError,
        );

        throw new Error(
          `خطأ قراءة profiles: ${profileError.message}`,
        );
      }

      if (!profile) {
        return response(
          {
            error:
              "الحساب غير موجود في جدول profiles.",
          },
          403,
        );
      }

      caller = profile as CallerProfile;
    }

    /* =====================================================
       05 — تحديد صلاحيات المستدعي
    ===================================================== */

    const isOwner =
      isServerOwner ||
      caller.role === "owner" ||
      caller.role === "server_owner";

    const isManager =
      caller.role === "manager";

    if (!isOwner && !isManager) {
      return response(
        {
          error:
            "ليس لديك صلاحية إدارة المستخدمين.",
        },
        403,
      );
    }

    /* =====================================================
       06 — جلب صلاحيات المدير عند الحاجة
    ===================================================== */

    let ownPermissions: Record<string, any> | null =
      null;

    if (isManager) {
      const {
        data: permissions,
        error: permissionsError,
      } = await admin
        .from("manager_permissions")
        .select("*")
        .eq("user_id", callerId)
        .maybeSingle();

      if (permissionsError) {
        console.error(
          "Manager permissions error:",
          permissionsError,
        );

        throw new Error(
          `خطأ قراءة manager_permissions: ${permissionsError.message}`,
        );
      }

      ownPermissions = permissions;
    }

    const canManageBranchStaff =
      isManager &&
      ownPermissions?.can_manage_branch_staff === true;

    const canDeleteStaff =
      isManager &&
      ownPermissions?.can_delete_staff === true;

    /* =====================================================
       07 — قراءة بيانات الطلب
    ===================================================== */

    let body: Record<string, any>;

    try {
      body = await req.json();
    } catch {
      return response(
        { error: "صيغة الطلب غير صحيحة." },
        400,
      );
    }

    const action = body.action;

    /* =====================================================
       08 — عرض المستخدمين
    ===================================================== */

    if (action === "list") {
      if (isOwner) {
        const {
          data: users,
          error: usersError,
        } = await admin
          .from("profiles")
          .select(
            "id,email,full_name,role,branch_id,created_at,updated_at",
          )
          .order("created_at", {
            ascending: false,
          });

        if (usersError) {
          console.error(
            "Users list error:",
            usersError,
          );

          throw new Error(
            `خطأ قراءة قائمة المستخدمين: ${usersError.message}`,
          );
        }

        const {
          data: permissions,
          error: permissionsError,
        } = await admin
          .from("manager_permissions")
          .select("*");

        if (permissionsError) {
          console.error(
            "Permissions list error:",
            permissionsError,
          );

          throw new Error(
            `خطأ قراءة صلاحيات المستخدمين: ${permissionsError.message}`,
          );
        }

        return response({
          users: users ?? [],
          permissions: permissions ?? [],
          ownPermissions: null,
          isOwner: true,
          isServerOwner,
          canManageBranchStaff: true,
          canDeleteStaff: true,
        });
      }

      if (!canManageBranchStaff) {
        return response({
          users: [],
          permissions: [],
          ownPermissions,
          isOwner: false,
          isServerOwner: false,
          canManageBranchStaff: false,
          canDeleteStaff,
          warning:
            "لم يمنحك المالك صلاحية مشاهدة الموظفين.",
        });
      }

      const {
        data: users,
        error: usersError,
      } = await admin
        .from("profiles")
        .select(
          "id,email,full_name,role,branch_id,created_at",
        )
        .eq("role", "staff")
        .eq("branch_id", caller.branch_id)
        .order("created_at", {
          ascending: false,
        });

      if (usersError) {
        console.error(
          "Staff list error:",
          usersError,
        );

        throw new Error(
          `خطأ قراءة قائمة الموظفين: ${usersError.message}`,
        );
      }

      return response({
        users: users ?? [],
        permissions: [],
        ownPermissions,
        isOwner: false,
        isServerOwner: false,
        canManageBranchStaff: true,
        canDeleteStaff,
      });
    }

    /* =====================================================
       09 — إنشاء مستخدم أو مدير أو صاحب مطعم أو زبون
    ===================================================== */

    if (action === "create") {
      if (!isOwner) {
        return response(
          {
            error:
              "ليس لديك صلاحية إنشاء الحسابات.",
          },
          403,
        );
      }

      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();

      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();
      const branchId = String(body.branchId ?? "").trim();
      const role = body.role;

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return response(
          {
            error:
              "يرجى إدخال بريد إلكتروني صحيح.",
          },
          400,
        );
      }

      if (password.length < 8) {
        return response(
          {
            error:
              "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
          },
          400,
        );
      }

      if (!name) {
        return response(
          {
            error:
              "يرجى إدخال اسم المستخدم.",
          },
          400,
        );
      }

      if (
        !["staff", "manager", "owner", "customer"].includes(
          role,
        )
      ) {
        return response(
          {
            error:
              "الرتبة المطلوبة غير مسموحة.",
          },
          400,
        );
      }

      let finalBranchId: string | null = null;

      if (role === "staff" || role === "manager") {
        if (!branchId) {
          return response(
            {
              error:
                "يرجى اختيار فرع المستخدم.",
            },
            400,
          );
        }

        const {
          data: branch,
          error: branchError,
        } = await admin
          .from("branches")
          .select("id")
          .eq("id", branchId)
          .maybeSingle();

        if (branchError) {
          throw new Error(
            `خطأ التحقق من الفرع: ${branchError.message}`,
          );
        }

        if (!branch) {
          return response(
            {
              error:
                "الفرع المحدد غير موجود.",
            },
            400,
          );
        }

        finalBranchId = branchId;
      } else if (branchId) {
        const {
          data: branch,
          error: branchError,
        } = await admin
          .from("branches")
          .select("id")
          .eq("id", branchId)
          .maybeSingle();

        if (branchError) {
          throw new Error(
            `خطأ التحقق من الفرع: ${branchError.message}`,
          );
        }

        if (!branch) {
          return response(
            {
              error:
                "الفرع المحدد غير موجود.",
            },
            400,
          );
        }

        finalBranchId = branchId;
      }

      const {
        data: created,
        error: createError,
      } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: name,
          full_name: name,
        },
      });

      if (createError || !created.user) {
        throw new Error(
          createError?.message ||
            "تعذر إنشاء الحساب.",
        );
      }

      const newUserId = created.user.id;

      const {
        error: profileError,
      } = await admin
        .from("profiles")
        .upsert(
          {
            id: newUserId,
            email,
            full_name: name,
            role,
            branch_id: finalBranchId,
          },
          {
            onConflict: "id",
          },
        );

      if (profileError) {
        await admin.auth.admin.deleteUser(newUserId);

        throw new Error(
          `خطأ إنشاء سجل المستخدم: ${profileError.message}`,
        );
      }

      if (role === "manager") {
        const {
          error: permissionError,
        } = await admin
          .from("manager_permissions")
          .upsert(
            defaultPermissions(newUserId),
            {
              onConflict: "user_id",
            },
          );

        if (permissionError) {
          await admin.auth.admin.deleteUser(newUserId);

          throw new Error(
            `خطأ إنشاء صلاحيات المدير: ${permissionError.message}`,
          );
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
        message:
          role === "owner"
            ? "تم إنشاء حساب صاحب المطعم بنجاح."
            : "تم إنشاء المستخدم بنجاح.",
      });
    }

    /* =====================================================
       10 — تغيير رتبة المستخدم
    ===================================================== */

    if (action === "set_role") {
      if (!isOwner) {
        return response(
          {
            error:
              "ليس لديك صلاحية تغيير الرتب.",
          },
          403,
        );
      }

      const { userId, role } = body;

      if (!validUUID(userId)) {
        return response(
          {
            error:
              "معرّف المستخدم غير صحيح.",
          },
          400,
        );
      }

      if (
        !["owner", "manager", "staff", "customer"].includes(
          role,
        )
      ) {
        return response(
          {
            error:
              "الرتبة المطلوبة غير مسموحة.",
          },
          400,
        );
      }

      if (userId === callerId) {
        return response(
          {
            error:
              "لا يمكن تغيير رتبة حسابك من هنا.",
          },
          400,
        );
      }

      if (SERVER_OWNER_IDS.has(userId)) {
        return response(
          {
            error:
              "لا يمكن تغيير رتبة مالك السيرفر.",
          },
          403,
        );
      }

      const {
        data: target,
        error: targetError,
      } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError) {
        throw new Error(
          `خطأ قراءة المستخدم المطلوب: ${targetError.message}`,
        );
      }

      if (!target) {
        return response(
          {
            error:
              "المستخدم غير موجود.",
          },
          404,
        );
      }

      if (target.role === "server_owner") {
        return response(
          {
            error:
              "لا يمكن تغيير رتبة مالك السيرفر.",
          },
          403,
        );
      }

      if (
        target.role === "owner" &&
        !isServerOwner
      ) {
        return response(
          {
            error:
              "لا يمكن تعديل رتبة صاحب مطعم آخر.",
          },
          403,
        );
      }

      if (role === "manager") {
        const { error } = await admin
          .from("manager_permissions")
          .upsert(
            defaultPermissions(userId),
            {
              onConflict: "user_id",
              ignoreDuplicates: true,
            },
          );

        if (error) {
          throw new Error(
            `خطأ تجهيز صلاحيات المدير: ${error.message}`,
          );
        }
      }

      const {
        error: updateError,
      } = await admin
        .from("profiles")
        .update({ role })
        .eq("id", userId);

      if (updateError) {
        throw new Error(
          `خطأ تحديث رتبة المستخدم: ${updateError.message}`,
        );
      }

      if (role !== "manager") {
        const { error } = await admin
          .from("manager_permissions")
          .delete()
          .eq("user_id", userId);

        if (error) {
          throw new Error(
            `خطأ حذف صلاحيات المدير: ${error.message}`,
          );
        }
      }

      return response({
        success: true,
        message:
          "تم تحديث رتبة المستخدم.",
      });
    }

    /* =====================================================
       11 — حفظ صلاحيات المدير
    ===================================================== */

    if (action === "save_permissions") {
      if (!isOwner) {
        return response(
          {
            error:
              "ليس لديك صلاحية تحديد الصلاحيات.",
          },
          403,
        );
      }

      const { userId, permissions } = body;

      if (!validUUID(userId)) {
        return response(
          {
            error:
              "معرّف المستخدم غير صحيح.",
          },
          400,
        );
      }

      const {
        data: target,
        error: targetError,
      } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError) {
        throw new Error(
          `خطأ قراءة المدير: ${targetError.message}`,
        );
      }

      if (!target || target.role !== "manager") {
        return response(
          {
            error:
              "المستخدم المحدد ليس مديراً.",
          },
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
        .upsert(
          payload,
          {
            onConflict: "user_id",
          },
        );

      if (error) {
        throw new Error(
          `خطأ حفظ صلاحيات المدير: ${error.message}`,
        );
      }

      return response({
        success: true,
        message:
          "تم حفظ صلاحيات المدير.",
      });
    }

    /* =====================================================
       12 — حذف مستخدم
    ===================================================== */

    if (action === "delete") {
      const { userId } = body;

      if (!validUUID(userId)) {
        return response(
          {
            error:
              "معرّف المستخدم غير صحيح.",
          },
          400,
        );
      }

      if (userId === callerId) {
        return response(
          {
            error:
              "لا يمكنك حذف حسابك.",
          },
          403,
        );
      }

      if (SERVER_OWNER_IDS.has(userId)) {
        return response(
          {
            error:
              "لا يمكن حذف حساب مالك السيرفر.",
          },
          403,
        );
      }

      const {
        data: target,
        error: targetError,
      } = await admin
        .from("profiles")
        .select("id,role,branch_id")
        .eq("id", userId)
        .maybeSingle();

      if (targetError) {
        throw new Error(
          `خطأ قراءة حساب المستخدم: ${targetError.message}`,
        );
      }

      if (!target) {
        return response(
          {
            error:
              "المستخدم غير موجود.",
          },
          404,
        );
      }

      if (target.role === "server_owner") {
        return response(
          {
            error:
              "لا يمكن حذف حساب مالك السيرفر.",
          },
          403,
        );
      }

      if (
        target.role === "owner" &&
        !isServerOwner
      ) {
        return response(
          {
            error:
              "لا يمكن حذف حساب صاحب المطعم إلا بواسطة مالك السيرفر.",
          },
          403,
        );
      }

      if (isOwner) {
        // المالك يستطيع حذف الموظفين والمديرين والزبائن.
        // مالك السيرفر يستطيع أيضاً حذف أصحاب المطاعم.
      } else if (isManager) {
        if (!canDeleteStaff) {
          return response(
            {
              error:
                "لم يمنحك المالك صلاحية حذف الموظفين.",
            },
            403,
          );
        }

        if (target.role !== "staff") {
          return response(
            {
              error:
                "المدير يستطيع حذف الموظفين فقط.",
            },
            403,
          );
        }

        if (
          !caller.branch_id ||
          target.branch_id !== caller.branch_id
        ) {
          return response(
            {
              error:
                "لا يمكنك حذف موظف من فرع آخر.",
            },
            403,
          );
        }
      } else {
        return response(
          {
            error:
              "ليس لديك صلاحية الحذف.",
          },
          403,
        );
      }

      const {
        error: deleteError,
      } = await admin.auth.admin.deleteUser(userId);

      if (deleteError) {
        throw new Error(
          `خطأ حذف الحساب: ${deleteError.message}`,
        );
      }

      return response({
        success: true,
        message:
          "تم حذف الحساب.",
      });
    }

    /* =====================================================
       13 — عملية غير معروفة
    ===================================================== */

    return response(
      {
        error:
          "العملية المطلوبة غير معروفة.",
      },
      400,
    );

  } catch (error) {
    console.error(
      "manage-users error details:",
      error,
    );

    return response(
      {
        error: getErrorMessage(error),
      },
      500,
    );
  }
});
