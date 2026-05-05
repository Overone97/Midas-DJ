drop policy if exists "members can insert playback state" on public.playback_state;
create policy "members can insert playback state"
on public.playback_state
for insert
to authenticated
with check (
  auth.uid() = dj_user_id
  and exists (
    select 1 from public.room_members
    where room_members.room_id = playback_state.room_id
      and room_members.user_id = auth.uid()
      and room_members.is_banned = false
  )
);

drop policy if exists "dj can update playback state" on public.playback_state;
create policy "dj can update playback state"
on public.playback_state
for update
to authenticated
using (auth.uid() = dj_user_id)
with check (auth.uid() = dj_user_id);
