import React, { useCallback, useEffect, useState } from "react";
import { useSocial } from "../../social/SocialContext.jsx";
import {
  SHARE_CATEGORIES,
  NON_SHAREABLE_CATEGORIES,
  defaultSocialPrivacy,
  normalizeSocialPrivacy,
  normalizeFriendVisibility,
} from "../../social/socialModel.js";
import { isFirebaseEnabled } from "../../firebase.js";

const REACTIONS = ["👍", "✨", "💪", "🎉"];

export function FriendsHub({ onBack, initialSection = null, firebaseUser = null }) {
  const social = useSocial();
  const [section, setSection] = useState(initialSection || "main");
  const [friendCode, setFriendCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendProfile, setFriendProfile] = useState(null);
  const [friendProgress, setFriendProgress] = useState(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskFriendUid, setTaskFriendUid] = useState("");
  const [taskComment, setTaskComment] = useState("");
  const [activeTaskId, setActiveTaskId] = useState(null);

  const [privacy, setPrivacy] = useState(() => normalizeSocialPrivacy(defaultSocialPrivacy()));

  useEffect(() => {
    if (social.profile?.privacy) setPrivacy(normalizeSocialPrivacy(social.profile.privacy));
  }, [social.profile?.privacy]);

  const openFriend = useCallback(
    async (uid) => {
      setSelectedFriend(uid);
      setSection("friend");
      const [prof, prog] = await Promise.all([
        social.loadUserProfile(uid),
        social.loadFriendProgress(uid),
      ]);
      setFriendProfile(prof);
      setFriendProgress(prog);
    },
    [social],
  );

  const saveFriendVisibility = useCallback(
    async (friendUid, visibility) => {
      await social.setFriendVisibilityFor(friendUid, visibility);
      setMsg("Updated visibility.");
    },
    [social],
  );

  async function run(action) {
    setBusy(true);
    setMsg("");
    try {
      await action();
    } catch (e) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseEnabled()) {
    return (
      <div className="social-hub">
        <button type="button" className="social-back" onClick={onBack}>← Back</button>
        <p className="social-offline-note">
          Accountability features need cloud sign-in. Your schedule still works fully offline and without friends.
        </p>
      </div>
    );
  }

  if (!firebaseUser?.uid) {
    return (
      <div className="social-hub">
        <button type="button" className="social-back" onClick={onBack}>← Back</button>
        <div className="py-glass-card social-hero">
          <h2>Accountability</h2>
          <p>Sign in to invite friends, share progress you choose, and build routines together.</p>
        </div>
      </div>
    );
  }

  if (section === "invite") {
    return (
      <div className="social-hub">
        <button type="button" className="social-back" onClick={() => setSection("main")}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Invite a friend</h2>
        <div className="py-glass-card social-hero">
          <p>Share your plan with someone who keeps you honest.</p>
          <p style={{ marginTop: 8, fontWeight: 500 }}>Invite a friend. Get a month of Pro.</p>
        </div>
        <div className="py-glass-card social-card">
          <div style={{ fontSize: 13, color: "var(--py-ink-muted)" }}>Your invite code</div>
          <div className="social-code-box">{social.referralCode || "…"}</div>
          <button
            type="button"
            className="social-btn-primary"
            disabled={!social.inviteLink}
            onClick={() => {
              if (navigator.share) {
                void navigator.share({
                  title: "Join me on ProYou",
                  text: "Build routines together on ProYou. Use my invite link:",
                  url: social.inviteLink,
                });
              } else if (social.inviteLink) {
                void navigator.clipboard?.writeText(social.inviteLink);
                setMsg("Invite link copied.");
              }
            }}
          >
            Share invite link
          </button>
          <button
            type="button"
            className="social-btn-secondary"
            style={{ marginTop: 8, width: "100%" }}
            onClick={() => {
              void navigator.clipboard?.writeText(social.referralCode);
              setMsg("Code copied.");
            }}
          >
            Copy code only
          </button>
        </div>
        <div className="py-glass-card social-card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Add by code</div>
          <input
            className="py-input"
            placeholder="Friend's PY code"
            value={friendCode}
            onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <button
            type="button"
            className="social-btn-primary"
            disabled={busy || !friendCode.trim()}
            onClick={() =>
              run(async () => {
                await social.sendFriendRequestByCode(friendCode.trim());
                setFriendCode("");
                setMsg("Friend request sent.");
              })
            }
          >
            Send friend request
          </button>
        </div>
        {msg ? <p style={{ fontSize: 13, color: "var(--py-accent-deep)" }}>{msg}</p> : null}
        <p style={{ fontSize: 11, color: "var(--py-ink-muted)", lineHeight: 1.4 }}>
          Rewards are tracked when a friend signs up with your link. Pro month is granted after they qualify for Pro (subscription or trial per App Store rules). Fulfillment may use promotional offers when configured.
        </p>
      </div>
    );
  }

  if (section === "privacy") {
    return (
      <div className="social-hub">
        <button type="button" className="social-back" onClick={() => setSection("main")}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Sharing & privacy</h2>
        <p style={{ fontSize: 13, color: "var(--py-ink-tertiary)" }}>Nothing is shared until you turn it on. Medication, notes, and journal entries are never shared.</p>
        <div className="py-glass-card social-card">
          <label className="social-toggle-row">
            <input
              type="checkbox"
              checked={privacy.allowFriendRequests}
              onChange={(e) => setPrivacy((p) => ({ ...p, allowFriendRequests: e.target.checked }))}
            />
            <span>Allow friend requests</span>
          </label>
          <label className="social-toggle-row">
            <input
              type="checkbox"
              checked={privacy.allowSharedTaskInvites}
              onChange={(e) => setPrivacy((p) => ({ ...p, allowSharedTaskInvites: e.target.checked }))}
            />
            <span>Allow shared task invites</span>
          </label>
        </div>
        <div className="py-glass-card social-card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Share with friends</div>
          {SHARE_CATEGORIES.map((cat) => (
            <label key={cat.id} className="social-toggle-row">
              <input
                type="checkbox"
                checked={!!privacy.sharePermissions[cat.id]}
                onChange={(e) =>
                  setPrivacy((p) => ({
                    ...p,
                    sharePermissions: { ...p.sharePermissions, [cat.id]: e.target.checked },
                  }))
                }
              />
              <span>
                {cat.label}
                <span className="social-toggle-desc">{cat.description}</span>
              </span>
            </label>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--py-ink-muted)" }}>
          Never shared: {NON_SHAREABLE_CATEGORIES.join(", ")}.
        </p>
        <button
          type="button"
          className="social-btn-primary"
          disabled={busy}
          onClick={() => run(() => social.updatePrivacy(privacy))}
        >
          Save privacy settings
        </button>
        {msg ? <p style={{ fontSize: 13, color: "var(--py-accent-deep)" }}>{msg}</p> : null}
      </div>
    );
  }

  if (section === "referrals") {
    const pending = social.referrals.filter((r) => r.status === "pending").length;
    const earned = social.referralRewards.filter((r) => r.status === "granted").length;
    return (
      <div className="social-hub">
        <button type="button" className="social-back" onClick={() => setSection("main")}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Referral rewards</h2>
        <div className="py-glass-card social-card">
          {social.referralGrant.active ? (
            <p style={{ fontSize: 14 }}>
              Referral Pro active — {social.referralGrant.daysLeft} day(s) left (internal entitlement).
            </p>
          ) : (
            <p style={{ fontSize: 14, color: "var(--py-ink-secondary)" }}>No active referral Pro grant right now.</p>
          )}
          <p style={{ fontSize: 13, marginTop: 12 }}>
            Pending referrals: <strong>{pending}</strong> · Rewards granted: <strong>{earned}</strong>
          </p>
        </div>
        {social.referrals.map((r) => (
          <div key={r.id} className="py-glass-card social-card-row" style={{ display: "block", padding: 12 }}>
            <span className="social-pending-badge">{r.status}</span>
            <div style={{ fontSize: 13, marginTop: 6, color: "var(--py-ink-muted)" }}>
              {r.status === "pending" ? "1 month free earned (pending qualification)" : r.status}
            </div>
          </div>
        ))}
        <button type="button" className="social-btn-primary" onClick={() => setSection("invite")}>
          Invite another friend
        </button>
      </div>
    );
  }

  if (section === "tasks") {
    return (
      <div className="social-hub">
        <button type="button" className="social-back" onClick={() => setSection("main")}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Shared tasks</h2>
        <p style={{ fontSize: 13, color: "var(--py-ink-tertiary)" }}>Build routines together — workouts, check-ins, rent, study sessions.</p>

        <div className="py-glass-card social-card">
          <input
            className="py-input"
            placeholder="Task title (e.g. Workout at 8 AM)"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input
            type="datetime-local"
            className="py-input"
            value={taskDue}
            onChange={(e) => setTaskDue(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          {social.friendUids.length > 0 ? (
            <select
              className="py-input"
              value={taskFriendUid}
              onChange={(e) => setTaskFriendUid(e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            >
              <option value="">Solo (just me)</option>
              {social.friendUids.map((uid) => (
                <option key={uid} value={uid}>
                  With friend {uid.slice(0, 6)}…
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="social-btn-primary"
            disabled={busy || !taskTitle.trim()}
            onClick={() =>
              run(async () => {
                const members = taskFriendUid ? [taskFriendUid] : [];
                await social.createSharedTask({
                  title: taskTitle.trim(),
                  dueAt: taskDue ? new Date(taskDue).toISOString() : null,
                  memberUids: members,
                  assignees: members.length ? [firebaseUser.uid, ...members] : [firebaseUser.uid],
                });
                setTaskTitle("");
                setTaskDue("");
                setMsg("Shared task created.");
              })
            }
          >
            Create shared task
          </button>
        </div>

        {social.sharedTasks.length === 0 ? (
          <p className="social-offline-note">No shared tasks yet.</p>
        ) : (
          social.sharedTasks.map((t) => {
            const myDone = t.completions?.[firebaseUser.uid];
            return (
              <div key={t.id} className="py-glass-card social-card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!myDone}
                    onChange={(e) => run(() => social.completeSharedTask(t.id, e.target.checked))}
                  />
                  <span className={myDone ? "social-task-done" : ""} style={{ flex: 1, fontWeight: 600 }}>
                    {t.title}
                  </span>
                </div>
                {t.dueAt ? (
                  <div style={{ fontSize: 12, color: "var(--py-ink-muted)", marginTop: 4 }}>
                    Due {new Date(t.dueAt).toLocaleString()}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, marginTop: 6, color: "var(--py-ink-tertiary)" }}>
                  Partner status:{" "}
                  {(t.memberUids || []).map((uid) => (
                    <span key={uid}>
                      {uid === firebaseUser.uid ? "You" : "Friend"}{" "}
                      {t.completions?.[uid] ? "✓" : "○"}{" "}
                    </span>
                  ))}
                </div>
                <div className="social-reactions" style={{ marginTop: 8 }}>
                  {REACTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="social-reaction-btn"
                      onClick={() => run(() => social.reactSharedTask(t.id, em))}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                {(t.comments || []).slice(-3).map((c) => (
                  <div key={c.id} style={{ fontSize: 12, marginTop: 4, color: "var(--py-ink-secondary)" }}>
                    <strong>{c.displayName}:</strong> {c.text}
                  </div>
                ))}
                {activeTaskId === t.id ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      className="py-input"
                      style={{ flex: 1 }}
                      value={taskComment}
                      onChange={(e) => setTaskComment(e.target.value)}
                      placeholder="Quick comment"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && taskComment.trim()) {
                          run(async () => {
                            await social.commentSharedTask(t.id, taskComment);
                            setTaskComment("");
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="social-btn-secondary"
                      onClick={() =>
                        run(async () => {
                          await social.commentSharedTask(t.id, taskComment);
                          setTaskComment("");
                        })
                      }
                    >
                      Send
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="social-btn-secondary"
                    style={{ marginTop: 8 }}
                    onClick={() => setActiveTaskId(t.id)}
                  >
                    Comment
                  </button>
                )}
              </div>
            );
          })
        )}
        {msg ? <p style={{ fontSize: 13, color: "var(--py-accent-deep)" }}>{msg}</p> : null}
      </div>
    );
  }

  if (section === "friend" && selectedFriend) {
    const vis = social.profile?.friendVisibility?.[selectedFriend];
    const normVis = normalizeFriendVisibility(vis);
    return (
      <div className="social-hub">
        <button type="button" className="social-back" onClick={() => setSection("main")}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          {friendProfile?.displayName || "Friend"}
        </h2>
        <div className="py-glass-card social-card">
          <p style={{ fontSize: 13, color: "var(--py-ink-muted)" }}>Shared progress (only what they opted in to share)</p>
          {!friendProgress || Object.keys(friendProgress).length <= 2 ? (
            <p style={{ fontSize: 13, marginTop: 8 }}>No shared progress yet.</p>
          ) : (
            <>
              {friendProgress.scheduleToday?.tasks?.length ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Today</div>
                  {friendProgress.scheduleToday.tasks.map((t, i) => (
                    <div key={i} style={{ fontSize: 13, padding: "4px 0" }}>
                      {t.done ? "✓" : "○"} {t.text}
                    </div>
                  ))}
                </div>
              ) : null}
              {friendProgress.habitStreaks?.length ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Habits</div>
                  {friendProgress.habitStreaks.map((h, i) => (
                    <div key={i} style={{ fontSize: 13 }}>{h.label} — {h.streak}d</div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="py-glass-card social-card">
          <label className="social-toggle-row">
            <input
              type="checkbox"
              checked={normVis.useGlobal}
              onChange={(e) =>
                saveFriendVisibility(selectedFriend, { useGlobal: e.target.checked, categories: normVis.categories })
              }
            />
            <span>See all progress they choose to share</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="social-btn-secondary"
            onClick={() => run(() => social.removeFriend(selectedFriend))}
          >
            Remove friend
          </button>
          <button
            type="button"
            className="social-btn-secondary"
            onClick={() => run(() => social.blockFriend(selectedFriend))}
          >
            Block
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="social-hub">
      {onBack ? (
        <button type="button" className="social-back" onClick={onBack}>← Back</button>
      ) : null}
      <div className="py-glass-card social-hero">
        <h2>Accountability</h2>
        <p>Share your plan with someone who keeps you honest. Build routines together.</p>
      </div>

      {social.incomingRequests.length > 0 ? (
        <div className="py-glass-card social-card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Friend requests</div>
          {social.incomingRequests.map((req) => (
            <div key={req.id} className="social-card-row">
              <span style={{ flex: 1, fontSize: 14 }}>Request from {req.fromUid?.slice(0, 8)}…</span>
              <button type="button" className="social-btn-secondary" disabled={busy} onClick={() => run(() => social.respondRequest(req.id, true))}>
                Accept
              </button>
              <button type="button" className="social-btn-secondary" disabled={busy} onClick={() => run(() => social.respondRequest(req.id, false))}>
                Decline
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button type="button" className="social-settings-link" onClick={() => setSection("invite")}>
          <span>
            <strong>Invite</strong>
            <div style={{ fontSize: 12, color: "var(--py-ink-muted)" }}>Link & code</div>
          </span>
          <span>›</span>
        </button>
        <button type="button" className="social-settings-link" onClick={() => setSection("tasks")}>
          <span>
            <strong>Shared tasks</strong>
            <div style={{ fontSize: 12, color: "var(--py-ink-muted)" }}>{social.sharedTasks.length} active</div>
          </span>
          <span>›</span>
        </button>
        <button type="button" className="social-settings-link" onClick={() => setSection("privacy")}>
          <span>
            <strong>Privacy</strong>
            <div style={{ fontSize: 12, color: "var(--py-ink-muted)" }}>Opt-in sharing</div>
          </span>
          <span>›</span>
        </button>
        <button type="button" className="social-settings-link" onClick={() => setSection("referrals")}>
          <span>
            <strong>Rewards</strong>
            <div style={{ fontSize: 12, color: "var(--py-ink-muted)" }}>Referral Pro</div>
          </span>
          <span>›</span>
        </button>
      </div>

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Friends ({social.friendUids.length})</h3>
        {social.friendUids.length === 0 ? (
          <p className="social-offline-note">No friends yet — invite someone to get started.</p>
        ) : (
          social.friendUids.map((uid) => (
            <button
              key={uid}
              type="button"
              className="social-settings-link"
              style={{ marginBottom: 8 }}
              onClick={() => openFriend(uid)}
            >
              <span>Friend</span>
              <span>›</span>
            </button>
          ))
        )}
      </div>
      {social.loading ? <p style={{ fontSize: 12, color: "var(--py-ink-muted)" }}>Syncing…</p> : null}
      {msg ? <p style={{ fontSize: 13, color: "var(--py-accent-deep)" }}>{msg}</p> : null}
    </div>
  );
}
