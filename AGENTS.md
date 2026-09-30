<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Honeynet architecture
- AI persona + forensics run in one server-side call (`src/lib/deception.server.ts`) shared by console server fns and the sensor intake route — keeps console and real-sensor behavior identical.
- External sensors authenticate to `/api/public/sensor/ingest` with per-sensor bearer keys stored only as SHA-256 hashes — keys are shown once and revocable.
