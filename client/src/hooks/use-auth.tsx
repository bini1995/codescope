import { createContext, useContext } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signUp: (payload: { fullName: string; email: string; password: string }) => Promise<void>;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const signUpMutation = useMutation({
    mutationFn: async (payload: { fullName: string; email: string; password: string }) => {
      await apiRequest("POST", "/api/auth/register", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const signInMutation = useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      await apiRequest("POST", "/api/auth/login", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        signUp: async (payload) => signUpMutation.mutateAsync(payload),
        signIn: async (payload) => signInMutation.mutateAsync(payload),
        signOut: async () => signOutMutation.mutateAsync(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
