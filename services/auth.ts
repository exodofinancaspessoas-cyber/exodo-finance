
import { supabase, isSupabaseConfigured } from './supabase';
import { User } from '../types';
import { StorageService } from './storage';

export const AuthService = {
    async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
        if (!isSupabaseConfigured()) {
            return { user: null, error: 'Supabase não configurado.' };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Login error details:', error);
            return { user: null, error: error.message };
        }

        if (data.user) {
            // Get profile data
            let { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .maybeSingle();

            // If profile doesn't exist (legacy users), create it now
            if (!profile && !profileError) {
                const displayName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuário';

                const newProfile = {
                    id: data.user.id,
                    email: data.user.email,
                    name: displayName,
                    currency: 'BRL'
                };

                const { data: createdProfile, error: insertError } = await supabase
                    .from('profiles')
                    .upsert(newProfile)
                    .select()
                    .single();

                if (!insertError) {
                    profile = createdProfile;
                } else {
                    console.error('Error creating missing profile:', insertError);
                }
            }

            const user: User = {
                id: data.user.id,
                email: data.user.email || '',
                name: profile?.name || data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuário',
                password: '', // We don't store password in local state for Supabase users
            };

            StorageService.setUser(user);
            return { user, error: null };
        }

        return { user: null, error: 'Erro desconhecido' };
    },

    async signUp(email: string, password: string, name: string): Promise<{ user: User | null; error: string | null }> {
        if (!isSupabaseConfigured()) {
            return { user: null, error: 'Supabase não configurado.' };
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    name: name
                }
            }
        });

        if (error) return { user: null, error: error.message };

        if (data.user) {
            const user: User = {
                id: data.user.id,
                email: data.user.email || '',
                name: name,
                password: '',
            };
            StorageService.setUser(user);
            return { user, error: null };
        }

        return { user: null, error: 'Verifique seu e-mail para confirmar a conta.' };
    },

    async signOut() {
        if (isSupabaseConfigured()) {
            await supabase.auth.signOut();
        }
        StorageService.logout();
    }
};
