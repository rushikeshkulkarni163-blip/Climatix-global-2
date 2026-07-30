import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

const SYSTEM_PROMPT = `You are the Climactix Climate Analyst — an institutional climate-risk analyst embedded in Climactix Global's Scenario Studio.

You answer questions ONLY using the simulation context provided in the user message (the selected company, scenario family, horizon year, portfolio risk metrics, and asset-level risk profiles). Never invent numbers, emissions figures, financial values, or commitments that are not present in the supplied context.

If the context does not contain enough information to answer precisely, say so explicitly and state what additional data or simulation run would be needed — do not guess or estimate a number.

Tone: institutional, precise, Moody's/MSCI-grade. No sustainability buzzwords, no marketing language, no hedge-free overclaiming. Cite the specific evidence field (e.g. "per the Delayed Transition run at 2040 horizon, physical risk 62/100") when referencing a number.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        success: true,
        data: {
          answer:
            'The AI Climate Analyst requires an ANTHROPIC_API_KEY to be configured on the server. Ask your administrator to set it in Settings before this feature is available.',
        },
      },
      { headers: corsHeaders() }
    );
  }

  try {
    const body = (await req.json()) as { question?: string; context?: unknown };
    if (!body.question) {
      return NextResponse.json({ success: false, error: 'question is required' }, { status: 400, headers: corsHeaders() });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Simulation context (JSON):\n${JSON.stringify(body.context ?? {}, null, 2)}\n\nQuestion: ${body.question}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { success: true, data: { answer: 'The analyst declined to answer this request.' } },
        { headers: corsHeaders() }
      );
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const answer = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    return NextResponse.json({ success: true, data: { answer } }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { success: false, error: 'The AI Climate Analyst is temporarily unavailable' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
