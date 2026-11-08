-- Local reconstruction from the supplied contract, not an extracted snapshot.
-- Only the described fields and RPC behavior are modeled; compare the deployed
-- definition before relying on these checks.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE postgres NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

CREATE TABLE public.saved_recipes (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  recipe_id text NOT NULL CHECK (length(recipe_id) BETWEEN 1 AND 200),
  choices jsonb NOT NULL CHECK (jsonb_typeof(choices) = 'object'),
  deleted boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  last_operation uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);
ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select ON public.saved_recipes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY owner_insert ON public.saved_recipes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_update ON public.saved_recipes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_delete ON public.saved_recipes FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.saved_recipes TO authenticated, service_role, postgres;

CREATE FUNCTION public.apply_recipe_change(p_recipe_id text, p_choices jsonb, p_deleted boolean, p_version integer, p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE
  current_row public.saved_recipes%ROWTYPE;
  owner_id uuid := auth.uid();
BEGIN
  IF owner_id IS NULL OR p_operation IS NULL OR p_version IS NULL OR p_version < 0 OR p_deleted IS NULL THEN
    RAISE EXCEPTION 'Invalid recipe change';
  END IF;
  INSERT INTO public.saved_recipes (user_id, recipe_id, choices, deleted)
    VALUES (owner_id, p_recipe_id, p_choices, true) ON CONFLICT (user_id, recipe_id) DO NOTHING;
  SELECT * INTO STRICT current_row FROM public.saved_recipes
    WHERE user_id = owner_id AND recipe_id = p_recipe_id FOR UPDATE;
  IF current_row.last_operation = p_operation THEN
    RETURN pg_catalog.jsonb_build_object('applied', true, 'version', current_row.version);
  END IF;
  IF current_row.version <> p_version THEN
    RETURN pg_catalog.jsonb_build_object('applied', false, 'version', current_row.version);
  END IF;
  UPDATE public.saved_recipes SET choices = p_choices, deleted = p_deleted,
    version = current_row.version + 1, last_operation = p_operation, updated_at = pg_catalog.now()
    WHERE user_id = owner_id AND recipe_id = p_recipe_id;
  RETURN pg_catalog.jsonb_build_object('applied', true, 'version', current_row.version + 1);
END $$;
ALTER FUNCTION public.apply_recipe_change(text,jsonb,boolean,integer,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.apply_recipe_change(text,jsonb,boolean,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_recipe_change(text,jsonb,boolean,integer,uuid)
  TO authenticated, service_role;
