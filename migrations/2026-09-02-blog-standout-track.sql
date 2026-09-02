-- Album reviews keep coming back to the same shape: "the best song was X, and
-- it was produced by Y". That's the most useful thing a producer-run blog can
-- say about a record, so it gets real columns rather than being buried in
-- the body text — which also means it can be rendered as a highlight and fed
-- into the structured data.

alter table posts add column if not exists standout_track text;
alter table posts add column if not exists standout_producer text;
