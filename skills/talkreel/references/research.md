# Research: `sources.json`

Goal: a small set of verified sources that every figure, date and quote in the
talk can point to. The script cites them as `[s:id]`; scenes show them as
source labels; `talkreel check` fails on any `[s:id]` that is not here.

## Inputs

- The topic and outline in `talk.json`.
- Whatever the user gave you: docs, a repo path, links, notes. For a repo, read
  the README, the docs folder and the code the talk is about; cite the repo's
  own files by their GitHub URL (or a relative path if it is not public).

## `sources.json`

```json
{
  "sources": [
    {
      "id": "example-survey",
      "title": "Example Developer Survey 2025",
      "publisher": "Example Org",
      "url": "https://example.org/survey-2025/results#ai",
      "quote": "The exact sentence from the page, copied character for character.",
      "date": "2025-07-01",
      "accessed": "2026-10-21"
    }
  ]
}
```

| Field | Rule |
|---|---|
| `id` | Lowercase, digits and hyphens; unique; short and readable (`fowler-context`) |
| `title` | The page or document title, as shown on screen in the source label; at most 50 characters (a post with no title: "<Author> on X") |
| `publisher` | Who published it, organisation or person. The record's credit; not shown on screen |
| `url` | The exact page where the quote appears, not a home page |
| `quote` | Verbatim text from that page that contains the claim. Copy it; never paraphrase, never fix typos |
| `date` | Publication date `YYYY-MM-DD` (or `YYYY` if that is all the page says) |
| `accessed` | The day you read it |

## Rules

- **No unverified numbers.** A number enters the talk only if it appears in a
  source's `quote`. If you remember a figure but cannot open a page that states
  it, drop it or say it qualitatively ("most developers").
- **Fetch, do not recall.** Open every URL and copy the quote from the page you
  actually read. If a page will not load, the source does not go in.
- **Primary first.** Prefer the original survey, paper, spec, changelog or
  author's own post over an article about it.
- **Dates matter.** Tools change fast; prefer the newest primary source and
  note the date. Say "as of <month year>" in the script for time-sensitive
  claims.
- **Quotes on screen** (`quote` block) must be the `quote` field or an exact
  excerpt of it, with the speaker and the source.
- Aim for 8 to 20 sources for a 10-minute talk. More is noise.

## Done when

- `sources.json` parses, every entry has all fields, and every URL was opened
  in this session.
- You can list, for each planned chapter, which sources it will use.
