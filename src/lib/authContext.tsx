"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isDemoMode: boolean;
    loginAsDemo: () => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isDemoMode: false,
    loginAsDemo: () => {},
    logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    useEffect(() => {
        // デモモードの状態を復元
        const demoModeActive = typeof window !== "undefined" && localStorage.getItem("demo_mode") === "true";
        if (demoModeActive) {
            setIsDemoMode(true);
            setUser({
                uid: "demo-user",
                email: "demo@example.com",
                displayName: "デモユーザー",
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
            } as any as User);
            setLoading(false);
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // デモモードでない場合のみ Firebase の認証状態を反映
            if (typeof window !== "undefined" && !localStorage.getItem("demo_mode")) {
                setUser(currentUser);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const loginAsDemo = () => {
        if (typeof window !== "undefined") {
            localStorage.setItem("demo_mode", "true");
        }
        setIsDemoMode(true);
        setUser({
            uid: "demo-user",
            email: "demo@example.com",
            displayName: "デモユーザー",
            emailVerified: true,
            isAnonymous: false,
            metadata: {},
            providerData: [],
        } as any as User);
    };

    const logout = async () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("demo_mode");
        }
        setIsDemoMode(false);
        setUser(null);
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, isDemoMode, loginAsDemo, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
