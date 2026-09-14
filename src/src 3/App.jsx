import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar, FileText, Headphones, Layers, GraduationCap, Video, CheckCircle2,
  Circle, Plus, X, Send, Loader2, Users, LogOut, ChevronRight, Sparkles,
  Trash2, Info, ChevronLeft, AlertCircle,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import * as db from "./db";
import { getAIFeedback } from "./aiFeedback";

const GREEN = "#008541";
const GREEN_DARK = "#046a35";
const CREAM = "#FAF6EE";
const CARD_BEIGE = "#F1ECE0";
const BORDER = "#E4DECF";
const INK = "#242320";
const MUTED = "#7A756A";
const LEVELS = ["A1", "A2", "B1", "B2"];

const SELF_LEVELS = ["Complete beginner", "A1", "A2", "B1", "B2", "C1", "C2", "Not sure"];
const WHY_LEARNING = ["I live in Spain", "I'm moving to Spain", "Work / career", "Business", "University / studies", "Travel", "Relationship / partner", "Family", "Social life / making friends", "Exams / certification", "Personal interest", "I want to feel more confident", "Other"];
const PRIORITIES = ["Speak more fluently", "Speak without translating", "Understand native speakers", "Expand vocabulary", "Improve grammar", "Improve pronunciation", "Improve writing", "Improve reading", "Build confidence", "Learn colloquial Spanish", "Spanish for work", "Spanish for everyday life", "Other"];
const WHERE_USED = ["At home", "At work", "With colleagues", "With friends", "With my partner", "With family", "In restaurants / cafés", "In shops", "At the doctor / pharmacy", "Government / admin situations", "University", "Travel", "Social media", "Other"];
const CHALLENGES = ["Lack of vocabulary", "Grammar", "Listening comprehension", "Speaking", "Pronunciation", "Lack of practice", "Fear of making mistakes", "Lack of confidence", "Lack of time", "I don't know what to study", "I lose motivation", "I don't have anyone to practice with", "Other"];
const ACTIVITIES = ["Conversation", "Videos", "Podcasts", "Reading", "Stories", "Grammar exercises", "Vocabulary exercises", "Games / quizzes", "Writing", "Role-plays", "Real-life situations", "Homework", "Other"];
const CORRECTION_PREFS = ["Correct every mistake", "Correct important mistakes only", "Correct me immediately", "Let me finish, then correct me", "Only correct mistakes that affect communication", "Focus on grammar", "Focus on pronunciation", "Give me more natural alternatives"];

/* ---------------------------------------------------------------- */
/* Fill-in-the-blank worksheet rendering                             */
/* Any run of 3+ underscores ("_____") in a teacher's instructions   */
/* becomes its own small answer box, inline, instead of one big blob */
/* of text the student has to retype from scratch.                   */
/* ---------------------------------------------------------------- */
function countBlanks(text) { return ((text || "").match(/_{3,}/g) || []).length; }

function fillBlanksIntoText(text, values) {
  let i = -1;
  return (text || "").replace(/_{3,}/g, () => { i++; const v = (values[i] || "").trim(); return v ? v : "_____"; });
}

function BlankWorksheet({ text, values, onChange, disabled }) {
  const parts = (text || "").split(/(_{3,})/g);
  let blankIndex = -1;
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: INK }}>
      {parts.map((part, i) => {
        if (/^_{3,}$/.test(part)) {
          blankIndex++;
          const idx = blankIndex;
          const val = values[idx] || "";
          return (
            <input
              key={i}
              value={val}
              disabled={disabled}
              onChange={(e) => onChange(idx, e.target.value)}
              className="inline-block mx-1 px-1 border-b-2 bg-transparent outline-none align-baseline"
              style={{ borderColor: disabled ? BORDER : GREEN, minWidth: 60, width: Math.max(60, val.length * 8 + 20), color: INK }}
            />
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </div>
  );
}

/* ---------------- UI atoms ---------------- */
function Btn({ children, onClick, variant = "primary", className = "", disabled }) {
  const styles = {
    primary: { backgroundColor: GREEN, color: "white" },
    ghost: { backgroundColor: "transparent", color: INK, border: `1px solid ${BORDER}` },
    danger: { backgroundColor: "transparent", color: "#b3432b", border: "1px solid #e3c9c1" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={"inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed " + className}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}
function Input(props) {
  return <input {...props} className={"w-full rounded-lg px-3 py-2 text-sm bg-white outline-none " + (props.className || "")} style={{ border: `1px solid ${BORDER}`, color: INK }} />;
}
function Textarea(props) {
  return <textarea {...props} className={"w-full rounded-lg px-3 py-2 text-sm bg-white outline-none resize-y " + (props.className || "")} style={{ border: `1px solid ${BORDER}`, color: INK, minHeight: 90 }} />;
}

/* ---------------------------------------------------------------- */
/* Lightweight formatted documents — type simple symbols, see them   */
/* rendered nicely. **bold**, # Big heading, ## Smaller heading,     */
/* "- item" for bullet lists, and --- for a divider line.            */
/* ---------------------------------------------------------------- */
function renderInline(text) {
  const parts = (text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>));
}
function RichDoc({ text, className = "" }) {
  const lines = (text || "").split("\n");
  const elements = [];
  let list = [];
  const flushList = () => {
    if (list.length) { elements.push(<ul key={"l" + elements.length} className="list-disc pl-5 my-1 space-y-0.5">{list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}</ul>); list = []; }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^---+$/.test(t)) { flushList(); elements.push(<hr key={"h" + i} className="my-3" style={{ borderColor: BORDER }} />); return; }
    if (/^##\s+/.test(t)) { flushList(); elements.push(<h4 key={"h2" + i} className="text-sm font-semibold mt-3 mb-1" style={{ fontFamily: "Georgia, serif", color: INK }}>{renderInline(t.replace(/^##\s+/, ""))}</h4>); return; }
    if (/^#\s+/.test(t)) { flushList(); elements.push(<h3 key={"h1" + i} className="text-base font-semibold mt-3 mb-1" style={{ fontFamily: "Georgia, serif", color: INK }}>{renderInline(t.replace(/^#\s+/, ""))}</h3>); return; }
    if (/^[-*]\s+/.test(t)) { list.push(t.replace(/^[-*]\s+/, "")); return; }
    flushList();
    if (t === "") { elements.push(<div key={"b" + i} className="h-2" />); return; }
    elements.push(<p key={"p" + i} className="mb-1">{renderInline(line)}</p>);
  });
  flushList();
  return <div className={"text-sm leading-relaxed " + className} style={{ color: INK }}>{elements}</div>;
}
function RichEditor({ value, onChange, onBlur, placeholder, minHeight = 160 }) {
  const ref = useRef(null);
  const wrapSelection = (marker) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = start + marker.length; el.selectionEnd = start + marker.length + selected.length; });
  };
  const prefixLine = (prefix) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => el.focus());
  };
  const addDivider = () => onChange(value + (value.endsWith("\n") || !value ? "" : "\n") + "\n---\n");
  const tbBtn = "text-xs px-2 py-1 rounded";
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        <button type="button" onClick={() => wrapSelection("**")} className={tbBtn} style={{ border: `1px solid ${BORDER}`, fontWeight: 700 }}>B</button>
        <button type="button" onClick={() => prefixLine("# ")} className={tbBtn} style={{ border: `1px solid ${BORDER}` }}>Title</button>
        <button type="button" onClick={() => prefixLine("## ")} className={tbBtn} style={{ border: `1px solid ${BORDER}` }}>Subtitle</button>
        <button type="button" onClick={() => prefixLine("- ")} className={tbBtn} style={{ border: `1px solid ${BORDER}` }}>• List</button>
        <button type="button" onClick={addDivider} className={tbBtn} style={{ border: `1px solid ${BORDER}` }}>— Divider</button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm bg-white outline-none resize-y"
        style={{ border: `1px solid ${BORDER}`, color: INK, minHeight, fontFamily: "ui-monospace, monospace" }}
      />
      <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: CARD_BEIGE }}>
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: MUTED, letterSpacing: "0.05em" }}>Preview</div>
        {value ? <RichDoc text={value} /> : <p className="text-xs" style={{ color: MUTED }}>Nothing written yet.</p>}
      </div>
    </div>
  );
}
function Select({ children, ...props }) {
  return <select {...props} className="w-full rounded-lg px-3 py-2 text-sm bg-white outline-none" style={{ border: `1px solid ${BORDER}`, color: INK }}>{children}</select>;
}
function CheckboxGroup({ options, values, onChange, max, disabled }) {
  const toggle = (opt) => {
    if (disabled) return;
    const has = values.includes(opt);
    if (has) onChange(values.filter((v) => v !== opt));
    else {
      if (max && values.length >= max) return;
      onChange([...values, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <button type="button" key={opt} onClick={() => toggle(opt)} disabled={disabled}
            className="text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
            style={{ backgroundColor: active ? GREEN : "white", color: active ? "white" : INK, border: `1px solid ${active ? GREEN : BORDER}` }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}
function Card({ children, className = "", style = {} }) {
  return <div className={"rounded-2xl bg-white " + className} style={{ border: `1px solid ${BORDER}`, ...style }}>{children}</div>;
}
function SectionTitle({ children, sub }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl" style={{ fontFamily: "Georgia, serif", color: INK }}>{children}</h2>
      {sub && <p className="text-sm mt-1" style={{ color: MUTED }}>{sub}</p>}
    </div>
  );
}
function EmptyState({ text }) {
  return <div className="text-sm rounded-xl px-4 py-6 text-center" style={{ color: MUTED, backgroundColor: CARD_BEIGE }}>{text}</div>;
}
function Feedback({ text }) {
  return (
    <div className="mt-3 rounded-xl p-4 text-sm whitespace-pre-line" style={{ backgroundColor: "#eef6ee", border: "1px solid #cfe6cf", color: "#204d2c" }}>
      <div className="flex items-center gap-2 mb-2 font-medium"><Sparkles size={15} /> Feedback de IA</div>
      {text}
    </div>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(30,28,22,0.35)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={"bg-white rounded-2xl w-full " + (wide ? "max-w-2xl" : "max-w-md")} style={{ border: `1px solid ${BORDER}`, maxHeight: "88vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h3 className="text-lg" style={{ fontFamily: "Georgia, serif", color: INK }}>{title}</h3>
          <button onClick={onClose}><X size={18} color={MUTED} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Logo({ size = 36 }) {
  return <div className="rounded-full flex items-center justify-center font-bold text-white" style={{ width: size, height: size, backgroundColor: GREEN, fontFamily: "Georgia, serif" }}>J</div>;
}

/* ---------------- Login ---------------- */
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(null);
  const [teacherTab, setTeacherTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitTeacher = async () => {
    setError(""); setLoading(true);
    try {
      const user = teacherTab === "signup" ? await db.teacherSignUp(email, password, name) : await db.teacherSignIn(email, password);
      onLogin({ role: "teacher", userId: user.id });
    } catch (e) { setError(e.message || "Something went wrong."); }
    setLoading(false);
  };
  const submitStudent = async () => {
    setError(""); setLoading(true);
    try {
      const { studentId, userId } = await db.studentLogin(name, code);
      onLogin({ role: "student", studentId, userId });
    } catch (e) { setError("No encontramos ese nombre y código. Revisa con tu profesora."); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: CREAM }}>
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <Logo />
          <span className="text-xl" style={{ fontFamily: "Georgia, serif", color: INK }}>July Academy</span>
        </div>

        {!mode && (
          <>
            <h1 className="text-3xl mb-2" style={{ fontFamily: "Georgia, serif", color: INK }}>Welcome</h1>
            <p className="text-sm mb-6" style={{ color: MUTED }}>Your Spanish classroom — lessons, homework, resources and practice, all in one place.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setMode("teacher"); setError(""); }} className="text-left p-4 rounded-xl" style={{ backgroundColor: CARD_BEIGE, border: `1px solid ${BORDER}` }}>
                <div className="font-medium mb-1" style={{ fontFamily: "Georgia, serif" }}>I'm the teacher</div>
                <div className="text-xs" style={{ color: MUTED }}>Manage students, lessons & content</div>
              </button>
              <button onClick={() => { setMode("student"); setError(""); }} className="text-left p-4 rounded-xl" style={{ backgroundColor: CARD_BEIGE, border: `1px solid ${BORDER}` }}>
                <div className="font-medium mb-1" style={{ fontFamily: "Georgia, serif" }}>I'm a student</div>
                <div className="text-xs" style={{ color: MUTED }}>Log in with your name & code</div>
              </button>
            </div>
          </>
        )}

        {mode === "teacher" && (
          <div>
            <button onClick={() => setMode(null)} className="text-xs mb-4 flex items-center gap-1" style={{ color: MUTED }}><ChevronLeft size={14} />Back</button>
            <div className="flex gap-4 mb-4 text-sm">
              <button onClick={() => setTeacherTab("signin")} style={{ fontWeight: teacherTab === "signin" ? 700 : 400, color: teacherTab === "signin" ? INK : MUTED }}>Log in</button>
              <button onClick={() => setTeacherTab("signup")} style={{ fontWeight: teacherTab === "signup" ? 700 : 400, color: teacherTab === "signup" ? INK : MUTED }}>Create account</button>
            </div>
            {teacherTab === "signup" && (
              <div className="mb-3"><label className="text-xs" style={{ color: MUTED }}>Your name</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            )}
            <div className="mb-3"><label className="text-xs" style={{ color: MUTED }}>Email</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="mb-3"><label className="text-xs" style={{ color: MUTED }}>Password</label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitTeacher()} /></div>
            {error && <p className="text-xs mb-3" style={{ color: "#b3432b" }}>{error}</p>}
            <Btn onClick={submitTeacher} disabled={loading} className="w-full justify-center">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null} {teacherTab === "signup" ? "Create account" : "Enter"}
            </Btn>
          </div>
        )}

        {mode === "student" && (
          <div>
            <button onClick={() => setMode(null)} className="text-xs mb-4 flex items-center gap-1" style={{ color: MUTED }}><ChevronLeft size={14} />Back</button>
            <h2 className="text-xl mb-4" style={{ fontFamily: "Georgia, serif" }}>Student login</h2>
            <div className="mb-3"><label className="text-xs" style={{ color: MUTED }}>Your name</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="mb-3"><label className="text-xs" style={{ color: MUTED }}>Your access code</label><Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitStudent()} /></div>
            {error && <p className="text-xs mb-3" style={{ color: "#b3432b" }}>{error}</p>}
            <Btn onClick={submitStudent} disabled={loading} className="w-full justify-center">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null} Enter classroom
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Shell ---------------- */
function Shell({ roleLabel, tabs, active, setActive, onLogout, children }) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: CREAM }}>
      <div className="w-64 shrink-0 p-5 hidden md:flex md:flex-col" style={{ borderRight: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2 mb-8">
          <Logo size={32} />
          <div>
            <div className="text-sm font-medium" style={{ fontFamily: "Georgia, serif", color: INK }}>July Academy</div>
            <div className="text-xs" style={{ color: MUTED }}>{roleLabel}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActive(t.key)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left" style={{ backgroundColor: active === t.key ? CARD_BEIGE : "transparent", color: active === t.key ? INK : MUTED, fontWeight: active === t.key ? 600 : 400 }}>
              <t.icon size={16} /> {t.label}
              {t.badge && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GREEN }} />}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} className="flex items-center gap-2 text-sm px-3 py-2" style={{ color: MUTED }}><LogOut size={15} /> Log out</button>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto gap-1 p-2" style={{ backgroundColor: "white", borderTop: `1px solid ${BORDER}` }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActive(t.key)} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg shrink-0" style={{ backgroundColor: active === t.key ? CARD_BEIGE : "transparent" }}>
            <t.icon size={16} color={active === t.key ? GREEN : MUTED} />
            <span className="text-[10px]" style={{ color: active === t.key ? INK : MUTED }}>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 p-6 md:p-10 pb-24 md:pb-10 max-w-5xl">{children}</div>
    </div>
  );
}

/* ================================================================ */
/* TEACHER VIEW                                                      */
/* ================================================================ */
function TeacherApp({ data, refresh, onLogout }) {
  const [active, setActive] = useState("students");
  const tabs = [
    { key: "students", label: "Students & groups", icon: Users },
    { key: "timetable", label: "Timetable", icon: Calendar },
    { key: "docs", label: "Personal documents", icon: FileText },
    { key: "resources", label: "Resources", icon: Headphones },
    { key: "flashcards", label: "Flashcards", icon: Layers },
    { key: "curriculum", label: "Curriculum", icon: CheckCircle2 },
    { key: "intensive", label: "Intensive course", icon: GraduationCap },
    { key: "prerecorded", label: "Pre-recorded courses", icon: Video },
  ];
  return (
    <Shell roleLabel="Teacher" tabs={tabs} active={active} setActive={setActive} onLogout={onLogout}>
      {active === "students" && <TeacherStudents data={data} refresh={refresh} />}
      {active === "timetable" && <TeacherTimetable data={data} refresh={refresh} />}
      {active === "docs" && <TeacherDocs data={data} refresh={refresh} />}
      {active === "resources" && <TeacherResources data={data} refresh={refresh} />}
      {active === "flashcards" && <TeacherFlashcards data={data} refresh={refresh} />}
      {active === "curriculum" && <TeacherCurriculum data={data} refresh={refresh} />}
      {active === "intensive" && <TeacherIntensive data={data} refresh={refresh} />}
      {active === "prerecorded" && <TeacherPrerecorded data={data} refresh={refresh} />}
    </Shell>
  );
}

function TeacherStudents({ data, refresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [form, setForm] = useState({ name: "", level: "A1", groupId: "" });
  const [groupForm, setGroupForm] = useState({ name: "", level: "A1" });

  const addStudent = async () => { if (!form.name.trim()) return; await db.addStudent(form); setForm({ name: "", level: "A1", groupId: "" }); setShowAdd(false); refresh(); };
  const addGroup = async () => { if (!groupForm.name.trim()) return; await db.addGroup(groupForm); setGroupForm({ name: "", level: "A1" }); setShowGroup(false); refresh(); };
  const removeStudent = async (id) => { await db.removeStudent(id); refresh(); };
  const setIntensive = async (studentId, groupId) => { await db.setIntensiveGroup(studentId, groupId); refresh(); };
  const [profileStudent, setProfileStudent] = useState(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionTitle sub="Add your students, organize them into groups, and share each student's login code.">Students & groups</SectionTitle>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => setShowGroup(true)}><Plus size={14} /> Group</Btn>
          <Btn onClick={() => setShowAdd(true)}><Plus size={14} /> Student</Btn>
        </div>
      </div>
      {data.groups.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {data.groups.map((g) => <span key={g.id} className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: CARD_BEIGE, color: INK }}>{g.name} · {g.level}</span>)}
        </div>
      )}
      {data.students.length === 0 ? <EmptyState text="No students yet. Add your first student to generate their access code." /> : (
        <div className="grid gap-3">
          {data.students.map((s) => {
            const group = data.groups.find((g) => g.id === s.groupId);
            return (
              <Card key={s.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-medium" style={{ color: INK }}>{s.name} <span className="text-xs font-normal" style={{ color: MUTED }}>· {s.level}{group ? ` · ${group.name}` : ""}</span></div>
                  <div className="text-xs mt-1" style={{ color: MUTED }}>Login code: <span className="font-mono px-2 py-0.5 rounded" style={{ backgroundColor: CARD_BEIGE }}>{s.code}</span>{s.profileId && <span className="ml-2" style={{ color: GREEN }}>· linked</span>}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setProfileStudent(s)} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: data.studentProfiles[s.id]?.completedAt ? "#eef6ee" : CARD_BEIGE, color: data.studentProfiles[s.id]?.completedAt ? GREEN : MUTED }}>Profile</button>
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                    Intensive:
                    <Select value={s.intensiveGroupId || ""} onChange={(e) => setIntensive(s.id, e.target.value || null)} className="!py-1 !text-xs w-auto">
                      <option value="">Not enrolled</option>
                      {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </Select>
                  </label>
                  <button onClick={() => removeStudent(s.id)}><Trash2 size={15} color="#b3432b" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {showAdd && (
        <Modal title="Add student" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <div><label className="text-xs" style={{ color: MUTED }}>Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-xs" style={{ color: MUTED }}>Level</label><Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></div>
            <div><label className="text-xs" style={{ color: MUTED }}>Group (optional)</label>
              <Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="">No group / individual</option>
                {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </div>
            <Btn onClick={addStudent} className="w-full justify-center">Add student & generate code</Btn>
          </div>
        </Modal>
      )}
      {showGroup && (
        <Modal title="New group" onClose={() => setShowGroup(false)}>
          <div className="space-y-3">
            <div><label className="text-xs" style={{ color: MUTED }}>Group name</label><Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></div>
            <div><label className="text-xs" style={{ color: MUTED }}>Level</label><Select value={groupForm.level} onChange={(e) => setGroupForm({ ...groupForm, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></div>
            <Btn onClick={addGroup} className="w-full justify-center">Create group</Btn>
          </div>
        </Modal>
      )}
      {profileStudent && (
        <Modal title={`${profileStudent.name}'s profile`} onClose={() => setProfileStudent(null)} wide>
          <StudentProfileSummary profile={data.studentProfiles[profileStudent.id]} student={profileStudent} />
        </Modal>
      )}
    </div>
  );
}

function ProfileRow({ label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="mb-3">
      <div className="text-xs" style={{ color: MUTED }}>{label}</div>
      <div className="text-sm" style={{ color: INK }}>{Array.isArray(value) ? value.join(", ") : value}</div>
    </div>
  );
}

function StudentProfileSummary({ profile, student }) {
  if (!profile?.completedAt) return <EmptyState text="This student hasn't completed their profile survey yet." />;
  return (
    <div>
      <ProfileRow label="Email" value={student.email} />
      <ProfileRow label="WhatsApp" value={student.whatsapp} />
      <ProfileRow label="Native language" value={profile.nativeLanguage} />
      <ProfileRow label="Self-assessed level" value={profile.selfLevel} />
      <ProfileRow label="Why learning Spanish" value={profile.whyLearning} />
      <ProfileRow label="Main goal" value={profile.mainGoal} />
      <ProfileRow label="Top priorities" value={profile.topPriorities} />
      <ProfileRow label="Where they'll use Spanish" value={profile.whereUsed} />
      <ProfileRow label="Biggest challenge" value={profile.biggestChallenge} />
      <ProfileRow label="Preferred activities" value={profile.preferredActivities} />
      <ProfileRow label="Correction preference" value={profile.correctionPreference} />
    </div>
  );
}
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", duration: "60", label: "", audienceType: "open", groupId: "", studentId: "" });
  const addSlot = async () => { if (!form.date || !form.time) return; await db.addSlot({ ...form, duration: Number(form.duration) }); setForm({ date: "", time: "", duration: "60", label: "", audienceType: "open", groupId: "", studentId: "" }); setShowAdd(false); refresh(); };
  const removeSlot = async (id) => { await db.removeSlot(id); refresh(); };
  const sorted = [...data.timetableSlots].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const now = new Date().toISOString().slice(0, 10);
  const describeAudience = (slot) => {
    if (slot.audience === "open") return slot.status === "available" ? "Open for booking" : `Booked by ${data.students.find((s) => s.id === slot.bookedBy)?.name || "?"}`;
    if (slot.audience.startsWith("group:")) return `Group: ${data.groups.find((g) => g.id === slot.audience.split(":")[1])?.name || "?"}`;
    if (slot.audience.startsWith("student:")) return `Student: ${data.students.find((s) => s.id === slot.audience.split(":")[1])?.name || "?"}`;
    return "";
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionTitle sub="Add fixed group or individual lessons, or open slots students can book themselves.">Timetable</SectionTitle>
        <Btn onClick={() => setShowAdd(true)}><Plus size={14} /> Add slot</Btn>
      </div>
      {sorted.length === 0 ? <EmptyState text="No timetable slots yet." /> : (
        <div className="grid gap-2">
          {sorted.map((slot) => (
            <Card key={slot.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="text-center rounded-lg px-3 py-1.5" style={{ backgroundColor: slot.date < now ? "#F1ECE0" : "#eef6ee" }}>
                  <div className="text-xs" style={{ color: MUTED }}>{slot.date}</div>
                  <div className="text-sm font-medium" style={{ color: INK }}>{slot.time}</div>
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: INK }}>{slot.label}</div>
                  <div className="text-xs" style={{ color: MUTED }}>{describeAudience(slot)} · {slot.duration} min</div>
                </div>
              </div>
              <button onClick={() => removeSlot(slot.id)}><Trash2 size={15} color="#b3432b" /></button>
            </Card>
          ))}
        </div>
      )}
      {showAdd && (
        <Modal title="Add timetable slot" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs" style={{ color: MUTED }}>Date</label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="text-xs" style={{ color: MUTED }}>Time</label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            </div>
            <div><label className="text-xs" style={{ color: MUTED }}>Label</label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Conversación A2" /></div>
            <div><label className="text-xs" style={{ color: MUTED }}>Duration (min)</label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            <div>
              <label className="text-xs" style={{ color: MUTED }}>Type</label>
              <Select value={form.audienceType} onChange={(e) => setForm({ ...form, audienceType: e.target.value })}>
                <option value="open">Open slot — any student can book</option>
                <option value="group">Fixed group class</option>
                <option value="individual-fixed">Fixed individual lesson</option>
              </Select>
            </div>
            {form.audienceType === "group" && (
              <div><label className="text-xs" style={{ color: MUTED }}>Group</label><Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}><option value="">Select group</option>{data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></div>
            )}
            {form.audienceType === "individual-fixed" && (
              <div><label className="text-xs" style={{ color: MUTED }}>Student</label><Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}><option value="">Select student</option>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            )}
            <Btn onClick={addSlot} className="w-full justify-center">Add to timetable</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TeacherDocs({ data, refresh }) {
  const [selected, setSelected] = useState(data.students[0]?.id || "");
  const [note, setNote] = useState("");
  const [showTask, setShowTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", instructions: "" });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const doc = data.personalDocs[selected] || { notes: [], homework: [] };

  const addNote = async () => { if (!note.trim()) return; await db.addNote(selected, note.trim()); setNote(""); refresh(); };
  const assign = async () => { if (!taskForm.title.trim()) return; await db.assignHomework(selected, taskForm.title, taskForm.instructions); setTaskForm({ title: "", instructions: "" }); setShowTask(false); refresh(); };
  const startEdit = (n) => { setEditingNoteId(n.id); setEditDraft(n.text); };
  const saveEdit = async () => { await db.updateNote(editingNoteId, editDraft); setEditingNoteId(null); refresh(); };

  return (
    <div>
      <SectionTitle sub="After each class, leave notes on what you covered and assign homework — students get instant AI feedback when they submit.">Personal documents</SectionTitle>
      {data.students.length === 0 ? <EmptyState text="Add students first." /> : (
        <>
          <div className="mb-5"><Select value={selected} onChange={(e) => setSelected(e.target.value)}>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <Card className="p-5 mb-5">
            <h3 className="font-medium mb-2" style={{ fontFamily: "Georgia, serif" }}>Class notes</h3>
            <RichEditor value={note} onChange={setNote} placeholder="What did you cover today?" minHeight={100} />
            <div className="mt-2"><Btn onClick={addNote}><Plus size={14} />Add note</Btn></div>
            <div className="mt-4 space-y-2">
              {doc.notes.length === 0 ? <p className="text-xs" style={{ color: MUTED }}>No notes yet.</p> : doc.notes.map((n) => (
                <div key={n.id} className="text-sm rounded-lg p-3" style={{ backgroundColor: CARD_BEIGE }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs" style={{ color: MUTED }}>{n.date}</div>
                    {editingNoteId !== n.id && <button onClick={() => startEdit(n)} className="text-xs underline" style={{ color: GREEN }}>Edit</button>}
                  </div>
                  {editingNoteId === n.id ? (
                    <div>
                      <RichEditor value={editDraft} onChange={setEditDraft} minHeight={100} />
                      <div className="mt-2 flex gap-2">
                        <Btn onClick={saveEdit}>Save</Btn>
                        <Btn variant="ghost" onClick={() => setEditingNoteId(null)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : <RichDoc text={n.text} />}
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium" style={{ fontFamily: "Georgia, serif" }}>Homework</h3>
              <Btn variant="ghost" onClick={() => setShowTask(true)}><Plus size={14} />Assign</Btn>
            </div>
            {doc.homework.length === 0 ? <EmptyState text="No homework assigned yet." /> : (
              <div className="space-y-3">
                {doc.homework.map((h) => (
                  <div key={h.id} className="rounded-lg p-4" style={{ backgroundColor: CARD_BEIGE }}>
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-sm">{h.title}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: h.status === "checked" ? "#dcefdc" : "white", color: h.status === "checked" ? "#204d2c" : MUTED }}>{h.status}</span>
                    </div>
                    <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: MUTED }}>{h.instructions}</p>
                    {h.submissionText && <p className="text-xs mt-2 italic whitespace-pre-wrap" style={{ color: INK }}>"{h.submissionText}"</p>}
                    {h.aiFeedback && <Feedback text={h.aiFeedback} />}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
      {showTask && (
        <Modal title="Assign homework" onClose={() => setShowTask(false)}>
          <div className="space-y-3">
            <div><label className="text-xs" style={{ color: MUTED }}>Title</label><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
            <div><label className="text-xs" style={{ color: MUTED }}>Instructions</label><Textarea value={taskForm.instructions} onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })} /></div>
            <Btn onClick={assign} className="w-full justify-center">Assign</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TeacherResources({ data, refresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: "video", title: "", url: "", description: "" });
  const add = async () => { if (!form.title.trim()) return; await db.addResource(form); setForm({ type: "video", title: "", url: "", description: "" }); setShowAdd(false); refresh(); };
  const remove = async (id) => { await db.removeResource(id); refresh(); };
  const icons = { video: Video, podcast: Headphones, info: Info };
  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionTitle sub="Videos, podcasts and useful info for your students to browse anytime.">Resources</SectionTitle>
        <Btn onClick={() => setShowAdd(true)}><Plus size={14} />Add resource</Btn>
      </div>
      {data.resources.length === 0 ? <EmptyState text="No resources yet." /> : (
        <div className="grid gap-2">
          {data.resources.map((r) => {
            const Icon = icons[r.type] || Info;
            return (
              <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Icon size={18} color={GREEN} />
                  <div><div className="text-sm font-medium">{r.title}</div><div className="text-xs" style={{ color: MUTED }}>{r.description}</div></div>
                </div>
                <button onClick={() => remove(r.id)}><Trash2 size={15} color="#b3432b" /></button>
              </Card>
            );
          })}
        </div>
      )}
      {showAdd && (
        <Modal title="Add resource" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="video">Video</option><option value="podcast">Podcast</option><option value="info">Useful info</option></Select>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" />
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Link (optional)" />
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            <Btn onClick={add} className="w-full justify-center">Add</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TeacherFlashcards({ data, refresh }) {
  const [form, setForm] = useState({ word: "", translation: "", example: "" });
  const add = async () => { if (!form.word.trim()) return; await db.addFlashcard(form); setForm({ word: "", translation: "", example: "" }); refresh(); };
  const remove = async (id) => { await db.removeFlashcard(id); refresh(); };
  return (
    <div>
      <SectionTitle sub="New words you want your students to review as flashcards.">Flashcards</SectionTitle>
      <Card className="p-5 mb-5">
        <div className="grid md:grid-cols-3 gap-2">
          <Input value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} placeholder="Word (Spanish)" />
          <Input value={form.translation} onChange={(e) => setForm({ ...form, translation: e.target.value })} placeholder="Translation" />
          <Input value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} placeholder="Example sentence" />
        </div>
        <div className="mt-3"><Btn onClick={add}><Plus size={14} />Add word</Btn></div>
      </Card>
      {data.flashcards.length === 0 ? <EmptyState text="No flashcards yet." /> : (
        <div className="grid sm:grid-cols-2 gap-2">
          {data.flashcards.map((f) => (
            <Card key={f.id} className="p-4 flex justify-between items-start">
              <div><div className="font-medium">{f.word} <span className="text-xs font-normal" style={{ color: MUTED }}>— {f.translation}</span></div>{f.example && <div className="text-xs italic mt-1" style={{ color: MUTED }}>{f.example}</div>}</div>
              <button onClick={() => remove(f.id)}><Trash2 size={14} color="#b3432b" /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherCurriculum({ data, refresh }) {
  const [level, setLevel] = useState("A1");
  const [studentId, setStudentId] = useState(data.students[0]?.id || "");
  const [newItem, setNewItem] = useState("");
  const addItem = async () => { if (!newItem.trim()) return; await db.addCurriculumItem(level, newItem.trim()); setNewItem(""); refresh(); };
  const toggle = async (itemId) => { if (!studentId) return; const done = !!data.progress[studentId]?.[itemId]; await db.toggleProgress(studentId, itemId, done); refresh(); };
  const progress = data.progress[studentId] || {};
  return (
    <div>
      <SectionTitle sub="Define what each level covers, then track each student's progress through it.">Curriculum</SectionTitle>
      <div className="flex gap-2 mb-5">
        {LEVELS.map((l) => <button key={l} onClick={() => setLevel(l)} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: level === l ? GREEN : CARD_BEIGE, color: level === l ? "white" : INK }}>{l}</button>)}
      </div>
      <Card className="p-5 mb-5">
        <div className="flex gap-2 mb-4">
          <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={`Add content item to ${level}`} />
          <Btn onClick={addItem}><Plus size={14} /></Btn>
        </div>
        {data.students.length > 0 && (
          <div className="mb-3"><label className="text-xs" style={{ color: MUTED }}>Mark progress for:</label><Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        )}
        <div className="space-y-1.5">
          {(data.curriculum[level] || []).map((item) => (
            <button key={item.id} onClick={() => toggle(item.id)} className="w-full flex items-center gap-2 text-sm text-left px-2 py-1.5 rounded-lg hover:bg-black/[0.02]">
              {progress[item.id] ? <CheckCircle2 size={16} color={GREEN} /> : <Circle size={16} color={MUTED} />}
              <span style={{ color: progress[item.id] ? INK : MUTED }}>{item.name}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TeacherIntensive({ data, refresh }) {
  const cohorts = data.intensiveCourses.filter((c) => Object.keys(c.students).length > 0 || c.generalDoc);
  const allGroups = data.intensiveCourses; // every group can serve as a cohort
  const [cohortId, setCohortId] = useState(allGroups[0]?.id || "");
  const cohort = data.intensiveCourses.find((c) => c.id === cohortId);
  const enrolled = cohort ? data.students.filter((s) => s.intensiveGroupId === cohort.id) : [];
  const [selected, setSelected] = useState(enrolled[0]?.id || "");
  const [showTask, setShowTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", instructions: "" });
  const [docDraft, setDocDraft] = useState(cohort?.generalDoc || "");

  useEffect(() => { setDocDraft(cohort?.generalDoc || ""); setSelected(enrolled[0]?.id || ""); }, [cohortId]); // eslint-disable-line

  const saveDoc = async () => { if (!cohortId) return; await db.saveIntensiveDoc(cohortId, docDraft); refresh(); };
  const addTask = async () => { if (!taskForm.title.trim() || !selected) return; await db.addIntensiveTask(selected, taskForm.title, taskForm.instructions); setTaskForm({ title: "", instructions: "" }); setShowTask(false); refresh(); };
  const studentTasks = cohort?.students[selected]?.tasks || [];

  return (
    <div>
      <SectionTitle sub="Each intensive cohort (e.g. 'Intensive course 1', 'Intensive course 2') is its own group with its own class document and students.">Intensive course</SectionTitle>
      {allGroups.length === 0 ? (
        <EmptyState text="Create a group first (in Students & groups) to use as an intensive cohort — e.g. 'Intensive course 1'." />
      ) : (
        <>
          <div className="mb-5"><label className="text-xs" style={{ color: MUTED }}>Cohort</label>
            <Select value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
              {allGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <Card className="p-5 mb-6">
            <h3 className="font-medium mb-2" style={{ fontFamily: "Georgia, serif" }}>General class document — {cohort?.name}</h3>
            <RichEditor value={docDraft} onChange={setDocDraft} onBlur={saveDoc} placeholder="Write your class notes here..." />
            <p className="text-xs mt-1" style={{ color: MUTED }}>Saves automatically when you click away.</p>
          </Card>
          {enrolled.length === 0 ? <EmptyState text="No students enrolled in this cohort yet — set their 'Intensive' dropdown in Students & groups." /> : (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="max-w-[220px]">{enrolled.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                <Btn variant="ghost" onClick={() => setShowTask(true)}><Plus size={14} />New task</Btn>
              </div>
              {studentTasks.length === 0 ? <EmptyState text="No individual tasks yet for this student." /> : (
                <div className="space-y-3">
                  {studentTasks.map((t) => (
                    <div key={t.id} className="rounded-lg p-4" style={{ backgroundColor: CARD_BEIGE }}>
                      <div className="flex justify-between"><span className="font-medium text-sm">{t.title}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: t.status === "checked" ? "#dcefdc" : "white" }}>{t.status}</span></div>
                      <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: MUTED }}>{t.instructions}</p>
                      {t.submissionText && <p className="text-xs mt-2 italic whitespace-pre-wrap">"{t.submissionText}"</p>}
                      {t.aiFeedback && <Feedback text={t.aiFeedback} />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
      {showTask && (
        <Modal title="New task" onClose={() => setShowTask(false)}>
          <div className="space-y-3">
            <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" />
            <Textarea value={taskForm.instructions} onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })} placeholder="Instructions" />
            <Btn onClick={addTask} className="w-full justify-center">Create task</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TeacherPrerecorded({ data, refresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(data.prerecordedCourses[0]?.id || "");
  const [form, setForm] = useState({ title: "", theoryDoc: "" });
  const [showTask, setShowTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", instructions: "" });
  const [theoryDraft, setTheoryDraft] = useState("");
  const course = data.prerecordedCourses.find((c) => c.id === selected);

  useEffect(() => { setTheoryDraft(course?.theoryDoc || ""); }, [selected]); // eslint-disable-line

  const addCourse = async () => { if (!form.title.trim()) return; const c = await db.addCourse(form.title, form.theoryDoc); setForm({ title: "", theoryDoc: "" }); setShowAdd(false); await refresh(); if (c) setSelected(c.id); };
  const saveTheory = async () => { if (!course) return; await db.saveCourseTheory(course.id, theoryDraft); refresh(); };
  const addTask = async () => { if (!taskForm.title.trim() || !course) return; await db.addCourseTask(course.id, taskForm.title, taskForm.instructions); setTaskForm({ title: "", instructions: "" }); setShowTask(false); refresh(); };

  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionTitle sub="Self-paced courses with a theory document and auto-corrected tasks.">Pre-recorded courses</SectionTitle>
        <Btn onClick={() => setShowAdd(true)}><Plus size={14} />New course</Btn>
      </div>
      {data.prerecordedCourses.length === 0 ? <EmptyState text="No pre-recorded courses yet." /> : (
        <>
          <div className="mb-5"><Select value={selected} onChange={(e) => setSelected(e.target.value)}>{data.prerecordedCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></div>
          {course && (
            <>
              <Card className="p-5 mb-5">
                <h3 className="font-medium mb-2" style={{ fontFamily: "Georgia, serif" }}>Theory document</h3>
                <RichEditor value={theoryDraft} onChange={setTheoryDraft} onBlur={saveTheory} placeholder="Write the course theory here..." />
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium" style={{ fontFamily: "Georgia, serif" }}>Tasks</h3>
                  <Btn variant="ghost" onClick={() => setShowTask(true)}><Plus size={14} />Add task</Btn>
                </div>
                {course.tasks.length === 0 ? <EmptyState text="No tasks yet." /> : (
                  <div className="space-y-2">
                    {course.tasks.map((t) => (
                      <div key={t.id} className="rounded-lg p-3" style={{ backgroundColor: CARD_BEIGE }}><div className="text-sm font-medium">{t.title}</div><div className="text-xs" style={{ color: MUTED }}>{t.instructions}</div></div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
      {showAdd && (
        <Modal title="New pre-recorded course" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Course title" />
            <Textarea value={form.theoryDoc} onChange={(e) => setForm({ ...form, theoryDoc: e.target.value })} placeholder="Theory content" />
            <Btn onClick={addCourse} className="w-full justify-center">Create course</Btn>
          </div>
        </Modal>
      )}
      {showTask && (
        <Modal title="Add task" onClose={() => setShowTask(false)}>
          <div className="space-y-3">
            <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" />
            <Textarea value={taskForm.instructions} onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })} placeholder="Instructions" />
            <Btn onClick={addTask} className="w-full justify-center">Add</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================================================================ */
/* STUDENT VIEW                                                      */
/* ================================================================ */
function StudentApp({ data, refresh, student, onLogout }) {
  const [active, setActive] = useState("timetable");
  const profile = data.studentProfiles[student.id];
  const needsProfile = !profile?.completedAt;
  const [showPrompt, setShowPrompt] = useState(needsProfile);
  const tabs = [
    { key: "timetable", label: "My timetable", icon: Calendar },
    { key: "docs", label: "My document", icon: FileText },
    { key: "resources", label: "Resources", icon: Headphones },
    { key: "flashcards", label: "Flashcards", icon: Layers },
    { key: "progress", label: "My progress", icon: CheckCircle2 },
    ...(student?.intensiveGroupId ? [{ key: "intensive", label: "Intensive classroom", icon: GraduationCap }] : []),
    { key: "courses", label: "My courses", icon: Video },
    { key: "profile", label: "My profile", icon: FileText, badge: needsProfile },
  ];
  if (!student) return null;
  return (
    <Shell roleLabel={`${student.name} · ${student.level}`} tabs={tabs} active={active} setActive={setActive} onLogout={onLogout}>
      {active === "timetable" && <StudentTimetable data={data} refresh={refresh} student={student} />}
      {active === "docs" && <StudentDocs data={data} refresh={refresh} student={student} />}
      {active === "resources" && <StudentResources data={data} />}
      {active === "flashcards" && <StudentFlashcards data={data} />}
      {active === "progress" && <StudentProgress data={data} student={student} />}
      {active === "intensive" && <StudentIntensive data={data} refresh={refresh} student={student} />}
      {active === "courses" && <StudentCourses data={data} refresh={refresh} student={student} />}
      {active === "profile" && <StudentProfileForm data={data} refresh={refresh} student={student} />}
      {showPrompt && (
        <Modal title="Tell us about yourself" onClose={() => setShowPrompt(false)}>
          <p className="text-sm mb-4" style={{ color: MUTED }}>
            A quick survey helps your teacher personalize your lessons, topics, and how she corrects you. It only takes a couple of minutes — and you can always fill it in later.
          </p>
          <div className="flex gap-2">
            <Btn onClick={() => { setActive("profile"); setShowPrompt(false); }}>Fill it in now</Btn>
            <Btn variant="ghost" onClick={() => setShowPrompt(false)}>Maybe later</Btn>
          </div>
        </Modal>
      )}
    </Shell>
  );
}

function emptyProfileFields(student, profile) {
  return {
    email: student.email || "",
    whatsapp: student.whatsapp || "",
    nativeLanguage: profile?.nativeLanguage || "",
    selfLevel: profile?.selfLevel || "",
    whyLearning: profile?.whyLearning || [],
    mainGoal: profile?.mainGoal || "",
    topPriorities: profile?.topPriorities || [],
    whereUsed: profile?.whereUsed || [],
    biggestChallenge: profile?.biggestChallenge || "",
    preferredActivities: profile?.preferredActivities || [],
    correctionPreference: profile?.correctionPreference || "",
  };
}

function StudentProfileForm({ data, refresh, student, onDone }) {
  const profile = data.studentProfiles[student.id];
  const [form, setForm] = useState(() => emptyProfileFields(student, profile));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    await db.saveStudentProfile(student.id, form);
    setSaving(false);
    refresh();
    if (onDone) onDone();
  };

  return (
    <div>
      <SectionTitle sub="This helps your teacher personalize your lessons, topics, and how she corrects you.">
        {profile?.completedAt ? "My profile" : "Tell us about yourself"}
      </SectionTitle>
      <div className="space-y-5 max-w-2xl">
        <Card className="p-5 space-y-3">
          <div><label className="text-xs" style={{ color: MUTED }}>Email</label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label className="text-xs" style={{ color: MUTED }}>WhatsApp number</label><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
          <div><label className="text-xs" style={{ color: MUTED }}>Native language</label><Input value={form.nativeLanguage} onChange={(e) => set("nativeLanguage", e.target.value)} /></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>How would you rate your current Spanish level?</label>
          <div className="mt-2"><Select value={form.selfLevel} onChange={(e) => set("selfLevel", e.target.value)}><option value="">Select...</option>{SELF_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>Why are you learning Spanish? (choose all that apply)</label>
          <div className="mt-2"><CheckboxGroup options={WHY_LEARNING} values={form.whyLearning} onChange={(v) => set("whyLearning", v)} /></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>What is your #1 goal with Spanish?</label>
          <div className="mt-2"><Textarea value={form.mainGoal} onChange={(e) => set("mainGoal", e.target.value)} /></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>Top priorities — choose up to 3</label>
          <div className="mt-2"><CheckboxGroup options={PRIORITIES} values={form.topPriorities} onChange={(v) => set("topPriorities", v)} max={3} /></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>Where will you use Spanish?</label>
          <div className="mt-2"><CheckboxGroup options={WHERE_USED} values={form.whereUsed} onChange={(v) => set("whereUsed", v)} /></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>What's currently the biggest thing holding you back?</label>
          <div className="mt-2"><Select value={form.biggestChallenge} onChange={(e) => set("biggestChallenge", e.target.value)}><option value="">Select...</option>{CHALLENGES.map((c) => <option key={c}>{c}</option>)}</Select></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>Which activities do you enjoy?</label>
          <div className="mt-2"><CheckboxGroup options={ACTIVITIES} values={form.preferredActivities} onChange={(v) => set("preferredActivities", v)} /></div>
        </Card>

        <Card className="p-5">
          <label className="text-xs" style={{ color: MUTED }}>How would you like your mistakes corrected?</label>
          <div className="mt-2"><Select value={form.correctionPreference} onChange={(e) => set("correctionPreference", e.target.value)}><option value="">Select...</option>{CORRECTION_PREFS.map((c) => <option key={c}>{c}</option>)}</Select></div>
        </Card>

        <Btn onClick={save} disabled={saving} className="justify-center">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save my profile
        </Btn>
      </div>
    </div>
  );
}

function StudentTimetable({ data, refresh, student }) {
  const now = new Date();
  const nowKey = now.toISOString().slice(0, 10) + now.toTimeString().slice(0, 5);
  const mine = data.timetableSlots.filter((s) => s.audience === `student:${student.id}` || (student.groupId && s.audience === `group:${student.groupId}`)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = mine.filter((s) => s.date + s.time < nowKey);
  const future = mine.filter((s) => s.date + s.time >= nowKey);
  const openSlots = data.timetableSlots.filter((s) => s.audience === "open" && s.status === "available").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const book = async (id) => { await db.bookSlot(id, student.id); refresh(); };
  return (
    <div>
      <SectionTitle sub="Your confirmed lessons, plus any open slots you can reserve yourself.">My timetable</SectionTitle>
      <Card className="p-5 mb-5">
        <h3 className="font-medium mb-3" style={{ fontFamily: "Georgia, serif" }}>Available to book</h3>
        {openSlots.length === 0 ? <p className="text-xs" style={{ color: MUTED }}>No open slots right now.</p> : (
          <div className="grid gap-2">
            {openSlots.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: "#eef6ee" }}>
                <div className="text-sm">{s.date} · {s.time} <span style={{ color: MUTED }}>({s.duration} min) — {s.label}</span></div>
                <Btn onClick={() => book(s.id)}>Book</Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-5"><h3 className="font-medium mb-3" style={{ fontFamily: "Georgia, serif" }}>Upcoming lessons</h3>{future.length === 0 ? <p className="text-xs" style={{ color: MUTED }}>Nothing scheduled yet.</p> : <div className="space-y-2">{future.map((s) => <div key={s.id} className="text-sm rounded-lg p-3" style={{ backgroundColor: CARD_BEIGE }}>{s.date} · {s.time} — {s.label}</div>)}</div>}</Card>
        <Card className="p-5"><h3 className="font-medium mb-3" style={{ fontFamily: "Georgia, serif" }}>Past lessons</h3>{past.length === 0 ? <p className="text-xs" style={{ color: MUTED }}>No past lessons yet.</p> : <div className="space-y-2">{past.map((s) => <div key={s.id} className="text-sm rounded-lg p-3 opacity-70" style={{ backgroundColor: CARD_BEIGE }}>{s.date} · {s.time} — {s.label}</div>)}</div>}</Card>
      </div>
    </div>
  );
}

function StudentDocs({ data, refresh, student }) {
  const doc = data.personalDocs[student.id] || { notes: [], homework: [] };
  const [drafts, setDrafts] = useState({});
  const [blankAnswers, setBlankAnswers] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [errId, setErrId] = useState(null);
  const setBlank = (hwId, idx, val) => setBlankAnswers((prev) => {
    const arr = [...(prev[hwId] || [])];
    arr[idx] = val;
    return { ...prev, [hwId]: arr };
  });
  const submit = async (hwId) => {
    const hw = doc.homework.find((h) => h.id === hwId);
    const blanks = countBlanks(hw.instructions);
    const text = blanks > 0 ? fillBlanksIntoText(hw.instructions, blankAnswers[hwId] || []) : drafts[hwId];
    const hasContent = blanks > 0 ? (blankAnswers[hwId] || []).some((v) => (v || "").trim()) : (text || "").trim();
    if (!hasContent) return;
    setLoadingId(hwId); setErrId(null);
    try {
      const feedback = await getAIFeedback({ instructions: hw.instructions, submissionText: text, level: student.level });
      await db.submitHomework(hwId, text, feedback);
      refresh();
    } catch (e) { setErrId(hwId); }
    setLoadingId(null);
  };
  return (
    <div>
      <SectionTitle sub="Notes from your teacher after class, and homework with instant AI feedback.">My document</SectionTitle>
      <Card className="p-5 mb-5">
        <h3 className="font-medium mb-3" style={{ fontFamily: "Georgia, serif" }}>Class notes</h3>
        {doc.notes.length === 0 ? <p className="text-xs" style={{ color: MUTED }}>Your teacher hasn't added notes yet.</p> : <div className="space-y-2">{doc.notes.map((n) => <div key={n.id} className="text-sm rounded-lg p-3" style={{ backgroundColor: CARD_BEIGE }}><div className="text-xs mb-1" style={{ color: MUTED }}>{n.date}</div><RichDoc text={n.text} /></div>)}</div>}
      </Card>
      <Card className="p-5">
        <h3 className="font-medium mb-3" style={{ fontFamily: "Georgia, serif" }}>Homework</h3>
        {doc.homework.length === 0 ? <p className="text-xs" style={{ color: MUTED }}>No homework assigned.</p> : (
          <div className="space-y-4">
            {doc.homework.map((h) => {
              const blanks = countBlanks(h.instructions);
              return (
              <div key={h.id} className="rounded-lg p-4" style={{ backgroundColor: CARD_BEIGE }}>
                <div className="font-medium text-sm mb-2">{h.title}</div>
                {blanks === 0 && <p className="text-xs mt-1" style={{ color: MUTED }}>{h.instructions}</p>}
                {h.status === "checked" ? (
                  <><p className="text-xs mt-2 italic whitespace-pre-wrap">"{h.submissionText}"</p><Feedback text={h.aiFeedback} /></>
                ) : (
                  <>
                    {blanks > 0 ? (
                      <div className="mt-2 rounded-lg p-3 bg-white">
                        <BlankWorksheet text={h.instructions} values={blankAnswers[h.id] || []} onChange={(idx, val) => setBlank(h.id, idx, val)} />
                      </div>
                    ) : (
                      <Textarea className="mt-2" value={drafts[h.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [h.id]: e.target.value })} placeholder="Write your answer in Spanish..." />
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Btn onClick={() => submit(h.id)} disabled={loadingId === h.id}>{loadingId === h.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit for AI feedback</Btn>
                      {errId === h.id && <span className="text-xs flex items-center gap-1" style={{ color: "#b3432b" }}><AlertCircle size={13} />Couldn't get feedback, try again.</span>}
                    </div>
                  </>
                )}
              </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StudentResources({ data }) {
  const icons = { video: Video, podcast: Headphones, info: Info };
  return (
    <div>
      <SectionTitle>Resources</SectionTitle>
      {data.resources.length === 0 ? <EmptyState text="No resources yet." /> : (
        <div className="grid gap-2">
          {data.resources.map((r) => {
            const Icon = icons[r.type] || Info;
            return (
              <Card key={r.id} className="p-4 flex items-center gap-3">
                <Icon size={18} color={GREEN} />
                <div><div className="text-sm font-medium">{r.title}</div><div className="text-xs" style={{ color: MUTED }}>{r.description}</div>{r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: GREEN }}>Open</a>}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentFlashcards({ data }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const cards = data.flashcards;
  if (cards.length === 0) return (<div><SectionTitle>Flashcards</SectionTitle><EmptyState text="No flashcards yet." /></div>);
  const card = cards[i % cards.length];
  return (
    <div>
      <SectionTitle sub="Tap the card to flip.">Flashcards</SectionTitle>
      <Card className="p-10 text-center cursor-pointer max-w-md" onClick={() => setFlip(!flip)}>
        <div className="text-2xl mb-2" style={{ fontFamily: "Georgia, serif" }}>{flip ? card.translation : card.word}</div>
        {flip && card.example && <div className="text-sm italic" style={{ color: MUTED }}>{card.example}</div>}
      </Card>
      <div className="flex gap-2 mt-4">
        <Btn variant="ghost" onClick={() => { setFlip(false); setI((i - 1 + cards.length) % cards.length); }}><ChevronLeft size={14} />Prev</Btn>
        <Btn variant="ghost" onClick={() => { setFlip(false); setI((i + 1) % cards.length); }}>Next<ChevronRight size={14} /></Btn>
      </div>
      <p className="text-xs mt-3" style={{ color: MUTED }}>{(i % cards.length) + 1} / {cards.length}</p>
    </div>
  );
}

function StudentProgress({ data, student }) {
  const progress = data.progress[student.id] || {};
  return (
    <div>
      <SectionTitle sub="What you've completed at each level.">My progress</SectionTitle>
      <div className="grid gap-4">
        {LEVELS.map((lvl) => {
          const items = data.curriculum[lvl] || [];
          const done = items.filter((it) => progress[it.id]).length;
          return (
            <Card key={lvl} className="p-5">
              <div className="flex items-center justify-between mb-3"><h3 className="font-medium" style={{ fontFamily: "Georgia, serif" }}>{lvl}</h3><span className="text-xs" style={{ color: MUTED }}>{done}/{items.length}</span></div>
              <div className="space-y-1.5">{items.map((it) => (<div key={it.id} className="flex items-center gap-2 text-sm">{progress[it.id] ? <CheckCircle2 size={16} color={GREEN} /> : <Circle size={16} color={MUTED} />}<span style={{ color: progress[it.id] ? INK : MUTED }}>{it.name}</span></div>))}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StudentIntensive({ data, refresh, student }) {
  const cohort = data.intensiveCourses.find((c) => c.id === student.intensiveGroupId);
  const tasks = cohort?.students[student.id]?.tasks || [];
  const [drafts, setDrafts] = useState({});
  const [blankAnswers, setBlankAnswers] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const setBlank = (taskId, idx, val) => setBlankAnswers((prev) => {
    const arr = [...(prev[taskId] || [])];
    arr[idx] = val;
    return { ...prev, [taskId]: arr };
  });
  const submit = async (taskId) => {
    const t = tasks.find((x) => x.id === taskId);
    const blanks = countBlanks(t.instructions);
    const text = blanks > 0 ? fillBlanksIntoText(t.instructions, blankAnswers[taskId] || []) : drafts[taskId];
    const hasContent = blanks > 0 ? (blankAnswers[taskId] || []).some((v) => (v || "").trim()) : (text || "").trim();
    if (!hasContent) return;
    setLoadingId(taskId);
    try { const feedback = await getAIFeedback({ instructions: t.instructions, submissionText: text, level: student.level }); await db.submitIntensiveTask(taskId, text, feedback); refresh(); } catch (e) {}
    setLoadingId(null);
  };
  const markDone = async (taskId) => { await db.markIntensiveDone(taskId); refresh(); };
  return (
    <div>
      <SectionTitle sub={cohort ? `You're enrolled in ${cohort.name}.` : "Everything from the intensive course, plus your own tasks."}>Intensive classroom</SectionTitle>
      <Card className="p-5 mb-5"><h3 className="font-medium mb-2" style={{ fontFamily: "Georgia, serif" }}>General class document</h3>{cohort?.generalDoc ? <RichDoc text={cohort.generalDoc} /> : <p className="text-sm" style={{ color: MUTED }}>Nothing posted yet.</p>}</Card>
      <Card className="p-5">
        <h3 className="font-medium mb-3" style={{ fontFamily: "Georgia, serif" }}>My tasks</h3>
        {tasks.length === 0 ? <EmptyState text="No tasks assigned yet." /> : (
          <div className="space-y-4">
            {tasks.map((t) => {
              const blanks = countBlanks(t.instructions);
              return (
              <div key={t.id} className="rounded-lg p-4" style={{ backgroundColor: CARD_BEIGE }}>
                <div className="flex justify-between"><span className="font-medium text-sm">{t.title}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: t.status !== "pending" ? "#dcefdc" : "white" }}>{t.status}</span></div>
                {blanks === 0 && <p className="text-xs mt-1" style={{ color: MUTED }}>{t.instructions}</p>}
                {t.status === "checked" ? (<><p className="text-xs mt-2 italic whitespace-pre-wrap">"{t.submissionText}"</p><Feedback text={t.aiFeedback} /></>) : (
                  <>
                    {blanks > 0 ? (
                      <div className="mt-2 rounded-lg p-3 bg-white">
                        <BlankWorksheet text={t.instructions} values={blankAnswers[t.id] || []} onChange={(idx, val) => setBlank(t.id, idx, val)} />
                      </div>
                    ) : (
                      <Textarea className="mt-2" value={drafts[t.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [t.id]: e.target.value })} placeholder="Write your answer, or leave blank and just mark as done" />
                    )}
                    <div className="mt-2 flex gap-2">
                      <Btn onClick={() => submit(t.id)} disabled={loadingId === t.id}>{loadingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Submit for AI feedback</Btn>
                      <Btn variant="ghost" onClick={() => markDone(t.id)}><CheckCircle2 size={14} />Mark done</Btn>
                    </div>
                  </>
                )}
              </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StudentCourses({ data, refresh, student }) {
  const [selected, setSelected] = useState(data.prerecordedCourses[0]?.id || "");
  const [drafts, setDrafts] = useState({});
  const [blankAnswers, setBlankAnswers] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const course = data.prerecordedCourses.find((c) => c.id === selected);
  const mySubs = course?.studentSubmissions?.[student.id] || {};
  const setBlank = (taskId, idx, val) => setBlankAnswers((prev) => {
    const arr = [...(prev[taskId] || [])];
    arr[idx] = val;
    return { ...prev, [taskId]: arr };
  });
  const submit = async (taskId) => {
    if (!course) return;
    const task = course.tasks.find((t) => t.id === taskId);
    const blanks = countBlanks(task.instructions);
    const text = blanks > 0 ? fillBlanksIntoText(task.instructions, blankAnswers[taskId] || []) : drafts[taskId];
    const hasContent = blanks > 0 ? (blankAnswers[taskId] || []).some((v) => (v || "").trim()) : (text || "").trim();
    if (!hasContent) return;
    setLoadingId(taskId);
    try { const feedback = await getAIFeedback({ instructions: task.instructions, submissionText: text, level: student.level }); await db.submitCourseTask(taskId, student.id, text, feedback); refresh(); } catch (e) {}
    setLoadingId(null);
  };
  return (
    <div>
      <SectionTitle sub="Self-paced courses: read the theory, then complete the tasks for automatic feedback.">My courses</SectionTitle>
      {data.prerecordedCourses.length === 0 ? <EmptyState text="No courses available yet." /> : (
        <>
          <div className="mb-5"><Select value={selected} onChange={(e) => setSelected(e.target.value)}>{data.prerecordedCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></div>
          {course && (
            <>
              <Card className="p-5 mb-5"><h3 className="font-medium mb-2" style={{ fontFamily: "Georgia, serif" }}>Theory</h3>{course.theoryDoc ? <RichDoc text={course.theoryDoc} /> : <p className="text-sm" style={{ color: MUTED }}>Coming soon.</p>}</Card>
              <Card className="p-5">
                <h3 className="font-medium mb-3" style={{ fontFamily: "Georgia, serif" }}>Tasks</h3>
                {course.tasks.length === 0 ? <EmptyState text="No tasks yet." /> : (
                  <div className="space-y-4">
                    {course.tasks.map((t) => {
                      const sub = mySubs[t.id];
                      const blanks = countBlanks(t.instructions);
                      return (
                        <div key={t.id} className="rounded-lg p-4" style={{ backgroundColor: CARD_BEIGE }}>
                          <div className="font-medium text-sm mb-2">{t.title}</div>
                          {blanks === 0 && <p className="text-xs mt-1" style={{ color: MUTED }}>{t.instructions}</p>}
                          {sub ? (<><p className="text-xs mt-2 italic whitespace-pre-wrap">"{sub.submissionText}"</p><Feedback text={sub.aiFeedback} /></>) : (
                            <>
                              {blanks > 0 ? (
                                <div className="mt-2 rounded-lg p-3 bg-white">
                                  <BlankWorksheet text={t.instructions} values={blankAnswers[t.id] || []} onChange={(idx, val) => setBlank(t.id, idx, val)} />
                                </div>
                              ) : (
                                <Textarea className="mt-2" value={drafts[t.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [t.id]: e.target.value })} placeholder="Your answer..." />
                              )}
                              <div className="mt-2"><Btn onClick={() => submit(t.id)} disabled={loadingId === t.id}>{loadingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Submit for AI feedback</Btn></div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================ */
/* ROOT APP                                                           */
/* ================================================================ */
export default function App() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);

  const refresh = useCallback(async () => {
    const d = await db.fetchAll();
    setData(d);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const authSession = sessionData?.session;
      if (authSession) {
        const uid = authSession.user.id;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        if (profile?.role === "teacher") {
          setSession({ role: "teacher", userId: uid });
        } else if (profile?.role === "student") {
          const { data: student } = await supabase.from("students").select("*").eq("profile_id", uid).maybeSingle();
          if (student) setSession({ role: "student", studentId: student.id, userId: uid });
        }
      }
      setChecking(false);
    })();
  }, []);

  useEffect(() => { if (session) refresh(); }, [session, refresh]);

  const handleLogout = async () => { await db.signOut(); setSession(null); setData(null); };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: CREAM }}><Loader2 className="animate-spin" color={GREEN} /></div>;
  }
  if (!session) return <LoginScreen onLogin={setSession} />;
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: CREAM }}><Loader2 className="animate-spin" color={GREEN} /></div>;
  }
  if (session.role === "teacher") return <TeacherApp data={data} refresh={refresh} onLogout={handleLogout} />;
  const student = data.students.find((s) => s.id === session.studentId);
  if (!student) return null;
  return <StudentApp data={data} refresh={refresh} student={student} onLogout={handleLogout} />;
}
