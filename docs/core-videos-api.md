# Pulse `GET /api/videos` — contract for CORE

**Status:** Live on Pulse production as of 2026-04-23
**Owner:** Pulse engineering (Marvin Leventhal)
**Audience:** CORE engineering — for wiring the lesson editor's video picker

This document is the contract for the endpoint that replaces the `/platform/pulse-mappings` paste-an-`asset_id` bridge with a real picker. Pulse serves the data; CORE builds the UI.

---

## Purpose

A teacher authoring a lesson in CORE needs to map a CORE quiz to a specific Pulse video (so the quiz fires on video-complete). Today they paste a Pulse `asset_id` UUID. With this endpoint, CORE's lesson editor can render a dropdown of the school's videos — searchable, scrolled, with duration and filesize shown.

---

## Endpoint

```
GET https://pulse.inteliflowai.com/api/videos
```

### Headers

| Header | Required | Description |
|---|---|---|
| `X-Core-Secret` | yes | Shared platform secret. Pulse does a timing-safe compare against its `CORE_API_SECRET` env var. One value, same on both sides. |

**No per-tenant Bearer here.** This is a platform-to-platform read, not a tenant-scoped runtime call. The per-tenant Bearer keys you already hold (for `pulse-lesson-complete`) are a different auth channel — don't cross them.

`CORE_API_SECRET` is set in Pulse's Vercel env as of 2026-04-23. Marvin shared the value with CORE ops through the same 1Password vault you use for `CORE_PROVISIONING_SECRET`. Rotations require both sides to swap simultaneously.

### Query parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `school_id` | UUID | **yes** | — | The school the picker is browsing. Equals Pulse's `tenant_id` (Pulse uses `tenant_id` as `school_id` when provisioning keys, so the same UUID CORE already stores on `platform_api_keys.school_id` works here). |
| `q` | string | no | `""` | Case-insensitive substring filter on filename. Handy for search-as-you-type. |
| `limit` | int | no | `100` | Max rows returned. Capped server-side at `500`. |
| `offset` | int | no | `0` | For pagination. Pulse computes `total` against the full filtered set so you can page without re-counting. |

---

## Response

### `200 OK`

```json
{
  "videos": [
    {
      "asset_id": "a7f30b1c-...-uuid",
      "title": "Fractions Intro.mp4",
      "filename": "fractions-intro.mp4",
      "mime_type": "video/mp4",
      "size_bytes": 154321098,
      "duration_seconds": 540,
      "created_at": "2026-04-20T14:30:00Z",
      "uploader_email": "teacher@acme.edu"
    }
  ],
  "total": 47,
  "limit": 100,
  "offset": 0,
  "school": {
    "school_id": "same-as-tenant_id",
    "name": "Acme Academy"
  }
}
```

### Field notes

- **`asset_id`** — use this verbatim as the value you store in `pulse_lesson_quiz_map.asset_id`. Same field CORE already uses.
- **`title`** — Pulse returns `original_filename` if present, else `filename`. Good for the dropdown label. Keep `filename` around if you want to show the storage-path-friendly name separately.
- **`duration_seconds`** — captured client-side at upload time via a hidden `<video>` element reading metadata. May be `null` on:
  - Rows uploaded before 2026-04-23 (before the column existed)
  - Videos whose metadata didn't load (corrupt, unsupported codec, browser refused)
  - Future non-video asset types if filters ever expand
  Render `null` as "—" or omit the duration column.
- **`uploader_email`** — best-effort. `null` when `assets.uploaded_by` is null (system uploads, deleted users, old rows without attribution).
- **`total`** — count *after* `q` filter but *before* `limit`/`offset`. Paginate by incrementing `offset` until `offset + videos.length >= total`.
- **`school.name`** — the tenant display name as seen in Pulse admin. Show it in the picker header so a CORE platform admin browsing multiple schools doesn't confuse results.

### Server-side filters (not configurable)

Pulse applies these filters before returning:

- `tenant_id = school_id`
- `status = 'ready'` — excludes pending uploads, processing jobs, errored rows, deprecated assets
- `mime_type ILIKE 'video/%'` — excludes PDFs, images, JSON, etc.

Order is `created_at DESC` — newest uploads first.

---

## Errors

| Status | Body | Cause |
|---|---|---|
| `401` | `{"error": "Unauthorized"}` | Missing `X-Core-Secret`, wrong value, or `CORE_API_SECRET` unset on Pulse side (fail closed). |
| `400` | `{"error": "school_id is required"}` | Missing `school_id` query param. |
| `404` | `{"error": "Unknown school_id"}` | `school_id` doesn't match any `tenants.id` on Pulse. Could mean the school was deleted or you're passing a CORE-only UUID that was never onboarded to Pulse. |
| `429` | — | Rate limit: 120 req/min per IP on all cloud API routes (existing Pulse middleware). Well above any UX-reasonable picker load. |
| `500` | `{"error": "<db message>"}` | Supabase query failed. Retry with backoff; flag if persistent. |

---

## Example

```bash
# Minimal fetch
curl -sS -H "X-Core-Secret: $CORE_API_SECRET" \
  "https://pulse.inteliflowai.com/api/videos?school_id=a7f30b1c-..."

# Search + paginated
curl -sS -H "X-Core-Secret: $CORE_API_SECRET" \
  "https://pulse.inteliflowai.com/api/videos?school_id=...&q=fractions&limit=25&offset=0"
```

---

## Integration notes for CORE's picker

1. **Call pattern:** call on lesson editor open (or on "pick video" button click). Cache per `(school_id, q)` for the editor session; invalidate on explicit refresh.
2. **Search UX:** debounce `q` ~200ms. Pulse does a case-insensitive `ILIKE '%q%'` on filename so `"frac"` matches `"fractions-intro.mp4"` and `"REFRACTION.mp4"`.
3. **No video previews in this endpoint.** Deliberately. If CORE wants thumbnail or preview streaming, that's a separate conversation — Pulse's Jellyfin-fronted stream URLs require session tokens and aren't portable to CORE's UI.
4. **If you need more fields** (teacher_name, subject, grade tag, transcript availability), let Pulse know which and we'll extend the payload. Current fields are the minimum CORE was blocked on.
5. **Deletion / deprecation:** a video the teacher picks today may be soft-deleted later (status → `deprecated`). Pulse stops returning it from `/api/videos` but the `asset_id` remains valid for lookup. `pulse-lesson-complete` with a deprecated asset still works today but we may tighten that — flag stale mappings in your UI if your `pulse_lesson_quiz_map.asset_id` ever stops appearing here.

---

## What's unchanged

- `POST /api/attempts/pulse-lesson-complete` on CORE — unchanged. Same Bearer auth, same body, same three-mode response.
- `GET /api/attempts/pulse/export-classes` on CORE — unchanged.
- `/platform/pulse-mappings` on CORE — still works. Nothing about this endpoint forces a deprecation. The text-paste form and the dropdown picker can coexist; picker just becomes the primary UX.

---

## Changelog

- **2026-04-23** — Initial ship. Endpoint live on Pulse production. `CORE_API_SECRET` set on Pulse's Vercel. Awaiting CORE's picker implementation.
