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
    { data: generalDoc },
    { data: intensiveTasks },
    { data: courses },
    { data: courseTasks },
    { data: courseSubs },
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
    supabase.from("intensive_general_doc").select("*").eq("id", 1).maybeSingle(),
    supabase.from("intensive_tasks").select("*"),
    supabase.from("courses").select("*"),
    supabase.from("course_tasks").select("*"),
    supabase.from("course_submissions").select("*"),
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

  const intensiveCourse = { generalDoc: generalDoc?.content || "", students: {} };
  (intensiveTasks || []).forEach((t) => {
    const bucket = (intensiveCourse.students[t.student_id] ??= { tasks: [] });
    bucket.tasks.push({
      id: t.id,
      title: t.title,
      instructions: t.instructions || "",
      status: t.status,
      submissionText: t.submission_text || "",
      aiFeedback: t.ai_feedback || "",
    });
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

  return {
    students: (students || []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      level: s.level,
      groupId: s.group_id,
      enrolledIntensive: s.enrolled_intensive,
      profileId: s.profile_id,
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
    flashcards: flashcards || [],
    curriculum,
    progress,
    personalDocs,
    intensiveCourse,
    prerecordedCourses,
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
export async function setEnrolledIntensive(id, value) {
  await supabase.from("students").update({ enrolled_intensive: value }).eq("id", id);
}
export async function addGroup({ name, level }) {
  await supabase.from("groups").insert({ name, level });
}

export async function addSlot({ date, time, duration, label, audienceType, groupId, studentId }) {
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
  await supabase.from("timetable_slots").insert(row);
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
export async function addFlashcard(f) {
  await supabase.from("flashcards").insert(f);
}
export async function removeFlashcard(id) {
  await supabase.from("flashcards").delete().eq("id", id);
}

export async function addCurriculumItem(level, name) {
  await supabase.from("curriculum_items").insert({ level, name });
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
export async function assignHomework(studentId, title, instructions) {
  await supabase.from("homework").insert({ student_id: studentId, title, instructions });
}
export async function submitHomework(id, submissionText, aiFeedback) {
  await supabase
    .from("homework")
    .update({ submission_text: submissionText, ai_feedback: aiFeedback, status: "checked" })
    .eq("id", id);
}

export async function saveGeneralDoc(content) {
  await supabase.from("intensive_general_doc").update({ content }).eq("id", 1);
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

/* ---------------------------------------------------------------- */
/* Auth helpers                                                       */
/* ---------------------------------------------------------------- */
export async function teacherSignUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: "teacher", name } },
  });
  if (error) throw error;
  return data.user;
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

  const { data: match } = await supabase
    .from("students")
    .select("*")
    .ilike("code", code.trim())
    .is("profile_id", null)
    .maybeSingle();

  if (!match || match.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
    throw new Error("No student found with that name and code.");
  }

  const { error: linkError } = await supabase
    .from("students")
    .update({ profile_id: userId })
    .eq("id", match.id);
  if (linkError) throw linkError;

  await supabase.from("profiles").update({ name: match.name }).eq("id", userId);

  return { studentId: match.id, userId };
}

export async function signOut() {
  await supabase.auth.signOut();
}
