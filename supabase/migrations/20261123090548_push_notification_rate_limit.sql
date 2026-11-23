CREATE TABLE IF NOT EXISTS public.push_notification_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);
ALTER TABLE public.push_notification_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_notification_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_notification_rate_limits TO service_role;
CREATE OR REPLACE FUNCTION public.consume_push_notification_budget(
  p_user_id uuid,
  p_max_requests integer DEFAULT 60,
  p_window_seconds integer DEFAULT 60
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 120
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid notification budget parameters';
  END IF;
  INSERT INTO public.push_notification_rate_limits(user_id, window_started_at, request_count)
  VALUES (p_user_id, now(), 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE
        WHEN public.push_notification_rate_limits.window_started_at <= now() - pg_catalog.make_interval(secs => p_window_seconds)
        THEN now() ELSE public.push_notification_rate_limits.window_started_at END,
      request_count = CASE
        WHEN public.push_notification_rate_limits.window_started_at <= now() - pg_catalog.make_interval(secs => p_window_seconds)
        THEN 1 ELSE least(public.push_notification_rate_limits.request_count + 1, p_max_requests + 1) END
  RETURNING request_count INTO v_count;
  RETURN v_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.consume_push_notification_budget(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_push_notification_budget(uuid, integer, integer) TO service_role;