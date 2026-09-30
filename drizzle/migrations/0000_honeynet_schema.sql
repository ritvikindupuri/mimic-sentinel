CREATE TABLE public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  is_builtin boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  hostname text NOT NULL,
  os text NOT NULL DEFAULT 'Ubuntu 22.04.4 LTS',
  username text NOT NULL DEFAULT 'root',
  description text NOT NULL DEFAULT '',
  lure_details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personas TO authenticated;
GRANT ALL ON public.personas TO service_role;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read builtin or own personas" ON public.personas FOR SELECT TO authenticated USING (is_builtin OR owner_id = auth.uid());
CREATE POLICY "insert own personas" ON public.personas FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND is_builtin = false);
CREATE POLICY "update own personas" ON public.personas FOR UPDATE TO authenticated USING (owner_id = auth.uid() AND is_builtin = false);
CREATE POLICY "delete own personas" ON public.personas FOR DELETE TO authenticated USING (owner_id = auth.uid() AND is_builtin = false);

CREATE TABLE public.sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensors TO authenticated;
GRANT ALL ON public.sensors TO service_role;
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sensors" ON public.sensors FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  sensor_id uuid REFERENCES public.sensors(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'console',
  protocol text NOT NULL DEFAULT 'ssh',
  source_ip text,
  attacker_user text,
  cwd text NOT NULL DEFAULT '/root',
  risk_score int NOT NULL DEFAULT 0,
  summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.sessions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.session_events(session_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_events TO authenticated;
GRANT ALL ON public.session_events TO service_role;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.session_events FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  mitre_technique text,
  description text NOT NULL DEFAULT '',
  command text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.alerts FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.iocs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  ioc_type text NOT NULL,
  value text NOT NULL,
  context text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iocs TO authenticated;
GRANT ALL ON public.iocs TO service_role;
ALTER TABLE public.iocs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iocs" ON public.iocs FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts, public.sessions, public.session_events;

INSERT INTO public.personas (is_builtin, name, hostname, os, username, description, lure_details) VALUES
(true, 'Kubernetes bastion', 'k8s-bastion-prod-01', 'Ubuntu 22.04.4 LTS', 'ops', 'Internal jump host for the production EKS clusters. Used by the platform team to run kubectl, helm and terraform.', 'kubeconfig at ~/.kube/config with contexts prod-eks-us-east-1 and staging-eks; helm releases payments-api, ledger, auth-gateway; ~/.aws/credentials profile platform-admin; namespaces payments, ledger, identity, monitoring; terraform state in ~/infra/'),
(true, 'Financial DB host', 'fin-pgsql-core-02', 'Red Hat Enterprise Linux 9.3', 'postgres', 'Primary PostgreSQL 15 host for the core banking ledger and card payments.', 'databases ledger_prod and cards_prod; tables accounts, transactions, card_tokens, wire_transfers; pgbackrest backups in /var/lib/pgbackrest; replication to fin-pgsql-core-03; /etc/pgpass entries; nightly cron exporting to s3://fin-backups-prod'),
(true, 'Identity server', 'idp-keycloak-01', 'Debian 12 (bookworm)', 'root', 'Internal identity provider running Keycloak 24 and OpenLDAP for corporate SSO.', 'realm corp with clients vpn, jira, payroll; OpenLDAP base dc=corp,dc=internal; /opt/keycloak/conf/keycloak.conf; slapd service; service accounts svc-backup and svc-jenkins; TLS certs in /etc/ssl/idp');