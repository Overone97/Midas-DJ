drop policy if exists "members can add queue items" on public.queue_items;
create policy "members can add queue items"
on public.queue_items
for insert
to authenticated
with check (
  auth.uid() = added_by
  and (
    exists (
      select 1 from public.room_members
      where room_members.room_id = queue_items.room_id
        and room_members.user_id = auth.uid()
        and room_members.is_banned = false
    )
    or exists (
      select 1 from public.rooms
      where rooms.id = queue_items.room_id
        and rooms.owner_id = auth.uid()
    )
  )
);
