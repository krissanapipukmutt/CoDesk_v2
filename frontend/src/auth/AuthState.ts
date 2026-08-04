import { createContext } from "react";
import type { CurrentUser } from "../types";

export interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  selectDemoProfile: (profileId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
export const AuthContext = createContext<AuthValue | null>(null);
