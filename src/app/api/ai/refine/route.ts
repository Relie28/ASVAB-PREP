import { NextResponse } from 'next/server';
import { backgroundRefineFullTest } from '@/lib/question-generator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
  const { arQuestions, mkQuestions, timeoutMs = 30000, heavy = false } = body;
    // Run server-side backgroundRefine
  const refined = await backgroundRefineFullTest(arQuestions || [], mkQuestions || [], null, { timeoutMs, heavy });
    return NextResponse.json(refined, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
