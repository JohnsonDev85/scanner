const kitufeAnza = document.getElementById("anza");
const kisanduku = document.getElementById("jibu");
const jinaMgeni = document.getElementById("jinaMgeni");
const hali = document.getElementById("hali");

// Urefu wa namba ya getini (herufi). Ukibadilisha kwenye Admin Panel, badilisha hapa pia.
const UREFU_WA_NAMBA = 4;

let anaangalia = false;
let kameraImewaka = false;
let scanner = null;
let db = null;
let kidokezoTimer = null;

// Matukio yanayotumika kukagua kwa namba (yanatafutwa yenyewe)
let matukioYaKukagua = [];
let anakaguaNamba = false;

// Tukio lililochaguliwa (linabaki hadi ukurasa ufunguliwe upya)
let tukioLililochaguliwa = "";

// darasa: imelipwa | haijalipwa | ameshaingia | haijulikani
function onyeshaJibu(darasa, jina, maneno) {
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

// Gusa skrini mara ya kwanza: inaandaa sauti na mtetemo
function andaaSautiNaMtetemo() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !sautiCtx) sautiCtx = new AC();
    if (sautiCtx && sautiCtx.state === "suspended") sautiCtx.resume();
  } catch (e) {}
  try {
    if (navigator.vibrate) navigator.vibrate(1);
  } catch (e) {}
}
document.addEventListener("pointerdown", andaaSautiNaMtetemo, { once: true });
document.addEventListener("touchstart", andaaSautiNaMtetemo, { once: true });

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
    if (navigator.vibrate) {
      navigator.vibrate(vizuri ? 150 : [250, 100, 250]);
    }
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

      // Kwanza: ameshaingia? (hii inafanya kazi kwa QR na kwa namba)
      if (mgeni.attended === true) {
        return { aina: "ameshaingia", jina: mgeni.name };
      }

      // Kisha: amelipa?
      if (mgeni.paid !== true) {
        return { aina: "haijalipwa", jina: mgeni.name };
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
      onyeshaJibu("ameshaingia", matokeo.jina, "ALISHAINGIA TAYARI");
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

// Ukaguzi kwa QR (haihitaji kuchagua tukio)
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

// Jaza orodha ya kuchagua tukio (inaonekana tu kama matukio ni zaidi ya moja)
function andaaOrodhaYaMatukio() {
  const orodha = document.getElementById("chaguaTukio");
  if (!orodha) return;

  if (matukioYaKukagua.length > 1) {
    orodha.innerHTML = "";

    const kwanza = document.createElement("option");
    kwanza.value = "";
    kwanza.textContent = "— Chagua tukio —";
    orodha.appendChild(kwanza);

    matukioYaKukagua.forEach(function (e) {
      const op = document.createElement("option");
      op.value = e.id;
      op.textContent = e.name;
      orodha.appendChild(op);
    });

    // Rudisha chaguo la awali kama bado lipo
    const bado = matukioYaKukagua.some(function (e) { return e.id === tukioLililochaguliwa; });
    if (!bado) tukioLililochaguliwa = "";
    orodha.value = tukioLililochaguliwa;

    orodha.style.display = "block";
  } else {
    orodha.style.display = "none";
    tukioLililochaguliwa = "";
  }
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
    andaaOrodhaYaMatukio();
    onyeshaLeboLaTukio();
  } catch (error) {
    console.error(error);
    if (lebo) lebo.textContent = "Imeshindikana kupakia tukio";
  }
}

// Maandishi chini ya sehemu ya namba
function onyeshaLeboLaTukio() {
  const lebo = document.getElementById("lebo");
  if (!lebo) return;

  if (matukioYaKukagua.length === 0) {
    lebo.textContent = "Hakuna tukio";
  } else if (matukioYaKukagua.length === 1) {
    lebo.textContent = "Tukio: " + matukioYaKukagua[0].name;
  } else if (tukioLililochaguliwa) {
    const t = matukioYaKukagua.find(function (e) { return e.id === tukioLililochaguliwa; });
    lebo.textContent = "Tukio: " + (t ? t.name : "");
  } else {
    lebo.textContent = "Matukio ya leo: " + matukioYaKukagua.length + ". Chagua tukio.";
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

  // Matukio yakiwa hayajapakia bado, yatafute kwanza
  if (matukioYaKukagua.length === 0) {
    await tafutaMatukio();
  }
  if (matukioYaKukagua.length === 0) {
    onyeshaJibu("haijulikani", "", "HAKUNA TUKIO");
    piga(false);
    return;
  }

  // Matukio zaidi ya moja: lazima achague tukio kwanza (namba yake haifutwi)
  if (matukioYaKukagua.length > 1 && !tukioLililochaguliwa) {
    onyeshaJibu("haijulikani", "", "CHAGUA TUKIO KWANZA");
    piga(false);
    return;
  }

  // Tukio la kutafutia
  const matukioYaKutafuta =
    matukioYaKukagua.length > 1
      ? matukioYaKukagua.filter(function (e) { return e.id === tukioLililochaguliwa; })
      : matukioYaKukagua;

  anakaguaNamba = true;
  try {
    const majibu = await Promise.all(
      matukioYaKutafuta.map(function (e) {
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
      // Namba si sahihi: mlio na mtetemo tu, bila kisanduku cha matokeo
      kisanduku.style.display = "none";
      anaangalia = false;
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

// Unganisha sehemu ya "kagua kwa namba" (HTML yake iko kwenye index.html)
function andaaNjiaYaNamba() {
  const kisandukuNamba = document.getElementById("nambaYaMgeni");
  const kitufeKagua = document.getElementById("kagua");
  const orodha = document.getElementById("chaguaTukio");
  if (!kisandukuNamba || !kitufeKagua) return;

  kisandukuNamba.maxLength = UREFU_WA_NAMBA;

  kitufeKagua.addEventListener("click", angaliaKwaNamba);

  // Mtu akichagua tukio, linakumbukwa hadi ukurasa ufunguliwe upya
  if (orodha) {
    orodha.addEventListener("change", function () {
      tukioLililochaguliwa = orodha.value;
      onyeshaLeboLaTukio();
      kisandukuNamba.focus();
    });
  }

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

// ============ KIDOKEZO KAMA QR HAISOMEKI ============
function futaKidokezo() {
  if (kidokezoTimer) {
    clearTimeout(kidokezoTimer);
    kidokezoTimer = null;
  }
  const k = document.getElementById("kidokezo");
  if (k) k.classList.remove("onekana");
}

function anzaKidokezo() {
  futaKidokezo();
  kidokezoTimer = setTimeout(function () {
    const k = document.getElementById("kidokezo");
    if (!k) return;
    k.textContent =
      "QR haisomeki? Sogeza simu mbali au karibu, ongeza mwanga, au washa tochi.";
    k.classList.add("onekana");
  }, 10000);
}

// ============ TOCHI NA ZOOM (kama simu inaruhusu) ============
function onyeshaVifaaVyaKamera() {
  const eneo = document.getElementById("vifaaVyaKamera");
  if (!eneo) return;
  eneo.innerHTML = "";

  let uwezo = null;
  try {
    uwezo = scanner.getRunningTrackCameraCapabilities();
  } catch (e) {
    return; // simu haiungi mkono
  }
  if (!uwezo) return;

  // Tochi
  try {
    const tochi = uwezo.torchFeature();
    if (tochi && tochi.isSupported()) {
      let imewaka = false;
      const kitufe = document.createElement("button");
      kitufe.type = "button";
      kitufe.textContent = "🔦 Washa Tochi";
      kitufe.addEventListener("click", async function () {
        try {
          await tochi.apply(!imewaka);
          imewaka = !imewaka;
          kitufe.textContent = imewaka ? "🔦 Zima Tochi" : "🔦 Washa Tochi";
        } catch (e) {
          console.warn("Tochi imeshindikana:", e);
        }
      });
      eneo.appendChild(kitufe);
    }
  } catch (e) {}

  // Zoom
  try {
    const zum = uwezo.zoomFeature();
    if (zum && zum.isSupported()) {
      const lebo = document.createElement("label");
      lebo.textContent = "Zoom ";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = zum.min();
      slider.max = zum.max();
      slider.step = zum.step();
      slider.value = zum.value();
      slider.addEventListener("input", function () {
        zum.apply(parseFloat(slider.value)).catch(function () {});
      });
      lebo.appendChild(slider);
      eneo.appendChild(lebo);
    }
  } catch (e) {}
}

// ============ KUSCAN QR ============
// Scanner inasimama baada ya kila mgeni; bonyeza "mwingine" kuendelea
function scanImefanikiwa(maandishi) {
  if (anaangalia) return;
  anaangalia = true;
  futaKidokezo();
  piga(true);
  onyeshaJibu("haijulikani", "Inakagua...", "Subiri kidogo");
  angaliaMgeni(maandishi);
}

// Mipangilio ya kamera inayofaa simu zote, hata za kawaida
const mipangilioYaKamera = {
  fps: 15, // kasi zaidi ya kusoma fremu
  disableFlip: true,
  qrbox: function (upana, urefu) {
    // Soma karibu fremu nzima, QR hahitaji kuwa katikati kabisa
    const ndogo = Math.min(upana, urefu);
    const ukubwa = Math.max(50, Math.floor(ndogo * 0.9));
    return { width: ukubwa, height: ukubwa };
  }
};

// Jaribu njia kadhaa za kufungua kamera ili ifanye kazi kwenye simu yoyote
async function fungulaKamera() {
  // 1. Kamera ya nyuma (njia ya kawaida)
  try {
    await scanner.start({ facingMode: "environment" }, mipangilioYaKamera, scanImefanikiwa);
    return;
  } catch (e1) {
    console.warn("Kamera ya nyuma imeshindikana, najaribu nyingine:", e1);
  }

  // 2. Tafuta kamera zote za simu, chagua ya nyuma (au ya mwisho kwenye orodha)
  try {
    const kamera = await Html5Qrcode.getCameras();
    if (kamera && kamera.length) {
      const nyuma =
        kamera.find(function (k) { return /back|rear|environment|nyuma/i.test(k.label); }) ||
        kamera[kamera.length - 1];
      await scanner.start(nyuma.id, mipangilioYaKamera, scanImefanikiwa);
      return;
    }
  } catch (e2) {
    console.warn("Orodha ya kamera imeshindikana, najaribu ya mbele:", e2);
  }

  // 3. Kamera ya mbele kama ya mwisho
  await scanner.start({ facingMode: "user" }, mipangilioYaKamera, scanImefanikiwa);
}

kitufeAnza.addEventListener("click", function () {
  if (typeof Html5Qrcode === "undefined") {
    onyeshaJibu("haijulikani", "Kosa", "Maktaba ya scanner haijapakia");
    return;
  }

  // Kamera tayari imewaka: usifungue mara mbili
  if (kameraImewaka) return;

  if (!scanner) {
    const mipangilio = { verbose: false, useBarCodeDetectorIfSupported: true };
    if (typeof Html5QrcodeSupportedFormats !== "undefined") {
      mipangilio.formatsToSupport = [Html5QrcodeSupportedFormats.QR_CODE];
    }
    scanner = new Html5Qrcode("reader", mipangilio);
  }

  // Washa sauti (inahitaji kubonyeza kitufe mara ya kwanza)
  piga(true);

  onyeshaJibu("haijulikani", "Subiri...", "Inafungua kamera");

  fungulaKamera()
    .then(function () {
      kameraImewaka = true;
      kisanduku.style.display = "none";

      // Omba focus ya kuendelea (kamera zisizo na focus nzuri)
      try {
        if (typeof scanner.applyVideoConstraints === "function") {
          scanner
            .applyVideoConstraints({ advanced: [{ focusMode: "continuous" }] })
            .catch(function () {});
        }
      } catch (e) {}

      onyeshaVifaaVyaKamera();
      anzaKidokezo();
    })
    .catch(function (error) {
      const maelezo = String(error);
      if (/NotAllowed|Permission|denied/i.test(maelezo)) {
        onyeshaJibu(
          "haijulikani",
          "Kamera imezuiwa",
          "Ruhusu kamera kwenye browser, kisha bonyeza Anza tena"
        );
      } else {
        onyeshaJibu("haijulikani", "Kamera haijafunguka", maelezo);
      }
    });
});

document.getElementById("mwingine").addEventListener("click", function () {
  kisanduku.style.display = "none";
  anaangalia = false;
  if (kameraImewaka) anzaKidokezo();
});

// ============ INIT ============
andaaNjiaYaNamba();
