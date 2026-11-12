// OpenAI's check that Postcard owns this site, for listing the connector in ChatGPT's app directory
// (/.well-known/openai-apps-challenge, rewritten here in next.config.ts). The token isn't secret.
export function GET() {
  return new Response('VEKF6wp6l4zWZ8yuCAa--ZXwA7yaYVLsN4rY6tDUJuU', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}
