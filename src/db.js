import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------- */
/* Fetch everything the logged-in person is allowed to see           */
/* (Row Level Security in the database does the actual filtering —   */
/* the same query works for a teacher or a student.)                 */
/* ---------------------------------------------------------------- */
export async function fetchAll() {
  const [
    { data: students },
    { data: groups },
    { data: slots },
    { data: resources },
    { data: flashcards },
    { data: curriculumItems },
    { data: progressRows },
    { data: notes },
    { data: homework },
    { data: intensiveDocs },
    { data: intensiveTasks },
    { data: courses },
    { data: courseTasks },
    { data: courseSubs },
    { data: studentProfileRows },
    { data: flashcardAssignments },
    { data: grammarGuides },
    { data: teacherInvites },
  ] = await Promise.all([
    supabase.from("students").select("*"),
    supabase.from("groups").select("*"),
    supabase.from("timetable_slots").select("*"),
    supabase.from("resources").select("*"),
    supabase.from("flashcards").select("*"),
    supabase.from("curriculum_items").select("*").order("level").order("position"),
    supabase.from("progress").select("*"),
    supabase.from("notes").select("*").order("date", { ascending: false }),
    supabase.from("homework").select("*").order("date", { ascending: false }),
    supabase.from("intensive_docs").select("*"),
    supabase.from("intensive_tasks").select("*"),
    supabase.from("courses").select("*"),
    supabase.from("course_tasks").select("*"),
    supabase.from("course_submissions").select("*"),
    supabase.from("student_profiles").select("*"),
    supabase.from("flashcard_assignments").select("*"),
    supabase.from("grammar_guides").select("*").order("position"),
    supabase.from("teacher_invites").select("*").order("created_at", { ascending: false }),
  ]);

  const curriculum = { A1: [], A2: [], B1: [], B2: [] };
  (curriculumItems || []).forEach((c) => {
    if (!curriculum[c.level]) curriculum[c.level] = [];
    curriculum[c.level].push({ id: c.id, name: c.name });
  });

  const progress = {};
  (progressRows || []).forEach((p) => {
    if (!progress[p.student_id]) progress[p.student_id] = {};
    progress[p.student_id][p.item_id] = true;
  });

  const personalDocs = {};
  const ensureDoc = (id) => (personalDocs[id] ??= { notes: [], homework: [] });
  (notes || []).forEach((n) => ensureDoc(n.student_id).notes.push({ id: n.id, date: n.date, text: n.text }));
  (homework || []).forEach((h) =>
    ensureDoc(h.student_id).homework.push({
      id: h.id,
      date: h.date,
      title: h.title,
      instructions: h.instructions || "",
      submissionText: h.submission_text || "",
      aiFeedback: h.ai_feedback || "",
      status: h.status,
    })
  );

  const tasksByStudent = {};
  (intensiveTasks || []).forEach((t) => {
    const bucket = (tasksByStudent[t.student_id] ??= []);
    bucket.push({
      id: t.id,
      title: t.title,
      instructions: t.instructions || "",
      status: t.status,
      submissionText: t.submission_text || "",
      aiFeedback: t.ai_feedback || "",
    });
  });

  // Each intensive cohort is a Group the teacher created (e.g. "Intensive course 1").
  // A student joins one via students.intensive_group_id.
  const intensiveCourses = (groups || []).map((g) => {
    const doc = (intensiveDocs || []).find((d) => d.group_id === g.id);
    const cohortStudents = (students || []).filter((s) => s.intensive_group_id === g.id);
    const studentsMap = {};
    cohortStudents.forEach((s) => {
      studentsMap[s.id] = { tasks: tasksByStudent[s.id] || [] };
    });
    return { id: g.id, name: g.name, level: g.level, generalDoc: doc?.content || "", students: studentsMap };
  });

  const prerecordedCourses = (courses || []).map((c) => {
    const tasks = (courseTasks || [])
      .filter((t) => t.course_id === c.id)
      .map((t) => ({ id: t.id, title: t.title, instructions: t.instructions || "" }));
    const studentSubmissions = {};
    (courseSubs || []).forEach((s) => {
      if (!tasks.find((t) => t.id === s.task_id)) return;
      (studentSubmissions[s.student_id] ??= {})[s.task_id] = {
        submissionText: s.submission_text,
        aiFeedback: s.ai_feedback,
        status: s.status,
      };
    });
    return { id: c.id, title: c.title, theoryDoc: c.theory_doc || "", tasks, studentSubmissions };
  });

  const studentProfiles = {};
  (studentProfileRows || []).forEach((p) => {
    studentProfiles[p.student_id] = {
      nativeLanguage: p.native_language || "",
      selfLevel: p.self_level || "",
      whyLearning: p.why_learning || [],
      mainGoal: p.main_goal || "",
      topPriorities: p.top_priorities || [],
      whereUsed: p.where_used || [],
      biggestChallenge: p.biggest_challenge || "",
      preferredActivities: p.preferred_activities || [],
      correctionPreference: p.correction_preference || "",
      completedAt: p.completed_at,
    };
  });

  return {
    students: (students || []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      level: s.level,
      groupId: s.group_id,
      intensiveGroupId: s.intensive_group_id,
      profileId: s.profile_id,
      email: s.email || "",
      whatsapp: s.whatsapp || "",
      lastLoginAt: s.last_login_at,
    })),
    groups: groups || [],
    timetableSlots: (slots || []).map((s) => ({
      id: s.id,
      date: s.date,
      time: s.time,
      duration: s.duration,
      label: s.label,
      audience:
        s.audience_type === "group"
          ? `group:${s.group_id}`
          : s.audience_type === "student"
          ? `student:${s.student_id}`
          : "open",
      status: s.status,
      bookedBy: s.booked_by,
    })),
    resources: resources || [],
    flashcards: (flashcards || []).map((f) => ({
      id: f.id,
      word: f.word,
      translation: f.translation,
      example: f.example,
      category: f.category || "word",
      groupId: f.group_id,
      studentId: f.student_id,
      targets: (flashcardAssignments || [])
        .filter((a) => a.flashcard_id === f.id)
        .map((a) => (a.group_id ? { type: "group", id: a.group_id } : { type: "student", id: a.student_id })),
    })),
    curriculum,
    progress,
    personalDocs,
    intensiveCourses,
    prerecordedCourses,
    studentProfiles,
    grammarGuides: (grammarGuides || []).map((g) => ({ id: g.id, title: g.title, content: g.content || "" })),
    teacherInvites: (teacherInvites || []).map((t) => ({ code: t.code, used: t.used, createdAt: t.created_at })),
  };
}

/* ---------------------------------------------------------------- */
/* Actions — every write in the app goes through one of these        */
/* ---------------------------------------------------------------- */
export async function addStudent({ name, level, groupId }) {
  const code = (name.trim().slice(0, 3) + Math.floor(100 + Math.random() * 900)).toUpperCase();
  const { error } = await supabase.from("students").insert({ name, level, group_id: groupId || null, code });
  if (error) throw error;
}
export async function removeStudent(id) {
  await supabase.from("students").delete().eq("id", id);
}
export async function setIntensiveGroup(studentId, groupId) {
  await supabase.from("students").update({ intensive_group_id: groupId || null }).eq("id", studentId);
}
export async function setStudentGroup(studentId, groupId) {
  await supabase.from("students").update({ group_id: groupId || null }).eq("id", studentId);
}
export async function addGroup({ name, level }) {
  await supabase.from("groups").insert({ name, level });
}
export async function removeGroup(id) {
  await supabase.from("groups").delete().eq("id", id);
}

function buildSlotRow({ date, time, duration, label, audienceType, groupId, studentId }) {
  const row = {
    date,
    time,
    duration,
    label,
    audience_type: audienceType === "individual-fixed" ? "student" : audienceType,
    status: "available",
  };
  if (audienceType === "group") {
    row.group_id = groupId;
    row.status = "booked";
  }
  if (audienceType === "individual-fixed") {
    row.student_id = studentId;
    row.booked_by = studentId;
    row.status = "booked";
  }
  return row;
}
export async function addSlot(fields) {
  await supabase.from("timetable_slots").insert(buildSlotRow(fields));
}
export async function addRepeatingSlots(fields, weeks) {
  const rows = [];
  const [y, m, d] = fields.date.split("-").map(Number);
  for (let i = 0; i < weeks; i++) {
    const dt = new Date(y, m - 1, d + i * 7);
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    rows.push(buildSlotRow({ ...fields, date: dateStr }));
  }
  await supabase.from("timetable_slots").insert(rows);
}
export async function removeSlot(id) {
  await supabase.from("timetable_slots").delete().eq("id", id);
}
export async function bookSlot(id, studentId) {
  await supabase
    .from("timetable_slots")
    .update({ student_id: studentId, booked_by: studentId, status: "booked" })
    .eq("id", id);
}

export async function addResource(r) {
  await supabase.from("resources").insert(r);
}
export async function removeResource(id) {
  await supabase.from("resources").delete().eq("id", id);
}
export async function addFlashcard({ word, translation, example, category, targets }) {
  const { data, error } = await supabase
    .from("flashcards")
    .insert({ word, translation, example, category: category || "word" })
    .select()
    .single();
  if (error) throw error;
  if (targets && targets.length) {
    const rows = targets.map((t) => {
      const [type, id] = t.split(":");
      return { flashcard_id: data.id, group_id: type === "group" ? id : null, student_id: type === "student" ? id : null };
    });
    await supabase.from("flashcard_assignments").insert(rows);
  }
}
export async function updateFlashcardTargets(flashcardId, targets) {
  // clear legacy single-target columns (from before multi-assign existed) and old assignment rows
  await supabase.from("flashcards").update({ group_id: null, student_id: null }).eq("id", flashcardId);
  await supabase.from("flashcard_assignments").delete().eq("flashcard_id", flashcardId);
  if (targets && targets.length) {
    const rows = targets.map((t) => {
      const [type, id] = t.split(":");
      return { flashcard_id: flashcardId, group_id: type === "group" ? id : null, student_id: type === "student" ? id : null };
    });
    await supabase.from("flashcard_assignments").insert(rows);
  }
}
export async function generateFlashcardAI(word, level, category, tense) {
  const res = await fetch("/api/flashcard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, level, category, tense }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate");
  return data;
}

export async function addGrammarGuide(title) {
  const { data, error } = await supabase.from("grammar_guides").insert({ title, content: "" }).select().single();
  if (error) throw error;
  return data;
}
export async function saveGrammarGuide(id, content) {
  await supabase.from("grammar_guides").update({ content }).eq("id", id);
}
export async function renameGrammarGuide(id, title) {
  await supabase.from("grammar_guides").update({ title }).eq("id", id);
}
export async function removeGrammarGuide(id) {
  await supabase.from("grammar_guides").delete().eq("id", id);
}
export async function removeFlashcard(id) {
  await supabase.from("flashcards").delete().eq("id", id);
}

export async function addCurriculumItem(level, name) {
  await supabase.from("curriculum_items").insert({ level, name });
}
export async function removeCurriculumItem(id) {
  await supabase.from("curriculum_items").delete().eq("id", id);
}
export async function addCurriculumItemsBulk(level, names) {
  const rows = names.map((name, i) => ({ level, name, position: i }));
  await supabase.from("curriculum_items").insert(rows);
}
export async function generateCurriculumAI(level) {
  const res = await fetch("/api/curriculum", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate");
  return data.items || [];
}
export async function toggleProgress(studentId, itemId, currentlyDone) {
  if (currentlyDone) {
    await supabase.from("progress").delete().eq("student_id", studentId).eq("item_id", itemId);
  } else {
    await supabase.from("progress").upsert(
      { student_id: studentId, item_id: itemId, done: true },
      { onConflict: "student_id,item_id" }
    );
  }
}

export async function addNote(studentId, text) {
  await supabase.from("notes").insert({ student_id: studentId, text });
}
export async function updateNote(id, text) {
  await supabase.from("notes").update({ text }).eq("id", id);
}
export async function assignHomework(studentId, title, instructions) {
  await supabase.from("homework").insert({ student_id: studentId, title, instructions });
}
export async function updateHomeworkInstructions(id, instructions) {
  await supabase.from("homework").update({ instructions }).eq("id", id);
}
export async function submitHomework(id, submissionText, aiFeedback) {
  await supabase
    .from("homework")
    .update({ submission_text: submissionText, ai_feedback: aiFeedback, status: "checked" })
    .eq("id", id);
}

export async function saveIntensiveDoc(groupId, content) {
  await supabase.from("intensive_docs").upsert({ group_id: groupId, content }, { onConflict: "group_id" });
}
export async function addIntensiveTask(studentId, title, instructions) {
  await supabase.from("intensive_tasks").insert({ student_id: studentId, title, instructions });
}
export async function submitIntensiveTask(id, submissionText, aiFeedback) {
  await supabase
    .from("intensive_tasks")
    .update({ submission_text: submissionText, ai_feedback: aiFeedback, status: "checked" })
    .eq("id", id);
}
export async function markIntensiveDone(id) {
  await supabase.from("intensive_tasks").update({ status: "done" }).eq("id", id);
}

export async function addCourse(title, theoryDoc) {
  const { data } = await supabase.from("courses").insert({ title, theory_doc: theoryDoc }).select().single();
  return data;
}
export async function saveCourseTheory(id, theoryDoc) {
  await supabase.from("courses").update({ theory_doc: theoryDoc }).eq("id", id);
}
export async function addCourseTask(courseId, title, instructions) {
  await supabase.from("course_tasks").insert({ course_id: courseId, title, instructions });
}
export async function submitCourseTask(taskId, studentId, submissionText, aiFeedback) {
  await supabase.from("course_submissions").upsert(
    { task_id: taskId, student_id: studentId, submission_text: submissionText, ai_feedback: aiFeedback, status: "checked" },
    { onConflict: "task_id,student_id" }
  );
}

export async function saveStudentProfile(studentId, fields) {
  const { email, whatsapp, ...profileFields } = fields;
  await supabase.from("students").update({ email: email || null, whatsapp: whatsapp || null }).eq("id", studentId);
  await supabase.from("student_profiles").upsert(
    {
      student_id: studentId,
      native_language: profileFields.nativeLanguage || null,
      self_level: profileFields.selfLevel || null,
      why_learning: profileFields.whyLearning || [],
      main_goal: profileFields.mainGoal || null,
      top_priorities: profileFields.topPriorities || [],
      where_used: profileFields.whereUsed || [],
      biggest_challenge: profileFields.biggestChallenge || null,
      preferred_activities: profileFields.preferredActivities || [],
      correction_preference: profileFields.correctionPreference || null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "student_id" }
  );
}

export async function uploadClassImage(file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("class-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("class-images").getPublicUrl(path);
  return data.publicUrl;
}

/* ---------------------------------------------------------------- */
/* Auth helpers                                                       */
/* ---------------------------------------------------------------- */
export async function teacherSignUp(email, password, name, inviteCode) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }, // no role here anymore — a fresh signup is always just a "student" role until an invite promotes it
  });
  if (error) throw error;

  const { data: redeemed, error: redeemError } = await supabase.rpc("redeem_teacher_invite", { p_code: (inviteCode || "").trim() });
  if (redeemError || !redeemed) {
    throw new Error("That invite code isn't valid or has already been used. Ask your school admin for a new one.");
  }
  return data.user;
}

export async function createTeacherInvite() {
  const code = Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const { error } = await supabase.from("teacher_invites").insert({ code });
  if (error) throw error;
  return code;
}
export async function teacherSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function studentLogin(name, code) {
  let { data: sessionData } = await supabase.auth.getSession();
  let userId = sessionData?.session?.user?.id;
  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    userId = data.user.id;
  }

  const { data: studentId, error } = await supabase.rpc("claim_student", { p_name: name, p_code: code });
  if (error) throw error;
  if (!studentId) throw new Error("No student found with that name and code.");

  return { studentId, userId };
}

export async function signOut() {
  await supabase.auth.signOut();
}
