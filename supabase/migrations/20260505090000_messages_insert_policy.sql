drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.room_members
      where room_members.room_id = messages.room_id
        and room_members.user_id = auth.uid()
        and room_members.is_banned = false
        and room_members.is_muted = false
    )
    or exists (
      select 1 from public.rooms
      where rooms.id = messages.room_id
        and rooms.owner_id = auth.uid()
    )
  )
);
