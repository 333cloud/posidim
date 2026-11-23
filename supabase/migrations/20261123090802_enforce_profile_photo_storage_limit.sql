CREATE OR REPLACE FUNCTION private.enforce_profile_photo_object_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_folder text;
  v_count integer;
BEGIN
  IF NEW.bucket_id <> 'profile-photos' THEN
    RETURN NEW;
  END IF;
  v_user_folder := (storage.foldername(NEW.name))[1];
  IF v_user_folder IS NULL OR v_user_folder = '' THEN
    RAISE EXCEPTION 'Profile photos must be stored under a user folder';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile-photo-limit:' || v_user_folder, 0));
  SELECT count(*) INTO v_count
  FROM storage.objects o
  WHERE o.bucket_id = 'profile-photos'
    AND (storage.foldername(o.name))[1] = v_user_folder;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Profile photo limit reached (5)';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.enforce_profile_photo_object_limit() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS enforce_profile_photo_object_limit ON storage.objects;
CREATE TRIGGER enforce_profile_photo_object_limit
BEFORE INSERT ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION private.enforce_profile_photo_object_limit();