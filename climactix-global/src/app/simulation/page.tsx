import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Climate Risk Simulation — Climactix Global',
  description:
    'Real-time climate risk simulation on a global asset graph. NGFS scenarios, physical + transition risk, financial impact modelling.',
};

const ClimateRiskMap = dynamic(
  () => import('@/components/simulation/ClimateRiskMap'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center bg-black"
        style={{ height: 'calc(100vh - 44px)' }}
      >
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4B5563] mb-3 animate-pulse">
            Initialising Climate Risk Intelligence Layer
          </div>
          <div className="w-64 h-px bg-[#1A1A1A] mx-auto" />
        </div>
      </div>
    ),
  }
);

export default function SimulationPage() {
  return <ClimateRiskMap />;
}
