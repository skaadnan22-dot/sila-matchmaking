const admin = require("firebase-admin");

const MATCH_CONFIG = {
  romance: {
    weights: {
      values: 0.25,
      communication: 0.25,
      vulnerability: 0.20,
      dealbreakers: 0.15,
      personality: 0.10,
      lifestyle: 0.05,
    },
    sectionCategory: {
      "The Dealbreakers": "dealbreakers",
      "Your Lifestyle": "lifestyle",
      "Personality & Temperament": "personality",
      "Love & Attachment": "communication",
      "Daily Life & Habits": "lifestyle",
      "Values & Beliefs": "values",
      "The Real You": "vulnerability",
    },
  },
  friends: {
    weights: {
      lifestyle: 0.40,
      vibe: 0.25,
      values: 0.25,
      emotional: 0.10,
    },
    sectionCategory: {
      "Your Social World": "lifestyle",
      "Your Vibe": "vibe",
      "What You Value": "values",
      "The Real You": "emotional",
    },
  },
};

const SECTIONS = {
  romance: [
    {title: "The Dealbreakers", ids: ["q7", "q8", "q9", "q10", "q11"]},
    {title: "Your Lifestyle", ids: ["q12", "q13", "q14", "q15", "q16", "q17"]},
    {title: "Personality & Temperament", ids: ["q18", "q19", "q20", "q21", "q22", "q23"]},
    {title: "Love & Attachment", ids: ["q24", "q25", "q26", "q27", "q28", "q29"]},
    {title: "Daily Life & Habits", ids: ["q30", "q31", "q32", "q33", "q34", "q35", "q36"]},
    {title: "Values & Beliefs", ids: ["q37", "q38", "q39", "q40", "q41", "q42", "q43"]},
    {title: "The Real You", ids: ["q44", "q45", "q46", "q47", "q48", "q49", "q50", "q51", "q52"]},
  ],
  friends: [
    {title: "Your Social World", ids: ["f11", "f12", "f13", "f14", "f15", "f16", "f17", "f18"]},
    {title: "Your Vibe", ids: ["f19", "f20", "f21", "f22", "f23", "f24", "f25", "f26"]},
    {title: "What You Value", ids: ["f27", "f28", "f29", "f30", "f31", "f33", "f34"]},
    {title: "The Real You", ids: ["f35", "f36", "f37", "f38", "f39", "f40"]},
  ],
};

const SLIDER_RANGES = {
  q16: {min: 1, max: 10}, q20: {min: 1, max: 10}, q21: {min: 1, max: 10},
  q23: {min: 1, max: 10}, q24: {min: 1, max: 10}, q25: {min: 1, max: 10},
  q28: {min: 1, max: 10}, q32: {min: 1, max: 10}, q34: {min: 1, max: 10},
  q36: {min: 1, max: 10}, q37: {min: 1, max: 10}, q38: {min: 1, max: 10},
  q39: {min: 1, max: 10}, q52: {min: 1, max: 10},
  f15: {min: 1, max: 10}, f16: {min: 1, max: 10}, f24: {min: 1, max: 10},
  f27: {min: 1, max: 10}, f29: {min: 1, max: 10}, f40: {min: 1, max: 10},
};

const MAX_MATCHES = 6;

function questionSimilarity(id, a, b) {
  if (a == null || b == null || a === "" || b === "") return null;
  const range = SLIDER_RANGES[id];
  if (range) {
    const span = (range.max - range.min) || 1;
    return Math.max(0, 1 - Math.abs(Number(a) - Number(b)) / span);
  }
  return a === b ? 1 : 0;
}

function scoreMatch(myAnswers, otherAnswers, portal) {
  const cfg = MATCH_CONFIG[portal];
  const sections = SECTIONS[portal];
  const catSum = {};
  const catCount = {};

  for (const section of sections) {
    const cat = cfg.sectionCategory[section.title];
    if (!cat) continue;
    for (const id of section.ids) {
      const sim = questionSimilarity(id, myAnswers[id], otherAnswers[id]);
      if (sim == null) continue;
      catSum[cat] = (catSum[cat] || 0) + sim;
      catCount[cat] = (catCount[cat] || 0) + 1;
    }
  }

  let weighted = 0;
  let usedWeight = 0;
  for (const cat of Object.keys(cfg.weights)) {
    if (catCount[cat]) {
      weighted += (catSum[cat] / catCount[cat]) * cfg.weights[cat];
      usedWeight += cfg.weights[cat];
    }
  }
  const ratio = usedWeight > 0 ? weighted / usedWeight : 0;
  return Math.round(ratio * 100);
}

function pickContact(profile, answers, portal) {
  if (profile && profile.contact) return profile.contact;
  if (portal === "friends" && answers && answers.f10) return answers.f10;
  if (answers && answers.q6) return answers.q6;
  return null;
}

function getVulnerability(answers, portal) {
  if (portal === "friends") return answers.f35 || "";
  return answers.q44 || "";
}

function getRealYou(answers, portal) {
  if (portal === "friends") {
    return {f35: answers.f35, f36: answers.f36, f37: answers.f37, f38: answers.f38};
  }
  return {q44: answers.q44, q47: answers.q47, q48: answers.q48, q49: answers.q49};
}

function buildMatchPayload(otherUser, portal) {
  const profile = otherUser.profile || {};
  const answers = (otherUser.answers || {})[portal] || {};
  return {
    userId: otherUser.userId,
    name: profile.name || "Someone",
    age: Number(profile.age) || 0,
    location: profile.city || "Unknown",
    bio: profile.bio || "",
    avatarId: profile.avatarId || "",
    contact: pickContact(profile, answers, portal),
    answers: answers,
    vulnerability: getVulnerability(answers, portal),
    realYou: getRealYou(answers, portal),
  };
}

async function runMatchmaking() {
  const db = admin.firestore();
  const snap = await db.collection("users").get();
  const users = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (!data || data.isPaused || !(data.profile || {}).published) return;
    users.push({userId: doc.id, ...data});
  });

  const portals = ["romance", "friends"];
  let totalWrites = 0;

  for (const portal of portals) {
    const eligible = users.filter((u) => (u.completedPortals || []).includes(portal));
    for (const user of eligible) {
      const myAnswers = (user.answers || {})[portal] || {};
      const scored = [];
      for (const other of eligible) {
        if (other.userId === user.userId) continue;
        const score = scoreMatch(myAnswers, (other.answers || {})[portal] || {}, portal);
        if (score > 0) {
          scored.push({...buildMatchPayload(other, portal), score});
        }
      }
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, MAX_MATCHES);

      const matchDoc = db.collection("users").doc(user.userId).collection("matches").doc(portal);
      await matchDoc.set({
        portal,
        matches: top,
        count: top.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ritualAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      totalWrites++;
    }
  }

  console.log(`Matchmaking complete. Users: ${users.length}, writes: ${totalWrites}`);
}

async function main() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT environment variable");
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (err) {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT JSON:", err.message);
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });

  try {
    await runMatchmaking();
  } catch (err) {
    console.error("Matchmaking failed:", err);
    process.exit(1);
  }
}

main();
