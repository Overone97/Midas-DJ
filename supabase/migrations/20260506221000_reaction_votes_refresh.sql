alter table public.votes drop constraint if exists votes_type_check;
alter table public.votes add constraint votes_type_check check (type in ('woot', 'grab', 'meh'));

alter table public.votes drop constraint if exists votes_queue_item_id_user_id_type_key;
alter table public.votes drop constraint if exists votes_queue_item_id_user_id_key;
alter table public.votes add constraint votes_queue_item_id_user_id_key unique (queue_item_id, user_id);

drop policy if exists "members can react to tracks" on public.votes;
create policy "members can react to tracks"
on public.votes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.room_members
    where room_members.room_id = votes.room_id
      and room_members.user_id = auth.uid()
      and room_members.is_banned = false
  )
);

drop policy if exists "users can remove their reactions" on public.votes;
create policy "users can remove their reactions"
on public.votes
for delete
to authenticated
using (auth.uid() = user_id);
