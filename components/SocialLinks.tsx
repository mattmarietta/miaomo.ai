// This component allows users to link their Google and GitHub accounts for enhanced security and convenience. 
// It checks if the user has already linked these accounts and provides buttons to link them if not. 
"use client";

import { useAuth } from "@/components/Auth";
import { GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";

export default function SocialLinks() {
    const { user, linkAccount } = useAuth();

    // helper
    const isLinked = (providerId: string) => {
        return user?.providerData.some((p) => p.providerId === providerId);
    };

    const handleLink = async (provider: 'google' | 'github') => {
        const authProvider = provider === 'google'
            ? new GoogleAuthProvider()
            : new GithubAuthProvider();
        
        try {
            await linkAccount(authProvider);
            alert(`Successfully linked ${provider} account!`); 
        } catch (err) {
            // alert handled
        }
    };

    return (
        <div className="p-4 border rounded-xl bg-gray-50 max-w-md">
            <h2 className="text-lg font-bold mb-4">Account Security</h2>

            <div className="space-y-3">
                {/* Google Status */}
                <div className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                    <span>Google</span>
                    {isLinked('google') ? (
                        <span className="text-green-600 font-medium">Connected</span>
                    ) : (
                        <button onClick={() => handleLink('google')} className="text-blue-500 hover:underline">
                        Link Google Account
                        </button>
                    )}
                </div>

                {/* GitHub Status */}
                <div className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                    <span>GitHub</span>
                    {isLinked('github') ? (
                        <span className="text-green-600 font-medium">Connected</span>
                    ) : (
                        <button onClick={() => handleLink('github')} className="text-blue-500 hover:underline">
                        Link GitHub Account
                        </button>
                    )}
                </div>
            </div>    
        </div>
    );
}
