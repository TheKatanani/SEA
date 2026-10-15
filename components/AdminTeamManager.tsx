"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { CircleAlert, Copy, LoaderCircle, ShieldCheck, UserPlus, UserRoundX } from "lucide-react";

type TeamUser = { id: string; email: string; role: string; active: boolean };
const roles = ["admin", "editor", "admissions", "media"] as const;

export function AdminTeamManager({ authUser, english }: { authUser: User; english: boolean }) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("editor");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const labels = english ? { title: "Team access", intro: "Add team members and choose what they can manage.", email: "Team member email", role: "Access role", add: "Add team member", loading: "Loading team", noUsers: "No additional team members yet", ownerOnly: "Only the project owner can manage team access. The owner account is configured on the server.", newInvite: "Copy this secure password setup link and share it directly with the new team member.", linkCopied: "Link copied", remove: "Remove access", removeConfirm: "Remove this person’s administrator access?", roles: { admin: "Administrator — all sections", editor: "Content editor — pages and media", admissions: "Admissions — incoming requests", media: "Media — image and video library" } } : { title: "صلاحيات فريق العمل", intro: "أضف أعضاء الفريق وحدد ما يمكنهم إدارته.", email: "بريد عضو الفريق", role: "الصلاحية", add: "إضافة عضو", loading: "جارٍ تحميل الفريق", noUsers: "لا يوجد أعضاء إضافيون بعد", ownerOnly: "يستطيع مالك المشروع فقط إدارة صلاحيات الفريق. يُحدد حساب المالك في إعدادات الخادم.", newInvite: "انسخ رابط إعداد كلمة المرور وشاركه مباشرة مع عضو الفريق الجديد.", linkCopied: "تم نسخ الرابط", remove: "إلغاء الصلاحية", removeConfirm: "هل تريد إلغاء صلاحيات الإدارة لهذا العضو؟", roles: { admin: "مدير — جميع الأقسام", editor: "محرر محتوى — الصفحات والوسائط", admissions: "القبول — الطلبات الواردة", media: "الوسائط — الصور والفيديو" } };

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await authUser.getIdToken()}`, ...init.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Request failed");
    return result;
  }, [authUser]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api("/api/admin/users"); setUsers(result.users || []); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load team"); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  async function addUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setInviteLink("");
    try { const result = await api("/api/admin/users", { method: "POST", body: JSON.stringify({ email: email.trim(), role }) }); setMessage(result.created ? labels.newInvite : english ? "Role updated. Ask the team member to sign in again." : "تم تحديث الصلاحية. اطلب من العضو تسجيل الدخول مجددًا."); setInviteLink(result.inviteLink || ""); setEmail(""); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update access"); }
    finally { setBusy(false); }
  }

  async function remove(uid: string) {
    if (!window.confirm(labels.removeConfirm)) return;
    setBusy(true); setError(""); setMessage("");
    try { await api(`/api/admin/users?uid=${encodeURIComponent(uid)}`, { method: "DELETE" }); setMessage(english ? "Access removed" : "أُلغيت الصلاحية"); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove access"); }
    finally { setBusy(false); }
  }

  return <div className="team-manager"><div className="team-manager__heading"><span className="admin-brand"><ShieldCheck size={22} /></span><div><h3>{labels.title}</h3><p>{labels.intro}</p></div></div><div className="admin-guide"><ShieldCheck size={16} /><span>{labels.ownerOnly}</span></div>
    <form className="team-add-form" onSubmit={addUser}><label className="structured-field"><span>{labels.email}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@example.com" dir="ltr" /></label><label className="structured-field"><span>{labels.role}</span><select value={role} onChange={(event) => setRole(event.target.value as (typeof roles)[number])}>{roles.map((item) => <option key={item} value={item}>{labels.roles[item]}</option>)}</select></label><button className="button button--primary" disabled={busy}><UserPlus size={16} />{labels.add}</button></form>
    {error && <div className="admin-error"><CircleAlert size={16} />{error}</div>}{message && <div className="admin-success">{message}</div>}{inviteLink && <div className="team-invite"><code dir="ltr">{inviteLink}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(inviteLink); setMessage(labels.linkCopied); }}><Copy size={14} />{english ? "Copy" : "نسخ"}</button></div>}
    <div className="team-list"><div className="team-list__head"><strong>{english ? "Team members" : "أعضاء الفريق"}</strong><button className="admin-secondary-button" type="button" onClick={() => void load()}><LoaderCircle className={loading ? "spin" : ""} size={15}/>{english ? "Refresh" : "تحديث"}</button></div>{loading ? <div className="admin-empty">{labels.loading}</div> : users.length === 0 && !error ? <div className="admin-empty">{labels.noUsers}</div> : users.map((member) => <div className="team-user" key={member.id}><span className="team-user__avatar">{member.email.slice(0, 1).toUpperCase()}</span><div className="team-user__info"><strong dir="ltr">{member.email}</strong><span>{labels.roles[(member.role as (typeof roles)[number])] || member.role}</span></div><span className={`team-user__status ${member.active ? "is-active" : ""}`}>{member.active ? english ? "Active" : "نشط" : english ? "Inactive" : "موقوف"}</span><button className="admin-icon-button danger" type="button" onClick={() => void remove(member.id)} disabled={busy} title={labels.remove}><UserRoundX size={17}/></button></div>)}</div>
  </div>;
}
