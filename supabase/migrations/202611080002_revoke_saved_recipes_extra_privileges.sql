-- Additive hardening for the reported saved_recipes contract. The invoker RPC
-- still needs authenticated SELECT, INSERT, UPDATE and DELETE; do not revoke
-- those or change any other role's grants here.
--
-- REVOKE only removes direct grants to authenticated. Before deployment,
-- review effective privileges inherited through PUBLIC or role membership,
-- as well as apply_recipe_change's EXECUTE ACL and SECURITY INVOKER setting.
-- This migration deliberately does not guess or alter those existing grants.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.saved_recipes FROM authenticated;
