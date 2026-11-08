-- Run from the repository root: bash tests/database/run-local.sh
-- Requires local PostgreSQL server binaries (initdb, pg_ctl, psql), no server
-- connection or credentials. The runner creates and removes a private cluster
-- in this checkout. contract-model.sql reconstructs the supplied schema and
-- RPC behavior, including the confirmed applied/version result keys; it is
-- not an extracted snapshot.
-- Passing tests cannot verify remote definitions, grants, policies or behavior.
\set ON_ERROR_STOP on
\ir contract-model.sql
\ir ../../supabase/migrations/202611080002_revoke_saved_recipes_extra_privileges.sql
\ir ../../supabase/migrations/202611080002_revoke_saved_recipes_extra_privileges.sql

DO $$
DECLARE privilege text;
BEGIN
  FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF NOT has_table_privilege('authenticated', 'public.saved_recipes', privilege) THEN
      RAISE EXCEPTION 'missing authenticated %', privilege;
    END IF;
  END LOOP;
  FOREACH privilege IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('authenticated', 'public.saved_recipes', privilege) THEN
      RAISE EXCEPTION 'authenticated retains %', privilege;
    END IF;
    IF NOT has_table_privilege('service_role', 'public.saved_recipes', privilege)
       OR NOT has_table_privilege('postgres', 'public.saved_recipes', privilege) THEN
      RAISE EXCEPTION 'privilege % changed for service_role or postgres', privilege;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('authenticated', 'public.apply_recipe_change(text,jsonb,boolean,integer,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.apply_recipe_change(text,jsonb,boolean,integer,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('postgres', 'public.apply_recipe_change(text,jsonb,boolean,integer,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.apply_recipe_change(text,jsonb,boolean,integer,uuid)', 'EXECUTE')
     OR EXISTS (
       SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       WHERE p.oid = 'public.apply_recipe_change(text,jsonb,boolean,integer,uuid)'::regprocedure
         AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
     )
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'public.apply_recipe_change(text,jsonb,boolean,integer,uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'model RPC execute/invoker contract changed';
  END IF;
END $$;
-- Direct REVOKE does not remove PUBLIC or membership-inherited privileges.
GRANT TRUNCATE ON public.saved_recipes TO PUBLIC;
\ir ../../supabase/migrations/202611080002_revoke_saved_recipes_extra_privileges.sql
DO $$ BEGIN
  IF NOT has_table_privilege('authenticated', 'public.saved_recipes', 'TRUNCATE') THEN
    RAISE EXCEPTION 'expected inherited PUBLIC privilege';
  END IF;
END $$;
REVOKE TRUNCATE ON public.saved_recipes FROM PUBLIC;
CREATE ROLE inherited_test_privilege NOLOGIN;
GRANT REFERENCES ON public.saved_recipes TO inherited_test_privilege;
GRANT inherited_test_privilege TO authenticated;
\ir ../../supabase/migrations/202611080002_revoke_saved_recipes_extra_privileges.sql
DO $$ BEGIN
  IF NOT has_table_privilege('authenticated', 'public.saved_recipes', 'REFERENCES') THEN
    RAISE EXCEPTION 'expected inherited role privilege';
  END IF;
END $$;
REVOKE inherited_test_privilege FROM authenticated;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
CREATE FUNCTION pg_temp.assert_invalid(p_recipe_id text, p_choices jsonb, p_deleted boolean, p_version integer, p_operation uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.apply_recipe_change(p_recipe_id, p_choices, p_deleted, p_version, p_operation);
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'invalid change accepted for %', p_recipe_id; END IF;
END $$;
DO $$ DECLARE r jsonb; BEGIN
  r := public.apply_recipe_change('coffee', '{"value":"initial"}', false, 0, '00000000-0000-0000-0000-000000000001');
  IF r->>'applied' IS DISTINCT FROM 'true' OR (r->>'version')::int IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'initial create failed: %', r; END IF;
  r := public.apply_recipe_change('stale-new', '{}', false, 5, '00000000-0000-0000-0000-000000000010');
  IF r->>'applied' IS DISTINCT FROM 'false' OR NOT (SELECT deleted FROM public.saved_recipes WHERE recipe_id = 'stale-new')
     OR (SELECT version FROM public.saved_recipes WHERE recipe_id = 'stale-new') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'stale initial operation did not retain version-zero tombstone';
  END IF;
  DELETE FROM public.saved_recipes WHERE recipe_id = 'stale-new';
  PERFORM pg_temp.assert_invalid('coffee', '{}', false, 1, NULL);
  PERFORM pg_temp.assert_invalid('coffee', '{}', false, NULL, '00000000-0000-0000-0000-000000000010');
  PERFORM pg_temp.assert_invalid('coffee', '{}', false, -1, '00000000-0000-0000-0000-000000000010');
  PERFORM pg_temp.assert_invalid('coffee', '{}', NULL, 1, '00000000-0000-0000-0000-000000000010');
  -- The proposed INSERT is checked even when an existing row has a mismatched
  -- version or the operation would otherwise be deduplicated.
  PERFORM pg_temp.assert_invalid('coffee', '[]', false, 999, '00000000-0000-0000-0000-000000000010');
  PERFORM pg_temp.assert_invalid('coffee', '[]', false, 0, '00000000-0000-0000-0000-000000000001');
  IF (SELECT version FROM public.saved_recipes WHERE recipe_id = 'coffee') IS DISTINCT FROM 1
     OR (SELECT choices->>'value' FROM public.saved_recipes WHERE recipe_id = 'coffee') IS DISTINCT FROM 'initial' THEN
    RAISE EXCEPTION 'invalid operation changed row';
  END IF;
  BEGIN
    INSERT INTO public.saved_recipes (recipe_id, choices) VALUES ('', '{}');
    RAISE EXCEPTION 'empty recipe id accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.saved_recipes (recipe_id, choices) VALUES (repeat('x', 201), '{}');
    RAISE EXCEPTION 'oversized recipe id accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.saved_recipes (recipe_id, choices) VALUES ('invalid', '[]');
    RAISE EXCEPTION 'non-object choices accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.saved_recipes (recipe_id, choices, version) VALUES ('invalid', '{}', -1);
    RAISE EXCEPTION 'negative version accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.saved_recipes (user_id, recipe_id, choices)
      VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'forged', '{}');
    RAISE EXCEPTION 'forged owner insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.saved_recipes SET user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    RAISE EXCEPTION 'owner reassignment succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    TRUNCATE public.saved_recipes;
    RAISE EXCEPTION 'truncate succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
DO $$ DECLARE n integer; r jsonb; BEGIN
  SELECT count(*) INTO n FROM public.saved_recipes;
  IF n <> 0 THEN RAISE EXCEPTION 'other owner visible'; END IF;
  UPDATE public.saved_recipes SET choices = '{"intrusion":true}'; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'other owner updated'; END IF;
  DELETE FROM public.saved_recipes; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'other owner deleted'; END IF;
  -- Same recipe ID must address the caller's row, never the other owner's.
  r := public.apply_recipe_change('coffee', '{"value":"second owner"}', false, 0, '00000000-0000-0000-0000-000000000002');
  IF r->>'applied' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'second owner create failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.saved_recipes) <> 1 OR
     (SELECT choices->>'value' FROM public.saved_recipes WHERE recipe_id = 'coffee') <> 'initial' THEN
    RAISE EXCEPTION 'second owner row leaked or modified first row';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
DELETE FROM public.saved_recipes WHERE recipe_id = 'coffee';
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.saved_recipes) THEN RAISE EXCEPTION 'unauthenticated identity visible'; END IF;
  PERFORM pg_temp.assert_invalid('new', '{}', false, 0, '00000000-0000-0000-0000-000000000010');
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM * FROM public.saved_recipes;
    RAISE EXCEPTION 'anon select succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.apply_recipe_change('coffee', '{}', false, 0, '00000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'anon RPC execute succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
