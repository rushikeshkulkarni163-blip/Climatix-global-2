"use client";

import { useParams } from "next/navigation";
import AssessmentView from "@/components/cxt/Assessment";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <AssessmentView id={id} mode="reviewer" />;
}
