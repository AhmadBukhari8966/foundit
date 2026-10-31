# TRUFound option 1 verification

final result: passed

## Evidence

Source visual truth: `/Users/ahmadbukhari/.codex/generated_images/01a18f5b-6964-7183-9dc9-2814514e6ca8/exec-a2f82b21-b7bf-47d1-b082-ca1c51e6244d.png`, 1487 × 1058 pixels.

Implementation: local Vite preview at `http://127.0.0.1:5173/`, with the existing local API on port 8000. No public deployment, listing writes, database/schema changes, or hosting changes were made.

Desktop: `output/redesign/desktop.png`, 1487 × 1058 pixels at a 1487 × 1058 CSS viewport, device scale factor 1. No density resampling. State: newest-first browsing, four of six existing sample listings on page one; Pickler Memorial Library selected on the map, without applying a building filter.

Mobile: `output/redesign/mobile.png`, 390 × 2045 pixels, full-page capture from a fresh 390 × 844 CSS viewport, device scale factor 1. `mobile-viewport.png` shows the initial viewport. The desktop source has no mobile counterpart; the mobile review checks the responsive adaptation rather than claiming pixel identity.

Full-view comparison: `output/redesign/compare-full.jpg` places the actual reference and desktop capture in one comparison image. Focused comparisons: `compare-search.jpg`, `compare-cards.jpg`, and `compare-map.jpg`. Additional state evidence: `mobile-date-filter.png`, `mobile-photo-preview.png`, `post-form.png`, `expanded-map.png`, and `photo-search.png`. The post-form image is intentionally scrolled to the building picker and notes.

## Findings and comparison history

- Initial desktop comparison found excessive map control height and larger result photos than the reference. The desktop selector now shares the map header row, zoom controls sit over the map, and result photos use a shorter slot. The revised full-view and focused comparisons confirm the two-column search/results/map composition and visible building actions. The selected map panel ends at approximately y=1020 in the 1058px desktop viewport.
- The mobile date popover could extend beyond the left edge. It now anchors to the left on small screens. Browser measurements confirm it stays within 390px; `mobile-date-filter.png` records the state.
- A narrow mobile photo-selection toast wrapped excessively. An explicit intrinsic width fixes it; `mobile-photo-preview.png` shows the corrected message.
- Shift+Tab from the initially focused dialog container escaped the modal. Focus wrapping now includes that initial state, summaries and focusable map viewports. The repeated keyboard check passed in both directions, and Escape closes the dialog.
- The missing favicon caused one console 404. An empty favicon declaration removes that request. The final interaction run reported no console or page errors.

No actionable P0/P1/P2 findings remain in the reviewed states.

## Fidelity review

Fonts and typography: Manrope headings and DM Sans UI text load in the browser; purple headings, dark text, labeled camera action, and readable controls preserve the selected hierarchy. Focused search/card comparisons were inspected for wrapping and alignment.

Spacing and layout: results remain on the left and the campus map on the right at desktop widths, with a two-column item grid. Mobile stacks the workspace and wraps search/filter controls. No horizontal page overflow at 320, 390, 768, 1024 or 1487px.

Colors: white surfaces, #510c76 purple actions, restrained lavender highlights, and neutral dividers are consistent across browsing, forms and dialogs. The mobile browser theme color also uses purple.

Images: existing listing photos and the actual supplied campus map remain intact. No stock replacement records were added. The mock's invented building photo and street address are omitted; all 23 mapped buildings and legacy location handling remain available.

Copy: labels distinguish photo search, possible matches, sample listings, finder pickup notes, and walking directions. Actual local listing titles/dates/counts replace the mock's synthetic content. These data differences are intentional, as are the full date-range controls and original map/PDF geometry.

## Functional verification

Playwright with installed Chrome exercised the local app only:

- Real text and photo search returned HTTP 200 and six results each. Text scores remained in descending order, and browse sorting is hidden during similarity search. Photo preview/removal and clearing searches worked. This checks integration, not real-world retrieval accuracy.
- Bookmarks survived reload; Saved filtering, unsaving, empty states and pagination worked.
- Category, legacy location, from-date filtering, clearing filters/dates and oldest-first sorting worked after API requests settled.
- Building dropdown/marker selection, zoom, map-to-results filtering, expanded map, item detail and Escape close worked. Directions and PDF link destinations were inspected without navigating away.
- Post form accepted an image preview, category, building selection, description and pickup notes; its shared map picker selected the same building. The form was not submitted, so upload persistence was not retested.
- A locally simulated API failure displayed the error state; Retry restored the actual local listings.
- Modal keyboard focus wrapping and the mobile Saved empty state passed.

The production build, all three campus-map tests and git whitespace checks passed. The final interaction run logged no console or page errors. Hosted Supabase writes/browser CLIP were not rerun because this change leaves those integrations unchanged and verification was restricted to the local preview.

## Remaining polish

The actual map contains more markers than the generated concept because all existing campus buildings remain selectable. Actual listing photography varies in aspect ratio and composition. These are accepted product/data differences.
