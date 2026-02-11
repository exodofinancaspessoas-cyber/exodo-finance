
import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { User } from '../types';
import { LayoutDashboard, Wallet, CreditCard, ArrowRightLeft, User as UserIcon } from 'lucide-react';

interface AuthProps {
    onLogin: (user: User) => void;
}

export default function Auth({ onLogin }: AuthProps) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isRegistering) {
            if (formData.password !== formData.confirmPassword) {
                setError('As senhas não conferem');
                return;
            }
            if (formData.name.length < 3) {
                setError('Nome muito curto');
                return;
            }

            const newUser: User = {
                id: StorageService.generateId(),
                name: formData.name,
                email: formData.email,
                password: formData.password
            };

            StorageService.setUser(newUser);
            onLogin(newUser);
        } else {
            const storedUser = StorageService.getUser();
            if (storedUser && storedUser.email === formData.email && storedUser.password === formData.password) {
                onLogin(storedUser);
            } else {
                setError('Email ou senha incorretos. (Se é o primeiro acesso, crie uma conta)');
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col md:flex-row">
                <div className="p-8 w-full">
                    <div className="flex items-center space-x-2 mb-8 justify-center text-orange-600">
                        <LayoutDashboard size={32} />
                        <h1 className="text-2xl font-bold text-slate-800">Êxodo Finance</h1>
                    </div>

                    <h2 className="text-xl font-bold text-center mb-6 text-slate-700">
                        {isRegistering ? 'Crie sua conta' : 'Acesse seu controle'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegistering && (
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Senha</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                required
                            />
                        </div>

                        {isRegistering && (
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Confirmar Senha</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    required
                                />
                            </div>
                        )}

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg transition-colors"
                        >
                            {isRegistering ? 'Criar Conta' : 'Entrar'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="text-sm text-slate-500 hover:text-orange-600 underline"
                        >
                            {isRegistering ? 'Já tem uma conta? Faça login' : 'Não tem conta? Crie agora'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
