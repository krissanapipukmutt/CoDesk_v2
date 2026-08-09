import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./auth/useAuth";
import { ErrorState, LoadingState } from "./components/Feedback";
import { AppLayout } from "./layouts/AppLayout";
import type { RoleCode } from "./types";
import { localizedError } from "./i18n/format";

const AdminUsersPage = lazy(() =>
  import("./pages/AdminUsersPage").then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const BookingsPage = lazy(() =>
  import("./pages/BookingsPage").then((module) => ({
    default: module.BookingsPage,
  })),
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((module) => ({
    default: module.CalendarPage,
  })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const DemoSelectionPage = lazy(() =>
  import("./pages/DemoSelectionPage").then((module) => ({
    default: module.DemoSelectionPage,
  })),
);
const DepartmentsPage = lazy(() =>
  import("./pages/DepartmentsPage").then((module) => ({
    default: module.DepartmentsPage,
  })),
);
const EmployeesPage = lazy(() =>
  import("./pages/EmployeesPage").then((module) => ({
    default: module.EmployeesPage,
  })),
);
const HolidaysPage = lazy(() =>
  import("./pages/HolidaysPage").then((module) => ({
    default: module.HolidaysPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);

function AuthenticatedApp() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <div className="min-h-screen">
        <LoadingState />
      </div>
    );
  if (!auth.user) return <Navigate to="/auth" replace />;
  return <AppLayout />;
}
function RoleRoute({
  roles,
  children,
}: {
  roles: RoleCode[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return user && roles.includes(user.roleCode) ? (
    children
  ) : (
    <Navigate to="/" replace />
  );
}
export default function App() {
  const { t } = useTranslation();
  const auth = useAuth();
  return (
    <>
      {auth.error && (
        <div className="fixed inset-x-0 top-0 z-[100] bg-[#fef3f2] p-2 text-center text-sm text-[#b42318]">
          <ErrorState
            message={localizedError(t, new Error(auth.error))}
            onRetry={() => void auth.refresh()}
          />
        </div>
      )}
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route
            path="/auth"
            element={
              auth.user ? <Navigate to="/" replace /> : <DemoSelectionPage />
            }
          />
          <Route element={<AuthenticatedApp />}>
            <Route index element={<DashboardPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route
              path="departments"
              element={
                <RoleRoute roles={["hr", "admin"]}>
                  <DepartmentsPage />
                </RoleRoute>
              }
            />
            <Route
              path="employees"
              element={
                <RoleRoute roles={["hr", "admin"]}>
                  <EmployeesPage />
                </RoleRoute>
              }
            />
            <Route
              path="reports"
              element={
                <RoleRoute roles={["hr", "admin"]}>
                  <ReportsPage />
                </RoleRoute>
              }
            />
            <Route
              path="holidays"
              element={
                <RoleRoute roles={["admin"]}>
                  <HolidaysPage />
                </RoleRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <RoleRoute roles={["admin"]}>
                  <AdminUsersPage />
                </RoleRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
