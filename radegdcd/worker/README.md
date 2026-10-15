# radegdcd-secure-api · V2.5.9

`index.js` contains the existing Worker recovered from Quick Edit and the repaired generation endpoints. `reliable.js` handles bounded provider calls, fixed question slots, partial generation, and a separate choice-quality review. `../reliability.js` is the invariant checker shared with the browser.

The Worker uses the existing `AI` binding and the prompt secrets `SYSTEM_PROMPT_A`, `SYSTEM_PROMPT_B`, `SYSTEM_PROMPT_C`, `SYSTEM_REFINE_PROMPT`, and `SYSTEM_REVIEW_PROMPT` configured in Cloudflare. Secret values are not stored here.

From the repository root:

```sh
node --test radegdcd/worker/tests/*.test.js radegdcd/tests/*.test.cjs
node radegdcd/worker/build.mjs
node --check radegdcd/worker/dist/worker.mjs
```

The build has no npm dependencies. It creates **one self-contained ES module**, `dist/worker.mjs`, suitable for replacing the code in the existing Worker's Quick Edit. Do not paste `index.js` alone: it now imports the shared modules. Keep the existing Worker bindings, secrets and routes. Deploy the Worker before updating the frontend to V2.5.9.

To include private textbook sources, run `node radegdcd/worker/build.mjs --sources /path/to/lesson-sources.private.json`. The JSON maps lesson IDs to objects with a `text` string and bibliographic metadata. This optional input and the generated bundle must remain outside public frontend assets. The deployment package prepared for the owner includes 42 lessons recovered from the owner's four uploaded textbook text files; those textbook contents are not committed here.

The frontend checks that its version matches the Worker. It resumes both Gemini and Cloudflare generation through `/api/generation-plan`, `/api/generate-chunk`, and `/api/finalize-generation`. Partial questions awaiting review survive quota failures. Retries obey provider cooldown; API keys are excluded from browser progress storage.

The optional private KV binding `LESSON_SOURCE_KV` can supply textbook material. Keys are `lesson:<lessonId>` (for example `lesson:gdcd8_b03`), values are JSON objects containing source text and bibliographic metadata. No textbook contents or credential values are included in this repository. Without the binding or a matching source, the app explicitly reports that it is working from descriptors and still requires teacher review.

Automated tests mock provider outputs. A live Google API quota/latency test requires the user's own model access; the small "Kiểm tra AI" request now actually generates JSON rather than only listing models.
