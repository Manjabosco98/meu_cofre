insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

create policy anexos_select on storage.objects for select
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy anexos_insert on storage.objects for insert
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy anexos_update on storage.objects for update
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy anexos_delete on storage.objects for delete
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
