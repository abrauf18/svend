-- Seed the roles table with default roles 'owner', 'collaborator', and 'reporter'
insert into public.roles(
    name,
    hierarchy_level)
values (
    'owner',
    1);

insert into public.roles(
    name,
    hierarchy_level)
values (
    'collaborator',
    2);

insert into public.roles(
    name,
    hierarchy_level)
values (
    'reporter',
    3);

-- We seed the role_permissions table with the default roles and permissions
insert into public.role_permissions(
  role,
  permission)
values (
  'owner',
  'roles.manage'),
(
  'owner',
  'billing.manage'),
(
  'owner',
  'settings.manage'),
(
  'owner',
  'members.manage'),
(
  'owner',
  'invites.manage'),
(
  'owner',
  'budgets.read'),
(
  'owner',
  'budgets.write'),
(
  'collaborator',
  'budgets.read'),
(
  'collaborator',
  'budgets.write'),
(
  'reporter',
  'budgets.read');
