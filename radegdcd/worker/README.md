# radegdcd-secure-api

`index.js` is the deployed Worker bundle recovered from Cloudflare Quick Edit at V2.5.5 and updated here for V2.5.6. The original build source was not present in this repository. Keep this file in sync with the Cloudflare Dashboard deployment until the original source project is restored.

The Worker uses the existing `AI` binding and the prompt secrets `SYSTEM_PROMPT_A`, `SYSTEM_PROMPT_B`, `SYSTEM_PROMPT_C`, `SYSTEM_REFINE_PROMPT`, and `SYSTEM_REVIEW_PROMPT` configured in Cloudflare. Secret values are not stored here.

Run `npm test` in this directory to check the generation endpoints and option validation.
