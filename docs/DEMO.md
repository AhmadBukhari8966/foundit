# FoundIt judging walkthrough

## Before the meeting

Run `npm start`, then open http://127.0.0.1:8000. Keep that terminal running. In a second terminal, run `npm run seed` if the board has no sample listings. CLIP weights should be warmed up before the meeting with `.venv/bin/python -m backend.warmup`.

Have a real object, one photo of it for posting, and another photo taken from a different angle for searching. The six seeded stock photos support a fallback demo; they are not actual campus reports. Avoid presenting the stock-photo evaluation as real-world accuracy.

## A three-minute demonstration

1. **Problem, 20 seconds.** “Lost-and-found descriptions often differ. One person writes ‘audio gear,’ while another searches ‘something to listen to music with.’ FoundIt compares the appearance of found-item photos with text or image queries.”
2. **Text retrieval, 40 seconds.** Search “something to listen to music with.” Show where the headphones appear. Change the location or category to show that filters restrict candidates. Point out the SAMPLE label on stock listings.
3. **New upload, 50 seconds.** Post the real object with its location, date, and pickup notes. Search using the second photo. Report the observed result, including a failure if it occurs. Do not use the exact indexed photo as evidence of recognizing an object from another angle.
4. **Architecture, 30 seconds.** “FastAPI normalizes images. CLIP produces normalized 512-dimensional image and text vectors. Qdrant stores vectors and metadata, then ranks candidates by cosine similarity. The original images remain on disk.”
5. **Evidence and limits, 25 seconds.** Show the measured evaluation output. Explain its dataset size, keyword baseline, and whether it uses stock or independently collected photos. Similar-looking belongings can be confused, and scores are not ownership probabilities.
6. **Future work, 15 seconds.** Discuss verified pickup, accounts, better fine-detail retrieval, and testing with more real belongings. These are future features, not implemented claims.

## If asked about the theme

Qdrant performs the central retrieval operation. The frontend sends a query to the backend, CLIP generates its vector, and Qdrant searches stored photo embeddings. A keyword lookup does not produce the app's search results.

## If asked about completion

The local demo supports posting, persistent photos and metadata, text-to-image and image-to-image search, category/location/date filtering, saved bookmarks, and finder-written pickup notes. It has a one-command launcher, API validation tests, real-model smoke checks, a seed command, and evaluation tooling. It does not include accounts, verified ownership, messaging, or a public deployment.
