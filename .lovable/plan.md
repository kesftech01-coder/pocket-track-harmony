# Public Pocket Track landing page

## What will change
- Replace the automatic home-page redirect with a public Pocket Track introduction.
- Present the product clearly: student balances, M-Pesa reconciliation, disbursement records, and unmatched-payment alerts.
- Add prominent teacher sign-in links while keeping all existing signed-in screens unchanged.
- Give the home page unique search and sharing metadata.

## Technical details
- Rebuild the `/` route as a responsive public page using the existing Pocket Track colors, typography, icons, and button component.
- Keep the page server-renderable and avoid browser-only session reads on the public route.
- Validate the page at desktop and mobile sizes and check the sign-in navigation.
