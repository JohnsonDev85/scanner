const kitufeAnza = document.getElementById("anza");
const kisanduku = document.getElementById("jibu");
const jinaMgeni = document.getElementById("jinaMgeni");
const hali = document.getElementById("hali");

// Urefu wa namba ya getini (herufi). Ukibadilisha kwenye Admin Panel, badilisha hapa pia.
const UREFU_WA_NAMBA = 4;

let anaangalia = false;
let nenoLaMwisho = "";
let mudaWaMwisho = 0;
let scanner = null;
let db = null;

// Matukio yanayotumika kukagua kwa namba (yanatafutwa yenyewe)
let matukioYaKukagua = [];
let anakaguaNamba = false;

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

// ============ MLIO NA MTETEMO ============
let sautiCtx = null;
function piga(vizuri) {
  try {
    if (!sautiCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) sautiCtx = new AC();
    }
    if (sautiCtx) {
      if (sautiCtx.state === "suspended") sautiCtx.resume();
      const o = sautiCtx.createOscillator();
      const g = sautiCtx.createGain();
      o.connect(g);
      g.connect(sautiCtx.destination);
      o.frequency.value = vizuri ? 1200 : 300;
      g.gain.value = 0.15;
      o.start();
      o.stop(sautiCtx.currentTime + (vizuri ? 0.12 : 0.35));
    }
  } catch (e) {}
  try {
    if (navigator.vibrate) navigator.vibrate(vizuri ? 60 : [120, 60, 120]);
  } catch (e) {}
}

// Maandishi ya SINGLE / DOUBLE
function maandishiYaAina(mgeni) {
  return mgeni.aina === "double" ? "DOUBLE (watu 2)" : "SINGLE (mtu 1)";
}

// ============ UKAGUZI WA MGENI (QR na namba) ============
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
      piga(false);
    } else if (matokeo.aina === "haijalipwa") {
      onyeshaJibu("haijalipwa", matokeo.jina, "HAJALIPA ✘");
      piga(false);
    } else if (matokeo.aina === "ameshaingia") {
      onyeshaJibu("haijulikani", matokeo.jina, "ALISHAINGIA TAYARI");
      kisanduku.style.background = "#e8710a"; // machungwa
      piga(false);
    } else {
      onyeshaJibu("imelipwa", matokeo.jina, "AMELIPA ✔ KARIBU · " + matokeo.ainaKadi);
      piga(true);
    }
  } catch (error) {
    onyeshaJibu("haijulikani", "Kosa", error.message);
    piga(false);
  }
}

// Ukaguzi kwa QR
async function angaliaMgeni(maandishi) {
  const sehemu = maandishi.split("::");

  if (sehemu.length !== 2) {
    onyeshaJibu("haijulikani", "", "KADI HAIJULIKANI");
    piga(false);
    return;
  }

  const ref = db
    .collection("events").doc(sehemu[0])
    .collection("guests").doc(sehemu[1]);

  await kaguaMgeni(ref);
}

// ============ KUTAFUTA TUKIO LA KUKAGUA KWA NAMBA ============
function tareheYaLeo() {
  const d = new Date();
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// Matukio ya leo; kama hakuna, tukio jipya zaidi
async function tafutaMatukio() {
  const lebo = document.getElementById("lebo");
  try {
    const snap = await db.collection("events").orderBy("createdAt", "desc").get();
    const wote = [];
    snap.forEach(function (doc) {
      wote.push({ id: doc.id, ...doc.data() });
    });

    const leo = tareheYaLeo();
    let waLeo = wote.filter(function (e) { return e.date === leo; });
    if (waLeo.length === 0 && wote.length > 0) {
      waLeo = [wote[0]];
    }

    matukioYaKukagua = waLeo;
    if (lebo) {
      lebo.textContent = waLeo.length
        ? "Tukio: " + waLeo.map(function (e) { return e.name; }).join(" / ")
        : "Hakuna tukio";
    }
  } catch (error) {
    console.error(error);
    if (lebo) lebo.textContent = "Imeshindikana kupakia tukio";
  }
}

// ============ UKAGUZI KWA NAMBA ============
async function angaliaKwaNamba() {
  if (anakaguaNamba) return;

  const kisandukuNamba = document.getElementById("nambaYaMgeni");
  const namba = kisandukuNamba.value.trim().toUpperCase().replace(/\s+/g, "");

  if (!db) {
    onyeshaJibu("haijulikani", "Kosa", "Firebase haijapakia");
    return;
  }
  if (!namba) {
    onyeshaJibu("haijulikani", "", "ANDIKA NAMBA KWANZA");
    return;
  }

  anakaguaNamba = true;
  try {
    if (matukioYaKukagua.length === 0) {
      await tafutaMatukio();
    }
    if (matukioYaKukagua.length === 0) {
      onyeshaJibu("haijulikani", "", "HAKUNA TUKIO");
      piga(false);
      return;
    }

    // Tafuta kwenye matukio yote yanayotumika kwa wakati mmoja
    const majibu = await Promise.all(
      matukioYaKukagua.map(function (e) {
        return db
          .collection("events").doc(e.id)
          .collection("guests")
          .where("namba", "==", namba)
          .limit(1)
          .get();
      })
    );

    const zilizopatikana = [];
    majibu.forEach(function (snap) {
      if (!snap.empty) zilizopatikana.push(snap.docs[0].ref);
    });

    if (zilizopatikana.length === 0) {
      onyeshaJibu("haijulikani", "", "NAMBA HAIJULIKANI");
      piga(false);
    } else if (zilizopatikana.length > 1) {
      onyeshaJibu("haijulikani", "", "NAMBA IPO KWENYE MATUKIO ZAIDI YA MOJA");
      piga(false);
    } else {
      await kaguaMgeni(zilizopatikana[0]);
    }
  } catch (error) {
    onyeshaJibu("haijulikani", "Kosa", error.message);
    piga(false);
  } finally {
    anakaguaNamba = false;
    kisandukuNamba.value = "";
    kisandukuNamba.focus();
  }
}

// Jenga sehemu ya "kagua kwa namba" chini ya kitufe cha kuanza
function jengaNjiaYaNamba() {
  const sanduku = document.createElement("div");
  sanduku.id = "njiaNamba";
  sanduku.style.cssText =
    "margin:16px 0;padding:14px;border:1px solid #ccc;border-radius:10px;text-align:center;";
  sanduku.innerHTML =
    '<div style="font-weight:600;margin-bottom:8px;">Hana QR? Andika namba yake</div>' +
    '<input id="nambaYaMgeni" type="text" maxlength="' + UREFU_WA_NAMBA + '" placeholder="Namba (mfano K7M3)" ' +
    'autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" ' +
    'style="width:100%;padding:12px;font-size:26px;text-align:center;letter-spacing:6px;text-transform:uppercase;box-sizing:border-box;margin-bottom:8px;">' +
    '<button id="kagua" type="button" style="width:100%;padding:12px;font-size:16px;">Kagua Namba</button>' +
    '<div id="lebo" style="margin-top:8px;font-size:12px;opacity:0.7;">Inatafuta tukio...</div>';

  kitufeAnza.insertAdjacentElement("afterend", sanduku);

  const kisandukuNamba = document.getElementById("nambaYaMgeni");

  document.getElementById("kagua").addEventListener("click", angaliaKwaNamba);

  kisandukuNamba.addEventListener("keydown", function (e) {
    if (e.key === "Enter") angaliaKwaNamba();
  });

  // Ikifika herufi zote, kagua yenyewe (hakuna kubonyeza kitufe)
  kisandukuNamba.addEventListener("input", function () {
    kisandukuNamba.value = kisandukuNamba.value.toUpperCase().replace(/\s+/g, "");
    if (kisandukuNamba.value.length >= UREFU_WA_NAMBA) {
      angaliaKwaNamba();
    }
  });

  if (db) tafutaMatukio();
}

// ============ KUSCAN QR ============
function scanImefanikiwa(maandishi) {
  const sasa = Date.now();

  if (anaangalia) return;
  // Kadi ileile ndani ya sekunde 4: puuza
  if (maandishi === nenoLaMwisho && sasa - mudaWaMwisho < 4000) return;

  anaangalia = true;
  nenoLaMwisho = maandishi;
  mudaWaMwisho = sasa;

  angaliaMgeni(maandishi).finally(function () {
    // Subiri kidogo kisha ruhusu scan inayofuata (hakuna haja ya kubonyeza "mwingine")
    setTimeout(function () {
      anaangalia = false;
    }, 1200);
  });
}

kitufeAnza.addEventListener("click", function () {
  if (typeof Html5Qrcode === "undefined") {
    onyeshaJibu("haijulikani", "Kosa", "Maktaba ya scanner haijapakia");
    return;
  }

  if (!scanner) {
    const mipangilio = {
      verbose: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    };
    if (typeof Html5QrcodeSupportedFormats !== "undefined") {
      mipangilio.formatsToSupport = [Html5QrcodeSupportedFormats.QR_CODE];
    }
    scanner = new Html5Qrcode("reader", mipangilio);
  }

  // Washa sauti (inahitaji kubonyeza kitufe mara ya kwanza)
  piga(true);

  onyeshaJibu("haijulikani", "Subiri...", "Inafungua kamera");

  scanner
    .start(
      { facingMode: "environment" },
      {
        fps: 25,
        disableFlip: true,
        qrbox: function (upana, urefu) {
          const ndogo = Math.min(upana, urefu);
          const ukubwa = Math.floor(ndogo * 0.7);
          return { width: ukubwa, height: ukubwa };
        }
      },
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
  nenoLaMwisho = "";
});

// ============ INIT ============
jengaNjiaYaNamba();
