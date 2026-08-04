import { useQuery } from "@tanstack/react-query";
import { Building2, ShieldCheck, UserRoundCog, UsersRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, isDemoMode } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ErrorState, LoadingState } from "../components/Feedback";
import { Card } from "../components/ui/Card";
import { copy } from "../i18n/copy";
import type { Profile, RoleCode } from "../types";

const icons = { employee: UsersRound, hr: UserRoundCog, admin: ShieldCheck };
const descriptions = {
  employee: "จองและดูปฏิทินของฝ่ายตนเอง",
  hr: "จัดการฝ่าย พนักงานเดิม และดูรายงาน",
  admin: "เข้าถึงทุกฝ่าย ผู้ใช้ วันหยุด และรายงาน",
};

export function DemoSelectionPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["demo-profiles"],
    queryFn: () => apiFetch<Profile[]>("/api/demo/profiles"),
    enabled: isDemoMode,
  });
  if (!isDemoMode) return <ProductionLoginPage />;
  const select = async (profile: Profile) => {
    await auth.selectDemoProfile(profile.profileId);
    navigate("/");
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef2ff] p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3157d5] text-white">
            <Building2 />
          </div>
          <h1 className="text-3xl font-bold">{copy.appName}</h1>
          <p className="mt-2 text-[#667085]">เลือกบทบาทสำหรับการสาธิตระบบ</p>
          <span className="mt-3 inline-flex rounded-full bg-[#fff4e5] px-3 py-1 text-xs font-semibold text-[#b54708]">
            {copy.demoMode}
          </span>
        </div>
        {query.isLoading && <LoadingState />}
        {query.isError && (
          <ErrorState
            message={query.error.message}
            onRetry={() => void query.refetch()}
          />
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {query.data?.map((profile) => {
            const Icon = icons[profile.roleCode as RoleCode];
            return (
              <button
                key={profile.profileId}
                className="text-left"
                onClick={() => void select(profile)}
              >
                <Card className="h-full transition hover:-translate-y-1 hover:border-[#6684e4] hover:shadow-md">
                  <div className="mb-4 inline-flex rounded-xl bg-[#eef2ff] p-3 text-[#3157d5]">
                    <Icon />
                  </div>
                  <h2 className="text-lg font-bold">
                    {copy.roles[profile.roleCode]}
                  </h2>
                  <p className="mt-1 text-sm font-medium">{profile.fullName}</p>
                  <p className="mt-2 text-sm text-[#667085]">
                    {descriptions[profile.roleCode]}
                  </p>
                  <p className="mt-4 text-xs text-[#667085]">
                    {profile.departmentName}
                  </p>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function ProductionLoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setLoginError(null);
    try {
      await auth.signIn(String(data.get("email")), String(data.get("password")));
      navigate("/");
    } catch (caught) {
      setLoginError(caught instanceof Error ? caught.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ CoDesk</h1>
        <p className="mt-1 text-sm text-[#667085]">
          ใช้บัญชี Supabase Auth ขององค์กร
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void submit(event)}
        >
          <label>
            <span className="field-label">อีเมล</span>
            <input className="field-input" type="email" name="email" required />
          </label>
          <label>
            <span className="field-label">รหัสผ่าน</span>
            <input
              className="field-input"
              type="password"
              name="password"
              required
            />
          </label>
          {loginError && (
            <div role="alert" className="rounded-lg bg-[#fef3f2] p-3 text-sm text-[#b42318]">
              {loginError}
            </div>
          )}
          <button
            className="w-full rounded-lg bg-[#3157d5] px-4 py-2 font-semibold text-white"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
      </Card>
    </main>
  );
}
