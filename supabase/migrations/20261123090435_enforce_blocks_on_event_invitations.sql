-- Enforce mutual blocks at the database trigger layer. The inviter's RLS
-- visibility on user_blocks is limited to blocks they created, so a policy
-- subquery alone cannot see a reverse block created by the invitee.
CREATE OR REPLACE FUNCTION public.reject_blocked_event_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = NEW.inviter_id AND b.blocked_id = NEW.invitee_id)
       OR (b.blocker_id = NEW.invitee_id AND b.blocked_id = NEW.inviter_id)
  ) THEN
    RAISE EXCEPTION 'Cannot invite a blocked user';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.reject_blocked_event_invitation() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS reject_blocked_event_invitation ON public.event_invitations;
CREATE TRIGGER reject_blocked_event_invitation
BEFORE INSERT ON public.event_invitations
FOR EACH ROW
EXECUTE FUNCTION public.reject_blocked_event_invitation();

DROP TRIGGER IF EXISTS reject_blocked_event_invitation_acceptance ON public.event_invitations;
CREATE TRIGGER reject_blocked_event_invitation_acceptance
BEFORE UPDATE OF status ON public.event_invitations
FOR EACH ROW
WHEN (OLD.status = 'pending' AND NEW.status = 'accepted')
EXECUTE FUNCTION public.reject_blocked_event_invitation();

DROP POLICY IF EXISTS event_invites_create_host ON public.event_invitations;
CREATE POLICY event_invites_create_host
ON public.event_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  inviter_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_invitations.event_id
      AND e.host_id = (SELECT auth.uid())
      AND e.status = 'open'
  )
  AND event_invitations.status = 'pending'
  AND event_invitations.responded_at IS NULL
);