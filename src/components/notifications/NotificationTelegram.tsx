import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Link2, Radio, ShieldCheck, Terminal } from "lucide-react";
import {
  changeTelegramChat,
  commands,
  confirmTelegramCommand,
  confirmTelegramPairing,
  getTelegramPanel,
  notificationTime,
  previewTelegramCommand,
  startTelegramPairing,
  testNotificationChannel,
  type ChatScope,
  type LinkedChat,
} from "@/services/notifications";
import {
  Busy,
  Button,
  Drawer,
  Failure,
  Message,
  PanelHead,
  Tag,
} from "./NotificationUI";

export function TelegramPanel() {
  const q = useQuery({
    queryKey: ["notifications", "telegram"],
    queryFn: getTelegramPanel,
  });
  const [pair, setPair] = useState(false),
    [unlink, setUnlink] = useState<LinkedChat>(),
    [note, setNote] = useState("");
  const qc = useQueryClient();
  const action = useMutation({
    mutationFn: changeTelegramChat,
    onSuccess: (r) => {
      setNote(r.message);
      setUnlink(undefined);
    },
  });
  const test = useMutation({
    mutationFn: (id: string) =>
      testNotificationChannel({ channel: "Telegram", chatId: id }),
    onSuccess: (r) => setNote(`${r.id} · ${r.status}. ${r.detail}`),
  });
  const start = useMutation({
    mutationFn: startTelegramPairing,
    onSuccess: (r) => {
      qc.setQueryData(
        ["notifications", "telegram"],
        q.data ? { ...q.data, pairing: r } : undefined,
      );
      setPair(true);
    },
  });
  return (
    <div className="os-nt-grid os-nt-telegram-grid">
      <div className="os-nt-card os-nt-panel">
        <PanelHead
          eyebrow="CONTROL CHANNEL"
          title="Telegram workspace"
          copy="Pair demo chats and rehearse commands without contacting Telegram."
          action={
            <Tag tone="blue">
              <Bot size={14} /> Offline preview
            </Tag>
          }
        />
        <div className="os-nt-actions">
          <Button
            onClick={() => start.mutate()}
            disabled={start.isPending || q.isPending}
          >
            <Link2 size={15} />
            {start.isPending ? "Preparing…" : "Generate pairing code"}
          </Button>
          {q.data?.pairing && !pair && (
            <Button onClick={() => setPair(true)}>Show current code</Button>
          )}
        </div>
        <Failure error={q.error ?? start.error ?? test.error ?? action.error} />
        {note && <Message>{note}</Message>}
        {q.isPending ? (
          <Busy />
        ) : (
          <div className="os-nt-chats">
            {q.data?.chats.map((c) => (
              <article key={c.id}>
                <span className="os-nt-icon os-nt-teal">
                  <Radio size={16} />
                </span>
                <div>
                  <strong>{c.label}</strong>
                  <small>
                    {c.masked} · {c.source}
                  </small>
                </div>
                <label className="os-nt-field">
                  <span className="visually-hidden">Scope for {c.label}</span>
                  <select
                    className="form-select"
                    value={c.scope}
                    disabled={action.isPending}
                    onChange={(e) =>
                      action.mutate({
                        id: c.id,
                        action: "scope",
                        scope: e.target.value as ChatScope,
                      })
                    }
                  >
                    <option>All</option>
                    <option>Critical only</option>
                  </select>
                </label>
                <div className="os-nt-actions">
                  <Button
                    disabled={test.isPending}
                    onClick={() => test.mutate(c.id)}
                    aria-label={`Preview routing to ${c.label}`}
                  >
                    Test
                  </Button>
                  <Button
                    onClick={() => setUnlink(c)}
                    aria-label={`Unlink ${c.label}`}
                  >
                    Unlink
                  </Button>
                </div>
              </article>
            ))}
            {!q.data?.chats.length && (
              <p>No demo chats configured. Generate a code to add one.</p>
            )}
          </div>
        )}
        <small className="os-nt-muted">
          Scope controls routing previews. No bot token, phone number, or real
          chat identifier is required.
        </small>
      </div>
      <CommandPanel />
      {pair && q.data?.pairing && (
        <PairDialog
          pairing={q.data.pairing}
          close={() => setPair(false)}
          onDone={(c) => {
            setPair(false);
            setNote(
              `${c.label} paired for local previews. No Telegram account was linked.`,
            );
          }}
        />
      )}
      {unlink && (
        <Drawer
          title={`Unlink ${unlink.label}?`}
          kicker="REMOVE DEMO CHAT"
          busy={action.isPending}
          onClose={() => setUnlink(undefined)}
        >
          <div className="os-nt-flow">
            <p>
              Future Telegram routing previews will exclude this chat. Previous
              delivery proof stays in the log.
            </p>
            <Failure error={action.error} />
            <div className="os-nt-actions">
              <Button
                disabled={action.isPending}
                onClick={() => setUnlink(undefined)}
              >
                Cancel
              </Button>
              <Button
                kind="danger"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({ id: unlink.id, action: "unlink" })
                }
              >
                Confirm unlink
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
function PairDialog({
  pairing,
  close,
  onDone,
}: {
  pairing: { code: string; expiresAt: string };
  close: () => void;
  onDone: (c: LinkedChat) => void;
}) {
  const [code, setCode] = useState(""),
    [label, setLabel] = useState(""),
    [scope, setScope] = useState<ChatScope>("All");
  const mut = useMutation({
    mutationFn: () => confirmTelegramPairing({ code, label, scope }),
    onSuccess: onDone,
  });
  return (
    <Drawer
      title="Pair a demo chat"
      kicker="LOCAL PAIRING · ONE USE"
      busy={mut.isPending}
      onClose={close}
    >
      <form
        className="os-nt-flow"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="os-nt-pair-code">
          <code>{pairing.code}</code>
          <small>Expires {notificationTime(pairing.expiresAt)} EAT</small>
        </div>
        <p>
          Enter the shown code here to finish the local rehearsal. Do not send
          it to a bot.
        </p>
        <label className="os-nt-field">
          <span>Demo chat label</span>
          <input
            className="form-control"
            required
            minLength={2}
            maxLength={32}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Operations preview"
          />
        </label>
        <div className="os-nt-form-grid">
          <label className="os-nt-field">
            <span>Pairing code</span>
            <input
              className="form-control"
              required
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="os-nt-field">
            <span>Chat scope</span>
            <select
              className="form-select"
              value={scope}
              onChange={(e) => setScope(e.target.value as ChatScope)}
            >
              <option>All</option>
              <option>Critical only</option>
            </select>
          </label>
        </div>
        <Failure error={mut.error} />
        <div className="os-nt-actions">
          <Button onClick={close} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button type="submit" kind="primary" disabled={mut.isPending}>
            {mut.isPending ? "Pairing locally…" : "Pair demo chat"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
function CommandPanel() {
  const [command, setCommand] = useState("/status"),
    [review, setReview] = useState(false),
    [reason, setReason] = useState(""),
    [code, setCode] = useState(""),
    [note, setNote] = useState("");
  const qc = useQueryClient();
  const preview = useMutation({
    mutationFn: previewTelegramCommand,
    onSuccess: (r) => {
      setReview(!!r.review);
      setReason("");
      setCode("");
      setNote("");
    },
  });
  const confirm = useMutation({
    mutationFn: () =>
      confirmTelegramCommand({
        key: preview.data!.review!.key,
        confirm: true,
        reason,
        code,
      }),
    onSuccess: (r) => {
      setReview(false);
      setNote(`${r.message} · ${r.ref}`);
      void qc.invalidateQueries();
    },
  });
  return (
    <div className="os-nt-card os-nt-panel">
      <PanelHead
        eyebrow="COMMAND REHEARSAL"
        title="Bot command reference"
        action={
          <span className="os-nt-icon os-nt-blue">
            <Terminal size={18} />
          </span>
        }
      />
      <div className="os-nt-cmd-grid">
        {commands.map((c) => (
          <button
            type="button"
            key={c.command}
            title={`${c.purpose} · ${c.mode}`}
            onClick={() => {
              setCommand(c.command);
              preview.reset();
            }}
          >
            <code>{c.command}</code>
            <small>{c.purpose}</small>
          </button>
        ))}
      </div>
      <form
        className="os-nt-actions"
        onSubmit={(e) => {
          e.preventDefault();
          confirm.reset();
          preview.mutate(command);
        }}
      >
        <label className="os-nt-field os-nt-grow">
          <span>Demo command</span>
          <input
            className="form-control"
            maxLength={80}
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              preview.reset();
            }}
            required
          />
        </label>
        <Button
          className="os-nt-align-end"
          type="submit"
          kind="primary"
          disabled={preview.isPending}
        >
          {preview.isPending ? "Reviewing…" : "Preview command"}
        </Button>
      </form>
      <Failure error={preview.error} />
      {note && <Message>{note}</Message>}
      {preview.data && !preview.data.review && (
        <div className="os-nt-inset">
          <strong>{preview.data.title}</strong>
          <ul>
            {preview.data.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {review && preview.data?.review && (
        <Drawer
          title={preview.data.title}
          kicker="COMMAND REHEARSAL · NOT REMOTE"
          onClose={() => setReview(false)}
          busy={confirm.isPending}
        >
          <form
            className="os-nt-flow"
            onSubmit={(e) => {
              e.preventDefault();
              confirm.mutate();
            }}
          >
            <ul className="os-nt-compact-list">
              {preview.data.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {preview.data.review.protected && (
              <>
                <label className="os-nt-field">
                  <span>Operator reason</span>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={reason}
                    required
                    minLength={12}
                    maxLength={240}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label className="os-nt-field">
                  <span>Example authenticator code</span>
                  <input
                    className="form-control"
                    type="password"
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{6}"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <small>Use 123456. Never enter a real code.</small>
                </label>
              </>
            )}
            <Failure error={confirm.error} />
            <div className="os-nt-actions">
              <Button
                onClick={() => setReview(false)}
                disabled={confirm.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                kind={preview.data.review.protected ? "danger" : "primary"}
                disabled={confirm.isPending}
              >
                <ShieldCheck size={15} />
                {confirm.isPending
                  ? "Applying locally…"
                  : "Confirm local action"}
              </Button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
