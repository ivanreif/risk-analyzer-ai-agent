import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://www.reddit.com/.json');
    if (!response.ok) {
      throw new Error('Failed to fetch data from Reddit');
    }
    const data = await response.json();
    
    // Extract relevant information from the Reddit response
    const posts = data.data.children.map((child: any) => ({
      title: child.data.title,
      author: child.data.author,
      subreddit: child.data.subreddit,
      score: child.data.score,
      url: `https://www.reddit.com${child.data.permalink}`,
    }));

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Error fetching Reddit data:', error);
    return NextResponse.json({ error: 'Failed to fetch Reddit data' }, { status: 500 });
  }
}
