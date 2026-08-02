import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const { user, isLoading, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setUser(session.user);
      else logout();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [setUser, setLoading, logout]);

  return { user, isLoading };
}
