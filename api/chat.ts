import type { VercelRequest, VercelResponse } from '@vercel/node';

const DIFY_API_URL = 'http://150.158.57.162:8081/v1/chat-messages';
const DIFY_API_KEY = 'app-oYVKHjo6fnc6CNOjUwD6uYqc';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, inputs, response_mode, user, conversation_id } = req.body;

    const response = await fetch(DIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        inputs: inputs || {},
        response_mode: response_mode || 'blocking',
        user: user || 'website-visitor',
        conversation_id: conversation_id || '',
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
