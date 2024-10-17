import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text');

    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
    }

    const encodedText = encodeURIComponent(text);
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;

    return NextResponse.json({ twitterIntentUrl });
  } catch (error) {
    console.error('Error creating Twitter intent URL:', error);
    return NextResponse.json({ error: 'Failed to create Twitter intent URL' }, { status: 500 });
  }
}
