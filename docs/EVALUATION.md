# Illustrative search evaluation

Measured against six seeded stock-photo listings using six predefined text queries. Raw results are in `demo-evaluation.json`. These are hand-selected demonstration cases, not an independently collected benchmark.

| Method | Correct first result | Correct item in first five |
| --- | --- | --- |
| CLIP photo-vector search in Qdrant | 6/6 | 6/6 |
| Title/description token-overlap baseline | 3/6 | 4/6 |

The queries include direct object names and descriptions such as “something to listen to music with.” CLIP ranks photos; the baseline scores word overlap with listing titles and descriptions. It excludes zero-overlap records and uses listing UUIDs to break ties. Ties may change when samples are recreated with new IDs.

Top-five success has little value when there are only six candidates. This run does not test multiple similar belongings, unseen camera angles, lighting changes, ownership verification, or realistic campus use. The synthetic-image smoke check verifies the image-search execution path, not recognition accuracy for real belongings.

Before making accuracy claims, collect 20–40 actual objects, hold out separate query photos, choose text queries before inspecting search results, and report both successes and failures. Use `backend.evaluate --cases` for independently chosen text cases. Report image-query results separately.

## Reproduce

Start the app with `npm start`, then in another terminal:

```sh
npm run seed
npm run evaluate
```

Default results go to the ignored `data/evaluation.json`. To refresh the committed illustrative report explicitly:

```sh
.venv/bin/python -m backend.evaluate --output docs/demo-evaluation.json
```

The six image sources are specified by Unsplash photo IDs in `backend/demo_catalog.json`; exact download URLs and resulting listing IDs are saved in the ignored local `data/demo-manifest.json` when seeding.
