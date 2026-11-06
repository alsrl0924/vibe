-- Existing shared project's app registry only; no schema or policy changes.
insert into public.study_apps(app_id,label)
values ('vibe-glossary','생성형AI용어집')
on conflict (app_id) do nothing;
