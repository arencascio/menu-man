-- Menu Man Order Management: invite-only restaurant memberships, granular
-- capabilities, provider-independent fulfillment, immutable operator audit,
-- restricted read models, and advisory PII-free realtime invalidations.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.restaurant_capabilities (
  capability text primary key,
  description text not null,
  constraint restaurant_capabilities_key_check check (
    capability ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  constraint restaurant_capabilities_description_check check (btrim(description) <> '')
);

insert into public.restaurant_capabilities (capability, description) values
  ('view_orders', 'View restaurant order queues and immutable order snapshots'),
  ('advance_fulfillment', 'Advance orders through the fulfillment workflow'),
  ('view_customer_contact', 'View customer names and contact information'),
  ('export_order_history', 'Export restaurant order history'),
  ('issue_refunds', 'Issue provider-backed refunds when a future workflow is enabled'),
  ('correct_fulfillment', 'Perform a future reason-required audited fulfillment correction'),
  ('manage_memberships', 'Manage restaurant users, roles, and permission overrides');

create table public.restaurant_role_capability_defaults (
  role text not null,
  capability text not null references public.restaurant_capabilities(capability) on delete restrict,
  allowed boolean not null,
  primary key (role, capability),
  constraint restaurant_role_capability_defaults_role_check check (
    role in ('owner', 'manager', 'staff')
  )
);

insert into public.restaurant_role_capability_defaults (role, capability, allowed)
select role_value.role_name, capability.capability,
  case
    when role_value.role_name = 'owner' then true
    when role_value.role_name = 'manager' then capability.capability in (
      'view_orders', 'advance_fulfillment', 'view_customer_contact', 'export_order_history'
    )
    else capability.capability in (
      'view_orders', 'advance_fulfillment', 'view_customer_contact'
    )
  end
from unnest(array['owner', 'manager', 'staff']::text[]) as role_value(role_name)
cross join public.restaurant_capabilities capability;

create table public.restaurant_memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  status text not null default 'active',
  display_name text not null,
  created_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint restaurant_memberships_restaurant_id_id_key unique (restaurant_id, id),
  constraint restaurant_memberships_restaurant_user_key unique (restaurant_id, user_id),
  constraint restaurant_memberships_role_check check (role in ('owner', 'manager', 'staff')),
  constraint restaurant_memberships_status_check check (status in ('active', 'revoked')),
  constraint restaurant_memberships_display_name_check check (
    btrim(display_name) <> '' and char_length(display_name) <= 200
  ),
  constraint restaurant_memberships_revocation_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create index restaurant_memberships_user_active_idx
  on public.restaurant_memberships (user_id, restaurant_id)
  where status = 'active';
create index restaurant_memberships_restaurant_active_idx
  on public.restaurant_memberships (restaurant_id, role, user_id)
  where status = 'active';

create table public.restaurant_membership_permission_overrides (
  restaurant_id uuid not null,
  membership_id uuid not null,
  capability text not null references public.restaurant_capabilities(capability) on delete restrict,
  allowed boolean not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (membership_id, capability),
  constraint restaurant_membership_permission_overrides_membership_fkey
    foreign key (restaurant_id, membership_id)
    references public.restaurant_memberships(restaurant_id, id) on delete restrict
);

create index restaurant_membership_permission_overrides_restaurant_idx
  on public.restaurant_membership_permission_overrides (restaurant_id, membership_id);

create table public.restaurant_access_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  target_membership_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint restaurant_access_events_membership_fkey
    foreign key (restaurant_id, target_membership_id)
    references public.restaurant_memberships(restaurant_id, id) on delete restrict,
  constraint restaurant_access_events_action_check check (
    action in ('membership.bootstrapped', 'membership.created', 'membership.updated',
      'membership.revoked', 'permission.changed')
  ),
  constraint restaurant_access_events_state_check check (
    jsonb_typeof(previous_state) = 'object' and jsonb_typeof(next_state) = 'object'
  ),
  constraint restaurant_access_events_reason_check check (
    reason is null or char_length(reason) <= 500
  )
);

create index restaurant_access_events_restaurant_created_idx
  on public.restaurant_access_events (restaurant_id, created_at desc, id desc);

create table public.restaurant_refund_policies (
  restaurant_id uuid primary key references public.restaurants(id) on delete restrict,
  refund_window_days integer not null default 7,
  updated_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_refund_policies_window_check check (
    refund_window_days between 0 and 365
  )
);

insert into public.restaurant_refund_policies (restaurant_id)
select restaurant.id from public.restaurants restaurant
on conflict (restaurant_id) do nothing;

create or replace function public.initialize_restaurant_refund_policy_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.restaurant_refund_policies (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;
  return new;
end;
$$;

create trigger restaurants_initialize_refund_policy
after insert on public.restaurants
for each row execute function public.initialize_restaurant_refund_policy_v1();

create table public.order_fulfillments (
  order_id uuid primary key,
  restaurant_id uuid not null,
  status text not null default 'new',
  version integer not null default 1,
  status_changed_at timestamptz not null default now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_fulfillments_order_fkey
    foreign key (restaurant_id, order_id)
    references public.orders(restaurant_id, id) on delete restrict,
  constraint order_fulfillments_restaurant_id_order_id_key unique (restaurant_id, order_id),
  constraint order_fulfillments_status_check check (
    status in ('new', 'preparing', 'ready', 'completed')
  ),
  constraint order_fulfillments_version_check check (version > 0),
  constraint order_fulfillments_timestamp_check check (
    (status = 'new' or preparing_at is not null)
    and (status not in ('ready', 'completed') or ready_at is not null)
    and (status <> 'completed' or completed_at is not null)
  )
);

create index order_fulfillments_restaurant_status_idx
  on public.order_fulfillments (restaurant_id, status, status_changed_at, order_id);
create index orders_management_pickup_idx
  on public.orders (restaurant_id, pickup_at, id)
  where order_status = 'placed';
create index orders_management_placed_idx
  on public.orders (restaurant_id, placed_at desc, id desc)
  where placed_at is not null;

create table public.order_fulfillment_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null,
  order_id uuid not null,
  actor_type text not null,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_membership_id uuid,
  actor_role_snapshot text,
  client_action_id uuid,
  action text not null,
  previous_status text,
  next_status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_fulfillment_events_fulfillment_fkey
    foreign key (restaurant_id, order_id)
    references public.order_fulfillments(restaurant_id, order_id) on delete restrict,
  constraint order_fulfillment_events_membership_fkey
    foreign key (restaurant_id, actor_membership_id)
    references public.restaurant_memberships(restaurant_id, id) on delete restrict,
  constraint order_fulfillment_events_actor_type_check check (
    actor_type in ('system', 'admin_user')
  ),
  constraint order_fulfillment_events_actor_check check (
    (actor_type = 'system' and actor_user_id is null and actor_membership_id is null)
    or (actor_type = 'admin_user' and actor_user_id is not null and actor_membership_id is not null)
  ),
  constraint order_fulfillment_events_role_check check (
    actor_role_snapshot is null or actor_role_snapshot in ('owner', 'manager', 'staff')
  ),
  constraint order_fulfillment_events_action_check check (
    action in ('fulfillment.created', 'fulfillment.started_preparing',
      'fulfillment.marked_ready', 'fulfillment.completed',
      'fulfillment.historical_backfill_completed', 'fulfillment.corrected')
  ),
  constraint order_fulfillment_events_previous_status_check check (
    previous_status is null or previous_status in ('new', 'preparing', 'ready', 'completed')
  ),
  constraint order_fulfillment_events_next_status_check check (
    next_status in ('new', 'preparing', 'ready', 'completed')
  ),
  constraint order_fulfillment_events_reason_check check (
    (reason is null or char_length(reason) <= 500)
    and (action <> 'fulfillment.corrected' or btrim(coalesce(reason, '')) <> '')
  ),
  constraint order_fulfillment_events_metadata_check check (jsonb_typeof(metadata) = 'object'),
  constraint order_fulfillment_events_restaurant_action_key unique (restaurant_id, client_action_id)
);

create index order_fulfillment_events_order_created_idx
  on public.order_fulfillment_events (order_id, created_at, id);
create index order_fulfillment_events_actor_created_idx
  on public.order_fulfillment_events (restaurant_id, actor_user_id, created_at desc)
  where actor_user_id is not null;

create trigger restaurant_memberships_set_updated_at
before update on public.restaurant_memberships
for each row execute function public.set_menu_man_updated_at();

create trigger restaurant_membership_permission_overrides_set_updated_at
before update on public.restaurant_membership_permission_overrides
for each row execute function public.set_menu_man_updated_at();

create trigger order_fulfillments_set_updated_at
before update on public.order_fulfillments
for each row execute function public.set_menu_man_updated_at();

create trigger restaurant_refund_policies_set_updated_at
before update on public.restaurant_refund_policies
for each row execute function public.set_menu_man_updated_at();

create or replace function private.member_has_capability_v1(
  p_membership_id uuid,
  p_role text,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select permission.allowed
      from public.restaurant_membership_permission_overrides permission
      where permission.membership_id = p_membership_id
        and permission.capability = p_capability
    ),
    (
      select role_default.allowed
      from public.restaurant_role_capability_defaults role_default
      where role_default.role = p_role
        and role_default.capability = p_capability
    ),
    false
  );
$$;

create or replace function private.require_restaurant_capability_v1(
  p_restaurant_slug text,
  p_capability text
)
returns table (membership_id uuid, restaurant_id uuid, member_role text, can_view_contact boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using message = 'MM_MANAGEMENT_UNAUTHENTICATED|Authentication is required.';
  end if;
  if not exists (
    select 1 from public.restaurant_capabilities capability
    where capability.capability = p_capability
  ) then
    raise exception using message = 'MM_MANAGEMENT_FORBIDDEN|Permission is not available.';
  end if;

  return query
  select membership.id,
         restaurant.id,
         membership.role,
         private.member_has_capability_v1(
           membership.id, membership.role, 'view_customer_contact'
         )
  from public.restaurants restaurant
  join public.restaurant_memberships membership
    on membership.restaurant_id = restaurant.id
  where restaurant.slug = p_restaurant_slug
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and private.member_has_capability_v1(
      membership.id, membership.role, p_capability
    );

  if not found then
    raise exception using message = 'MM_MANAGEMENT_FORBIDDEN|Restaurant access is unavailable.';
  end if;
end;
$$;

create or replace function private.current_user_has_restaurant_capability_v1(
  p_restaurant_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and private.member_has_capability_v1(
        membership.id, membership.role, p_capability
      )
  );
$$;

create or replace function private.current_user_can_receive_order_topic_v1(
  p_topic text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships membership
    where p_topic = 'restaurant:' || membership.restaurant_id::text || ':orders'
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and private.member_has_capability_v1(
        membership.id, membership.role, 'view_orders'
      )
  );
$$;

create or replace function public.list_my_restaurant_memberships_v1()
returns table (
  membership_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_slug text,
  restaurant_timezone text,
  member_role text,
  display_name text,
  capabilities text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.id,
         restaurant.id,
         restaurant.name,
         restaurant.slug,
         restaurant.timezone,
         membership.role,
         membership.display_name,
         coalesce((
           select array_agg(capability.capability order by capability.capability)
           from public.restaurant_capabilities capability
           where private.member_has_capability_v1(
             membership.id, membership.role, capability.capability
           )
         ), '{}'::text[])
  from public.restaurant_memberships membership
  join public.restaurants restaurant on restaurant.id = membership.restaurant_id
  where membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and restaurant.is_active
  order by restaurant.name, restaurant.id;
$$;

create or replace function public.list_managed_orders_v1(
  p_restaurant_slug text,
  p_view text default 'active',
  p_from_date date default null,
  p_to_date date default null,
  p_cursor_at timestamptz default null,
  p_cursor_order_id uuid default null,
  p_limit integer default 50,
  p_date_basis text default 'placed'
)
returns table (
  order_id uuid,
  order_number text,
  placed_at timestamptz,
  history_date timestamptz,
  pickup_mode text,
  pickup_at timestamptz,
  pickup_timezone text,
  customer_name text,
  item_summary jsonb,
  item_count integer,
  total_cents integer,
  currency text,
  payment_status text,
  refunded_cents integer,
  fulfillment_status text,
  fulfillment_version integer,
  status_changed_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_record record;
  restaurant_record public.restaurants%rowtype;
begin
  if p_view not in ('active', 'history')
    or p_date_basis not in ('placed', 'pickup')
    or p_limit not between 1 and 100
    or (p_cursor_at is null) <> (p_cursor_order_id is null)
    or (p_from_date is not null and p_to_date is not null and p_from_date > p_to_date)
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Order query is invalid.';
  end if;

  select * into access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');
  select * into restaurant_record
  from public.restaurants restaurant where restaurant.id = access_record.restaurant_id;

  return query
  select order_record.id,
         order_record.order_number::text,
         coalesce(order_record.placed_at, order_record.created_at),
         case p_date_basis
           when 'pickup' then order_record.pickup_at
           else coalesce(order_record.placed_at, order_record.created_at)
         end,
         order_record.pickup_mode,
         order_record.pickup_at,
         order_record.pickup_timezone,
         case when access_record.can_view_contact then order_record.customer_name else null end,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'quantity', item.quantity,
             'itemName', item.item_name
           ) order by item.sort_order, item.id)
           from public.order_items item
           where item.order_id = order_record.id
         ), '[]'::jsonb),
         coalesce((
           select sum(item.quantity)::integer
           from public.order_items item
           where item.order_id = order_record.id
         ), 0),
         order_record.total_cents,
         order_record.currency,
         order_record.payment_status,
         coalesce(payment.refunded_cents, 0),
         fulfillment.status,
         fulfillment.version,
         fulfillment.status_changed_at,
         fulfillment.completed_at
  from public.order_fulfillments fulfillment
  join public.orders order_record
    on order_record.restaurant_id = fulfillment.restaurant_id
   and order_record.id = fulfillment.order_id
  left join public.payments payment on payment.order_id = order_record.id
  where fulfillment.restaurant_id = access_record.restaurant_id
    and order_record.order_status in ('placed', 'confirmed', 'preparing', 'ready', 'completed')
    and (
      (p_view = 'active'
        and fulfillment.status <> 'completed'
        and (
          p_cursor_at is null
          or (order_record.pickup_at, order_record.id) > (p_cursor_at, p_cursor_order_id)
        ))
      or
      (p_view = 'history'
        and fulfillment.status = 'completed'
        and (p_from_date is null or (case p_date_basis
          when 'pickup' then order_record.pickup_at
          else coalesce(order_record.placed_at, order_record.created_at)
        end) >= (
          p_from_date::timestamp at time zone restaurant_record.timezone
        ))
        and (p_to_date is null or (case p_date_basis
          when 'pickup' then order_record.pickup_at
          else coalesce(order_record.placed_at, order_record.created_at)
        end) < (
          (p_to_date + 1)::timestamp at time zone restaurant_record.timezone
        ))
        and (
          p_cursor_at is null
          or ((case p_date_basis
            when 'pickup' then order_record.pickup_at
            else coalesce(order_record.placed_at, order_record.created_at)
          end), order_record.id) < (p_cursor_at, p_cursor_order_id)
        ))
    )
  order by
    case when p_view = 'active' then order_record.pickup_at end asc,
    case when p_view = 'active' then order_record.id end asc,
    case when p_view = 'history' and p_date_basis = 'placed'
      then coalesce(order_record.placed_at, order_record.created_at) end desc,
    case when p_view = 'history' and p_date_basis = 'pickup' then order_record.pickup_at end desc,
    case when p_view = 'history' then order_record.id end desc
  limit p_limit + 1;
end;
$$;

create or replace function public.get_managed_order_detail_v1(
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
  fulfillment_record public.order_fulfillments%rowtype;
  payment_record public.payments%rowtype;
begin
  select * into access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');

  select * into order_record
  from public.orders order_value
  where order_value.id = p_order_id
    and order_value.restaurant_id = access_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;

  select * into fulfillment_record
  from public.order_fulfillments fulfillment
  where fulfillment.order_id = order_record.id
    and fulfillment.restaurant_id = order_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order is not in restaurant fulfillment.';
  end if;

  select * into payment_record
  from public.payments payment where payment.order_id = order_record.id;

  return jsonb_build_object(
    'orderId', order_record.id,
    'orderNumber', order_record.order_number::text,
    'placedAt', order_record.placed_at,
    'pickup', jsonb_build_object(
      'mode', order_record.pickup_mode,
      'pickupAt', order_record.pickup_at,
      'timezone', order_record.pickup_timezone
    ),
    'customer', case when access_record.can_view_contact then jsonb_build_object(
      'name', order_record.customer_name,
      'phone', order_record.customer_phone,
      'email', order_record.customer_email
    ) else null end,
    'orderNotes', order_record.special_instructions,
    'currency', order_record.currency,
    'subtotalCents', order_record.subtotal_cents,
    'taxCents', order_record.tax_cents,
    'tipCents', order_record.tip_cents,
    'totalCents', order_record.total_cents,
    'payment', jsonb_build_object(
      'status', order_record.payment_status,
      'paidAt', payment_record.succeeded_at,
      'refundedCents', coalesce(payment_record.refunded_cents, 0)
    ),
    'fulfillment', jsonb_build_object(
      'status', fulfillment_record.status,
      'version', fulfillment_record.version,
      'statusChangedAt', fulfillment_record.status_changed_at,
      'completedAt', fulfillment_record.completed_at
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'orderItemId', item.id,
        'quantity', item.quantity,
        'itemName', item.item_name,
        'unitPriceCents', item.unit_price_cents,
        'lineTotalCents', item.line_total_cents,
        'specialInstructions', item.special_instructions,
        'modifiers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'groupName', modifier.modifier_group_name,
            'optionName', modifier.modifier_option_name,
            'priceAdjustmentCents', modifier.price_adjustment_cents
          ) order by modifier.sort_order, modifier.id)
          from public.order_item_modifiers modifier
          where modifier.order_item_id = item.id
        ), '[]'::jsonb)
      ) order by item.sort_order, item.id)
      from public.order_items item where item.order_id = order_record.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', timeline.event_id,
        'kind', timeline.kind,
        'label', timeline.label,
        'actorName', timeline.actor_name,
        'occurredAt', timeline.occurred_at
      ) order by timeline.occurred_at, timeline.sort_id)
      from (
        select 'fulfillment:' || event.id::text as event_id,
               'fulfillment'::text as kind,
               case event.action
                 when 'fulfillment.created' then 'Order added to the queue'
                 when 'fulfillment.started_preparing' then 'Preparation started'
                 when 'fulfillment.marked_ready' then 'Order marked ready'
                 when 'fulfillment.completed' then 'Order completed'
                 when 'fulfillment.historical_backfill_completed' then 'Imported as historical order'
                 when 'fulfillment.corrected' then 'Fulfillment status corrected'
               end as label,
               membership.display_name as actor_name,
               event.created_at as occurred_at,
               event.id as sort_id
        from public.order_fulfillment_events event
        left join public.restaurant_memberships membership
          on membership.id = event.actor_membership_id
        where event.order_id = order_record.id
        union all
        select 'payment:' || transition.id::text,
               'payment'::text,
               case transition.event_type
                 when 'payment.succeeded' then 'Payment confirmed'
                 when 'refund.requested' then 'Refund requested'
                 when 'refund.processing' then 'Refund processing'
                 when 'refund.succeeded' then 'Refund confirmed'
                 when 'refund.failed' then 'Refund unsuccessful'
               end,
               null::text,
               transition.created_at,
               transition.id
        from public.payment_state_transitions transition
        join public.payments payment on payment.id = transition.payment_id
        where payment.order_id = order_record.id
          and transition.event_type in (
            'payment.succeeded', 'refund.requested', 'refund.processing',
            'refund.succeeded', 'refund.failed'
          )
      ) timeline
    ), '[]'::jsonb)
  );
end;
$$;

-- Cursor read model for a future no-store CSV route. It intentionally requires
-- export_order_history independently of ordinary order visibility, while the
-- customer name remains redacted unless view_customer_contact is also allowed.
create or replace function public.list_managed_order_export_rows_v1(
  p_restaurant_slug text,
  p_from_date date,
  p_to_date date,
  p_cursor_at timestamptz default null,
  p_cursor_order_id uuid default null,
  p_limit integer default 500
)
returns table (
  order_id uuid,
  order_number text,
  placed_at timestamptz,
  pickup_at timestamptz,
  customer_name text,
  fulfillment_status text,
  payment_status text,
  subtotal_cents integer,
  tax_cents integer,
  tip_cents integer,
  total_cents integer,
  refund_amount_cents integer,
  refund_status text,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_record record;
  restaurant_record public.restaurants%rowtype;
begin
  if p_from_date is null
    or p_to_date is null
    or p_from_date > p_to_date
    or p_limit not between 1 and 1000
    or (p_cursor_at is null) <> (p_cursor_order_id is null)
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Export query is invalid.';
  end if;

  select * into access_record
  from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'export_order_history'
  );
  select * into restaurant_record
  from public.restaurants restaurant where restaurant.id = access_record.restaurant_id;

  return query
  select order_record.id,
         order_record.order_number::text,
         order_record.placed_at,
         order_record.pickup_at,
         case when access_record.can_view_contact then order_record.customer_name else null end,
         fulfillment.status,
         order_record.payment_status,
         order_record.subtotal_cents,
         order_record.tax_cents,
         order_record.tip_cents,
         order_record.total_cents,
         coalesce(payment.refunded_cents, 0),
         case
           when coalesce(payment.refunded_cents, 0) = 0 then null
           when payment.refunded_cents = payment.captured_cents then 'refunded'
           else 'partially_refunded'
         end,
         fulfillment.completed_at
  from public.order_fulfillments fulfillment
  join public.orders order_record
    on order_record.restaurant_id = fulfillment.restaurant_id
   and order_record.id = fulfillment.order_id
  left join public.payments payment on payment.order_id = order_record.id
  where fulfillment.restaurant_id = access_record.restaurant_id
    and order_record.placed_at >= (
      p_from_date::timestamp at time zone restaurant_record.timezone
    )
    and order_record.placed_at < (
      (p_to_date + 1)::timestamp at time zone restaurant_record.timezone
    )
    and (
      p_cursor_at is null
      or (order_record.placed_at, order_record.id) < (p_cursor_at, p_cursor_order_id)
    )
  order by order_record.placed_at desc, order_record.id desc
  limit p_limit + 1;
end;
$$;

create or replace function public.transition_order_fulfillment_v1(
  p_restaurant_slug text,
  p_order_id uuid,
  p_expected_version integer,
  p_next_status text,
  p_client_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_record record;
  fulfillment_record public.order_fulfillments%rowtype;
  order_record public.orders%rowtype;
  existing_event public.order_fulfillment_events%rowtype;
  actor_user uuid := (select auth.uid());
  action_name text;
begin
  select * into access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'advance_fulfillment');

  select * into fulfillment_record
  from public.order_fulfillments fulfillment
  where fulfillment.order_id = p_order_id
    and fulfillment.restaurant_id = access_record.restaurant_id
  for update;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;

  select * into existing_event
  from public.order_fulfillment_events event
  where event.restaurant_id = access_record.restaurant_id
    and event.client_action_id = p_client_action_id;
  if found then
    if existing_event.order_id <> p_order_id
      or existing_event.actor_user_id <> actor_user
      or existing_event.next_status <> p_next_status
    then
      raise exception using message = 'MM_MANAGEMENT_CONFLICT|Action identifier was already used.';
    end if;
    return jsonb_build_object(
      'orderId', fulfillment_record.order_id,
      'status', fulfillment_record.status,
      'version', fulfillment_record.version,
      'statusChangedAt', fulfillment_record.status_changed_at,
      'completedAt', fulfillment_record.completed_at,
      'replayed', true
    );
  end if;

  select * into order_record
  from public.orders order_value
  where order_value.id = fulfillment_record.order_id
    and order_value.restaurant_id = fulfillment_record.restaurant_id
  for update;
  if order_record.order_status not in ('placed', 'confirmed', 'preparing', 'ready') then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|The order is no longer active.';
  end if;
  if fulfillment_record.version <> p_expected_version then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|The order changed. Refresh and try again.';
  end if;
  if not (
    (fulfillment_record.status = 'new' and p_next_status = 'preparing')
    or (fulfillment_record.status = 'preparing' and p_next_status = 'ready')
    or (fulfillment_record.status = 'ready' and p_next_status = 'completed')
  ) then
    raise exception using message = 'MM_MANAGEMENT_INVALID_TRANSITION|Fulfillment can advance only one step.';
  end if;

  action_name := case p_next_status
    when 'preparing' then 'fulfillment.started_preparing'
    when 'ready' then 'fulfillment.marked_ready'
    when 'completed' then 'fulfillment.completed'
  end;

  update public.order_fulfillments
  set status = p_next_status,
      version = version + 1,
      status_changed_at = now(),
      preparing_at = case when p_next_status = 'preparing' then now() else preparing_at end,
      ready_at = case when p_next_status = 'ready' then now() else ready_at end,
      completed_at = case when p_next_status = 'completed' then now() else completed_at end
  where order_id = fulfillment_record.order_id
  returning * into fulfillment_record;

  insert into public.order_fulfillment_events (
    restaurant_id, order_id, actor_type, actor_user_id, actor_membership_id,
    actor_role_snapshot, client_action_id, action, previous_status, next_status
  ) values (
    fulfillment_record.restaurant_id,
    fulfillment_record.order_id,
    'admin_user',
    actor_user,
    access_record.membership_id,
    access_record.member_role,
    p_client_action_id,
    action_name,
    case p_next_status
      when 'preparing' then 'new'
      when 'ready' then 'preparing'
      when 'completed' then 'ready'
    end,
    p_next_status
  );

  return jsonb_build_object(
    'orderId', fulfillment_record.order_id,
    'status', fulfillment_record.status,
    'version', fulfillment_record.version,
    'statusChangedAt', fulfillment_record.status_changed_at,
    'completedAt', fulfillment_record.completed_at,
    'replayed', false
  );
end;
$$;

create or replace function public.initialize_order_fulfillment_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_order_id uuid;
begin
  if new.order_status = 'placed'
    and new.payment_status in ('paid', 'partially_refunded', 'refunded')
  then
    insert into public.order_fulfillments (restaurant_id, order_id)
    values (new.restaurant_id, new.id)
    on conflict (order_id) do nothing
    returning order_id into inserted_order_id;

    if inserted_order_id is not null then
      insert into public.order_fulfillment_events (
        restaurant_id, order_id, actor_type, action, previous_status, next_status
      ) values (
        new.restaurant_id, new.id, 'system', 'fulfillment.created', null, 'new'
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_initialize_fulfillment
after insert or update of order_status, payment_status on public.orders
for each row execute function public.initialize_order_fulfillment_v1();

insert into public.order_fulfillments (
  restaurant_id, order_id, status, version, status_changed_at,
  preparing_at, ready_at, completed_at, created_at, updated_at
)
select order_record.restaurant_id,
       order_record.id,
       'completed',
       1,
       coalesce(order_record.updated_at, order_record.placed_at, order_record.created_at),
       coalesce(order_record.updated_at, order_record.placed_at, order_record.created_at),
       coalesce(order_record.updated_at, order_record.placed_at, order_record.created_at),
       coalesce(order_record.updated_at, order_record.placed_at, order_record.created_at),
       coalesce(order_record.placed_at, order_record.created_at),
       coalesce(order_record.updated_at, order_record.created_at)
from public.orders order_record
where order_record.order_status in ('placed', 'confirmed', 'preparing', 'ready', 'completed')
  and order_record.payment_status in ('paid', 'partially_refunded', 'refunded')
on conflict (order_id) do nothing;

insert into public.order_fulfillment_events (
  restaurant_id, order_id, actor_type, action, previous_status, next_status, metadata, created_at
)
select fulfillment.restaurant_id,
       fulfillment.order_id,
       'system',
       'fulfillment.historical_backfill_completed',
       null,
       'completed',
       jsonb_build_object(
         'source', 'migration_backfill',
         'legacyOrderStatus', order_record.order_status
       ),
       fulfillment.created_at
from public.order_fulfillments fulfillment
join public.orders order_record on order_record.id = fulfillment.order_id
where not exists (
  select 1 from public.order_fulfillment_events event
  where event.order_id = fulfillment.order_id
);

create or replace function public.broadcast_order_management_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  restaurant_uuid uuid := coalesce(new.restaurant_id, old.restaurant_id);
  order_uuid uuid := coalesce(new.order_id, old.order_id);
begin
  perform realtime.send(
    jsonb_build_object('orderId', order_uuid, 'change', 'order_changed'),
    'order_changed',
    'restaurant:' || restaurant_uuid::text || ':orders',
    true
  );
  return new;
end;
$$;

create trigger order_fulfillments_broadcast_change
after insert or update on public.order_fulfillments
for each row execute function public.broadcast_order_management_change_v1();

create or replace function public.broadcast_order_financial_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.order_status is distinct from new.order_status
    or old.payment_status is distinct from new.payment_status
  then
    perform realtime.send(
      jsonb_build_object('orderId', new.id, 'change', 'order_changed'),
      'order_changed',
      'restaurant:' || new.restaurant_id::text || ':orders',
      true
    );
  end if;
  return new;
end;
$$;

create trigger orders_broadcast_management_change
after update of order_status, payment_status on public.orders
for each row execute function public.broadcast_order_financial_change_v1();

create or replace function public.bootstrap_first_restaurant_owner_v1(
  p_restaurant_id uuid,
  p_user_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_uuid uuid;
begin
  if btrim(coalesce(p_display_name, '')) = '' or char_length(p_display_name) > 200 then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Owner display name is invalid.';
  end if;
  if not exists (select 1 from public.restaurants restaurant where restaurant.id = p_restaurant_id) then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Restaurant was not found.';
  end if;
  if not exists (select 1 from auth.users auth_user where auth_user.id = p_user_id) then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Auth user was not found.';
  end if;
  if exists (
    select 1 from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
  ) then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|Restaurant membership bootstrap is already complete.';
  end if;

  insert into public.restaurant_memberships (
    restaurant_id, user_id, role, status, display_name
  ) values (
    p_restaurant_id, p_user_id, 'owner', 'active', btrim(p_display_name)
  ) returning id into membership_uuid;

  insert into public.restaurant_access_events (
    restaurant_id, target_membership_id, actor_user_id, action, next_state, reason
  ) values (
    p_restaurant_id,
    membership_uuid,
    null,
    'membership.bootstrapped',
    jsonb_build_object('role', 'owner', 'status', 'active'),
    'Initial owner bootstrap by a trusted operator'
  );

  return membership_uuid;
end;
$$;

alter table public.restaurant_capabilities enable row level security;
alter table public.restaurant_role_capability_defaults enable row level security;
alter table public.restaurant_memberships enable row level security;
alter table public.restaurant_membership_permission_overrides enable row level security;
alter table public.restaurant_access_events enable row level security;
alter table public.restaurant_refund_policies enable row level security;
alter table public.order_fulfillments enable row level security;
alter table public.order_fulfillment_events enable row level security;

revoke all on table
  public.restaurant_capabilities,
  public.restaurant_role_capability_defaults,
  public.restaurant_memberships,
  public.restaurant_membership_permission_overrides,
  public.restaurant_access_events,
  public.restaurant_refund_policies,
  public.order_fulfillments,
  public.order_fulfillment_events
from public, anon, authenticated, service_role;

grant select on table
  public.restaurant_capabilities,
  public.restaurant_role_capability_defaults
to authenticated;

create policy restaurant_capabilities_authenticated_read
on public.restaurant_capabilities for select to authenticated using (true);
create policy restaurant_role_defaults_authenticated_read
on public.restaurant_role_capability_defaults for select to authenticated using (true);
create policy restaurant_memberships_self_read
on public.restaurant_memberships for select to authenticated
using (user_id = (select auth.uid()));
create policy restaurant_membership_overrides_self_read
on public.restaurant_membership_permission_overrides for select to authenticated
using (exists (
  select 1 from public.restaurant_memberships membership
  where membership.id = restaurant_membership_permission_overrides.membership_id
    and membership.user_id = (select auth.uid())
));

drop policy if exists restaurant_members_receive_order_broadcasts on realtime.messages;
create policy restaurant_members_receive_order_broadcasts
on realtime.messages for select to authenticated
using (private.current_user_can_receive_order_topic_v1(realtime.topic()));

revoke all on function private.member_has_capability_v1(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function private.require_restaurant_capability_v1(text, text)
from public, anon, authenticated, service_role;
revoke all on function private.current_user_has_restaurant_capability_v1(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function private.current_user_can_receive_order_topic_v1(text)
from public, anon, authenticated, service_role;
revoke all on function public.list_my_restaurant_memberships_v1()
from public, anon, authenticated, service_role;
revoke all on function public.list_managed_orders_v1(text, text, date, date, timestamptz, uuid, integer, text)
from public, anon, authenticated, service_role;
revoke all on function public.get_managed_order_detail_v1(text, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.list_managed_order_export_rows_v1(text, date, date, timestamptz, uuid, integer)
from public, anon, authenticated, service_role;
revoke all on function public.transition_order_fulfillment_v1(text, uuid, integer, text, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.initialize_order_fulfillment_v1()
from public, anon, authenticated, service_role;
revoke all on function public.initialize_restaurant_refund_policy_v1()
from public, anon, authenticated, service_role;
revoke all on function public.broadcast_order_management_change_v1()
from public, anon, authenticated, service_role;
revoke all on function public.broadcast_order_financial_change_v1()
from public, anon, authenticated, service_role;
revoke all on function public.bootstrap_first_restaurant_owner_v1(uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.list_my_restaurant_memberships_v1() to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_user_can_receive_order_topic_v1(text)
to authenticated;
grant execute on function public.list_managed_orders_v1(text, text, date, date, timestamptz, uuid, integer, text)
to authenticated;
grant execute on function public.get_managed_order_detail_v1(text, uuid) to authenticated;
grant execute on function public.list_managed_order_export_rows_v1(text, date, date, timestamptz, uuid, integer)
to authenticated;
grant execute on function public.transition_order_fulfillment_v1(text, uuid, integer, text, uuid)
to authenticated;
grant execute on function public.bootstrap_first_restaurant_owner_v1(uuid, uuid, text)
to service_role;

commit;
