CREATE POLICY push_notification_rate_limits_service_role_only
ON public.push_notification_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);