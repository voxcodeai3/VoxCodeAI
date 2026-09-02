import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, LogOut, Search, Users, BookOpen, Brain, Trash2,
  Eye, ChevronLeft, ChevronRight, X, AlertTriangle, Loader2,
  ChevronDown, User as UserIcon, Crown, UserPlus, Settings2,
  Check, ShieldCheck, Settings, Save, Lock, Wrench, Mic, Bot,
  UserCog
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const PERMS = [
  { key: 'viewUsers', label: 'View Users', desc: 'Can view registered user information.' },
  { key: 'viewProgress', label: 'View Progress', desc: 'Can view student learning progress.' },
  { key: 'viewAIUsage', label: 'View AI Usage', desc: 'Can view basic AI usage statistics.' },
  { key: 'deleteUsers', label: 'Delete Users', desc: 'Can permanently delete student accounts.' },
  { key: 'manageAdmins', label: 'Manage Admins', desc: 'Can promote users and manage administrator permissions.' },
  { key: 'manageSettings', label: 'Manage Settings', desc: 'Can access platform/admin settings.' },
];

const DEFAULT_NEW_ADMIN = {
  viewUsers: true, viewProgress: true, viewAIUsage: true,
  deleteUsers: false, manageAdmins: false, manageSettings: false,
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function RoleBadge({ role }) {
  const styles = {
    student: 'bg-white/5 text-white/50 border-white/10',
    admin: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    super_admin: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  };
  const labels = { student: 'Student', admin: 'Admin', super_admin: 'Super Admin' };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${styles[role] || styles.student}`}>
      {labels[role] || role}
    </span>
  );
}

function Toast({ msg, onClose }) {
  if (!msg) return null;
  const isError = msg.type === 'error';
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 shadow-xl ${isError ? 'border-rose-500/20 bg-[#1a0e14]' : 'border-emerald-500/20 bg-[#0e1a14]'}`}>
      {isError ? <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" /> : <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
      <span className={`text-xs ${isError ? 'text-rose-200' : 'text-emerald-200'}`}>{msg.text}</span>
      <button onClick={onClose} className="ml-2 text-white/30 hover:text-white/60"><X className="h-3 w-3" /></button>
    </div>
  );
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel, loading }) {
  if (!open) return null;
  const isDanger = variant === 'danger';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-[#0c101c] p-5 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDanger ? 'bg-rose-500/15' : 'bg-amber-500/15'}`}>
            <AlertTriangle className={`h-4.5 w-4.5 ${isDanger ? 'text-rose-400' : 'text-amber-400'}`} />
          </div>
          <h3 className="text-white font-medium text-sm">{title}</h3>
        </div>
        <p className="text-white/50 text-xs leading-relaxed mb-5 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 border border-white/[0.06]">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`px-3 py-1.5 rounded-lg text-xs border flex items-center gap-1.5 ${isDanger ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border-rose-500/20' : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border-amber-500/20'}`}>
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermCheckboxes({ value, onChange, disabledKeys = [] }) {
  return (
    <div className="space-y-2">
      {PERMS.map((p) => (
        <label key={p.key} className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${value[p.key] ? 'bg-cyan-500/[0.06] border-cyan-400/20' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10'} ${disabledKeys.includes(p.key) ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <input
            type="checkbox"
            checked={!!value[p.key]}
            disabled={disabledKeys.includes(p.key)}
            onChange={(e) => onChange({ ...value, [p.key]: e.target.checked })}
            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-0 focus:ring-offset-0 accent-cyan-500"
          />
          <span className="min-w-0">
            <span className="text-white/80 text-xs font-medium block leading-none">{p.label}</span>
            <span className="text-white/30 text-[11px] leading-tight">{p.desc}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function MakeAdminDialog({ user, onClose, onConfirm, loading, requesterPerms, isSuper }) {
  const [perms, setPerms] = useState(DEFAULT_NEW_ADMIN);
  useEffect(() => {
    if (!isSuper) {
      const next = { ...DEFAULT_NEW_ADMIN };
      for (const k of Object.keys(next)) if (next[k] && !requesterPerms[k]) next[k] = false;
      setPerms(next);
    } else setPerms(DEFAULT_NEW_ADMIN);
  }, [user, requesterPerms, isSuper]);
  if (!user) return null;
  const disabledKeys = !isSuper ? PERMS.filter((p) => !requesterPerms[p.key]).map((p) => p.key) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0c101c] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center"><UserPlus className="h-4 w-4 text-blue-300" /></div>
            <div>
              <h3 className="text-white font-medium text-sm">Make Admin</h3>
              <p className="text-white/30 text-[11px]">{user.name} · {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          <p className="text-white/50 text-xs mb-3">Make <span className="text-white/80 font-medium">{user.name}</span> an admin? Choose permissions to grant.</p>
          <PermCheckboxes value={perms} onChange={setPerms} disabledKeys={disabledKeys} />
          {!isSuper && disabledKeys.length > 0 && <p className="text-amber-300/60 text-[11px] mt-2">Greyed permissions cannot be granted because you don&apos;t have them.</p>}
        </div>
        <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 border border-white/[0.06]">Cancel</button>
          <button onClick={() => onConfirm(perms)} disabled={loading} className="px-4 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 text-xs hover:bg-blue-500/25 border border-blue-500/20 flex items-center gap-1.5">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}Create Admin
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPermsDialog({ user, onClose, onConfirm, loading, requesterPerms, isSuper }) {
  const [perms, setPerms] = useState(null);
  useEffect(() => { if (user) setPerms(user.permissions || DEFAULT_NEW_ADMIN); }, [user]);
  if (!user || !perms) return null;
  const disabledKeys = !isSuper ? PERMS.filter((p) => !requesterPerms[p.key]).map((p) => p.key) : [];
  const isSuperTarget = user.role === 'super_admin';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0c101c] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/15 flex items-center justify-center"><Settings2 className="h-4 w-4 text-cyan-300" /></div>
            <div>
              <h3 className="text-white font-medium text-sm">Edit Permissions</h3>
              <p className="text-white/30 text-[11px]">{user.name} · {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {isSuperTarget ? (
            <p className="text-white/30 text-xs italic flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-purple-400" />Super admin has full access. Permissions cannot be edited.</p>
          ) : (
            <>
              <PermCheckboxes value={perms} onChange={setPerms} disabledKeys={disabledKeys} />
              {!isSuper && disabledKeys.length > 0 && <p className="text-amber-300/60 text-[11px] mt-2">Greyed permissions cannot be granted because you don&apos;t have them.</p>}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 border border-white/[0.06]">Close</button>
          {!isSuperTarget && <button onClick={() => onConfirm(perms)} disabled={loading} className="px-4 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs hover:bg-cyan-500/25 border border-cyan-500/20 flex items-center gap-1.5">{loading && <Loader2 className="h-3 w-3 animate-spin" />}Save</button>}
        </div>
      </div>
    </div>
  );
}

function UserDetailsModal({ user: u, learning, onClose, canViewProgress, canViewAI }) {
  if (!u) return null;
  const pct = learning?.totalLessons > 0 ? Math.round((learning.completedLessons / learning.totalLessons) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#0c101c] shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-white font-medium text-sm">User Details</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/50"><UserIcon className="h-5 w-5" /></div>
              <div><p className="text-white text-sm font-medium">{u.name}</p><p className="text-white/40 text-xs">{u.email}</p></div>
              <div className="ml-auto"><RoleBadge role={u.role} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3"><p className="text-white/30 mb-0.5">Registered</p><p className="text-white/70">{formatDate(u.createdAt)}</p></div>
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3"><p className="text-white/30 mb-0.5">Last Used</p><p className="text-white/70">{formatDate(u.lastUsedAt)}</p></div>
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3"><p className="text-white/30 mb-0.5">Auth Provider</p><p className="text-white/70 capitalize">{u.authProvider || 'local'}</p></div>
              {u.role !== 'student' && u.adminPermissions && (
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3"><p className="text-white/30 mb-0.5">Permissions</p><p className="text-white/70 text-[11px]">{Object.entries(u.adminPermissions).filter(([,v])=>v).map(([k])=>k).join(', ') || 'None'}</p></div>
              )}
            </div>
          </div>
          {canViewProgress && (
            <div>
              <h4 className="text-white/50 text-xs font-medium mb-2 uppercase tracking-wider">Learning Progress</h4>
              {learning?.activePath ? (
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Active Path</span><span className="text-white/70">{learning.activePath.title}</span></div>
                  {learning.currentStage && <div className="flex justify-between"><span className="text-white/40">Current Stage</span><span className="text-white/70">{learning.currentStage.title}</span></div>}
                  {learning.currentLesson && <div className="flex justify-between"><span className="text-white/40">Current Lesson</span><span className="text-white/70">{learning.currentLesson.title}</span></div>}
                  <div className="flex justify-between"><span className="text-white/40">Completed</span><span className="text-white/70">{learning.completedLessons} lessons / {learning.completedStages} stages</span></div>
                  <div className="flex justify-between items-center"><span className="text-white/40">Progress</span><div className="flex items-center gap-2"><div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-cyan-400/60" style={{ width: `${pct}%` }} /></div><span className="text-white/70">{pct}%</span></div></div>
                </div>
              ) : <p className="text-white/30 text-xs italic">No active learning path</p>}
            </div>
          )}
          {canViewAI && (
            <div>
              <h4 className="text-white/50 text-xs font-medium mb-2 uppercase tracking-wider">AI Usage</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 text-center"><p className="text-white/70 text-base font-medium">{u.aiUsage?.total || 0}</p><p className="text-white/30 mt-0.5">Total</p></div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 text-center"><p className="text-white/70 text-base font-medium">{u.aiUsage?.voice || 0}</p><p className="text-white/30 mt-0.5">Voice</p></div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 text-center"><p className="text-white/70 text-base font-medium">{u.aiUsage?.text || 0}</p><p className="text-white/30 mt-0.5">Text</p></div>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 border border-white/[0.06]">Close</button>
        </div>
      </div>
    </div>
  );
}

function PermPills({ perms, role }) {
  if (role === 'super_admin') return <span className="text-purple-300 text-[11px] flex items-center gap-1"><Crown className="h-3 w-3" />Full access</span>;
  const count = Object.values(perms || {}).filter(Boolean).length;
  if (count === 0) return <span className="text-white/25 text-[11px]">No permissions</span>;
  return <span className="text-white/50 text-[11px]">{count} permission{count !== 1 ? 's' : ''}</span>;
}

function Toggle({ enabled, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(!enabled)}
      disabled={disabled}
      className={`relative flex h-5 w-9 items-center rounded-full border transition-all ${enabled ? 'border-cyan-400/40 bg-cyan-500/30' : 'border-white/10 bg-white/5'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute h-3.5 w-3.5 rounded-full transition-all ${enabled ? 'left-[18px] bg-cyan-300' : 'left-0.5 bg-white/40'}`} />
    </button>
  );
}

function UserRow({ u, perms, canManage, onView, onDelete, onMakeAdmin, onEditPerms, onRemoveAdmin }) {
  const isSuper = u.role === 'super_admin';
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0"><UserIcon className="h-3.5 w-3.5 text-white/40" /></div>
          <div className="min-w-0"><p className="text-white/80 text-xs font-medium truncate">{u.name}</p><p className="text-white/30 text-[11px] truncate">{u.email}</p></div>
        </div>
      </td>
      <td className="px-3 py-3 hidden sm:table-cell"><RoleBadge role={u.role} /></td>
      <td className="px-3 py-3 hidden md:table-cell"><p className="text-white/50 text-[11px]">{formatDate(u.createdAt)}</p></td>
      <td className="px-3 py-3 hidden lg:table-cell"><p className="text-white/50 text-[11px]">{formatDate(u.lastUsedAt)}</p></td>
      <td className="px-3 py-3 hidden lg:table-cell">{u.learning?.activePath ? <p className="text-white/60 text-[11px] truncate max-w-[120px]">{u.learning.activePath}</p> : <p className="text-white/25 text-[11px] italic">None</p>}</td>
      <td className="px-3 py-3 hidden xl:table-cell">{u.learning?.activePath ? <div className="flex items-center gap-1.5"><div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-cyan-400/60" style={{ width: `${Math.min(100, u.learning.completedLessons * 10)}%` }} /></div><span className="text-white/40 text-[10px]">{u.learning.completedLessons}</span></div> : <span className="text-white/25 text-[10px]">—</span>}</td>
      <td className="px-3 py-3 hidden xl:table-cell">{perms.viewAIUsage ? <span className="text-white/50 text-[11px]">{u.aiUsage?.total || 0} req</span> : <span className="text-white/25 text-[10px]">—</span>}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-0.5 flex-wrap">
          <button onClick={() => onView(u)} className="p-1.5 rounded-md text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10" title="View Details"><Eye className="h-3.5 w-3.5" /></button>
          {isSuper ? <span className="ml-1 text-[10px] text-purple-300/60 flex items-center gap-0.5"><ShieldCheck className="h-3 w-3" />Protected</span> : (
            <>
              {u.role === 'student' && canManage && <button onClick={() => onMakeAdmin(u)} className="p-1.5 rounded-md text-white/40 hover:text-blue-300 hover:bg-blue-500/10" title="Make Admin"><UserPlus className="h-3.5 w-3.5" /></button>}
              {u.role === 'admin' && canManage && <button onClick={() => onEditPerms(u)} className="p-1.5 rounded-md text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10" title="Edit Permissions"><Settings2 className="h-3.5 w-3.5" /></button>}
              {u.role === 'admin' && canManage && <button onClick={() => onRemoveAdmin(u)} className="p-1.5 rounded-md text-white/40 hover:text-amber-300 hover:bg-amber-500/10" title="Remove Admin Access"><Shield className="h-3.5 w-3.5" /></button>}
              {perms.deleteUsers && u.role !== 'super_admin' && <button onClick={() => onDelete(u)} className="p-1.5 rounded-md text-white/40 hover:text-rose-300 hover:bg-rose-500/10" title="Delete User"><Trash2 className="h-3.5 w-3.5" /></button>}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function UserCard({ u, perms, canManage, onView, onDelete, onMakeAdmin, onEditPerms, onRemoveAdmin }) {
  const isSuper = u.role === 'super_admin';
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0"><UserIcon className="h-4 w-4 text-white/40" /></div><div className="min-w-0"><p className="text-white/80 text-xs font-medium truncate">{u.name}</p><p className="text-white/30 text-[11px] truncate">{u.email}</p></div></div>
        <RoleBadge role={u.role} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mb-2">
        <div><span className="text-white/30">Last used: </span><span className="text-white/50">{formatDate(u.lastUsedAt)}</span></div>
        <div><span className="text-white/30">AI: </span><span className="text-white/50">{perms.viewAIUsage ? `${u.aiUsage?.total || 0} req` : '—'}</span></div>
        <div className="col-span-2"><span className="text-white/30">Path: </span><span className="text-white/50">{u.learning?.activePath || 'None'}</span></div>
      </div>
      <div className="flex items-center gap-1 pt-2 border-t border-white/[0.04] flex-wrap">
        <button onClick={() => onView(u)} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10 text-[11px]"><Eye className="h-3 w-3" />View</button>
        {isSuper ? <span className="ml-auto text-[10px] text-purple-300/60 flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Protected</span> : (
          <>
            {u.role === 'student' && canManage && <button onClick={() => onMakeAdmin(u)} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-white/40 hover:text-blue-300 hover:bg-blue-500/10 text-[11px]"><UserPlus className="h-3 w-3" />Make Admin</button>}
            {u.role === 'admin' && canManage && <button onClick={() => onEditPerms(u)} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10 text-[11px]"><Settings2 className="h-3 w-3" />Edit</button>}
            {u.role === 'admin' && canManage && <button onClick={() => onRemoveAdmin(u)} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-white/40 hover:text-amber-300 hover:bg-amber-500/10 text-[11px]"><Shield className="h-3 w-3" />Remove</button>}
            {perms.deleteUsers && <button onClick={() => onDelete(u)} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-white/40 hover:text-rose-300 hover:bg-rose-500/10 text-[11px]"><Trash2 className="h-3 w-3" />Delete</button>}
          </>
        )}
      </div>
    </div>
  );
}

function AdminRow({ a, canManage, onEditPerms, onRemove }) {
  const isSuper = a.role === 'super_admin';
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full border flex items-center justify-center flex-shrink-0 ${isSuper ? 'bg-purple-500/15 border-purple-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
            {isSuper ? <Crown className="h-3.5 w-3.5 text-purple-300" /> : <Shield className="h-3.5 w-3.5 text-blue-300" />}
          </div>
          <div className="min-w-0"><p className="text-white/80 text-xs font-medium truncate">{a.name}</p><p className="text-white/30 text-[11px] truncate">{a.email}</p></div>
        </div>
      </td>
      <td className="px-3 py-3"><RoleBadge role={a.role} /></td>
      <td className="px-3 py-3 hidden md:table-cell"><PermPills perms={a.permissions} role={a.role} /></td>
      <td className="px-3 py-3 hidden lg:table-cell"><p className="text-white/50 text-[11px]">{formatDate(a.createdAt)}</p></td>
      <td className="px-3 py-3 hidden lg:table-cell"><p className="text-white/50 text-[11px]">{formatDate(a.lastUsedAt)}</p></td>
      <td className="px-3 py-3">
        {isSuper ? <span className="text-[11px] text-purple-300/50 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Protected</span> : canManage ? (
          <div className="flex items-center gap-1">
            <button onClick={() => onEditPerms(a)} className="p-1.5 rounded-md text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10" title="Edit Permissions"><Settings2 className="h-3.5 w-3.5" /></button>
            <button onClick={() => onRemove(a)} className="p-1.5 rounded-md text-white/40 hover:text-amber-300 hover:bg-amber-500/10" title="Remove Admin Access"><Shield className="h-3.5 w-3.5" /></button>
          </div>
        ) : <span className="text-white/25 text-[11px]">—</span>}
      </td>
    </tr>
  );
}

function AdminCard({ a, canManage, onEditPerms, onRemove }) {
  const isSuper = a.role === 'super_admin';
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full border flex items-center justify-center ${isSuper ? 'bg-purple-500/15 border-purple-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
            {isSuper ? <Crown className="h-4 w-4 text-purple-300" /> : <Shield className="h-4 w-4 text-blue-300" />}
          </div>
          <div className="min-w-0"><p className="text-white/80 text-xs font-medium">{a.name}</p><p className="text-white/30 text-[11px] truncate">{a.email}</p></div>
        </div>
        <RoleBadge role={a.role} />
      </div>
      <div className="flex items-center gap-2 text-[11px] mb-2">
        <span className="text-white/30">Permissions:</span>
        <PermPills perms={a.permissions} role={a.role} />
      </div>
      <div className="grid grid-cols-2 gap-1 text-[11px] mb-2">
        <span className="text-white/30">Registered: <span className="text-white/50">{formatDate(a.createdAt)}</span></span>
        <span className="text-white/30">Last used: <span className="text-white/50">{formatDate(a.lastUsedAt)}</span></span>
      </div>
      {!isSuper && canManage && (
        <div className="flex gap-1 pt-2 border-t border-white/[0.04]">
          <button onClick={() => onEditPerms(a)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10 text-[11px]"><Settings2 className="h-3 w-3" />Edit Permissions</button>
          <button onClick={() => onRemove(a)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-white/40 hover:text-amber-300 hover:bg-amber-500/10 text-[11px]"><Shield className="h-3 w-3" />Remove Access</button>
        </div>
      )}
      {isSuper && <p className="text-purple-300/40 text-[11px] flex items-center gap-1 pt-1"><ShieldCheck className="h-3 w-3" />Protected — cannot be modified</p>}
    </div>
  );
}

// ── Settings Tab ──
function SettingsTab({ user, perms, onProfileUpdated, showToast }) {
  const canManageSettings = perms.manageSettings || user?.role === 'super_admin';
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  // profile
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);

  // password
  const [pw, setPw] = useState({ cur: '', nw: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  // local editable settings
  const [local, setLocal] = useState(null);

  const fetchSettings = useCallback(async () => {
    if (!canManageSettings) { setLoading(false); return; }
    setLoading(true); setErr(null);
    try {
      const r = await api.get('/admin/settings');
      setSettings(r.data);
      setLocal(r.data);
    } catch (e) {
      setErr(e.response?.status === 403 ? 'You do not have permission to view platform settings.' : 'Unable to load settings.');
    } finally { setLoading(false); }
  }, [canManageSettings]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSaveProfile = async () => {
    const t = name.trim();
    if (!t) return showToast({ type: 'error', text: 'Name is required.' });
    setSavingProfile(true);
    try {
      const r = await api.patch('/admin/profile', { name: t });
      showToast({ text: 'Profile updated.' });
      onProfileUpdated(r.data.user);
    } catch (e) {
      showToast({ type: 'error', text: e.response?.data?.message || 'Failed to update profile.' });
    } finally { setSavingProfile(false); }
  };

  const handleChangePw = async () => {
    if (!pw.cur || !pw.nw || !pw.confirm) return showToast({ type: 'error', text: 'Fill all password fields.' });
    if (pw.nw.length < 8) return showToast({ type: 'error', text: 'New password must be at least 8 characters.' });
    if (pw.nw !== pw.confirm) return showToast({ type: 'error', text: 'New passwords do not match.' });
    setChanging(true);
    try {
      await api.patch('/admin/password', { currentPassword: pw.cur, newPassword: pw.nw, confirmPassword: pw.confirm });
      showToast({ text: 'Password changed successfully.' });
      setPw({ cur: '', nw: '', confirm: '' });
    } catch (e) {
      showToast({ type: 'error', text: e.response?.data?.message || 'Failed to change password.' });
    } finally { setChanging(false); }
  };

  const handleSaveSettings = async () => {
    if (!local) return;
    setSaving(true);
    try {
      const payload = {
        allowRegistration: local.allowRegistration,
        maintenanceMode: local.maintenanceMode,
        aiTeacherEnabled: local.aiTeacherEnabled,
        voiceAIEnabled: local.voiceAIEnabled,
        defaultAIModel: local.defaultAIModel,
      };
      const r = await api.patch('/admin/settings', payload);
      setSettings(r.data.settings);
      setLocal(r.data.settings);
      showToast({ text: 'Settings saved.' });
    } catch (e) {
      showToast({ type: 'error', text: e.response?.data?.message || 'Failed to save settings.' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Admin Profile */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-white/80 text-sm font-medium flex items-center gap-2 mb-3"><UserCog className="h-4 w-4 text-cyan-400/60" />Admin Profile</h3>
        <div className="space-y-3">
          <div>
            <label className="text-white/40 text-[11px]">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-cyan-400/30" placeholder="Your name" />
          </div>
          <div>
            <label className="text-white/40 text-[11px]">Email</label>
            <input value={user?.email || ''} disabled className="mt-1 w-full rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2 text-white/40 text-xs cursor-not-allowed" />
            <p className="text-white/20 text-[10px] mt-1">Email cannot be changed.</p>
          </div>
          <button onClick={handleSaveProfile} disabled={savingProfile} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/20 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50">
            {savingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save Profile
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-white/80 text-sm font-medium flex items-center gap-2 mb-3"><Lock className="h-4 w-4 text-amber-400/60" />Change Password</h3>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="text-white/40 text-[11px]">Current Password</label>
            <input type="password" value={pw.cur} onChange={(e) => setPw((p) => ({ ...p, cur: e.target.value }))} className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-cyan-400/30" placeholder="Current password" />
          </div>
          <div>
            <label className="text-white/40 text-[11px]">New Password</label>
            <input type="password" value={pw.nw} onChange={(e) => setPw((p) => ({ ...p, nw: e.target.value }))} className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-cyan-400/30" placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="text-white/40 text-[11px]">Confirm New Password</label>
            <input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-cyan-400/30" placeholder="Repeat new password" />
          </div>
          <button onClick={handleChangePw} disabled={changing} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/20 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/25 disabled:opacity-50">
            {changing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}Change Password
          </button>
        </div>
      </div>

      {/* Platform */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-white/80 text-sm font-medium flex items-center gap-2 mb-3"><Wrench className="h-4 w-4 text-emerald-400/60" />Platform</h3>
        {!canManageSettings ? (
          <p className="text-amber-300/60 text-xs border border-amber-500/15 bg-amber-500/5 rounded-lg px-3 py-2">You do not have permission to modify platform settings.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-white/40 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Loading settings...</div>
        ) : err ? (
          <div className="text-center py-4"><p className="text-rose-300/70 text-xs mb-2">{err}</p><button onClick={fetchSettings} className="text-cyan-400 text-xs hover:underline">Try again</button></div>
        ) : local && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div><p className="text-white/80 text-xs font-medium">Allow Student Registration</p><p className="text-white/30 text-[11px]">When off, new signups are blocked.</p></div>
              <Toggle enabled={!!local.allowRegistration} onToggle={(v) => setLocal((s) => ({ ...s, allowRegistration: v }))} disabled={false} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div><p className="text-white/80 text-xs font-medium">Maintenance Mode</p><p className="text-white/30 text-[11px]">Students see a maintenance message.</p></div>
              <Toggle enabled={!!local.maintenanceMode} onToggle={(v) => setLocal((s) => ({ ...s, maintenanceMode: v }))} disabled={false} />
            </div>
            {local.maintenanceMode && <p className="text-amber-300/60 text-[11px]">Maintenance mode is ON — students will see a maintenance screen. Admins keep full access.</p>}
          </div>
        )}
      </div>

      {/* AI */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-white/80 text-sm font-medium flex items-center gap-2 mb-3"><Bot className="h-4 w-4 text-purple-400/60" />AI Configuration</h3>
        {!canManageSettings ? (
          <p className="text-amber-300/60 text-xs border border-amber-500/15 bg-amber-500/5 rounded-lg px-3 py-2">You do not have permission to modify platform settings.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-white/40 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Loading settings...</div>
        ) : err ? (
          <div className="text-center py-4"><p className="text-rose-300/70 text-xs mb-2">{err}</p><button onClick={fetchSettings} className="text-cyan-400 text-xs hover:underline">Try again</button></div>
        ) : local && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2"><Bot className="h-3.5 w-3.5 text-purple-400/50" /><div><p className="text-white/80 text-xs font-medium">AI Teacher</p><p className="text-white/30 text-[11px]">Enable AI-powered teaching.</p></div></div>
              <Toggle enabled={!!local.aiTeacherEnabled} onToggle={(v) => setLocal((s) => ({ ...s, aiTeacherEnabled: v }))} disabled={false} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2"><Mic className="h-3.5 w-3.5 text-cyan-400/50" /><div><p className="text-white/80 text-xs font-medium">Voice AI</p><p className="text-white/30 text-[11px]">Enable voice interaction.</p></div></div>
              <Toggle enabled={!!local.voiceAIEnabled} onToggle={(v) => setLocal((s) => ({ ...s, voiceAIEnabled: v }))} disabled={false} />
            </div>
            <div>
              <label className="text-white/40 text-[11px]">Default AI Model</label>
              <input value={local.defaultAIModel || ''} onChange={(e) => setLocal((s) => ({ ...s, defaultAIModel: e.target.value }))} placeholder="e.g. gpt-4o-mini" className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-cyan-400/30" />
              <p className="text-white/20 text-[10px] mt-1">Identifier only — API keys stay on the server.</p>
            </div>
            <button onClick={handleSaveSettings} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/15 border border-purple-500/20 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/25 disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save Settings
            </button>
            {settings?.updatedAt && <p className="text-white/20 text-[11px]">Last updated: {formatDate(settings.updatedAt)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [learningFilter, setLearningFilter] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsError, setAdminsError] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [detailLearning, setDetailLearning] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [makeAdminTarget, setMakeAdminTarget] = useState(null);
  const [makingAdmin, setMakingAdmin] = useState(false);
  const [editPermTarget, setEditPermTarget] = useState(null);
  const [editingPerms, setEditingPerms] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState(null);

  const perms = user?.permissions || {};
  const canManage = perms.manageAdmins || user?.role === 'super_admin';

  const showToast = (textOrObj) => {
    const obj = typeof textOrObj === 'string' ? { text: textOrObj } : textOrObj;
    setToast(obj); setTimeout(() => setToast(null), 3000);
  };
  const handleProfileUpdated = (newUser) => {
    // update local user name without full reload — AuthContext will re-validate on next mount
    // we store updated name in localStorage so it persists
    try {
      const raw = localStorage.getItem('voxcode_user') || sessionStorage.getItem('voxcode_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.name = newUser.name;
        const storage = localStorage.getItem('voxcode_user') ? localStorage : sessionStorage;
        storage.setItem('voxcode_user', JSON.stringify(parsed));
      }
    } catch {}
    // force reload of displayed header by updating a dummy state via navigation? simple: reload page data
    window.location.reload();
  };

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      try { await api.get('/admin/me'); if (!cancelled) setChecking(false); }
      catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          const msg = err.response?.data?.message || 'Access denied';
          setError(status === 403 ? msg : status === 401 ? 'Please log in again.' : msg);
          setChecking(false);
          if (status === 403 || status === 401) setTimeout(() => navigate('/voxcode', { replace: true }), 1500);
        }
      }
    }
    verify(); return () => { cancelled = true; };
  }, [navigate]);

  const fetchStats = useCallback(async () => {
    if (!perms.viewUsers) return;
    try { const res = await api.get('/admin/stats'); setStats(res.data); } catch {}
  }, [perms.viewUsers]);

  const fetchUsers = useCallback(async (page = 1) => {
    if (!perms.viewUsers) return;
    setLoading(true); setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (learningFilter) params.set('learning', learningFilter);
      const res = await api.get(`/admin/users?${params.toString()}`);
      setUsers(res.data.users || []);
      setPagination(res.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (err) {
      setLoadError(err.response?.status === 403 ? 'You do not have permission to view users.' : 'Unable to load users. Please try again.');
      setUsers([]);
    } finally { setLoading(false); }
  }, [perms.viewUsers, search, roleFilter, learningFilter]);

  const fetchAdmins = useCallback(async () => {
    if (!canManage) return;
    setAdminsLoading(true); setAdminsError(null);
    try {
      const res = await api.get('/admin/admins');
      setAdmins(res.data.admins || []);
    } catch (err) {
      setAdminsError(err.response?.data?.message || 'Unable to load administrators.');
    } finally { setAdminsLoading(false); }
  }, [canManage]);

  useEffect(() => { if (!checking && !error) { fetchStats(); fetchUsers(1); } }, [checking, error, fetchStats, fetchUsers]);
  useEffect(() => { if (!checking && !error) { const t = setTimeout(() => fetchUsers(1), 300); return () => clearTimeout(t); } }, [search, roleFilter, learningFilter]);
  useEffect(() => { if (!checking && !error && activeTab === 'admins') fetchAdmins(); }, [checking, error, activeTab, fetchAdmins]);

  const handleView = async (u) => {
    setDetailUser(null); setDetailLearning(null); setLoadingDetail(true);
    try { const res = await api.get(`/admin/users/${u.id}`); setDetailUser(res.data.user); setDetailLearning(res.data.learning); }
    catch { setDetailUser({ ...u, _error: true }); }
    finally { setLoadingDetail(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try { await api.delete(`/admin/users/${deleteTarget.id}`); setDeleteTarget(null); showToast(`"${deleteTarget.name}" deleted.`); fetchUsers(pagination.page); fetchStats(); if (canManage) fetchAdmins(); }
    catch (err) { showToast({ type: 'error', text: err.response?.data?.message || 'Unable to delete this user.' }); }
    finally { setDeleting(false); }
  };

  const handleMakeAdmin = async (chosenPerms) => {
    if (!makeAdminTarget) return; setMakingAdmin(true);
    try {
      await api.patch(`/admin/users/${makeAdminTarget.id}/role`, { role: 'admin', permissions: chosenPerms });
      showToast(`${makeAdminTarget.name} is now an admin.`);
      setMakeAdminTarget(null); fetchUsers(pagination.page); fetchStats(); fetchAdmins();
    } catch (err) { showToast({ type: 'error', text: err.response?.data?.message || 'Failed to create admin.' }); }
    finally { setMakingAdmin(false); }
  };

  const handleEditPerms = async (newPerms) => {
    if (!editPermTarget) return; setEditingPerms(true);
    try {
      await api.patch(`/admin/users/${editPermTarget.id}/permissions`, { permissions: newPerms });
      showToast(`Permissions updated for ${editPermTarget.name}.`);
      setEditPermTarget(null); fetchAdmins(); fetchUsers(pagination.page);
    } catch (err) { showToast({ type: 'error', text: err.response?.data?.message || 'Failed to update permissions.' }); }
    finally { setEditingPerms(false); }
  };

  const handleRemoveAccess = async () => {
    if (!removeTarget) return; setRemoving(true);
    try {
      await api.patch(`/admin/users/${removeTarget.id}/role`, { role: 'student' });
      showToast(`Admin access removed from ${removeTarget.name}.`);
      setRemoveTarget(null); fetchAdmins(); fetchUsers(pagination.page); fetchStats();
    } catch (err) { showToast({ type: 'error', text: err.response?.data?.message || 'Failed to remove admin access.' }); }
    finally { setRemoving(false); }
  };

  if (checking) return <div className="min-h-screen bg-[#010208] flex items-center justify-center"><div className="text-cyan-400 animate-pulse text-sm font-mono">Verifying admin access...</div></div>;
  if (error) return (
    <div className="min-h-screen bg-[#010208] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 text-center">
        <Shield className="h-8 w-8 text-rose-400 mx-auto mb-3" /><h2 className="text-white font-semibold mb-1">Access Denied</h2>
        <p className="text-rose-200/70 text-sm mb-4">{error}</p>
        <button onClick={() => navigate('/voxcode', { replace: true })} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20">Back to VoxCode</button>
      </div>
    </div>
  );

  const canSettings = perms.manageSettings || user?.role === 'super_admin';

  return (
    <div className="min-h-screen bg-[#010208] text-white">
      <header className="border-b border-white/[0.06] bg-[#050814]/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center"><Shield className="h-4 w-4 text-cyan-300" /></div>
            <div><h1 className="text-white font-semibold text-sm">VoxCode Admin</h1><p className="text-white/30 text-[11px]">{user?.role === 'super_admin' ? 'Super Admin' : 'Admin'} · {user?.email}</p></div>
          </div>
          <button onClick={() => { logout(); navigate('/login', { replace: true }); }} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10"><LogOut className="h-3.5 w-3.5" /> Logout</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center gap-2 mb-1"><Users className="h-3.5 w-3.5 text-cyan-400/60" /><span className="text-white/30 text-[11px]">Total Users</span></div><p className="text-white/80 text-lg font-medium">{stats.totalUsers}</p></div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center gap-2 mb-1"><BookOpen className="h-3.5 w-3.5 text-emerald-400/60" /><span className="text-white/30 text-[11px]">Active Learners</span></div><p className="text-white/80 text-lg font-medium">{stats.activeLearningUsers}</p></div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center gap-2 mb-1"><Brain className="h-3.5 w-3.5 text-purple-400/60" /><span className="text-white/30 text-[11px]">AI Requests</span></div><p className="text-white/80 text-lg font-medium">{stats.totalAIRequests}</p></div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center gap-2 mb-1"><Shield className="h-3.5 w-3.5 text-amber-400/60" /><span className="text-white/30 text-[11px]">Admins</span></div><p className="text-white/80 text-lg font-medium">{stats.totalAdmins}</p></div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06] w-fit overflow-x-auto">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'users' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' : 'text-white/40 hover:text-white/70'}`}><Users className="h-3.5 w-3.5" />Users</button>
          {canManage ? (
            <button onClick={() => setActiveTab('admins')} className={`px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'admins' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' : 'text-white/40 hover:text-white/70'}`}><Crown className="h-3.5 w-3.5" />Admins</button>
          ) : (
            <span className="px-3 py-1.5 text-[11px] text-white/20 flex items-center gap-1 whitespace-nowrap"><Crown className="h-3 w-3" />Admins — requires Manage Admins</span>
          )}
          <button onClick={() => setActiveTab('settings')} className={`px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'settings' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' : 'text-white/40 hover:text-white/70'}`}><Settings className="h-3.5 w-3.5" />Settings</button>
        </div>

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" /><input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder-white/30 focus:outline-none focus:border-cyan-400/30" /></div>
              <div className="relative"><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/70 text-xs focus:outline-none focus:border-cyan-400/30 cursor-pointer"><option value="">All Roles</option><option value="student">Student</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30 pointer-events-none" /></div>
              <div className="relative"><select value={learningFilter} onChange={(e) => setLearningFilter(e.target.value)} className="appearance-none pl-3 pr-7 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/70 text-xs focus:outline-none focus:border-cyan-400/30 cursor-pointer"><option value="">All Learning</option><option value="yes">Active Path</option><option value="no">No Path</option></select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30 pointer-events-none" /></div>
            </div>
            {loading && <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 text-cyan-400 animate-spin mr-2" /><span className="text-white/40 text-sm">Loading users...</span></div>}
            {loadError && !loading && <div className="text-center py-12"><p className="text-rose-300/80 text-sm mb-2">{loadError}</p><button onClick={() => fetchUsers(1)} className="text-cyan-400 text-xs hover:underline">Try again</button></div>}
            {!loading && !loadError && users.length === 0 && <div className="text-center py-12"><Users className="h-8 w-8 text-white/10 mx-auto mb-2" /><p className="text-white/30 text-sm">{search || roleFilter || learningFilter ? 'No users match your search.' : 'No users found.'}</p></div>}
            {!loading && !loadError && users.length > 0 && (
              <>
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-white/[0.06]">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="px-3 py-2 text-[11px] text-white/40 font-medium">User</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden sm:table-cell">Role</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden md:table-cell">Registered</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden lg:table-cell">Last Used</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden lg:table-cell">Path</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden xl:table-cell">Progress</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden xl:table-cell">AI</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium">Actions</th></tr></thead>
                    <tbody>{users.map((u) => <UserRow key={u.id} u={u} perms={perms} canManage={canManage} onView={handleView} onDelete={setDeleteTarget} onMakeAdmin={setMakeAdminTarget} onEditPerms={(usr) => { const adm = { id: usr.id, name: usr.name, email: usr.email, role: usr.role, permissions: usr.permissions || usr.adminPermissions || {} }; setEditPermTarget(adm); }} onRemoveAdmin={(usr) => setRemoveTarget({ id: usr.id, name: usr.name })} />)}</tbody>
                  </table>
                </div>
                <div className="sm:hidden space-y-2">{users.map((u) => <UserCard key={u.id} u={u} perms={perms} canManage={canManage} onView={handleView} onDelete={setDeleteTarget} onMakeAdmin={setMakeAdminTarget} onEditPerms={(usr) => { const adm = { id: usr.id, name: usr.name, email: usr.email, role: usr.role, permissions: usr.permissions || usr.adminPermissions || {} }; setEditPermTarget(adm); }} onRemoveAdmin={(usr) => setRemoveTarget({ id: usr.id, name: usr.name })} />)}</div>
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-white/30 text-[11px]">Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => fetchUsers(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                      {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => { let p; if (pagination.pages <= 5) p = i + 1; else if (pagination.page <= 3) p = i + 1; else if (pagination.page >= pagination.pages - 2) p = pagination.pages - 4 + i; else p = pagination.page - 2 + i; return <button key={p} onClick={() => fetchUsers(p)} className={`w-7 h-7 rounded-md text-xs ${p === pagination.page ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' : 'text-white/40 hover:bg-white/5'}`}>{p}</button>; })}
                      <button onClick={() => fetchUsers(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Admins Tab ── */}
        {activeTab === 'admins' && (
          <>
            {!canManage ? (
              <div className="text-center py-12 border border-amber-500/15 bg-amber-500/[0.04] rounded-lg"><Shield className="h-8 w-8 text-amber-400/40 mx-auto mb-2" /><p className="text-amber-200/60 text-sm">You need <span className="text-amber-300">Manage Admins</span> permission to view administrators.</p></div>
            ) : (
              <>
                {adminsLoading && <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 text-cyan-400 animate-spin mr-2" /><span className="text-white/40 text-sm">Loading administrators...</span></div>}
                {adminsError && !adminsLoading && <div className="text-center py-12"><p className="text-rose-300/80 text-sm mb-2">{adminsError}</p><button onClick={fetchAdmins} className="text-cyan-400 text-xs hover:underline">Try again</button></div>}
                {!adminsLoading && !adminsError && admins.length === 0 && <div className="text-center py-12"><Crown className="h-8 w-8 text-white/10 mx-auto mb-2" /><p className="text-white/30 text-sm">No administrators found.</p></div>}
                {!adminsLoading && !adminsError && admins.length > 0 && (
                  <>
                    <div className="hidden sm:block overflow-x-auto rounded-lg border border-white/[0.06]">
                      <table className="w-full text-left">
                        <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="px-3 py-2 text-[11px] text-white/40 font-medium">Administrator</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium">Role</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden md:table-cell">Permissions</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden lg:table-cell">Registered</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium hidden lg:table-cell">Last Used</th><th className="px-3 py-2 text-[11px] text-white/40 font-medium">Actions</th></tr></thead>
                        <tbody>{admins.map((a) => <AdminRow key={a.id} a={a} canManage={canManage} onEditPerms={setEditPermTarget} onRemove={setRemoveTarget} />)}</tbody>
                      </table>
                    </div>
                    <div className="sm:hidden space-y-2">{admins.map((a) => <AdminCard key={a.id} a={a} canManage={canManage} onEditPerms={setEditPermTarget} onRemove={setRemoveTarget} />)}</div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === 'settings' && (
          <SettingsTab user={user} perms={perms} onProfileUpdated={handleProfileUpdated} showToast={showToast} />
        )}
      </main>

      <UserDetailsModal user={detailUser} learning={detailLearning} onClose={() => { setDetailUser(null); setDetailLearning(null); }} canViewProgress={perms.viewProgress !== false} canViewAI={perms.viewAIUsage !== false} />
      <ConfirmDialog open={!!deleteTarget} title="Delete this user?" message={`This will permanently delete "${deleteTarget?.name}" (${deleteTarget?.email}) and remove their associated learning data. This action cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
      {makeAdminTarget && <MakeAdminDialog user={makeAdminTarget} onClose={() => setMakeAdminTarget(null)} onConfirm={handleMakeAdmin} loading={makingAdmin} requesterPerms={perms} isSuper={user?.role === 'super_admin'} />}
      {editPermTarget && <EditPermsDialog user={editPermTarget} onClose={() => setEditPermTarget(null)} onConfirm={handleEditPerms} loading={editingPerms} requesterPerms={perms} isSuper={user?.role === 'super_admin'} />}
      <ConfirmDialog open={!!removeTarget} title="Remove admin access?" message={`Remove administrator access from "${removeTarget?.name}"? They will become a student again. Their learning progress will be kept.`} confirmLabel="Remove Access" variant="warn" onConfirm={handleRemoveAccess} onCancel={() => setRemoveTarget(null)} loading={removing} />
      {loadingDetail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><Loader2 className="h-6 w-6 text-cyan-400 animate-spin" /></div>}
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  );
}
