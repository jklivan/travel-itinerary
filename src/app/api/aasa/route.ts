import { APP_BUNDLE_ID } from '@/lib/nativeSignInIds'

// Apple's app-site-association file (served at /.well-known/apple-app-site-association, see next.config.ts): lets the
// iPhone app open postcardtravel.app links (emails, texts) instead of Safari, when it's installed. Everything except
// the API and the connector's sign-in pages.
const TEAM_ID = 'P53B7VTVQ6'

export function GET() {
  return Response.json({
    applinks: { details: [{ appIDs: [`${TEAM_ID}.${APP_BUNDLE_ID}`], components: [
      { '/': '/api/*', exclude: true, comment: 'API' },
      { '/': '/oauth/*', exclude: true, comment: 'AI assistants signing in' },
      { '/': '/.well-known/*', exclude: true },
      { '/': '*', comment: 'Everything else opens in the app' },
    ] }] },
  }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
