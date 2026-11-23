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
  AND NOT EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = event_invitations.invitee_id)
       OR (b.blocker_id = event_invitations.invitee_id AND b.blocked_id = (SELECT auth.uid()))
);