-- Conversations: one row per chat in the sidebar.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New chat',
  system_prompt text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages: every turn of every conversation, in order.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  -- "on delete cascade": deleting a conversation deletes its messages too.
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) > 0),
  -- Assistant-only fields (null on user messages).
  stop_reason text,
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_read_input_tokens integer,
  cache_creation_input_tokens integer,
  created_at timestamptz not null default now()
);

-- "Give me this conversation's messages in order" is the most common query.
create index messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);
create index conversations_updated_at_idx
  on public.conversations (updated_at desc);

-- Bump conversations.updated_at on every new message, so the sidebar can
-- show the most recently active chat first.
create function public.touch_conversation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- Row Level Security with no policies = the public (publishable) key can't
-- read or write anything. Only our backend, using the secret key, can.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
