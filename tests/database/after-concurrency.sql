\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
DO $$ DECLARE r jsonb; row_data public.saved_recipes%ROWTYPE; BEGIN
  SELECT * INTO STRICT row_data FROM public.saved_recipes WHERE recipe_id = 'coffee';
  IF row_data.version <> 2 OR row_data.choices->>'value' <> 'first' OR row_data.last_operation <> '00000000-0000-0000-0000-000000000002' THEN
    RAISE EXCEPTION 'concurrent update was not atomic: %', row_data;
  END IF;
  r := public.apply_recipe_change('coffee', '{"value":"first"}', false, 1, '00000000-0000-0000-0000-000000000002');
  IF r->>'applied' IS DISTINCT FROM 'true' OR (r->>'version')::int IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'immediate retry failed'; END IF;
  r := public.apply_recipe_change('coffee', '{"value":"later"}', false, 2, '00000000-0000-0000-0000-000000000004');
  IF r->>'applied' IS DISTINCT FROM 'true' OR (r->>'version')::int IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'intervening update failed'; END IF;
  r := public.apply_recipe_change('coffee', '{"value":"first"}', false, 1, '00000000-0000-0000-0000-000000000002');
  IF r->>'applied' IS DISTINCT FROM 'false' OR (r->>'version')::int IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'old retry must be reconciled'; END IF;
  IF (SELECT choices->>'value' FROM public.saved_recipes WHERE recipe_id = 'coffee') <> 'later' THEN
    RAISE EXCEPTION 'old retry overwrote later change';
  END IF;
  r := public.apply_recipe_change('coffee', '{}', true, 3, '00000000-0000-0000-0000-000000000005');
  IF r->>'applied' IS DISTINCT FROM 'true' OR (r->>'version')::int IS DISTINCT FROM 4 OR NOT (SELECT deleted FROM public.saved_recipes WHERE recipe_id = 'coffee') THEN
    RAISE EXCEPTION 'soft deletion failed';
  END IF;
  r := public.apply_recipe_change('coffee', '{}', true, 3, '00000000-0000-0000-0000-000000000005');
  IF r->>'applied' IS DISTINCT FROM 'true' OR (r->>'version')::int IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'deletion retry failed';
  END IF;
  r := public.apply_recipe_change('coffee', '{"value":"stale"}', false, 3, '00000000-0000-0000-0000-000000000006');
  IF r->>'applied' IS DISTINCT FROM 'false' OR NOT (SELECT deleted FROM public.saved_recipes WHERE recipe_id = 'coffee') THEN
    RAISE EXCEPTION 'stale update resurrected tombstone';
  END IF;
  DELETE FROM public.saved_recipes WHERE recipe_id = 'coffee';
  IF EXISTS (SELECT FROM public.saved_recipes) THEN RAISE EXCEPTION 'physical owner delete failed'; END IF;
END $$;
RESET ROLE;
