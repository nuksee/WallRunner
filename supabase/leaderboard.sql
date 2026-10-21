-- Wall Runner C7 leaderboard (P3, B2, B4, B5).
--
-- Run once in the Supabase SQL editor. Safe to re-run: it replaces the
-- functions and keeps existing scores and players.
--
-- The browser only ever calls the two functions below with the public anon
-- key. Row level security is on with no policies, so the tables themselves
-- cannot be read or written from the browser.
--
-- Sanity limits mirror src/leaderboard/sanity.ts; change both together.
--
-- Manual removal path (nickname abuse, cheated scores), from the Table editor
-- or SQL editor:
--   update players set banned = true where nickname = 'BadName';   -- hide a player
--   update scores set hidden = true where id = 123;                -- hide one score

create table if not exists players (
  id uuid primary key,
  nickname text not null,
  banned boolean not null default false,
  last_submit_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists scores (
  id bigint generated always as identity primary key,
  player_id uuid not null references players (id) on delete cascade,
  score integer not null,
  distance integer not null,
  duration real not null,
  cause text not null,
  seed bigint not null,
  wall integer not null,
  air integer not null,
  near_miss integer not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists scores_score_idx on scores (score desc) where not hidden;
create index if not exists scores_player_idx on scores (player_id, score desc);

-- Words a nickname may not contain, after lower-casing and undoing common
-- letter swaps (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s). Add rows to extend.
create table if not exists blocked_words (word text primary key);
insert into blocked_words (word) values
  ('fuck'), ('shit'), ('cunt'), ('bitch'), ('nigg'), ('fag'), ('rape'), ('nazi'),
  ('hitler'), ('whore'), ('slut'), ('dick'), ('cock'), ('pussy'), ('penis'),
  ('vagina'), ('porn'), ('retard'), ('kike'), ('spic'), ('chink'), ('tranny'),
  ('admin'), ('moderator'), ('tesla')
on conflict do nothing;

alter table players enable row level security;
alter table scores enable row level security;
alter table blocked_words enable row level security;

create or replace function nickname_problem(name text) returns text
language plpgsql stable as $$
declare
  folded text;
begin
  if name is null or char_length(name) < 3 or char_length(name) > 16 then
    return 'Nickname must be 3 to 16 characters';
  end if;
  if name !~ '^[A-Za-z0-9_. -]+$' then
    return 'Use letters, numbers, spaces, dots, dashes or underscores';
  end if;
  folded := translate(lower(name), '013457@$', 'oieastas');
  folded := regexp_replace(folded, '[^a-z]', '', 'g');
  if exists (select 1 from blocked_words b where position(b.word in folded) > 0) then
    return 'Please pick a different nickname';
  end if;
  return null;
end $$;

create or replace function submit_score(
  p_player uuid,
  p_nickname text,
  p_score integer,
  p_distance integer,
  p_duration real,
  p_cause text,
  p_seed bigint,
  p_wall integer,
  p_air integer,
  p_near_miss integer
) returns json
language plpgsql security definer set search_path = public as $$
declare
  name text := btrim(p_nickname);
  problem text;
  last_at timestamptz;
  is_banned boolean;
  best integer;
  player_rank integer;
begin
  problem := nickname_problem(name);
  if problem is not null then
    return json_build_object('accepted', false, 'reason', problem);
  end if;

  -- B2: basic sanity checks. A run is rejected, not clamped.
  if p_cause not in ('pit', 'hazard', 'upside-down', 'charge')
     or p_duration < 1 or p_duration > 7200
     or least(p_score, p_distance, p_wall, p_air, p_near_miss) < 0
     or p_score <> p_distance + p_wall + p_air + p_near_miss
     or p_distance > p_duration * 30 + 20         -- average speed
     or p_wall > p_duration * 40                  -- 20 points/s, ceilings double
     or p_air > p_duration * 30                   -- 30 points/s of airtime
     or p_near_miss % 50 <> 0
     or p_near_miss / 50 > p_distance / 15 + 1    -- at most one fence every 15 m
  then
    return json_build_object('accepted', false, 'reason', 'Score failed the sanity check');
  end if;

  select p.last_submit_at, p.banned into last_at, is_banned from players p where p.id = p_player;

  -- One run cannot be longer than the time since the previous submission.
  if last_at is not null and now() - last_at < make_interval(secs => greatest(p_duration - 5, 3)) then
    return json_build_object('accepted', false, 'reason', 'Too many submissions, try again in a moment');
  end if;

  insert into players (id, nickname, last_submit_at) values (p_player, name, now())
  on conflict (id) do update set nickname = excluded.nickname, last_submit_at = excluded.last_submit_at;

  insert into scores (player_id, score, distance, duration, cause, seed, wall, air, near_miss)
  values (p_player, p_score, p_distance, p_duration, p_cause, p_seed, p_wall, p_air, p_near_miss);

  select max(s.score) into best from scores s where s.player_id = p_player and not s.hidden;
  select count(*) + 1 into player_rank from (
    select max(s.score) as top
    from scores s join players p on p.id = s.player_id
    where not s.hidden and not p.banned and p.id <> p_player
    group by s.player_id
  ) others where others.top > best;

  return json_build_object(
    'accepted', true,
    'best', best,
    'rank', case when coalesce(is_banned, false) then null else player_rank end
  );
end $$;

-- Each player's best visible score, highest first. Player ids stay private
-- (knowing one would let you post as that player); `me` marks the caller's row.
drop function if exists top_scores(integer);
drop function if exists top_scores(integer, uuid);
create function top_scores(p_limit integer default 50, p_player uuid default null)
returns table (rank bigint, me boolean, nickname text, score integer, distance integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select rank() over (order by b.score desc), coalesce(b.player_id = p_player, false), b.nickname, b.score, b.distance, b.created_at
  from (
    select distinct on (s.player_id) s.player_id, p.nickname, s.score, s.distance, s.created_at
    from scores s join players p on p.id = s.player_id
    where not s.hidden and not p.banned
    order by s.player_id, s.score desc, s.created_at
  ) b
  order by b.score desc, b.created_at
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function submit_score(uuid, text, integer, integer, real, text, bigint, integer, integer, integer) from public;
revoke all on function top_scores(integer, uuid) from public;
grant execute on function submit_score(uuid, text, integer, integer, real, text, bigint, integer, integer, integer) to anon, authenticated;
grant execute on function top_scores(integer, uuid) to anon, authenticated;
