"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewPartyTransferRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/party-transfers");
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-500 text-xs">
      Loading Party Transfers...
    </div>
  );
}
