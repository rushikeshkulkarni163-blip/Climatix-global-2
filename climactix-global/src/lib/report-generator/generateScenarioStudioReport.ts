import type { ScenarioCompany, ScenarioRunResult } from '@/types/scenario-studio';
import { SCENARIO_FAMILIES } from '@/lib/simulation/scenarioFamilies';

const NAVY: [number, number, number] = [17, 17, 17];
const ACCENT: [number, number, number] = [11, 61, 145];
const MUTED: [number, number, number] = [107, 114, 128];
const BG: [number, number, number] = [234, 240, 250];

export async function generateScenarioStudioReport(company: ScenarioCompany, run: ScenarioRunResult): Promise<void> {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 18;
  let y = 0;

  const family = SCENARIO_FAMILIES[run.scenario];

  function setColor(c: [number, number, number]) {
    doc.setTextColor(...c);
  }

  function addHeader(title: string, subtitle: string) {
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, M, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, M, 19);
    y = 32;
  }

  function addFooter(pageNum: number) {
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text('Confidential — Climactix Global Scenario Studio', M, 290);
    doc.text(`Page ${pageNum}`, W - M, 290, { align: 'right' });
  }

  // ── Cover ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 297, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('CLIMACTIX GLOBAL', W / 2, 100, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Scenario Studio — Climate Risk Intelligence Report', W / 2, 110, { align: 'center' });

  doc.setFillColor(...ACCENT);
  doc.roundedRect(M, 140, W - M * 2, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.name, W / 2, 150, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const meta: [string, string][] = [
    ['Industry', company.industry],
    ['Country', company.country],
    ['Scenario family', family.label],
    ['Horizon year', String(run.year)],
    ['Generated', new Date().toLocaleDateString()],
  ];
  let metaY = 170;
  meta.forEach(([k, v]) => {
    doc.text(`${k}:`, M + 6, metaY);
    doc.setFont('helvetica', 'bold');
    doc.text(v, 80, metaY);
    doc.setFont('helvetica', 'normal');
    metaY += 8;
  });
  if (company.isSample) {
    doc.setFontSize(8);
    doc.text('SAMPLE / DEMO PORTFOLIO — not a real client record', M + 6, metaY + 4);
  }

  // ── Executive Summary ──
  doc.addPage();
  addHeader('Executive Summary', `${company.name} · ${family.label} · ${run.year} horizon`);

  setColor(NAVY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const summaryLines = doc.splitTextToSize(family.description, W - M * 2) as string[];
  doc.text(summaryLines, M, y);
  y += summaryLines.length * 4.5 + 8;

  (doc as unknown as { autoTable: (opts: object) => void }).autoTable({
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Portfolio revenue', `$${run.portfolio.totalRevenueM.toFixed(0)}M`],
      ['Revenue at risk', `$${run.portfolio.totalRevenueAtRiskM.toFixed(1)}M`],
      ['EBITDA at risk', `$${run.portfolio.totalEbitdaAtRiskM.toFixed(1)}M`],
      ['Compliance cost (annual)', `$${run.portfolio.totalComplianceCostM.toFixed(2)}M`],
      ['Climate VaR (95%)', `$${run.portfolio.climateVaR95.valueAtRiskUsdM.toFixed(1)}M`],
      ['Climate VaR (99%)', `$${run.portfolio.climateVaR99.valueAtRiskUsdM.toFixed(1)}M`],
    ],
    theme: 'striped',
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: BG },
    margin: { left: M, right: M },
  });

  addFooter(2);

  // ── Asset Risk Table ──
  doc.addPage();
  addHeader('Asset-Level Risk', 'Physical + transition risk per facility');

  (doc as unknown as { autoTable: (opts: object) => void }).autoTable({
    startY: y,
    head: [['Asset', 'Physical', 'Transition', 'Revenue at risk', 'Rating']],
    body: run.assetProfiles.map((p) => [
      p.assetId,
      p.physicalRisk.toFixed(0),
      p.transitionRisk.toFixed(0),
      `${p.revenueAtRisk.toFixed(1)}%`,
      p.riskLevel.toUpperCase(),
    ]),
    theme: 'striped',
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: BG },
    margin: { left: M, right: M },
  });

  addFooter(3);

  // ── Methodology ──
  doc.addPage();
  addHeader('Methodology', 'Full detail at /scenario-studio/risk-engine');
  setColor(NAVY);
  doc.setFontSize(9);
  const methodText =
    `Physical risk: 28% heat stress + 32% flood + 22% storm/cyclone + 18% drought, scaled by scenario physical multiplier and sector weight.\n\n` +
    `Transition risk: 62% policy risk + 38% technology risk, scaled by scenario transition multiplier and sector weight.\n\n` +
    `Climate VaR: parametric (variance-covariance) method. VaR = Expected Annual Loss x (1 + z * coefficient of variation), ` +
    `z95=1.645, z99=2.326. Coefficient of variation widens for disorderly/fragmented scenarios.\n\n` +
    `Source: NGFS Phase IV/V Scenario Explorer (published reference scenarios) + Climactix geographic and sector risk models.`;
  const lines = doc.splitTextToSize(methodText, W - M * 2) as string[];
  doc.text(lines, M, y);

  addFooter(4);

  doc.save(`Climactix_ScenarioStudio_${company.name.replace(/\s+/g, '_')}_${run.scenario}_${run.year}.pdf`);
}
