"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Box } from "lucide-react";
import { useAuth } from "@/lib/authContext";

export default function LoginPage() {
    const { user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState("utomachi2024@gmail.com");
    const [password, setPassword] = useState("Utomachi315");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (err: any) {
            setError("ログインに失敗しました。システム管理者に確認してください。");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                <div className="p-8 pb-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-[#1e3a8a] mb-6">
                        <Box className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ウトマチ百貨店</h1>
                    <p className="text-slate-500 mt-2">統合管理ツールへログイン</p>
                </div>

                <div className="p-8 pt-0">
                    <div className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="text-center space-y-4">
                            <p className="text-sm text-slate-600">
                                事務員専用フェーズ：ボタンを押してツールを開始してください。
                            </p>

                            <button
                                onClick={() => handleLogin()}
                                disabled={loading}
                                className="w-full flex items-center justify-center py-4 px-4 bg-[#1e3a8a] text-white rounded-xl font-bold text-lg hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/20 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {loading ? "起動中..." : "管理ツールを開始する"}
                            </button>
                        </div>

                        {/* 従来のログインフォーム（将来の復活用にコメントアウト）
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">メールアドレス</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white"
                                    placeholder="admin@example.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">パスワード</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-6 flex items-center justify-center py-3 px-4 bg-[#1e3a8a] text-white rounded-lg font-medium hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/50 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? "ログイン中..." : "ログイン"}
                            </button>
                        </form>
                        */}
                    </div>
                </div>
            </div>
        </div>
    );
}
