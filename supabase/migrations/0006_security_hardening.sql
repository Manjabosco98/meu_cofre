alter function public.set_updated_at() set search_path = '';

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.seed_default_categories(uuid) from public, anon, authenticated;
