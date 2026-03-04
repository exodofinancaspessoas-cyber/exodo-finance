import { supabase } from '../services/supabase';
import { useState, useEffect } from 'react';

export function useIsAdmin(): boolean {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL ?? '';
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setIsAdmin(!!data.user?.email && data.user.email === adminEmail);
        });
    }, [adminEmail]);

    return isAdmin;
}
