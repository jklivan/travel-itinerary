# Place photo fallback

Cards with uploaded event photos continue to show those first. Cards without uploads request a Google Places photo when they enter the viewport. The endpoint accepts an existing item ID, resolves the trip's visibility, and uses the stored place ID or a conservative name-and-city match. Ambiguous results and provider/image errors retain the illustrated placeholder.

Configure `GOOGLE_PLACES_API_KEY` (or existing alias `GOOGLE_PLACES_API`) with Places API (New) access and billing enabled. Requests use Place Details or Text Search followed by Place Photos. These can incur Google Maps Platform charges. Set quotas in the Google Cloud project to suit expected traffic.

Photos and photo resource names are not persisted or server-cached. The browser loads Google's returned photo URI directly, without the Next image optimizer. Google Maps and returned photographer attribution appear next to each fallback photo. These images do not become the author's uploads or enter the trip photo gallery. The endpoint does not provide unpublished trip photos to other users.

Google Places requires public Terms of Use and Privacy Policy disclosures incorporating Google's applicable terms and privacy policy; the site's existing Places integration is subject to these requirements as well. Provider references:
- https://developers.google.com/maps/documentation/places/web-service/place-photos
- https://developers.google.com/maps/documentation/places/web-service/policies

Validation: matching, ambiguity, attribution, no-store, upload priority and unpublished trip access tests; mobile/desktop browser checks with simulated responses. A live lookup using only `.env.local` successfully retrieved a Nobu Hotel Ibiza Bay photo and its photographer credit. Google returns the local city name Eivissa, which is recognized as Ibiza during matching.
