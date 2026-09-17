-- Presentation-only semantic refund timeline plus provider-neutral advisory
-- management invalidation. Raw payment/refund transitions remain immutable.

begin;

create or replace function public.get_managed_order_refund_timeline_v2(
  p_restaurant_slug text,
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_record record;
  order_record public.orders%rowtype;
  payment_record public.payments%rowtype;
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');
  select * into order_record from public.orders order_value
  where order_value.id = p_order_id
    and order_value.restaurant_id = access_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;
  select * into payment_record from public.payments payment
  where payment.order_id = order_record.id
    and payment.restaurant_id = access_record.restaurant_id;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', 'refund:' || timeline.refund_id::text || ':' || timeline.semantic_state,
      'kind', 'refund', 'label', timeline.label,
      'actorName', timeline.actor_name, 'occurredAt', timeline.occurred_at
    ) order by timeline.occurred_at, timeline.sort_id)
    from (
      select distinct on (transition.refund_id, semantic.semantic_state)
             transition.refund_id,
             semantic.semantic_state,
             case semantic.semantic_state
               when 'requested' then 'Refund requested — '
               when 'processing' then 'Refund processing — '
               when 'completed' then 'Refund completed — '
               when 'failed' then 'Refund failed — '
               else 'Refund requires review — ' end
               || case when refund.currency = 'USD' then '$' else refund.currency || ' ' end
               || (refund.amount_cents / 100.0)::numeric(12,2)::text as label,
             case when semantic.semantic_state = 'requested'
               then membership.display_name else null end as actor_name,
             transition.created_at as occurred_at,
             transition.id as sort_id
      from public.payment_state_transitions transition
      join public.refunds refund on refund.id = transition.refund_id
      cross join lateral (select case
        when transition.event_type = 'refund.requested' then 'requested'
        when transition.event_type = 'refund.processing'
          or transition.next_state ->> 'refund' = 'processing' then 'processing'
        when transition.event_type = 'refund.succeeded'
          or transition.next_state ->> 'refund' = 'succeeded' then 'completed'
        when transition.event_type = 'refund.failed'
          or transition.next_state ->> 'refund' = 'failed' then 'failed'
        when transition.next_state ->> 'refund' = 'unknown' then 'unknown'
        else null end as semantic_state) semantic
      left join public.restaurant_memberships membership
        on membership.id::text = refund.requested_by
        and membership.restaurant_id = refund.restaurant_id
      where transition.payment_id = payment_record.id
        and semantic.semantic_state is not null
      order by transition.refund_id, semantic.semantic_state,
               transition.created_at, transition.id
    ) timeline
  ), '[]'::jsonb);
end;
$$;

create or replace function public.broadcast_refund_management_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_uuid uuid;
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    select payment.order_id into order_uuid
    from public.payments payment
    where payment.id = new.payment_id and payment.restaurant_id = new.restaurant_id;
    if order_uuid is not null then
      perform realtime.send(
        jsonb_build_object('orderId', order_uuid, 'change', 'order_changed'),
        'order_changed',
        'restaurant:' || new.restaurant_id::text || ':orders',
        true
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger refunds_broadcast_management_change
after insert or update of status on public.refunds
for each row execute function public.broadcast_refund_management_change_v1();

revoke all on function public.get_managed_order_refund_timeline_v2(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_managed_order_refund_timeline_v2(text, uuid)
  to authenticated;
revoke all on function public.broadcast_refund_management_change_v1()
  from public, anon, authenticated;

commit;
