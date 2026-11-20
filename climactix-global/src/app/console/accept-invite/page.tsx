"use client";

import { Suspense } from "react";
import SetPassword from "@/components/cxt/SetPassword";

export default function Page() {
  return <Suspense><SetPassword mode="invite" /></Suspense>;
}
