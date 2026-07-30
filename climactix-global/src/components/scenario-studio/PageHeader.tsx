"use client";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-ds-heading text-[28px] font-bold leading-tight text-ds-text sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl font-ds-body text-[14px] text-ds-text2">{description}</p>}
      </div>
      {action}
    </div>
  );
}
