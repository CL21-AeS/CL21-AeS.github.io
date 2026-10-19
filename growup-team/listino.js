/* Growup Team — la lettura del listino Amway in PDF ("Listino prezzi per l'incaricato"), sul telefono dell'admin.
   Il PDF non si salva: si leggono le righe dei prodotti e si mostrano in anteprima prima di aggiornare il listino.
   Funzioni separate dall'app così si provano anche da sole. */
"use strict";

/* Il testo di una pagina del PDF in righe: gli elementi alla stessa altezza, da sinistra a destra; dove c'è un vuoto
   largo (una colonna) si mettono due spazi. Di ogni riga anche il carattere più grande (i titoli delle categorie sono
   più grandi) e dove comincia. Il testo ruotato (le intestazioni delle colonne) si salta. */
function righePdf(items){
  const r = [];
  for(const it of items){
    if(!it.str || !it.str.trim() || Math.abs(it.transform[1]) > 0.01) continue;
    const x = it.transform[4], y = it.transform[5];
    let l = r.find(z => Math.abs(z.y - y) < 2.5);
    if(!l){ l = { y, el:[] }; r.push(l); }
    l.el.push({ x, w:it.width, s:it.str, h:Math.abs(it.transform[0]) });
  }
  return r.sort((a, b) => b.y - a.y).map(l => {
    l.el.sort((a, b) => a.x - b.x);
    let t = "", fine = null;
    for(const e of l.el){ if(fine != null) t += e.x - fine > 6 ? "  " : e.x - fine > 0.8 ? " " : ""; t += e.s; fine = e.x + e.w; }
    return { t, h:Math.max(...l.el.map(e => e.h)), x:l.el[0].x };
  });
}

/* Il listino Amway ("Listino prezzi per l'incaricato", PDF): per ogni prodotto codice e descrizione, contenuto, prezzo al
   cliente, provvigione, prezzo Partner, a volte il prezzo per unità ("52,18 / 100 g"), VP e VV ("-,–" se non c'è).
   I colori e i gusti stanno sotto il loro prodotto (riga senza codice), a coppie "codice  nome", con il suo prezzo.
   Le descrizioni lunghe vanno a capo su una riga senza numeri; i titoli delle categorie hanno il carattere più grande. */
function leggiListino(righe){
  const PREZZO = /^(\d{1,3}(?:\.\d{3})*,\d{2}|-,–|-,-)$/;
  const val = s => /\d/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : null;
  const prodotti = new Map(), dubbi = [];
  let categoria = "", ultimo = null, padre = null;
  /* dopo la descrizione: [contenuto…] cliente provvigione Partner [unità] VP VV */
  const leggiCoda = seg => {
    const pezzi = seg.join("  ").split(/ {2,}| (?=\d{1,3}(?:\.\d{3})*,\d{2}\b)| (?=-,[–-])/).map(s => s.trim()).filter(Boolean);
    const i = pezzi.findIndex(s => PREZZO.test(s));
    if(i < 0) return null;
    const n = pezzi.slice(i).filter((s, k, a) => PREZZO.test(s) && !(a[k + 1] || "").startsWith("/"));
    if(n.length < 5 || val(n[2]) == null) return null;
    return { formato:pezzi.slice(0, i).join(" "), prezzo_cliente:val(n[0]), prezzo_partner:val(n[2]), vp:val(n[3]) };
  };
  for(const r of righe){
    const riga = r.t || "", seg = riga.split(/ {2,}/).map(s => s.trim()).filter(Boolean);
    if(!seg.length || /^\d{1,2}$/.test(riga.trim())) continue;
    const m = seg[0].match(/^(\d{5,7}) (.+)$/);
    if(m){
      const c = leggiCoda(seg.slice(1));
      if(!c){ dubbi.push(riga); ultimo = padre = null; continue; }
      ultimo = Object.assign({ codice:m[1], nome:m[2], categoria }, c);
      prodotti.set(m[1], ultimo); padre = null; continue;
    }
    if(/^\d{5,7}$/.test(seg[0]) && padre){
      ultimo = null;
      for(let i = 0; i + 1 < seg.length; i += 2){
        if(!/^\d{5,7}$/.test(seg[i])) continue;
        const v = Object.assign({}, padre, { codice:seg[i], nome:`${padre.nome} – ${seg[i + 1]}` });
        prodotti.set(seg[i], v); ultimo = v;
      }
      continue;
    }
    if(/\d,\d\d/.test(riga)){
      const c = leggiCoda(seg.slice(1));
      if(c){ padre = Object.assign({ nome:seg[0], categoria }, c); ultimo = null; continue; }
    }
    if(/\d{4}/.test(riga)) continue;
    if(r.h >= 10){ categoria = riga.replace(/ {2,}/g, " ").trim(); ultimo = padre = null; continue; }
    /* la descrizione (o il contenuto, più a destra) che va a capo */
    const dove = ultimo || padre;
    if(dove){ if(r.x > 200) dove.formato = `${dove.formato} ${riga.trim()}`.trim(); else dove.nome = `${dove.nome} ${riga.trim()}`; }
  }
  return { prodotti:[...prodotti.values()], dubbi };
}
