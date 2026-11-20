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
  Secret,
  Table,
  Toggle,
  useSave,
} from "./SettingsUI";
type Security = Awaited<ReturnType<typeof api.getSettingsSecurity>>;
export function Profile({ data }: { data: Security }) {
  const [draft, setDraft] = useState(data.profile),
    [note, setNote] = useState(""),
    [challenge, setChallenge] = useState<string>(),
    [password, setPassword] = useState(false);
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const cache = useQueryClient();
  const profile = useSave(
    api.saveSettingsProfile,
    (r) => {
      setChallenge(r.challenge);
      setNote(r.message);
    },
    "security",
  );
  const pw = useSave(
    api.changeSettingsPassword,
    (r) => {
      setNote(r.message);
      setValues({ current: "", next: "", confirm: "" });
      setPassword(false);
    },
    "security",
  );
  return (
    <Panel
      label="IDENTITY"
      title="Your workspace profile"
      copy="Use demonstration values only. Changes here do not alter your Arena or OStrade sign-in."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          profile.mutate(draft);
        }}
      >
        <div className="os-st-form-grid">
          {(
            [
              ["name", "Full name", "text"],
              ["email", "Email address", "email"],
              ["phone", "Phone number", "tel"],
            ] as const
          ).map(([key, label, type]) => (
            <Field label={label} key={key}>
              <input
                className="form-control"
                required
                type={type}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Toggle
            checked={draft.loginAlerts}
            onChange={(loginAlerts) => setDraft({ ...draft, loginAlerts })}
          >
            Login alerts preference
          </Toggle>
        </div>
        <Feedback
          error={profile.error}
          pending={profile.isPending}
          note={note}
        />
        <div className="os-st-actions">
          <Button type="submit" kind="primary" disabled={profile.isPending}>
            Save profile
          </Button>
          <Button
            onClick={() => {
              setValues({ current: "", next: "", confirm: "" });
              pw.reset();
              setPassword(true);
            }}
          >
            Change demo password
          </Button>
        </div>
      </form>
      {challenge && (
        <Gate
          title="Verify contact change"
          copy="Use the demo OTP 000000. No email or SMS was sent. If you edited your name or login alerts as well, save those after verification."
          close={() => setChallenge(undefined)}
          action={async (code) => {
            const r = await api.confirmSettingsContact({
              key: challenge,
              code,
            });
            setChallenge(undefined);
            setNote(r.message);
            await cache.invalidateQueries({
              queryKey: ["settings", "security"],
            });
          }}
        />
      )}
      {password && (
        <Modal
          title="Change preview password"
          close={() => {
            setPassword(false);
            setValues({ current: "", next: "", confirm: "" });
          }}
        >
          <p>
            Initial preview password: <code>{api.demoPassword}</code>. Do not
            enter your real password.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pw.mutate(values);
            }}
          >
            {(
              [
                ["current", "Current preview password"],
                ["next", "New demo password"],
                ["confirm", "Confirm demo password"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className="form-control"
                  required
                  type="password"
                  autoComplete="off"
                  value={values[key]}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <Feedback error={pw.error} pending={pw.isPending} />
            <Button type="submit" kind="primary" disabled={pw.isPending}>
              Change password
            </Button>
          </form>
        </Modal>
      )}
    </Panel>
  );
}
export function SecurityAccess({ data }: { data: Security }) {
  const [gate, setGate] = useState<"enroll" | "verify" | "codes" | string>(),
    [enroll, setEnroll] = useState(""),
    [codes, setCodes] = useState<string[]>(),
    [note, setNote] = useState("");
  const cache = useQueryClient();
  return (
    <div className="os-st-columns">
      <Panel
        label="AUTHENTICATOR"
        title="Two-factor protection"
        action={<Badge tone="good">Demo enabled</Badge>}
        copy="Rehearse account protection without changing your sign-in methods."
      >
        <div className="os-st-note">
          <strong>Authenticator required</strong>
          <span>Demo TOTP: 123456 · Recovery set #{data.recoveryVersion}</span>
        </div>
        <div className="os-st-actions">
          <Button onClick={() => setGate("enroll")}>
            Re-enroll authenticator
          </Button>
          <Button onClick={() => setGate("codes")}>
            Regenerate recovery codes
          </Button>
        </div>
        <Feedback note={note} />
      </Panel>
      <Panel
        label="SESSION CONTROL"
        title="Active sessions"
        copy="Device, IP and location are demo records. This browser is kept when all other sessions are revoked."
        action={
          <Button
            disabled={
              !data.sessions.some((s) => !s.current && s.state === "Active")
            }
            onClick={() => setGate("all")}
          >
            Revoke other sessions
          </Button>
        }
      >
        <Table
          headers={["Device / IP", "Location", "Last seen", "Status", "Action"]}
          label="Session history"
        >
          {data.sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.device}</strong>
                <small>{s.ip}</small>
              </td>
              <td>{s.location}</td>
              <td>
                {s.current
                  ? "This browser"
                  : `${s.age} day${s.age === 1 ? "" : "s"} ago`}
              </td>
              <td>
                <Badge tone={s.state === "Active" ? "good" : "neutral"}>
                  {s.state}
                </Badge>
              </td>
              <td>
                {!s.current && s.state === "Active" ? (
                  <Button onClick={() => setGate(s.id)}>Revoke</Button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      {gate && (
        <Gate
          key={gate}
          title={
            gate === "enroll"
              ? "Start authenticator rehearsal"
              : gate === "verify"
                ? "Verify demo enrollment"
                : gate === "codes"
                  ? "Replace recovery codes"
                  : "Revoke demo sessions"
          }
          copy={
            gate === "verify"
              ? `Enrollment reference ${enroll}. Enter 123456 to finish this offline rehearsal.`
              : "Use 123456 to authorize this local preview."
          }
          close={() => setGate(undefined)}
          action={async (code) => {
            if (gate === "enroll") {
              const r = await api.startSettingsEnrollment(code);
              setEnroll(r.key);
              setGate("verify");
              return;
            }
            if (gate === "verify")
              setNote(
                (await api.confirmSettingsEnrollment({ key: enroll, code }))
                  .message,
              );
            else if (gate === "codes")
              setCodes((await api.regenerateSettingsRecovery(code)).codes);
            else
              setNote(
                (await api.revokeSettingsSessions({ id: gate, code })).message,
              );
            setGate(undefined);
            void cache.invalidateQueries({
              queryKey: ["settings", "security"],
            });
          }}
        />
      )}
      {codes && (
        <Modal
          title="New demo recovery codes"
          close={() => setCodes(undefined)}
        >
          <p>Shown once. These codes cannot unlock a real account.</p>
          <Secret value={codes.join("\n")} label="Copy recovery codes" />
        </Modal>
      )}
    </div>
  );
}
