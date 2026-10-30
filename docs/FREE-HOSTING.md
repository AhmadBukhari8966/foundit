# Free hosting path

This path preserves the app's text and image search without running a paid Python server:

- GitHub Pages serves the React interface and browser worker.
- Transformers.js runs quantized CLIP in the visitor's browser, off the UI thread.
- A Supabase Free project stores photos, metadata, and 512-dimensional embeddings in PostgreSQL with pgvector. Cosine ranking runs inside the database through the `match_foundit_items` function.

The original FastAPI + Qdrant app still runs when no Supabase build settings are present. The optional Render template describes paid infrastructure and is not used for this free path.

## Account setup required

Install and connect Supabase in the chat, then select an existing Free project or create one on the Free plan. No paid plan is needed for this deployment path. Do not upgrade or attach paid add-ons.

1. Apply `supabase/migrations/202610300001_foundit.sql` once to the chosen new project.
2. Enable anonymous sign-ins in Supabase Authentication. The app creates a guest session only when someone posts an item. It does not need an email or password.
3. Use the project's public URL and publishable/anon key. Never put a service-role key or secret key in browser settings.
4. Set GitHub repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Enable GitHub Pages with GitHub Actions as its source, then manually run the `Publish free hosted frontend` workflow.

GitHub Free offers Pages for public repositories. If the repository is private and the account does not include private-repository Pages, publishing needs a public repository or a separate public frontend repository. This configuration does not change repository visibility automatically.

A Supabase project has not been provisioned simply by committing this setup. The database policies and public-site upload/search/reload flow must be verified after the account is connected, before calling the deployment complete.

## Local hosted-mode development

Copy `.env.example` to `.env.local`, set the Supabase public URL/key, then run `npm run dev`. Rebuild after changing environment settings for a production deployment. Leave the settings empty to use FastAPI instead.

Hosted records are separate from the local Qdrant dataset. Do not mix embeddings from other models into the hosted table. This version uses `Xenova/clip-vit-base-patch32`, quantized text and vision projection models, and normalizes both to unit length.

## Free-tier limits and browser requirements

Supabase currently lists 500 MB database space and 1 GB file storage on Free. Free projects can pause after a period of inactivity; check the dashboard before judging. Check the provider's current limits rather than treating free hosting as unlimited.

The browser downloads the CLIP text and vision models on first use and attempts to cache them. This requires a reasonably capable browser/device, enough memory, and a network connection for the first run. WASM inference uses one thread and does not need a GPU or cross-origin isolation. Progress is displayed while loading. Browsing existing items does not load CLIP.

Photos and listings are public. Database row-level security allows public reading and restricts new records and photo uploads to the authenticated guest's own ID. Clients cannot update or delete existing listings through this schema. Storage cleanup is allowed for a guest's unlinked upload after a failed post. Sample flags cannot be set through ordinary client insert privileges.

Anonymous sessions are not proof of ownership. Enable provider-side abuse protections for broad public use. This remains a codeathon demo without verified pickup, messaging, or moderation.

## Verification

The browser CLIP check passed in Chrome: text and image encoders returned normalized 512-dimensional embeddings, and “a blue square” ranked a blue image above a red image (cosine scores approximately 0.298 and 0.243). This verifies browser inference only, not database integration or real lost-item accuracy. To repeat it locally, run `npm run dev` and open `/checks/browser-clip.html`.

### After connection

1. Post a photo from browser A; search using a description and a different photo.
2. Open browser B without the same local storage; confirm the listing and photo are visible.
3. Confirm category/date/location filters and similarity order.
4. Confirm a different guest cannot insert under the first guest's user ID, update records, or overwrite photos.
5. Reload the public GitHub Pages URL and repeat a search.

The six-item Python/Qdrant report in `docs/EVALUATION.md` does not establish accuracy for this browser/pgvector implementation. Re-run evaluation with hosted data before reporting results for the hosted version.

## Primary references

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Free project inactivity](https://supabase.com/kb/faqs/platform/free-postgres-for-side-projects)
- [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Storage policies](https://supabase.com/docs/guides/storage/security/access-control)
- [CLIP browser checkpoint](https://huggingface.co/Xenova/clip-vit-base-patch32)
