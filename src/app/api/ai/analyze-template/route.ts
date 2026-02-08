import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { prompt, headers } = await request.json();

    if (!headers || headers.length === 0) {
      return NextResponse.json({ error: 'No headers provided' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const response = result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI analysis error:', error);
    
    // Return fallback analysis
    return NextResponse.json({
      mappings: [],
      summary: 'AI analysis unavailable, using fallback mapping',
    }, { status: 500 });
  }
}

