const kitufeAnza = document.getElementById("anza");
const kisanduku = document.getElementById("jibu");
const jinaMgeni = document.getElementById("jinaMgeni");
const hali = document.getElementById("hali");

let anaangalia = false;
let scanner = null;
let db = null;

function onyeshaJibu(darasa, jina, maneno) {
  kisanduku.style.background = ""; // futa rangi maalum ya mwisho
  kisanduku.className = darasa;
  kisanduku.style.display = "block";
  jinaMgeni.textContent = jina;
  hali.textContent = maneno;
}

window.onerror = function (ujumbe) {
  onyeshaJibu("haijulikani", "Kosa la JS", ujumbe);
};

try {
  const firebaseConfig = {
    apiKey: "AIzaSyBhh3nIzAWyvT47HQ-hh6umjqoCMYBI1Lk",
    authDomain: "johcards-2db9b.firebaseapp.com",
    projectId: "johcards-2db9b",
    storageBucket: "johcards-2db9b.firebasestorage.app",
    messagingSenderId: "955656442066",
    appId: "1:955656442066:web:3f0d0335191d67eac61d0b"
  };
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (error) {
  onyeshaJibu("haijulikani", "Firebase haijapakia", error.message);
}

// Maandishi ya SINGLE / DOUBLE
function maandishiYaAina(mgeni) {
  return mgeni.aina === "double" ? "DOUBLE (watu 2)" : "SINGLE (mtu 1)";
}

// Ukaguzi wa mgeni kwa kutumia ref yake (unatumika na QR na namba)
async function kaguaMgeni(ref) {
  try {
    // Transaction: inazuia watu wawili kuingia kwa kadi moja kwa wakati mmoja
    const matokeo = await db.runTransaction(async function (t) {
      const doc = await t.get(ref);

      if (!doc.exists) {
        return { aina: "haijulikani" };
      }

      const mgeni = doc.data();

      if (mgeni.paid !== true) {
        return { aina: "haijalipwa", jina: mgeni.name };
      }

      if (mgeni.attended === true) {
        return { aina: "ameshaingia", jina: mgeni.name };
      }

      t.update(ref, {
        attended: true,
        attendedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { aina: "karibu", jina: mgeni.name, ainaKadi: maandishiYaAina(mgeni) };
    });

    if (matokeo.aina === "haijulikani") {
      onyeshaJibu("haijulikani", "", "KADI HAIJULIKANI");
    } else if (matokeo.aina === "haijalipwa") {
      onyeshaJibu("haijalipwa", matokeo.jina, "HAJALIPA ✘");
    } else if (matokeo.aina === "ameshaingia") {
      onyeshaJibu("haijulikani", matokeo.jina, "ALISHAINGIA TAYARI");
      kisanduku.style.background = "#e8710a"; // machungwa
    } else {
      onyeshaJibu("imelipwa", matokeo.jina, "AMELIPA ✔ KARIBU · " + matokeo.ainaKadi);
    }
  } catch (error) {
    onyeshaJibu("haijulikani", "Kosa", error.message);
  }
}

// Ukaguzi kwa QR
async function angaliaMgeni(maandishi) {
  const sehemu = maandishi.split("::");

  if (sehemu.length !== 2) {
    onyeshaJibu("haijulikani", "", "KADI HAIJULIKANI");
    return;
  }

  const ref = db
    .collection("events").doc(sehemu[0])
    .collection("guests").doc(sehemu[1]);

  await kaguaMgeni(ref);
}

// Ukaguzi kwa namba (kwa wageni wasio na QR)
async function angaliaKwaNamba() {
  const chaguaTukio = document.getElementById("chaguaTukio");
  const kisandukuNamba = document.getElementById("nambaYaMgeni");
  const kitufeKagua = document.getElementById("kagua");

  const eventId = chaguaTukio.value;
  const namba = kisandukuNamba.value.trim().toUpperCase().replace(/\s+/g, "");

  if (!db) {
    onyeshaJibu("haijulikani", "Kosa", "Firebase haijapakia");
    return;
  }
  if (!eventId) {
    onyeshaJibu("haijulikani", "", "CHAGUA TUKIO KWANZA");
    return;
  }
  if (!namba) {
    onyeshaJibu("haijulikani", "", "ANDIKA NAMBA KWANZA");
    return;
  }

  kitufeKagua.disabled = true;
  try {
    const snap = await db
      .collection("events").doc(eventId)
      .collection("guests")
      .where("namba", "==", namba)
      .limit(1)
      .get();

    if (snap.empty) {
      onyeshaJibu("haijulikani", "", "NAMBA HAIJULIKANI");
    } else {
      await kaguaMgeni(snap.docs[0].ref);
    }
  } catch (error) {
    onyeshaJibu("haijulikani", "Kosa", error.message);
  } finally {
    kitufeKagua.disabled = false;
    kisandukuNamba.value = "";
  }
}

// Jenga sehemu ya "kagua kwa namba" chini ya kitufe cha kuanza
function jengaNjiaYaNamba() {
  const sanduku = document.createElement("div");
  sanduku.id = "njiaNamba";
  sanduku.style.cssText =
    "margin:16px 0;padding:14px;border:1px solid #ccc;border-radius:10px;text-align:center;";
  sanduku.innerHTML =
    '<div style="font-weight:600;margin-bottom:8px;">Hana QR? Kagua kwa namba</div>' +
    '<select id="chaguaTukio" style="width:100%;padding:10px;font-size:16px;margin-bottom:8px;box-sizing:border-box;"></select>' +
    '<input id="nambaYaMgeni" type="text" maxlength="8" placeholder="Namba (mfano K7M3)" ' +
    'autocapitalize="characters" autocomplete="off" ' +
    'style="width:100%;padding:12px;font-size:22px;text-align:center;letter-spacing:4px;text-transform:uppercase;box-sizing:border-box;margin-bottom:8px;">' +
    '<button id="kagua" type="button" style="width:100%;padding:12px;font-size:16px;">Kagua Namba</button>';

  kitufeAnza.insertAdjacentElement("afterend", sanduku);

  document.getElementById("kagua").addEventListener("click", angaliaKwaNamba);
  document.getElementById("nambaYaMgeni").addEventListener("keydown", function (e) {
    if (e.key === "Enter") angaliaKwaNamba();
  });
  document.getElementById("chaguaTukio").addEventListener("change", function (e) {
    try { localStorage.setItem("tukioLaGetini", e.target.value); } catch (err) {}
  });

  pakiaMatukio();
}

// Pakia orodha ya matukio kwenye chaguo
async function pakiaMatukio() {
  const chaguaTukio = document.getElementById("chaguaTukio");
  if (!db) {
    chaguaTukio.innerHTML = '<option value="">Firebase haijapakia</option>';
    return;
  }

  try {
    const snap = await db.collection("events").orderBy("createdAt", "desc").get();
    chaguaTukio.innerHTML = '<option value="">— Chagua tukio —</option>';
    snap.forEach(function (doc) {
      const d = doc.data();
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = d.name + " (" + d.code + ")";
      chaguaTukio.appendChild(opt);
    });

    // Rudisha tukio alilolichagua mara ya mwisho, la sivyo chagua jipya zaidi
    let lililohifadhiwa = "";
    try { lililohifadhiwa = localStorage.getItem("tukioLaGetini") || ""; } catch (err) {}
    if (lililohifadhiwa && chaguaTukio.querySelector('option[value="' + lililohifadhiwa + '"]')) {
      chaguaTukio.value = lililohifadhiwa;
    } else if (chaguaTukio.options.length > 1) {
      chaguaTukio.selectedIndex = 1;
    }
  } catch (error) {
    chaguaTukio.innerHTML = '<option value="">Imeshindikana kupakia matukio</option>';
    console.error(error);
  }
}

function scanImefanikiwa(maandishi) {
  if (anaangalia) return;
  anaangalia = true;
  angaliaMgeni(maandishi);
}

kitufeAnza.addEventListener("click", function () {
  if (typeof Html5Qrcode === "undefined") {
    onyeshaJibu("haijulikani", "Kosa", "Maktaba ya scanner haijapakia");
    return;
  }

  if (!scanner) {
    scanner = new Html5Qrcode("reader");
  }

  onyeshaJibu("haijulikani", "Subiri...", "Inafungua kamera");

  scanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      scanImefanikiwa
    )
    .then(function () {
      kisanduku.style.display = "none";
    })
    .catch(function (error) {
      onyeshaJibu("haijulikani", "Kamera haijafunguka", String(error));
    });
});

document.getElementById("mwingine").addEventListener("click", function () {
  kisanduku.style.display = "none";
  anaangalia = false;
});

// ============ INIT ============
jengaNjiaYaNamba();
