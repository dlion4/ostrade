import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
  Select,
  Table,
  Toggle,
  stamp,
  useSave,
} from "./SettingsUI";
export function Webhooks({
  data,
}: {
  data: Awaited<ReturnType<typeof api.getSettingsWebhooks>>;
}) {
  const [draft, setDraft] = useState({ ...data.outbound, secret: "" }),
    [event, setEvent] = useState<api.OutboundEvent>(data.outbound.events[0]),
    [note, setNote] = useState("");
  const [gate, setGate] = useState<
      { source: api.InboundSource; action: "rotate" | "reveal" } | "telegram"
    >(),
    [secret, setSecret] = useState<{ url: string; secret: string }>(),
    [proof, setProof] =
      useState<Awaited<ReturnType<typeof api.testOutbound>>>();
  const cache = useQueryClient();
  const save = useSave(
      api.saveOutbound,
      (r) => {
        setNote(r.message);
        setDraft((v) => ({ ...v, secret: "" }));
      },
      "webhooks",
    ),
    test = useSave(api.testOutbound, setProof, "webhooks");
  return (
    <div className="os-st-grid os-st-endpoints">
      <Panel
        label="01 / INBOUND"
        title="Signal endpoints"
        copy="Example URLs are not routable. Historical hit counts are fixed samples."
      >
        {data.inbound.map((r) => (
          <div className="os-st-list-row" key={r.source}>
            <div>
              <strong>{r.source}</strong>
              <code>{r.url}</code>
              <small>
                {r.hits} sample hits · {stamp(r.lastHit)}
                {r.rotatedAt ? " · Rotated locally" : ""}
              </small>
            </div>
            <div className="os-st-actions">
              <Button
                onClick={() => setGate({ source: r.source, action: "reveal" })}
                aria-label={`Reveal ${r.source} secret`}
              >
                Reveal
              </Button>
              <Button
                onClick={() => setGate({ source: r.source, action: "rotate" })}
                aria-label={`Rotate ${r.source} secret`}
              >
                Rotate
              </Button>
            </div>
          </div>
        ))}
        <div className="os-st-note">
          <div>
            <strong>Telegram intake</strong>
            <span>
              Clears linked demo chats and pending pairing codes in
              Notifications.
            </span>
          </div>
          <div className="os-st-actions">
            <Button onClick={() => setGate("telegram")}>
              Reset demo pairing
            </Button>
            <Link className="os-st-link" to="/dashboard/notifications">
              Open Notifications
            </Link>
          </div>
        </div>
        <Feedback note={note} />
      </Panel>
      <Panel
        label="02 / OUTBOUND"
        title="Callback configuration"
        copy="Prepare a signed sample payload locally. No HTTP request is made."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <Field label="HTTPS endpoint URL">
            <input
              className="form-control"
              type="url"
              required
              placeholder="https://example.invalid/webhooks/ostrade"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </Field>
          <Field
            label="Demo HMAC secret"
            hint={
              data.outbound.secretSet
                ? "Leave blank to keep the existing session-only demo secret."
                : "Use demo_ followed by 12 or more placeholder characters."
            }
          >
            <input
              className="form-control"
              type="password"
              autoComplete="off"
              value={draft.secret}
              onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
            />
          </Field>
          <fieldset>
            <legend>Outbound event subscriptions</legend>
            <div className="os-st-options">
              {api.outboundEvents.map((ev) => (
                <Toggle
                  key={ev}
                  checked={draft.events.includes(ev)}
                  onChange={(on) =>
                    setDraft({
                      ...draft,
                      events: on
                        ? [...draft.events, ev]
                        : draft.events.filter((x) => x !== ev),
                    })
                  }
                >
                  {ev}
                </Toggle>
              ))}
            </div>
          </fieldset>
          <Feedback
            error={save.error}
            pending={save.isPending}
            note={save.data?.message}
          />
          <Button kind="primary" type="submit" disabled={save.isPending}>
            Save callback preview
          </Button>
        </form>
        <hr />
        <div className="os-st-inline">
          <Field label="Test event">
            <Select
              value={
                data.outbound.events.includes(event)
                  ? event
                  : data.outbound.events[0]
              }
              options={data.outbound.events}
              onChange={setEvent}
            />
          </Field>
          <Button
            disabled={!data.outbound.url || test.isPending}
            onClick={() =>
              test.mutate(
                data.outbound.events.includes(event)
                  ? event
                  : data.outbound.events[0],
              )
            }
          >
            Test-fire locally
          </Button>
        </div>
        <Feedback error={test.error} pending={test.isPending} />
      </Panel>
      <div className="os-st-wide">
        <Panel
          label="DELIVERY EVIDENCE"
          title="Webhook delivery log"
          action={<Badge>Offline</Badge>}
        >
          <Table
            label="Webhook delivery log"
            headers={["Event", "Status", "Timestamp", "Latency", "Retries"]}
          >
            {data.deliveries.map((d) => (
              <tr key={d.id}>
                <td>
                  <code>{d.event}</code>
                  <small>{d.id}</small>
                </td>
                <td>
                  <Badge>{d.status}</Badge>
                </td>
                <td>{stamp(d.at)}</td>
                <td>{d.latencyMs ?? "—"}</td>
                <td>{d.retries}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
      {gate && (
        <Gate
          title={
            gate === "telegram"
              ? "Reset Telegram preview"
              : `${gate.action === "rotate" ? "Rotate" : "Reveal"} ${gate.source} demo secret`
          }
          copy="Authorize with the demo authenticator code 123456. This only affects preview data."
          close={() => setGate(undefined)}
          action={async (code) => {
            if (gate === "telegram") {
              setNote((await api.resetSettingsTelegram(code)).message);
              void cache.invalidateQueries({ queryKey: ["notifications"] });
            } else setSecret(await api.manageInbound({ ...gate, code }));
            setGate(undefined);
            void cache.invalidateQueries({
              queryKey: ["settings", "webhooks"],
            });
          }}
        />
      )}
      {secret && (
        <Modal title="Inbound demo values" close={() => setSecret(undefined)}>
          <p>
            These values are for inspection, not for production or external use.
          </p>
          <Secret value={secret.url} label="Copy preview URL" />
          <Secret value={secret.secret} label="Copy demo secret" />
        </Modal>
      )}
      {proof && (
        <Modal title="Signed sample prepared" close={() => setProof(undefined)}>
          <p>{proof.proof.id} · Prepared locally · No delivery attempted.</p>
          <Secret value={proof.payload} label="Copy sample payload" />
          <Secret value={proof.signature} label="Copy demo signature" />
        </Modal>
      )}
    </div>
  );
}
export function Tokens({
  data,
}: {
  data: Awaited<ReturnType<typeof api.getSettingsTokens>>;
}) {
  const [draft, setDraft] = useState({
      label: "",
      scopes: ["orders:read"] as api.TokenScope[],
    }),
    [gate, setGate] = useState<{
      action: "create" | "rotate" | "revoke";
      id?: string;
    }>(),
    [secret, setSecret] = useState<string>(),
    [note, setNote] = useState("");
  const cache = useQueryClient();
  return (
    <Panel
      label="SCOPED ACCESS"
      title="Workspace REST tokens"
      copy="Preview tokens illustrate scoped access. They cannot authenticate to any endpoint."
      action={<Badge tone="warn">REST API offline</Badge>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setGate({ action: "create" });
        }}
      >
        <Field label="Token label">
          <input
            required
            minLength={2}
            maxLength={40}
            className="form-control"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="e.g. Paper reporting script"
          />
        </Field>
        <fieldset>
          <legend>Token scopes</legend>
          <div className="os-st-options">
            {api.tokenScopes.map((s) => (
              <Toggle
                key={s}
                checked={draft.scopes.includes(s)}
                onChange={(on) =>
                  setDraft({
                    ...draft,
                    scopes: on
                      ? [...draft.scopes, s]
                      : draft.scopes.filter((x) => x !== s),
                  })
                }
              >
                {s}
              </Toggle>
            ))}
          </div>
        </fieldset>
        <Button type="submit" kind="primary" disabled={!draft.scopes.length}>
          Create demo token
        </Button>
      </form>
      <Feedback note={note} />
      {data.length ? (
        <Table
          headers={["Label", "Scopes", "State", "Actions"]}
          label="Demo tokens"
        >
          {data.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.label}</strong>
                <small>
                  •••• {r.last4} · {stamp(r.updatedAt)}
                </small>
              </td>
              <td>
                <small>{r.scopes.join(" · ")}</small>
              </td>
              <td>
                <Badge tone={r.state === "Active" ? "good" : "neutral"}>
                  {r.state}
                </Badge>
              </td>
              <td>
                {r.state === "Active" && (
                  <div className="os-st-actions">
                    <Button
                      onClick={() => setGate({ action: "rotate", id: r.id })}
                    >
                      Rotate
                    </Button>
                    <Button
                      onClick={() => setGate({ action: "revoke", id: r.id })}
                    >
                      Revoke
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="os-st-empty">
          No demo tokens yet. Create one to review scope and rotation controls.
        </p>
      )}
      {gate && (
        <Gate
          title={`${gate.action === "create" ? "Create" : gate.action === "rotate" ? "Rotate" : "Revoke"} demo API token`}
          copy="Use demo authenticator code 123456 to continue."
          close={() => setGate(undefined)}
          action={async (code) => {
            const r = await api.manageSettingsToken({
              ...gate,
              ...draft,
              code,
            });
            setGate(undefined);
            setSecret(r.secret);
            setNote(r.message);
            if (gate.action === "create") setDraft({ ...draft, label: "" });
            void cache.invalidateQueries({ queryKey: ["settings", "tokens"] });
          }}
        />
      )}
      {secret && (
        <Modal title="Copy your demo token" close={() => setSecret(undefined)}>
          <p>Shown once. This generated value is non-functional.</p>
          <Secret value={secret} label="Copy demo token" />
        </Modal>
      )}
    </Panel>
  );
}
