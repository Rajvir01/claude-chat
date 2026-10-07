-- Per-conversation settings. Null means "use the default".
alter table public.conversations
  -- Older models only (Sonnet 4.5, Haiku 4.5); newer models reject it.
  add column temperature real check (temperature between 0 and 1),
  -- Newer models only (Sonnet 5.5, Opus 5.5); older models reject it.
  add column effort text check (effort in ('low', 'medium', 'high')),
  -- Cap on reply length, in tokens.
  add column max_tokens integer check (max_tokens between 1 and 64000);
