import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  currentStep: number;
  steps: { label: string; icon: string }[];
}

export default function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-between relative mb-8">
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0" />
      <div
        className="absolute top-5 left-0 h-0.5 bg-brand-teal z-0 transition-all duration-500"
        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step, i) => {
        const stepNum = i + 1;
        const done = stepNum < currentStep;
        const active = stepNum === currentStep;

        return (
          <div key={step.label} className="flex flex-col items-center z-10">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                "border-2 transition-all duration-300",
                done
                  ? "bg-brand-teal border-brand-teal text-white"
                  : active
                  ? "bg-white border-brand-teal text-brand-teal shadow-md"
                  : "bg-white border-gray-300 text-gray-400"
              )}
              aria-label={`Step ${stepNum}: ${step.label}`}
            >
              {done ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
            </div>
            <span
              className={cn(
                "mt-2 text-xs font-medium text-center hidden sm:block max-w-20",
                active ? "text-brand-teal" : done ? "text-gray-600" : "text-gray-400"
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
