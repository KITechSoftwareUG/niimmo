import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "hausmeister";

export const useUserRole = () => {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        return null;
      }
      
      return data?.role as AppRole | null;
    },
    enabled: !!user?.id,
  });

  const isAdmin = role === 'admin';
  const isHausmeister = role === 'hausmeister';

  return {
    role,
    isAdmin,
    isHausmeister,
    isLoading,
  };
};
