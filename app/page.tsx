"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, DollarSign, Download, Home, Menu, MoreHorizontal, Plus, Receipt,
  Settings, ShieldCheck, Sparkles, Utensils, Users, X,
} from "lucide-react";
import { cloudEnabled, messId, supabase } from "../lib/supabase";

type Tab = "Overview" | "Meals" | "Expenses" | "Members" | "Admin close" | "Community" | "Settings" | "Help";
type Expense = { item: string; category: string; by: string; date: string; amount: number; color: string };
type Request = { id: number; member: string; date: string; meals: number; reason: string; status: "Pending" | "Approved" | "Rejected" };
type BillState = { maid: number; electricity: number; wifi: number; gas: number };
type Member = { name: string; id: string; initials: string; role: string; meals: number; rent: number; color: string };
type Account = { name: string; username: string; password: string; memberId: string; role: "admin" | "member"; rent: number; userId?: string };
type ChatMessage = { id: string; author: string; body: string; createdAt: string };
type Preferences = { currency: string; notifications: boolean; compact: boolean };
type StoredState = { expenses: Expense[]; requests: Request[]; bills: BillState; members: Member[]; mealLogs: Record<string, number>; messages: ChatMessage[]; pinnedMessageId: string | null; rules: string[]; preferences: Preferences };
const chartData = Array.from({ length: 7 }, (_, i) => ({ day: (i * 5) + 1, spend: 0 }));
const emptyBills: BillState = { maid: 0, electricity: 0, wifi: 0, gas: 0 };
const emptyState: StoredState = { expenses: [], requests: [], bills: emptyBills, members: [], mealLogs: {}, messages: [], pinnedMessageId: null, rules: [], preferences: { currency: "BDT", notifications: true, compact: false } };
const getCurrentMonth = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const fixedAdminIds = new Set(["ADMIN-AKABA", "ADMIN-SHAHARIYAR"]);
const isFixedAdminMember = (member: Member) => fixedAdminIds.has(member.id);

export default function HomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", username: "", password: "", memberId: "", rent: "" });
  const [tab, setTab] = useState<Tab>("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [notice, setNotice] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [closed, setClosed] = useState(false);
  const [bills, setBills] = useState<BillState>(emptyBills);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenseForm, setExpenseForm] = useState({ item: "", category: "Groceries", amount: "" });
  const [historyMonth, setHistoryMonth] = useState("all");
  const [memberForm, setMemberForm] = useState({ name: "", username: "", password: "", memberId: "", rent: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [settingsFeedback, setSettingsFeedback] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Member | null>(null);
  const [mealLogs, setMealLogs] = useState<Record<string, number>>({});
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(emptyState.preferences);
  const [hydrated, setHydrated] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const currentMonth = getCurrentMonth();
  useEffect(() => {
    if (tab === "Meals") setSelectedMonth(currentMonth);
  }, [tab, currentMonth]);
  useEffect(() => {
    try {
      const saved = cloudEnabled ? null : localStorage.getItem("messmate-state");
      const savedAccounts = localStorage.getItem("messmate-accounts");
      if (saved) {
        const parsed = JSON.parse(saved) as StoredState;
        setExpenses(parsed.expenses || []); setRequests(parsed.requests || []); setBills(parsed.bills || emptyBills); setMembers((parsed.members || []).map(member => ({ ...member, role: isFixedAdminMember(member) ? "Admin" : "Member" }))); setMealLogs(parsed.mealLogs || {}); setMessages(parsed.messages || []); setPinnedMessageId(parsed.pinnedMessageId || null); setRules(parsed.rules || []); setPreferences(parsed.preferences || emptyState.preferences);
      }
      if (savedAccounts) setAccounts(JSON.parse(savedAccounts) as Account[]);
      const session = cloudEnabled ? null : localStorage.getItem("messmate-session");
      if (session) setAccount(JSON.parse(session) as Account);
    } catch { setAuthError("Saved local data could not be read. Please sign in again."); }
    finally { setHydrated(true); }
  }, []);
  useEffect(() => {
    if (!cloudEnabled || !supabase) return;
    const client = supabase;
    let active = true;
    const loadCloud = async () => {
      setCloudSyncing(true); setCloudError("");
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) { setHydrated(true); setCloudReady(false); setCloudSyncing(false); return; }
      const { data, error } = await client.from("mess_app_state").select("state").eq("mess_id", messId).maybeSingle();
      if (error) setCloudError(`Cloud data could not be loaded: ${error.message}`);
      const { data: profiles, error: profileError } = await client.from("mess_members").select("id, user_id, display_name, member_code, room_rent, role").eq("mess_id", messId);
      if (profileError) setCloudError(`Cloud membership could not be loaded: ${profileError.message}`);
      const profile = profiles?.find(item => item.user_id === auth.user.id);
      if (active && data?.state) {
        const parsed = data.state as StoredState;
        setExpenses(parsed.expenses || []); setRequests(parsed.requests || []); setBills(parsed.bills || emptyBills); setMembers((parsed.members || []).map(member => ({ ...member, role: isFixedAdminMember(member) ? "Admin" : "Member" }))); setMealLogs(parsed.mealLogs || {}); setMessages(parsed.messages || []); setPinnedMessageId(parsed.pinnedMessageId || null); setRules(parsed.rules || []); setPreferences(parsed.preferences || emptyState.preferences);
      }
      if (active && profiles?.length) {
        setMembers(profiles.map(item => ({ name: item.display_name, id: item.member_code, initials: item.display_name.slice(0, 2).toUpperCase(), role: item.role === "admin" ? "Admin" : "Member", meals: 0, rent: Number(item.room_rent || 0), color: "bg-[#e1efe4] text-[#35624a]" })));
      }
      if (active) {
        setAccount({ name: profile?.display_name || auth.user.user_metadata?.name || auth.user.email?.split("@")[0] || "Member", username: auth.user.email || "", password: "", memberId: profile?.member_code || auth.user.id, role: profile?.role === "admin" ? "admin" : "member", rent: Number(profile?.room_rent || 0), userId: auth.user.id });
        setHydrated(true); setCloudReady(true); setCloudSyncing(false);
      }
    };
    loadCloud().catch(error => { if (active) { setCloudError(`Cloud data could not be loaded: ${error instanceof Error ? error.message : "Unknown error"}`); setHydrated(true); setCloudSyncing(false); } });
    const listener = client.auth.onAuthStateChange(() => { loadCloud().catch(() => undefined); });
    const channel = client.channel(`messmate-state-${messId}`).on("postgres_changes", { event: "*", schema: "public", table: "mess_app_state", filter: `mess_id=eq.${messId}` }, () => { loadCloud().catch(() => undefined); }).subscribe();
    return () => { active = false; listener.data.subscription.unsubscribe(); client.removeChannel(channel); };
  }, []);
  useEffect(() => {
    if (hydrated && !cloudEnabled) localStorage.setItem("messmate-state", JSON.stringify({ expenses, requests, bills, members, mealLogs, messages, pinnedMessageId, rules, preferences }));
  }, [expenses, requests, bills, members, mealLogs, messages, pinnedMessageId, rules, preferences, hydrated]);
  useEffect(() => {
    if (!hydrated || !cloudReady || !cloudEnabled || !supabase || !account?.userId) return;
    const state: StoredState = { expenses, requests, bills, members, mealLogs, messages, pinnedMessageId, rules, preferences };
    setCloudSyncing(true);
    supabase!.from("mess_app_state").upsert({ mess_id: messId, state, updated_by: account.userId }).then(({ error }) => {
      if (error) setCloudError(`Cloud save failed: ${error.message}`);
      setCloudSyncing(false);
    });
  }, [expenses, requests, bills, members, mealLogs, messages, pinnedMessageId, rules, preferences, hydrated, cloudReady, account?.userId]);
  useEffect(() => { if (hydrated && !cloudEnabled) localStorage.setItem("messmate-accounts", JSON.stringify(accounts)); }, [accounts, hydrated]);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };
  const totalCommodity = expenses.reduce((sum, e) => sum + e.amount, 0);
  const displayMembers = members.map(member => ({ ...member, role: isFixedAdminMember(member) ? "Admin" : "Member", meals: Object.entries(mealLogs).filter(([key]) => key.startsWith(selectedMonth) && key.endsWith(`:${member.id}`)).reduce((sum, [, count]) => sum + count, 0) }));
  const totalMeals = displayMembers.reduce((sum, member) => sum + member.meals, 0);
  const sharedTotal = Object.values(bills).reduce((sum, value) => sum + value, 0);
  const mealRate = totalMeals ? totalCommodity / totalMeals : 0;
  const perPersonShared = members.length ? sharedTotal / members.length : 0;
  const commodityContributions = members.reduce<Record<string, number>>((totals, member) => {
    totals[member.id] = expenses.filter(expense => expense.by === member.name).reduce((sum, expense) => sum + expense.amount, 0);
    return totals;
  }, {});
  const cloudMemberUuid = async (memberCode: string) => {
    if (!cloudEnabled || !supabase) return null;
    const { data, error } = await supabase!.from("mess_members").select("id").eq("mess_id", messId).eq("member_code", memberCode).maybeSingle();
    if (error) { setCloudError(`Cloud member lookup failed: ${error.message}`); return null; }
    return data?.id || null;
  };
  const addExpense = (event: React.FormEvent) => {
    event.preventDefault();
    if (!expenseForm.item || !expenseForm.amount) return;
    const expense = { item: expenseForm.item, category: expenseForm.category, by: account?.name || "Unknown member", date: new Date().toLocaleDateString(), amount: Number(expenseForm.amount), color: "bg-purple-100 text-purple-700" };
    setExpenses([expense, ...expenses]);
    if (cloudEnabled && supabase && account?.memberId) cloudMemberUuid(account.memberId).then(memberUuid => {
      if (!memberUuid) return;
      supabase!.from("expenses").insert({ mess_id: messId, added_by: memberUuid, title: expense.item, category: expense.category.toLowerCase(), amount: expense.amount, expense_date: new Date().toISOString().slice(0, 10) }).then(({ error }) => { if (error) setCloudError(`Expense save failed: ${error.message}`); });
    });
    setExpenseForm({ item: "", category: "Groceries", amount: "" }); setShowExpense(false); flash("Commodity added to October ledger");
  };
  const submitAuth = (event: React.FormEvent) => {
    event.preventDefault(); setAuthError("");
    const username = authForm.username.trim();
    if (cloudEnabled && supabase) {
      const email = username;
      const request = authMode === "login"
        ? supabase.auth.signInWithPassword({ email, password: authForm.password })
        : supabase.auth.signUp({ email, password: authForm.password, options: { data: { name: authForm.name, member_id: authForm.memberId } } });
      request.then(({ data, error }) => {
        if (error) { setAuthError(error.message); return; }
        if (!data.user) { setAuthError("Check your email to confirm the account, then sign in."); return; }
        setAccount({ name: data.user.user_metadata?.name || email.split("@")[0], username: email, password: "", memberId: data.user.id, role: "member", rent: 0, userId: data.user.id });
        setHydrated(true);
      }).catch(error => setAuthError(error instanceof Error ? error.message : "Authentication failed."));
      return;
    }
    const fixedAdmin = username === "Akaba" ? { name: "Akaba", password: "akaba" } : username === "Shahariyar" ? { name: "Shahariyar", password: "shahariyar@37" } : null;
    if (!username || !authForm.password) { setAuthError("Enter a username and password."); return; }
    if (authMode === "login") {
      const found = fixedAdmin && fixedAdmin.password === authForm.password
        ? { name: fixedAdmin.name, username, password: fixedAdmin.password, memberId: `ADMIN-${username.toUpperCase()}`, role: "admin" as const, rent: 0 }
        : accounts.find(item => item.username && item.username.toLowerCase() === username.toLowerCase() && item.password === authForm.password);
      if (!found) { setAuthError("No matching local account. Register first or check your credentials."); return; }
      setAccount(found); localStorage.setItem("messmate-session", JSON.stringify(found));
      if (!members.some(member => member.id === found.memberId)) setMembers([...members, { name: found.name, id: found.memberId, initials: found.name.slice(0, 2).toUpperCase(), role: found.role === "admin" ? "Admin" : "Member", meals: 0, rent: found.rent, color: "bg-[#e1efe4] text-[#35624a]" }]);
      return;
    }
    if (!authForm.name.trim() || !authForm.memberId.trim()) { setAuthError("Name and member ID are required."); return; }
    if (fixedAdmin) { setAuthError("Those usernames are reserved for the fixed admins."); return; }
    if (accounts.some(item => item.username.toLowerCase() === username.toLowerCase() || item.memberId === authForm.memberId.trim())) { setAuthError("That username or member ID is already registered."); return; }
    const created: Account = { name: authForm.name.trim(), username, password: authForm.password, memberId: authForm.memberId.trim(), role: "member", rent: 0 };
    const newMember: Member = { name: created.name, id: created.memberId, initials: created.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(), role: created.role === "admin" ? "Admin" : "Member", meals: 0, rent: created.rent, color: "bg-[#e1efe4] text-[#35624a]" };
    setAccounts([...accounts, created]); setMembers([...members, newMember]); setAccount(created); localStorage.setItem("messmate-session", JSON.stringify(created)); setAuthForm({ name: "", username: "", password: "", memberId: "", rent: "" });
  };
  const registerMember = (event: React.FormEvent) => {
    event.preventDefault();
    const username = memberForm.username.trim();
    if (!account || account.role !== "admin" || !memberForm.name.trim() || !username || !memberForm.memberId.trim() || !memberForm.password) { flash("Admins must provide member name, username, password, and ID."); return; }
    if (cloudEnabled) { flash("Shared mode requires the member to register with Supabase Auth first, then an admin can assign their mess membership in Supabase."); return; }
    if (accounts.some(item => item.username.toLowerCase() === username.toLowerCase() || item.memberId === memberForm.memberId.trim())) { flash("That username or member ID is already in use."); return; }
    const created: Account = { name: memberForm.name.trim(), username, password: memberForm.password, memberId: memberForm.memberId.trim(), role: "member", rent: Number(memberForm.rent) || 0 };
    setAccounts([...accounts, created]); setMembers([...members, { name: created.name, id: created.memberId, initials: created.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(), role: "Member", meals: 0, rent: created.rent, color: "bg-[#e1efe4] text-[#35624a]" }]); setMemberForm({ name: "", username: "", password: "", memberId: "", rent: "" }); flash(`${created.name} registered as a member`);
  };
  const updateRent = (memberId: string, rent: number) => {
    if (account?.role !== "admin") return;
    setMembers(current => current.map(member => member.id === memberId ? { ...member, rent } : member));
    setAccounts(current => current.map(item => item.memberId === memberId ? { ...item, rent } : item));
    if (cloudEnabled && supabase) supabase!.from("mess_members").update({ room_rent: rent }).eq("mess_id", messId).eq("member_code", memberId).then(({ error }) => { if (error) setCloudError(`Rent update failed: ${error.message}`); });
  };
  const changePassword = (event: React.FormEvent) => {
    event.preventDefault(); setSettingsFeedback("");
    if (!account) return;
    if (cloudEnabled && supabase) {
      const client = supabase;
      if (!account.username || !passwordForm.current) { setSettingsFeedback("Enter your current password."); return; }
      client.auth.signInWithPassword({ email: account.username, password: passwordForm.current }).then(({ error }) => {
        if (error) { setSettingsFeedback("Current password is incorrect."); return; }
        if (passwordForm.next.length < 6) { setSettingsFeedback("New password must be at least 6 characters."); return; }
        if (passwordForm.next !== passwordForm.confirm) { setSettingsFeedback("New password and confirmation do not match."); return; }
        client.auth.updateUser({ password: passwordForm.next }).then(({ error: updateError }) => {
          if (updateError) setSettingsFeedback(updateError.message);
          else { setPasswordForm({ current: "", next: "", confirm: "" }); setSettingsFeedback("Password changed successfully."); }
        });
      });
      return;
    }
    if (passwordForm.current !== account.password) { setSettingsFeedback("Current password is incorrect."); return; }
    if (passwordForm.next.length < 6) { setSettingsFeedback("New password must be at least 6 characters."); return; }
    if (passwordForm.next !== passwordForm.confirm) { setSettingsFeedback("New password and confirmation do not match."); return; }
    const updated = { ...account, password: passwordForm.next };
    setAccount(updated); setAccounts(current => current.map(item => item.username === account.username ? updated : item)); localStorage.setItem("messmate-session", JSON.stringify(updated));
    setPasswordForm({ current: "", next: "", confirm: "" }); setSettingsFeedback("Password changed successfully.");
  };
  const deleteMember = () => {
    if (!account || account.role !== "admin") { flash("Only admins can delete members."); return; }
    if (!deleteCandidate) { flash("Select a member to delete."); return; }
    if (isFixedAdminMember(deleteCandidate) || deleteCandidate.id === account.memberId) { flash("Fixed and current admin accounts cannot be deleted."); return; }
    const memberId = deleteCandidate.id;
    const deletedName = deleteCandidate.name;
    setMembers(current => current.filter(member => member.id !== memberId));
    setAccounts(current => current.filter(item => item.memberId !== memberId));
    setMealLogs(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.endsWith(`:${memberId}`))));
    setRequests(current => current.filter(request => request.member !== deletedName));
    if (cloudEnabled && supabase) supabase!.from("mess_members").delete().eq("mess_id", messId).eq("member_code", memberId).then(({ error }) => { if (error) setCloudError(`Member deletion failed: ${error.message}`); });
    setDeleteCandidate(null); flash(`${deleteCandidate.name} was removed and related local records were cleaned up.`);
  };
  const updateMeal = (date: string, memberId: string, count: number) => {
    if (account?.role !== "admin" || !Number.isFinite(count) || count < 0) return;
    setMealLogs(current => {
      const next = { ...current, [`${date}:${memberId}`]: count };
      const monthTotal = Object.entries(next).filter(([key]) => key.startsWith(selectedMonth) && key.endsWith(`:${memberId}`)).reduce((sum, [, value]) => sum + value, 0);
      setMembers(currentMembers => currentMembers.map(member => member.id === memberId ? { ...member, meals: monthTotal } : member));
      return next;
    });
    if (cloudEnabled && supabase) cloudMemberUuid(memberId).then(memberUuid => {
      if (!memberUuid) return;
      supabase!.from("meals").upsert({ mess_id: messId, member_id: memberUuid, meal_date: date, meal_count: count, breakfast: count >= 1, lunch: count >= 2, dinner: count >= 3 }, { onConflict: "member_id,meal_date" }).then(({ error }) => { if (error) setCloudError(`Meal save failed: ${error.message}`); });
    });
  };
  const savePreferences = (next: Preferences) => {
    setPreferences(next);
    if (cloudEnabled && supabase && account?.userId) supabase!.from("mess_app_state").select("state").eq("mess_id", messId).maybeSingle().then(({ data }) => {
      const state = { ...(data?.state as StoredState || emptyState), preferences: next };
      return supabase!.from("mess_app_state").upsert({ mess_id: messId, state, updated_by: account.userId });
    }).then(result => { if (result?.error) setCloudError(`Preferences save failed: ${result.error.message}`); });
    flash(cloudEnabled ? "Preferences saved to Supabase" : "Preferences saved locally");
  };
  const addMessage = (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const message = { id: `${Date.now()}`, author: account?.name || "Member", body: trimmed, createdAt: new Date().toISOString() };
    setMessages(current => [...current, message]);
    if (cloudEnabled && supabase && account?.userId) supabase!.from("community_messages").insert({ mess_id: messId, author_id: account.userId, body: trimmed }).then(({ error }) => { if (error) setCloudError(`Message save failed: ${error.message}`); });
  };
  const updatePinnedMessage = (id: string | null) => {
    setPinnedMessageId(id);
    if (cloudEnabled && supabase && account?.userId) supabase!.from("community_settings").upsert({ mess_id: messId, pinned_message_id: id, updated_by: account.userId }).then(({ error }) => { if (error) setCloudError(`Notice save failed: ${error.message}`); });
  };
  const updateBills = (next: BillState) => {
    setBills(next);
    if (cloudEnabled && supabase && account?.userId) supabase!.from("shared_bills").upsert({ mess_id: messId, month: `${selectedMonth}-01`, ...next }).then(({ error }) => { if (error) setCloudError(`Shared bills save failed: ${error.message}`); });
  };
  const finalizeSnapshot = () => {
    setClosed(true);
    if (cloudEnabled && supabase && account?.userId) {
      const due = new Date(`${selectedMonth}-01T00:00:00`);
      due.setMonth(due.getMonth() + 1); due.setDate(10);
      supabase!.from("monthly_snapshots").upsert({ mess_id: messId, month: `${selectedMonth}-01`, due_date: due.toISOString().slice(0, 10), total_people: members.length, total_meals: totalMeals, total_commodity_cost: totalCommodity, meal_rate: mealRate, shared_bills: sharedTotal, member_balances: displayMembers, closed_at: new Date().toISOString() }).then(({ error }) => { if (error) setCloudError(`Snapshot save failed: ${error.message}`); });
    }
    flash("Monthly snapshot finalized");
  };
  const signOut = () => { setAccount(null); if (cloudEnabled && supabase) supabase.auth.signOut(); else localStorage.removeItem("messmate-session"); };
  const nav = (next: Tab) => { if (next === "Meals") setSelectedMonth(currentMonth); setTab(next); setMobileNav(false); };
  if (!account) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} error={authError} onSubmit={submitAuth} cloudMode={cloudEnabled} />;
  return <div className="min-h-screen bg-cream">
    <aside className={`fixed z-30 flex h-screen w-[248px] flex-col border-r border-line bg-white px-5 py-6 transition-transform md:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center gap-2 px-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-moss text-white"><Utensils size={19} /></div><span className="font-display text-xl font-bold tracking-tight">messmate<span className="text-terracotta">.</span></span></div>
      <div className="mt-12 px-2 text-[10px] font-bold uppercase tracking-[.2em] text-gray-400">Workspace</div>
      <nav className="mt-3 space-y-1">{(["Overview", "Meals", "Expenses", "Members", "Admin close"] as Tab[]).map(item => <button key={item} onClick={() => nav(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${tab === item ? "bg-[#eaf3ec] text-moss" : "text-gray-500 hover:bg-gray-50 hover:text-ink"}`}>{item === "Overview" ? <Home size={17} /> : item === "Meals" ? <CalendarDays size={17} /> : item === "Expenses" ? <Receipt size={17} /> : item === "Members" ? <Users size={17} /> : <ShieldCheck size={17} />}{item}</button>)}</nav>
      <div className="mt-auto rounded-2xl bg-[#f4f7f2] p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-moss"><Sparkles size={14} /> OCTOBER CLOSE</div><p className="mb-3 text-xs leading-relaxed text-gray-500">{closed ? "October is finalized and immutable." : "Enter shared bills and approve requests before closing."}</p><div className="h-1.5 overflow-hidden rounded-full bg-[#dce7dd]"><div className={`h-full rounded-full bg-moss ${closed ? "w-full" : "w-[74%]"}`} /></div></div>
      <div className="mt-5 space-y-1 border-t border-line pt-4"><button onClick={() => nav("Community")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-500"><Bell size={17} /> Notice & community</button><button onClick={() => nav("Settings")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-500"><Settings size={17} /> Settings</button><button onClick={() => nav("Help")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-500"><CircleHelp size={17} /> Help center</button></div>
    </aside>
    {mobileNav && <div className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileNav(false)} />}
    <main className="md:ml-[248px]"><header className="flex h-[76px] items-center justify-between border-b border-line bg-white px-5 sm:px-10"><div className="flex items-center gap-3"><button className="md:hidden" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-gray-400">Welcome, {account.name}</p><h1 className="font-display text-lg font-bold text-ink sm:text-xl">Riverside House <ChevronDown className="ml-1 inline-block text-gray-400" size={16} /></h1></div></div><div className="flex items-center gap-4"><button className="relative text-gray-400" onClick={() => flash("No new notifications")}><Bell size={19} /><span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-terracotta" /></button><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7e7d9] text-xs font-bold text-moss">{account.name.slice(0, 2).toUpperCase()}</div><span className="hidden text-sm font-semibold sm:block">{account.name} Â· {account.role}</span><button onClick={signOut} className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-gray-500">Sign out</button></div></div></header>
      <div className="mx-auto max-w-[1400px] p-5 sm:p-10"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400"><span className="rounded bg-[#eaf3ec] px-2 py-1 text-moss">ACTIVE MONTH</span><span>{selectedMonth}</span></div><h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tab === "Overview" ? "Your month at a glance." : tab}</h2><p className="mt-2 text-sm text-gray-500">{tab === "Admin close" ? "Review requests, enter shared costs, and finalize an auditable monthly bill." : "Transparent household accounting for every member."}</p></div><div className="flex gap-2">{tab === "Expenses" && <button onClick={() => setShowExpense(true)} className="flex items-center gap-2 rounded-xl bg-moss px-4 py-2.5 text-sm font-bold text-white"><Plus size={17} /> Add commodity</button>}<button onClick={() => flash("Report export is available after a monthly close")} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-gray-600"><Download size={16} /> <span className="hidden sm:inline">Export</span></button></div></div>
        {cloudError && <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><span>{cloudError}</span><button onClick={() => setCloudError("")}><X size={15} /></button></div>}
        {cloudEnabled && <div className="mb-5 rounded-xl border border-[#b8d4bc] bg-[#edf7ef] px-4 py-3 text-xs font-semibold text-moss">{cloudSyncing ? "Syncing with Supabaseâ€¦" : "Connected to shared Supabase data"}</div>}
        {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-[#b8d4bc] bg-[#edf7ef] px-4 py-3 text-sm font-semibold text-moss"><span className="flex items-center gap-2"><Check size={16} /> {notice}</span><button onClick={() => setNotice("")}><X size={15} /></button></div>}
        {tab === "Overview" && <Overview totalCommodity={totalCommodity} totalMeals={totalMeals} mealRate={mealRate} sharedTotal={sharedTotal} flash={flash} />}
        {tab === "Meals" && <Meals members={members} mealLogs={mealLogs} selectedMonth={selectedMonth || currentMonth} setSelectedMonth={setSelectedMonth} updateMeal={updateMeal} isAdmin={account.role === "admin"} currentMonth={currentMonth} />}
        {tab === "Expenses" && <Expenses expenses={expenses} onAdd={() => setShowExpense(true)} total={totalCommodity} historyMonth={historyMonth} setHistoryMonth={setHistoryMonth} />}
        {tab === "Members" && <Members members={displayMembers} mealRate={mealRate} perPersonShared={perPersonShared} commodityContributions={commodityContributions} flash={flash} isAdmin={account.role === "admin"} memberForm={memberForm} setMemberForm={setMemberForm} registerMember={registerMember} updateRent={updateRent} onDelete={setDeleteCandidate} />}
        {tab === "Admin close" && <AdminClose requests={requests} setRequests={setRequests} bills={bills} setBills={updateBills} members={displayMembers} commodityContributions={commodityContributions} mealRate={mealRate} perPersonShared={perPersonShared} closed={closed} onClose={finalizeSnapshot} />}
        {tab === "Community" && <Community messages={messages} pinnedMessageId={pinnedMessageId} setPinnedMessageId={updatePinnedMessage} rules={rules} setRules={setRules} addMessage={addMessage} isAdmin={account.role === "admin"} />}
        {tab === "Settings" && <SettingsPanel account={account} preferences={preferences} savePreferences={savePreferences} passwordForm={passwordForm} setPasswordForm={setPasswordForm} changePassword={changePassword} feedback={settingsFeedback} />}
        {tab === "Help" && <HelpCenter />}
      </div>
    </main>
    {showExpense && <Modal title="Add commodity expense" onClose={() => setShowExpense(false)}><form onSubmit={addExpense} className="space-y-4"><Field label="Commodity name" value={expenseForm.item} onChange={value => setExpenseForm({ ...expenseForm, item: value })} placeholder="e.g. Monthly groceries" /><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-gray-500">CATEGORY<select value={expenseForm.category} onChange={event => setExpenseForm({ ...expenseForm, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-normal text-ink"><option>Groceries</option><option>Utilities</option><option>Maintenance</option><option>Other</option></select></label><Field label="AMOUNT (à§³)" value={expenseForm.amount} onChange={value => setExpenseForm({ ...expenseForm, amount: value })} placeholder="0" type="number" /></div><button className="mt-3 w-full rounded-xl bg-moss py-3 text-sm font-bold text-white">Save to monthly ledger</button></form></Modal>}
    {deleteCandidate && <Modal title="Delete member?" onClose={() => setDeleteCandidate(null)}><p className="text-sm leading-relaxed text-gray-600">Remove <b>{deleteCandidate.name}</b>? Their account, meal logs, requests, and member record will be removed from this browser. This cannot be undone.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleteCandidate(null)} className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-gray-600">Cancel</button><button onClick={deleteMember} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Delete member</button></div></Modal>}
  </div>;
}

function AuthScreen({ mode, setMode, form, setForm, error, onSubmit, cloudMode }: { mode: "login" | "register"; setMode: (mode: "login" | "register") => void; form: { name: string; username: string; password: string; memberId: string; rent: string }; setForm: (form: { name: string; username: string; password: string; memberId: string; rent: string }) => void; error: string; onSubmit: (event: React.FormEvent) => void; cloudMode: boolean }) {
  return <main className="flex min-h-screen items-center justify-center bg-cream p-5"><div className="w-full max-w-md rounded-3xl border border-line bg-white p-7 shadow-sm sm:p-9"><div className="mb-8 flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-moss text-white"><Utensils size={20} /></div><span className="font-display text-2xl font-bold">messmate<span className="text-terracotta">.</span></span></div><h1 className="font-display text-3xl font-bold">{mode === "login" ? "Welcome back." : "Create a member account."}</h1><p className="mt-2 text-sm text-gray-500">{cloudMode ? "Shared mode uses Supabase Auth. Enter an email address and password." : mode === "login" ? "Sign in with your username and password." : "Members are created with zero rent; an admin sets rent later."}</p><form onSubmit={onSubmit} className="mt-7 space-y-4">{mode === "register" && <><Field label="Full name" value={form.name} onChange={value => setForm({ ...form, name: value })} placeholder="Your name" /><Field label="Member ID" value={form.memberId} onChange={value => setForm({ ...form, memberId: value })} placeholder="MEM-01" /></>}<Field label={cloudMode ? "Email" : "Username"} value={form.username} onChange={value => setForm({ ...form, username: value })} placeholder={cloudMode ? "you@example.com" : "Username"} type={cloudMode ? "email" : "text"} /><Field label="Password" value={form.password} onChange={value => setForm({ ...form, password: value })} placeholder="Password" type="password" />{error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}<button className="w-full rounded-xl bg-moss py-3 text-sm font-bold text-white">{mode === "login" ? "Sign in" : "Register"}</button></form><button onClick={() => setMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-sm font-semibold text-moss">{mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}</button>{!cloudMode && <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">Demo/local credentials: Akaba / akaba and Shahariyar / shahariyar@37. Replace these fixed credentials with Supabase Auth before public deployment.</p>}</div></main>;
}

function Community({ messages, pinnedMessageId, setPinnedMessageId, rules, setRules, addMessage, isAdmin }: { messages: ChatMessage[]; pinnedMessageId: string | null; setPinnedMessageId: (id: string | null) => void; rules: string[]; setRules: React.Dispatch<React.SetStateAction<string[]>>; addMessage: (body: string) => void; isAdmin: boolean }) {
  const [message, setMessage] = useState("");
  const [rule, setRule] = useState("");
  const pinned = messages.find(item => item.id === pinnedMessageId);
  return <div className="space-y-5"><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><div className="flex items-center justify-between"><div><h3 className="font-display text-xl font-bold">Community notice</h3><p className="mt-1 text-sm text-gray-400">A shared notice and group chat for everyone in the mess.</p></div><Bell className="text-moss" size={20} /></div>{pinned ? <div className="mt-5 rounded-xl border border-[#cce2d0] bg-[#f4f7f2] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-moss">Pinned by admin Â· {pinned.author}</p><p className="mt-2 text-sm font-semibold">{pinned.body}</p></div> : <p className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No pinned notice yet.</p>}<div className="mt-5 space-y-3">{messages.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No messages yet. Start the conversation.</p>}{messages.map(item => <div key={item.id} className="rounded-xl border border-line p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold">{item.author}</span><span className="text-[10px] text-gray-400">{new Date(item.createdAt).toLocaleString()}</span></div><p className="mt-2 text-sm text-gray-600">{item.body}</p>{isAdmin && <button onClick={() => setPinnedMessageId(pinnedMessageId === item.id ? null : item.id)} className="mt-3 text-xs font-bold text-moss">{pinnedMessageId === item.id ? "Unpin notice" : "Pin notice"}</button>}</div>)}</div><form onSubmit={event => { event.preventDefault(); addMessage(message); setMessage(""); }} className="mt-5 flex gap-2"><input required value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a message for the group..." className="min-w-0 flex-1 rounded-xl border border-line px-3 py-3 text-sm" /><button className="rounded-xl bg-moss px-4 text-sm font-bold text-white">Post</button></form></section><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h3 className="font-display text-xl font-bold">Mess rules</h3><p className="mt-1 text-sm text-gray-400">Rules are maintained by admins and visible to everyone.</p><div className="mt-5 space-y-2">{rules.length === 0 && <p className="text-sm text-gray-400">No rules have been added.</p>}{rules.map((item, index) => <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-xl border border-line p-3"><span className="flex-1 text-sm">{item}</span>{isAdmin && <button onClick={() => setRules(current => current.filter((_, ruleIndex) => ruleIndex !== index))} className="text-xs font-bold text-red-500">Delete</button>}</div>)}</div>{isAdmin && <form onSubmit={event => { event.preventDefault(); if (rule.trim()) setRules(current => [...current, rule.trim()]); setRule(""); }} className="mt-4 flex gap-2"><input required value={rule} onChange={event => setRule(event.target.value)} placeholder="Add a rule" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm" /><button className="rounded-xl border border-line px-4 text-xs font-bold text-moss">Add rule</button></form>}</section></div>;
}

function SettingsPanel({ account, preferences, savePreferences, passwordForm, setPasswordForm, changePassword, feedback }: { account: Account; preferences: Preferences; savePreferences: (preferences: Preferences) => void; passwordForm: { current: string; next: string; confirm: string }; setPasswordForm: (value: { current: string; next: string; confirm: string }) => void; changePassword: (event: React.FormEvent) => void; feedback: string }) {
  const [draft, setDraft] = useState(preferences);
  return <div className="max-w-2xl space-y-5"><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h3 className="font-display text-xl font-bold">Settings</h3><p className="mt-1 text-sm text-gray-400">Local preferences for {account.name} ({account.role}).</p><div className="mt-6 space-y-5"><label className="block text-sm font-semibold">Currency<select value={draft.currency} onChange={event => setDraft({ ...draft, currency: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm font-normal"><option value="BDT">BDT (à§³)</option><option value="USD">USD ($)</option><option value="INR">INR (â‚¹)</option></select></label><label className="flex items-center justify-between rounded-xl border border-line p-4 text-sm font-semibold">Expense and community notifications<input type="checkbox" checked={draft.notifications} onChange={event => setDraft({ ...draft, notifications: event.target.checked })} className="h-5 w-5 accent-[#4e8663]" /></label><label className="flex items-center justify-between rounded-xl border border-line p-4 text-sm font-semibold">Compact tables<input type="checkbox" checked={draft.compact} onChange={event => setDraft({ ...draft, compact: event.target.checked })} className="h-5 w-5 accent-[#4e8663]" /></label><button onClick={() => savePreferences(draft)} className="rounded-xl bg-moss px-5 py-3 text-sm font-bold text-white">Save preferences</button></div></section><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h3 className="font-display text-xl font-bold">Change password</h3><p className="mt-1 text-sm text-gray-400">Verify your current password before saving a new one.</p><form onSubmit={changePassword} className="mt-5 space-y-4"><Field label="Current password" value={passwordForm.current} onChange={value => setPasswordForm({ ...passwordForm, current: value })} placeholder="Current password" type="password" /><Field label="New password" value={passwordForm.next} onChange={value => setPasswordForm({ ...passwordForm, next: value })} placeholder="At least 6 characters" type="password" /><Field label="Confirm new password" value={passwordForm.confirm} onChange={value => setPasswordForm({ ...passwordForm, confirm: value })} placeholder="Repeat new password" type="password" />{feedback && <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${feedback.includes("successfully") ? "bg-[#edf7ef] text-moss" : "bg-red-50 text-red-600"}`}>{feedback}</p>}<button className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white">Change password</button></form></section></div>;
}

function HelpCenter() {
  return <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h3 className="font-display text-xl font-bold">Help center</h3><p className="mt-1 text-sm text-gray-400">Quick guidance for running your household mess.</p><div className="mt-5 space-y-4">{[["How do monthly bills work?", "Admins enter commodity expenses and shared bills, then finalize a snapshot. The meal rate is commodity cost divided by logged meals; shared bills and room rent are added per member."], ["Who can edit meal logs?", "Only admins can edit the daily log-book. Members can view the month and submit adjustment requests for admin review."], ["When are payments due?", "The monthly snapshot sets the due date to the 10th of the following month. Keep the snapshot immutable after closing."], ["Is local login secure?", "No. Local mode is for evaluation in one browser. Use Supabase Auth and server-side policies before public deployment."]].map(([question, answer]) => <details key={question} className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-bold">{question}</summary><p className="mt-3 text-sm leading-relaxed text-gray-500">{answer}</p></details>)}</div></section><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h3 className="font-display text-xl font-bold">Support</h3><p className="mt-2 text-sm leading-relaxed text-gray-500">For a household issue, post in Notice & community so all members can see it. For deployment or Supabase setup, contact the project maintainer and include the month, account role, and exact error message.</p><div className="mt-5 rounded-xl bg-[#f4f7f2] p-4 text-sm"><b>Recommended checklist:</b><ul className="mt-3 space-y-2 text-gray-600"><li>â€¢ Register all members and set rent as an admin.</li><li>â€¢ Log meals daily before the monthly close.</li><li>â€¢ Record every commodity with its date and amount.</li><li>â€¢ Approve requests and enter all four shared bills.</li></ul></div></section></div>;
}

function Overview({ totalCommodity, totalMeals, mealRate, sharedTotal, flash }: { totalCommodity: number; totalMeals: number; mealRate: number; sharedTotal: number; flash: (message: string) => void }) {
  return <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Approved meals" value={totalMeals.toFixed(1)} suffix=" October" trend="+8.4%" icon={<Utensils size={18} />} /><Stat label="Commodity cost" value={`à§³ ${(totalCommodity / 1000).toFixed(1)}k`} suffix=" this month" trend="+12.6%" icon={<Receipt size={18} />} down /><Stat label="Cost per meal" value={`à§³ ${mealRate.toFixed(2)}`} suffix=" average" trend="Live" icon={<DollarSign size={18} />} /><Stat label="Shared bills" value={`à§³ ${(sharedTotal / 1000).toFixed(1)}k`} suffix=" to split evenly" trend="4 categories" icon={<ShieldCheck size={18} />} /></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]"><section className="rounded-2xl border border-line bg-white p-5 sm:p-6"><div className="mb-5"><h3 className="font-display text-base font-bold">Spending overview</h3><p className="mt-1 text-xs text-gray-400">Daily commodity activity Â· October</p></div><div className="h-[230px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="spend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78a687" stopOpacity={.35} /><stop offset="100%" stopColor="#78a687" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef1ee" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9aa59d" }} tickFormatter={value => `${value} Oct`} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9aa59d" }} tickFormatter={value => `à§³${value}`} width={44} /><Tooltip contentStyle={{ border: "1px solid #e3e8e3", borderRadius: 10, fontSize: 12 }} formatter={value => [`à§³${value}`, "Spent"]} /><Area type="monotone" dataKey="spend" stroke="#4e8663" strokeWidth={2.5} fill="url(#spend)" /></AreaChart></ResponsiveContainer></div></section><section className="rounded-2xl border border-line bg-white p-5 sm:p-6"><h3 className="font-display text-base font-bold">Monthly close checklist</h3><div className="mt-5 space-y-4">{["Log all commodity expenses", "Approve meal adjustments", "Enter shared household bills", "Finalize snapshot by Nov 10"].map((item, index) => <div key={item} className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${index < 2 ? "bg-[#eaf3ec] text-moss" : "bg-gray-100 text-gray-400"}`}>{index < 2 ? <Check size={16} /> : <span className="text-xs font-bold">{index + 1}</span>}</div><span className="text-sm font-semibold">{item}</span></div>)}</div><button onClick={() => flash("Opening admin close workflow")} className="mt-6 w-full rounded-xl border border-line py-2.5 text-xs font-bold text-gray-600">Open admin close â†’</button></section></div></>;
}

function AdminClose({ requests, setRequests, bills, setBills, members, commodityContributions, mealRate, perPersonShared, closed, onClose }: { requests: Request[]; setRequests: React.Dispatch<React.SetStateAction<Request[]>>; bills: BillState; setBills: (value: BillState) => void; members: Member[]; commodityContributions: Record<string, number>; mealRate: number; perPersonShared: number; closed: boolean; onClose: () => void }) {
  const updateRequest = (id: number, status: Request["status"]) => setRequests(current => current.map(request => request.id === id ? { ...request, status } : request));
  return <div className="space-y-5"><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl font-bold">Meal adjustment requests</h3><p className="mt-1 text-sm text-gray-400">Only approved requests are included in the final snapshot.</p></div><span className="rounded-full bg-[#fff4df] px-3 py-1 text-xs font-bold text-[#9c6d16]">{requests.filter(request => request.status === "Pending").length} pending</span></div><div className="mt-5 space-y-3">{requests.map(request => <div key={request.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4"><div className="flex-1"><p className="text-sm font-bold">{request.member} Â· {request.date}</p><p className="mt-1 text-xs text-gray-500">{request.reason} Â· {request.meals} meals requested</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${request.status === "Approved" ? "bg-[#eaf3ec] text-moss" : request.status === "Rejected" ? "bg-red-50 text-red-600" : "bg-[#fff4df] text-[#9c6d16]"}`}>{request.status}</span>{request.status === "Pending" && <><button onClick={() => updateRequest(request.id, "Approved")} className="rounded-lg bg-moss px-3 py-2 text-xs font-bold text-white">Approve</button><button onClick={() => updateRequest(request.id, "Rejected")} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-gray-600">Reject</button></>}</div>)}</div></section><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><h3 className="font-display text-xl font-bold">Shared bills</h3><p className="mt-1 text-sm text-gray-400">Split evenly across all {members.length} members.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(bills).map(([key, value]) => <label key={key} className="text-xs font-bold capitalize text-gray-500">{key}<input type="number" min="0" value={value} disabled={closed} onChange={event => setBills({ ...bills, [key]: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm font-normal text-ink" /></label>)}</div><div className="mt-5 rounded-xl bg-[#f4f7f2] p-4 text-sm"><b>Shared total:</b> à§³ {Object.values(bills).reduce((sum, value) => sum + value, 0).toLocaleString()} Â· <b>Each member:</b> à§³ {perPersonShared.toFixed(2)}</div></section><section className="rounded-2xl border border-line bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-xl font-bold">Final snapshot</h3><p className="mt-1 text-sm text-gray-400">Total = (consumed meals Ã— à§³ {mealRate.toFixed(2)}) âˆ’ commodity contribution + room rent + equal shared costs. Payable by November 10, 2024.</p></div><button disabled={closed} onClick={onClose} className="rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{closed ? "October finalized" : "Finalize October"}</button></div><BillTable members={members} commodityContributions={commodityContributions} mealRate={mealRate} perPersonShared={perPersonShared} /></section></div>;
}

function Members({ members, mealRate, perPersonShared, commodityContributions, flash, isAdmin, memberForm, setMemberForm, registerMember, updateRent, onDelete }: { members: Member[]; mealRate: number; perPersonShared: number; commodityContributions: Record<string, number>; flash: (message: string) => void; isAdmin: boolean; memberForm: { name: string; username: string; password: string; memberId: string; rent: string }; setMemberForm: (form: { name: string; username: string; password: string; memberId: string; rent: string }) => void; registerMember: (event: React.FormEvent) => void; updateRent: (memberId: string, rent: number) => void; onDelete: (member: Member) => void }) {
  const [menuId, setMenuId] = useState<string | null>(null);
  return <div className="space-y-5">{isAdmin && <section className="rounded-2xl border border-line bg-white p-5"><h3 className="font-display text-xl font-bold">Register member</h3><p className="mt-1 text-sm text-gray-400">Only admins can create accounts and set room rent.</p><form onSubmit={registerMember} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><input required value={memberForm.name} onChange={event => setMemberForm({ ...memberForm, name: event.target.value })} placeholder="Full name" className="rounded-xl border border-line px-3 py-2 text-sm" /><input required value={memberForm.username} onChange={event => setMemberForm({ ...memberForm, username: event.target.value })} placeholder="Username" className="rounded-xl border border-line px-3 py-2 text-sm" /><input required value={memberForm.password} onChange={event => setMemberForm({ ...memberForm, password: event.target.value })} placeholder="Password" className="rounded-xl border border-line px-3 py-2 text-sm" /><input required value={memberForm.memberId} onChange={event => setMemberForm({ ...memberForm, memberId: event.target.value })} placeholder="Member ID" className="rounded-xl border border-line px-3 py-2 text-sm" /><div className="flex gap-2"><input type="number" min="0" value={memberForm.rent} onChange={event => setMemberForm({ ...memberForm, rent: event.target.value })} placeholder="Rent à§³" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm" /><button className="rounded-xl bg-moss px-4 text-xs font-bold text-white">Add</button></div></form></section>}<div className="grid gap-4 sm:grid-cols-2">{members.map(member => <div key={member.id} className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${member.color}`}>{member.initials}</div><div className="flex-1"><h3 className="text-sm font-bold">{member.name}</h3><p className="text-xs text-gray-400">{member.id} Â· {member.role}</p></div><div className="relative"><button onClick={() => setMenuId(menuId === member.id ? null : member.id)} className="rounded-lg p-1 hover:bg-gray-100" aria-label={`Open actions for ${member.name}`}><MoreHorizontal size={18} className="text-gray-400" /></button>{menuId === member.id && <div className="absolute right-0 top-9 z-10 w-36 rounded-xl border border-line bg-white p-1 shadow-lg">{member.role !== "Admin" && isAdmin ? <button onClick={() => { setMenuId(null); onDelete(member); }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50">Delete member</button> : <span className="block px-3 py-2 text-[11px] text-gray-400">{isAdmin ? "Fixed admin protected" : "View only"}</span>}</div>}</div></div><div className="mt-5 border-t border-line pt-4"><BillLine member={member} contribution={commodityContributions[member.id] || 0} mealRate={mealRate} perPersonShared={perPersonShared} />{isAdmin && <label className="mt-4 block text-xs font-bold text-gray-500">ROOM RENT (à§³)<input type="number" min="0" value={member.rent} onChange={event => updateRent(member.id, Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm font-normal text-ink" /></label>}</div></div>)}</div>{members.length === 0 && <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-gray-400">No members registered yet.</p>}</div>;
}
function BillTable({ members, commodityContributions, mealRate, perPersonShared }: { members: Member[]; commodityContributions: Record<string, number>; mealRate: number; perPersonShared: number }) { return <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-line text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="pb-3">Member</th><th className="pb-3">Meals Ã— rate</th><th className="pb-3">Commodity contribution</th><th className="pb-3">Shared bills</th><th className="pb-3">Rent</th><th className="pb-3 text-right">Payable total</th></tr></thead><tbody>{members.map(member => { const contribution = commodityContributions[member.id] || 0; const payable = member.meals * mealRate - contribution + perPersonShared + member.rent; return <tr key={member.id} className="border-b border-line last:border-0"><td className="py-4 font-semibold">{member.name}<span className="ml-2 text-xs text-gray-400">{member.id}</span></td><td className="py-4">à§³ {(member.meals * mealRate).toFixed(2)}</td><td className="py-4 text-terracotta">âˆ’ à§³ {contribution.toFixed(2)}</td><td className="py-4">à§³ {perPersonShared.toFixed(2)}</td><td className="py-4">à§³ {member.rent.toLocaleString()}</td><td className="py-4 text-right font-bold">à§³ {payable.toFixed(2)}</td></tr>; })}</tbody></table></div>; }
function BillLine({ member, contribution, mealRate, perPersonShared }: { member: Member; contribution: number; mealRate: number; perPersonShared: number }) { const mealBill = member.meals * mealRate; const payable = mealBill - contribution + perPersonShared + member.rent; return <><div className="flex justify-between text-xs text-gray-500"><span>{member.meals} meals Ã— à§³ {mealRate.toFixed(2)}</span><span>à§³ {mealBill.toFixed(2)}</span></div><div className="mt-2 flex justify-between text-xs text-gray-500"><span>Commodity contribution</span><span>âˆ’ à§³ {contribution.toFixed(2)}</span></div><div className="mt-2 flex justify-between text-xs text-gray-500"><span>Shared bills</span><span>à§³ {perPersonShared.toFixed(2)}</span></div><div className="mt-3 flex justify-between border-t border-line pt-3"><span className="text-xs font-bold uppercase tracking-wider text-gray-400">Payable by Nov 10</span><span className="font-display text-lg font-bold text-moss">à§³ {payable.toFixed(2)}</span></div></>; }
function Meals({ members, mealLogs, selectedMonth, setSelectedMonth, updateMeal, isAdmin, currentMonth }: { members: Member[]; mealLogs: Record<string, number>; selectedMonth: string; setSelectedMonth: (month: string) => void; updateMeal: (date: string, memberId: string, count: number) => void; isAdmin: boolean; currentMonth: string }) {
  const days = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate();
  const dates = Array.from({ length: days }, (_, index) => `${selectedMonth}-${String(index + 1).padStart(2, "0")}`);
  const archiveMonths = Array.from(new Set([...Array.from({ length: 12 }, (_, index) => { const date = new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 1 - index, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }), ...Array.from({ length: 12 }, (_, index) => { const date = new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 1 + index + 1, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }), ...Object.keys(mealLogs).map(key => key.slice(0, 7))].filter(month => month && month !== currentMonth))).sort().reverse();
  return <div className="rounded-2xl border border-line bg-white p-5 sm:p-7"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-xl font-bold">Meal log-book</h3><p className="mt-1 text-sm text-gray-400">Every member and admin has a daily editable count. {isAdmin ? "You can edit counts as an admin." : "Members can view counts but cannot edit them."}</p></div><div className="flex items-center gap-2"><button onClick={() => setSelectedMonth(currentMonth)} className={`rounded-xl px-3 py-2 text-xs font-bold ${selectedMonth === currentMonth ? "bg-moss text-white" : "border border-line text-gray-600"}`}>Current month</button><label className="flex items-center gap-2 text-xs font-bold text-gray-400">ARCHIVE<select value={selectedMonth === currentMonth ? "" : selectedMonth} onChange={event => event.target.value && setSelectedMonth(event.target.value)} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-gray-600"><option value="">Choose month</option>{archiveMonths.map(month => <option key={month} value={month}>{month}</option>)}</select></label></div></div><div className="mb-4 rounded-xl bg-[#f4f7f2] px-4 py-3 text-xs font-semibold text-moss">{selectedMonth === currentMonth ? `Current calendar month: ${selectedMonth}` : `Archive view: ${selectedMonth}`} Â· Archived logs remain preserved.</div><div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-gray-400"><th className="sticky left-0 bg-white pb-3 pr-4">Member</th>{dates.map(date => <th key={date} className="min-w-16 px-2 pb-3 text-center">{date.slice(-2)}</th>)}<th className="pl-3 pb-3 text-right">Total</th></tr></thead><tbody>{members.map(member => { const total = dates.reduce((sum, date) => sum + (mealLogs[`${date}:${member.id}`] || 0), 0); return <tr key={member.id} className="border-b border-line last:border-0"><td className="sticky left-0 bg-white py-3 pr-4 font-semibold">{member.name}<span className="block text-[10px] text-gray-400">{member.role} Â· {member.id}</span></td>{dates.map(date => { const key = `${date}:${member.id}`; const value = mealLogs[key] || 0; return <td key={date} className="px-1 py-2 text-center"><input aria-label={`${member.name} meals on ${date}`} type="number" min="0" step="0.5" value={value} disabled={!isAdmin} onChange={event => updateMeal(date, member.id, Number(event.target.value))} className={`w-14 rounded-lg border px-2 py-2 text-center text-xs ${isAdmin ? "border-line bg-white" : "border-transparent bg-gray-50 text-gray-500"}`} /></td>; })}<td className="py-3 pl-3 text-right font-bold text-moss">{total.toFixed(1)}</td></tr>; })}</tbody></table></div>{members.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No registered members yet. An admin can add members from Members.</p>}</div>;
}
function Expenses({ expenses, onAdd, total, historyMonth, setHistoryMonth }: { expenses: Expense[]; onAdd: () => void; total: number; historyMonth: string; setHistoryMonth: (month: string) => void }) {
  const visible = historyMonth === "all" ? expenses : expenses.filter(expense => expense.date.includes(historyMonth));
  return <div className="rounded-2xl border border-line bg-white p-5 sm:p-7"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-xl font-bold">All-time commodity ledger</h3><p className="mt-1 text-sm text-gray-400">Every recorded commodity remains available for audit and month closing.</p></div><div className="flex gap-2"><select value={historyMonth} onChange={event => setHistoryMonth(event.target.value)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-gray-600"><option value="all">All time</option><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option></select><button onClick={onAdd} className="rounded-xl bg-[#eaf3ec] px-3 py-2 text-xs font-bold text-moss"><Plus className="mr-1 inline" size={14} /> Add</button></div></div><div className="mb-5 rounded-xl bg-[#f4f7f2] p-4 text-sm"><b>All-time recorded cost:</b> à§³ {total.toLocaleString()} <span className="ml-2 text-gray-500">Â· {visible.length} visible records</span></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="border-b border-line text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="pb-3">Commodity</th><th className="pb-3">Added by</th><th className="pb-3">Date</th><th className="pb-3 text-right">Amount</th></tr></thead><tbody>{visible.map((expense, index) => <tr key={`${expense.item}-${index}`} className="border-b border-line last:border-0"><td className="py-4"><span className={`mr-3 inline-flex rounded-lg px-2 py-1 text-[10px] font-bold ${expense.color}`}>{expense.category}</span><span className="text-sm font-semibold">{expense.item}</span></td><td className="py-4 text-sm text-gray-500">{expense.by}</td><td className="py-4 text-sm text-gray-500">{expense.date}</td><td className="py-4 text-right text-sm font-bold">à§³ {expense.amount.toLocaleString()}</td></tr>)}</tbody></table>{visible.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No commodity records yet. Add the first one to start your permanent ledger.</p>}</div></div>;
}
function Stat({ label, value, suffix, trend, icon, down }: { label: string; value: string; suffix: string; trend: string; icon: React.ReactNode; down?: boolean }) { return <div className="rounded-2xl border border-line bg-white p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold text-gray-400">{label}</span><span className="text-moss">{icon}</span></div><div className="mt-4 flex items-baseline gap-1"><span className="font-display text-2xl font-bold">{value}</span><span className="text-[11px] text-gray-400">{suffix}</span></div><div className={`mt-3 flex items-center gap-1 text-[11px] font-bold ${down ? "text-terracotta" : "text-moss"}`}>{down ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{trend}</div></div>; }
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="text-xs font-bold text-gray-500">{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-moss" /></label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h3 className="font-display text-xl font-bold">{title}</h3><button onClick={onClose}><X size={18} className="text-gray-400" /></button></div>{children}</div></div>; }
