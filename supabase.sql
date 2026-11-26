-- Run this once in the Supabase SQL Editor for the Wishing Tree project.
create table if not exists public.wt_wishes (
  id uuid primary key default gen_random_uuid(),
  owner_hash text not null check (length(owner_hash)=64),
  request_id uuid not null,
  body text not null check (char_length(body) between 1 and 160),
  display_name text not null default '' check (char_length(display_name)<=16),
  created_at timestamptz not null default now(),
  stays integer not null default 0,
  unique(owner_hash,request_id)
);
create index if not exists wt_wishes_created_idx on public.wt_wishes(created_at desc);
create index if not exists wt_wishes_owner_created_idx on public.wt_wishes(owner_hash,created_at);
create table if not exists public.wt_wish_reads (
  wish_id uuid not null references public.wt_wishes(id) on delete cascade,
  reader_hash text not null check(length(reader_hash)=64),
  primary key(wish_id,reader_hash)
);
alter table public.wt_wishes enable row level security;
alter table public.wt_wish_reads enable row level security;
revoke all on public.wt_wishes,public.wt_wish_reads from anon,authenticated;
grant select,insert,update,delete on public.wt_wishes,public.wt_wish_reads to service_role;

create or replace function public.wt_snapshot(p_owner text) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select jsonb_build_object('mode','shared','left',greatest(0,3-(select count(*) from public.wt_wishes
    where owner_hash=p_owner and created_at >= (date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'))),
    'records',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'text',w.body,'name',w.display_name,
      'at',floor(extract(epoch from w.created_at)*1000),'mine',w.owner_hash=p_owner,'stays',w.stays) order by w.created_at,w.id)
      from (select * from public.wt_wishes where created_at>now()-interval '7 days' order by created_at desc,id desc limit 30) w),'[]'::jsonb));
$$;

create or replace function public.wt_submit(p_owner text,p_request uuid,p_text text,p_name text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare w public.wt_wishes%rowtype; result jsonb;
begin
  -- Serialize writes per browser to enforce the three-per-day quota atomically.
  perform pg_advisory_xact_lock(hashtextextended(p_owner,0));
  delete from public.wt_wishes where created_at<=now()-interval '7 days';
  select * into w from public.wt_wishes where owner_hash=p_owner and request_id=p_request;
  if not found then
    if (select count(*) from public.wt_wishes where owner_hash=p_owner and created_at >= (date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'))>=3 then
      return public.wt_snapshot(p_owner)||jsonb_build_object('ok',false,'reason','today');
    end if;
    insert into public.wt_wishes(owner_hash,request_id,body,display_name) values(p_owner,p_request,p_text,p_name) returning * into w;
  end if;
  result=public.wt_snapshot(p_owner)||jsonb_build_object('ok',true,'wish',jsonb_build_object('id',w.id,'text',w.body,'name',w.display_name,'at',floor(extract(epoch from w.created_at)*1000),'mine',true,'stays',w.stays));
  return result;
end;
$$;

create or replace function public.wt_read(p_owner text,p_wish uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare inserted integer;
begin
  insert into public.wt_wish_reads(wish_id,reader_hash)
  select id,p_owner from public.wt_wishes where id=p_wish and owner_hash<>p_owner and created_at>now()-interval '7 days'
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted>0 then update public.wt_wishes set stays=stays+1 where id=p_wish; end if;
  return jsonb_build_object('ok',true);
end;
$$;

revoke execute on function public.wt_snapshot(text),public.wt_submit(text,uuid,text,text),public.wt_read(text,uuid) from public,anon,authenticated;
grant execute on function public.wt_snapshot(text),public.wt_submit(text,uuid,text,text),public.wt_read(text,uuid) to service_role;
