"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Auth callback error:", error);
        router.push("/auth?error=callback_failed");
        return;
      }

      if (session) {
        router.push("/dashboard");
      } else {
        // Try to exchange the code from the URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        
        if (accessToken) {
          router.push("/dashboard");
        } else {
          router.push("/auth");
        }
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
