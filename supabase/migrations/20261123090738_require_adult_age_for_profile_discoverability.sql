CREATE OR REPLACE FUNCTION public.guard_profile_discoverability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.is_discoverable IS TRUE AND (NEW.age IS NULL OR NEW.age < 18 OR NEW.age > 120) THEN
    RAISE EXCEPTION 'Для видимости профиля требуется указать возраст от 18 до 120 лет';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_profile_discoverability() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS profiles_require_adult_discoverability ON public.profiles;
CREATE TRIGGER profiles_require_adult_discoverability
BEFORE INSERT OR UPDATE OF age, is_discoverable ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_discoverability();