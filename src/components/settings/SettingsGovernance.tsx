import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@/services/settings";
import {
  Badge,
  Button,
  Feedback,
  Field,
  Gate,
  Modal,
  Panel,
  Table,
  Toggle,
  stamp,
  useSave,
} from "./SettingsUI";
type FeaturesData = Awaited<ReturnType<typeof api.getSettingsFeatures>>;
export function Privacy({
  data,
}: {
  data: Awaited<ReturnType<typeof api.getSettingsPrivacy>>;
}) {
  const [ret, setRet] = useState(data.retention),
    [remove, setRemove] = useState(false),
    [phrase, setPhrase] = useState(""),
    [consent, setConsent] = useState(false),
    [note, setNote] = useState("");
  const cache = useQueryClient();
  const save = useSave(api.saveRetention, undefined, "privacy"),
    archive = useSave(
      api.queueSettingsExport,
      (r) => setNote(r.message),
      "privacy",
    ),
    download = useSave(api.downloadSettingsExport, (r) => {
      const url = URL.createObjectURL(r.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNote("Workspace ZIP downloaded. Keep exported data private.");
    });
  return (
    <div className="os-st-grid">
      <Panel
        label="DATA PORTABILITY"
        title="Export workspace archive"
        copy="Download a ZIP of the local profile, orders, positions, journal, signals, ledger, audit, and preferences. No passwords, tokens, or webhook secrets are included."
      >
        <Button
          kind="primary"
          onClick={() => archive.mutate(undefined)}
          disabled={
            archive.isPending || data.jobs.some((j) => j.status === "Queued")
          }
        >
          Queue workspace ZIP
        </Button>
        <Feedback
          note={note}
          error={archive.error ?? download.error}
          pending={archive.isPending || download.isPending}
        />
        {data.jobs.length > 0 && (
          <Table
            label="Workspace export jobs"
            headers={["Job", "State", "Download"]}
          >
            {data.jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  <code>{j.id}</code>
                  <small>{stamp(j.at)}</small>
                </td>
                <td>
                  <Badge tone={j.status === "Ready" ? "good" : "neutral"}>
                    {j.status}
                  </Badge>
                </td>
                <td>
                  {j.status === "Ready" ? (
                    <Button
                      onClick={() => download.mutate(j.id)}
                      disabled={download.isPending}
                    >
                      Download ZIP
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <Panel
        label="RETENTION"
        title="Storage and consent"
        copy="Ledger and audit default to seven years; ticks default to 90 days. Longer periods can increase storage. This preview never purges records."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(ret);
          }}
        >
          <div className="os-st-form-grid">
            {(
              [
                ["ledger", "Ledger (years)", 7, 20],
                ["audit", "Audit (years)", 7, 20],
                ["ticks", "Ticks (days)", 1, 365],
              ] as const
            ).map(([key, label, min, max]) => (
              <Field key={key} label={label}>
                <input
                  className="form-control"
                  type="number"
                  required
                  min={min}
                  max={max}
                  value={ret[key]}
                  onChange={(e) =>
                    setRet({ ...ret, [key]: e.target.valueAsNumber || 0 })
                  }
                />
              </Field>
            ))}
          </div>
          <Feedback
            error={save.error}
            pending={save.isPending}
            note={
              save.data
                ? "Retention preference saved; no records were purged."
                : undefined
            }
          />
          <div className="os-st-actions">
            <Button kind="primary" type="submit" disabled={save.isPending}>
              Save retention
            </Button>
            <Button onClick={() => setConsent(true)}>View consent log</Button>
          </div>
        </form>
        <p className="os-st-small">
          Kenya Data Protection Act, 2019: review records of consent and
          exercise access or deletion requests. This is a product preview, not a
          compliance certification.
        </p>
      </Panel>
      <div className="os-st-wide">
        <Panel
          label="DELETION WORKFLOW"
          title="Rehearse account deletion"
          action={<Badge tone="warn">No data is deleted</Badge>}
          copy="Production intent: a 30-day soft-delete period with immediate destruction of broker credentials. Download your archive first; anything already exported remains in your possession."
        >
          <Button
            kind="danger"
            onClick={() => {
              setPhrase("");
              setRemove(true);
            }}
          >
            Review deletion rehearsal
          </Button>
          {data.deletion && (
            <Feedback
              note={`Rehearsed · Example end of grace period: ${stamp(data.deletion.scheduledAt)}. No changes were made.`}
            />
          )}
        </Panel>
      </div>
      {consent && (
        <Modal title="Consent audit log" close={() => setConsent(false)}>
          <p>
            Local sample records with SHA-256 fingerprints of the recorded
            fields.
          </p>
          <Table
            label="Consent log"
            headers={["Consent event", "Recorded at", "SHA-256 fingerprint"]}
          >
            {data.consent.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.event}</strong>
                  <small>
                    {r.id} · {r.revision}
                  </small>
                </td>
                <td>{stamp(r.at)}</td>
                <td>
                  <code className="os-st-hash">{r.hash}</code>
                </td>
              </tr>
            ))}
          </Table>
        </Modal>
      )}
      {remove && (
        <Gate
          title="Review workspace deletion"
          copy="No data will be deleted. Type the phrase and use demo authenticator code 123456."
          close={() => setRemove(false)}
          action={async (code) => {
            await api.rehearseSettingsDeletion({ phrase, code });
            setRemove(false);
            void cache.invalidateQueries({ queryKey: ["settings", "privacy"] });
          }}
        >
          <Field label="Type DELETE WORKSPACE">
            <input
              className="form-control"
              required
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
          </Field>
        </Gate>
      )}
    </div>
  );
}
export function Flags({ data }: { data: FeaturesData }) {
  const [env, setEnv] = useState<api.SettingsEnvironment>("Paper");
  return (
    <Panel
      label="ENVIRONMENT PROFILES"
      title="Feature flags and limits"
      copy="Configure separate profiles without turning on live automation, enabling integrations, or changing existing runtime enforcement."
    >
      <div className="os-st-segments" aria-label="Feature environment">
        {api.environments.map((e) => (
          <Button key={e} aria-pressed={env === e} onClick={() => setEnv(e)}>
            {e}
          </Button>
        ))}
      </div>
      <FlagForm key={env} env={env} data={data} />
    </Panel>
  );
}
function FlagForm({
  env,
  data,
}: {
  env: api.SettingsEnvironment;
  data: FeaturesData;
}) {
  const [flags, setFlags] = useState(data.flags[env]),
    [limits, setLimits] = useState(data.limits[env]),
    m = useSave(api.saveSettingsFlags, undefined, "features");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate({ env, flags, limits });
      }}
    >
      <div className="os-st-options os-st-feature-options">
        {api.flagCatalog.map(([k, label]) => (
          <Toggle
            key={k}
            checked={flags[k]}
            onChange={(on) => setFlags({ ...flags, [k]: on })}
          >
            <strong>{label}</strong>
            <code>{k}</code>
          </Toggle>
        ))}
      </div>
      <div className="os-st-form-grid">
        {(
          Object.keys(api.limitDefaults) as (keyof typeof api.limitDefaults)[]
        ).map((k) => (
          <Field key={k} label={k}>
            <input
              type="number"
              required
              min={1}
              max={500}
              className="form-control"
              value={limits[k]}
              onChange={(e) =>
                setLimits({ ...limits, [k]: e.target.valueAsNumber || 0 })
              }
            />
          </Field>
        ))}
      </div>
      <Feedback error={m.error} pending={m.isPending} note={m.data?.message} />
      <Button kind="primary" type="submit" disabled={m.isPending}>
        Save {env} profile
      </Button>
    </form>
  );
}
export function Integrations({ data }: { data: FeaturesData }) {
  const [edit, setEdit] = useState<FeaturesData["integrations"][number]>(),
    [note, setNote] = useState(""),
    [values, setValues] = useState<string[]>([]);
  const save = useSave(
      api.configureSettingsIntegration,
      (r) => {
        setNote(r.message);
        setEdit(undefined);
        setValues([]);
      },
      "features",
    ),
    test = useSave(api.testSettingsIntegration, (r) => setNote(r.message));
  return (
    <>
      <p className="os-st-small">
        Credentials are write-only and discarded after validation. A backend
        vault is required before any integration can connect.
      </p>
      <div className="os-st-grid os-st-integrations">
        {data.integrations.map((r) => (
          <Panel
            key={r.name}
            label="PROVIDER"
            title={r.name}
            copy={
              r.configured
                ? "Demo fields validated · no credentials retained"
                : "Not connected · demo setup available"
            }
            action={<Badge>{r.status}</Badge>}
          >
            <div className="os-st-actions">
              <Button
                onClick={() => {
                  save.reset();
                  setEdit(r);
                  setValues(r.fields.map(() => ""));
                }}
              >
                Edit credentials
              </Button>
              <Button
                onClick={() => test.mutate(r.name)}
                disabled={test.isPending}
              >
                Test locally
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      <Feedback error={test.error} pending={test.isPending} note={note} />
      {edit && (
        <Modal
          title={`${edit.name} demo credentials`}
          close={() => {
            setEdit(undefined);
            setValues([]);
          }}
        >
          <p>
            Use a placeholder starting with <code>demo_</code> for each field.
            Never paste real credentials.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ name: edit.name, values });
            }}
          >
            {edit.fields.map((field, i) => (
              <Field key={field} label={field}>
                <input
                  required
                  className="form-control"
                  autoComplete="off"
                  type="password"
                  value={values[i]}
                  onChange={(e) =>
                    setValues(
                      values.map((v, j) => (i === j ? e.target.value : v)),
                    )
                  }
                />
              </Field>
            ))}
            <Feedback error={save.error} pending={save.isPending} />
            <Button type="submit" kind="primary" disabled={save.isPending}>
              Validate demo fields
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
