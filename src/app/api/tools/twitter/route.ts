import { TwitterResponse } from '@/types/tools';
import { createToolResponse, createErrorResponse } from '@/utils/tools';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text');
    const url = searchParams.get('url');
    const hashtags = searchParams.get('hashtags');
    const via = searchParams.get('via');

    if (!text) {
      return createErrorResponse('Text parameter is required', 400);
    }

    let twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

    if (url) {
      twitterIntentUrl += `&url=${encodeURIComponent(url)}`;
    }

    if (hashtags) {
      twitterIntentUrl += `&hashtags=${encodeURIComponent(hashtags)}`;
    }

    if (via) {
      twitterIntentUrl += `&via=${encodeURIComponent(via)}`;
    }

    return createToolResponse<TwitterResponse>({ twitterIntentUrl });
  } catch (error) {
    console.error('Error generating Twitter share intent:', error);
    return createErrorResponse('Failed to generate Twitter share intent', 500);
  }
}
