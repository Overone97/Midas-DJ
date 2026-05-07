drop policy if exists "members can react to tracks" on public.votes;
create policy "members can react to tracks"
on public.votes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.room_members
      where room_members.room_id = votes.room_id
        and room_members.user_id = auth.uid()
        and room_members.is_banned = false
    )
    or exists (
      select 1 from public.rooms
      where rooms.id = votes.room_id
        and rooms.owner_id = auth.uid()
    )
  )
);
