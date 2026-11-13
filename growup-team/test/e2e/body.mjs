// 0. 041: il vecchio link d'invito generico non fa più entrare
let { ctx, page } = await apri({}, "#RRRR22");
await page.getByText("Ora si entra solo su invito").waitFor();
check(!(await page.locator("form[data-form=ingresso]").count()), "041: il vecchio link generico non apre l'ingresso");
await ctx.close();
// un invito già usato, scaduto o annullato non apre l'ingresso
for(const [extra, testo] of [[{ usato_il:new Date().toISOString() }, "Invito già usato"], [{ scade_il:new Date(Date.now() - 6e4).toISOString() }, "Invito scaduto"],
    [{ annullato_il:new Date().toISOString() }, "Invito annullato"]]){
  ({ ctx, page } = await apri({}, invitoPer("R", "Prova Chiusa", "2999999", extra)));
  await page.getByText(testo).waitFor(); check(true, "041: " + testo.toLowerCase());
  await ctx.close();
}
({ ctx, page } = await apri({}, "#invito=" + "0".repeat(32)));
await page.getByText("Link non valido").waitFor(); check(true, "041: un invito inventato non apre l'ingresso");
await ctx.close();

// 1. Ingresso dall'invito personale
({ ctx, page } = await apri({}, invitoPer("R", "Anna Bianchi", "2000001")));
await page.getByText("Ti hanno invitato Stefano e Alessia").waitFor();
check(await page.getByText("Ciao Anna,").isVisible(), "041: l'ingresso saluta per nome chi è stato invitato");
check(!(await page.locator("form[data-form=ingresso] input[name=nome], form[data-form=ingresso] input[name=codice_amway]").count()),
  "041: nome e codice Amway non si scrivono all'ingresso (li ha scritti chi invita)");
check(!(await page.evaluate(() => location.hash)), "041: il codice dell'invito non resta nella barra degli indirizzi");
check(await page.getByText("A&S · Growup Team").first().isVisible(), "marchio A&S");
check(!(await page.content()).includes("CumLaude21"), "niente CumLaude21");
check(await page.getByText("ti diamo il benvenuto in Growup").isVisible(), "nuovo testo d'ingresso");
check(!(await page.content()).includes("sei dentro"), "niente 'sei dentro'");
check(!(await page.getByText("1° giugno").count()), "niente scelta prima/dopo giugno");
const opzioni = await page.locator("select[name=qualifica] option").allInnerTexts();
check(opzioni[0] === "Inizio (nessuna qualifica)", "prima opzione Inizio");
check(["3%","6%","9%","12%","15%","18%","21%"].every(x => opzioni.includes(x)), "pin 3%-21% nella lista");
check(!opzioni.includes("Primo ordine") && !opzioni.includes("Primi clienti"), "niente primo ordine/primi clienti");
check(opzioni.includes("Bronze Foundation 9%") && opzioni.includes("Argento 21%"), "qualifiche Bronze e Argento");
// "Hai già un profilo?" e ritorno
await page.click("button[data-act=ho-gia]");
await page.getByText("Entra in Growup").waitFor();
await page.click("button[data-act=torna-invito]");
await page.getByText("ti diamo il benvenuto in Growup").waitFor(); check(true, "si torna all'invito");
await page.click("form button.primary");
check(await page.getByText("serve la data di iscrizione").isVisible(), "data obbligatoria per chi inizia");
/* una data di iscrizione di 5 giorni fa: il conto alla rovescia dei 30 giorni è sempre aperto, qualunque giorno giri il test */
await page.fill("input[name=data]", new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10));
await page.check("input[name=privacy]");
check(await page.locator("form button.primary").innerText() === "Avanti", "consegna 9: pulsante Avanti (passo 1 di 2)");
check((await page.locator(".ingresso-testa h1").innerText()).replace(/\s+/g, " ").includes("ti diamo il benvenuto in Growup")
  && (await page.locator(".chi-invita").innerText()).replace(/\s+/g, " ").includes("Ti hanno invitato Stefano e Alessia")
  && (await page.locator(".chi-invita .iniziali").innerText()).trim() === "S&A", "consegna 9: l'ingresso accoglie (chi invita, saluto per tutti)");
check((await page.locator(".passo-ingresso .eyebrow").textContent()).trim() === "Passo 1 di 2 · Da dove parti in Amway", "consegna 9: passo 1 di 2");
await page.screenshot({ path: S + "/e2e/1-ingresso.png", fullPage:true });
await page.click("form button.primary");
// il primo obiettivo, subito dopo l'ingresso
await page.getByText("Da dove parti?").waitFor(); check(true, "dopo l'ingresso: «Da dove parti?»");
check(!(await page.locator("button[data-act=obiettivo-dopo]").count()) && await page.locator("form[data-form=obiettivo] button.primary").innerText() === "Inizia il mio percorso",
  "consegna 6: blocco vero, niente «Lo scrivo dopo»");
check(await page.locator("form[data-form=obiettivo] .link-da-salvare").isVisible(), "consegna 6: sotto, il link personale da salvare");
await page.click("form button.primary");
check(await page.locator(".errore").innerText() === "Scrivi quanto vorresti guadagnare al mese, per esempio 400.", "obiettivo: serve la cifra");
await page.fill("input[name=cifra]", "300");
await page.click("form button.primary");
check((await page.locator(".errore").innerText()).startsWith("Scegli il mese entro cui"), "obiettivo: serve il mese");
const entroAnna = (() => { const d = new Date(); return (d.getFullYear() + 1) + "-06"; })();
await page.fill("input[name=entro]", entroAnna);
await page.click("form button.primary");
check((await page.locator(".errore").innerText()).startsWith("Scrivi perché lo fai"), "consegna 6: il perché è obbligatorio");
await page.fill("textarea[name=perche]", "Per la famiglia");
await page.screenshot({ path: S + "/e2e/24-obiettivo-primo.png", fullPage:true });
await page.click("form button.primary");
await page.getByText("Ciao Anna").waitFor(); check(true, "consegna 6: «Inizia il mio percorso» porta a Io");
await page.click("button[role=tab][data-act=vista-obiettivo]");
await page.getByText("La tappa che vale la tua cifra").waitFor();
check(await page.locator(".card", { hasText:"La tappa che vale la tua cifra" }).locator("h2").innerText() === "Bronze Foundation 9%", "300 €/mese: Bronze Foundation 9%");
check(await page.getByText("Da qui: 4 tappe, compresa quella attuale.").isVisible(), "obiettivo: 4 tappe da qui");
check(await page.locator(".percorso li.attuale", { hasText:"Primo ordine" }).isVisible() && await page.locator(".percorso li.meta", { hasText:"Bronze Foundation 9%" }).isVisible(),
  "percorso: tappa attuale e tappa obiettivo");
check(!(await page.locator("#app").innerText()).includes("La visione"), "obiettivo: tolta «La visione»");
{ const voci = (await page.locator(".percorso > li").allInnerTexts()).map(x => x.replace(/\s+/g, " "));
  check(await page.getByText("Il tuo percorso fino a Diamante").isVisible() && voci[voci.length - 1].includes("Diamante") && !voci.some(x => /Fondatore/i.test(x))
    && voci.findIndex(x => x.includes("Bronze Foundation 9%")) < voci.length - 1 && await page.locator(".percorso > li.meta").count() === 1
    && (await page.locator(".percorso > li > .mark").allInnerTexts()).slice(-1)[0].trim() === String(voci.length),
    "percorso: tutto fino a Diamante, la tappa dell'obiettivo evidenziata (" + voci.length + " tappe)"); }
check(await page.getByText("«Per la famiglia»").isVisible(), "il perché si vede a chi l'ha scritto");
await page.screenshot({ path: S + "/e2e/25-obiettivo.png", fullPage:true });
await page.click("button[data-act=vista-io]");
await page.getByText("Ciao Anna").waitFor(); await apriTappa(page);
check(await page.locator(".miei-numeri button[data-act=obiettivo-da-io]").getByText("300 €").isVisible() && !(await page.locator(".obiettivo-breve").count()),
  "su Io: il mio obiettivo è la prima riga di «I miei numeri»");
await page.click("button[data-act=vista-profilo]");
check(await page.locator("button[data-act=copia-dati]").count() === 0, "chi non è admin non vede la copia dei dati");
check(await page.locator("button[data-act=listino]").count() === 0, "chi non è admin non vede il listino");
check(await page.getByText("Solo Admin", { exact:true }).count() === 0, "chi non è admin non vede le scritte Solo Admin");
await page.click("button[data-act=vista-io]");
await sync(page);
const anna = DB.partners.find(p => p.nome === "Anna Bianchi");
check(anna.sponsor_id === "R", "Anna sotto Stefano e Alessia");
await page.click("text=Fatto, l'ho salvato");
check(await page.getByText(/Mancano \d+ giorni per non pagare/).isVisible(), "conto alla rovescia");

// 2. Attività (regressione)
// + Contatto: apre "un nome", la persona entra già contattata e il contatto conta nella settimana; si resta su Io
await page.click("button[data-act=contatto-rapido]");
check(await page.locator(".sheet h2", { hasText:"Un contatto" }).isVisible(), "+ Contatto apre l'inserimento di un nome");
await page.fill(".sheet input[name=nome]", "Paolo Rapido");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Contatto con Paolo registrato").waitFor();
await page.locator("button[data-act=contatto-rapido] b", { hasText:"1 questa sett." }).waitFor();
await sync(page);
const paoloR = DB.persone.find(x => x.nome === "Paolo Rapido");
check(paoloR && paoloR.fase === "contattato" && DB.activities.filter(a => a.partner_id === paoloR.proprietario && a.tipo === "contatto").length === 1, "contatto +1, Paolo nella lista come Contattato");
check(await page.locator("#azioni button[data-act=piano-rapido]").isVisible(), "dopo il contatto si resta su Io");
// + Piano: si sceglie la persona e si compila il piano; conta nella settimana
await page.click("button[data-act=piano-rapido]");
await page.fill("#cerca-piano", "paolo");
await page.locator("#risultati-piano button[data-act=piano-con]", { hasText:"Paolo Rapido" }).click();
check(await page.locator(".sheet h2", { hasText:"segna un passo" }).isVisible() && await page.locator(".sheet button.on", { hasText:"Piano" }).isVisible(), "+ Piano apre il passo Piano della persona");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Piano segnato").waitFor();
await page.locator("button[data-act=piano-rapido] b", { hasText:"1 questa sett." }).waitFor();
await sync(page);
check(DB.persone.find(x => x.id === paoloR.id).fase === "piano" && DB.activities.filter(a => a.partner_id === paoloR.proprietario && a.tipo === "piano").length === 1, "piano +1, Paolo a Piano fatto");
// un piano sempre con una persona: niente più «Senza nome: conta solo il piano»
await page.click("button[data-act=piano-rapido]");
check(await page.locator(".sheet h2", { hasText:"Un piano: con chi?" }).isVisible() && await page.locator("#cerca-piano").isVisible()
  && await page.locator(".sheet form[data-form=piano-nuovo] input[name=nome]").isVisible(), "+ Piano: si sceglie una persona o si scrive il nome");
check(!(await page.locator(".sheet button[data-act=senza-nome]").count()) && !(await page.locator(".sheet", { hasText:"Senza nome" }).count()), "+ Piano: niente più «Senza nome»");
await page.click(".sheet form[data-form=piano-nuovo] button.primary");
check((await page.locator(".sheet form[data-form=piano-nuovo] .errore").innerText()) === "Scrivi il nome, oppure scegli una persona qui sopra.", "+ Piano senza persona: chiede il nome");
await page.click(".sheet button[data-act=chiudi]");
await page.locator("#sheet .sheet").waitFor({ state:"detached" });
check(await page.locator("button[data-act=piano-rapido] b").innerText() === "1 questa sett.", "chiuso senza scegliere: nessun piano in più");
check(!(await page.locator("ul.oggi").count()), "Diario di oggi chiuso di base");
await apriDiario(page);
const oggiCard = page.locator(".card.diario");
check(await oggiCard.getByText("Contatto: Paolo Rapido").isVisible() && await oggiCard.getByText("Piano mostrato: Paolo Rapido").isVisible(),
  "Oggi: contatto e piano con il nome della persona");
await apriOrdini(page);
check(await page.locator(".sheet .scelta-ordini").allInnerTexts().then(l => l.map(t => t.split("\n")[0])).then(l => l.join("|"))
  === "Le mie bozze|I miei ordini|Ordini dal sito Amway", "063: + Ordine apre il foglio Ordini: Le mie bozze · I miei ordini · Ordini dal sito Amway");
check(!(await page.locator(".sheet button[data-act=ordine], .sheet button[data-act=totale-mese]").count()) && !(await page.locator(".sheet input[name=vp]").count()),
  "063: niente più Ordine veloce né Aggiorna il totale: nessun modo di scrivere i VP a mano");
await page.click(".sheet button[data-act=chiudi]");
// 063: i VP vengono solo dalla mappa Amway: senza la mappa del mese nessuna cifra, mai uno zero
check(await page.locator("button[data-act=ordini] b").first().innerText() === "nessuna mappa", "063: senza la mappa del mese, sotto + Ordine «nessuna mappa»");
check(await page.locator(".cruscotto .anello b.num").innerText() === "—"
  && await page.locator(".cruscotto .mappa-riga > span").innerText() === "VP: nessuna mappa di " + new Intl.DateTimeFormat("it-IT", { timeZone:"Europe/Rome", month:"long" }).format(new Date()),
  "063: anello senza mappa: «—» e «nessuna mappa di [mese]»");
const mappaAnna = await mappaIn(page, anna.id, 62.5);
await page.locator("button[data-act=ordini] b", { hasText:"62,5 VP · mese" }).waitFor();
check(await page.locator(".cruscotto .anello b.num").innerText() === "62,5" && await page.locator(".cruscotto .mappa-riga > span").innerText() === "VP: mappa " + delGiornoIt(mappaAnna.dati_al),
  "063: i VP della mappa nell'anello, con la data della mappa");
check(await page.getByText("Primi clienti").first().isVisible(), "063: primo ordine dalla mappa -> tappa 2");
{ // la tappa «Primi clienti»: il requisito con il suo conteggio, senza «+ Cliente»
  await sync(page); await apriTappa(page);
  const cl = Math.min(3, DB.activities.filter(a => a.partner_id === anna.id && a.tipo === "cliente").reduce((t, a) => t + (a.quantita || 1), 0));
  const reqC = page.locator("ul.req li", { hasText:"I tuoi primi 3 clienti" });
  check(await reqC.isVisible() && (await reqC.locator(".num").innerText()) === cl + " / 3", "percorso: «I tuoi primi 3 clienti» con il conteggio (" + cl + " / 3)");
  check(!(await page.locator("ul.req", { hasText:"I tuoi primi 3 clienti" }).locator("button").count()), "percorso: niente più «+ Cliente» accanto al requisito");
  await page.locator("button[data-act=apri-tappa]").first().click();
}
await page.click(".cruscotto .mappa-riga .aiuto-btn");
check((await page.locator(".cruscotto .aiuto-testo").innerText()).trim() === "I VP sono quelli ufficiali di Amway, dall'ultima mappa importata (anche da chi ti segue). "
  + "Le bozze ti aiutano a preparare gli ordini e la chiusura del mese, ma non cambiano i VP.", "063: il «?» dei VP con il testo di Stefano");
await page.click(".cruscotto .mappa-riga .aiuto-btn");

// 2b. Il mio mese: + VP e niente struttura nella pagina Io
check(!(await page.locator(".miei-numeri button[data-act=ordine], .miei-numeri button[data-act=totale-mese], .miei-numeri button[data-act=importa]").count()),
  "nel mio mese niente più + Ordine, Aggiorna il totale, Importa");
// 063: una mappa più recente (anche importata da chi sta sopra) cambia i VP del mese: su a 100, poi giù a 80
await mappaIn(page, anna.id, 100);
await page.locator("button[data-act=ordini] b", { hasText:"100 VP · mese" }).waitFor(); check(true, "063: la mappa nuova porta i VP a 100");
const mappaAnna2 = await mappaIn(page, anna.id, 80);
await page.locator("button[data-act=ordini] b", { hasText:"80 VP · mese" }).waitFor(); check(true, "063: e poi a 80, sempre e solo dalla mappa");
await apriMese(page); check(await page.locator(".card", { hasText:"Il mio mese" }).getByText("/ 100").isVisible(), "obiettivo invariato");
check(await page.locator(".card.mio-mese .vp-report").innerText() === "Mappa " + delGiornoIt(mappaAnna2.dati_al), "063: in «Il mio mese» la data della mappa");
{ /* «mappa dell'8 …», «del 1° …», «dell'11 …» */
  const nomeM = new Intl.DateTimeFormat("it-IT", { timeZone:"Europe/Rome", month:"long" }).format(new Date()), dett = [];
  for(const [g, t] of [["08", "dell'8"], ["01", "del 1°"], ["11", "dell'11"]]){
    await mappaIn(page, anna.id, 80, null, { dati_al:meseOra() + "-" + g + "T10:00:00Z" });
    await page.locator(".cruscotto .mappa-riga", { hasText:`VP: mappa ${t} ${nomeM}` }).waitFor({ timeout:5000 }).then(() => dett.push(t)).catch(() => {});
  }
  check(dett.length === 3, "063: «mappa dell'8 …», «del 1° …», «dell'11 …» (" + dett.join(", ") + ")");
}
await apriMese(page); await page.locator(".card", { hasText:"Il mio mese" }).screenshot({ path: S + "/e2e/7-mese.png" });
check(!(await page.getByText("La mia struttura").count()), "struttura non nella pagina Io");
await page.click("button[data-act=vista-profilo]");
check(await page.getByText("Il mio link personale").isVisible(), "link personale nel Profilo (omino in alto a destra)");
await page.click("button[data-act=vista-io]");
check(!(await page.locator("button[data-act=menu]").count()), "niente più menu ⋯");

// 3. Struttura: niente inserimenti a mano, si importa il report Amway (pagina Gruppo)
const oggiCsv = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date());
const meseFile = oggiCsv.slice(0, 4) + oggiCsv.slice(5, 7);
const csvRiga = v => v.map(x => `"${x}"`).join(",");
const testaCsv = ["Qualifica Amway Partner","Codice Amway Partner Sponsor","Codice Amway Partner","Paese","Nome","Data di ingresso","Telefono","Email",
  "Indirizzo","Data di rinnovo","VPG","VPP","VP reso","Percentuale di bonus","VVG","VP Cliente","VP Rubino"," Clienti"];
const persona = (liv, sp, cod, nome, vpp) => [String(liv), "'" + sp, "'" + cod, "'Italia", "'" + nome, "'01 gennaio 2020", "'Principale: +39 000", "'x@esempio.it",
  "'Citta | XX | 00000 | Italia", "'31 dicembre 2026", "'1.234,56", "'" + vpp, "0", "'0%", "1234.56", "'0,00", "0", "'0"];
const creaCsv = (mese, righe) => "﻿" + [csvRiga(["Amway","CONFIDENZIALE - REPORT DI PROVA"]), csvRiga(["Mese di competenza", mese]), csvRiga(testaCsv)]
  .concat(righe.map(csvRiga)).join("\n");
const scegliFile = async (pg, nome, testo, daGruppo) => {
  /* l'import sta in Gruppo (e nel promemoria di Io): se la pagina aperta non lo ha, si va in Gruppo */
  /* «Importa da Amway» apre subito la scelta dei file: in Gruppo c'è sempre */
  if(!(await pg.locator(".sheet").count()) && !(await pg.locator("input.file-amway").count())) await pg.click("button[data-act=vista-gruppo]");
  await mettiFile(pg, { name:nome, mimeType:"text/csv", buffer:Buffer.from(testo) });
};
/* 033: chi è appena entrato è "in attesa della mappa" finché un report della upline non lo mostra */
check(await page.locator(".primi-passi .stato-attesa").isVisible(), "chi è appena entrato è in attesa della mappa (riga in Primi passi)");
/* come dopo l'import della sua upline: confermato e messo al suo posto dalla mappa del mese in corso (046: mappa_mese) */
const confermaCodice = async (pg, codice) => pg.evaluate(([c, m]) => { const p = window.__DB.partners.find(x => x.codice_amway === c); p.confermato_il = new Date().toISOString();
  p.mappa_mese = m; }, [codice, new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date()).slice(0, 7) + "-01"]);
await confermaCodice(page, "2000001");   // come dopo l'import della sua upline
await page.click("button[data-act=vista-gruppo]");
await page.getByText("Il mio gruppo").first().waitFor();
check(!(await page.locator(".azioni").count()), "niente barra azioni nella pagina Gruppo");
check(await page.getByText("Invita un nuovo partner").isVisible(), "invito nella pagina Gruppo");
check(await page.getByText("Ancora nessuno nel tuo gruppo").isVisible(), "gruppo vuoto");
check(!(await page.locator("button[data-act=aggiungi]").count()), "niente più + Aggiungi persona");
await scegliFile(page, "anna.csv", creaCsv(meseFile, [persona(1, "9", "2000001", "BIANCHI, ANNA", "80,00"),
  persona(2, "2000001", "1000001", "ROSSI, MARCO", "0,00"), persona(3, "1000001", "1000002", "VERDI, LUCA", "12,50")]), true);
/* l'import è diretto: niente anteprima, niente spunte né consenso; alla fine il riepilogo */
await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
check(await page.locator(".sheet .imp-nuovi", { hasText:"Nuove nella tua struttura · 2" }).getByText("Luca Verdi (1000002)").isVisible(),
  "import diretto: 2 persone nuove, entrano tutte, elencate nel riepilogo");
check(!(await page.locator(".sheet input[name=nascondi], .sheet input[name=consenso], .sheet form[data-form=importa]").count()),
  "niente anteprima: né caselle da spuntare né consenso né pulsante Importa");
await page.screenshot({ path: S + "/e2e/26-importa.png", fullPage:true });
await page.getByText(/2 persone aggiunte/).waitFor(); check(true, "import: 2 persone aggiunte");
await page.click(".sheet button[data-act=chiudi]");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).locator(".pallino-app.no[aria-label='senza app']").isVisible()
  && !await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).locator(".pill", { hasText:"senza app" }).count(), "Marco senza app nella struttura: il pallino grigio, niente scritta");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).getByText("0 VP · gruppo 1.234,56").isVisible(), "numeri accanto al nome: VP di gruppo dal report");
check(await page.getByText("2 persone", { exact:true }).isVisible(), "conteggio persone del gruppo");
check((await page.locator(".testata .mappa-gruppo").innerText()).startsWith("VP: mappa del"), "063: in cima al Gruppo una sola data, quella della mappa");
await sync(page);
const marco = DB.partners.find(p => p.nome === "Marco Rossi"), luca = DB.partners.find(p => p.nome === "Luca Verdi");
check(marco.sponsor_id === anna.id && luca.sponsor_id === marco.id && marco.gestore_id === anna.id && luca.codice_amway === "1000002",
  "posizioni del report, importate da Anna");
check(DB.partners.find(p => p.id === anna.id).codice_amway === "2000001", "codice di Anna invariato");
await page.screenshot({ path: S + "/e2e/2-struttura.png", fullPage:true });
// scheda di Marco: inserisco i suoi numeri
await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).locator("button[data-act=apri-scheda]").click();
await page.getByText("Scheda partner").waitFor();
check(await page.getByText("importata da te dal report Amway: la vedi solo tu").isVisible(), "scheda di chi è importato");
check(!(await page.locator("button[data-act=in-mezzo]").count()) && !(await page.locator("button[data-act=manda-link]").count())
  && !(await page.locator("button[data-act=cambia-sponsor]").count()), "niente più Manca qualcuno sopra, link personale, cambia sponsor");
check(!(await page.locator(".azioni").count()), "niente barra delle mie azioni nella scheda");
await azioniScheda(page);
check(!(await page.locator(".griglia-azioni button[data-act=ordine], .griglia-azioni button[data-act=totale-mese]").count())
  && await page.locator(".griglia-azioni button").count() === 3, "063: nella scheda di chi non ha l'app solo + Contatto, + Piano, + Cliente (niente VP a mano)");
await page.locator(".griglia-azioni button[data-act=contatto]").click();
await page.getByText("Contatto registrato per Marco").waitFor();
check(await page.locator(".oggi li", { hasText:"Contatto" }).getByText("inserito da te").isVisible(), "ogni dato mostra chi l'ha inserito");
await sync(page);
check(DB.activities.filter(a => a.partner_id === marco.id).length === 1, "i dati sono di Marco, non miei");
// 063: i VP di chi non ha l'app vengono dalla mappa, con la sua data
await page.click("button[data-act=scheda-tab][data-tab=numeri]");
check(await page.locator(".dati-scheda div", { hasText:"VP personali" }).locator("b").innerText() === "0"
  && (await page.locator(".mappa-scheda").innerText()).startsWith("VP: mappa del"), "063: nella scheda di Marco i VP della mappa con la data della mappa");
await azioniScheda(page);
await page.screenshot({ path: S + "/e2e/11-scheda-gestito.png", fullPage:true });
// 041: Anna (nella mappa) invita Marco dalla voce «Invita» della pagina Gruppo
await page.locator("button[data-act=vista-gruppo]").first().click();
await page.waitForTimeout(1500);   // finiti i salvataggi in corso: un ridisegno svuoterebbe i campi del foglio
/* scrive nei campi del foglio e controlla che ci siano ancora (un ridisegno in arrivo li svuoterebbe: si riscrivono) */
const compila = async campi => { for(let t = 0; t < 4; t++){ for(const [sel, v] of campi) await page.fill(sel, v); await page.waitForTimeout(200);
  const ok = await Promise.all(campi.map(([sel, v]) => page.inputValue(sel).then(x => x === v))); if(ok.every(Boolean)) return; } };
await page.locator(".card.invita button[data-act=invita]").click();
await page.locator(".sheet h2", { hasText:"Invita un nuovo partner" }).waitFor();
await page.click(".sheet button.primary");
check(await page.locator(".sheet .errore").innerText() === "Scrivi nome e cognome della persona.", "Invita: serve il nome");
await compila([[".sheet input[name=nome]", "Marco Rossi"], [".sheet input[name=codice_amway]", "1000001"], [".sheet input[name=codice_amway2]", "1000010"]]);
await page.click(".sheet button.primary");
check(await page.locator(".sheet .errore").innerText() === "I due codici non sono uguali: controllali.", "Invita: i due codici devono essere uguali");
await compila([[".sheet input[name=nome]", "Marco Rossi"], [".sheet input[name=codice_amway]", "2000001"], [".sheet input[name=codice_amway2]", "2000001"]]);
await page.click(".sheet button.primary");
check(await page.locator(".sheet .errore").innerText() === "Con questo codice Amway c'è già qualcuno che usa l'app.", "Invita: non si invita chi usa già l'app");
await compila([[".sheet input[name=nome]", "Marco Rossi"], [".sheet input[name=codice_amway]", "1000001"], [".sheet input[name=codice_amway2]", "1000001"]]);
await page.click(".sheet button.primary");
await page.locator(".sheet h2", { hasText:"Il link per Marco Rossi" }).waitFor();
const linkMarco = await page.locator(".sheet .linkbox").innerText();
check(/#invito=[0-9a-f]{32}$/.test(linkMarco) && !linkMarco.includes("1000001") && !/marco/i.test(linkMarco),
  "041: nel link solo un codice casuale, né nome né codice Amway");
const waMarco = decodeURIComponent((await page.locator(".sheet a.btn.wa").getAttribute("href")).replace("https://wa.me/?text=", ""));
check(waMarco.startsWith("Ciao Marco! Sono Anna: ti mando Growup") && waMarco.includes("vale 7 giorni") && waMarco.endsWith("\n\n" + linkMarco),
  "Invita: il messaggio per WhatsApp con il nome, i tre passi e il link");
await page.screenshot({ path: S + "/e2e/21b-invito-link.png" });
await page.click(".sheet button[data-act=chiudi]");
const rigaMarco = await page.locator(".card.invita li", { hasText:"Marco Rossi" }).innerText(); check(rigaMarco.includes("Aperto fino al"), "Invita: l'invito è nella lista, aperto " + JSON.stringify(rigaMarco));
await sync(page);
await ctx.close();

// 4. Marco entra con il suo invito: ritrova il suo profilo (era già nella mappa di Anna)
({ ctx, page } = await apri({}, linkMarco.slice(linkMarco.indexOf("#"))));
await page.getByText("Ti ha invitato Anna Bianchi").waitFor();
await page.selectOption("select[name=qualifica]", "pin:6");
await page.check("input[name=privacy]");
await page.click("form button.primary");
await perche(page);
await page.getByText("Ciao Marco").waitFor(); await apriTappa(page);
check(await page.getByText("6% raggiunto").isVisible(), "pin di Marco mostrato");
check(await page.getByText("Path to Bronze").first().isVisible(), "pin senza Bronze -> Path to Bronze");
await apriMese(page); check(await page.locator(".card", { hasText:"Il mio mese" }).locator(".vp-report").isVisible(), "033: Marco ha i VP del report importato da Anna (vincono su quelli scritti a mano)");
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).count() === 1, "033: Marco vede Luca sotto di sé, anche se l'ha importato Anna");
await page.click("button[data-act=vista-io]");
check(!(await page.getByText("3 nuove prime linee").count()) && !(await page.getByText("iscritte dal").count()), "Path to Bronze senza vincolo di data");
await page.screenshot({ path: S + "/e2e/4-marco.png", fullPage:true });
await sync(page); await ctx.close();
check(DB.partners.find(p => p.nome === "Marco Rossi").id === marco.id && DB.partners.find(p => p.nome === "Marco Rossi").stato === "attivo"
  && DB.partners.filter(p => p.nome === "Marco Rossi").length === 1, "Marco ha preso il suo profilo: ora usa l'app, nessun doppione");

// 5. Partner già avviato con pin 12%: niente data obbligatoria
({ ctx, page } = await apri({}, invitoPer("R", "Bea Verdi", "2000005")));
await page.getByText("Benvenuto in Growup").waitFor();
await page.selectOption("select[name=qualifica]", "pin:12");
check(await page.getByText("(facoltativa)").isVisible(), "data facoltativa per chi ha già un pin");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await perche(page);
await page.getByText("Ciao Bea").waitFor(); await apriTappa(page);
check(await page.getByText("12% raggiunto").isVisible(), "pin 12% mostrato");
await sync(page); await ctx.close();

// 6. Bronze Foundation con pagamenti (regressione)
({ ctx, page } = await apri({}, invitoPer("R", "Ciro Neri", "2000006")));
await page.getByText("Benvenuto in Growup").waitFor();
await page.selectOption("select[name=qualifica]", "foundation_9");
check(await page.locator("input[name=mese]").isVisible(), "campi pagamenti visibili");
/* tre mesi prima del mese in corso: «restano 15 mesi su 18» vale qualunque giorno giri il test */
await page.fill("input[name=mese]", (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 7); })());
await page.fill("input[name=pagamenti]", "3");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await perche(page);
await page.getByText("Ciao Ciro").waitFor(); await apriTappa(page);
check(await page.getByText("Pagamenti 3 di 12, restano 15 mesi su 18").isVisible(), "pagamenti");
await page.screenshot({ path: S + "/e2e/5-avviato.png", fullPage:true });
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "niente scroll orizzontale");
await sync(page); await ctx.close();

// 7. Radice (privacy non ancora accettata) entra con il link personale
({ ctx, page } = await apri({ colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
await page.getByText("Il tuo profilo è già pronto").waitFor();
/* informativa (3 novembre): conservazione, fornitori, reclamo al Garante, solo maggiorenni */
check(await page.evaluate(() => { const t = document.querySelector("form[data-form=privacy-primo]").textContent;
    return ["Per quanto.", "dopo 12 mesi", "Supabase", "GitHub", "Cloudflare", "Garante per la protezione dei dati personali", "almeno 18 anni"].every(x => t.includes(x)); }),
  "l'informativa dice per quanto si tengono i dati, chi aiuta, il reclamo al Garante e solo maggiorenni");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await perche(page);
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isVisible()
  && await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).count() > 0, "033: la radice vede anche le persone importate da Anna (una sola struttura)");
// niente conferme: Bea (pin 12%) ha dichiarato un punto di partenza, lo sponsor lo vede soltanto
check(!(await page.locator("button[data-act=conferma]").count()), "nessuna conferma del punto di partenza");
check(await page.locator(".in-attesa li", { hasText:"Bea Verdi" }).isVisible() && !(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).count()),
  "033: chi è appena entrato è «In attesa della mappa», fuori dalla struttura");
await sync(page); await ctx.close();
/* 12 novembre 2026: chi entra da avviato (qui senza data di iscrizione) trova il Seguimi acceso dopo «Da dove parti?».
   I test che seguono guardano «Il mio giorno» senza Seguimi (il loro Seguimi lo accendono da sé): si riparte senza righe. */
check(JSON.stringify((DB.seguimi || []).filter(x => x.partner_id === "R")) === JSON.stringify([{ partner_id:"R", attivo:true, condividi:false }]),
  "avviato al primo ingresso (la radice, senza data di iscrizione): Seguimi acceso, «condividi» spento");
DB.seguimi = []; DB.seguimiGiorni = [];
DB.partners.find(p => p.nome === "Bea Verdi").confermato_il = new Date().toISOString();   // come dopo un import della mappa
({ ctx, page } = await apri({ colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.screenshot({ path: S + "/e2e/46-io-scuro.png", fullPage:true });
await page.click(".sezioni-io button[data-sez=guida]"); await page.locator(".guida-stabilita").waitFor();
await page.screenshot({ path: S + "/e2e/47-verifica-scuro.png", fullPage:true });
await page.click("button[data-act=vista-profilo]"); await page.locator(".guida-seguimi").waitFor();
await page.screenshot({ path: S + "/e2e/47-profilo-scuro.png", fullPage:true });
await page.click("button[data-act=vista-io]"); await page.click(".sezioni-io button[data-sez=giorno]");
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).locator("button[data-act=apri-scheda]").click();
check(await page.getByText("Punto di partenza dichiarato: 12%").isVisible() && !(await page.locator("button[data-act=conferma]").count()),
  "scheda: punto di partenza solo come informazione");
await page.click("button.link[data-act=vista-gruppo]");
// ognuno corregge il proprio, dal fondo della pagina
await page.click("button[data-act=vista-profilo]");
await page.click("button[data-act=partenza]");
check(await page.locator(".sheet select[name=qualifica]").inputValue() === "", "il dichiarato è già selezionato");
await page.selectOption(".sheet select[name=qualifica]", "pin:3");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Punto di partenza aggiornato").waitFor();
await sync(page);
check(DB.partners.find(p => p.id === "R").percentuale_iniziale === 3, "il proprio punto di partenza corretto");
await page.click("button[data-act=vista-profilo]");
await page.click("button[data-act=partenza]");
await page.selectOption(".sheet select[name=qualifica]", "");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Punto di partenza aggiornato").waitFor();
await sync(page);
await page.click("button[data-act=vista-gruppo]");
// la radice importa la sua rete, tutta (anche Zeno con 0 VP); Bea è di Ciro secondo il report
const reportRadice = creaCsv(meseFile, [persona(1, "9", "1111111", "ROSSI, MARIO", "120,00"),
  persona(2, "1111111", "2000001", "BIANCHI, ANNA", "80,00"), persona(3, "2000001", "1000003", "NERI, PAOLO", "10,00"),
  persona(3, "2000001", "1000001", "ROSSI, MARCO", "150,00"), persona(4, "1000001", "1000002", "VERDI, LUCA", "5,00"),
  persona(2, "1111111", "2000006", "NERI, CIRO", "0,00"), persona(3, "2000006", "2000005", "VERDI, BEA", "0,00"),
  persona(2, "1111111", "3000000", "ZERO, ZENO", "0,00")]);
await scegliFile(page, "radice.csv", reportRadice, true);
await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
check(await page.locator(".sheet .imp-spostati").getByText("Bea Verdi (da te a Ciro Neri)").isVisible(),
  "riepilogo: Bea va sotto il suo sponsor del report");
await page.getByText(/2 persone aggiunte/).waitFor(); check(true, "la radice importa tutta la sua rete (Luca c'è già: una sola struttura)");
await page.click(".sheet button[data-act=chiudi]");
await sync(page);
const idDi = n => DB.partners.find(p => p.nome === n).id;
check(DB.partners.find(p => p.nome === "Bea Verdi").sponsor_id === idDi("Ciro Neri"), "Bea sotto Ciro, come nel report");
check(DB.partners.filter(p => p.codice_amway === "1000002").length === 1, "033: Luca è uno solo, aggiornato dall'ultimo import");
const lucaR = DB.partners.find(p => p.codice_amway === "1000002");
check(lucaR.sponsor_id === marco.id && DB.partners.find(p => p.nome === "Paolo Neri").sponsor_id === anna.id,
  "chi usa l'app resta sotto chi usa l'app: Luca sotto Marco, Paolo sotto Anna");
const zeno = DB.partners.find(p => p.codice_amway === "3000000");
check(zeno && !(DB.nascosti || []).some(x => x.nascosto_id === zeno.id) && await page.locator(".albero.struttura li", { hasText:"Zeno Zero" }).count() === 1,
  "la mappa fa fede: anche Zeno (0 VP) entra ed è visibile, l'import non nasconde nessuno");
// al secondo import nessuna persona nuova
await scegliFile(page, "radice.csv", reportRadice, true);
await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
check(!(await page.locator(".sheet .imp-nuovi").count()), "secondo import: nessuna persona nuova");
await page.click(".sheet button[data-act=chiudi]");
// Zeno lo nascondo io, dalla sua scheda (solo per me: l'import non nasconde più nessuno)
await page.locator(".albero.struttura li", { hasText:"Zeno Zero" }).locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
await page.click("button[data-act=nascondi]");
await page.getByText("Zeno Zero nascosto dalla tua struttura").waitFor();
check(!(await page.locator(".albero.struttura li", { hasText:"Zeno Zero" }).count()) && await page.getByText("1 persona nascosta").isVisible(),
  "Zeno nascosto a mano: non si vede nella struttura, 1 persona nascosta");

// livelli come nei report Amway, gruppi richiudibili
const rigaLuca = page.locator(".albero.struttura li", { hasText:"Luca Verdi" });
check(await rigaLuca.locator(".livello").innerText() === "4" && !(await rigaLuca.innerText()).includes("sponsor"), "Luca: livello 4, senza la dicitura sponsor");
check(await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator(".livello").innerText() === "2", "Anna, frontale: livello 2");
check(await page.locator(".albero.struttura li").first().locator(".livello").innerText() === "1"
  && (await page.locator(".albero.struttura li").first().innerText()).includes("Stefano e Alessia"), "in cima chi usa l'app: livello 1");
await page.screenshot({ path: S + "/e2e/22-livelli.png", fullPage:true });
await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator("button[data-act=piega]").click();
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isHidden() && await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isHidden(),
  "gruppo di Anna richiuso: Marco e Luca nascosti");
check((await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator("button[data-act=piega]").innerText()).trim() === "▸ 3", "Anna: ▸ 3");
// la ricerca trova anche dentro un gruppo richiuso: solo le persone trovate, con la loro linea e il loro sponsor
await page.fill("#cerca-struttura", "lùca");
const rigaLucaR = page.locator(".albero.struttura li", { hasText:"Luca Verdi" });
check(await rigaLucaR.isVisible() && await page.locator(".albero.struttura li:visible").count() === 1,
  "ricerca: solo Luca, la persona trovata");
check((await rigaLucaR.locator(".percorso").innerText()).trim() === "Linea di Anna Bianchi › Marco Rossi (sponsor)", "ricerca: sotto Luca la sua linea e il suo sponsor");
check((await page.locator("#cerca-esito").innerText()).startsWith("1 persona trovata"), "ricerca: 1 persona trovata");
await page.screenshot({ path: S + "/e2e/23-ricerca.png" });
await page.fill("#cerca-struttura", "anna");
check((await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator(".percorso").innerText()).trim() === "Tuo frontale"
  && await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator("button[data-act=piega]").isHidden(),
  "ricerca: un frontale è «Tuo frontale», niente frecce durante la ricerca");
check(await page.locator("#cerca-struttura").inputValue() === "anna", "ricerca: il testo cercato resta");
await page.fill("#cerca-struttura", "zzz");
check(await page.getByText("Nessuno con questo nome nel tuo gruppo.").isVisible(), "ricerca senza risultati");
await page.fill("#cerca-struttura", "");
check(await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isHidden(), "ricerca vuota: torna com'era");
await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator("button[data-act=piega]").click();
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isVisible(), "gruppo riaperto");
// nascondi: sparisce solo Ciro (per la radice); Bea, sotto di lui, resta con il suo livello vero, e Ciro si rimette
await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
await page.click("button[data-act=nascondi]");
await page.getByText("Ciro Neri nascosto dalla tua struttura").waitFor();
check(!(await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).count()) && await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).isVisible(),
  "nascosto solo Ciro: Bea, sotto di lui, resta visibile");
check(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).locator(".livello").innerText() === "3"
  && !(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).getAttribute("data-path")).includes(idDi("Ciro Neri")),
  "Bea tiene il livello del report e sale sotto il primo sponsor visibile");
await page.click("button[data-act=nascoste]");
check(await page.locator(".sheet li", { hasText:"Ciro Neri" }).getByText("Livello 2 · sotto te · 1 persona sotto").isVisible(), "Rivedi: si vede dove sta la persona");
await page.locator(".sheet li", { hasText:"Ciro Neri" }).locator("button[data-act=mostra]").click();
await page.getByText("Ciro Neri di nuovo nella tua struttura").waitFor();
// dall'elenco si nasconde anche chi è visibile
await page.click(".sheet button[data-filtro=visibili]");
await page.locator(".sheet li", { hasText:"Bea Verdi" }).locator("button[data-act=nascondi-qui]").click();
await page.getByText("Bea Verdi nascosto dalla tua struttura").waitFor();
await page.click(".sheet button[data-act=chiudi]");
check(await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isVisible() && !(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).count()),
  "Ciro di nuovo visibile, Bea nascosta dall'elenco");
// struttura completa: le nascoste al loro posto, in grigio, e si rimettono dalla riga
await page.click("button[data-act=con-nascoste]");
check(await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isVisible() && !(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).isVisible()),
  "struttura completa: parte con i gruppi chiusi");
await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).locator("button[data-act=piega]").click();
check(await page.locator(".albero.struttura li.nascosta", { hasText:"Bea Verdi" }).isVisible(), "Mostra anche le nascoste: Bea in grigio al suo posto");
await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).locator("button[data-act=mostra]").click();
await page.getByText("Bea Verdi di nuovo nella tua struttura").waitFor();
await page.click("button[data-act=con-nascoste]");
check(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).isVisible() && !(await page.locator(".albero.struttura li.nascosta").count()),
  "Ciro e Bea di nuovo visibili");
// nessuno cancella: anche le persone importate si nascondono soltanto
await page.locator(".albero.struttura li", { hasText:"Paolo Neri" }).locator("button[data-act=apri-scheda]").click();
check(!(await page.locator("button[data-act=cancella]").count()), "niente più Cancella dalla struttura");
await azioniScheda(page);
await page.click("button[data-act=nascondi]");
await page.getByText("Paolo Neri nascosto dalla tua struttura").waitFor();
await sync(page);
check(DB.partners.some(p => p.nome === "Paolo Neri") && !(await page.locator(".albero.struttura li", { hasText:"Paolo Neri" }).count()), "Paolo nascosto, non cancellato");
await page.click("button[data-act=nascoste]");
check(await page.locator(".sheet li", { hasText:"Zeno Zero" }).isVisible() && await page.locator(".sheet li", { hasText:"Paolo Neri" }).isVisible(), "elenco delle nascoste");
await page.locator(".sheet li", { hasText:"Paolo Neri" }).locator("button[data-act=apri-nascosta]").click();
await azioniScheda(page);
check(await page.getByText("Mostra di nuovo nella mia struttura").isVisible(), "dalla scheda di una nascosta: Mostra di nuovo");
await page.click("button.link[data-act=vista-gruppo]");
// admin: nuovo link personale per chi usa l'app
await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
await page.getByText("Usa l'app: contatti e piani li aggiorna lui; i VP arrivano dalla mappa.").waitFor();
check(!(await page.locator(".griglia-azioni").count()), "nessun inserimento per chi usa l'app");
await page.click("button[data-act=nuovo-link]");
await page.getByText("Il link di Anna Bianchi").waitFor();
check(await page.getByText("il link vecchio non funziona più").isVisible(), "nuovo link per chi l'ha perso");
await page.screenshot({ path: S + "/e2e/12-scheda-admin.png", fullPage:true });
await page.screenshot({ path: S + "/e2e/6-radice-scuro.png", fullPage:true });
await ctx.close();

// 8. Fase 2: numeri del gruppo nella pagina Io (radice con 3 linee)
const oggiStr = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date());
const mesePrec = (() => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCDate(0); return d.toISOString().slice(0, 7); })();
DB.partners = [DB.partners.find(p => p.id === "R")];
DB.partners[0].privacy_accettata_il = "2026-10-01T00:00:00Z";
DB.accessi = []; DB.activities = []; DB.goals = []; DB.mgoals = []; DB.storico = []; DB.anonDisattivo = false; DB.numeri = [];
const P = (id, nome, sponsor, codice) => DB.partners.push({ id, nome, sponsor_id:sponsor, stato:"gestito", gestore_id:"R", codice_invito:id.toUpperCase() + "XXXX", codice_amway:codice });
P("l1", "Linea Uno", "R", "7000011"); P("l1b", "Sotto Uno", "l1", "7000012"); P("l2", "Linea Due", "R", "7000021"); P("l3", "Linea Tre", "R", "7000031");
/* 063: i VP solo dalle mappe (un ordine scritto a mano non conta più: c'è, ma non cambia niente) */
const O = (pid, vp, tipo) => DB.activities.push({ id:"a" + DB.activities.length, partner_id:pid, tipo:tipo || "ordine", quantita:1, vp, data:oggiStr, inserito_il:new Date().toISOString() });
O("R", 999);
const lineeR = (a, b, c) => [{ codice:"7000011", vpg:a }, { codice:"7000021", vpg:b }, { codice:"7000031", vpg:c }];
mappa("R", 120, 570, { percentuale:3, linee:lineeR(250, 120, 80) }); mappa("l1", 150, 250, { linee:[{ codice:"7000012", vpg:100 }] }); mappa("l1b", 100); mappa("l2", 120); mappa("l3", 80);
for(let i = 0; i < 3; i++) DB.activities.push({ id:"c" + i, partner_id:"R", tipo:"cliente", quantita:1, data:oggiStr });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
check(await page.locator(".miei-numeri .riga-apri", { hasText:"Path to Bronze" }).isVisible(), "radice alla tappa Path to Bronze");
check(await page.locator(".req li", { hasText:"3 linee frontali" }).getByText("2 / 3").isVisible(), "linee attive vere: 2 su 3");
check(await page.locator(".spinta").innerText() === "Linee attive: 2 su 3. Manca 1 linea da 100 VP per il Path to Bronze.", "linee mancanti come dato, senza consiglio");
check(await page.locator(".linee li", { hasText:"Linea Uno" }).getByText("250 VP").isVisible(), "VP di gruppo della linea 1 (150 + 100)");
check(await page.getByText("3% questo mese").isVisible(), "percentuale del mese: 570 VP = 3%");
await apriMese(page); check(await page.locator(".mio-mese .blocco-numeri").getByText("570").isVisible(), "VP di gruppo nel mio mese");
await page.screenshot({ path: S + "/e2e/8-gruppo-ptb.png", fullPage:true });
// la scheda di un partner: le sue linee frontali con il titolo; chi è nella struttura si apre toccando il nome
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Linea Uno" }).first().locator("button[data-act=apri-scheda]").first().click();
check(await page.getByText("Le sue linee frontali").isVisible(), "scheda partner: il titolo sopra le linee frontali");
await page.locator(".linee button[data-act=apri-scheda]", { hasText:"Sotto Uno" }).click();
await page.locator(".card h2", { hasText:"Sotto Uno" }).waitFor();
check(true, "toccando il nome di una linea si apre la sua scheda");
check(await page.locator("button[data-act=scheda-indietro]", { hasText:"Indietro" }).isVisible() && await page.locator("button[data-act=vista-gruppo]", { hasText:"Il mio gruppo" }).isVisible(),
  "scendendo lungo una linea: Indietro e Il mio gruppo");
await page.click("button[data-act=scheda-indietro]");
await page.locator(".card h2", { hasText:"Linea Uno" }).waitFor();
check(!(await page.locator("button[data-act=scheda-indietro]").count()), "Indietro torna alla scheda di prima");
await page.locator(".linee button[data-act=apri-scheda]", { hasText:"Sotto Uno" }).click();
await page.locator(".card h2", { hasText:"Sotto Uno" }).waitFor();
await page.evaluate(() => { const el = document.querySelector("#app");
  const t = (tipo, x) => { const k = new Touch({ identifier:1, target:el, clientX:x, clientY:400 });
    el.dispatchEvent(new TouchEvent(tipo, { bubbles:true, cancelable:true, touches:tipo === "touchend" ? [] : [k], changedTouches:[k] })); };
  t("touchstart", 80); t("touchend", 320); });
await page.locator(".card h2", { hasText:"Linea Uno" }).waitFor();
check(true, "con il dito si torna alla scheda di prima");
await page.click("button[data-act=vista-gruppo]");
await sync(page); await ctx.close();
// la terza linea arriva a 120: Path to Bronze fatto; poi tanti VP su una sola linea: 9% ma non Foundation
mappa("R", 120, 1310, { percentuale:9, linee:lineeR(950, 120, 120) }); mappa("l1", 150, 950, { linee:[{ codice:"7000012", vpg:800 }] }); mappa("l1b", 800); mappa("l3", 120);
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
check(await page.getByText("✓ Path to Bronze").isVisible(), "Path to Bronze riconosciuto dai numeri");
check(await page.getByText("9% questo mese").isVisible(), "1.310 VP di gruppo = 9%");
check(await page.getByText(/9% raggiunto · Bronze Foundation 9% non qualificato: mancano 2 linee da almeno 200 VP/).isVisible(), "percentuale e qualifica distinte");
await page.screenshot({ path: S + "/e2e/9-distinti.png", fullPage:true });
await sync(page); await ctx.close();
// storico: un mese chiuso da Bronze Foundation 9% -> tappa successiva e pagamenti
/* 063: lo storico viene dalle mappe dei mesi passati */
mappa("R", 150, 1300, { mese:mesePrec, percentuale:9, linee:lineeR(600, 300, 400) });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
check(await page.locator(".miei-numeri .riga-apri", { hasText:"Bronze Foundation 12%" }).isVisible(), "dopo un mese da Foundation 9% si punta al 12%");
check(await page.getByText(/Pagamenti 1 di 12, restano 17 mesi su 18/).isVisible(), "pagamenti contati dallo storico");
await apriMese(page); await page.click("button[data-act=storico]");
await page.getByText("Il mio storico").waitFor();
check(await page.locator(".storico li").count() >= 2, "storico: mese chiuso e mese in corso");
check(await page.locator(".storico li", { hasText:"chiuso" }).getByText("Bronze Foundation 9%").isVisible(), "qualifica del mese chiuso");
await page.screenshot({ path: S + "/e2e/10-storico.png" });
await page.click(".sheet button:has-text('Chiudi')");
await ctx.close();

// 9. Blocco 3: imbuto ed etichette
DB.partners = [DB.partners.find(p => p.id === "R")];
DB.activities = []; DB.goals = []; DB.mgoals = []; DB.storico = [];
const giorniFa = n => { const d = new Date(oggiStr + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const Q = (id, nome, agg) => DB.partners.push({ id, nome, sponsor_id:"R", stato:"attivo", codice_invito:id.toUpperCase() + "YYYY",
  ultimo_aggiornamento:giorniFa(agg) + "T10:00:00Z", creato_il:giorniFa(60) + "T10:00:00Z", partenza_confermata_il:"2026-10-01" });
const A = (pid, tipo, n, vp) => { for(let i = 0; i < n; i++) DB.activities.push({ id:"x" + DB.activities.length, partner_id:pid, tipo, quantita:1,
  vp: vp != null ? vp : null, data:giorniFa(i % 20), inserito_il:new Date().toISOString() }); };
Q("rosa", "Rosa Ferma", 20); Q("lino", "Lino Lista", 1); Q("ivo", "Ivo Invito", 1); Q("fede", "Fede Followup", 1); Q("cri", "Cri Crescita", 1);
DB.partners.push({ id:"gino", nome:"Gino Senza App", sponsor_id:"R", stato:"gestito", gestore_id:"R", codice_invito:"GINOYY",
  ultimo_aggiornamento:giorniFa(30) + "T10:00:00Z", creato_il:giorniFa(60) + "T10:00:00Z", partenza_confermata_il:"2026-10-01" });
A("lino", "contatto", 3);
A("ivo", "contatto", 25); A("ivo", "piano", 2);
A("fede", "contatto", 22); A("fede", "piano", 6); A("fede", "ordine", 1, 70);   // 063: l'ordine scritto non conta, solo la mappa (20)
A("cri", "contatto", 25); A("cri", "piano", 6); A("cri", "ordine", 2, 60);
/* 063: per tutti i VP sono quelli della mappa (gli ordini a mano no) */
DB.numeri = [{ visto_da:"R", partner_id:"cri", mese:oggiStr.slice(0, 7), vpp:120, vpg:120, percentuale:null, linee:[], dati_al:new Date().toISOString() }];
mappa("fede", 20);
DB.persone = (DB.persone || []).concat([{ id:"pv1", proprietario:"ivo", nome:"Nome Uno", fase:"lista", esito:null },
  { id:"pv2", proprietario:"ivo", nome:"Nome Due", fase:"invitato", esito:null }]);
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
await page.getByText("Preferiti").first().waitFor();
check(await page.getByText("Situazione per persona").count() === 0, "la sezione Situazione per persona non c'è più");
check(await page.locator(".albero.struttura li", { hasText:"Gino Senza App" }).isVisible(), "Gino resta nella struttura");
check(await page.locator(".card", { hasText:"Preferiti" }).getByText("Segna le persone che vuoi seguire da vicino").isVisible(), "preferiti: vuoto, con la spiegazione");
check(await page.locator(".imbuto").count() === 0, "l'imbuto non c'è più");
// segno Ivo (usa l'app) e Gino (senza app) come preferiti dalla loro scheda
for(const nome of ["Ivo Invito", "Gino Senza App"]){
  await page.locator(".albero.struttura li", { hasText:nome }).locator("button[data-act=apri-scheda]").click();
  await page.locator("button[data-act=preferito]").click();
  await page.getByText(`${nome} nei preferiti`).waitFor();
  check((await page.locator("button[data-act=preferito]").innerText()).trim() === "★", `${nome}: ★ nella scheda`);
  await page.click("button.link[data-act=vista-gruppo]");
}
await sync(page);
check(DB.preferiti.length === 2 && DB.preferiti.every(x => x.partner_id === "R"), "preferiti salvati nel database");
const pref = page.locator(".card", { hasText:"Preferiti" });
const prefIvo = pref.locator("li.preferito", { hasText:"Ivo Invito" });
check(await prefIvo.getByText("Piani sotto soglia").isVisible() && await prefIvo.locator(".obiettivo.debole", { hasText:"Piani" }).isVisible()
  && (await prefIvo.locator(".obiettivo", { hasText:"Contatti" }).locator(".num").innerText()).trim() === "25 / 40", "Ivo nei preferiti: 25 / 40 contatti, piani sotto soglia evidenziati");
await prefIvo.getByText("La sua lista").waitFor();
check(/La sua lista: 1 in lista · 1 in corso · questo mese 0 piani, 0 partner e 0 clienti nuovi · 0 clienti in tutto/.test((await prefIvo.innerText()).replace(/\s+/g, " ")) && !/Nome Uno|Nome Due/.test(await prefIvo.innerText()), "Ivo nei preferiti: i numeri della sua lista, senza nomi");
const prefGino = pref.locator("li.preferito", { hasText:"Gino Senza App" });
check(await prefGino.getByText("senza app · VP dalla mappa").isVisible() && await prefGino.locator(".obiettivo.debole").count() === 0
  && !(await prefGino.getByText("La sua lista").count()), "Gino nei preferiti: senza etichetta e senza lista");
await page.screenshot({ path: S + "/e2e/14-preferiti.png", fullPage:true });
// tolgo Gino
await prefGino.locator("button[data-act=apri-scheda]").click();
await page.locator("button[data-act=preferito]").click();
await page.getByText("Gino Senza App tolto dai preferiti").waitFor();
await page.click("button.link[data-act=vista-gruppo]");
check(await pref.locator("li.preferito").count() === 1, "Gino tolto dai preferiti");
check(!/allenate|lavorate|costruisci|da chiamare|collo di bottiglia/i.test(await page.locator("#app").innerText()), "nessun consiglio nella pagina Gruppo");
await ctx.close();
// le etichette, in ordine di urgenza, nei preferiti (Gino è senza app: niente etichetta)
DB.preferiti = ["rosa", "lino", "ivo", "fede", "cri", "gino"].map(id => ({ partner_id:"R", preferito_id:id }));
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
const etich = await page.locator(".card", { hasText:"Preferiti" }).locator("li.preferito").allInnerTexts();
const etichettaDi = nome => (etich.find(t => t.includes(nome)) || "");
check(etichettaDi("Rosa").includes("Non aggiorna") && etichettaDi("Rosa").includes("ultimo aggiornamento 20 giorni fa"), "Rosa: Non aggiorna");
check(etichettaDi("Lino").includes("Contatti sotto soglia"), "Lino: Contatti sotto soglia");
check(etichettaDi("Ivo").includes("Piani sotto soglia"), "Ivo: Piani sotto soglia");
check(etichettaDi("Fede").includes("VP sotto soglia"), "Fede: VP sotto soglia");
check(etichettaDi("Cri").includes("In crescita"), "Cri: In crescita");
check(!/sotto soglia|In crescita|Non aggiorna/.test(etichettaDi("Gino")), "Gino senza app: niente etichetta");
check(etich[0].includes("Rosa") && etich[etich.length - 1].includes("Gino"), "preferiti ordinati per urgenza");
await page.locator(".card", { hasText:"Preferiti" }).locator("button[data-act=apri-scheda]").first().click();
await page.getByText("Scheda partner").waitFor(); check(true, "dai preferiti si apre la scheda");
await ctx.close();
DB.preferiti = [];

// 10. Blocco 4: nella scheda, questo mese e il mese prima
DB.activities = DB.activities.filter(a => a.partner_id !== "cri");
const ultimoPrec = (() => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCDate(0); return d.toISOString().slice(0, 10); })();
const B = (tipo, n, data, vp) => { for(let i = 0; i < n; i++) DB.activities.push({ id:"z" + DB.activities.length, partner_id:"cri", tipo, quantita:1,
  vp: vp != null ? vp : null, data, inserito_il:new Date().toISOString() }); };
B("contatto", 2, oggiStr.slice(0, 7) + "-01"); B("piano", 1, oggiStr.slice(0, 7) + "-01");
B("contatto", 5, mesePrec + "-01"); B("contatto", 3, ultimoPrec); B("ordine", 1, mesePrec + "-01", 80);
DB.numeri = [{ visto_da:"R", partner_id:"cri", mese:oggiStr.slice(0, 7), vpp:0, vpg:0, percentuale:null, linee:[], dati_al:new Date().toISOString() },
  { visto_da:"R", partner_id:"cri", mese:mesePrec, vpp:80, vpg:80, percentuale:null, linee:[], dati_al:new Date().toISOString() }];
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
await page.getByText("Questo mese e il mese prima").waitFor();
const riga = async nome => (await page.locator(".confronto tr", { hasText:nome }).locator("td").allInnerTexts()).map(t => t.trim());
const rc = await riga("Contatti");
check(rc.length === 3 && rc[1] === "2" && rc[2] === "8", "contatti: 2 questo mese, 8 il mese prima (solo due colonne) (" + rc.join("|") + ")");
const rp = await riga("Piani");
check(rp[1] === "1" && rp[2] === "0", "piani: questo mese e il mese prima");
const rv = await riga("VP personali");
check(rv[1] === "0" && rv[2] === "80", "034: VP personali di chi ha l'app dal report: questo mese e il mese prima (" + rv.join("|") + ")");
check(!(await riga("Ordini")).length, "034: gli ordini a mano di chi ha l'app non si vedono");
check(await page.locator(".confronto thead th").count() === 3 && !(await page.locator(".confronto td.sotto").count()),
  "niente più colonna «al giorno» del mese prima e niente ▼: solo questo mese e il totale del mese prima");
await page.screenshot({ path: S + "/e2e/15-confronto.png", fullPage:true });

// 11. Fissa una chiamata: calendario e WhatsApp neutro
await azioniScheda(page);
await page.click("button[data-act=chiamata]");
await page.getByText("Chiamata con Cri").waitFor();
const domani = (() => { const d = new Date(oggiStr + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
check(await page.locator(".sheet input[name=data]").inputValue() === domani && await page.locator(".sheet input[name=ora]").inputValue() === "21:00", "proposta: domani alle 21");
await page.fill(".sheet input[name=ora]", "20:30");
await page.selectOption(".sheet select[name=durata]", "45");
await page.selectOption(".sheet select[name=avviso]", "60");
await page.fill(".sheet textarea[name=note]", "Numeri del mese, prossimo piano");
await page.screenshot({ path: S + "/e2e/16-chiamata.png" });
const [scaricato] = await Promise.all([page.waitForEvent("download"), page.click(".sheet button:has-text('Calendario')")]);
const ics = fs.readFileSync(await scaricato.path(), "utf8");
check(/^chiamata-cri-crescita-[a-z0-9]+\.ics$/.test(scaricato.suggestedFilename()), "nome del file .ics, diverso ogni volta (" + scaricato.suggestedFilename() + ")");
const [inizioUtc, fineUtc] = await page.evaluate(d => { const t = new Date(d + "T20:30:00"), f = x => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [f(t), f(new Date(t.getTime() + 45 * 60000))]; }, domani);
check(ics.includes("BEGIN:VEVENT") && ics.includes("SUMMARY:Chiamata con Cri Crescita") && ics.includes("DTSTART:" + inizioUtc) && ics.includes("DTEND:" + fineUtc), "evento: titolo, inizio e durata");
check(ics.includes("TRIGGER:-PT60M") && ics.includes("DESCRIPTION:Numeri del mese\\, prossimo piano") && ics.includes("\r\n"), "promemoria, note e formato");
await page.evaluate(() => { window.__aperto = null; window.open = u => { window.__aperto = u; return null; }; });
await page.click(".sheet button[data-act=chiamata-wa]");
const wa = await page.evaluate(() => window.__aperto);
const giornoIt = new Intl.DateTimeFormat("it-IT", { weekday:"long", timeZone:"UTC" }).format(new Date(domani + "T00:00:00Z"));
check(wa && wa.startsWith("https://wa.me/?text=") && decodeURIComponent(wa.split("text=")[1]).startsWith("Ciao Cri, ci sentiamo " + giornoIt + " ")
  && decodeURIComponent(wa.split("text=")[1]).endsWith(" alle 20:30?"), "WhatsApp: messaggio neutro (" + (wa ? decodeURIComponent(wa.split("text=")[1]) : "") + ")");
await ctx.close();

// 11b. Android: si apre la scelta dell'app di calendario; iPhone: il file si apre senza scaricarlo
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
({ ctx, page } = await apri({ userAgent:UA_ANDROID }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.evaluate(() => { window.__vai = null; window.GROWUP_VAI = u => { window.__vai = u; }; });
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
await page.click("button[data-act=chiamata]");
check(await page.locator(".sheet select[name=avviso]").count() === 0, "Android: niente scelta del promemoria");
await page.fill(".sheet input[name=ora]", "20:30");
await page.click(".sheet button:has-text('Calendario')");
const gcal = await page.evaluate(() => window.__vai);
const [gIni, gFine] = await page.evaluate(d => { const t = new Date(d + "T20:30:00"), f = x => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [f(t), f(new Date(t.getTime() + 30 * 60000))]; }, domani);
check(gcal === "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Chiamata%20con%20Cri%20Crescita&dates=" + gIni + "/" + gFine,
  "Android: Google Calendar con la chiamata compilata (" + gcal + ")");
const [scaricatoA] = await Promise.all([page.waitForEvent("download"), page.click(".sheet button[data-act=chiamata-ics]")]);
check(scaricatoA.suggestedFilename().endsWith(".ics"), "Android: resta il file come riserva");
await ctx.close();
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
({ ctx, page } = await apri({ userAgent:UA_IPHONE }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.evaluate(() => { window.__vai = null; window.GROWUP_VAI = u => { window.__vai = u; }; });
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
await page.click("button[data-act=chiamata]");
check(await page.locator(".sheet select[name=avviso]").count() === 1, "iPhone: promemoria nel file");
await page.click(".sheet button:has-text('Calendario')");
const blobIcs = await page.evaluate(async () => window.__vai && window.__vai.startsWith("blob:") ? await (await fetch(window.__vai)).text() : "");
check(blobIcs.includes("SUMMARY:Chiamata con Cri Crescita") && blobIcs.includes("TRIGGER:-PT30M"), "iPhone: il file si apre senza scaricarlo");
await page.fill(".sheet input[name=data]", "2020-01-01");
await page.click(".sheet button:has-text('Calendario')");
check(await page.getByText("Il giorno e l'ora sono già passati.").isVisible(), "niente chiamate nel passato");
await ctx.close();

// 12. Storico del gruppo: i mesi chiusi e il dettaglio per persona
const mese2 = (() => { const d = new Date(mesePrec + "-01T00:00:00Z"); d.setUTCDate(0); return d.toISOString().slice(0, 7); })();
/* 063: lo storico del gruppo viene dalle mie mappe dei mesi passati */
mappa("R", 100, 300, { mese:mese2, percentuale:3, linee:[{ codice:"9990001", vpg:300 }] });
mappa("R", 0, 80, { mese:mesePrec, linee:[{ codice:"9990002", vpg:80 }] });
DB.activities.push({ id:"st1", partner_id:"lino", tipo:"ordine", quantita:1, vp:50, data:mese2 + "-10", inserito_il:new Date().toISOString() });
DB.numeri.push({ visto_da:"R", partner_id:"lino", mese:mese2, vpp:50, vpg:50, percentuale:null, linee:[], dati_al:new Date().toISOString() });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
await page.getByText("Storico del gruppo").waitFor();
await page.locator(".card", { hasText:"Storico del gruppo" }).screenshot({ path: S + "/e2e/17a-storico-card.png" });
const mesi = await page.locator(".confronto.mesi tbody tr").allInnerTexts();
check(mesi.length === 2 && /80\s+0\s+–/.test(mesi[0]) && /300\s+1\s+3%/.test(mesi[1]), "storico: mesi chiusi, il più recente in alto (" + mesi.join(" | ") + ")");
await page.locator(".confronto.mesi tbody tr").first().locator("td").nth(1).click();
await page.locator(".sheet .storico li").first().waitFor();
const det = await page.locator(".sheet .storico li").allInnerTexts();
check(det[0].startsWith("Cri Crescita") && det[0].includes("80"), "dettaglio: Cri per prima con 80 VP");
const lino = det.find(t => t.startsWith("Lino Lista")) || "";
check(lino.includes("—") && !lino.includes("▼ 0") && lino.includes("50 VP"), "063: dettaglio: Lino senza mappa quel mese (—, mai 0), il mese prima 50 VP");
check(!det.some(t => t.startsWith("Stefano e Alessia")), "nel dettaglio solo il gruppo, non noi");
await page.screenshot({ path: S + "/e2e/17-storico-gruppo.png" });
await ctx.close();

// 13. Installare l'app e incollare il link personale
const PERM = ["clipboard-read", "clipboard-write"];
({ ctx, page } = await apri({ userAgent:UA_IPHONE, permissions:PERM }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=passo-apri][data-k=installa]");
check(await page.getByText("Aggiungi alla schermata Home").first().isVisible(), "iPhone: guida all'installazione (voce di Primi passi)");
await page.screenshot({ path: S + "/e2e/18-installa-iphone.png" });
await page.click("button[data-act=copia-chiave]");
check((await page.evaluate(() => navigator.clipboard.readText())).endsWith("#chiave=" + "a".repeat(32)), "iPhone: link personale copiato");
await page.click("button[data-act=installa-no]");
// (12 novembre 2026: senza «Scrivi 30 nomi», con l'installazione fatta i Primi passi sono tutti fatti e il riquadro sparisce)
check(!(await page.locator(".primi-passi").count()) && !(await page.getByText("Aggiungi alla schermata Home").count()),
  "Non ora: la guida si chiude e la voce è fatta (tutto fatto: Primi passi sparisce)");
await page.click("button[data-act=vista-profilo]");
await page.click("button[data-act=installa-si]");
check(await page.getByText("Aggiungi alla schermata Home").first().isVisible(), "dal fondo pagina si riapre");
check(await page.getByText("Forse hai aperto il link dentro WhatsApp o Telegram").isVisible(), "iPhone in Safari: nota per chi è dentro un'altra app");
await ctx.close();

// 13b. iPhone dentro il browser di Telegram: avviso e passo "Apri in Safari"
({ ctx, page } = await apri({ userAgent:UA_IPHONE + " Telegram-iOS/11.0", permissions:PERM }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=passo-apri][data-k=installa]");
check(await page.getByText("Sei dentro Telegram").isVisible() && await page.getByText("Apri in Safari").isVisible(), "iPhone dentro Telegram: avviso e passo Apri in Safari");
await page.locator(".avviso-interno").screenshot({ path: S + "/e2e/18b-installa-telegram.png" });
await ctx.close();

({ ctx, page } = await apri({ userAgent:UA_ANDROID }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=passo-apri][data-k=installa]");
check(await page.getByText("Installa app").isVisible(), "Android senza proposta del browser: istruzioni dal menu");
await page.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable:true });
  e.prompt = () => { window.__promptato = true; }; e.userChoice = Promise.resolve({ outcome:"accepted" }); window.dispatchEvent(e); });
await page.locator("button[data-act=installa]").waitFor();
await page.screenshot({ path: S + "/e2e/19-installa-android.png" });
await page.click("button[data-act=installa]");
await page.waitForFunction(() => !document.querySelector("button[data-act=installa]"));
check(await page.evaluate(() => window.__promptato) === true, "Android: il pulsante Installa apre la proposta del browser");
check(!(await page.locator(".primi-passi").count()), "installata: la voce è fatta (tutto fatto: Primi passi sparisce)");
await ctx.close();

// app installata (iPhone): ingresso con il link copiato
({ ctx, page } = await apri({ userAgent:UA_IPHONE, permissions:PERM }, ""));
await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value:true }));
await page.reload();
await page.getByText("Entra in Growup").waitFor();
check(await page.getByText("Growup è installata").isVisible(), "app installata: spiega di incollare il link");
await page.screenshot({ path: S + "/e2e/20-incolla.png" });
await page.evaluate(() => navigator.clipboard.writeText("ciao, niente link qui"));
await page.click("button[data-act=incolla-appunti]");
await page.getByText("non è il tuo link personale").waitFor({ timeout:5000 }).catch(() => {});
check(await page.getByText("non è il tuo link personale").isVisible(), "testo sbagliato negli appunti");
await page.evaluate(k => navigator.clipboard.writeText("Il mio link Growup: http://127.0.0.1:8765/growup-team/#chiave=" + k), "a".repeat(32));
await page.click("button[data-act=incolla-appunti]");
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page); check(true, "incolla il link: entra");
check(!(await page.locator(".voci-passi li:not(.fatta) button[data-k=link]").count()) && !(await page.locator(".voci-passi li:not(.fatta) button[data-k=installa]").count()),
  "dopo l'incolla: niente richiesta di salvare il link né guida all'installazione");
await ctx.close();

// 14. Invito: anteprima del link, testo con il nome e i tre passi, immagini da inviare
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
check(await page.locator('meta[property="og:image"]').getAttribute("content") === "https://cl21-aes.github.io/growup-team/anteprima.png", "anteprima del link: immagine");
await page.click("button[data-act=vista-gruppo]");
const cardInvita = page.locator(".card.invita");
check(await cardInvita.locator("button[data-act=invita]").isVisible() && !(await cardInvita.locator(".linkbox, a.wa").count()),
  "041: nella pagina Gruppo il pulsante «Invita», nessun link d'invito generico");
// un invito si annulla e si rigenera
await page.waitForTimeout(1000);
await cardInvita.locator("button[data-act=invita]").click();
await page.locator(".sheet h2", { hasText:"Invita un nuovo partner" }).waitFor();
await compila([[".sheet input[name=nome]", "Prova Annulla"], [".sheet input[name=codice_amway]", "2111111"], [".sheet input[name=codice_amway2]", "2111111"]]);
await page.click(".sheet button.primary");
await page.locator(".sheet h2", { hasText:"Il link per Prova Annulla" }).waitFor();
const linkAnnulla = await page.locator(".sheet .linkbox").innerText();
const waR = decodeURIComponent((await page.locator(".sheet a.btn.wa").getAttribute("href")).replace("https://wa.me/?text=", ""));
check(waR.startsWith("Ciao Prova! Siamo Stefano e Alessia: ti mandiamo Growup") && waR.includes("3. Installa l'app"), "invito: nome, tre passi e link");
await page.click(".sheet button[data-act=chiudi]");
await cardInvita.locator("li", { hasText:"Prova Annulla" }).locator("button[data-act=annulla-invito]").click();
await page.getByText("Invito annullato").waitFor();
check((await cardInvita.locator("li", { hasText:"Prova Annulla" }).innerText()).includes("Annullato"), "041: l'invito annullato resta nella lista come «Annullato»");
await cardInvita.locator("li", { hasText:"Prova Annulla" }).locator("button[data-act=rigenera-invito]").click();
await page.locator(".sheet h2", { hasText:"Il link per Prova Annulla" }).waitFor();
const linkNuovo = await page.locator(".sheet .linkbox").innerText();
check(linkNuovo !== linkAnnulla && /#invito=[0-9a-f]{32}$/.test(linkNuovo), "041: «Nuovo link» crea un link diverso");
await page.click(".sheet button[data-act=chiudi]");
check((await cardInvita.locator("li", { hasText:"Prova Annulla" }).innerText()).includes("Aperto fino al"), "041: rigenerato, l'invito è di nuovo aperto");
await sync(page);
const ctxVecchio = await apri({}, linkAnnulla.slice(linkAnnulla.indexOf("#")));
await ctxVecchio.page.getByText("Link non valido").waitFor(); check(true, "041: il link vecchio non vale più");
await ctxVecchio.ctx.close();
check(await page.locator("button[data-act=condividi-immagine]").count() === 2, "invito: due immagini da inviare");
check((await page.evaluate(async () => (await fetch("invito-stato.png")).status)) === 200, "immagine per lo stato pubblicata");
await page.locator(".card", { hasText:"Invita un nuovo partner" }).screenshot({ path: S + "/e2e/21-invito.png" });
await ctx.close();

// 15. Trascinare il dito: Io ⇄ Gruppo
({ ctx, page } = await apri({ hasTouch:true, isMobile:true }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
const trascina = (x1, x2, y1 = 400, y2 = 400, su = "#app") => page.evaluate(([x1, x2, y1, y2, su]) => {
  const el = document.querySelector(su);
  const tocca = (tipo, x, y) => { const t = new Touch({ identifier:1, target:el, clientX:x, clientY:y });
    el.dispatchEvent(new TouchEvent(tipo, { bubbles:true, cancelable:true, touches: tipo === "touchend" ? [] : [t], changedTouches:[t] })); };
  tocca("touchstart", x1, y1); tocca("touchend", x2, y2);
}, [x1, x2, y1, y2, su]);
check((await page.locator(".schede button").allInnerTexts()).join(" | ") === "Obiettivo | Io | Persone | Gruppo", "pagine in ordine: Obiettivo | Io | Persone | Gruppo");
await trascina(320, 80);
check(await page.locator(".testata h1").innerText() === "Persone", "verso sinistra: da Io a Persone");
await trascina(320, 80);
check(await page.getByText("Il mio gruppo").first().isVisible(), "verso sinistra: da Persone a Gruppo");
await trascina(80, 320);
check(await page.locator(".testata h1").innerText() === "Persone", "verso destra: da Gruppo a Persone");
await trascina(80, 320);
check(await page.getByText("Ciao Stefano e Alessia").isVisible(), "verso destra: da Persone a Io");
await trascina(80, 320);
check(await page.locator(".testata h1").innerText() === "Il mio obiettivo", "verso destra: da Io a Obiettivo");
await trascina(320, 80);
check(await page.getByText("Ciao Stefano e Alessia").isVisible(), "verso sinistra: da Obiettivo a Io");
await trascina(320, 290, 400, 700);
check(await page.getByText("Ciao Stefano e Alessia").isVisible(), "movimento verticale o corto: resta su Io");
await ctx.close();

// 16. Lo sponsor vede cifra, data e tappa dell'obiettivo, mai il perché
DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id === "R").concat([{ partner_id:"cri", cifra_mese:1000, entro:(new Date().getFullYear() + 1) + "-03-01", perche:"Segreto di Cri" }]);
DB.preferiti = [{ partner_id:"R", preferito_id:"cri" }];
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
check(await page.locator("li.preferito", { hasText:"Cri Crescita" }).getByText("Bronze Builder 15%").isVisible(), "preferiti: obiettivo di Cri (1.000 € → Builder 15%)");
await page.locator(".albero.struttura li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
check(await page.getByText("1.000 €/mese").isVisible() && !(await page.locator("#app").innerText()).includes("Segreto di Cri"), "scheda: cifra e tappa, non il perché");
await ctx.close();

// 17. Copia di sicurezza: solo per gli admin
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-profilo]");
check(await page.getByText("Nessuna copia scaricata da questo telefono.").isVisible(), "admin: pulsante della copia dei dati");
const [copia] = await Promise.all([page.waitForEvent("download"), page.click("button[data-act=copia-dati]")]);
const datiCopia = JSON.parse(fs.readFileSync(await copia.path(), "utf8"));
check(copia.suggestedFilename() === `growup-copia-${oggiStr}.json` && datiCopia.app === "Growup Team" && datiCopia.tabelle.partners.length > 3, "copia scaricata con i dati");
check(await page.getByText("Ultima copia da questo telefono").isVisible(), "data dell'ultima copia");
await ctx.close();

// 18. Import dal report Amway (CSV finto con lo stesso formato del vero)
await sync(page).catch(() => {});
DB.partners.find(p => p.id === "R").codice_amway = "1234567"; DB.esclusi = [];
for(const [id, nome, codice] of [["imp-gino","Gino Gestito","3000001"],["imp-ugo","Ugo Uscito","3000004"],["imp-ivo","Ivo Attivo","3000005"]])
  DB.partners.push({ id, nome, sponsor_id:"R", stato:id === "imp-ivo" ? "attivo" : "gestito", gestore_id:"R", codice_amway:codice, codice_invito:"X" + id.toUpperCase(),
    partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
DB.nascosti = (DB.nascosti || []).concat([{ partner_id:"R", nascosto_id:"imp-gino" }]);  // nascosto quando aveva 0 VP
const altriGestiti = DB.partners.filter(p => p.stato === "gestito" && p.gestore_id === "R" && p.codice_amway && !["imp-gino","imp-ugo"].includes(p.id));
const usanoApp = DB.partners.filter(p => p.stato !== "gestito" && p.codice_amway);
const righeCsv = [persona(1, "7654321", "1234567", "ROSSI, MARIO", "400,00"), persona(2, "1234567", "3000001", "GESTITO, GINO", "1.055,50"),
  persona(3, "3000001", "3000099", "NUOVO, NINO", "7,00")]
  .concat(altriGestiti.concat(usanoApp).map(p => persona(3, "1234567", p.codice_amway, p.nome.toUpperCase(), "1,00")));
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await scegliFile(page, "altro.csv", "nome,cognome\nMario,Rossi\n");
await page.locator(".sheet .avviso").waitFor();
check(await page.locator(".sheet .avviso").getByText("altro.csv: non sembra un export Amway").isVisible(), "import: file sbagliato riconosciuto, con il nome");
// «Qualifica Amway Partner» è il livello di profondità: chi importa è la riga con 1, anche se non è la prima del file
const losCsv = creaCsv(meseFile, righeCsv.slice(1).concat([righeCsv[0]]));
const meseVecchio = (() => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 7).replace("-", ""); })();
await scegliFile(page, "vecchio.csv", creaCsv(meseVecchio, righeCsv));
await page.locator(".sheet h2", { hasText:"Numeri salvati" }).waitFor();
check(await page.locator(".sheet .imp-numeri", { hasText:"Mappe di mesi precedenti: salvati solo i numeri, la struttura non cambia" }).isVisible(),
  "import diretto: la mappa di un mese precedente salva subito solo i numeri");
await page.click(".sheet button[data-act=chiudi]");
await mettiFile(page, { name:"report.xlsx", mimeType:"application/octet-stream", buffer:Buffer.from("PK") });
check(await page.locator(".sheet").getByText("sul sito Amway scegli il formato CSV").isVisible(), "import: il file Excel non va, serve il CSV");
await mettiFile(page, { name:"los.csv", mimeType:"text/csv", buffer:Buffer.from(losCsv) });
await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
const sez = t => page.locator(".sheet .imp-sezione", { hasText:t });
check(await sez("Numeri aggiornati").locator("li", { hasText:"Stefano e Alessia (tu)" }).getByText("400 VP").isVisible(),
  "riepilogo: i miei VPP dalla riga di livello 1, anche se è in fondo al file (il livello non è una qualifica)");
check(await sez("Numeri aggiornati").locator("li", { hasText:"Gino Gestito" }).getByText("1.055,5 VP").isVisible(), "riepilogo: Gino, abbinato per codice");
check(await sez("Non più nella mappa").getByText("Ugo Uscito (3000004)").isVisible(), "riepilogo: Ugo non più nella mappa");
check(await sez("Nuove nella tua struttura · 1").getByText("Nino Nuovo").isVisible(), "riepilogo: Nino entra");
await page.getByText(/persone aggiornate.*1 persona non più nella mappa/).waitFor(); check(true, "import fatto subito, senza conferme");
await page.screenshot({ path: S + "/e2e/27-importa-conferme.png", fullPage:true });
await page.click(".sheet button[data-act=chiudi]");
await sync(page);
{
  /* privacy: al database arrivano solo codice, nome, sponsor, data di ingresso e numeri; mai telefono, email, indirizzo o data di rinnovo */
  const inviato = JSON.stringify(DB.ultimoImport || {});
  check(DB.ultimoImport && DB.ultimoImport.p_persone.length > 0 && !/\+39|@|esempio|Citta|Principale|gennaio|dicembre/i.test(inviato)
    && DB.ultimoImport.p_persone.every(r => Object.keys(r).every(k => ["codice","nome","vpp","sponsor","ingresso","vpg","percentuale","linee","nascoste"].includes(k))),
    "privacy: dalla mappa non arrivano al database telefono, email, indirizzo né data di rinnovo");
  check(DB.ultimoImport.p_persone.every(r => r.ingresso === "2020-01-01") && !JSON.stringify(DB.ultimoImport).includes("2026-12-31")
    && DB.partners.find(p => p.id === "imp-gino").data_iscrizione === "2020-01-01",
    "la data di ingresso della mappa si salva (01 gennaio 2020 → 2020-01-01), la data di rinnovo no");
  check(DB.ultimoImport.p_nascondi.length === 0, "l'import non nasconde nessuno");
}
const vppDi = id => DB.activities.filter(a => a.partner_id === id && ["ordine","rettifica"].includes(a.tipo) && a.data.slice(0, 7) === oggiStr.slice(0, 7))
  .reduce((t, a) => t + Number(a.vp), 0);
/* 033: i VPP ufficiali stanno nei numeri del report (vincono sugli ordini scritti a mano) */
const numDi = id => (DB.numeri || []).filter(x => x.partner_id === id && x.mese === oggiStr.slice(0, 7)).pop() || {};
check(DB.partners.find(p => p.id === "R").codice_amway === "1234567" && Math.abs(numDi("R").vpp - 400) < 0.001, "i miei VPP del mese sono quelli del report");
check(numDi("imp-gino").vpp === 1055.5, "VPP delle persone importate");
check(DB.nascosti.some(x => x.nascosto_id === "imp-gino"), "l'import non tocca chi ho nascosto io: Gino resta nascosto");
check(DB.partners.find(p => p.id === "imp-ugo").fuori_report_dal && !(await page.locator(".albero.struttura li", { hasText:"Ugo Uscito" }).count()),
  "050: Ugo non è più nella mappa: esce dalla struttura e non si vede più");
check(!DB.activities.some(a => a.tipo === "rettifica" && a.inserito_da === "R" && usanoApp.some(p => p.id === a.partner_id)), "nessun dato di chi usa l'app toccato");
const nRett = DB.activities.filter(a => a.tipo === "rettifica").length;
await scegliFile(page, "los.csv", losCsv);
await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
check(!(await sez("Non più nella mappa").count()) && !(await sez("Nuove nella tua struttura").count()), "reimport: niente di nuovo");
await page.click(".sheet button[data-act=chiudi]");
await sync(page);
check(DB.activities.filter(a => a.tipo === "rettifica").length === nRett, "reimport dello stesso file: nessun dato nuovo");
await scegliFile(page, "di-altri.csv", creaCsv(meseFile, [persona(1, "1", "7777777", "ALTRO, ALDO", "1")]));
await page.locator(".sheet .errore").waitFor();
check(await page.locator(".sheet .errore").getByText("il tuo codice nell'app è 1234567").isVisible()
  && await page.locator(".sheet .errore").getByText("correggilo in fondo alla pagina Io").isVisible(), "import: il report di un altro partner è rifiutato (admin: correggi)");
check(await page.locator(".sheet").getByText("Telefono, email, indirizzo e data di rinnovo non si salvano mai.").isVisible(), "import: la privacy è scritta nel foglio");
await page.click(".sheet button[data-act=chiudi]");
await page.click("button[data-act=vista-gruppo]");
// Gino l'avevo nascosto io: lo rimetto dall'elenco delle nascoste (l'import non cambia le mie scelte)
await page.click("button[data-act=nascoste]");
await page.locator(".sheet li", { hasText:"Gino Gestito" }).locator("button[data-act=mostra]").click();
await page.getByText("Gino Gestito di nuovo nella tua struttura").waitFor();
await page.click(".sheet button[data-act=chiudi]");
await page.locator(".albero.struttura li", { hasText:"Gino Gestito" }).locator("button[data-act=apri-scheda]").click();
await page.getByText("Scheda partner").waitFor();
{
  /* chi non usa l'app ma è nella mappa del mese: i VP personali del mese in corso sono quelli della mappa, non zero */
  const rigaVp = page.locator("table.confronto tr", { hasText:"VP personali" });
  check((await rigaVp.locator("td").nth(1).innerText()).includes("1.055,5"),
    "confronto: chi non usa l'app ha i VP personali del mese dalla mappa (non 0)");
}
const testoScheda = await page.locator("#app").innerText();
check(testoScheda.includes("Codice Amway 3000001") && !(await page.locator(".card button[data-act=codice]").count()), "scheda: codice Amway, senza modifica per chi è importato");
await page.click("button.link[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Ivo Attivo" }).locator("button[data-act=apri-scheda]").click();
await page.click(".card button[data-act=codice]");
await page.fill(".sheet input[name=codice_amway]", "1234567");
await page.click(".sheet button:has-text('Salva')");
check(await page.locator(".sheet .errore").innerText() === "Questo codice Amway è già di un'altra persona nell'app.", "codice già usato: rifiutato");
await page.click(".sheet button[data-act=chiudi]");
await ctx.close();

// 19. Numeri ufficiali dal report, Platino e inviti degli admin
await sync(page).catch(() => {});
const testa2 = testaCsv.concat(["Punti al livello successivo", "Linee qualificate", "Dimensioni gruppo"]);
const riga2 = (liv, sp, cod, nome, vpp, vpg, perc, dim) => [String(liv), "'" + sp, "'" + cod, "'Italia", "'" + nome, "'01 gennaio 2020", "'x", "'x", "'x", "'x",
  "'" + vpg, "'" + vpp, "0", "'" + perc + "%", "0", "'0,00", "0", "'0", "0", "0", "'" + dim];
const csv2 = righe => "﻿" + [csvRiga(["Amway","CONFIDENZIALE"]), csvRiga(["Mese di competenza", meseFile]), csvRiga(testa2)].concat(righe.map(csvRiga)).join("\n");
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
await scegliFile(page, "platino.csv", csv2([riga2(1, "1", "1234567", "ROSSI, MARIO", "120,00", "9.500,00", 18, 163),
  riga2(2, "1234567", "4100001", "PLATINI, BIANCA", "0,00", "5.300,00", 15, 191),
  riga2(2, "1234567", "4000011", "UNO, LINEA", "0,00", "700,00", 3, 4), riga2(2, "1234567", "4000012", "DUE, LINEA", "0,00", "650,00", 3, 3)]), true);
await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
await page.getByText(/3 persone aggiunte/).waitFor();
await page.click(".sheet button[data-act=chiudi]");
check(await page.locator(".albero.struttura li", { hasText:"Bianca Platini" }).getByText("gruppo 5.300").isVisible(), "Platino: VP di gruppo dal report");
await page.locator(".albero.struttura li", { hasText:"Bianca Platini" }).locator("button[data-act=apri-scheda]").click();
check(await page.getByText("Linee non visibili nella mappa").isVisible() && await page.locator(".dati-scheda").getByText("15%").isVisible(), "scheda del Platino: 15%, linee non visibili");
await azioniScheda(page);
check(!(await page.locator(".card", { hasText:"Inviti · solo admin" }).count()) && !(await page.locator("button[data-act=invito-sopra]").count()),
  "041: niente più inviti degli admin nella scheda (né sotto una persona né «chi manca sopra»)");
await sync(page);
const bianca = DB.partners.find(p => p.codice_amway === "4100001");
await page.screenshot({ path: S + "/e2e/28-platino.png", fullPage:true });
await page.click("button[data-act=vista-io]");
check(await page.locator(".tappa-aperta .pill", { hasText:/^mappa del/ }).first().isVisible() && await page.getByText("18% questo mese").isVisible(), "pagina Io: percentuale ufficiale dalla mappa, con la data");
await ctx.close();
// Nora entra con l'invito della radice: resta in attesa finché la mappa non la mette sotto Bianca
({ ctx, page } = await apri({}, invitoPer("R", "Nora Sotto", "4000002")));
await page.getByText("Ti hanno invitato Stefano e Alessia").waitFor();
await page.fill("input[name=data]", oggiStr); await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Da dove parti?").waitFor();
await sync(page); await ctx.close();
const nora = DB.partners.find(p => p.nome === "Nora Sotto");
check(nora.sponsor_id === "R" && nora.stato === "attivo" && !nora.confermato_il, "041: Nora entra in attesa sotto chi l'ha invitata");
nora.sponsor_id = bianca.id; nora.confermato_il = new Date().toISOString();   // 033: come dopo un import della mappa che la mostra
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Nora Sotto" }).locator(".livello").innerText() === "3", "Nora sotto Bianca nella struttura della radice");
check(await page.locator(".albero.struttura li.io .livello").getAttribute("class") === "livello l0"
  && await page.locator(".albero.struttura li", { hasText:"Nora Sotto" }).locator(".livello").getAttribute("class") === "livello l2",
  "grafica 3: il livello 1 (chi guarda) è bianco, il 3 è il secondo colore del ciclo");
check((await page.locator(".card.invita li", { hasText:"Nora Sotto" }).innerText()).includes("al suo posto nella mappa"),
  "041: nei miei inviti Nora risulta al suo posto nella mappa");
await ctx.close();

// 20. Sicurezza: un nome malevolo non diventa codice; la pagina ha la Content Security Policy
DB.partners.push({ id:"xss1", nome:'<img src=x onerror="window.__xss=1">', sponsor_id:"R", stato:"attivo", codice_invito:"XSSAAA",
  codice_amway:"6000001", creato_il:new Date().toISOString(), partenza_confermata_il:new Date().toISOString() });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"<img" }).locator("button[data-act=apri-scheda]").click();
await page.getByText("Scheda partner").waitFor();
await page.locator("button[data-act=preferito]").click();
await page.click("button.link[data-act=vista-gruppo]");
await page.fill("#cerca-struttura", "img");
check(await page.evaluate(() => window.__xss === undefined) && await page.locator(".albero.struttura li", { hasText:"<img src=x" }).isVisible(),
  "un nome con codice HTML si vede come testo e non viene eseguito");
check(/script-src 'self' https:\/\/cdn\.jsdelivr\.net https:\/\/challenges\.cloudflare\.com; frame-src https:\/\/challenges\.cloudflare\.com;/.test(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")),
  "la pagina ha la Content Security Policy");
/* privacy (controllo del 3 novembre): i font stanno nell'app, nessuna richiesta a Google */
check(!/googleapis|gstatic/.test(await page.content()) && /font-src 'self';/.test(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")),
  "nessun font da Google: la pagina non nomina googleapis/gstatic e la CSP permette solo font dell'app");
check(await page.evaluate(async () => { await document.fonts.ready;
    return document.fonts.check("700 16px Manrope") && document.fonts.check("700 20px 'Cormorant Garamond'") &&
      [...document.fonts].some(f => f.family.replace(/["']/g, "") === "Manrope" && f.status === "loaded"); }),
  "i font Manrope e Cormorant Garamond arrivano dall'app");
/* consegna 1 (3 novembre): numeri in Source Serif, pesca solo per l'azione, pagina scelta avorio, pulsanti in basso bianchi */
check(await page.evaluate(async () => { await document.fonts.ready;
    const num = document.querySelector(".num"), cs = el => el ? getComputedStyle(el) : null;
    const prim = document.querySelector(".btn.primary"), on = document.querySelector(".schede button.on"), giu = document.querySelector(".azioni .btn");
    return document.fonts.check("700 20px 'Source Serif 4'")
      && (!num || /Source Serif 4/.test(cs(num).fontFamily))
      && (!prim || cs(prim).backgroundColor === "rgb(240, 138, 75)")
      && (!on || cs(on).backgroundColor === "rgb(247, 240, 227)")
      && (!giu || cs(giu).backgroundColor !== "rgb(240, 138, 75)"); }),
  "grafica di base: numeri in Source Serif, pesca sul pulsante principale, pagina scelta avorio, pulsanti in basso non pesca");
check(await page.evaluate(() => !!(window.supabase && window.supabase.createClient)) &&
    await page.locator('script[src="lib/supabase-2.117.2.js"][integrity^="sha384-"]').count() === 1 &&
    await page.locator('script[src*="jsdelivr"]').count() === 0,
  "la libreria Supabase arriva dall'app (con controllo d'integrità), non da jsDelivr");
await ctx.close();

// 21. Captcha al primo ingresso: il gettone arriva a Supabase; se il controllo fallisce, un messaggio chiaro
DB.captcha = null; DB.captchaKo = false;
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await sync(page);
check(DB.captcha === "tok-prova" && !(await page.locator(".captcha").count()), "primo ingresso: captcha superato, gettone passato all'accesso");
const stato = await ctx.storageState(); await ctx.close(); DB.captcha = null;
({ ctx, page } = await apri({ storageState:stato }));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page); await sync(page);
check(DB.captcha === null, "chi è già dentro non rifà il captcha");
await ctx.close();
DB.captchaKo = true;
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Il controllo di sicurezza non è riuscito").waitFor();
check(!(await page.locator(".captcha").count()), "captcha fallito: messaggio chiaro e nessun accesso");
await ctx.close(); DB.captchaKo = false;

// 22. Persone → la Lista: nomi solo miei, passi che contano le attività, da fare, numeri per l'upline, import
DB.persone = []; DB.passi = [];
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-persone]");
check(await page.getByText("La tua lista è vuota").isVisible(), "Persone: lista vuota con l'invito a scrivere i nomi");
await page.click("button[data-act=persona-nuova]");
await page.fill(".sheet input[name=nome]", "Luigi Verdi"); await page.fill(".sheet input[name=contatto]", "333 1234567");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Luigi Verdi nella tua lista").waitFor();
check(await page.locator(".card", { hasText:"La mia lista" }).isVisible() && !(await page.locator("button[data-act=passo]").count()), "+ Un nome: si resta nella lista");
// l'ultimo nome inserito va in cima; sotto il nome «Come lo conosci»
await page.click("button[data-act=persona-nuova]");
await page.fill(".sheet input[name=nome]", "Aldo Ultimo"); await page.fill(".sheet input[name=origine]", "collega di Roma");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Aldo Ultimo nella tua lista").waitFor();
check((await page.locator("ul.persone li").first().innerText()).includes("Aldo Ultimo")
  && await page.locator("ul.persone li", { hasText:"Aldo Ultimo" }).locator(".origine").innerText() === "collega di Roma",
  "lista: l'ultimo nome inserito è in cima, con «Come lo conosci» sotto il nome");
await page.locator(".card", { hasText:"La mia lista" }).screenshot({ path: S + "/e2e/53-lista-origine.png" });
check(await page.evaluate(() => { const f = document.querySelector(".filtri"); return !!f && getComputedStyle(f).overscrollBehaviorX === "contain"; }),
  "lista: scorrere i filtri non trascina la pagina");
await page.locator("button[data-act=apri-persona]", { hasText:"Luigi Verdi" }).click();
check(await page.locator("button[data-act=passo]").innerText() === "Segna un passo · Contatto", "scheda persona: il passo proposto è il contatto");
const contattiPrima = DB.activities.filter(a => a.partner_id === "R" && a.tipo === "contatto").length;
await page.click("button[data-act=passo]");
await page.click(".sheet label.chip:has-text('Telefono')");
await page.click(".sheet label.chip:has-text('Aperto, incuriosito')");
await page.click(".sheet label.chip:has-text('Domani')");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Contatto segnato").waitFor();
await sync(page);
const luigi = DB.persone.find(x => x.nome === "Luigi Verdi");
check(luigi.fase === "contattato" && luigi.prossima_data > oggiStr && luigi.proprietario === "R", "il contatto porta Luigi a Contattato, con la prossima data");
check(DB.activities.filter(a => a.partner_id === "R" && a.tipo === "contatto").length === contattiPrima + 1, "il contatto è contato da solo nei numeri");
check(await page.locator(".percorso-persona li.qui").innerText() === "Contattato", "il percorso mostra dove è Luigi");
await page.click("button[data-act=vista-io]");
/* consegna 2: Luigi ha la data nei prossimi giorni → nella riga «Prossimi giorni e in corso» della lista di oggi */
const cardIo = page.locator(".card.oggi-lista");
await apriDopo(page);
check(await cardIo.getByText("Luigi Verdi").isVisible(), "Io: Luigi, contattato, compare come promemoria");
await cardIo.locator("li", { hasText:"Luigi Verdi" }).locator("button[data-act=togli-da-io]").click();
await page.getByText("Luigi tolto da Io").waitFor();
check(!(await page.locator(".oggi-lista li", { hasText:"Luigi Verdi" }).count()), "tolto da Io: non compare più");
await page.click("button[data-act=vista-persone]");
await page.locator("button[data-act=apri-persona]", { hasText:"Luigi Verdi" }).click();
check(await page.locator("button[data-act=rimetti-in-io]").isVisible(), "nella scheda: Rimetti in Io");
await page.click(".prossima button[data-act=agenda]");
await page.click(".sheet label.chip:has-text('Domani')");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("In agenda: domani").waitFor();
check(await page.locator("button[data-act=togli-da-io]").isVisible(), "fissando una data la persona torna su Io da sola");
await page.click("button[data-act=vista-io]");
await apriDopo(page);
check(await cardIo.getByText("Luigi Verdi").isVisible(), "dalla scheda si rimette in Io");
await cardIo.locator("button[data-act=apri-persona]", { hasText:"Luigi Verdi" }).click();
await page.locator(".prossima").getByText("In agenda", { exact:true }).waitFor();
await page.click("button[data-act=passo]");
await page.click(".sheet button[data-tipo=piano]");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Piano segnato").waitFor();
check(await page.locator("button[data-act=passo]").innerText() === "Segna un passo · Follow-up", "dopo il piano si propone il follow-up");
await page.click("button[data-act=passo]");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Follow-up segnato").waitFor();
check(await page.locator("button[data-act=passo]").innerText() === "Segna un passo · Chiusura", "dopo il follow-up si propone la chiusura");
await page.click("button[data-act=passo]");
await page.click(".sheet button:has-text('Salva')");
check(await page.locator(".sheet .errore").getByText("Scegli com'è finita").isVisible(), "chiusura: serve l'esito");
check(!await page.locator(".sheet [data-per-esito=partner]").isVisible() && !await page.locator(".sheet [data-per-esito=non_ora]").isVisible(), "chiusura: senza esito niente prossima cosa");
await page.click(".sheet label.chip:has-text('Partner')");
check(await page.locator(".sheet [data-per-esito=partner]").isVisible(), "Partner: c'è la prossima cosa");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Chiusura · Partner segnato").waitFor();
await page.click("button[data-act=invita]:has-text('Invitalo in Growup')");
check(await page.locator(".sheet input[name=nome]").inputValue() === "Luigi Verdi", "041: Partner: «Invitalo in Growup» apre Invita con il nome già scritto");
await page.click(".sheet button[data-act=chiudi]");
await sync(page);
const pianiDopo = DB.activities.filter(a => a.partner_id === "R" && a.tipo === "piano").length;
await page.locator(".card", { hasText:"I passi" }).locator("li", { hasText:"Piano" }).locator("button[data-act=togli-passo]").click();
await page.getByText("Passo tolto").waitFor();
await sync(page);
check(DB.activities.filter(a => a.partner_id === "R" && a.tipo === "piano").length === pianiDopo - 1, "togliendo il passo si toglie il piano contato");
// dalla scheda della persona, col dito verso destra si torna alla lista
await page.evaluate(() => { const el = document.querySelector("#app");
  const t = (tipo, x) => { const k = new Touch({ identifier:1, target:el, clientX:x, clientY:400 });
    el.dispatchEvent(new TouchEvent(tipo, { bubbles:true, cancelable:true, touches:tipo === "touchend" ? [] : [k], changedTouches:[k] })); };
  t("touchstart", 80); t("touchend", 320); });
/* la persona era stata aperta da Io: col dito si torna a Io */
await page.locator(".card", { hasText:"Il mio mese" }).waitFor();
check(!(await page.locator("button[data-act=passo]").count()), "scheda persona aperta da Io: col dito si torna a Io");
await page.click("button[data-act=vista-persone]");
check(await page.getByText("Scarica una copia della mia lista").isVisible(), "la copia della lista è un piccolo link");
// chiusure: Non ora (tra quanto e promemoria 2 giorni prima), No (solo la nota), Cliente (esce dalla lista, va nei Clienti)
const chiudi = async (nome, esito) => {
  await page.click("button[data-act=persona-nuova]");
  await page.fill(".sheet input[name=nome]", nome);
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText(`${nome} nella tua lista`).waitFor();
  await page.locator("button[data-act=apri-persona]", { hasText:nome }).click();
  await page.click("button[data-act=passo]");
  await page.click(".sheet button[data-tipo=chiusura]");
  await page.locator(".sheet label.chip").filter({ hasText:new RegExp(`^${esito}$`) }).click();
};
await chiudi("Nina Nonora", "Non ora");
check(await page.locator(".sheet [data-per-esito=non_ora]").isVisible() && !await page.locator(".sheet [data-per-esito=partner]").isVisible()
  && !await page.locator(".sheet input[name=prossima_nota]").isVisible(), "Non ora: tra quanto risentirlo, senza prossima cosa");
await page.click(".sheet label.chip:has-text('1 mese')");
await page.fill(".sheet input[name=nota]", "ora ha il trasloco");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Chiusura · Non ora segnato").waitFor();
await sync(page);
const nina = DB.persone.find(x => x.nome === "Nina Nonora");
const traUnMese = (() => { const d = new Date(oggiStr + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })();
const dueGiorniPrima = (() => { const d = new Date(traUnMese + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 2); return d.toISOString().slice(0, 10); })();
check(nina.esito === "non_ora" && nina.prossima_data === dueGiorniPrima && /da risentire il/.test(nina.prossima_nota)
  && DB.passi.some(x => x.persona_id === nina.id && x.nota === "ora ha il trasloco"), "Non ora: promemoria 2 giorni prima della scadenza, con la nota");
// la nota: solo una finestra, e finisce nei dati della persona
await page.click("button[data-act=passo]");
await page.click(".sheet button[data-tipo=nota]");
check(!await page.locator(".sheet input[name=data]").count() && !await page.locator(".sheet input[name=prossima_nota]").count(), "Nota: solo la finestra della nota");
await page.fill(".sheet textarea[name=nota]", "preferisce essere chiamata la sera");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Nota salvata").waitFor();
await sync(page);
check(/preferisce essere chiamata la sera/.test(DB.persone.find(x => x.id === nina.id).note), "la nota è nei dati della persona");
// i dati si modificano toccando il nome
await page.screenshot({ path: S + "/e2e/33-persona.png" });
check(!await page.locator(".card button[data-act=persona-modifica]", { hasText:"Modifica i dati" }).count(), "niente più pulsante Modifica i dati in fondo");
await page.click("button.nome-modifica");
check(await page.locator(".sheet h2", { hasText:"Modifica i dati" }).isVisible()
  && /preferisce essere chiamata la sera/.test(await page.inputValue(".sheet textarea[name=note]")), "toccando il nome si modificano i dati, con le note");
await page.click(".sheet button[data-act=chiudi]");
check(await page.locator(".card", { hasText:"I passi" }).getByText("preferisce essere chiamata la sera").isVisible(), "la nota compare anche tra i passi della scheda");
await page.click("button[data-act=torna-lista]");
check(await page.locator("button[data-filtro=tutti].on").isVisible() && !await page.locator("button[data-filtro=aperti]").count()
  && await page.locator("button[data-act=apri-persona]", { hasText:"Nina Nonora" }).isVisible(), "Lista: si apre su «Tutti» (niente più «Aperti»), con dentro anche chi è da riprendere");
await page.click("button[data-filtro=corso]");
check(!await page.locator("button[data-act=apri-persona]", { hasText:"Nina Nonora" }).count(), "Non ora: non è tra In corso");
/* grafica 5: i filtri stanno su una riga sola che scorre; i pulsanti in alto su una riga */
{ const f = await page.locator(".filtri button[data-act=filtro-lista]").evaluateAll(l => l.map(b => [b.offsetTop, b.offsetHeight]));
  check(f.length === 5 && f.every(x => x[0] === f[0][0]) && f.every(x => x[1] <= 40), "Lista: i filtri su una riga sola, nessuno va a capo");
  const t = await page.locator(".testa-sezione .pulsanti .btn").evaluateAll(l => l.map(b => b.offsetHeight));
  check(t.length === 2 && t.every(h => h <= 40), "Lista: «Importa» e «+ Nome» senza andare a capo"); }
await page.click("button[data-filtro=riprendere]");
check(await page.locator("button[data-act=apri-persona]", { hasText:"Nina Nonora" }).isVisible(), "Non ora: è in Da riprendere");
await page.click("button[data-filtro=tutti]");
await chiudi("Nico No", "No");
check(!await page.locator(".sheet [data-per-esito=partner]").isVisible() && !await page.locator(".sheet [data-per-esito=non_ora]").isVisible()
  && await page.locator(".sheet input[name=nota]").isVisible(), "No: resta solo la nota");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Chiusura · No segnato").waitFor();
await page.click("button[data-act=torna-lista]");
await chiudi("Carla Compra", "Cliente");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Carla è tra i tuoi clienti").waitFor();
check(await page.locator("button[data-act=ordine-nuovo]").isVisible() && await page.locator("h2", { hasText:"Carla Compra" }).isVisible(), "Cliente: si apre la sua scheda nei Clienti");
await page.click("button[data-act=torna-clienti]");
await page.click("button[data-sez=lista]");
await page.click("button[data-filtro=chiusi]");
check(!await page.locator("button[data-act=apri-persona]", { hasText:"Carla Compra" }).count() && await page.locator("button[data-act=apri-persona]", { hasText:"Nico No" }).isVisible(),
  "il cliente esce dalla lista (i chiusi con No restano)");
await page.click("button[data-filtro=tutti]");
await page.click("button[data-act=persone-tante]");
await page.fill(".sheet textarea[name=righe]", "Marta Neri, 333 999, palestra\nLuigi Verdi");
await page.click(".sheet button:has-text('Aggiungi')");
await page.getByText("1 nome aggiunto").waitFor();
check(await page.getByText("Chiusi · 2").isVisible() && await page.getByText("In lista · 2").isVisible(), "filtri con i conteggi (il cliente non è tra i chiusi)");
check(!(await page.locator(".persone button[data-act=togli-da-io]").count()), "nella lista nessuna × (quella è solo su Io)");
await ctx.close();
// lo sponsor vede solo i numeri della lista di chi sta sotto
const annaId = "lia";
DB.partners.push({ id:annaId, nome:"Lia Lista", sponsor_id:"R", stato:"attivo", codice_invito:"LIALIA", creato_il:new Date().toISOString(),
  ultimo_aggiornamento:new Date().toISOString() });
DB.persone.push({ id:"pa1", proprietario:annaId, nome:"Segreto Uno", fase:"lista", esito:null },
  { id:"pa2", proprietario:annaId, nome:"Segreto Due", fase:"piano", esito:null });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Lia Lista" }).locator("button[data-act=apri-scheda]").first().click();
await page.getByText("La sua lista:").waitFor();
check(await page.getByText(/La sua lista: 1 in lista · 1 in corso/).isVisible() && !(await page.getByText("Segreto").count()),
  "scheda partner: i numeri della sua lista, mai i nomi");
await page.click("button[data-act=vista-persone]");
check(!(await page.getByText("Segreto").count()), "la lista di Lia non compare nella mia");
await page.screenshot({ path: S + "/e2e/30-persone.png", fullPage:true });
await ctx.close();

// 23. Persone → Target: invito, le otto domande del contatto, le risposte che tornano, Metti in lista
DB.inviti = [];
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-persone]");
await page.click("button[data-sez=target]");
check(await page.getByText("Ancora nessun invito").isVisible(), "Target: nessun invito all'inizio");
await page.click("button[data-act=target-nuovo]");
await page.fill(".sheet input[name=nome]", "Carla Nuova");
await page.fill(".sheet input[name=whatsapp]", "333 1234567");
await page.click('.sheet button:has-text("Crea l\'invito")');
await page.getByText("Invito pronto").waitFor();
const hrefWa = await page.locator(".card a.wa:has-text('WhatsApp')").getAttribute("href");
const hrefTg = await page.locator(".card a.tg:has-text('Telegram')").getAttribute("href");
check(hrefTg.startsWith("https://t.me/share/url?url=") && /#t&/.test(decodeURIComponent(hrefTg)) && decodeURIComponent(hrefTg.split("&text=")[1]).includes("otto domande"),
  "Target: si manda anche su Telegram, con il link e il messaggio");
const msgT = decodeURIComponent(hrefWa.split("text=")[1]);
const linkT = msgT.match(/https?:\/\/\S+#t&\S+/)[0];
check(/c=Carla%20Nuova/.test(linkT) && /&e=\d{8}&k=/.test(linkT) && /&t=393331234567/.test(linkT), "il link del contatto: nome, scadenza firmata e il mio numero WhatsApp");
check(await page.evaluate(() => localStorage.getItem("growup-team.whatsapp")) === "393331234567", "il numero resta su questo telefono per i prossimi inviti");
await sync(page);
const statoR = await ctx.storageState(); await ctx.close();
// il contatto: senza accesso, otto domande
const ctxC = await browser.newContext({ viewport:{width:390,height:844}, locale:"it-IT", bypassCSP:true });
await ctxC.route(/cdn\.jsdelivr\.net/, r => r.abort());
await ctxC.route(/challenges\.cloudflare\.com/, r => r.abort());
const pc = await ctxC.newPage();
pc.on("pageerror", e => errori.push(String(e))); fileMancanti(pc);
await pc.addInitScript(([db, m]) => { window.__DB = db; eval(m); }, [DB, mock]);
await pc.goto(BASE + linkT.slice(linkT.indexOf("#")));
await pc.getByText("Ciao Carla").waitFor();
check(await pc.getByText("Te le manda Stefano e Alessia").isVisible(), "il contatto vede chi gliele manda");
await pc.click("button[data-act=ct-via]");
for(const k of [0, 0, 1, 0, 2, 1, 0, 2]) await pc.click(`button[data-act=ct-risposta][data-k="${k}"]`);
await pc.getByText("Grazie, Carla.").waitFor();
const codiceT = await pc.locator(".contatto .nota b").innerText();
await pc.evaluate(() => { window.open = u => { window.__aperto = u; }; });
await pc.click("button[data-act=ct-invia]");
check((await pc.evaluate(() => window.__aperto)).startsWith("https://wa.me/393331234567?text="), "Invia su WhatsApp apre direttamente la chat del partner");
await pc.click("button[data-act=ct-invia-tg]");
check(await pc.evaluate(() => window.__aperto.startsWith("https://t.me/share/url?url=") && decodeURIComponent(window.__aperto).includes("#r=")), "il contatto può rispondere anche su Telegram");
check(/^CL21-[1-3]{8}-\d-[A-Z0-9]{6}$/.test(codiceT), "il contatto ha il codice delle risposte");
check(!(await pc.evaluate(() => JSON.stringify(window.__DBOUT || {}).includes("risposte\":["))), "il contatto non scrive niente nel database");
await ctxC.close();
// il partner apre il link "Apri le risposte" dal messaggio del contatto
({ ctx, page } = await apri({ storageState:statoR }, "#r=" + codiceT));
await page.getByText("Carla Nuova").first().waitFor();
await page.getByText("In target — dagli il piano").waitFor();
check(await page.getByText("28 su 28 punti").isVisible() || await page.getByText(/28\s*su 28 punti/).isVisible(), "le risposte arrivano: in target, 28 su 28");
check(!(await page.locator("details.metodo").getAttribute("open")), "il metodo è chiuso, si apre a richiesta");
await page.click("details.metodo summary");
check(await page.getByText("Cosa dire se l'esito è no").isVisible(), "il riquadro Il metodo si apre");
await sync(page);
const attT = DB.activities.length;
await page.click("button[data-act=target-in-lista]");
await page.getByText("Carla Nuova nella tua lista").waitFor();
await sync(page);
const carla = DB.persone.find(x => x.nome === "Carla Nuova");
check(carla && carla.fase === "contattato" && carla.invito_target_id && DB.activities.length === attT, "Metti in lista: Contattato, con il Target, senza contare di nuovo");
check(await page.getByText(/Target: In target · 28\/28/).isVisible(), "nella scheda della persona l'esito del Target");
// togliendo Carla dalla lista, l'invito resta e si può rimettere in lista
await page.click("button[data-act=persona-cancella]");
await page.getByText("Carla Nuova tolto dalla lista").waitFor();
await page.click("button[data-sez=target]");
await page.locator("button[data-act=apri-invito]", { hasText:"Carla Nuova" }).click();
check(await page.locator("button[data-act=target-in-lista]").isVisible() && !(await page.getByText("Apri nella lista").count()), "tolta dalla lista: si può rimettere in lista");
await page.click("button[data-act=target-in-lista]");
await page.getByText("Carla Nuova nella tua lista").waitFor();
// dalla lista: a chi è già in lista si mandano le 8 domande
await page.click("button[data-act=torna-lista]");
await page.click("button[data-act=persona-nuova]");
await page.fill(".sheet input[name=nome]", "Dario Conosciuto");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Dario Conosciuto nella tua lista").waitFor();
await page.locator("button[data-act=apri-persona]", { hasText:"Dario Conosciuto" }).click();
await page.click("button[data-act=target-da-persona]");
check(await page.locator(".sheet input[name=nome]").inputValue() === "Dario Conosciuto", "Target dalla lista: il nome è già scritto");
await page.click('.sheet button:has-text("Crea l\'invito")');
await page.getByText("Invito pronto").waitFor();
await sync(page);
const dario = DB.persone.find(x => x.nome === "Dario Conosciuto"), invD = DB.inviti.find(x => x.nome === "Dario Conosciuto");
check(dario.invito_target_id === invD.id && invD.persona_id === dario.id, "l'invito nasce collegato alla persona della lista");
check(dario.fase === "contattato" && DB.passi.some(x => x.persona_id === dario.id && x.tipo === "contatto" && x.come === "Target"),
  "mandando il Target chi era In lista diventa Contattato");
await page.click("button[data-act=torna-target]"); await page.click("button[data-sez=lista]");
await page.locator("button[data-act=apri-persona]", { hasText:"Dario Conosciuto" }).click();
check(await page.getByText(/Target: in attesa/).isVisible(), "nella scheda: Target in attesa");
// la stessa risposta incollata con "Leggi una risposta" non cambia niente; un codice non mio è rifiutato
await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=target]");
await page.click("button[data-act=target-leggi]");
await page.fill(".sheet textarea[name=testo]", "Apri le risposte: x#r=CL21-11111111-1-ZZZZZZ");
await page.click(".sheet button:has-text('Leggi')");
check(await page.locator(".sheet .errore").getByText(/non corrisponde a nessuno dei tuoi inviti|Non trovo il codice/).isVisible(), "un codice che non è mio è rifiutato");
await page.click(".sheet button[data-act=chiudi]");
await sync(page); await ctx.close();
// il link già usato non si riapre
const ctxC2 = await browser.newContext({ viewport:{width:390,height:844}, locale:"it-IT", bypassCSP:true });
await ctxC2.route(/cdn\.jsdelivr\.net/, r => r.abort());
const pc2 = await ctxC2.newPage(); fileMancanti(pc2);
await pc2.addInitScript(([db, m]) => { window.__DB = db; eval(m); }, [DB, mock]);
await pc2.goto(BASE + linkT.slice(linkT.indexOf("#")));
await pc2.getByText("Hai già risposto").waitFor(); check(true, "il link usato si chiude");
await ctxC2.close();

// 24. Persone → Clienti: + Un cliente, ordine dal catalogo, durata, riordini, verifica, compleanno, messaggi
const gg = n => new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }).format(new Date(Date.now() + n * 864e5));
DB.ordini = []; DB.righe = []; DB.durate = [{ proprietario:"R", codice:"VV1", giorni:90 }, { proprietario:"R", codice:"UU2", giorni:16 }, { proprietario:"R", codice:"UU3", giorni:365 }];
DB.persone.push(
  { id:"cu1", proprietario:"R", nome:"Ugo Riordino", contatto:"333 1112223", fase:"contattato", esito:"cliente", lasciati:[], creato_il:gg(-60) },
  { id:"cu2", proprietario:"R", nome:"Vera Verifica", fase:"contattato", esito:"cliente", lasciati:[], creato_il:gg(-60) },
  { id:"cu3", proprietario:"R", nome:"Bea Compleanno", fase:"contattato", esito:"cliente", lasciati:[], compleanno:gg(3).slice(5), creato_il:gg(-60) });
DB.ordini.push({ id:"o1", proprietario:"R", persona_id:"cu1", data:gg(-27), modo:"sito", creato_il:"a", verificato:gg(-15) },
  { id:"o2", proprietario:"R", persona_id:"cu2", data:gg(-10), modo:"sito", creato_il:"b" },
  { id:"o3", proprietario:"R", persona_id:"cu3", data:gg(-5), modo:"sito", creato_il:"c", verificato:gg(-1) });
DB.righe.push({ id:"r1", proprietario:"R", ordine_id:"o1", codice:"UU1", nome:"Prodotto Ugo", quantita:1, prezzo:20 },
  { id:"r1b", proprietario:"R", ordine_id:"o1", codice:"UU2", nome:"Secondo Ugo", quantita:2, prezzo:10 },
  { id:"r1c", proprietario:"R", ordine_id:"o1", codice:"UU3", nome:"Lungo Ugo", quantita:1, prezzo:5 },
  { id:"r2", proprietario:"R", ordine_id:"o2", codice:"VV1", nome:"Prodotto Vera", quantita:1, prezzo:30 },
  { id:"r3", proprietario:"R", ordine_id:"o3", codice:"VV1", nome:"Prodotto Vera", quantita:1, prezzo:30 });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
const cardCli = page.locator(".card.oggi-lista");
await page.screenshot({ path: S + "/e2e/46-io-chiaro.png", fullPage:true });
/* consegna 2: il cruscotto e «La prossima cosa» */
check(await page.locator(".cruscotto .anello[role=img]").getAttribute("aria-label").then(t => /^VP personali: (\S+ su \S+, mappa del.+|nessuna mappa di \S+)$/.test(t)), "cruscotto: l'anello dei VP ha la sua descrizione");
check(await page.locator(".cruscotto .tessera .bar[role=progressbar]").count() === 2, "cruscotto: contatti e piani della settimana");
check((await page.locator(".tappa-riga").innerText()).includes("su 1 requisito") && !(await page.locator(".tappa-riga").innerText()).includes("1 requisiti"), "tappa: «requisito» al singolare");
const primaCosa = async () => (await page.locator(".oggi-lista .prossima-titolo").innerText()).trim();
const p1 = await primaCosa();
check(p1.startsWith("Vera Verifica") && await page.locator(".oggi-lista .prossima-titolo .tag-cliente").isVisible(), "la prossima cosa: il primo di oggi con l'etichetta Cliente");
check(await cardCli.getByText("Sta finendo: Prodotto Ugo").isVisible(), "Io: Ugo da sentire, il prodotto sta finendo");
check(await cardCli.getByText("Come si è trovato con Prodotto Vera").isVisible(), "Io: Vera, come si è trovata (prodotto nuovo da 10 giorni)");
check(await cardCli.getByText(/Compleanno il/).isVisible(), "Io: il compleanno di Bea tra 3 giorni");
/* consegna 4: «Più tardi» apre l'agenda, con «per cosa» già scelto dal motivo */
await page.click(".oggi-lista .prossima-azioni button[data-act=agenda]");
await page.locator(".sheet h2", { hasText:"In agenda · Vera" }).waitFor();
check(await page.locator(".sheet input[name=per][value=come_trovato]").isChecked(), "Più tardi (cliente): l'agenda propone «Come si è trovato»");
check(await page.locator(".sheet input[name=per]").count() === 6 && await page.locator(".sheet input[name=per][value=consegna]").count() === 1, "agenda del cliente: i «per cosa» dei clienti");
await page.screenshot({ path: S + "/e2e/48-agenda-cliente.png" });
const domaniG = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
await page.check(`.sheet input[name=quando][value="${domaniG}"]`, { force:true }); await page.check(".sheet input[name=come][value=persona]", { force:true });
await page.click(".sheet button.primary");
await page.getByText("In agenda: domani, di persona").waitFor();
check(!(await page.locator(".oggi-lista", { hasText:"Vera Verifica" }).count()), "in agenda per domani: oggi Vera non c'è più");
await sync(page);
check((() => { const v = DB.persone.find(x => x.id === "cu2"); return v.prossima_data === domaniG && v.prossima_per === "come_trovato" && v.prossima_come === "persona"; })(),
  "nel database: giorno, per cosa e come");
await page.click(".oggi-lista button[data-act=prossima-fatto]");
await page.getByText("Cosa usa").waitFor();
check(await page.locator("button[role=tab][aria-selected=true]", { hasText:"Persone" }).isVisible(), "Apri (cliente): si apre la sua scheda");
await page.click("button[data-act=vista-io]");
await page.locator(".card.oggi-lista").waitFor();
// il messaggio "sta finendo" si apre nella chat di Ugo
await cardCli.locator("button[data-act=apri-cliente]", { hasText:"Ugo Riordino" }).click();
await page.getByText("Cosa usa").waitFor();
await page.click("button[data-act=messaggio-cliente]");
check(await page.locator("#testo-msg").inputValue().then(t => t.includes("Prodotto Ugo")), "messaggio pronto con il prodotto che finisce");
check(await page.locator("#testo-msg").inputValue().then(t => t.includes("Prodotto Ugo e Secondo Ugo ti stanno finendo") && t.includes("stesse quantità") && !t.includes("Lungo Ugo")),
  "Scrivigli: tutti i prodotti che finiscono entro 7 giorni, non gli altri");
await page.evaluate(() => { window.open = u => { window.__aperto = u; }; });
await page.click("button[data-act=manda-msg]");
check((await page.evaluate(() => window.__aperto)).startsWith("https://wa.me/393331112223?text="), "il messaggio si apre nella chat WhatsApp del cliente");
await page.click(".sheet button[data-act=chiudi]");
await page.click("button[data-act=lascia-prodotto][data-codice=UU2]");
await page.getByText("Non lo segue più").waitFor();
await page.click("button[data-act=riordinato]");
await page.getByText("Prodotto Ugo: riordinato oggi").waitFor();
check(await page.locator(".card .pill", { hasText:"A posto" }).first().isVisible(), "Riordinato: Ugo torna a posto");
// Vera: fatto il "come ti sei trovato"
await page.click("button[data-act=torna-clienti]");
check(await page.locator("button[data-filtro=tutti].on").isVisible() && await page.locator(".scelte-rapide button[data-filtro]").first().getAttribute("data-filtro") === "tutti", "Clienti: Tutti è il primo filtro e parte selezionato");
/* uno scorrimento di lato sui filtri di Clienti non cambia pagina (come nella Lista) */
await page.evaluate(() => { const f = document.querySelector(".filtri"), r = f.getBoundingClientRect(), y = r.top + r.height / 2;
  const t = x => new Touch({ identifier:1, target:f, clientX:x, clientY:y });
  f.dispatchEvent(new TouchEvent("touchstart", { touches:[t(r.right - 20)], changedTouches:[t(r.right - 20)], bubbles:true }));
  f.dispatchEvent(new TouchEvent("touchend", { touches:[], changedTouches:[t(r.left + 20)], bubbles:true })); });
await page.waitForTimeout(400);
check(await page.locator("button[data-act=cliente-nuovo]").isVisible()
  && await page.evaluate(() => getComputedStyle(document.querySelector(".filtri")).overscrollBehaviorX === "contain"),
  "Clienti: scorrere i filtri di lato non cambia pagina e non trascina la pagina");
await page.click("button[data-filtro=tutti]");
await page.locator("button[data-act=apri-cliente]", { hasText:"Vera Verifica" }).click();
await page.click("button[data-act=verifica-fatta]");
await page.getByText("gli hai chiesto come si è trovato").waitFor();
await sync(page);
check(DB.ordini.find(o => o.id === "o2").verificato === oggiStr, "verifica fatta segnata sull'ordine");
// + Un cliente e il suo primo ordine dal catalogo
await page.click("button[data-act=torna-clienti]");
const clientiPrima = DB.activities.filter(a => a.partner_id === "R" && a.tipo === "cliente").length;
await page.click("button[data-act=cliente-nuovo]");
await page.fill(".sheet input[name=nome]", "Gina Cliente");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Gina Cliente tra i tuoi clienti").waitFor();
check(await page.locator(".pill", { hasText:"Mai ordinato" }).isVisible(), "cliente nuovo: mai ordinato");
await page.click("button[data-act=ordine-nuovo]");
await page.fill("#cerca-prodotto", "double");
await page.locator("#risultati-prodotto button[data-act=aggiungi-prodotto]").first().click();
await page.click(".sheet button[data-act=riga-piu]");
await page.fill(".sheet input[data-campo=giorni]", "31");
await page.click('.sheet label.chip:has-text("L\'ho fatto io")');
const totOrdine = await page.locator("#totale-ordine").innerText();
check(/Cliente 160,00 €/.test(totOrdine) && /Partner 133,00 €/.test(totOrdine) && /53,00 VP/.test(totOrdine), "ordine: totali al cliente, Partner e VP");
await page.fill("#cerca-prodotto", "vecchio");
check(!(await page.locator("#risultati-prodotto button[data-act=aggiungi-prodotto]").count()), "i prodotti non più nel listino non si trovano");
await page.fill("#cerca-prodotto", "");
await page.click('.sheet button:has-text("Salva l\'ordine")');
await page.getByText("Ordine salvato").waitFor();
await sync(page);
const gina = DB.persone.find(x => x.nome === "Gina Cliente"), oG = DB.ordini.find(o => o.persona_id === gina.id), rG = DB.righe.find(r => r.ordine_id === oG.id);
check(gina.esito === "cliente" && DB.activities.filter(a => a.partner_id === "R" && a.tipo === "cliente").length === clientiPrima + 1, "+ Un cliente conta nei nuovi clienti");
check(oG.modo === "io" && rG.quantita === 2 && rG.prezzo > 0 && /double/i.test(rG.nome), "ordine dal catalogo: prodotto, quantità 2, prezzo di listino");
check(DB.durate.some(d => d.codice === rG.codice && d.giorni === 31), "la durata scelta resta per tutti i clienti");
check(rG.prezzo === 80 && rG.prezzo_partner === 66.5 && rG.vp === 26.5, "la riga tiene prezzo al cliente, prezzo Partner e VP del listino");
check(await page.getByText(`finisce il ${await page.evaluate(d => { const [y, m, g] = d.split("-").map(Number); return g + " " + ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"][m - 1]; }, gg(62))}`).first().isVisible()
  || await page.getByText(/finisce il/).first().isVisible(), "quando finisce: 2 × 31 giorni");
await page.click("button[data-act=ordine-pagato]");
await page.getByText("✓ Pagato").waitFor(); check(true, "ordine fatto da me: pagato");
await page.click("button[data-act=ordine-ripeti]");
check(await page.locator(".righe-ordine li").count() === 1, "Ripeti l'ultimo: lo stesso prodotto già nell'ordine");
await page.click('.sheet button:has-text("Salva l\'ordine")');
await page.getByText("Ordine salvato").waitFor();
await sync(page);
check(DB.ordini.filter(o => o.persona_id === gina.id).length === 2 && !DB.activities.some(a => a.tipo === "ordine" && a.data === oggiStr && a.partner_id === "R" && a.vp == null),
  "due ordini, nessun VP toccato");
await page.click("button[data-act=cliente-non-compra]");
await page.getByText("Segnato: non compra più").waitFor();
await page.click("button[data-act=torna-clienti]");
check(await page.getByText("Non comprano più · 1").isVisible(), "filtro: non comprano più");
// un cliente si toglie da Io (come la lista) e si rimette dalla sua scheda
await page.click("button[data-act=vista-io]");
{ // «Il mio mese»: i nuovi clienti sono solo un numero (si registrano da Clienti o chiudendo una persona della Lista)
  await sync(page); await apriMese(page);
  const nuovi = DB.activities.filter(a => a.partner_id === "R" && a.tipo === "cliente" && String(a.data).slice(0, 7) === meseOra()).reduce((t, a) => t + (a.quantita || 1), 0);
  const rigaC = page.locator(".mio-mese .blocco-numeri .spread", { hasText:"Nuovi clienti nel mese" });
  check(nuovi >= 1 && (await rigaC.locator("b.num").innerText()) === String(nuovi), "Il mio mese: i nuovi clienti contano anche quelli registrati da Clienti (" + nuovi + ")");
  check(!(await page.locator(".mio-mese button[data-act=cliente]").count()) && !(await rigaC.locator("button").count()), "Il mio mese: niente più «+ Cliente», solo il numero");
  await page.locator("button[data-act=apri-mese]").first().click();
}
await page.locator('.oggi-lista button[aria-label="Togli Bea Compleanno da Io"]').click();
await page.getByText("Bea tolto da Io").waitFor();
check(!(await page.locator(".oggi-lista", { hasText:"Bea Compleanno" }).count()), "Io: il cliente tolto non compare più");
await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]"); await page.click("button[data-filtro=tutti]");
await page.locator("button[data-act=apri-cliente]", { hasText:"Bea Compleanno" }).click();
await page.click("button[data-act=rimetti-in-io]");
await page.getByText("Di nuovo in Io").waitFor();
await page.click("button[data-act=vista-io]");
check(await page.locator(".oggi-lista").getByText("Bea Compleanno").isVisible(), "dalla scheda del cliente: Rimetti in Io");
await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]");
await page.screenshot({ path: S + "/e2e/31-clienti.png", fullPage:true });
await ctx.close();

// 25. Clienti: gli ordini dal sito Amway (export Ordini, dati inventati)
const MESI_IT = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const dataLungaT = iso => { const [y, m, d] = iso.split("-"); return `${d} ${MESI_IT[Number(m) - 1]} ${y}`; };
const ordineCsv = (nome, codice, data, numero, vp, vv) => `"'${nome}","'${codice}","'${dataLungaT(data)}","'${numero}","'${vp}","'${vv}","'Ordine",`;
const csvOrdini = ['"Amway","CONFIDENZIALE - prova"', '"Mese di competenza","202610"',
  '"Nome","Codice Cliente","Data ordine","Numero ordine","VP","VV","Tipo ordine","Dettagli VeCV"',
  ordineCsv("Rossi, Lia", "7000000001", gg(-40), "170000002", "20,05", "45,38"),
  ordineCsv("Rossi, Lia", "7000000001", gg(-80), "170000001", "16,30", "36,16"),
  ordineCsv("Cliente, Gina", "7000000002", gg(-3), "170000003", "42,60", "96,38"),
  ordineCsv("VERDI, NUOVO", "7000000003", gg(-10), "170000004", "6,18", "13,96")].join("\n") + "\n";
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]");
await mettiFile(page, { name:"18102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) });
await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
check(await page.getByText("4 ordini nei file").isVisible() && await page.getByText("4 ordini nuovi").isVisible(), "anteprima: 4 ordini, tutti nuovi");
check(await page.locator(".sheet .imp-sezione", { hasText:"Già in Growup" }).getByText("riconosciuto dal nome").isVisible(), "Gina riconosciuta dal nome");
check(await page.locator(".sheet .scelte label", { hasText:"Lia Rossi" }).isVisible() && await page.locator(".sheet .scelte label", { hasText:"Nuovo Verdi" }).isVisible(), "nuovi clienti proposti con il nome giusto");
await page.locator(".sheet .scelte label", { hasText:"Nuovo Verdi" }).locator("input").uncheck();
await page.click(".sheet button:has-text('Importa')");
await page.getByText("3 ordini nello storico, 1 nuovo cliente").waitFor();
await sync(page);
const lia = DB.persone.find(x => x.nome === "Lia Rossi"), ginaI = DB.persone.find(x => x.nome === "Gina Cliente");
check(lia && lia.esito === "cliente" && lia.codice_cliente === "7000000001" && ginaI.codice_cliente === "7000000002", "clienti collegati al codice cliente Amway");
check(!DB.persone.some(x => x.nome === "Nuovo Verdi") && !DB.ordini.some(o => o.numero_amway === "170000004"), "chi non è spuntato non entra");
check(DB.ordini.filter(o => o.numero_amway).length === 3 && DB.ordini.find(o => o.numero_amway === "170000003").importo === 96.38, "ordini dal sito con data e importo");
// il ritmo: Lia ordina ogni 40 giorni, il prossimo è atteso oggi
await page.click("button[data-act=vista-io]");
check(await page.locator(".oggi-lista").getByText("di solito ordina ogni 40 giorni").isVisible(), "Io: Lia da sentire, ordina ogni 40 giorni");
// reimport dello stesso file (l'export parte sempre da settembre): niente doppi
await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]");
await mettiFile(page, { name:"18102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) });
await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
check(await page.getByText("1 ordine nuovo", { exact:true }).isVisible() && await page.locator(".sheet .scelte label", { hasText:"Nuovo Verdi" }).isVisible(),
  "reimport: gli ordini già importati si saltano, resta solo chi non era stato aggiunto");
await page.click(".sheet button[data-act=chiudi]");
// i prodotti aggiunti a un ordine importato
await page.click("button[data-filtro=tutti]");
await page.locator("button[data-act=apri-cliente]", { hasText:"Lia Rossi" }).click();
check(await page.getByText(/Di solito ordina ogni/).isVisible(), "scheda: il ritmo degli ordini");
await page.locator("button[data-act=ordine-modifica]", { hasText:"+ Aggiungi i prodotti" }).first().click();
await page.fill("#cerca-prodotto", "double");
await page.locator("#risultati-prodotto button[data-act=aggiungi-prodotto]").first().click();
await page.click('.sheet button:has-text("Salva l\'ordine")');
await page.getByText("Ordine modificato").waitFor();
await sync(page);
const oLia = DB.ordini.find(o => o.numero_amway === "170000002");
check(DB.righe.some(r => r.ordine_id === oLia.id) && DB.ordini.filter(o => o.persona_id === lia.id).length === 2, "i prodotti si aggiungono all'ordine importato (nessun ordine nuovo)");

// 26. Clienti: l'elenco dei clienti dal sito Amway (export Clienti, dati inventati), anche insieme al file degli ordini
const clienteCsv = (nome, codice, ingresso, tel, ultimo) => `"'${nome}","'${codice}","'Preferito","'No","'${dataLungaT(ingresso)}",${tel ? `"'Principale: ${tel}"` : ""},"'finta@example.com","'Via Finta 1 | Paese | XX | 00000 | Italia","0","'0,00","'${ultimo ? dataLungaT(ultimo) : "--"}"`;
const csvClienti = ['"Amway","CONFIDENZIALE - prova"', '"Mese di competenza","202610"',
  '"Nome","Codice Cliente","Tipo","Nuovo cliente","Data di ingresso","Telefono","Email","Indirizzo","N. di ordini","VP Cliente","Data ultimo ordine"',
  clienteCsv("Rossi, Lia", "7000000001", gg(-400), "+39 333 000 0001", gg(-40)),
  clienteCsv("Rossi, Lia", "7000000009", gg(-900), "", ""),
  clienteCsv("Bianchi, Ugo", "7000000005", gg(-300), "+39 333 000 0005", gg(-20)),
  clienteCsv("Neri, Mai", "7000000006", gg(-500), "+39 333 000 0006", "")].join("\n") + "\n";
await page.click("button[data-act=torna-clienti]");
await mettiFile(page, [{ name:"19102026_Cliente.csv", mimeType:"text/csv", buffer:Buffer.from(csvClienti) },
  { name:"18102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) }]);
await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
check(await page.getByText("4 ordini e 4 clienti nei file").isVisible(), "i due file insieme: riconosciuti da soli");
check(await page.locator(".sheet .imp-sezione", { hasText:"Già in Growup" }).getByText(/Lia Rossi · telefono/).isVisible(), "Lia: si aggiunge solo il telefono (l'ultimo ordine c'è già)");
check(await page.locator(".sheet .scelte label", { hasText:"Ugo Bianchi" }).isVisible() && await page.locator(".sheet .scelte label", { hasText:"Nuovo Verdi" }).isVisible(), "nuovi clienti: chi ha comprato");
check(await page.locator(".sheet .imp-sezione", { hasText:"Mai comprato" }).locator(".scelte label", { hasText:"Mai Neri" }).locator("input").isChecked(), "mai comprato: con la spunta");
const sezMai = page.locator(".sheet .imp-sezione", { hasText:"Mai comprato" });
await sezMai.locator("input[data-tutti=mai]").uncheck();
check(!(await sezMai.locator(".scelte label", { hasText:"Mai Neri" }).locator("input").isChecked()), "Seleziona tutti: toglie tutte le spunte");
await sezMai.locator("input[data-tutti=mai]").check();
check(await sezMai.locator(".scelte label", { hasText:"Mai Neri" }).locator("input").isChecked(), "Seleziona tutti: rimette tutte le spunte");
check(!await page.locator(".sheet .scelte label", { hasText:"Lia Rossi" }).count(), "Lia con due codici: una persona sola");
await page.locator(".sheet .scelte label", { hasText:"Nuovo Verdi" }).locator("input").uncheck();
await page.click(".sheet button:has-text('Importa')");
await page.getByText("1 ordine nello storico, 1 nuovo cliente, 1 in Lista (mai comprato)").waitFor();
await sync(page);
const ugo = DB.persone.find(x => x.nome === "Ugo Bianchi"), mai = DB.persone.find(x => x.nome === "Mai Neri"), liaC = DB.persone.find(x => x.nome === "Lia Rossi");
check(ugo && ugo.esito === "cliente" && ugo.contatto === "+39 333 000 0005" && ugo.codice_cliente === "7000000005", "nuovo cliente con telefono e codice");
check(DB.ordini.filter(o => o.persona_id === ugo.id).length === 1 && !DB.ordini.find(o => o.persona_id === ugo.id).numero_amway, "l'ultimo ordine nello storico (ancora senza numero)");
check(mai && !mai.esito && mai.codice_cliente === "7000000006", "chi non ha mai comprato va in Lista");
check(liaC.contatto === "+39 333 000 0001" && liaC.codice_cliente === "7000000001", "telefono aggiunto, codice tenuto");
check(!JSON.stringify(DB.persone).includes("example.com") && !JSON.stringify(DB.persone).includes("Via Finta"), "email e indirizzo non si salvano");
// l'export ordini con l'ordine di Ugo: si unisce a quello già nello storico
const csvOrdini2 = csvOrdini.trimEnd() + "\n" + ordineCsv("Bianchi, Ugo", "7000000005", gg(-20), "170000005", "10,00", "22,00") + "\n";
await mettiFile(page, { name:"19102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini2) });
await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
await page.locator(".sheet .scelte label", { hasText:"Nuovo Verdi" }).locator("input").uncheck();
await page.click(".sheet button:has-text('Importa')");
await page.getByText("1 ordine nello storico").waitFor();
await sync(page);
check(DB.ordini.filter(o => o.persona_id === ugo.id).length === 1 && DB.ordini.find(o => o.persona_id === ugo.id).numero_amway === "170000005"
  && DB.ordini.find(o => o.persona_id === ugo.id).importo === 22, "l'ordine vero si unisce all'ultimo ordine: niente doppioni");
// la Lista: l'etichetta "Mai comprato"
await page.click("button[data-sez=lista]");
check(await page.locator("button[data-act=apri-persona]", { hasText:"Mai Neri" }).getByText("Mai comprato").isVisible(), "Lista: etichetta Mai comprato");
// modifica di un ordine: fatto da me → etichette da consegnare e da pagare
await page.click("button[data-sez=clienti]"); await page.click("button[data-filtro=tutti]");
await page.locator("button[data-act=apri-cliente]", { hasText:"Ugo Bianchi" }).click();
await page.locator("button[data-act=ordine-modifica]", { hasText:"Modifica" }).first().click();
check(await page.getByText("Ordine n. 170000005 dal sito Amway").isVisible(), "modifica: il numero dell'ordine Amway resta");
await page.locator('.sheet label.chip:has-text("L\'ho fatto io")').click();
await page.fill(".sheet input[name=nota]", "consegna a casa");
await page.click('.sheet button:has-text("Salva l\'ordine")');
await page.getByText("Ordine modificato").waitFor();
await sync(page);
check(DB.ordini.find(o => o.persona_id === ugo.id).modo === "io" && DB.ordini.find(o => o.persona_id === ugo.id).nota === "consegna a casa", "ordine modificato: modo e nota");
check(await page.locator(".card .etichette").getByText("Da consegnare").isVisible() && await page.locator(".card .etichette").getByText("Da pagare").isVisible(), "scheda: da consegnare e da pagare");
await page.click("button[data-act=ordine-consegnato]");
await page.getByText("✓ Consegnato").waitFor();
check(!await page.locator(".card .etichette").getByText("Da consegnare").count() && await page.locator(".card .etichette").getByText("Da pagare").isVisible(), "spuntato consegnato: resta solo da pagare");
// modifica i dati dalla scheda del cliente: toccando il nome
check(!await page.locator("button[data-act=persona-modifica]", { hasText:"Modifica i dati" }).count(), "scheda cliente: niente pulsante Modifica i dati in fondo");
await page.click("button.nome-modifica");
await page.fill(".sheet input[name=contatto]", "+39 333 000 0099");
await page.fill(".sheet input[name=giorno]", "5");
await page.selectOption(".sheet select[name=mese]", "3");
await page.click('.sheet button:has-text("Salva")');
await page.getByText("Dati salvati").waitFor();
await sync(page);
check(DB.persone.find(x => x.id === ugo.id).contatto === "+39 333 000 0099" && DB.persone.find(x => x.id === ugo.id).compleanno === "03-05", "Modifica i dati dalla scheda cliente: telefono e compleanno");
check(await page.locator("h2", { hasText:"Ugo Bianchi" }).isVisible(), "dopo il salvataggio resta nella scheda del cliente");
await page.click("button[data-act=torna-clienti]");
check(await page.locator("button[data-act=apri-cliente]", { hasText:"Ugo Bianchi" }).getByText("Da pagare").isVisible(), "elenco clienti: etichetta da pagare");
await page.screenshot({ path: S + "/e2e/32-clienti-amway.png", fullPage:true });
// l'ultimo ordine dell'elenco clienti si somma agli ordini che ci sono già (anche a uno "fatto da me" più recente), senza doppioni
await page.click("button[data-act=cliente-nuovo]");
await page.fill(".sheet input[name=nome]", "Gino Somma");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Gino Somma tra i tuoi clienti").waitFor();
await page.click("button[data-act=ordine-nuovo]");
await page.fill("#cerca-prodotto", "double");
await page.locator("#risultati-prodotto button[data-act=aggiungi-prodotto]").first().click();
await page.click('.sheet label.chip:has-text("L\'ho fatto io")');
await page.click('.sheet button:has-text("Salva l\'ordine")');
await page.getByText("Ordine salvato").waitFor();
await page.click("button.nome-modifica");
await page.fill(".sheet input[name=codice_cliente]", "7000000020");
await page.click('.sheet button:has-text("Salva")');
await page.getByText("Dati salvati").waitFor();
const csvGino = ['"Nome","Codice Cliente","Tipo","Nuovo cliente","Data di ingresso","Telefono","Email","Indirizzo","N. di ordini","VP Cliente","Data ultimo ordine"',
  clienteCsv("Somma, Gino", "7000000020", gg(-200), "+39 333 000 0020", gg(-5))].join("\n") + "\n";
for(const volta of [1, 2]){
  await page.click("button[data-act=torna-clienti]").catch(() => {});
    await mettiFile(page, { name:"20102026_Cliente.csv", mimeType:"text/csv", buffer:Buffer.from(csvGino) });
  await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
  if(volta === 1){
    check(await page.locator(".sheet .imp-sezione", { hasText:"Già in Growup" }).getByText(/Gino Somma · ultimo ordine/).isVisible(), "import: l'ultimo ordine del sito si aggiunge al cliente");
    await page.click(".sheet button:has-text('Importa')");
    await page.getByText("1 ordine nello storico").waitFor();
  }else{
    check(await page.getByText("Niente di nuovo: è già tutto in Growup.").isVisible(), "reimport: l'ultimo ordine non si aggiunge due volte");
    await page.click(".sheet button[data-act=chiudi]");
  }
}
await sync(page);
const gino = DB.persone.find(x => x.nome === "Gino Somma"), ordGino = DB.ordini.filter(o => o.persona_id === gino.id);
check(ordGino.length === 2 && ordGino.some(o => o.modo === "io" && o.data === oggiStr) && ordGino.some(o => o.modo === "sito" && o.data === gg(-5)),
  "il cliente ha l'ordine fatto da me e l'ultimo ordine del sito");
await ctx.close();

// 28. Da confermare: si toglie dalla struttura; l'admin blocca l'app (dati inventati)
({ ctx, page } = await apri({}, invitoPer("R", "Dino Prova", "2000099")));
await page.getByText("Benvenuto in Growup").waitFor();
await page.selectOption("select[name=qualifica]", "pin:6");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await perche(page);
await page.getByText("Ciao Dino").waitFor(); await apriTappa(page);
const sessDino = await page.evaluate(() => localStorage.getItem("mock.session"));
await sync(page); await ctx.close();
const telefonoDino = () => apri({ storageState:{ cookies:[], origins:[{ origin:"http://127.0.0.1:8765", localStorage:[{ name:"mock.session", value:sessDino }] }] } }, "");
const radice = async () => { ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page); await page.click("button[data-act=vista-gruppo]"); };
await radice();
/* 033: Dino è in attesa della mappa: fuori dalla struttura, solo il nome nell'elenco «In attesa» */
check(await page.locator(".in-attesa li", { hasText:"Dino Prova" }).isVisible() && !(await page.locator(".albero.struttura li", { hasText:"Dino Prova" }).count()),
  "struttura: Dino in attesa della mappa, solo il nome");
check(await page.locator(".in-attesa li", { hasText:"Dino Prova" }).locator("button[data-act=togli-attesa]").isVisible(), "lo sponsor diretto lo può togliere");
await ctx.close();
// confermato da un import: ora è nella struttura e l'admin può bloccargli l'app
DB.partners.find(p => p.nome === "Dino Prova").confermato_il = new Date().toISOString();
await radice();
const rigaDino = page.locator(".albero.struttura li", { hasText:"Dino Prova" });
await rigaDino.locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
check(await page.locator("button[data-act=blocca-app]", { hasText:"Blocca l'app" }).isVisible(), "scheda: (admin) Blocca l'app (in «Azioni»)");
await page.click("button[data-act=blocca-app]");
await page.getByText("App di Dino Prova bloccata").waitFor();
check(await page.locator(".card .pill.r", { hasText:"Bloccato" }).first().isVisible(), "scheda: Bloccato");
await sync(page); await ctx.close();
({ ctx, page } = await telefonoDino());
await page.getByText("Accesso sospeso").waitFor();
check(!(await page.getByText("Ciao Dino").count()), "il telefono di Dino bloccato non entra");
await ctx.close();
await radice();
await page.locator(".albero.struttura li", { hasText:"Dino Prova" }).locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
await page.click("button[data-act=blocca-app]");
await page.getByText("App di Dino Prova sbloccata").waitFor();
await sync(page); await ctx.close();
// di nuovo in attesa (per la prova): lo sponsor lo toglie dall'elenco
DB.partners.find(p => p.nome === "Dino Prova").confermato_il = null;
await radice();
await page.locator(".in-attesa li", { hasText:"Dino Prova" }).locator("button[data-act=togli-attesa]").click();
await page.getByText("Dino Prova tolta").waitFor();
check(!(await page.locator(".in-attesa li", { hasText:"Dino Prova" }).count()), "Dino non è più in attesa");
await sync(page);
check(!DB.partners.some(p => p.nome === "Dino Prova"), "il profilo di Dino è cancellato");
await page.click("button[data-act=vista-profilo]");
await page.click("button[data-act=codici-tolti]");
check(await page.locator(".sheet li", { hasText:"2000099" }).isVisible(), "l'admin vede il codice tolto");
await ctx.close();
({ ctx, page } = await telefonoDino());
await page.getByText("Accesso tolto").waitFor(); check(true, "il telefono di Dino: accesso tolto");
await ctx.close();
await radice();
await page.click("button[data-act=vista-profilo]");
await page.click("button[data-act=codici-tolti]");
await page.locator(".sheet li", { hasText:"2000099" }).locator("button[data-act=sblocca-codice]").click();
await page.getByText("Codice sbloccato").waitFor();
check(!(await page.locator(".sheet li", { hasText:"2000099" }).count()), "codice sbloccato");
await ctx.close();

// 29. Il listino (solo admin): un prodotto a mano e l'aggiornamento dal PDF (PDF finto, prodotti inventati)
const pdfFinto = n => { const pagina = []; let y = 560;
  const el = (str, x, h, w) => ({ str, transform:[h, 0, 0, h, x, y], width:w });
  pagina.push(el("Integratori prova", 40, 13.5, 120)); y -= 14;
  for(let i = 0; i < n; i++){
    const codice = i === 0 ? "900001" : String(900100 + i), prezzo = i === 0 ? "82,00" : "10,00";
    pagina.push(el(`${codice} Prodotto Pdf ${i === 0 ? "Double Prova (31 giorni)" : i}`, 40, 8.5, 200), el("100 g", 300, 8.5, 20), el(prezzo, 360, 8.5, 20),
      el("1,50", 400, 8.5, 18), el(i === 0 ? "68,00" : "8,33", 440, 8.5, 20), el("3,40", 520, 8.5, 18), el("7,70", 560, 8.5, 18));
    y -= 11;
  }
  return pagina; };
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.evaluate(items => { window.pdfjsWorker = {}; window.pdfjsLib = { GlobalWorkerOptions:{},
  getDocument: () => ({ promise:Promise.resolve({ numPages:1, getPage: async () => ({ getTextContent: async () => ({ items }) }) }) }) }; }, pdfFinto(60));
await page.click("button[data-act=vista-profilo]");
check(await page.locator(".solo-admin-box", { has:page.locator("button[data-act=listino]") }).getByText("Solo Admin").isVisible()
  && await page.locator(".solo-admin-box", { has:page.locator("button[data-act=copia-dati]") }).getByText("Solo Admin").isVisible(), "admin: Solo Admin sotto i suoi pulsanti");
await page.click("button[data-act=listino]");
await page.fill("#cerca-listino", "shampoo");
await page.locator("#risultati-listino button[data-act=prodotto-apri]").first().click();
await page.fill(".sheet input[name=prezzo_partner]", "10,50");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Prodotto salvato").waitFor();
await page.click("button[data-act=prodotto-nuovo]");
await page.fill(".sheet input[name=codice]", "900010"); await page.fill(".sheet input[name=nome]", "Novità Prova");
await page.fill(".sheet input[name=prezzo_cliente]", "20"); await page.fill(".sheet input[name=prezzo_partner]", "16,67"); await page.fill(".sheet input[name=vp]", "6,8");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Prodotto salvato").waitFor();
await sync(page);
check(DB.listino.find(x => x.codice === "900002").prezzo_partner === 10.5 && DB.listino.find(x => x.codice === "900010").vp === 6.8, "l'admin corregge e aggiunge prodotti");
await page.setInputFiles("#file-listino", { name:"listino.pdf", mimeType:"application/pdf", buffer:Buffer.from("%PDF-finto") });
await page.locator(".sheet form[data-form=listino-pdf]").waitFor();
check(await page.getByText("60 prodotti letti").isVisible() && await page.locator(".imp-sezione h3", { hasText:"Nuovi · 59" }).isVisible()
  && await page.locator(".imp-sezione h3", { hasText:"Prezzi cambiati · 1" }).isVisible(), "PDF: anteprima con nuovi e prezzi cambiati");
check(await page.locator(".sheet .scelte label", { hasText:"Novità Prova" }).isVisible() && await page.locator(".sheet .scelte label", { hasText:"Shampoo Prova" }).isVisible(),
  "PDF: chi non è più nel listino, con la spunta");
await page.locator(".sheet .scelte label", { hasText:"Novità Prova" }).locator("input").uncheck();
await page.click(".sheet button:has-text('Aggiorna il listino')");
await page.getByText(/Listino aggiornato/).waitFor();
await sync(page);
const L = c => DB.listino.find(x => x.codice === c);
check(L("900001").prezzo_cliente === 82 && L("900001").prezzo_partner === 68 && L("900001").vp === 3.4 && L("900150").attivo === true && L("900150").categoria === "Integratori prova",
  "PDF: prezzi aggiornati e prodotti nuovi con la categoria");
check(L("900002").attivo === false && L("900010").attivo === true, "PDF: chi esce non si cancella, chi è senza spunta resta nel listino");
await ctx.close();

// 30. Il movimento (senza "riduci animazioni"): pagine, foglio dal basso, coriandoli al traguardo, una volta sola
({ ctx, page } = await apri({ reducedMotion:"no-preference" }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
check(await page.evaluate(() => document.getAnimations().length > 0), "cambiando pagina il contenuto si muove");
await page.click("button[data-act=vista-io]");
const fatti = Number((await page.locator("button[data-act=contatto-rapido] b").innerText()).match(/\d+/)[0]);
await page.click("button[data-act=obiettivi]");
check(await page.evaluate(() => document.querySelector("#sheet .sheet-box").getAnimations().length > 0), "il foglio sale dal basso");
await page.fill(".sheet input[name=contatti]", String(fatti + 1));
await page.fill(".sheet input[name=piani]", "50");
await page.click(".sheet button:has-text('Salva')");
await page.locator("#sheet .sheet").waitFor({ state:"detached" });
await page.click("button[data-act=contatto-rapido]");
check(!(await page.locator(".sheet button[data-act=senza-nome]").count()) && !(await page.locator(".sheet", { hasText:"Senza nome" }).count()), "+ Contatto: niente più «Senza nome»");
await page.click(".sheet button:has-text('Salva')");
check((await page.locator(".sheet form[data-form=persona-nuova] .errore").innerText()).trim() !== "" && await page.locator(".sheet h2", { hasText:"Un contatto" }).isVisible(),
  "+ Contatto senza nome: non registra, chiede il nome");
await page.fill(".sheet input[name=nome]", "Ivo Traguardo");
await page.click(".sheet button:has-text('Salva')");
await page.locator(".annuncio-festa", { hasText:"Obiettivo contatti raggiunto!" }).waitFor();
check(await page.locator("canvas.coriandoli").count() === 1, "al traguardo i coriandoli su tutto lo schermo");
await page.locator("canvas.coriandoli").waitFor({ state:"detached", timeout:6000 });
await page.click("button[data-act=contatto-rapido]");
await page.fill(".sheet input[name=nome]", "Ugo Traguardo");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Contatto con Ugo registrato").waitFor();
await page.waitForTimeout(400);
check(!(await page.locator("canvas.coriandoli").count()) && !(await page.locator(".annuncio-festa").count()), "lo stesso traguardo si festeggia una volta sola");
await ctx.close();

// 31. "Come arrivarci": i consigli a richiesta, in Obiettivo (per me) e nella scheda partner (per lo sponsor)
{
  const R = DB.partners.find(p => p.id === "R");
  Object.assign(R, { qualifica_iniziale:"path_to_bronze", codice_amway:"7000000" });
  DB.partners = [R]; DB.activities = []; DB.numeri = []; DB.storico = []; DB.nascosti = [];
  DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id === "R");   // consegna 6: R tiene il suo perché
  const G = (id, nome, sponsor, codice) => DB.partners.push({ id, nome, sponsor_id:sponsor, stato:"gestito", gestore_id:"R", codice_invito:id.toUpperCase() + "QQQQ", codice_amway:codice || null });
  const V = (pid, vp) => DB.activities.push({ id:"ca" + DB.activities.length, partner_id:pid, tipo:"ordine", quantita:1, vp, data:oggiStr, inserito_il:new Date().toISOString() });
  G("ca", "Linea Alfa", "R", "7000001"); G("cb", "Linea Beta", "R", "7000002"); G("cb1", "Beta Uno", "cb"); G("cb2", "Beta Due", "cb"); G("cb3", "Beta Tre", "cb");
  G("cc", "Linea Gamma", "R", "7000003");
  /* 063: i VP di tutti dalla mappa (gli ordini scritti non contano) */
  V("R", 999); V("cb1", 70);
  mappa("ca", 0); mappa("cb", 0, 60); mappa("cb1", 0); mappa("cb2", 5); mappa("cb3", 55); mappa("cc", 150);
  const report = linee => { mappa("R", 120, 120 + linee.reduce((t, l) => t + l.vpg, 0), { linee }); };
  /* il report: Alfa 0, Beta 60, Gamma 150, più una linea che non è nell'app */
  report([{ codice:"7000001", vpg:0 }, { codice:"7000002", vpg:60 }, { codice:"7000003", vpg:150 }, { codice:"7000099", vpg:40 }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  check(!(await page.locator(".consigli").count()), "nessun consiglio nella pagina Io");
  await page.click("button[role=tab][data-act=vista-obiettivo]");
  const cons = page.locator("details.consigli");
  await cons.waitFor();
  check(!(await cons.evaluate(d => d.open)) && !(await page.getByText("Hai due strade").isVisible()), "Come arrivarci: chiuso finché non lo tocchi");
  await cons.locator("summary").click();
  check(await cons.getAttribute("data-chiave") === "linee_crescere", "Come arrivarci: manca una linea (linee_crescere)");
  check(await cons.getByText("Ricorda: per Bronze Foundation 9% servono anche 100 VP personali nel mese · ne hai 120 ✓").isVisible(), "il promemoria fisso dei VP personali");
  check(await cons.getByText("Ti mancano 3 linee da 200 VP. Hai due strade").isVisible(), "il testo per me, con i numeri veri");
  const cel = async (nome, i) => (await cons.locator("tr", { hasText:nome }).locator("td").nth(i).innerText()).trim();
  check(await cel("Linea Beta", 2) === "4" && await cel("Linea Beta", 3) === "2" && await cel("Linea Beta", 4) === "1" && await cel("Linea Beta", 5) === "1"
    && await cel("Linea Beta", 8) === "30" && await cel("Linea Beta", 9) === "140 VP", "la linea Beta: 4 persone, 2 a 0, 1 sotto 50, 1 tra 50 e 99, media 30, mancano 140");
  check(await cel("Linea Gamma", 6) === "1" && await cel("non nell'app", 2) === "–" && await cel("non nell'app", 9) === "160 VP", "Gamma attiva; la linea fuori dall'app solo con VP e quanto manca");
  await page.screenshot({ path: S + "/e2e/34-come-arrivarci.png", fullPage:true });
  // lo sponsor nella scheda: in terza persona; Gamma non ha linee, Beta è ferma
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li", { hasText:"Linea Gamma" }).first().locator("button[data-act=apri-scheda]").first().click();
  await page.locator(".card h2", { hasText:"Linea Gamma" }).waitFor();
  const lui = page.locator("details.consigli");
  await lui.locator("summary").click();
  check(await lui.getAttribute("data-chiave") === "linee_zero" && await lui.getByText("Non ha ancora linee attive: gli servono i primi 3 frontali.").isVisible()
    && await lui.getByText("Ricorda: per Path to Bronze servono anche 100 VP personali nel mese · ne ha 150 ✓").isVisible(), "scheda partner: i consigli in terza persona");
  check(!(await page.getByText("VP medio: di chi ha fatturato").count()) && await lui.locator(".nota").count() === 1
    && await lui.getByText("Calcolato sui numeri della mappa del mese. Sono spunti: la strada la decidete voi.").isVisible(), "sotto la tabellina solo la nota finale");
  await page.click("button[data-act=vista-gruppo]");
  check(!(await page.locator(".consigli").count()), "nessun consiglio nell'elenco del gruppo");
  await page.locator(".albero.struttura li", { hasText:"Linea Beta" }).first().locator("button[data-act=apri-scheda]").first().click();
  await page.locator(".card h2", { hasText:"Linea Beta" }).waitFor();
  check(await page.locator("details.consigli").getAttribute("data-chiave") === "fermo", "chi non ha VP personali nel mese: fermo");
  await ctx.close();
  /* le tre linee ci sono (100+) ma Beta è sotto i 200: tante persone a 0, una vicina ai 100 → fatturato basso */
  report([{ codice:"7000001", vpg:400 }, { codice:"7000002", vpg:120 }, { codice:"7000003", vpg:250 }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await page.click("button[role=tab][data-act=vista-obiettivo]");
  await page.locator("details.consigli summary").click();
  check(await page.locator("details.consigli").getAttribute("data-chiave") === "linea_vp.fatturato"
    && await page.getByText("1 persona è tra 50 e 99 VP: con un cliente in più si arriva a 100.").isVisible(), "linea sotto i 200: fatturato basso, con le vicine ai 100");
  await ctx.close();
  /* tutto a posto per la tappa */
  report([{ codice:"7000001", vpg:400 }, { codice:"7000002", vpg:400 }, { codice:"7000003", vpg:450 }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await page.click("button[role=tab][data-act=vista-obiettivo]");
  check(await page.locator("details.consigli").getAttribute("data-chiave") === "pronto", "con tutti i numeri della tappa: pronto");
  await ctx.close();
}

// 32. Qualifiche oltre Argento: Platino all'ingresso, prossima qualifica, Volume Rubino dal report (dati inventati)
({ ctx, page } = await apri({}, invitoPer("R", "Pia Prova", "7100001")));
await page.getByText("Benvenuto in Growup").waitFor();
check(await page.locator("select[name=qualifica] option").count() >= 1 + 7 + 6 + 11
  && await page.locator("select[name=qualifica] option", { hasText:"Diamante Fondatore" }).count() === 1, "nel menu le 11 qualifiche oltre Argento");
await page.selectOption("select[name=qualifica]", "oro");
check(await page.locator("[data-mostra=prossima]").isHidden(), "con Oro non si chiede la prossima qualifica");
await page.selectOption("select[name=qualifica]", "platino");
check(await page.locator("[data-mostra=prossima]").isVisible()
  && !(await page.locator("select[name=prossima] option", { hasText:/^Oro$/ }).count())
  && await page.locator("select[name=prossima] option", { hasText:"Platino Fondatore" }).count() === 1, "con Platino: la prossima qualifica, solo quelle sopra");
await page.selectOption("select[name=prossima]", "smeraldo");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await perche(page);
await page.getByText("Ciao Pia").waitFor(); await apriTappa(page);
check(await page.getByText("Platino raggiunto 🎉").isVisible() && await page.getByText("Prossima qualifica: Smeraldo").isVisible(), "Io: Platino raggiunto e la prossima qualifica");
check(await page.getByText("Volume Rubino questo mese: importa il report mappe per vederlo.").isVisible(), "senza report: il Volume Rubino si vede importando le mappe");
await page.click("button[role=tab][data-act=vista-obiettivo]");
const prossima = page.locator(".prossima-qualifica");
check(await prossima.locator("h2").innerText() === "Smeraldo" && await prossima.getByText("3 linee frontali al 21%").isVisible(), "Obiettivo: la prossima qualifica con i requisiti");
check(!(await page.locator(".consigli").count()), "oltre Argento «Come arrivarci» non compare");
const sessPia = await page.evaluate(() => localStorage.getItem("mock.session"));
await sync(page); await ctx.close();
const pia = DB.partners.find(p => p.nome === "Pia Prova");
pia.confermato_il = new Date().toISOString();   // 033: come dopo un import della mappa
check(pia.qualifica_iniziale === "platino" && pia.prossima_qualifica === "smeraldo", "salvati Platino e la prossima qualifica Smeraldo");
// il report mappe del mese: VPG 21.000 = Volume Rubino
DB.numeri = (DB.numeri || []).concat([{ visto_da:pia.id, partner_id:pia.id, mese:oggiStr.slice(0, 7), vpg:21000, percentuale:21, linee:[] }]);
const telefonoPia = () => apri({ storageState:{ cookies:[], origins:[{ origin:"http://127.0.0.1:8765", localStorage:[{ name:"mock.session", value:sessPia }] }] } }, "");
({ ctx, page } = await telefonoPia());
await page.getByText("Ciao Pia").waitFor(); await apriTappa(page);
check(await page.getByText("Volume Rubino questo mese: 21.000 su 20.000 VP ✓").isVisible(), "Volume Rubino dal report: 21.000 su 20.000 ✓");
await ctx.close();
// lo sponsor la vede nella scheda
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Pia Prova" }).first().locator("button[data-act=apri-scheda]").first().click();
await page.locator(".card h2", { hasText:"Pia Prova" }).waitFor();
check(await page.getByText("Prossima qualifica: Smeraldo").isVisible(), "lo sponsor vede la prossima qualifica nella scheda");
await ctx.close();
// Pia corregge: era Oro, non Platino → la prossima qualifica si toglie
({ ctx, page } = await telefonoPia());
await page.getByText("Ciao Pia").waitFor(); await apriTappa(page);
await page.click("button[role=tab][data-act=vista-obiettivo]");
await page.click(".prossima-qualifica button[data-act=partenza]");
check(await page.locator(".sheet select[name=prossima]").inputValue() === "smeraldo", "Modifica: la prossima qualifica già scelta");
await page.selectOption(".sheet select[name=qualifica]", "oro");
check(await page.locator(".sheet [data-etichetta-mese]").innerText() === "Mese della prima qualifica Argento", "con Oro si chiede il mese della prima qualifica Argento");
await page.click(".sheet button.primary");
check((await page.locator(".sheet .errore").innerText()).includes("mese della prima qualifica argento"), "il mese della prima Argento è obbligatorio");
await page.fill(".sheet input[name=mese]", mesePrec);
await page.click(".sheet button.primary");
await page.getByText("Punto di partenza aggiornato").waitFor();
await sync(page); await ctx.close();
check(DB.partners.find(p => p.id === pia.id).prossima_qualifica == null, "scendendo sotto Platino la prossima qualifica si toglie");

// 33. Il percorso oltre Argento: Argento → Oro (3 mesi al 21%) → Platino (6 mesi, 3 di fila), report dei mesi passati
{
  const mm = n => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  ({ ctx, page } = await apri({}, invitoPer("R", "Gaia Prova", "7200001")));
  await page.getByText("Benvenuto in Growup").waitFor();
  await page.selectOption("select[name=qualifica]", "argento");
  check(await page.locator("[data-etichetta-mese]").innerText() === "Mese della prima qualifica Argento" && await page.locator("[data-mostra=pagamenti]").isHidden(),
    "Argento: si chiede il mese della prima qualifica Argento (senza pagamenti)");
  await page.fill("input[name=mese]", mm(-3));
  await page.check("input[name=privacy]"); await page.click("form button.primary");
  await perche(page);
  await page.getByText("Ciao Gaia").waitFor(); await apriTappa(page);
  const reqOro = page.locator(".req li", { hasText:"Mesi da Argento (21%)" });
  check(await page.locator(".miei-numeri .riga-apri b", { hasText:/^Oro$/ }).isVisible() && (await reqOro.locator(".num").innerText()) === "0 / 3", "dopo Argento la tappa è Oro: 0 mesi su 3");
  check(await page.locator(".report-da-importare .mesi-report li").count() === 3 && !(await page.locator(".report-da-importare li.ok").count()),
    "report da importare: i 3 mesi dalla prima qualifica Argento");
  // il report di un mese chiuso: solo numeri (033: chi è nella mappa può importare)
  await confermaCodice(page, "7200001");
  const gaia = persona(1, "1000000", "7200001", "PROVA, GAIA", "120"); gaia[10] = "'10.500,00"; gaia[13] = "'21%";
  await scegliFile(page, "passato.csv", creaCsv(mm(-3).replace("-", ""), [gaia]));
  await page.locator(".sheet h2", { hasText:"Numeri salvati" }).waitFor();
  check(await page.locator(".sheet .imp-numeri").isVisible(), "046: la mappa di un mese precedente: si salvano subito solo i numeri");
  await page.getByText(/numeri di .* salvati/).waitFor();
  await page.click(".sheet button[data-act=chiudi]");
  check((await reqOro.locator(".num").innerText()) === "1 / 3" && await page.locator(".report-da-importare li.ok").count() === 1, "un mese al 21%: 1 su 3, il mese segnato ✓");
  const sessGaia = await page.evaluate(() => localStorage.getItem("mock.session"));
  await sync(page); await ctx.close();
  const gaiaId = DB.partners.find(p => p.nome === "Gaia Prova").id;
  const numeroG = (chi, m, perc) => { DB.numeri = DB.numeri.filter(x => !(x.visto_da === chi && x.partner_id === gaiaId && x.mese === m))
    .concat([{ visto_da:chi, partner_id:gaiaId, mese:m, vpg:10500, percentuale:perc, linee:[] }]); };
  numeroG(gaiaId, mm(-2), 21); numeroG(gaiaId, mm(-1), 21);
  const telefonoGaia = () => apri({ storageState:{ cookies:[], origins:[{ origin:"http://127.0.0.1:8765", localStorage:[{ name:"mock.session", value:sessGaia }] }] } }, "");
  ({ ctx, page } = await telefonoGaia());
  await page.getByText("Ciao Gaia").waitFor(); await apriTappa(page);
  check(await page.getByText("✓ Oro").isVisible() && await page.locator(".miei-numeri .riga-apri b", { hasText:/^Platino$/ }).isVisible()
    && (await page.locator(".req li", { hasText:"Mesi da Argento (21%)" }).locator(".num").innerText()) === "3 / 6", "3 mesi al 21%: Oro fatto, tappa Platino 3 su 6");
  check(!(await page.locator(".report-da-importare").count()), "tutti i report importati: il riquadro sparisce");
  await ctx.close();
  // 038: al 21% con una sola linea al 21% serve che restino almeno 4.000 VP fuori da quella linea
  DB.partners.push({ id:"g21", nome:"Linea Ventuno", sponsor_id:gaiaId, stato:"gestito", codice_amway:"7200099", codice_invito:"G21XXX" });
  DB.numeri.push({ visto_da:gaiaId, partner_id:"g21", mese:mm(-4), vpg:9000, percentuale:21, linee:[] });
  DB.numeri.push({ visto_da:gaiaId, partner_id:gaiaId, mese:mm(-4), vpg:12000, percentuale:21, linee:[{ codice:"7200099", vpg:9000 }] });
  ({ ctx, page } = await telefonoGaia());
  await page.getByText("Ciao Gaia").waitFor(); await apriTappa(page);
  check((await page.locator(".req li", { hasText:"Mesi da Argento (21%)" }).locator(".num").innerText()) === "3 / 6",
    "038: 21% con una linea al 21% e 3.000 VP rimanenti: solo 21%, non conta come mese da Argento");
  await ctx.close();
  DB.numeri.find(x => x.partner_id === gaiaId && x.mese === mm(-4)).linee = [{ codice:"7200099", vpg:7000 }];
  ({ ctx, page } = await telefonoGaia());
  await page.getByText("Ciao Gaia").waitFor(); await apriTappa(page);
  check((await page.locator(".req li", { hasText:"Mesi da Argento (21%)" }).locator(".num").innerText()) === "4 / 6",
    "038: con 5.000 VP rimanenti fuori dalla linea al 21% il mese conta");
  await ctx.close();
  DB.numeri = DB.numeri.filter(x => !(x.mese === mm(-4) && (x.partner_id === gaiaId || x.partner_id === "g21")));
  DB.partners = DB.partners.filter(p => p.id !== "g21");
  // lo sponsor: i mesi da Argento dai report che ha importato lui
  numeroG("R", mm(-2), 21); numeroG("R", mm(-1), 21);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li", { hasText:"Gaia Prova" }).first().locator("button[data-act=apri-scheda]").first().click();
  await page.locator(".mesi-argento").waitFor();
  check((await page.locator(".mesi-argento").innerText()).startsWith("Mesi da Argento: 3 su 6 per Platino"), "033: lo sponsor vede i mesi da Argento di Gaia (anche quelli importati da lei)");
  await ctx.close();
  // altri 3 mesi al 21%: 6 mesi, 3 di fila → Platino riconosciuto e la domanda della prossima qualifica
  numeroG(gaiaId, mm(-6), 21); numeroG(gaiaId, mm(-5), 21); numeroG(gaiaId, mm(-4), 21);
  ({ ctx, page } = await telefonoGaia());
  await page.getByText("Ciao Gaia").waitFor(); await apriTappa(page);
  await page.locator(".sheet h2", { hasText:"Platino! Qual è la tua prossima qualifica?" }).waitFor();
  check(!(await page.locator(".sheet select[name=prossima] option", { hasText:/^Oro$/ }).count()), "Platino riconosciuto: la prossima qualifica, solo sopra Platino");
  await page.selectOption(".sheet select[name=prossima]", "rubino");
  await page.click(".sheet button.primary");
  await page.getByText("Prossima qualifica salvata").waitFor(); await apriTappa(page);
  check(await page.getByText("Platino raggiunto 🎉").isVisible() && await page.getByText("Prossima qualifica: Rubino").isVisible(), "Io: Platino raggiunto, prossima Rubino");
  await sync(page); await ctx.close();
  const g2 = DB.partners.find(p => p.id === gaiaId);
  check(g2.qualifica_iniziale === "platino" && g2.prossima_qualifica === "rubino", "salvati Platino e la prossima qualifica");
}

// 34. «Come arrivarci» da Argento a Platino (testi della tavola v2, dati inventati)
{
  const mm = n => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  const chiaveLea = "c0".repeat(16);
  DB.partners.push({ id:"lea", nome:"Lea Prova", sponsor_id:"R", stato:"attivo", chiave:chiaveLea, codice_invito:"LEALEA", codice_amway:"7300001",
    qualifica_iniziale:"argento", qualifica_iniziale_mese:mm(-2) + "-01", privacy_accettata_il:"2026-10-01T00:00:00Z",
    partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
  DB.partners.push({ id:"la1", nome:"Linea Uno", sponsor_id:"lea", stato:"gestito", gestore_id:"lea", codice_amway:"7300002", codice_invito:"LA1LA1", creato_il:new Date().toISOString() });
  const numeriLea = (chi, m, vpg, perc, linee) => { DB.numeri = DB.numeri.filter(x => !(x.visto_da === "lea" && x.partner_id === chi && x.mese === m))
    .concat([{ visto_da:"lea", partner_id:chi, mese:m, vpg, percentuale:perc, linee:linee || [] }]); };
  const consigliLea = async () => {
    ({ ctx, page } = await apri({}, "#chiave=" + chiaveLea));
    await page.getByText("Ciao Lea").waitFor(); await apriTappa(page);
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    await page.click("button[role=tab][data-act=vista-obiettivo]");
    const c = page.locator("details.consigli"); await c.waitFor(); await c.locator("summary").click();
    return c;
  };
  // manca il report del mese scorso
  numeriLea("lea", mm(-2), 10500, 21);
  let c = await consigliLea();
  check(await c.getAttribute("data-chiave") === "report_mancanti" && await c.getByText(`Prima di tutto importa il report di`).isVisible(), "Argento: prima i report mancanti");
  check(await c.getByText("Mesi da Argento negli ultimi 12 mesi: 1 su 3 per Oro").isVisible(), "la riga fissa dei mesi da Argento");
  await ctx.close();
  // vicino al 21% questo mese (8.500 VPG)
  numeriLea("lea", mm(-1), 7000, 18); numeriLea("lea", mm(0), 8500, 18, [{ codice:"7300002", vpg:3000 }]); numeriLea("la1", mm(0), 3000, 12);
  c = await consigliLea();
  check(await c.getAttribute("data-chiave") === "mese_vicino" && await c.getByText("per il 21% ne mancano 1.500. Lavora con le tue linee").isVisible(), "vicino al 21%: mancano 1.500 VP");
  check(await c.locator("th", { hasText:/^%$/ }).count() === 1 && (await c.locator("tr", { hasText:"Linea Uno" }).locator("td").nth(1).innerText()) === "12%", "la tabellina con la % della linea");
  await ctx.close();
  // una linea al 21% e meno di 4.000 VP di gruppo fuori da quella linea (038: 13.400 − 10.400 = 3.000 rimanenti)
  numeriLea("lea", mm(0), 13400, 15, [{ codice:"7300002", vpg:10400 }]); numeriLea("la1", mm(0), 10400, 21);
  c = await consigliLea();
  check(await c.getAttribute("data-chiave") === "linea_21" && await c.getByText("La linea di Linea Uno è al 21%").isVisible() && await c.getByText("ne mancano 1.000").isVisible(),
    "una linea al 21%: servono 4.000 VP fuori dalla linea, ne mancano 1.000");
  await ctx.close();
  // una linea vicina al 21%
  numeriLea("lea", mm(0), 5000, 15, [{ codice:"7300002", vpg:8200 }]); numeriLea("la1", mm(0), 8200, 18);
  c = await consigliLea();
  check(await c.getAttribute("data-chiave") === "linea_verso_21" && await c.getByText("Affiancala: aiutare Linea Uno a diventare Argento").isVisible(), "una linea vicina al 21%");
  await ctx.close();
  // questo mese al 21%
  numeriLea("lea", mm(0), 10200, 21, [{ codice:"7300002", vpg:3000 }]); numeriLea("la1", mm(0), 3000, 12);
  c = await consigliLea();
  check(await c.getAttribute("data-chiave") === "mese_ok" && await c.getByText("con questo mese arrivi a 2 su 3 per Oro").isVisible()
    && !(await c.getByText("tienilo").count()), "questo mese al 21%: 2 su 3 per Oro");
  await ctx.close();
  // lo sponsor: nella scheda di Lea, in terza persona
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li", { hasText:"Lea Prova" }).first().locator("button[data-act=apri-scheda]").first().click();
  await page.locator(".card h2", { hasText:"Lea Prova" }).waitFor();
  const lui = page.locator("details.consigli"); await lui.waitFor(); await lui.locator("summary").click();
  check(await lui.getAttribute("data-chiave") === "mese_ok" && await lui.getByText(/^Questo mese è al 21%/).isVisible(), "033: scheda con i numeri importati da Lea, in terza persona");
  await ctx.close();
  // 6 mesi ma non 3 di fila: tappa Platino, fila in corso 1
  const lea = DB.partners.find(p => p.id === "lea"); lea.qualifica_iniziale_mese = mm(-11) + "-01";
  for(let k = -11; k <= -1; k++) numeriLea("lea", mm(k), k % 2 ? 10500 : 7000, k % 2 ? 21 : 18);
  numeriLea("lea", mm(0), 5000, 15, []);
  c = await consigliLea();
  check(await c.getAttribute("data-chiave") === "fila" && await c.getByText("Hai 6 mesi da Argento, ma non ancora 3 di fila").isVisible()
    && await c.getByText("Il mese scorso eri al 21%: questo mese è il secondo dei 3.").isVisible(), "6 mesi senza 3 di fila: questo mese è il secondo dei 3");
  check(await c.getByText("· 3 di fila ○ (1 su 3)").isVisible(), "riga fissa: 3 di fila non ancora");
  await ctx.close();
}

// 35. Da Platino in su: i mesi del Performance Year dai report (Smeraldo: linee al 21%; Zaffiro: mesi Zaffiro)
{
  const mm = n => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  const ora = oggiStr.slice(0, 7), set = `${Number(ora.slice(5)) >= 9 ? ora.slice(0, 4) : Number(ora.slice(0, 4)) - 1}-09`;
  const mesiPY = []; for(let k = 0; mm(-k) >= set; k++) mesiPY.unshift(mm(-k));
  const chiavePf = "d0".repeat(16);
  DB.partners.push({ id:"pf", nome:"Pino Fondatore", sponsor_id:"R", stato:"attivo", chiave:chiavePf, codice_invito:"PFPFPF", codice_amway:"7400001",
    qualifica_iniziale:"platino_fondatore", prossima_qualifica:"smeraldo", privacy_accettata_il:"2026-10-01T00:00:00Z",
    partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
  for(const [id, nome, cod] of [["pf1", "Linea Prima", "7400002"], ["pf2", "Linea Seconda", "7400003"], ["pf3", "Linea Terza", "7400004"]])
    DB.partners.push({ id, nome, sponsor_id:"pf", stato:"gestito", gestore_id:"pf", codice_amway:cod, codice_invito:id.toUpperCase() + "XX", creato_il:new Date().toISOString() });
  const nPf = (chi, m, vpg, perc) => { DB.numeri = DB.numeri.filter(x => !(x.visto_da === "pf" && x.partner_id === chi && x.mese === m))
    .concat([{ visto_da:"pf", partner_id:chi, mese:m, vpg, percentuale:perc, linee:[] }]); };
  /* ogni mese del PY: io a 5.000 VPG; Prima sempre al 21%, Seconda al 21% solo nel primo mese, Terza mai */
  mesiPY.forEach((m, i) => { nPf("pf", m, 5000, 21); nPf("pf1", m, 10500, 21); nPf("pf2", m, i === 0 ? 10200 : 7000, i === 0 ? 21 : 18); nPf("pf3", m, 900, 9); });
  DB.numeri = DB.numeri.filter(x => !(x.visto_da === "pf" && x.partner_id === "pf" && x.mese === ora))
    .concat([{ visto_da:"pf", partner_id:"pf", mese:ora, vpg:5000, percentuale:21,
      linee:[{ codice:"7400002", vpg:10500 }, { codice:"7400003", vpg:7000 }, { codice:"7400004", vpg:900 }] }]);
  const apriPf = async () => { ({ ctx, page } = await apri({}, "#chiave=" + chiavePf)); await page.getByText("Ciao Pino").waitFor(); await apriTappa(page);
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]"); };
  await apriPf();
  check(await page.getByText(`Prossima qualifica: Smeraldo · linee al 21% per almeno 6 mesi: 0 / 3`).isVisible(), "Io: Smeraldo, linee al 21% da 6 mesi");
  await page.click("button[role=tab][data-act=vista-obiettivo]");
  const pq = page.locator(".prossima-qualifica");
  check((await pq.locator(".req li", { hasText:"Linee al 21% per almeno 6 mesi" }).locator(".num").innerText()) === "0 / 3"
    && (await pq.locator(".req li", { hasText:"Report mappe importati da settembre" }).locator(".num").innerText()) === `${mesiPY.length} / ${mesiPY.length}`,
    "Obiettivo: Smeraldo 0 su 3 e i report del Performance Year");
  const riga = n => pq.locator(".linee-py tr", { hasText:n }).locator("td");
  check((await riga("Linea Prima").nth(1).innerText()) === String(mesiPY.length) && (await riga("Linea Prima").nth(2).innerText()) === "21%"
    && (await riga("Linea Seconda").nth(1).innerText()) === "1" && (await riga("Linea Terza").nth(1).innerText()) === "0", "le linee nel Performance Year: mesi al 21%");
  await page.click(".prossima-qualifica button[data-act=partenza]");
  check(await page.locator(".sheet .field span", { hasText:"La tua qualifica attuale" }).isVisible(), "l'etichetta: La tua qualifica attuale");
  await page.selectOption(".sheet select[name=prossima]", "zaffiro");
  await page.click(".sheet button.primary");
  await page.getByText("Punto di partenza aggiornato").waitFor();
  check((await page.locator(".prossima-qualifica .req li", { hasText:"Mesi Zaffiro" }).locator(".num").innerText()) === "1 / 6",
    "Zaffiro: solo il primo mese ha 2 linee al 21% (e 4.000 VP)");
  await ctx.close();
}

// 36. Più report insieme: due mesi chiusi (solo numeri) e il mese in corso dopo, con la sua anteprima
{
  const mm = n => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  DB.numeri = DB.numeri.filter(x => x.visto_da !== "lea");
  const riga = perc => { const r = persona(1, "1000000", "7300001", "PROVA, LEA", "120"); r[10] = "'10.500,00"; r[13] = `'${perc}%`; return r; };
  ({ ctx, page } = await apri({}, "#chiave=" + "c0".repeat(16)));
  await page.getByText("Ciao Lea").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  if(!(await page.locator("input.file-amway").count())) await page.click("button[data-act=vista-gruppo]");
  check(await page.locator("input.file-amway").first().getAttribute("multiple") !== null, "si possono scegliere più file");
  await mettiFile(page, [
    { name:"mese-a.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(mm(-3).replace("-", ""), [riga(21)])) },
    { name:"mese-b.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(mm(-2).replace("-", ""), [riga(18)])) },
    { name:"ora.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(mm(0).replace("-", ""), [riga(15)])) },
    { name:"sbagliato.csv", mimeType:"text/csv", buffer:Buffer.from("niente") }]);
  await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
  check(await page.locator(".sheet .imp-numeri ul.imp li").count() === 2 && await page.getByText("sbagliato.csv:").isVisible(),
    "più file insieme: 2 mesi precedenti salvati come numeri, la mappa più recente importata, il file sbagliato segnalato con il nome");
  await sync(page);
  check(DB.numeri.filter(x => x.visto_da === "lea" && x.partner_id === "lea" && [mm(-3), mm(-2)].includes(x.mese)).length === 2, "salvati i numeri dei due mesi chiusi");
  check(DB.ultimoImport && DB.ultimoImport.p_io && !/\+39|@|esempio|Citta|Principale|gennaio|dicembre/i.test(JSON.stringify(DB.ultimoImport)),
    "privacy: anche dai mesi chiusi niente telefono, email, indirizzo né data di rinnovo");
  check((DB.numeri.filter(x => x.partner_id === "lea" && x.mese === mm(0)).pop() || {}).percentuale === 15, "e la mappa del mese più recente è importata subito");
  await ctx.close();
}

// 37. La cifra porta anche oltre Argento: sempre la qualifica senza "Fondatore", Oro mai
{
  const obiettivoDi = async cifra => {
    DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id !== "R").concat([{ partner_id:"R", cifra_mese:cifra, entro:"2027-12-01", perche:"Per la famiglia" }]);
    ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
    await page.click("button[role=tab][data-act=vista-obiettivo]");
    const h = (await page.locator(".card", { hasText:"La tappa che vale la tua cifra" }).locator("h2").innerText()).trim();
    await ctx.close(); return h;
  };
  check(await obiettivoDi(8000) === "Smeraldo", "8.000 € al mese → Smeraldo (non Smeraldo Fondatore)");
  check(await obiettivoDi(2800) === "Platino", "2.800 € → Platino (Argento vale 2.500 senza incentivi Bronze)");
  check(await obiettivoDi(2400) === "Argento 21%", "2.400 € → Argento");
  check(await obiettivoDi(4500) === "Zaffiro", "4.500 € → Zaffiro (oltre Rubino 4.000)");
  check(await obiettivoDi(30000) === "Diamante", "oltre l'ultima cifra → Diamante, e oltre");
}

// 38. Una sola struttura: la data del file decide, chi è in attesa non importa
{
  /* 046: la data del file non decide più niente (decide il mese di competenza): i controlli sono nella sezione 51 */
  // chi è appena entrato (in attesa) non può importare
  ({ ctx, page } = await apri({}, invitoPer("R", "Quinto Prova", "7500001")));
  await page.getByText("Benvenuto in Growup").waitFor();
  await page.selectOption("select[name=qualifica]", "pin:3");
  await page.check("input[name=privacy]"); await page.click("form button.primary");
  await perche(page);
  await page.getByText("Ciao Quinto").waitFor(); await apriTappa(page);
  check(await page.locator(".primi-passi .stato-attesa").isVisible(), "Quinto: in attesa della mappa");
  await scegliFile(page, "quinto.csv", creaCsv(meseFile, [persona(1, "9", "7500001", "PROVA, QUINTO", "50,00")]));
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).startsWith("Sei ancora in attesa della mappa"), "chi è in attesa non cambia la struttura degli altri");
  await ctx.close();
}

// 39. Le mie bozze (034, 063): anche più di una, con nome e cliente; la stima del mese; confermate vanno nello storico senza VP
{
  DB.listino = [{ codice:"9100001", nome:"Crema Prova", formato:"50 ml", categoria:"Bellezza", prezzo_cliente:52.9, prezzo_partner:41.3, vp:18.2, attivo:true },
    { codice:"9100002", nome:"Detersivo Prova", formato:"1 l", categoria:"Casa", prezzo_cliente:17.6, prezzo_partner:13.7, vp:6.1, attivo:true }];
  DB.ordiniMiei = []; DB.righeMie = [];
  const unOraFa = new Date(Date.now() - 3600000).toISOString();
  DB.numeri = DB.numeri.filter(x => !(x.partner_id === "R" && x.mese === oggiStr.slice(0, 7)))
    .concat([{ visto_da:"R", partner_id:"R", mese:oggiStr.slice(0, 7), vpp:300, vpg:5000, percentuale:15, linee:[], dati_al:unOraFa }]);
  DB.activities = DB.activities.filter(a => a.partner_id !== "R")
    .concat([{ id:"prima1", partner_id:"R", tipo:"ordine", quantita:1, vp:40, data:oggiStr, inserito_da:"R", inserito_il:new Date(Date.now() - 7200000).toISOString() }]);
  DB.mgoals = DB.mgoals.filter(x => x.partner_id !== "R").concat([{ partner_id:"R", mese:oggiStr.slice(0, 7) + "-01", obiettivo_vp:400 }]);
  DB.persone = (DB.persone || []).concat([{ id:"cl39", proprietario:"R", nome:"Clara Bozza", fase:"contattato", esito:"cliente", lasciati:[], creato_il:unOraFa }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await apriMese(page); const mese = page.locator(".card", { hasText:"Il mio mese" });
  const vpFatti = async () => (await mese.locator(".obiettivo", { hasText:"VP personali" }).locator(".num").innerText()).split("/")[0].trim();
  check(await vpFatti() === "300", "063: l'ordine scritto non si somma: 300 VP dalla mappa");
  check((await mese.locator(".vp-report").innerText()) === "Mappa " + delGiornoIt(unOraFa), "063: la riga dice da quale mappa viene il numero");
  check(!(await page.locator("#bozza-ordine").count()) && !(await page.locator("#miei-ordini").count()), "bozze e storico non sono nella pagina Io");
  // «Le mie bozze»: l'elenco vuoto, «+ Nuova bozza»
  await apriOrdini(page, "apri-bozze");
  const elenco = page.locator(".sheet #le-mie-bozze");
  check(await elenco.getByText("Ancora nessuna bozza.").isVisible() && await elenco.locator("button[data-act=bozza-nuova]").isVisible(), "063: Le mie bozze: vuoto, con «+ Nuova bozza»");
  await elenco.locator("button[data-act=bozza-nuova]").click();
  const bozza = page.locator(".sheet #bozza-ordine");
  await bozza.waitFor();
  check(await bozza.getByText("Vuota").isVisible() && (await bozza.locator("h2").innerText()).startsWith("Bozza del ")
    && await bozza.getByText("La bozza la vedi solo tu.").isVisible() && !(await bozza.locator("button[data-act=mio-conferma]").count()), "063: la bozza nuova, vuota");
  await page.fill("#cerca-mio", "crema");
  await bozza.locator("button[data-act=mio-aggiungi]").first().click();
  await bozza.getByText("1 prodotto").waitFor();
  await bozza.locator("button[data-act=mio-piu]").click();
  await page.fill("#cerca-mio", "deters");
  check((await bozza.locator("#risultati-mio").innerText()).includes("6,10 VP · Partner 13,70 € · Pubblico 17,60 €"), "nei risultati: VP, prezzo Partner e prezzo al pubblico");
  await bozza.locator("button[data-act=mio-aggiungi]").first().click();
  await bozza.getByText("2 prodotti").waitFor();
  check((await bozza.locator(".righe-ordine li", { hasText:"Crema Prova" }).innerText()).includes("18,20 VP · Partner 41,30 € · Pubblico 52,90 €"), "per ogni prodotto VP, Partner e Pubblico");
  check((await bozza.locator(".tot-mio").innerText()).replace(/\s+/g, " ") === "42,50 VP · Partner 96,30 € · Pubblico 123,40 €", "il totale: VP, Partner e Pubblico");
  // la stima per la chiusura del mese: mappa + bozza, e l'obiettivo
  const stima = (await bozza.locator(".stima-bozza").innerText()).replace(/\s+/g, " ");
  check(stima.includes("Con questa bozza arriveresti a 342,5 VP") && stima.includes("300 VP della mappa " + delGiornoIt(unOraFa) + " + 42,50 VP della bozza")
    && stima.includes("ti mancherebbero 57,5 VP") && stima.includes("stima: non conta finché non arriva la mappa"), "063: la stima: mappa + bozza, quanto manca all'obiettivo (" + stima + ")");
  // il nome della bozza
  await page.fill("#bozza-nome", "Fine mese"); await page.press("#bozza-nome", "Tab");
  await page.getByText("Nome della bozza salvato").waitFor();
  check((await bozza.locator("h2").innerText()).trim() === "Fine mese", "063: la bozza ha il suo nome");
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/39-bozza-ordine.png" });
  // una seconda bozza, per un cliente: arriva all'obiettivo
  await page.click(".sheet #bozza-ordine button[data-act=apri-bozze]");
  await page.click(".sheet #le-mie-bozze button[data-act=bozza-nuova]");
  await bozza.waitFor();
  await page.selectOption("#bozza-cliente", "cl39");
  await page.getByText("Cliente della bozza salvato").waitFor();
  await page.fill("#cerca-mio", "crema");
  await bozza.locator("button[data-act=mio-aggiungi]").first().click();
  await bozza.getByText("1 prodotto").waitFor();
  for(let i = 0; i < 5; i++){ await bozza.locator("button[data-act=mio-piu]").click(); await page.waitForTimeout(100); }
  await bozza.getByText(/^6$/).first().waitFor();
  check((await bozza.locator(".stima-bozza").innerText()).includes("obiettivo del mese raggiunto ✓"), "063: con la bozza si arriverebbe all'obiettivo: ✓");
  await page.click(".sheet #bozza-ordine button[data-act=apri-bozze]");
  const voci = await page.locator(".sheet .elenco-bozze li").allInnerTexts();
  check(voci.length === 2 && voci.some(t => t.includes("Fine mese") && t.includes("2 prodotti · 42,50 VP · Partner 96,30 €"))
    && voci.some(t => t.includes("Clara Bozza") && t.includes("1 prodotto · 109,20 VP")), "063: Le mie bozze: due bozze, con nome, cliente, VP e prezzo (" + voci.join(" | ") + ")");
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/39-le-mie-bozze.png" });
  await page.click(".sheet #le-mie-bozze button[data-act=ordini]");
  check((await page.locator(".sheet .scelta-ordini", { hasText:"Le mie bozze" }).innerText()).includes("2 bozze"), "il foglio Ordini dice quante bozze ci sono");
  await sync(page);
  check(DB.ordiniMiei.length === 2 && DB.ordiniMiei.every(o => o.stato === "bozza") && DB.ordiniMiei.some(o => o.nome === "Fine mese")
    && DB.ordiniMiei.some(o => o.persona_id === "cl39") && DB.righeMie.length === 3, "063: le due bozze sono salvate nel database");
  check(!DB.activities.some(a => a.partner_id === "R" && a.id !== "prima1"), "063: le bozze non scrivono VP");
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await apriOrdini(page, "apri-bozze");
  check(await page.locator(".sheet .elenco-bozze li").count() === 2, "riaprendo l'app le bozze ci sono ancora");
  // confermo «Fine mese» con una data del mese scorso: nessun limite di mese chiuso, va nello storico senza VP
  await page.locator(".sheet .elenco-bozze button[data-act=bozza-apri]", { hasText:"Fine mese" }).click();
  await page.click("#bozza-ordine button[data-act=mio-conferma]");
  await page.locator(".sheet").getByText("Confermi l'ordine?").waitFor();
  check((await page.locator("#testo-conferma-mio").innerText()).includes("Non cambia i VP del mese: arrivano con la mappa Amway")
    && !(await page.locator(".sheet input[name=data]").getAttribute("min")), "063: conferma: non cambia i VP, nessun limite di mese chiuso sulla data");
  await page.click(".sheet button[data-act=bozza-apri]");
  check((await page.locator(".sheet #bozza-ordine h2").innerText()).trim() === "Fine mese", "conferma, Indietro: si torna alla bozza");
  await page.click("#bozza-ordine button[data-act=mio-conferma]");
  const dataPrec = mesePrec + "-15";
  await page.fill(".sheet input[name=data]", dataPrec);
  await page.click(".sheet button.primary");
  await page.getByText("Ordine confermato: è nello storico").waitFor();
  const storico = page.locator(".sheet #miei-ordini");
  check(await storico.isVisible() && (await storico.innerText()).includes("Fine mese") && (await storico.innerText()).includes("42,50 VP"), "063: l'ordine confermato è nello storico, con il nome e la data");
  await apriMese(page); const mese2 = page.locator(".card", { hasText:"Il mio mese" });
  check((await mese2.locator(".obiettivo", { hasText:"VP personali" }).locator(".num").innerText()).startsWith("300"), "063: dopo la conferma i VP restano quelli della mappa (300)");
  // confermo la bozza di Clara: entra anche nella sua scheda
  await page.click(".sheet #miei-ordini button[data-act=ordini]");
  await page.click(".sheet button[data-act=apri-bozze]");
  await page.locator(".sheet .elenco-bozze button[data-act=bozza-apri]", { hasText:"Clara Bozza" }).click();
  await page.click("#bozza-ordine button[data-act=mio-conferma]");
  check((await page.locator("#testo-conferma-mio").innerText()).includes("Entra anche nella scheda di Clara Bozza"), "063: la conferma dice che entra nella scheda del cliente");
  await page.click(".sheet button.primary");
  await page.getByText("Ordine confermato: nello storico e nella scheda di Clara").waitFor();
  await sync(page);
  const ocClara = DB.ordiniMiei.find(o => o.persona_id === "cl39");
  check(ocClara && ocClara.stato === "confermato" && ocClara.ordine_cliente_id && DB.ordini.some(o => o.id === ocClara.ordine_cliente_id && o.persona_id === "cl39" && o.modo === "io")
    && DB.righe.filter(r => r.ordine_id === ocClara.ordine_cliente_id).length === 1, "063: con un cliente, l'ordine è anche nella sua scheda, con i prodotti");
  check(DB.ordiniMiei.find(o => o.nome === "Fine mese").data === dataPrec && !DB.activities.some(a => a.partner_id === "R" && a.id !== "prima1"),
    "063: confermato con la sua data, nessun VP nel mese");
  check((await storico.innerText()).includes("Clara Bozza"), "nello storico si vede il cliente");
  await storico.locator("button[data-act=mio-apri]").first().click();
  check((await storico.innerText()).includes("× Crema Prova"), "toccando l'ordine si vedono i prodotti");
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/39-miei-ordini.png" });
  // Rifai: una bozza nuova con gli stessi prodotti
  await storico.locator("li", { hasText:"Fine mese" }).locator("button[data-act=mio-rifai]").click();
  await page.getByText("Nuova bozza con gli stessi prodotti").waitFor();
  check(await page.locator("#bozza-ordine").getByText("2 prodotti").isVisible()
    && (await page.locator("#bozza-ordine .tot-mio").innerText()).startsWith("42,50"), "Rifai: una bozza nuova con gli stessi prodotti e quantità");
  await page.click("#bozza-ordine button[data-act=mio-svuota]");
  await page.getByText("Bozza tolta").waitFor();
  check(await page.locator(".sheet #le-mie-bozze").getByText("Ancora nessuna bozza.").isVisible(), "063: tolta la bozza, si torna all'elenco");
  // togli l'ordine di Clara: anche dalla sua scheda
  await page.click(".sheet #le-mie-bozze button[data-act=ordini]");
  await page.click(".sheet button[data-act=apri-miei]");
  await storico.locator("li", { hasText:"Clara Bozza" }).locator("button[data-act=mio-togli]").click();
  await page.locator(".sheet h2", { hasText:"Togli l'ordine del" }).waitFor();
  check((await page.locator(".sheet").innerText()).includes("Lo togli anche dalla scheda di Clara Bozza"), "063: togli: anche dalla scheda del cliente");
  await page.click(".sheet [data-act=apri-miei]");
  check(await page.locator("#miei-ordini button[data-act=mio-togli]").count() === 2, "Indietro: l'ordine resta");
  await storico.locator("li", { hasText:"Clara Bozza" }).locator("button[data-act=mio-togli]").click();
  await page.click(".sheet [data-act=mio-togli-ok]");
  await page.getByText("Ordine tolto").waitFor();
  await sync(page);
  check(!DB.ordini.some(o => o.id === ocClara.ordine_cliente_id) && !DB.ordiniMiei.some(o => o.id === ocClara.id), "063: tolto dallo storico e dalla scheda del cliente");
  await storico.locator("button[data-act=mio-togli]").click();
  await page.click(".sheet [data-act=mio-togli-ok]");
  await page.getByText("Ordine tolto").waitFor();
  await apriMese(page); check(await page.locator("#miei-ordini").getByText("Ancora nessun ordine confermato").isVisible()
    && (await page.locator(".card", { hasText:"Il mio mese" }).locator(".obiettivo", { hasText:"VP personali" }).locator(".num").innerText()).startsWith("300"),
    "ordini tolti: via dallo storico, i VP restano quelli della mappa");
  await sync(page);
  check(!DB.ordiniMiei.length && !DB.righeMie.length, "nel database: via gli ordini e i prodotti");
  await ctx.close();
  DB.persone = DB.persone.filter(x => x.id !== "cl39");
}

// 40. La barra oltre l'obiettivo e la qualifica dello storico dall'anno fiscale
{
  const R = DB.partners.find(p => p.id === "R"), primaQ = R.qualifica_iniziale;
  R.qualifica_iniziale = "platino_fondatore";
  const numeroR = vpg => { DB.numeri = DB.numeri.filter(x => !(x.partner_id === "R" && x.mese === oggiStr.slice(0, 7)))
    .concat([{ visto_da:"R", partner_id:"R", mese:oggiStr.slice(0, 7), vpp:400, vpg, percentuale:21, linee:[], dati_al:new Date(Date.now() - 3600000).toISOString() }]); };
  numeroR(12000);
  DB.activities = DB.activities.filter(a => a.partner_id !== "R")
    .concat([{ id:"dopo40", partner_id:"R", tipo:"ordine", quantita:1, vp:300, data:oggiStr, inserito_da:"R", inserito_il:new Date().toISOString() }]);
  const storicoR = async () => {
    ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
    await apriMese(page); await page.click(".card button[data-act=storico]");
    await page.locator(".sheet .storico li").first().waitFor();
    return (await page.locator(".sheet .storico li").first().innerText()).replace(/\s+/g, " ");
  };
  let t = await storicoR();
  check(!/Diamante|Fondatore/.test(t), "storico: niente più Diamante Fondatore inventato (" + t + ")");
  await page.click(".sheet [data-act=chiudi]");
  await apriMese(page); const parti = await page.locator(".card", { hasText:"Il mio mese" }).locator(".obiettivo", { hasText:"VP personali" }).locator(".bar > i").evaluateAll(l => l.map(i => parseFloat(i.style.width)));
  check(parti.length === 1 && parti[0] === 100 && (await page.locator(".card", { hasText:"Il mio mese" }).locator(".obiettivo", { hasText:"VP personali" }).locator(".num").innerText()).startsWith("400"),
    "063: oltre l'obiettivo la barra è piena con i soli VP della mappa (400), l'ordine scritto non conta (" + parti.join(" + ") + ")");
  await ctx.close();
  numeroR(21000);
  t = await storicoR();
  check(t.includes("Qualifica: Rubino"), "storico: un mese Rubino nell'anno fiscale (da Platino) → Rubino (" + t + ")");
  await ctx.close();
  R.qualifica_iniziale = primaQ;
}

// 41. La Guida per l'azione (035): pulsanti in cima a Io, piano, Stabilità Cum Laude 21, passi e abitudini
{
  const ora = new Date().toISOString();
  DB.guidaFatti = []; DB.guidaObiettivi = []; DB.numeriCl21 = [];
  /* per la Stabilità: R parte senza mesi chiusi (si rimettono alla fine) */
  const numeriR = DB.numeri || [];
  DB.numeri = numeriR.filter(x => !(x.partner_id === "R" && x.mese < ora.slice(0, 7)));
  DB.partners.push({ id:"g41a", nome:"Entrato Col Link", sponsor_id:"R", stato:"attivo", codice_invito:"G41AAA", codice_amway:"8800001",
    invitato_da:"R", invitato_il:ora, confermato_il:ora, creato_il:ora });
  DB.partners.push({ id:"g41b", nome:"Nuovo Nella Mappa", sponsor_id:"R", stato:"gestito", gestore_id:"R", codice_invito:"G41BBB", codice_amway:"8800002",
    in_mappa_dal:ora, data_iscrizione:ora.slice(0, 10), creato_il:ora });
  /* 056: conta la data di ingresso della mappa; chi è entrato con il link e non è in nessuna mappa no */
  DB.partners.find(p => p.id === "g41a").data_iscrizione = ora.slice(0, 10);
  DB.numeri.push({ visto_da:"R", partner_id:"g41b", mese:ora.slice(0, 7), vpp:0, vpg:0, percentuale:0, linee:[], nascoste:false, dati_al:ora });
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  check(await page.locator(".sezioni-io button[data-sez=giorno]").getAttribute("aria-pressed") === "true", "Io: si apre su «Il mio giorno»");
  check(await page.locator(".guida-stabilita").count() === 0, "la Verifica non è nella pagina di tutti i giorni");
  check((await page.locator(".sezioni-io button[data-sez=guida]").innerText()).trim() === "Verifica", "consegna 3: la linguetta si chiama «Verifica»");
  await page.click(".sezioni-io button[data-sez=guida]");
  await page.locator(".guida-stabilita").waitFor();
  check(await page.locator(".card", { hasText:"Il mio mese" }).count() === 0, "in «Verifica» solo la Verifica");
  check(await page.locator(".guida-piano, .guida-passi").count() === 0 && !(await page.locator("#app").innerText()).includes("Cosa fare adesso"),
    "consegna 3: tolti «Il tuo piano» e «Cosa fare adesso»");
  check(await page.locator("#app button[data-act=seguimi-attivo], #app button[data-act=seguimi-condividi]").count() === 0, "consegna 3: Seguimi e Condividi non sono più nella Verifica");
  check(await page.locator(".analisi-link[data-act=apri-analisi]").isVisible(), "consegna 3: «La mia analisi» in fondo alla Verifica");
  /* Stabilità: si parte sempre dal mese in corso; i mesi prima con le frecce accanto al mese */
  const stab = page.locator(".guida-stabilita");
  const MESI_T = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const meseT = (k, maiusc) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + k);
    const n = MESI_T[d.getMonth()]; return { m:d.toISOString().slice(0, 7), nome:(maiusc ? n[0].toUpperCase() + n.slice(1) : n) + " " + d.getFullYear() }; };
  const tuoDi = async (loc, k) => (await loc.locator(`li[data-k=${k}] .tuo`).innerText()).replace(/^tu\s*/, "").trim();
  check((await stab.locator(".eyebrow").first().textContent()).trim() === "Stabilità della tua rete · tabella CL21", "Stabilità: il titolo");
  await stab.locator("button[data-act=aiuto][data-k=stabilita]").click();
  check((await stab.innerText()).includes("La percentuale la raggiungi con il fatturato"), "Stabilità: nel «?» dice che la percentuale viene dal fatturato");
  check((await stab.innerText()).includes("Si parte dal mese in corso") && (await stab.innerText()).includes("La mia analisi"), "Stabilità: nel «?» il mese in corso, le frecce e il riepilogo in «La mia analisi»");
  await stab.locator("button[data-act=aiuto][data-k=stabilita]").click();
  check(await stab.locator(".stab-legenda span").count() === 3, "Stabilità: la legenda (sostenuto, da rinforzare, il tuo livello)");
  const attesi = DB.partners.filter(p => p.invitato_da === "R" && String(p.invitato_il || "").slice(0, 7) === ora.slice(0, 7)).length;
  check(attesi >= 1 && (await stab.locator(".stab-personali").innerText()).replace(/\s+/g, " ").includes("I tuoi nuovi iscritti · " + meseT(0, false).nome.split(" ")[0] + " entrati con il tuo link " + attesi),
    "Stabilità: i miei nuovi iscritti (entrati con il mio link), a parte sopra la tabella");
  check(await stab.locator(".celle.livelli .cella").count() === 7 && await stab.locator("ul.stabilita li").count() === 5
    && await stab.locator("ul.stabilita li .cella").count() === 35, "Stabilità: 7 livelli e 5 righe con le 7 caselle di riferimento");
  check(!(await stab.innerText()).includes("Ne manca"), "Stabilità: nessuna frase «Ne manca…»");
  check((await stab.locator(".stab-mese b").innerText()).trim() === meseT(0, true).nome + " · mese in corso", "Stabilità: il mese in corso, scritto in evidenza");
  check(await stab.locator("button.freccia-mese[data-d='1']").isDisabled() && await stab.locator("button.freccia-mese[data-d='-1']").isEnabled(),
    "Stabilità: nel mese in corso la freccia avanti è spenta, quella indietro no");
  check(await tuoDi(stab, "nuovi_gruppo") === "1", "Stabilità: i nuovi nel gruppo dagli import (mese in corso)");
  check(await stab.locator("ul.stabilita small", { hasText:"questo mese finora" }).count() === 0 && await stab.locator(".stab-avviso").count() === 0,
    "Stabilità: niente più «questo mese finora» né avvisi");
  check((await stab.locator("li[data-k=app_cl21]").innerText()).includes("da inserire") && await stab.locator("li[data-k=app_cl21] .cella.att").count() === 0
    && await stab.locator(".stab-lavoro p", { hasText:"CumLaude21" }).count() === 0, "Stabilità: un numero non ancora scritto resta neutro, «da inserire», fuori da «Per sostenere»");
  await stab.locator("button[data-act=guida-cl21]").first().click();
  await page.locator(".sheet h2", { hasText:"I tuoi numeri Cum Laude 21" }).waitFor();
  await page.fill(".sheet input[name=app_cl21]", "9"); await page.fill(".sheet input[name=training_day]", "10"); await page.fill(".sheet input[name=convention]", "40");
  await page.click(".sheet button.primary");
  await page.getByText("Numeri salvati").waitFor();
  check(await tuoDi(stab, "convention") === "40", "Stabilità: il numero scritto a mano compare nella sua riga");
  check((await stab.locator("li[data-k=training_day]").innerText()).includes("ultimo evento"), "Stabilità: per il Training Day vale l'ultimo evento");
  await sync(page); await ctx.close();
  /* con la mappa del mese scorso (al 9%): si parte comunque dal mese in corso, con la freccia si va al mese scorso */
  const prec = meseT(-1, true), prec2 = meseT(-2, false);
  DB.numeri = numeriR.filter(x => !(x.partner_id === "R" && x.mese < ora.slice(0, 7))).concat(DB.numeri.filter(n => n.partner_id === "g41b"))
    .concat([{ visto_da:"R", partner_id:"R", mese:prec.m, vpp:300, vpg:4000, percentuale:9, linee:[], nascoste:false, dati_al:prec.m + "-28T10:00:00Z" }]);
  const aGuida = async () => { ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor(); await page.click(".sezioni-io button[data-sez=guida]"); await page.locator(".guida-stabilita").waitFor(); };
  await aGuida();
  const stab2 = page.locator(".guida-stabilita");
  check((await stab2.locator(".stab-mese b").innerText()).trim() === meseT(0, true).nome + " · mese in corso", "Stabilità: anche con un mese chiuso si parte dal mese in corso");
  check(await tuoDi(stab2, "nuovi_gruppo") === "1", "Stabilità: nel mese in corso i nuovi di questo mese");
  await stab2.locator("button.freccia-mese[data-d='-1']").click();
  await stab2.locator(".stab-mese b", { hasText:prec.nome }).waitFor();
  check((await stab2.locator(".stab-mese b").innerText()).trim() === prec.nome + " · dalla mappa", "Stabilità: con la freccia il mese scorso, dalla mappa");
  check(await stab2.locator("button.freccia-mese[data-d='1']").isEnabled(), "Stabilità: nel mese scorso si può tornare avanti");
  check((await stab2.locator(".stab-personali").innerText()).replace(/\s+/g, " ").includes("I tuoi nuovi iscritti · " + prec.nome.split(" ")[0].toLowerCase()),
    "Stabilità: i nuovi iscritti dicono a quale mese si riferiscono");
  const dati = (await stab2.locator(".stab-dati").innerText()).replace(/\s+/g, " ");
  check(dati.includes("Livello raggiunto 9%") && dati.includes("La tua rete reale in costruzione") && dati.includes("sostiene il livello? non ancora"),
    "Stabilità: livello raggiunto dal fatturato e rete reale (" + dati + ")");
  const classi = async k => stab2.locator(`li[data-k=${k}] .cella`).evaluateAll(l => l.map(e => e.className.replace("cella", "").trim()));
  const cn = await classi("nuovi_gruppo"), cc = await classi("convention");
  check(cn.slice(0, 3).every(x => x.startsWith("att")) && cn.slice(3).every(x => x === "") && cn[2].includes("liv"),
    "Stabilità: ambra fino al livello raggiunto se non sostenuto, neutro sopra, bordo sul livello raggiunto (" + cn.join("|") + ")");
  check(cc.slice(0, 3).every(x => x.startsWith("ok")) && cc.slice(3).every(x => x === "sopra"),
    "Stabilità: verde dove la rete sostiene; sopra il livello raggiunto neutro con la spunta se il numero c'è (" + cc.join("|") + ")");
  const testi = async k => stab2.locator(`li[data-k=${k}] .cella`).allInnerTexts();
  check((await testi("convention")).every(x => x.includes("✓")) && (await testi("nuovi_gruppo")).slice(0, 3).every(x => x.includes("!"))
    && !(await testi("nuovi_gruppo")).slice(3).some(x => /[✓!]/.test(x)), "Stabilità: ✓ nelle caselle verdi, ! in quelle ambra");
  check(await tuoDi(stab2, "nuovi_gruppo") === "0", "Stabilità: nel mese scorso i nuovi di quel mese");
  check(await stab2.locator("li[data-k=training_day] small", { hasText:"il numero di oggi" }).count() === 1 && await stab2.locator("li[data-k=nuovi_gruppo] small", { hasText:"il numero di oggi" }).count() === 0,
    "Stabilità: nei mesi prima i numeri scritti a mano dicono che sono quelli di oggi");
  check((await stab2.locator(".stab-lavoro .eyebrow").textContent()).trim() === "Per sostenere il 9%", "Per sostenere il 9%: il titolo dice il livello");
  const lav = (await stab2.locator(".stab-lavoro p").allInnerTexts()).map(x => x.replace(/\s+/g, " "));
  check(lav.length === 2 && lav[0] === "Nuovi iscritti nel gruppo del mese: hai 0, ne servono 5"
    && lav[1] === "Codici che fatturano più di 200 VP: hai 1, ne servono 5", "Per sostenere: le righe da rinforzare, in ordine (" + lav.join(" / ") + ")");
  await page.screenshot({ path: S + "/e2e/41-stabilita-mese-scorso.png", fullPage:false });
  await stab2.locator("button.freccia-mese[data-d='1']").click();
  await stab2.locator(".stab-mese b", { hasText:"mese in corso" }).waitFor();
  check(await stab2.locator("button.freccia-mese[data-d='1']").isDisabled(), "Stabilità: con la freccia avanti si torna al mese in corso");
  await sync(page); await ctx.close();
  /* la mappa del mese appena chiuso non c'è ancora: quel mese lo dice, quello prima viene dalla mappa */
  DB.numeri = DB.numeri.filter(x => !(x.partner_id === "R" && x.mese === prec.m))
    .concat([{ visto_da:"R", partner_id:"R", mese:prec2.m, vpp:300, vpg:4000, percentuale:9, linee:[], nascoste:false, dati_al:prec2.m + "-28T10:00:00Z" }]);
  await aGuida();
  { const sm = page.locator(".guida-stabilita .stab-mese");
    await sm.locator("button[data-d='-1']").click(); await sm.locator("b", { hasText:prec.nome }).waitFor();
    check((await sm.locator("b").innerText()).trim() === prec.nome + " · senza mappa importata", "Stabilità: un mese senza mappa lo dice");
    await sm.locator("button[data-d='-1']").click(); await sm.locator("b", { hasText:meseT(-2, true).nome }).waitFor();
    check((await sm.locator("b").innerText()).trim() === meseT(-2, true).nome + " · dalla mappa"
      && (await page.locator(".guida-stabilita .stab-dati").innerText()).replace(/\s+/g, " ").includes("Livello raggiunto 9%"), "Stabilità: due mesi fa, dalla mappa, al 9%");
    for(let i = 0; i < 12; i++){ if(await sm.locator("button[data-d='-1']").isDisabled()) break; await sm.locator("button[data-d='-1']").click(); }
    check(await sm.locator("button[data-d='-1']").isDisabled() && (await sm.locator("b").innerText()).includes(meseT(-12, true).nome),
      "Stabilità: si va indietro fino a 12 mesi");
    await sm.locator("button[data-d='1']").click(); }
  // abitudini: spunto oggi la formazione e cambio l'obiettivo
  const oggiG = new Date().toISOString().slice(0, 10);
  await page.locator(`.guida-abitudini [data-k=formazione] button[data-giorno="${oggiG}"]`).click();
  await page.locator(`.guida-abitudini [data-k=formazione] button[data-giorno="${oggiG}"][aria-pressed=true]`).waitFor();
  await page.click(".guida-abitudini button[data-act=guida-obiettivo][data-k=formazione]");
  await page.fill(".sheet input[name=n]", "3"); await page.click(".sheet button.primary");
  await page.getByText("Obiettivo salvato").waitFor();
  check((await page.locator(".guida-abitudini [data-k=formazione] .spread").innerText()).replace(/\s+/g, " ").includes("1 / 3 giorni"), "abitudini: 1 giorno su 3, obiettivo scelto da me");
  check((await page.locator(".guida-abitudini").innerText()).includes("Risentire chi ha visto il piano"), "follow-up con la spiegazione");
  check(await page.locator(".guida-abitudini .abitudine .bar[role=progressbar]").count() === 5 && await page.locator(".guida-abitudini .bar.lista").count() === 3,
    "abitudini: una barra per ognuna, pesca per quelle dalla Lista");
  check(await page.locator(`.guida-abitudini [data-k=sponsor] button.adesso[data-giorno="${oggiG}"]`).count() === 1, "abitudini: oggi segnato nei cerchi dei giorni");
  check(await page.evaluate(() => { const b = [...document.querySelectorAll(".guida-abitudini [data-k=sponsor] .giorni-guida button")].map(x => x.getBoundingClientRect().top);
    return Math.max(...b) - Math.min(...b) < 1; }), "abitudini: i cerchi dei giorni sono tutti alla stessa altezza, anche oggi");
  await page.screenshot({ path: S + "/e2e/41-guida.png", fullPage:true });
  await sync(page);
  check(DB.guidaFatti.length === 1 && DB.guidaObiettivi.some(x => x.chiave === "formazione" && x.a_settimana === 3)
    && DB.numeriCl21.some(x => x.convention === 40), "nel database: spunta, obiettivo e numeri scritti");
  await page.click(".sezioni-io button[data-sez=giorno]");
  await page.locator(".card", { hasText:"Il mio mese" }).waitFor(); check(true, "si torna a «Il mio giorno»");
  await ctx.close();
  DB.partners = DB.partners.filter(p => !["g41a", "g41b"].includes(p.id));
  /* senza nessuna mappa: i codici oltre 200 VP non si contano */
  DB.numeri = [];
  await aGuida();
  const r200 = (await page.locator(".guida-stabilita li[data-k=oltre_200]").innerText()).replace(/\s+/g, " ");
  check(r200.includes("disponibile dopo l'import della mappa") && (await page.locator(".guida-stabilita li[data-k=oltre_200] .cella.att, .guida-stabilita li[data-k=oltre_200] .cella.ok").count()) === 0,
    "Stabilità: senza mappa i codici oltre 200 VP sono «disponibile dopo l'import della mappa», non 0");
  check(await page.locator(".guida-stabilita .stab-lavoro p", { hasText:"200 VP" }).count() === 0, "Per sostenere: senza mappa niente codici oltre 200 VP");
  await ctx.close();
  DB.numeri = numeriR;
}

// 42. Seguimi giorno per giorno (036): «Oggi per te» e i numeri all'upline solo se il partner lo sceglie
{
  const ora = new Date().toISOString(), oggiG = ora.slice(0, 10);
  DB.seguimi = []; DB.seguimiGiorni = []; DB.guidaFatti = [];
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat(["Marta Esempio", "Luca Esempio", "Sara Esempio", "Dario Esempio"]
    .map((nome, i) => ({ id:"s42" + i, proprietario:"R", nome, fase:"lista", esito:null, creato_il:"2026-01-0" + (i + 1) + "T10:00:00Z" })));
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  check(await page.locator(".oggi-per-te").count() === 0, "Seguimi spento: niente «Oggi per te»");
  await page.click("button[data-act=vista-profilo]");
  check(await page.locator(".guida-seguimi button[data-act=seguimi-attivo]").isVisible(), "consegna 3: Seguimi giorno per giorno sta nel Profilo");
  await page.click("button[data-act=seguimi-attivo]");
  await page.getByText("Seguimi attivo").waitFor();
  check(await page.locator("button[data-act=seguimi-condividi]").getAttribute("aria-checked") === "false", "condividere con l'upline è spento di base");
  await page.click("button[data-act=seguimi-condividi]");
  await page.getByText("Il tuo sponsor e la tua upline vedono i tuoi dati (mai i nomi)").waitFor();
  await page.click("button[data-act=vista-io]");
  const oggiPerTe = page.locator(".oggi-per-te");
  await oggiPerTe.waitFor();
  const contatti = await oggiPerTe.locator("li", { hasText:"Contatto" }).count();
  check(contatti >= 1 && contatti <= 3, "Oggi per te: da 1 a 3 contatti dalla Lista (" + contatti + ")");
  check((await oggiPerTe.locator("li", { hasText:"Contatto" }).first().innerText()).includes("Marta Esempio"), "i contatti sono i primi «In lista»");
  const prima = await oggiPerTe.locator("p.small b").innerText();
  await oggiPerTe.locator("button[data-act=guida-spunta][data-k=formazione]").click();
  await oggiPerTe.locator("button[data-act=guida-spunta][data-k=formazione][aria-pressed=true]").waitFor();
  const dopo = await oggiPerTe.locator("p.small b").innerText();
  check(prima !== dopo && /^Oggi: 1 su \d+ fatte$/.test(dopo), "spuntare la formazione conta tra le azioni fatte (" + dopo + ")");
  await page.screenshot({ path: S + "/e2e/42-oggi-per-te.png" });
  await new Promise(r => setTimeout(r, 500));
  await sync(page);
  const g = (DB.seguimiGiorni || []).find(x => x.partner_id === "R" && x.giorno === oggiG);
  check(g && g.fatte === 1 && g.proposte >= 2 && DB.seguimi.some(x => x.partner_id === "R" && x.attivo && x.condividi), "nel database: azioni di oggi, fatte e scelta di condividere");
  await ctx.close();
  // l'upline: vede i numeri solo se il partner condivide
  DB.partners.push({ id:"s42p", nome:"Partner Seguito", sponsor_id:"R", stato:"attivo", codice_invito:"S42PPP", codice_amway:"8900001", confermato_il:ora, creato_il:ora });
  DB.seguimiGiorni.push({ partner_id:"s42p", giorno:oggiG, azioni:[], proposte:6, fatte:4, per_tipo:{ contatti:2, crescita:1, clienti:1 } });
  DB.seguimi.push({ partner_id:"s42p", attivo:true, condividi:false });
  const schedaSeguito = async () => {
    ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
    await page.click("button[data-act=vista-gruppo]");
    await page.locator(".albero.struttura li", { hasText:"Partner Seguito" }).locator("button[data-act=apri-scheda]").click();
    await page.getByText("Questo mese e il mese prima").waitFor();
    await new Promise(r => setTimeout(r, 300));
    const n = await page.locator(".seguimi-scheda").count(), t = n ? await page.locator(".seguimi-scheda").innerText() : "";
    await ctx.close(); return t;
  };
  check(await schedaSeguito() === "", "senza condividere l'upline non vede niente del Seguimi");
  DB.seguimi.find(x => x.partner_id === "s42p").condividi = true;
  const t = await schedaSeguito();
  check(/si fa seguire giorno per giorno/i.test(t) && t.includes("4/6") && !t.includes("Esempio"), "condividendo, l'upline vede solo i numeri (4/6)");
  DB.partners = DB.partners.filter(p => p.id !== "s42p");
}

// 43. Usabilità: indietro con il dito da un collegamento, barra fissa in alto, spunte delle settimane prima
{
  ({ ctx, page } = await apri({ hasTouch:true, isMobile:true }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  const dito = (x1, x2) => page.evaluate(([x1, x2]) => {
    const el = document.querySelector("#app");
    const tocca = (tipo, x) => { const t = new Touch({ identifier:1, target:el, clientX:x, clientY:400 });
      el.dispatchEvent(new TouchEvent(tipo, { bubbles:true, cancelable:true, touches: tipo === "touchend" ? [] : [t], changedTouches:[t] })); };
    tocca("touchstart", x1); tocca("touchend", x2);
  }, [x1, x2]);
  // barra fissa: le pagine e i pulsanti della sezione restano visibili scorrendo
  check(await page.locator(".barra-fissa .schede").count() === 1 && await page.locator(".barra-fissa .sezioni-io").count() === 1, "barra in alto: pagine e pulsanti della sezione insieme");
  await page.screenshot({ path: S + "/e2e/43-barra-alto.png" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 200));
  const alto = await page.locator(".barra-fissa").evaluate(b => b.getBoundingClientRect().top);
  check(alto >= -1 && alto < 40, "scorrendo in basso la barra resta in alto (" + Math.round(alto) + ")");
  await page.screenshot({ path: S + "/e2e/43-barra-scorsa.png" });
  check(await page.locator(".testata h1").evaluate(h => h.getBoundingClientRect().bottom < 0), "il titolo con il nome scorre via");
  // dalla Verifica alla mia analisi con un collegamento, e indietro con il dito
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click(".sezioni-io button[data-sez=guida]");
  await page.locator(".analisi-link").click();
  await page.locator(".testata h1", { hasText:"La mia analisi" }).waitFor();
  await dito(60, 320);
  await page.locator(".guida-stabilita").waitFor();
  check(await page.locator(".sezioni-io button[data-sez=guida]").getAttribute("aria-pressed") === "true", "indietro con il dito: torna alla Verifica da cui si era partiti");
  // con le pagine principali il dito scorre come prima
  await dito(320, 60);
  await page.locator(".schede button.on", { hasText:"Persone" }).waitFor(); check(true, "dalle pagine principali il dito scorre tra le pagine");
  await page.click(".schede button[data-act=vista-io]");
  // spunte della settimana prima
  await page.click(".sezioni-io button[data-sez=guida]");
  await page.click(".guida-abitudini button[data-act=guida-sett][data-d='-1']");
  const ieriSett = await page.locator(".guida-abitudini [data-k=formazione] button[data-act=guida-spunta]").first().getAttribute("data-giorno");
  await page.locator(".guida-abitudini [data-k=formazione] button[data-act=guida-spunta]").first().click();
  await page.locator(`.guida-abitudini [data-k=formazione] button[data-giorno="${ieriSett}"][aria-pressed=true]`).waitFor();
  check(ieriSett < new Date().toISOString().slice(0, 10) && (await page.locator(".guida-abitudini .eyebrow").innerText()).toLowerCase().includes("settimana dal"),
    "si spunta anche un giorno della settimana prima");
  await sync(page);
  check(DB.guidaFatti.some(x => x.partner_id === "R" && x.chiave === "formazione" && x.giorno === ieriSett), "nel database la spunta del giorno passato");
  await ctx.close();
}

// 44. Analisi della persona (037): di sé dalla Guida, di un partner dalla scheda; i dati scritti a mano solo se condivisi
{
  const ora = new Date().toISOString(), mm = ora.slice(0, 7);
  DB.partners.push({ id:"a44", nome:"Partner Analisi", sponsor_id:"R", stato:"attivo", codice_invito:"A44AAA", codice_amway:"8700001", confermato_il:ora, creato_il:ora });
  DB.partners.push({ id:"a44l", nome:"Linea Esempio", sponsor_id:"a44", stato:"gestito", gestore_id:"R", codice_invito:"A44LLL", codice_amway:"8700002", creato_il:ora });
  DB.numeri = DB.numeri.filter(x => !["a44", "a44l"].includes(x.partner_id)).concat([
    { visto_da:"R", partner_id:"a44", mese:mm, vpp:250, vpg:3200, percentuale:12, linee:[{ codice:"8700002", vpg:900 }], dati_al:ora },
    { visto_da:"R", partner_id:"a44l", mese:mm, vpp:300, vpg:900, percentuale:6, linee:[], dati_al:ora }]);
  DB.seguimi = (DB.seguimi || []).filter(x => x.partner_id !== "a44").concat([{ partner_id:"a44", attivo:false, condividi:false }]);
  DB.numeriCl21 = (DB.numeriCl21 || []).filter(x => x.partner_id !== "a44").concat([{ partner_id:"a44", app_cl21:7, training_day:8, convention:9 }]);
  const analisiDi = async () => {
    ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
    await page.click("button[data-act=vista-gruppo]");
    await page.locator(".albero.struttura li", { hasText:"Partner Analisi" }).locator("button[data-act=apri-scheda]").click();
    await page.click("button[data-act=apri-analisi]");
    await page.locator(".analisi-linee").waitFor();
    return (await page.locator("#app").innerText()).replace(/\s+/g, " ");
  };
  let t = await analisiDi();
  check(t.includes("Linea Esempio") && t.includes("900") && t.includes("6%"), "analisi di un partner: la linea con nome, volume e percentuale");
  check(t.includes("Non li ha condivisi") && !/Codici alla Convention 9/.test(t), "senza condividere i numeri scritti a mano non si vedono");
  await page.screenshot({ path: S + "/e2e/44-analisi.png", fullPage:true });
  await page.click("button[data-act=analisi-indietro]");
  await page.getByText("Questo mese e il mese prima").waitFor(); check(true, "‹ Indietro torna alla scheda");
  await ctx.close();
  DB.seguimi.find(x => x.partner_id === "a44").condividi = true;
  t = await analisiDi();
  check(!t.includes("Non li ha condivisi") && /Codici alla Convention 9/.test(t), "condividendo, l'upline vede anche i numeri scritti a mano");
  await ctx.close();
  // la mia analisi dalla Verifica, e l'interruttore unico per condividere nel Profilo
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await page.click("button[data-act=vista-profilo]");
  check(await page.locator(".guida-condividi button[data-act=seguimi-condividi]").count() === 1, "nel Profilo un solo interruttore per condividere");
  await page.click("button[data-act=vista-io]");
  await page.click(".sezioni-io button[data-sez=guida]");
  await page.click(".analisi-link");
  await page.locator(".analisi-riep").waitFor();
  check((await page.locator(".testata h1").innerText()).trim() === "La mia analisi", "la mia analisi dalla Verifica");
  await ctx.close();
  DB.partners = DB.partners.filter(p => !["a44", "a44l"].includes(p.id));
}

// 45. Ottimizzazione 1: «Il mio giorno» in tre blocchi, «Anche da sentire» senza doppioni, promemoria dell'import
{
  const ora = new Date(), oggiG = ora.toISOString().slice(0, 10), giorniFa = n => new Date(Date.now() - n * 86400000).toISOString();
  const dataTra = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  DB.seguimiGiorni = []; DB.seguimi = (DB.seguimi || []).filter(x => x.partner_id !== "R").concat([{ partner_id:"R", attivo:true, condividi:false }]);
  const persona45 = (i, nome, fase, data) => ({ id:"p45" + i, proprietario:"R", nome, fase, esito:null, prossima_data:data, creato_il:"2026-01-0" + (i % 9 + 1) + "T10:00:00Z" });
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat([
    persona45(1, "Lista Uno", "lista", null), persona45(2, "Lista Due", "lista", null),
    ...["Ritardo Uno", "Ritardo Due", "Ritardo Tre", "Ritardo Quattro", "Ritardo Cinque"].map((n, i) => persona45(10 + i, n, "piano", dataTra(-(i + 1)))),
    persona45(20, "Presto Uno", "invitato", dataTra(2)), persona45(21, "Presto Due", "invitato", dataTra(3)), persona45(22, "In Corso", "contattato", null),
    Object.assign(persona45(30, "Cliente Quarantacinque", "followup", null), { esito:"cliente" })]);
  DB.numeri = DB.numeri.filter(x => !(x.partner_id === "R" && x.mese === oggiG.slice(0, 7)))
    .concat([{ visto_da:"R", partner_id:"R", mese:oggiG.slice(0, 7), vpp:120, vpg:900, percentuale:3, linee:[], dati_al:giorniFa(8) }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  const dfo = page.locator(".da-fare-oggi");
  await dfo.waitFor();
  check((await dfo.locator(".eyebrow").innerText()).toLowerCase().startsWith("da fare oggi"), "con il Seguimi: il blocco «Da fare oggi»");
  check(!(await page.locator(".card", { hasText:"Il tuo percorso con la lista" }).count()), "con il Seguimi: niente riquadro della lista a parte");
  const nomiAzioni = await dfo.locator(":scope > ul button[data-act=apri-persona]").allInnerTexts();
  const nomiAnche = await dfo.locator(".anche button[data-act=apri-persona] b").allInnerTexts();
  check(nomiAzioni.filter(n => n.startsWith("Ritardo")).length === 3 && nomiAnche.length === 2 && !nomiAnche.some(n => nomiAzioni.includes(n)),
    "«Anche da sentire»: gli altri follow-up in ritardo, senza ripetere le azioni (" + nomiAnche.join(", ") + ")");
  check(await dfo.locator(".anche li", { hasText:"Follow-up · in ritardo" }).count() === 2, "«Anche da sentire»: con l'etichetta");
  check(await dfo.locator("button.riga-apri", { hasText:"Altri 3 in corso nella Lista" }).isVisible(), "riga «Altri 3 in corso nella Lista»");
  const ordineBlocchi = await page.evaluate(() => [...document.querySelectorAll("#app .card")].map(c => c.classList.contains("da-fare-oggi") ? "fare"
    : c.classList.contains("miei-numeri") ? "numeri" : c.classList.contains("diario") ? "diario" : c.classList.contains("promemoria-import") ? "import" : "").filter(Boolean).join(","));
  check(ordineBlocchi === "numeri,fare,import,diario", "Il mio giorno (consegna 2): cruscotto, Da fare oggi, promemoria, Diario (" + ordineBlocchi + ")");
  check((await page.locator(".promemoria-import").innerText()).includes("8 giorni fa"), "promemoria: l'ultimo report ha 8 giorni");
  check(!(await page.locator(".tappa-aperta").count()) && !(await page.locator("ul.oggi").count()), "tappa e diario chiusi di base");
  await page.click("button[data-act=apri-tappa]");
  check(await page.locator(".tappa-aperta .req li").count() > 0, "toccando la tappa si vedono i requisiti");
  await page.click("button[data-act=apri-tappa]");
  check(!(await page.locator(".tappa-aperta").count()), "toccando di nuovo si richiude");
  await page.screenshot({ path: S + "/e2e/45-il-mio-giorno.png", fullPage:true });
  await apriOrdini(page);
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/45-ordini.png" });
  check(await page.locator(".sheet label.scelta-ordini", { hasText:"Ordini dal sito Amway" }).locator("input.file-amway").count() === 1,
    "dal foglio Ordini: «Ordini dal sito Amway» apre subito la scelta dei file");
  await page.click(".sheet [data-act=chiudi]");
  await dfo.locator("button.riga-apri", { hasText:"Altri 3 in corso" }).click();
  check(await page.locator("button[data-act=vista-persone][aria-selected=true]").isVisible(), "la riga apre la Lista");
  // dopo aver aperto l'ordine di un cliente, «+ Ordine» apre sempre il foglio Ordini, mai l'ordine del cliente
  await page.click("button[data-sez=clienti]"); await page.click("button[data-filtro=tutti]");
  await page.locator("button[data-act=apri-cliente]", { hasText:"Cliente Quarantacinque" }).click();
  await page.click("button[data-act=ordine-nuovo]");
  await page.locator(".sheet h2", { hasText:"Ordine di" }).waitFor();
  await page.click(".sheet button:has-text('Annulla')");
  await page.click("button[data-act=vista-io]");
  await apriOrdini(page);
  check((await page.locator(".sheet h2").innerText()).trim() === "Ordini", "dopo un cliente aperto, «+ Ordine» apre il foglio Ordini");
  await page.click(".sheet [data-act=chiudi]");
  await ctx.close();
  // senza Seguimi: i due riquadri di prima; report di 3 giorni fa: niente promemoria
  DB.seguimi.find(x => x.partner_id === "R").attivo = false;
  DB.numeri.find(x => x.partner_id === "R" && x.mese === oggiG.slice(0, 7)).dati_al = giorniFa(3);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  check(!(await page.locator(".da-fare-oggi").count()) && await page.locator(".card.oggi-lista").isVisible(),
    "senza Seguimi: niente «Da fare oggi», resta la lista di oggi");
  check(!(await page.locator(".promemoria-import").count()), "report di 3 giorni fa: niente promemoria");
  await ctx.close();
  DB.persone = DB.persone.filter(x => !String(x.id).startsWith("p45"));
}

// 46. Ottimizzazione 2: «Primi passi» (30 nomi, × per nasconderlo) e le spiegazioni dietro il «?»
{
  const oggiG = new Date().toISOString().slice(0, 10);
  const nomi46 = n => Array.from({ length:n }, (_, i) => ({ id:"n46" + i, proprietario:"R", nome:"Nome " + (i + 1), fase:"lista", esito:null, creato_il:oggiG + "T09:00:00Z" }));
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat(nomi46(12));
  DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id !== "R").concat([{ partner_id:"R", cifra_mese:3000, entro:(Number(oggiG.slice(0, 4)) + 1) + "-06-01", perche:"Per la famiglia" }]);
  DB.seguimi = (DB.seguimi || []).filter(x => x.partner_id !== "R");
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  const pp = page.locator(".primi-passi");
  check(await pp.isVisible() && await pp.getByText("Fatto, l'ho salvato").isVisible(), "Primi passi: il link da salvare è aperto");
  check(!(await pp.locator("button[data-act=primi-passi-no]").count()), "finché il link non è salvato, niente ×");
  check(!(await pp.locator("li", { hasText:"nomi nella tua Lista" }).count()) && !(await pp.locator("button[data-act=passo-apri][data-k=lista]").count()),
    "12 nomi nella Lista: in Primi passi niente più «Scrivi 30 nomi nella tua Lista» (12 novembre 2026)");
  check(await pp.locator("li.fatta", { hasText:"Scrivi il tuo obiettivo" }).isVisible() && (await pp.locator(".pill").innerText()).startsWith("2 su 3"),
    "obiettivo scritto: voce fatta, 2 su 3 (link, obiettivo, import)");
  await page.screenshot({ path: S + "/e2e/46-primi-passi.png", fullPage:true });
  await pp.getByText("Fatto, l'ho salvato").click();
  check(!(await page.locator(".primi-passi").count()), "salvato il link, tutto fatto con 12 nomi: Primi passi sparisce");
  // il «?»: si apre e si richiude
  await page.click("button[data-act=vista-gruppo]");
  check(!(await page.getByText("Il numero a sinistra è il livello").count()), "Struttura: la spiegazione è chiusa");
  await page.click("button[data-act=aiuto][data-k=struttura]");
  check(await page.getByText("Il numero a sinistra è il livello").isVisible(), "il «?» apre la spiegazione");
  { const t = (await page.locator(".aiuto-testo", { hasText:"Il numero a sinistra" }).innerText()).replace(/\s+/g, " ");
    check(t.includes("1 tu 2 blu 3 viola 4 petrolio 5 rosa 6 nocciola") && t.includes("si riparte dal blu") && t.includes("usa l'app") && t.includes("senza app")
      && t.includes("entro 7 giorni, entro 14, oltre") && await page.locator(".aiuto-testo .legenda-livelli .livello").count() === 6,
      "il «?» spiega i colori dei livelli (con i cerchietti), il pallino dell'app e attivo/rallenta/fermo"); }
  { const verdi = await page.locator(".albero.struttura .pallino-app:not(.no)").count(), grigi = await page.locator(".albero.struttura .pallino-app.no").count();
    check(verdi + grigi === await page.locator(".albero.struttura li.liv:not(.io)").count() && !await page.locator(".albero.struttura li.io .pallino-app").count(),
      "un pallino per ogni persona del gruppo (non sulla mia riga)");
    check(!await page.locator(".albero.struttura .pill", { hasText:"senza app" }).count(), "nessuna scritta «senza app» nella struttura"); }
  await page.locator(".card", { hasText:"La mia struttura" }).screenshot({ path: S + "/e2e/gruppo-pallino.png" });
  await page.click("button[data-act=aiuto][data-k=struttura]");
  check(!(await page.getByText("Il numero a sinistra è il livello").count()), "toccandolo di nuovo si richiude");
  // le abitudini: il «?» si apre in alto, sotto il titolo, prima delle righe
  await page.click("button[data-act=vista-io]"); await page.click(".sezioni-io button[data-sez=guida]");
  await page.click("button[data-act=aiuto][data-k=abitudini]");
  const sopra = await page.evaluate(() => { const t = document.querySelector(".aiuto-testo"), c = t && t.closest(".card");
    const righe = c ? [...c.querySelectorAll("*")].filter(x => /Contatti nuovi/.test(x.textContent) && !x.children.length) : [];
    return !!t && /Quante volte hai fatto ogni abitudine/.test(t.textContent) && righe.length > 0
      && !!(t.compareDocumentPosition(righe[0]) & Node.DOCUMENT_POSITION_FOLLOWING); });
  check(sopra, "abitudini: la spiegazione si apre sotto il titolo, sopra le righe");
  await ctx.close();
  // senza nomi nella Lista e tutto il resto fatto, il riquadro non c'è (i 30 nomi non contano più)
  DB.persone = DB.persone.filter(x => x.proprietario !== "R");
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
  await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor();
  check(!(await page.locator(".primi-passi").count()), "tutto fatto (obiettivo, link, import) con 0 nomi: Primi passi sparisce");
  await ctx.close();
  // la × di Primi passi: un avviato con un gruppo e la mappa non ancora importata
  { const ora = new Date().toISOString(), gfa = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    DB.partners.push({ id:"pp46", nome:"Pina Passi", sponsor_id:"R", stato:"attivo", chiave:"4b".repeat(16), codice_invito:"PP46PP", codice_amway:"7946001",
      data_iscrizione:gfa(90), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true });
    DB.partners.push({ id:"pp46u", nome:"Ugo Pina", sponsor_id:"pp46", stato:"gestito", gestore_id:"pp46", codice_invito:"PP46UU", codice_amway:"7946002",
      data_iscrizione:gfa(400), creato_il:ora });
    ({ ctx, page } = await apri({}, "#chiave=" + "4b".repeat(16)));
    await page.getByText("Ciao Pina").waitFor();
    const pq = page.locator(".primi-passi");
    await pq.getByText("Fatto, l'ho salvato").click();
    check((await pq.locator(".pill").innerText()).startsWith("2 su 3") && !(await pq.locator("li", { hasText:"nomi nella tua Lista" }).count()),
      "avviata con gruppo: 2 su 3 (link, obiettivo, import), senza i 30 nomi");
    await pq.locator("button[data-act=primi-passi-no]").click();
    check(!(await page.locator(".primi-passi").count()), "× nasconde Primi passi");
    await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Pina").waitFor();
    check(!(await page.locator(".primi-passi").count()) && await page.evaluate(() => localStorage.getItem("growup-team.primi-passi-no.pp46")) === "1",
      "resta nascosto (salvato su questo telefono)");
    check(!errori.length, "Primi passi: nessun errore nella pagina");
    await ctx.close();
    DB.partners = DB.partners.filter(p => !["pp46", "pp46u"].includes(p.id)); }
  DB.persone = DB.persone.filter(x => !String(x.id).startsWith("n46"));
}

// 47. Ottimizzazione 3: «Il mio profilo» dall'omino, la scheda partner in «Numeri» e «Azioni», «VP personali»
{
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  check(!(await page.locator(".fondo").count()) && await page.locator(".testata button.omino").isVisible(), "niente più fondo pagina: l'omino in alto a destra");
  await apriMese(page);
  check(await page.locator(".mio-mese .obiettivo", { hasText:"VP personali" }).count() === 1 && await page.locator(".miei-numeri .anello[aria-label^='VP personali']").count() === 1
    && !(await page.getByText("VP fatturati").count()), "«VP personali» al posto di «VP fatturati» (anello del cruscotto e Il mio mese)");
  await page.click(".testata button.omino");
  await page.locator(".testata h1", { hasText:"Il mio profilo" }).waitFor();
  check(await page.getByText("Il mio link personale").isVisible() && await page.locator("button[data-act=partenza]").isVisible()
    && await page.locator(".admin-profilo button[data-act=copia-dati]").isVisible(), "Profilo: link, punto di partenza e (admin) la sezione Admin");
  await page.click("button[data-act=aiuto][data-k=glossario]");
  const gl = await page.locator(".glossario").innerText();
  check(gl.includes("Mese da Argento") && gl.includes("12 mesi che partono dal primo mese da Argento"), "Glossario: Mese da Argento e Anno fiscale corretti");
  await page.screenshot({ path: S + "/e2e/47-profilo.png", fullPage:true });
  await page.click("button[data-act=profilo-indietro]");
  await page.getByText("Ciao Stefano e Alessia").waitFor(); check(true, "‹ Indietro torna alla pagina di prima");
  // la scheda partner: si apre su «Numeri», chiamata e struttura in «Azioni»
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li button[data-act=apri-scheda]").first().click();
  await page.locator(".schede-scheda").waitFor();
  check(await page.locator(".schede-scheda button.on").innerText() === "Numeri" && await page.locator(".dati-scheda").isVisible()
    && !(await page.locator("button[data-act=chiamata]").count()), "la scheda si apre su «Numeri»");
  await page.screenshot({ path: S + "/e2e/47-scheda-numeri.png", fullPage:true });
  await azioniScheda(page);
  check(await page.locator("button[data-act=chiamata]").isVisible() && !(await page.locator(".dati-scheda").count()), "«Azioni»: Fissa una chiamata, senza i numeri");
  await ctx.close();
}

// 48. «Importa da Amway»: un solo pulsante, l'app riconosce mappa, ordini e clienti; scorciatoia sull'icona (?importa=1)
{
  const codR = DB.partners.find(p => p.id === "R").codice_amway;
  ({ ctx, page } = await apri({}, "?importa=1#chiave=" + "a".repeat(32)));
  await page.locator(".sheet h2", { hasText:"Importa da Amway" }).waitFor();
  check(!/importa=1/.test(page.url()), "scorciatoia dall'icona: si apre «Importa da Amway» e l'indirizzo si pulisce");
  await mettiFile(page, [
    { name:"ordini.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) },
    { name:"mappa.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(meseFile, [persona(1, "9", codR, "ROSSI, MARIO", "120,00")])) }]);
  /* mappa e ordini insieme: prima la mappa (diretta), poi si apre da solo l'import di ordini e clienti */
  await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
  check(await page.locator(".sheet .avviso", { hasText:"Mappa importata. Ora gli ordini e i clienti." }).isVisible(),
    "salvata la mappa si apre da solo l'import di ordini e clienti");
  await page.click(".sheet [data-act=chiudi]");
  // un file degli ordini scelto da Gruppo va all'import degli ordini; un file qualsiasi è segnalato
  await page.click("button[data-act=vista-gruppo]");
  await mettiFile(page, { name:"ordini.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) });
  await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
  check(!(await page.locator(".sheet .avviso", { hasText:"Mappa importata" }).count()), "solo ordini: dritti all'import degli ordini");
  await page.click(".sheet [data-act=chiudi]");
  await mettiFile(page, { name:"foto.csv", mimeType:"text/csv", buffer:Buffer.from("a,b\n1,2\n") });
  await page.locator(".sheet .avviso").waitFor();
  check(await page.locator(".sheet .avviso").getByText("foto.csv: non sembra un export Amway").isVisible(), "file non riconosciuto: segnalato con il nome");
  await ctx.close();
}

// 49. Notifiche (039): la domanda una volta per telefono, Sì / Non ora, il telefono salvato, i numeri dei prossimi giorni
// (senza nomi), il Profilo con l'interruttore e la prova. Push del telefono sostituito da una finta (GROWUP_PUSH).
{
  const oggiG = new Date().toISOString().slice(0, 10), domani = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  DB.telefoni = []; DB.previste = [];
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat([
    { id:"p49a", proprietario:"R", nome:"Risentire Oggi", fase:"piano", esito:null, prossima_data:oggiG, creato_il:oggiG + "T09:00:00Z" },
    { id:"p49b", proprietario:"R", nome:"Risentire Domani", fase:"invitato", esito:null, prossima_data:domani, creato_il:oggiG + "T09:00:00Z" }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  await page.evaluate(() => { window.GROWUP_PUSH = { perm:"default", sub:null, permesso(){ return this.perm; },
    async chiedi(){ this.perm = "granted"; return "granted"; },
    pushManager:{ getSubscription:async () => window.GROWUP_PUSH.sub,
      subscribe:async () => (window.GROWUP_PUSH.sub = { endpoint:"https://push.esempio.test/telefono1", keys:{ p256dh:"pk", auth:"au" },
        toJSON(){ return { endpoint:this.endpoint, keys:this.keys }; }, unsubscribe:async () => { window.GROWUP_PUSH.sub = null; } }) } }; });
  const ridisegna = async () => { await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); };
  await ridisegna();
  const dom = page.locator(".domanda-notifiche");
  check(await dom.isVisible() && await dom.getByText("Vuoi un promemoria ogni mattina?").isVisible(), "la domanda delle notifiche in Io");
  await page.screenshot({ path: S + "/e2e/49-domanda.png" });
  await dom.locator("button[data-act=notifiche-no]").click();
  await ridisegna();
  check(!(await page.locator(".domanda-notifiche").count()), "«Non ora»: la domanda non ricompare");
  await page.evaluate(() => localStorage.removeItem("growup-team.notifiche-chiesto.R"));
  await ridisegna();
  await page.locator(".domanda-notifiche button[data-act=notifiche-si]").click();
  await page.getByText("Notifiche attive: ogni mattina alle 8:30").waitFor();
  check(!(await page.locator(".domanda-notifiche").count()), "«Sì»: notifiche attive, la domanda sparisce");
  await new Promise(r => setTimeout(r, 2200));
  await sync(page);
  const prev = (DB.previste || []).filter(x => x.partner_id === "R");
  check((DB.telefoni || []).filter(x => x.partner_id === "R").length === 1, "il telefono è salvato");
  check(prev.length === 14 && prev.find(x => x.giorno === oggiG).persone >= 1 && prev.find(x => x.giorno === domani).persone >= 2
    && !JSON.stringify(prev).includes("Risentire"), "i numeri dei prossimi 14 giorni, senza nomi");
  await page.click(".testata button.omino");
  const sw = page.locator("button.notifiche-interruttore");
  check(await sw.getAttribute("aria-checked") === "true", "Profilo: notifiche accese su questo telefono");
  await page.screenshot({ path: S + "/e2e/49-profilo.png" });
  await page.click("button[data-act=notifiche-prova]");
  await page.getByText("Notifica di prova inviata").waitFor(); check(true, "Profilo: la notifica di prova");
  await sw.click();
  await page.getByText("Notifiche spente su questo telefono").waitFor();
  await sync(page);
  check(!(DB.telefoni || []).some(x => x.partner_id === "R") && await page.locator("button.notifiche-interruttore").getAttribute("aria-checked") === "false",
    "spente: il telefono è tolto");
  await ctx.close();
  DB.persone = DB.persone.filter(x => !String(x.id).startsWith("p49"));
}

// 50. Notifiche, parte 2 (040): l'ora facoltativa del prossimo passo; il tocco sull'avviso apre la scheda (?persona=id)
{
  const oggiG = new Date().toISOString().slice(0, 10), pid = "00000000-0000-0000-0000-0000000000c1";
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat([
    { id:pid, proprietario:"R", nome:"Prova Ora", fase:"contattato", esito:null, prossima_data:null, creato_il:oggiG + "T09:00:00Z" }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  await page.click("button[data-act=vista-persone]");
  await page.locator("button[data-act=apri-persona]", { hasText:"Prova Ora" }).click();
  await page.click(".prossima button[data-act=agenda]");
  check(await page.locator(".sheet input[name=ora]").isVisible() && await page.locator(".sheet").getByText("Ora (facoltativa)").isVisible(),
    "agenda: c'è l'ora facoltativa accanto al giorno");
  await page.fill(".sheet input[name=giorno]", oggiG);
  await page.fill(".sheet input[name=ora]", "18:30");
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/50-ora.png" });
  await page.click(".sheet button.primary");
  await page.getByText("In agenda: oggi alle 18:30").waitFor();
  await sync(page);
  check(String((DB.persone.find(x => x.id === pid) || {}).prossima_ora || "").startsWith("18:30"), "l'ora è salvata");
  check(await page.getByText(/Oggi · .* · 18:30/).first().isVisible(), "l'ora si vede con il giorno");
  // la × toglie giorno, ora e nota della prossima cosa
  await page.click(".prossima button[data-act=togli-prossima]");
  await page.getByText("Tolto dall'agenda").waitFor();
  await sync(page);
  const tolta = DB.persone.find(x => x.id === pid) || {};
  check(await page.locator(".prossima").getByText("Nessun giorno").isVisible() && !tolta.prossima_data && !tolta.prossima_ora && !tolta.prossima_nota && !tolta.prossima_per,
    "la × toglie dall'agenda (giorno, ora, nota e per cosa)");
  // la riporto per il tocco sull'avviso qui sotto
  DB.persone.find(x => x.id === pid).prossima_data = oggiG;
  await ctx.close();
  ({ ctx, page } = await apri({}, "?persona=" + pid + "#chiave=" + "a".repeat(32)));
  await page.locator(".testata h1", { hasText:"La mia lista" }).waitFor();
  check(await page.getByText("Prova Ora").first().isVisible() && !/persona=/.test(page.url()), "il tocco sull'avviso apre la scheda della persona");
  await ctx.close();
  DB.persone = DB.persone.filter(x => x.id !== pid);
}

// 51. Import mappe: i due export di Amway (17 colonne «KPI selezionati», 26 «tutti i KPI»), stesse persone, colonne per nome
{
  const testa17 = ["Qualifica Amway Partner","Codice Amway Partner Sponsor","Codice Amway Partner","Paese","Nome","Data di ingresso","Telefono",
    "Email","Indirizzo","Data di rinnovo","VPG","VPP","Percentuale di bonus","VVG","VP Cliente"," Clienti","Punti al livello successivo"];
  const altre26 = ["VP reso","VP Rubino","Linee qualificate","Dimensioni gruppo","Numero ordini personali","Numero ordini multicarrello",
    "Sponsorizzazione","VPP annuali","Totale VP organizzazione"];
  /* nel file con tutti i KPI le colonne stanno in un altro ordine: si devono trovare per nome */
  const testa26 = altre26.slice(0, 4).concat(testa17.slice().reverse(), altre26.slice(4));
  check(testa17.length === 17 && testa26.length === 26, "i due formati: 17 e 26 colonne");
  const p51 = (liv, sp, cod, nome, vpp, vpg, perc, dim, riservato) => ({ "Qualifica Amway Partner":String(liv), "Codice Amway Partner Sponsor":"'" + sp,
    "Codice Amway Partner":"'" + cod, "Paese":"'Italia", "Nome":riservato ? "Utente riservato/non visualizzabile" : "'" + nome,
    "Data di ingresso":"'01 gennaio 2020", "Telefono":riservato ? "" : "'Principale: +39 333 0000000", "Email":riservato ? "" : "'prova@esempio.it",
    "Indirizzo":"'Via Prova | XX | 00000 | Italia", "Data di rinnovo":"'31 dicembre 2026", "VPG":"'" + vpg, "VPP":"'" + vpp,
    "Percentuale di bonus":"'" + perc + "%", "VVG":"35345.4", "VP Cliente":"'0,00", " Clienti":"'0", "Punti al livello successivo":"0",
    "VP reso":"0", "VP Rubino":"0", "Linee qualificate":"0", "Dimensioni gruppo":"'" + dim, "Numero ordini personali":"0",
    "Numero ordini multicarrello":"0", "Sponsorizzazione":"'S999999", "VPP annuali":"'1.000,00", "Totale VP organizzazione":"35345.4" });
  const persone51 = [p51(1, "7600000", "7600001", "PROVA, MAPPA", "120,50", "15.626,29", 9, 4),
    p51(2, "7600001", "7600002", "PRIMO, ALDO", "80,00", "300,00", 3, 2), p51(3, "7600002", "7600003", "", "10,00", "10,00", 0, 1, true),
    p51(2, "7600001", "7600004", "SECONDA, BICE", "0,00", "0,00", 0, 1)];
  const csv51 = testa => "\ufeff" + [csvRiga(["Amway","CONFIDENZIALE - REPORT DI PROVA"]), csvRiga(["Mese di competenza", meseFile]), csvRiga(testa)]
    .concat(persone51.map(p => csvRiga(testa.map(t => p[t])))).join("\n");
  DB.partners.push({ id:"mappa51", nome:"Mappa Prova", sponsor_id:"R", stato:"attivo", chiave:"d1".repeat(16), codice_invito:"MAP51A", codice_amway:"7600001",
    privacy_accettata_il:"2026-10-01T00:00:00Z", partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  const importa51 = async (nome, testo, nuovi) => {
    await page.locator(".toast", { hasText:"Import di" }).waitFor({ state:"detached" });
    await scegliFile(page, nome, testo);
    await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
    if(nuovi) check(await page.locator(".sheet .imp-nuovi", { hasText:"Nuove nella tua struttura · 3" }).getByText("Utente riservato (7600003)").isVisible(),
      "17 colonne: tre persone nuove, «Utente riservato» con il suo codice");
    await page.locator(".toast", { hasText:"Import di" }).waitFor();
    await page.click(".sheet button[data-act=chiudi]");
    await sync(page); return JSON.parse(JSON.stringify(DB.ultimoImport));
  };
  const da17 = await importa51("kpi-selezionati.csv", csv51(testa17), true);
  check(Math.abs(da17.p_io.vpg - 15626.29) < 0.001 && da17.p_io.vpp === 120.5 && da17.p_io.percentuale === 9,
    "17 colonne: numeri in formato italiano letti (15.626,29 VPG, 120,50 VPP, 9%)");
  check(da17.p_persone.map(r => r.codice).join() === "7600002,7600004,7600003" && da17.p_persone.find(r => r.codice === "7600003").nome === "Utente riservato"
    && da17.p_persone.find(r => r.codice === "7600003").sponsor === "7600002", "17 colonne: posizioni e sponsor dal file");
  check(!/S999999|Sponsorizzazione/.test(JSON.stringify(da17)), "la colonna «Sponsorizzazione» non si legge");
  const da26 = await importa51("tutti-i-kpi.csv", csv51(testa26), false);
  check(JSON.stringify(da26.p_io) === JSON.stringify(da17.p_io) && JSON.stringify(da26.p_persone) === JSON.stringify(da17.p_persone),
    "26 colonne in un altro ordine: al database arrivano esattamente gli stessi dati del file a 17 colonne");
  check(!/S999999|\+39|@|Via Prova/.test(JSON.stringify(da26)), "26 colonne: niente Sponsorizzazione, telefono, email, indirizzo");
  check(DB.partners.filter(p => ["7600002", "7600003", "7600004"].includes(p.codice_amway)).length === 3, "26 colonne dopo 17: nessun doppione");
  // senza la colonna dello sponsor non si può rifare la struttura: il file è rifiutato
  await scegliFile(page, "senza-sponsor.csv", csv51(testa17.filter(t => t !== "Codice Amway Partner Sponsor")));
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).includes("manca la colonna «Codice Amway Partner Sponsor»"), "senza la colonna dello sponsor: rifiutato, con il nome della colonna");
  await page.click(".sheet button[data-act=chiudi]");
  /* VPP negativi: il mese dopo una chiusura con la tolleranza Amway fa partire da meno i VP che mancavano; si salvano così */
  { const orig = persone51.map(x => Object.assign({}, x));
    persone51[1]["VPP"] = "'-489,17"; persone51[3]["VPP"] = "'\u221212,50"; persone51[3]["VPG"] = "'-12,50";
    const neg = await importa51("vpp-negativi.csv", csv51(testa17), false);
    check(neg.p_persone.find(r => r.codice === "7600002").vpp === -489.17 && neg.p_persone.find(r => r.codice === "7600004").vpp === -12.5
      && neg.p_persone.find(r => r.codice === "7600004").vpg === -12.5, "VPP negativi (anche con il segno «−»): letti e salvati così come sono");
    await page.locator("button[data-act=vista-gruppo]").first().click();
    check((await page.locator(".albero.struttura li", { hasText:"Aldo Primo" }).innerText()).includes("-489,17 VP da recuperare"),
      "nella struttura i VP negativi dicono «da recuperare»");
    check(!errori.length, "VPP negativi: nessun errore nella pagina");
    /* un valore che non è un numero: l'avviso dice cosa c'è scritto nel file */
    persone51[1]["VPP"] = "'abc";
    await scegliFile(page, "vpp-sbagliati.csv", csv51(testa17));
    await page.locator(".sheet .errore").waitFor();
    check((await page.locator(".sheet .errore").innerText()).includes("Nel file i VPP di Aldo Primo sono «abc»: non è un numero"),
      "VPP che non sono un numero: l'avviso mostra il valore del file");
    await page.click(".sheet button[data-act=chiudi]");
    persone51.splice(0, persone51.length, ...orig);
    await importa51("di-nuovo.csv", csv51(testa17), false); }

  // 45/47. Solo Paese = Italia: le righe di altri Paesi si scartano e basta, con qualsiasi import; al database non arriva niente di loro
  const estero = (liv, sp, cod, nome, paese) => Object.assign(p51(liv, sp, cod, nome, "50,00", "50,00", 0, 1), { "Paese":"'" + paese });
  const csvCon = (testa, righe) => "\ufeff" + [csvRiga(["Amway","CONFIDENZIALE - REPORT DI PROVA"]), csvRiga(["Mese di competenza", meseFile]), csvRiga(testa)]
    .concat(righe.map(p => csvRiga(testa.map(t => p[t])))).join("\n");
  DB.partners.push({ id:"est51", nome:"Estero Gia Importato", sponsor_id:"mappa51", stato:"gestito", gestore_id:"mappa51", codice_amway:"7600009",
    codice_invito:"EST51A", creato_il:new Date().toISOString() });
  await page.close(); await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  const conEsteri = persone51.concat([estero(2, "7600001", "7600009", "ESTERO, GIA", "Spagna"), estero(3, "7600009", "7600010", "LONTANO, LEO", "Regno Unito")]);
  await scegliFile(page, "con-esteri.csv", csvCon(testa26, conEsteri));
  await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
  check(await page.getByText("4 persone nel file (più 2 di altri Paesi, che non si salvano)").isVisible()
    && !(await page.locator(".sheet .imp-esteri").count()) && !(await page.locator(".sheet .imp-nuovi").count()),
    "047: riepilogo: le righe estere non entrano e non c'è più la sezione «Di altri Paesi»");
  await page.locator(".toast", { hasText:"Import di" }).waitFor();
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  const inviato45 = DB.ultimoImport;
  check(!inviato45.p_persone.some(r => ["7600009", "7600010"].includes(r.codice)) && !("p_esteri" in inviato45)
    && !/7600010|ESTERO|Estero|LONTANO|Lontano|Leo/.test(JSON.stringify(inviato45)), "047: delle righe estere al database non arriva niente, nemmeno il codice");
  check(DB.partners.some(p => p.id === "est51" && p.fuori_report_dal), "047: un codice già nell'app che non è più nella mappa italiana esce come tutti («non più nel report»)");
  // un italiano sotto un codice estero presente nel file: l'import si ferma
  await scegliFile(page, "sotto-estero.csv", csvCon(testa17, persone51.concat([estero(2, "7600001", "7600011", "FUORI, FIO", "Svizzera"),
    p51(3, "7600011", "7600012", "ITALO, IVO", "10,00", "10,00", 0, 1)])));
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).startsWith("Ivo Italo (7600012) è in Italia, ma nel file il suo sponsor (7600011) è di un altro Paese"),
    "045: un italiano sotto un codice estero del file: import fermato con il messaggio");
  // lo sponsor della prima riga non è nel file: è normale
  check(!(await page.getByText("7600000").count()), "045: lo sponsor della prima riga (fuori dal file) non ferma l'import");
  await page.click(".sheet button[data-act=chiudi]");
  await scegliFile(page, "senza-paese.csv", csvCon(testa17.filter(t => t !== "Paese"), persone51));
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).includes("manca la colonna «Paese»"), "045: senza la colonna Paese l'import è rifiutato");
  await page.click(".sheet button[data-act=chiudi]");
  await scegliFile(page, "estero-io.csv", csvCon(testa17, [estero(1, "7600000", "7600001", "PROVA, MAPPA", "Spagna")].concat(persone51.slice(1))));
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).startsWith("Questo file è di un codice di un altro Paese"), "045: il file di un codice estero è rifiutato");
  await page.click(".sheet button[data-act=chiudi]");

  // 46. Ogni mappa sostituisce la precedente: decide il «Mese di competenza», non la data del file
  const conFile = async (nome, testo, ms) => page.evaluate(([n, t, m]) => {
    const f = new File([t], n, { type:"text/csv", lastModified:m }), dt = new DataTransfer(); dt.items.add(f);
    const i = document.querySelector(".sheet #file-report") || document.querySelector("input.file-amway"); i.files = dt.files; i.dispatchEvent(new Event("change", { bubbles:true })); }, [nome, testo, ms]);
  const idCod = c => (DB.partners.find(p => p.codice_amway === c) || {}).id;
  const conMese = (mese, righe) => csvCon(testa17, righe).replace(`"Mese di competenza","${meseFile}"`, `"Mese di competenza","${mese}"`);
  // stesso mese, file scaricato 5 giorni fa: sostituisce lo stesso (numeri, posizioni e il nome vero di «Utente riservato»)
  const stessoMese = [Object.assign({}, persone51[0], { "VPP":"'99,00" }), persone51[1],
    Object.assign({}, persone51[2], { "Nome":"'RISERVA, RITA" }), Object.assign({}, persone51[3], { "Codice Amway Partner Sponsor":"'7600002", "Qualifica Amway Partner":"3" })];
  await page.locator(".toast", { hasText:"Import di" }).waitFor({ state:"detached" });
  /* 051: un partner (non admin) con una mappa dello stesso mese scaricata 5 giorni fa: chi ha già i dati di una mappa
     scaricata dopo non cambia */
  await conFile("stesso-mese.csv", csvCon(testa17, stessoMese), Date.now() - 5 * 86400000);
  await page.locator(".sheet .data-report").waitFor();
  check((await page.locator(".sheet .data-report").innerText()).startsWith("File del ")
    && await page.locator(".sheet .imp-piu-vecchi").getByText("già i dati di una mappa").isVisible(),
    "051: riepilogo: la data di scaricamento del file e chi ha già i dati di una mappa scaricata dopo");
  await page.locator(".toast", { hasText:"Import di" }).waitFor();
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  check((DB.numeri.filter(x => x.partner_id === "mappa51" && x.mese === oggiStr.slice(0, 7)).pop() || {}).vpp !== 99,
    "051: la mappa di un partner scaricata prima non sostituisce i numeri");
  // la stessa mappa scaricata adesso: sostituisce (numeri, posizioni e il nome vero di «Utente riservato»)
  await page.locator(".toast", { hasText:"Import di" }).waitFor({ state:"detached" });
  await conFile("stesso-mese.csv", csvCon(testa17, stessoMese), Date.now());
  await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
  await page.locator(".toast", { hasText:"Import di" }).waitFor();
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  const numMappa = m => (DB.numeri || []).filter(x => x.partner_id === "mappa51" && x.mese === m).pop() || {};
  check(numMappa(oggiStr.slice(0, 7)).vpp === 99 && DB.partners.find(p => p.codice_amway === "7600004").sponsor_id === idCod("7600002"),
    "051: una mappa dello stesso mese scaricata dopo sostituisce numeri e posizioni");
  check(DB.partners.find(p => p.codice_amway === "7600003").nome === "Rita Riserva", "046: «Utente riservato» prende il nome vero quando il file lo mostra");
  // un mese precedente: solo i numeri di quel mese, la struttura non cambia
  const nomeMeseIt = m => ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"][Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4);
  const mesePrima = (() => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  await page.locator(".toast", { hasText:"Import di" }).waitFor({ state:"detached" });
  await scegliFile(page, "mese-prima.csv", conMese(mesePrima.replace("-", ""), [Object.assign({}, persone51[0], { "VPP":"'55,00", "VPG":"'7.777,00" }),
    Object.assign({}, persone51[1], { "Codice Amway Partner Sponsor":"'7600004", "Qualifica Amway Partner":"4" })].concat(persone51.slice(2))));
  await page.locator(".sheet h2", { hasText:"Numeri salvati" }).waitFor();
  check(await page.locator(".sheet .imp-numeri").getByText(nomeMeseIt(mesePrima)).isVisible(),
    "046: la mappa di un mese precedente salva subito solo i numeri di quel mese");
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  check(numMappa(mesePrima).vpg === 7777 && numMappa(oggiStr.slice(0, 7)).vpp === 99 && DB.partners.find(p => p.codice_amway === "7600002").sponsor_id === "mappa51"
    && DB.partners.find(p => p.id === "mappa51").mappa_mese === oggiStr.slice(0, 7) + "-01",
    "046: la mappa di un mese precedente salva i numeri di quel mese e non tocca struttura né mese della mappa");
  // 050: chi esce dalla mappa esce dalla struttura; chi usa l'app la trova bloccata; se rientra si sblocca da solo
  await ctx.close();
  DB.partners.push({ id:"zz51", nome:"Zeno Zaino", sponsor_id:"mappa51", stato:"attivo", chiave:"e2".repeat(16), codice_invito:"ZZ51ZZ", codice_amway:"7600040",
    confermato_il:new Date().toISOString(), privacy_accettata_il:"2026-10-01T00:00:00Z", partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
  const conZeno = stessoMese.concat([p51(2, "7600001", "7600040", "ZAINO, ZENO", "30,00", "30,00", 3, 1)]);
  // Zeno entra dal suo telefono (il telefono resta collegato al suo profilo)
  ({ ctx, page } = await apri({}, "#chiave=" + "e2".repeat(16)));
  await page.getByText("Ciao Zeno").waitFor();
  const sessZeno = await page.evaluate(() => localStorage.getItem("mock.session"));
  await sync(page);
  const telefonoZeno = () => apri({ storageState:{ cookies:[], origins:[{ origin:"http://127.0.0.1:8765", localStorage:[{ name:"mock.session", value:sessZeno }] }] } }, "");
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await scegliFile(page, "senza-rita-e-zeno.csv", csvCon(testa17, [stessoMese[0], stessoMese[1], stessoMese[3]]));
  await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
  check(await page.locator(".sheet .imp-mancanti").getByText(/Rita Riserva \(7600003\), Zeno Zaino \(7600040\) · app bloccata|Zeno Zaino \(7600040\) · app bloccata, Rita Riserva \(7600003\)/).isVisible(),
    "050: riepilogo: chi non è più nella mappa esce; per chi usa l'app «app bloccata»");
  await page.getByText(/1 app bloccata/).waitFor();
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  check(!(await page.locator(".albero.struttura li", { hasText:"Rita Riserva" }).count()) && !(await page.locator(".albero.struttura li", { hasText:"Zeno Zaino" }).count())
    && DB.partners.some(p => p.codice_amway === "7600003" && p.fuori_report_dal), "050: escono dalla struttura (non si vedono più), i dati restano");
  await ctx.close();
  ({ ctx, page } = await telefonoZeno());
  await page.getByText("App bloccata").waitFor();
  check(await page.getByText("Non sei più nella mappa Amway del tuo gruppo").isVisible(), "050: chi usa l'app ed è uscito dalla mappa trova l'app bloccata, con il perché");
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await scegliFile(page, "rientrano.csv", csvCon(testa17, conZeno));
  await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  check(await page.locator(".albero.struttura li", { hasText:"Zeno Zaino" }).isVisible() && DB.partners.some(p => p.codice_amway === "7600003" && !p.fuori_report_dal),
    "050: chi ricompare in una mappa riprende il suo posto");
  await ctx.close();
  ({ ctx, page } = await telefonoZeno());
  await page.getByText("Ciao Zeno").waitFor(); check(true, "050: e l'app si sblocca da sola");
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  // 049: il perimetro: una riga che non risale a chi importa (file modificato) si ignora, con chi sta sotto di lei
  await page.locator(".toast", { hasText:"Import di" }).waitFor({ state:"detached" });
  await scegliFile(page, "modificato.csv", csvCon(testa17, [stessoMese[0], stessoMese[1], stessoMese[3],
    p51(2, "9999990", "7600030", "ALTRA, LINEA", "10,00", "10,00", 0, 2), p51(3, "7600030", "7600031", "SOTTO, ALTRA", "5,00", "5,00", 0, 1)]));
  await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
  check(await page.locator(".sheet .imp-ignorate").getByText("2 righe ignorate").isVisible() && !(await page.locator(".sheet .imp-nuovi").count()),
    "049: riepilogo: 2 righe ignorate perché non risalgono a chi importa");
  await sync(page);
  check(!DB.partners.some(p => ["7600030", "7600031"].includes(p.codice_amway)) && !JSON.stringify(DB.ultimoImport).includes("7600030"),
    "049: le righe fuori dalla downline non arrivano al database e non creano nessuno");
  await page.click(".sheet button[data-act=chiudi]");
  // 048: chi importa è la riga di livello 1; senza quella riga, o senza un codice Amway nell'app, l'import è rifiutato
  await page.locator(".toast", { hasText:"Import di" }).waitFor({ state:"detached" });
  await scegliFile(page, "senza-livello-1.csv", csvCon(testa17, persone51.slice(1)));
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).startsWith("Nel file non c'è la riga di livello 1"), "048: un file senza la riga di livello 1 è rifiutato");
  await ctx.close();
  DB.partners.find(p => p.id === "mappa51").codice_amway = null;
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await scegliFile(page, "senza-codice.csv", csvCon(testa17, persone51));
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).startsWith("Nel tuo profilo manca il codice Amway"), "048: senza codice Amway nell'app non si importa");
  await ctx.close();
  DB.partners.find(p => p.id === "mappa51").codice_amway = "7600001";
}

// 52. Il gruppo di un Platino che non usa l'app: l'admin invita sotto di lui; chi entra importa subito la sua mappa
{
  const mese = oggiStr.slice(0, 7);
  DB.partners.find(p => p.id === "mappa51").is_admin = true;
  DB.partners.push({ id:"pl52", nome:"Plinio Platino", sponsor_id:"mappa51", stato:"gestito", gestore_id:"mappa51", codice_amway:"7600060",
    codice_invito:"PL52PL", creato_il:new Date().toISOString(), mappa_mese:mese + "-01" });
  DB.numeri.push({ visto_da:"mappa51", partner_id:"pl52", mese, vpp:0, vpg:5000, percentuale:15, linee:[], nascoste:true, dati_al:new Date().toISOString() });
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li", { hasText:"Plinio Platino" }).locator("button[data-act=apri-scheda]").click();
  await azioniScheda(page);
  check(await page.locator(".platino-scheda").getByText("Gruppo di un Platino senza app").isVisible(), "052: scheda del Platino senza app: la sezione per l'admin");
  await page.click("button[data-act=invita-platino]");
  await page.locator(".sheet h2", { hasText:"Invita sotto Plinio Platino" }).waitFor();
  await page.waitForTimeout(800);
  await compila([[".sheet input[name=nome]", "Xena Sotto"], [".sheet input[name=codice_amway]", "7600061"], [".sheet input[name=codice_amway2]", "7600061"]]);
  await page.click(".sheet button.primary");
  await page.locator(".sheet h2", { hasText:"Il link per Xena Sotto" }).waitFor();
  const linkX = await page.locator(".sheet .linkbox").innerText();
  await sync(page);
  const invX = DB.invitiP.find(i => i.codice_amway === "7600061");
  check(invX && invX.sotto_id === "pl52" && invX.area_platino === "pl52", "052: l'invito è «sotto il Platino»");
  // la scheda di chi non è un Platino nascosto non ha la sezione
  await page.click(".sheet button[data-act=chiudi]");
  await ctx.close();
  // Xena entra: sotto il Platino, in attesa, e importa subito la sua mappa
  ({ ctx, page } = await apri({}, linkX.slice(linkX.indexOf("#"))));
  await page.getByText("Ciao Xena,").waitFor();
  await page.selectOption("select[name=qualifica]", "pin:3");
  await page.check("input[name=privacy]"); await page.click("form button.primary");
  await perche(page);
  await page.getByText("Ciao Xena").waitFor(); await apriTappa(page);
  await sync(page);
  const xena = DB.partners.find(p => p.codice_amway === "7600061");
  check(xena.sponsor_id === "pl52" && xena.area_platino === "pl52" && !xena.confermato_il, "052: Xena entra sotto il Platino, in attesa");
  check(await page.locator(".primi-passi .stato-attesa").getByText("importa la tua mappa").isVisible(), "052: in attesa, ma le si dice di importare la sua mappa");
  await scegliFile(page, "xena.csv", creaCsv(meseFile, [persona(1, "7600060", "7600061", "SOTTO, XENA", "60,00"),
    persona(2, "7600061", "7600062", "GRUPPO, YARA", "20,00")]));
  await page.locator(".sheet h2", { hasText:"importata" }).waitFor();
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  check(!!DB.partners.find(p => p.codice_amway === "7600061").confermato_il && DB.partners.find(p => p.codice_amway === "7600062").sponsor_id === xena.id,
    "052: chi è sotto un Platino senza app importa subito la sua mappa: confermata, con il suo gruppo sotto di lei");
  check(!(await page.locator(".primi-passi .stato-attesa").count()), "052: dopo l'import non è più in attesa");
  await ctx.close();
  // l'admin inserisce uno sponsor tra Xena (usa l'app) e il Platino
  ({ ctx, page } = await apri({}, "#chiave=" + "d1".repeat(16)));
  await page.getByText("Ciao Mappa").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li", { hasText:"Xena Sotto" }).locator("button[data-act=apri-scheda]").click();
  await azioniScheda(page);
  await page.click("button[data-act=invita-platino]");
  await page.locator(".sheet h2", { hasText:"Invita sopra Xena Sotto" }).waitFor();
  await page.waitForTimeout(800);
  await compila([[".sheet input[name=nome]", "Walter Mezzo"], [".sheet input[name=codice_amway]", "7600063"], [".sheet input[name=codice_amway2]", "7600063"]]);
  await page.click(".sheet button.primary");
  await page.locator(".sheet h2", { hasText:"Il link per Walter Mezzo" }).waitFor();
  const linkW = await page.locator(".sheet .linkbox").innerText();
  await sync(page);
  await page.click(".sheet button[data-act=chiudi]");
  // fuori dal gruppo di un Platino senza app: nessuna sezione (niente inserimenti in mezzo altrove)
  await page.click("button.link[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li", { hasText:"Aldo Primo" }).locator("button[data-act=apri-scheda]").click();
  await azioniScheda(page);
  check(!(await page.locator(".platino-scheda").count()), "052: fuori dal gruppo di un Platino senza app l'admin non inserisce nessuno in mezzo");
  await ctx.close();
  ({ ctx, page } = await apri({}, linkW.slice(linkW.indexOf("#"))));
  await page.getByText("Ciao Walter,").waitFor();
  await page.selectOption("select[name=qualifica]", "pin:3");
  await page.check("input[name=privacy]"); await page.click("form button.primary");
  await page.getByText("Da dove parti?").waitFor();
  await sync(page);
  const walter = DB.partners.find(p => p.codice_amway === "7600063");
  check(walter.sponsor_id === "pl52" && DB.partners.find(p => p.codice_amway === "7600061").sponsor_id === walter.id,
    "052: Walter entra tra il Platino e Xena");
  await ctx.close();
}

// 53. I filtri del Gruppo: tutta la mappa, poi si sceglie chi vedere
{
  const mese = oggiStr.slice(0, 7), oggiD = oggiStr;
  DB.partners.push({ id:"fg53", nome:"Filtra Gruppo", sponsor_id:"R", stato:"attivo", chiave:"f5".repeat(16), codice_invito:"FG53FG", codice_amway:"7700001",
    confermato_il:new Date().toISOString(), privacy_accettata_il:"2026-10-01T00:00:00Z", partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
  const g = (id, nome, sp, stato, vpp, perc, ingresso) => {
    DB.partners.push({ id, nome, sponsor_id:sp, stato, gestore_id:stato === "gestito" ? "fg53" : null, codice_amway:"77" + id.slice(-5), codice_invito:id.toUpperCase(),
      confermato_il:stato === "gestito" ? null : new Date().toISOString(), creato_il:new Date().toISOString(), data_iscrizione:ingresso || "2020-01-01" });
    DB.numeri.push({ visto_da:"fg53", partner_id:id, mese, vpp, vpg:vpp, percentuale:perc, linee:[], dati_al:new Date().toISOString() }); };
  g("fga00001", "Alba Alta", "fg53", "gestito", 250, 6, oggiD);
  g("fga00002", "Bruno Basso", "fga00001", "gestito", 50, 0);
  g("fga00003", "Carla Zero", "fg53", "gestito", 0, 0);
  g("fga00004", "Dario App", "fg53", "attivo", 0, 3);
  g("fga00005", "Elio Profondo", "fga00002", "gestito", 0, 0);
  g("fga00006", "Fede Fondo", "fga00005", "gestito", 0, 0);
  ({ ctx, page } = await apri({}, "#chiave=" + "f5".repeat(16)));
  await page.getByText("Ciao Filtra").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".filtri-gruppo").waitFor();
  const testi = (await page.locator(".filtri-gruppo button").allInnerTexts()).map(t => t.trim());
  check(JSON.stringify(testi) === JSON.stringify(["Tutti", "Con VP · 2", "Senza VP · 4", "Oltre 200 VP · 1", "Nuovi · 1", "Usano l'app · 1", "Senza app · 5", "Percentuale · 2"]),
    "Gruppo: i filtri con i conteggi (" + testi.join(" | ") + ")");
  const nomi = async () => (await page.locator(".elenco-filtro li .nome-apri > span:first-child").allInnerTexts()).map(t => t.trim());
  const filtra = async id => { await page.click(`.filtri-gruppo button[data-filtro=${id}]`); await page.waitForTimeout(150); };
  await filtra("con-vp"); check(JSON.stringify(await nomi()) === JSON.stringify(["Alba Alta", "Bruno Basso"]), "Con VP: chi ha fatturato questo mese");
  check(await page.locator(".elenco-filtro li", { hasText:"Bruno Basso" }).getByText("sotto Alba Alta").isVisible(), "l'elenco dice sotto chi sta ognuno");
  await filtra("senza-vp"); check(JSON.stringify(await nomi()) === JSON.stringify(["Elio Profondo", "Fede Fondo", "Carla Zero", "Dario App"]), "Senza VP: chi è a 0");
  await filtra("oltre-200"); check(JSON.stringify(await nomi()) === JSON.stringify(["Alba Alta"]), "Oltre 200 VP");
  await filtra("nuovi"); check(JSON.stringify(await nomi()) === JSON.stringify(["Alba Alta"]) && await page.locator(".elenco-filtro li").getByText(/entrato il/).isVisible(),
    "Nuovi: chi è entrato in Amway questo mese, con la data di ingresso");
  await filtra("app"); check(JSON.stringify(await nomi()) === JSON.stringify(["Dario App"]), "Usano l'app");
  await filtra("senza-app"); check((await nomi()).length === 5 && !(await nomi()).includes("Dario App"), "Senza app");
  await filtra("percentuale"); check(JSON.stringify(await nomi()) === JSON.stringify(["Alba Alta", "Dario App"])
    && await page.locator(".elenco-filtro li", { hasText:"Alba Alta" }).getByText("6%").isVisible(), "Percentuale: dalla più alta, con la percentuale");
  check(await page.evaluate(() => { const f = document.querySelector(".filtri-gruppo"), b = f.querySelector(".btn.on");
    const rf = f.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rb.left >= rf.left - 1 && rb.right <= rf.right + 1; }),
    "il filtro acceso resta in vista nella riga dei filtri");
  await page.fill("#cerca-struttura", "dario");
  await page.waitForTimeout(150);
  check(await page.locator(".elenco-filtro li:visible").count() === 1, "la ricerca lavora dentro il filtro");
  await page.fill("#cerca-struttura", "");
  await page.locator(".card", { hasText:"La mia struttura" }).screenshot({ path: S + "/e2e/53-filtri-gruppo.png" });
  await filtra("tutti");
  check(await page.locator(".albero.struttura:not(.elenco-filtro) li", { hasText:"Bruno Basso" }).count() === 1, "Tutti: torna l'albero");
  // ricerca in profondità: «Linea di … › … › sponsor»; toccando «…» si apre il percorso intero
  await page.fill("#cerca-struttura", "fede");
  const percFede = page.locator(".albero.struttura li", { hasText:"Fede Fondo" }).locator(".percorso");
  check((await percFede.innerText()).replace(/\s+/g, " ").trim() === "Linea di Alba Alta › … › Elio Profondo (sponsor)", "ricerca: il percorso corto (linea, …, sponsor)");
  await percFede.locator("button.puntini").click();
  check((await percFede.innerText()).replace(/\s+/g, " ").trim() === "Linea di Alba Alta › Bruno Basso › Elio Profondo (sponsor)Chiudi ▴"
    && await page.locator("#cerca-struttura").inputValue() === "fede", "ricerca: toccando «…» si apre il percorso intero, la ricerca resta");
  await page.locator(".card", { hasText:"La mia struttura" }).screenshot({ path: S + "/e2e/54-ricerca-percorso.png" });
  await percFede.locator("button.chiudi-percorso").click();
  check((await percFede.innerText()).replace(/\s+/g, " ").trim() === "Linea di Alba Alta › … › Elio Profondo (sponsor)"
    && await page.locator("#cerca-struttura").inputValue() === "fede", "ricerca: «Chiudi» richiude il percorso e torna come prima");
  await page.fill("#cerca-struttura", "");
  await ctx.close();
}

// 55. Persone → Lista: le cerchie (053). Gruppi della lista, una persona in più cerchie, filtro combinato con lo stato
{
  DB.partners.push({ id:"ce53", nome:"Cerchia Prova", sponsor_id:"R", stato:"attivo", chiave:"c5".repeat(16), codice_invito:"CE53CE",
    confermato_il:new Date().toISOString(), privacy_accettata_il:"2026-10-01T00:00:00Z", partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
  const ieri = new Date(Date.now() - 86400000).toISOString();
  DB.persone.push({ id:"cp1", proprietario:"ce53", nome:"Anna Palestra", fase:"lista", esito:null, origine:"palestra", creato_il:ieri },
    { id:"cp2", proprietario:"ce53", nome:"Bea Ufficio", fase:"lista", esito:null, creato_il:ieri },
    { id:"cp3", proprietario:"ce53", nome:"Ciro Chiuso", fase:"piano", esito:"no", creato_il:ieri },
    { id:"cc1", proprietario:"ce53", nome:"Gina Cliente", fase:"chiusura", esito:"cliente", creato_il:ieri },
    { id:"cc2", proprietario:"ce53", nome:"Ugo Cliente", fase:"chiusura", esito:"cliente", creato_il:ieri },
    { id:"cpx", proprietario:"R", nome:"Di Altri", fase:"lista", esito:null, creato_il:ieri });
  DB.cerchie = (DB.cerchie || []).concat([{ id:"cxR", proprietario:"R", nome:"Non mia", creato_il:ieri }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "c5".repeat(16)));
  await page.getByText("Ciao Cerchia").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]");
  check(await page.locator(".cerchie-lista button[data-act=cerchia-nuova]").isVisible()
    && !await page.locator(".cerchie-lista button[data-act=filtro-cerchia]").count(), "Lista: la riga delle cerchie con «+ Cerchia» (le cerchie degli altri non si vedono)");
  // una nuova cerchia: si apre subito «Aggiungi nomi»; la lista resta completa (la cerchia non si accende da sola)
  await page.click("button[data-act=cerchia-nuova]");
  await page.fill(".sheet input[name=nome]", "Palestra");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchia «Palestra» creata").waitFor();
  check(await page.locator(".sheet h2", { hasText:"Aggiungi a «Palestra»" }).isVisible(), "cerchia creata: si apre subito «Aggiungi nomi»");
  await page.click(".sheet [data-act=chiudi]");
  check(!await page.locator(".cerchie-lista button.on").count() && !await page.getByText("Tutti i nomi").count() && !await page.locator(".cerchia-barra").count()
    && (await page.locator(".persone button[data-act=apri-persona]").count()) === 3, "dopo la cerchia nuova si vede la lista completa");
  // una cerchia vuota scelta lo dice, con il modo di tornare a tutta la lista
  await page.click(".cerchie-lista button[data-act=filtro-cerchia]:has-text('Palestra')");
  check(await page.getByText("La cerchia «Palestra» è ancora vuota.").isVisible(), "cerchia vuota: lo dice invece dei soli zeri");
  await page.click(".cerchia-vuota button:has-text('Mostra tutta la lista')");
  check(!await page.locator(".cerchie-lista button.on").count() && !await page.locator(".cerchia-vuota").count(), "«Mostra tutta la lista» torna a tutti");
  // stesso nome (maiuscole diverse): rifiutato
  await page.click("button[data-act=cerchia-nuova]");
  await page.fill(".sheet input[name=nome]", " palestra ");
  await page.click(".sheet button:has-text('Salva')");
  check(await page.locator(".sheet").getByText("Hai già una cerchia con questo nome.").isVisible(), "due cerchie con lo stesso nome: no");
  await page.fill(".sheet input[name=nome]", "Colleghi");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchia «Colleghi» creata").waitFor();
  await page.click(".sheet [data-act=chiudi]");
  // «Aggiungi nomi» con le spunte, da dentro la cerchia
  await page.click(".cerchie-lista button[data-act=filtro-cerchia]:has-text('Palestra')");
  await page.click(".cerchia-barra button[data-act=cerchia-aggiungi]");
  check(await page.locator(".sheet h2", { hasText:"Aggiungi a «Palestra»" }).isVisible()
    && await page.locator(".sheet .scelte-cerchia label").count() === 3 && !await page.locator(".sheet").getByText("Di Altri").count(), "Aggiungi nomi: i nomi della mia lista, con le spunte");
  await page.click(".sheet button:has-text('Aggiungi')");
  check(await page.locator(".sheet").getByText("Spunta almeno un nome.").isVisible(), "senza spunte non si aggiunge niente");
  await page.locator(".sheet .scelte-cerchia label", { hasText:"Anna Palestra" }).click();
  await page.locator(".sheet .scelte-cerchia label", { hasText:"Ciro Chiuso" }).click();
  await page.click(".sheet button:has-text('Aggiungi')");
  await page.getByText("2 nomi aggiunti alla cerchia").waitFor();
  // filtro combinato: Tutti + Palestra = Anna e Ciro; In lista + Palestra = solo Anna; Chiusi + Palestra = solo Ciro
  const nomiLista = async () => (await page.locator(".persone button[data-act=apri-persona]").allInnerTexts()).map(t => t.split("\n")[0].trim());
  check(JSON.stringify(await nomiLista()) === JSON.stringify(["Anna Palestra", "Ciro Chiuso"]) && await page.getByText("Tutti · 2").isVisible(),
    "cerchia + Tutti: tutta la cerchia");
  await page.click("button[data-filtro=lista]");
  check(JSON.stringify(await nomiLista()) === JSON.stringify(["Anna Palestra"]) && await page.getByText("Chiusi · 1").isVisible(),
    "cerchia + In lista: solo chi è in tutte e due; i conteggi degli stati contano nella cerchia");
  await page.click("button[data-filtro=chiusi]");
  check(JSON.stringify(await nomiLista()) === JSON.stringify(["Ciro Chiuso"]), "cerchia + Chiusi");
  await page.click("button[data-filtro=lista]");
  await page.locator(".card", { hasText:"La mia lista" }).screenshot({ path: S + "/e2e/55-cerchie.png" });
  // un nome nuovo da dentro la cerchia: la cerchia è già spuntata; si può mettere anche in un'altra
  await page.click("button[data-act=persona-nuova]");
  check(await page.locator(".sheet .cerchie-scelta label", { hasText:"Palestra" }).locator("input").isChecked()
    && !await page.locator(".sheet .cerchie-scelta label", { hasText:"Colleghi" }).locator("input").isChecked(), "+ Nome dentro una cerchia: la cerchia è già spuntata");
  await page.fill(".sheet input[name=nome]", "Dino Due");
  await page.locator(".sheet .cerchie-scelta label", { hasText:"Colleghi" }).click();
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Dino Due nella tua lista").waitFor();
  check(JSON.stringify(await nomiLista()) === JSON.stringify(["Dino Due", "Anna Palestra"]), "il nome nuovo è nella cerchia, in cima");
  await page.click(".cerchie-lista button[data-act=filtro-cerchia]:has-text('Colleghi')");
  check(JSON.stringify(await nomiLista()) === JSON.stringify(["Dino Due"]), "una persona in più cerchie");
  // la scheda dice le cerchie; dalla modifica si toglie da una cerchia
  await page.click("button[data-act=apri-persona]:has-text('Dino Due')");
  const pillCerchie = async () => (await page.locator(".cerchie-persona .pill").allInnerTexts()).map(t => t.trim()).join(" ");
  check(await pillCerchie() === "Colleghi Palestra" && (await page.locator(".cerchie-persona").innerText()).startsWith("Cerchie:"), "la scheda: «Cerchie:» con i nomi");
  await page.click("button.nome-modifica");
  await page.locator(".sheet .cerchie-scelta label", { hasText:"Colleghi" }).click();
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Dati salvati").waitFor();
  check(await pillCerchie() === "Palestra", "togliendo la spunta esce dalla cerchia");
  // dalla scheda: «Cambia le cerchie», spunte e una cerchia nuova
  await page.click(".cerchie-persona button[data-act=persona-cerchie]:has-text('Cambia le cerchie')");
  await page.locator(".sheet h2", { hasText:"Le cerchie di Dino Due" }).waitFor();
  check(await page.locator(".sheet label.chip", { hasText:"Palestra" }).locator("input").isChecked()
    && !await page.locator(".sheet label.chip", { hasText:"Colleghi" }).locator("input").isChecked(), "scheda: le cerchie della Lista, spuntate quelle in cui sta");
  await page.fill(".sheet input[name=nuova]", "Palestra");
  await page.click(".sheet button:has-text('Salva')");
  check(await page.locator(".sheet .errore", { hasText:"Hai già una cerchia con questo nome" }).isVisible(), "scheda: un nome già usato non crea un doppione");
  await page.fill(".sheet input[name=nuova]", "Amici");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchia «Amici» creata").waitFor();
  check(await pillCerchie() === "Amici Palestra" && await page.locator("h2", { hasText:"Dino Due" }).isVisible(), "scheda: creata la cerchia e la persona è dentro, si resta sulla scheda");
  await page.screenshot({ path: S + "/e2e/55-cerchie-scheda.png" });
  await page.click(".cerchie-persona button[data-act=persona-cerchie]");
  await page.locator(".sheet label.chip", { hasText:"Amici" }).click();
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchie aggiornate").waitFor();
  check(await pillCerchie() === "Palestra", "scheda: togliendo la spunta esce dalla cerchia");
  await page.click(".cerchie-persona button[data-act=persona-cerchie]");
  await page.locator(".sheet label.chip", { hasText:"Amici" }).click();
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchie aggiornate").waitFor();
  check(await pillCerchie() === "Amici Palestra", "scheda: spuntando una cerchia che c'è già ci entra");
  await page.click(".cerchie-persona button[data-act=persona-cerchie]");
  await page.locator(".sheet label.chip", { hasText:"Amici" }).click();
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchie aggiornate").waitFor();
  await page.click("button[data-act=torna-lista]");
  check(await page.locator(".cerchie-lista button.on", { hasText:"Colleghi · 0" }).isVisible() && await page.getByText("La cerchia «Colleghi» è ancora vuota.").isVisible(), "Colleghi ora è vuota");
  // toccando di nuovo la cerchia scelta si torna a tutti
  await page.click(".cerchie-lista button.on");
  check((await nomiLista()).length === 3 && !await page.locator(".cerchia-barra").count(), "ritoccando la cerchia si torna a tutta la lista");
  await page.click("button[data-filtro=tutti]");
  check((await nomiLista()).length === 4 && await page.getByText("Tutti · 4").isVisible(), "Lista: il filtro «Tutti» mostra anche i chiusi");
  await page.click("button[data-filtro=lista]");
  // Importa: più nomi insieme dentro una cerchia
  await page.click(".cerchie-lista button[data-act=filtro-cerchia]:has-text('Colleghi')");
  await page.click("button[data-act=persone-tante]");
  check(await page.locator(".sheet select[name=cerchia]").inputValue() !== "", "Importa: la cerchia scelta è già nel menu");
  await page.fill(".sheet textarea[name=righe]", "Elsa Uno\nFabio Due");
  await page.click(".sheet button:has-text('Aggiungi')");
  await page.getByText("2 nomi aggiunti").waitFor();
  check(JSON.stringify(await nomiLista()) === JSON.stringify(["Elsa Uno", "Fabio Due"]) || JSON.stringify(await nomiLista()) === JSON.stringify(["Fabio Due", "Elsa Uno"]),
    "Importa dentro una cerchia: i nomi entrano nella cerchia");
  // rinomina
  await page.click("button[data-act=cerchia-rinomina]");
  check(await page.inputValue(".sheet input[name=nome]") === "Colleghi", "Rinomina: il nome di adesso");
  await page.fill(".sheet input[name=nome]", "Ufficio");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchia rinominata").waitFor();
  check(await page.locator(".cerchie-lista button.on", { hasText:"Ufficio · 2" }).isVisible(), "la cerchia rinominata resta scelta");
  // elimina: le persone restano nella lista
  await page.click("button[data-act=cerchia-elimina]");
  await page.getByText("Cerchia «Ufficio» eliminata").waitFor();
  check(!await page.locator(".cerchie-lista button", { hasText:"Ufficio" }).count() && (await nomiLista()).length === 5, "eliminando la cerchia le persone restano");
  await sync(page);
  check(DB.cerchie.some(c => c.id === "cxR") && DB.pc.every(x => x.proprietario === "ce53"), "le cerchie degli altri non si toccano");
  // 054: le cerchie dei Clienti, separate da quelle della Lista
  await page.click("button[data-sez=clienti]");
  const nomiClienti = async () => (await page.locator(".persone button[data-act=apri-cliente] b").allInnerTexts()).map(t => t.trim());
  check(await page.locator(".cerchie-lista button[data-act=cerchia-nuova]").isVisible()
    && !await page.locator(".cerchie-lista button[data-act=filtro-cerchia]").count(), "Clienti: la riga delle cerchie, senza quelle della Lista");
  await page.click("button[data-act=cerchia-nuova]");
  check(await page.locator(".sheet h2", { hasText:"Una nuova cerchia di clienti" }).isVisible(), "Clienti: il foglio della cerchia dei clienti");
  await page.fill(".sheet input[name=nome]", "Palestra");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchia «Palestra» creata").waitFor();
  check(await page.locator(".sheet h2", { hasText:"Aggiungi a «Palestra»" }).isVisible(), "lo stesso nome della Lista va bene nei Clienti (sono separate)");
  await page.click(".sheet [data-act=chiudi]");
  await page.click(".cerchie-lista button[data-act=filtro-cerchia]:has-text('Palestra')");
  await page.click("button[data-act=cerchia-rinomina]");
  await page.fill(".sheet input[name=nome]", "Bellezza");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchia rinominata").waitFor();
  await page.click(".cerchia-barra button[data-act=cerchia-aggiungi]");
  check(await page.locator(".sheet .scelte-cerchia label").count() === 2 && !await page.locator(".sheet").getByText("Anna Palestra").count(),
    "Aggiungi clienti: solo i clienti");
  await page.locator(".sheet .scelte-cerchia label", { hasText:"Gina Cliente" }).click();
  await page.click(".sheet button:has-text('Aggiungi')");
  await page.getByText("1 cliente aggiunto alla cerchia").waitFor();
  check(JSON.stringify(await nomiClienti()) === JSON.stringify(["Gina Cliente"]) && await page.getByText("Tutti · 1").isVisible(),
    "Clienti: il filtro della cerchia si combina con gli altri, con i conteggi");
  await page.locator(".card", { hasText:"I miei clienti" }).screenshot({ path: S + "/e2e/56-cerchie-clienti.png" });
  // + Cliente dentro la cerchia: già spuntata; ci sono solo le cerchie dei clienti
  await page.click("button[data-act=cliente-nuovo]");
  check(await page.locator(".sheet .cerchie-scelta label", { hasText:"Bellezza" }).locator("input").isChecked()
    && await page.locator(".sheet .cerchie-scelta label").count() === 1, "+ Cliente: solo le cerchie dei clienti, quella aperta già spuntata");
  await page.fill(".sheet input[name=nome]", "Lia Nuova");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Lia Nuova tra i tuoi clienti").waitFor();
  check(await page.locator(".cerchie-persona").getByText("Bellezza").isVisible(), "la scheda del cliente: «Cerchie: Bellezza»");
  await page.click("button[data-act=torna-clienti]");
  check((await nomiClienti()).sort().join() === "Gina Cliente,Lia Nuova", "il cliente nuovo è nella cerchia");
  // un cliente che era nella Lista: modificando i dati restano le sue cerchie della Lista
  await sync(page);
  DB.pc.push({ persona_id:"cc2", cerchia_id:DB.cerchie.find(c => c.proprietario === "ce53" && (c.tipo || "lista") === "lista").id, proprietario:"ce53" });
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "c5".repeat(16)));
  await page.getByText("Ciao Cerchia").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]");
  await page.click("button[data-act=apri-cliente]:has-text('Ugo Cliente')");
  check(!await page.locator(".cerchie-persona .pill").count() && await page.locator(".cerchie-persona button", { hasText:"+ Aggiungi a una cerchia" }).isVisible(),
    "nella scheda del cliente non compaiono le cerchie della Lista; c'è «+ Aggiungi a una cerchia»");
  await page.click(".cerchie-persona button[data-act=persona-cerchie]");
  check(await page.locator(".sheet label.chip").count() === 1 && await page.locator(".sheet label.chip", { hasText:"Bellezza" }).isVisible(),
    "dalla scheda del cliente: solo le cerchie dei clienti");
  await page.fill(".sheet input[name=nuova]", "Casa");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchia «Casa» creata").waitFor();
  check((await page.locator(".cerchie-persona .pill").allInnerTexts()).join() === "Casa", "il cliente è nella cerchia nuova");
  await sync(page);
  check(DB.cerchie.some(c => c.nome === "Casa" && c.tipo === "clienti" && c.proprietario === "ce53")
    && DB.pc.filter(x => x.persona_id === "cc2").length === 2, "la cerchia nuova è dei clienti; la cerchia della Lista resta");
  await page.click(".cerchie-persona button[data-act=persona-cerchie]");
  await page.locator(".sheet label.chip", { hasText:"Casa" }).click();
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Cerchie aggiornate").waitFor();
  await sync(page);
  check(DB.pc.filter(x => x.persona_id === "cc2").length === 1, "togliendo la spunta esce solo dalla cerchia dei clienti");
  await page.click("button.nome-modifica");
  await page.locator(".sheet .cerchie-scelta label", { hasText:"Bellezza" }).click();
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Dati salvati").waitFor();
  await sync(page);
  check(DB.pc.filter(x => x.persona_id === "cc2").length === 2, "modificando un cliente le sue cerchie della Lista restano");
  // a 360 px la riga delle cerchie scorre, senza andare a capo
  await page.setViewportSize({ width:360, height:780 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= 360), "a 360 px niente scorrimento laterale della pagina");
  await ctx.close();
}

// 57. I contatti si cancellano 24 mesi dopo l'ultimo passo o ordine (055): l'avviso 30 giorni prima, solo per le mie persone
{
  const tra = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  DB.scadenze = [{ persona_id:"cp2", si_cancella_il:tra(12) }, { persona_id:"cc1", si_cancella_il:tra(0) }, { persona_id:"cpx", si_cancella_il:tra(3) }];
  ({ ctx, page } = await apri({}, "#chiave=" + "c5".repeat(16)));
  await page.getByText("Ciao Cerchia").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]");
  const riga = page.locator("button[data-act=apri-persona]", { hasText:"Bea Ufficio" });
  check(await riga.locator(".scade").textContent() === "si cancella tra 12 giorni"
    && !await page.locator("button[data-act=apri-persona]", { hasText:"Anna Palestra" }).locator(".scade").count(),
    "Lista: «si cancella tra 12 giorni» solo su chi scade entro 30 giorni");
  await riga.click();
  check(await page.locator("p.scade").textContent().then(t => t.startsWith("Si cancella tra 12 giorni: nessun passo né ordine da quasi 24 mesi")),
    "scheda: l'avviso dice quando si cancella e perché");
  await page.click("button[data-act=torna-lista]");
  await page.click("button[data-sez=clienti]");
  check(await page.locator("button[data-act=apri-cliente]", { hasText:"Gina Cliente" }).locator(".scade").textContent() === "si cancella stanotte",
    "Clienti: anche un cliente senza ordini da 24 mesi è segnato");
  await page.screenshot({ path: S + "/e2e/57-scadenze.png" });
  check(!errori.length, "scadenze: nessun errore nella pagina");
  await ctx.close();
  DB.scadenze = [];
}

// 58. L'agenda (057, consegna 4): l'icona su ogni riga, «In agenda», la lista di oggi e «Fatto» che chiede com'è andata
{
  const oggiG = new Date().toISOString().slice(0, 10), domaniG = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat([
    { id:"ag1", proprietario:"R", nome:"Agenda Prova", fase:"lista", esito:null, creato_il:"2026-01-01T10:00:00Z" },
    { id:"ag2", proprietario:"R", nome:"Agenda Seconda", fase:"lista", esito:null, creato_il:"2026-01-02T10:00:00Z" }]);
  DB.passi = (DB.passi || []).filter(x => x.proprietario !== "R");
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  check(!(await page.locator(".oggi-lista", { hasText:"Agenda Prova" }).count()), "agenda: chi è solo in lista non è in Io");
  await page.click("button[data-act=vista-persone]");
  await page.click("button[data-sez=lista]").catch(() => {});
  const riga = page.locator(".persone li", { hasText:"Agenda Prova" });
  check(await riga.locator("button.cal[data-act=agenda]").count() === 1, "agenda: l'icona calendario sulla riga della Lista");
  await riga.locator("button.cal").click();
  await page.locator(".sheet h2", { hasText:"In agenda · Agenda" }).waitFor();
  check(await page.locator(".sheet input[name=per][value=contatto]").isChecked() && await page.locator(".sheet input[name=per]").count() === 6,
    "agenda: per chi è in lista propone «Contatto», con i 6 «per cosa» della Lista");
  await page.check(".sheet input[name=per][value=fissare_piano]", { force:true });
  await page.check(`.sheet input[name=quando][value="${oggiG}"]`, { force:true });
  await page.fill(".sheet input[name=ora]", "21:00"); await page.check(".sheet input[name=come][value=telefono]", { force:true });
  await page.screenshot({ path: S + "/e2e/58-agenda.png" });
  await page.click(".sheet button.primary");
  await page.getByText("In agenda: oggi alle 21:00, telefono").waitFor();
  check(await riga.locator(".agenda-testo").innerText().then(t => t.includes("21:00") && t.includes("fissare il piano")),
    "agenda: la riga dice quando, come e per cosa");
  check(await riga.locator("button.cal.on").count() === 1, "agenda: l'icona è accesa");
  // senza giorno non si salva
  await page.locator(".persone li", { hasText:"Agenda Seconda" }).locator("button.cal").click();
  await page.click(".sheet button.primary");
  await page.locator(".sheet .errore", { hasText:"Scegli quando" }).waitFor(); check(true, "agenda: senza giorno chiede quando");
  await page.click(".sheet button[data-act=chiudi]");
  // in Io: entra nella lista di oggi, con «Fatto»
  await page.click("button[data-act=vista-io]");
  const card = page.locator(".card.oggi-lista");
  await card.waitFor();
  check((await card.locator(".prossima-titolo").innerText()).startsWith("Agenda Prova") && await card.locator("button[data-act=agenda-fatto]").count() === 1,
    "Io: chi è in agenda oggi è la prossima cosa, con «Fatto»");
  await card.locator("button[data-act=agenda-fatto]").click();
  await page.locator(".sheet h2", { hasText:"Com'è andata con Agenda" }).waitFor();
  check((await page.locator(".sheet .risposte-agenda button").allInnerTexts()).join("|") === "Piano fissato|Non ora|Non risponde", "Fatto: le risposte di «Fissare il piano»");
  await page.screenshot({ path: S + "/e2e/58-com-e-andata.png" });
  // Non risponde: nessun passo, si sceglie un altro giorno
  await page.click(".sheet button[data-r=di_nuovo]");
  await page.locator(".sheet h2", { hasText:"Quando lo risenti?" }).waitFor();
  await sync(page);
  check(!(DB.passi || []).some(x => x.persona_id === "ag1"), "Non risponde: nessun passo segnato");
  await page.click(".sheet button[data-act=chiudi]");
  // Piano fissato: un invito, poi subito «Quando è il piano?»
  await card.locator("button[data-act=agenda-fatto]").click();
  await page.click(".sheet button[data-r=piano_fissato]");
  await page.locator(".sheet h2", { hasText:"Quando è il piano?" }).waitFor();
  check(await page.locator(".sheet input[name=per][value=piano]").isChecked(), "Piano fissato: l'agenda del piano è già pronta");
  await sync(page);
  check((DB.passi || []).some(x => x.persona_id === "ag1" && x.tipo === "invito" && x.reazione === "Sì, appuntamento fissato"), "Piano fissato: nel database un invito");
  await page.check(`.sheet input[name=quando][value="${domaniG}"]`, { force:true });
  await page.click(".sheet button.primary");
  await page.getByText("In agenda: domani").waitFor();
  await sync(page);
  check((() => { const x = DB.persone.find(y => y.id === "ag1"); return x.prossima_per === "piano" && x.prossima_data === domaniG && x.prossima_ora === null; })(),
    "nel database: in agenda per il piano, domani");
  // dalla scheda: Fatto → Piano mostrato
  await page.click("button[data-act=vista-persone]");
  await page.locator("button[data-act=apri-persona]", { hasText:"Agenda Prova" }).click();
  check(await page.locator(".prossima .agenda-testo").innerText().then(t => t.includes("piano")), "scheda: «In agenda» con il piano");
  await page.click(".prossima button[data-act=agenda-fatto]");
  await page.click(".sheet button[data-r=piano_mostrato]");
  await page.locator(".sheet h2", { hasText:"Quando lo risenti?" }).waitFor();
  check(await page.locator(".sheet input[name=per][value=followup]").isChecked(), "Piano mostrato: propone il follow-up");
  await page.click(".sheet button[data-act=chiudi]");
  await sync(page);
  check((DB.passi || []).some(x => x.persona_id === "ag1" && x.tipo === "piano") && !DB.persone.find(y => y.id === "ag1").prossima_per,
    "Piano mostrato: un piano nel database e l'agenda libera");
  check(!errori.length, "agenda: nessun errore nella pagina");
  await ctx.close();
}

// 59. La serie (consegna 5): settimana valida con 5 giorni attivi su 7, settimane di fila e record
{
  const lunedi = (() => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; })();
  const g = (sett, i) => { const d = new Date(lunedi); d.setUTCDate(d.getUTCDate() + 7 * sett + i); return d.toISOString().slice(0, 10); };
  const passo = (id, data, tipo) => ({ id, proprietario:"R", persona_id:"ag1", tipo:tipo || "contatto", data, creato_il:data + "T10:00:00Z" });
  DB.passi = (DB.passi || []).filter(x => x.proprietario !== "R").concat(
    /* settimana scorsa: 5 giorni; due settimane fa: 5 giorni (uno con la sola formazione); tre settimane fa: 4 (non vale);
       quattro, cinque e sei settimane fa: 5 giorni (il record è 3) */
    [0, 1, 2, 3, 4].map(i => passo("se1" + i, g(-1, i))),
    [0, 1, 2, 3].map(i => passo("se2" + i, g(-2, i), "piano")),
    [0, 1, 2, 3].map(i => passo("se3" + i, g(-3, i))),
    [-4, -5, -6].flatMap(w => [0, 2, 3, 4, 6].map(i => passo("se" + (-w) + "x" + i, g(w, i)))));
  DB.guidaFatti = [{ partner_id:"R", chiave:"formazione", giorno:g(-2, 5) }];
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  const serie = page.locator(".card.serie");
  await serie.waitFor();
  check((await serie.locator(".serie-titolo").innerText()).trim() === "2 settimane di fila", "serie: 2 settimane valide di fila (" + (await serie.locator(".serie-titolo").innerText()).trim() + ")");
  check((await serie.locator(".serie-record").innerText()).trim() === "record: 3", "serie: il record è la serie più lunga dell'ultimo anno");
  check(await serie.locator(".serie-giorni > span").count() === 7 && await serie.locator(".serie-giorni .adesso").count() === 1, "serie: i 7 cerchi della settimana, con oggi");
  check(await page.evaluate(() => { const b = [...document.querySelectorAll(".serie-giorni b")].map(x => x.getBoundingClientRect().top);
    return Math.max(...b) - Math.min(...b) < 1; }), "serie: i cerchi sono tutti alla stessa altezza, anche oggi");
  check((await serie.innerText()).includes("La serie continua se arrivi a 5 entro domenica"), "serie: dice cosa serve questa settimana");
  const ordine = await page.evaluate(() => [...document.querySelectorAll("#app .card")].map(c => c.classList.contains("cruscotto") ? "cruscotto"
    : c.classList.contains("oggi-lista") ? "oggi" : c.classList.contains("serie") ? "serie" : c.classList.contains("mio-mese") ? "mese" : "").filter(Boolean).join(","));
  check(/cruscotto,(oggi,)?serie,mese/.test(ordine), "serie: sotto la lista di oggi, prima del mio mese (" + ordine + ")");
  await serie.screenshot({ path: S + "/e2e/59-serie.png" });
  await serie.locator("button[data-act=aiuto][data-k=serie]").click();
  check((await serie.innerText()).includes("almeno 5 giorni su 7"), "serie: il «?» spiega la regola");
  check(!errori.length, "serie: nessun errore nella pagina");
  await ctx.close();
  DB.passi = (DB.passi || []).filter(x => x.proprietario !== "R"); DB.guidaFatti = [];
}

// 60. Consegna 6: il perché per tutti, gli avviati («Per iniziare»: perché e mappa; il punto con l'upline tolto il 12 novembre),
//     i nomi nuovi con la fonte
{
  const giorniFa = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const ora = new Date().toISOString();
  // Ada ha un punto con l'upline salvato prima (fissato per oggi, non fatto): i dati restano, l'app non li mostra più
  DB.partners.push({ id:"av6", nome:"Ada Avviata", sponsor_id:"R", stato:"attivo", chiave:"a6".repeat(16), codice_invito:"AV6AV6", codice_amway:"7900001",
    data_iscrizione:giorniFa(60), privacy_accettata_il:ora, conPercorso:true, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, punto_upline:giorniFa(0) });
  // Gea è avviata e ha un gruppo (Ugo, sotto di lei)
  DB.partners.push({ id:"ag6", nome:"Gea Avviata", sponsor_id:"R", stato:"attivo", chiave:"d6".repeat(16), codice_invito:"AG6AG6", codice_amway:"7900004",
    data_iscrizione:giorniFa(120), privacy_accettata_il:ora, conPercorso:true, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, punto_upline:giorniFa(1) });
  DB.partners.push({ id:"ag6u", nome:"Ugo Sotto", sponsor_id:"ag6", stato:"gestito", gestore_id:"ag6", codice_invito:"AG6UUU", codice_amway:"7900005",
    data_iscrizione:giorniFa(400), creato_il:ora });
  DB.partners.push({ id:"nu6", nome:"Nino Nuovo", sponsor_id:"R", stato:"attivo", chiave:"b6".repeat(16), codice_invito:"NU6NU6", codice_amway:"7900002",
    data_iscrizione:giorniFa(5), privacy_accettata_il:ora, conPercorso:true, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora });
  DB.partners.push({ id:"pe6", nome:"Pia Senzaperche", sponsor_id:"R", stato:"attivo", chiave:"c6".repeat(16), codice_invito:"PE6PE6", codice_amway:"7900003",
    data_iscrizione:giorniFa(90), privacy_accettata_il:ora, conPercorso:true, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora });
  DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id !== "pe6").concat([{ partner_id:"pe6", cifra_mese:500, entro:(new Date().getFullYear() + 1) + "-03-01", perche:"" }]);
  // chi è già nell'app con l'obiettivo ma senza perché vede «Da dove parti?» una volta, con i suoi numeri già scritti
  ({ ctx, page } = await apri({}, "#chiave=" + "c6".repeat(16)));
  await page.getByText("Da dove parti?").waitFor();
  check(await page.locator("form[data-form=obiettivo] input[name=entro]").inputValue() === (new Date().getFullYear() + 1) + "-03", "senza perché: «Da dove parti?» con il suo obiettivo già scritto");
  await page.fill("form[data-form=obiettivo] input[name=cifra]", "500");
  await page.fill("form[data-form=obiettivo] textarea[name=perche]", "Per i miei figli");
  await page.click("form[data-form=obiettivo] button.primary");
  await page.getByText("Ciao Pia").waitFor();
  await sync(page);
  check(DB.obiettivi.find(o => o.partner_id === "pe6").perche === "Per i miei figli", "il perché è salvato e si entra in Io");
  await ctx.close();
  // l'avviata senza gruppo: il perché è fatto, quindi niente «Per iniziare»; il punto con l'upline non c'è più da nessuna parte
  ({ ctx, page } = await apri({}, "#chiave=" + "a6".repeat(16)));
  await page.getByText("Ciao Ada").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  check(!(await page.locator(".card.per-iniziare").count()), "avviata senza gruppo: niente «Per iniziare» (resta solo il perché, già fatto)");
  check(!/punto con la tua upline/i.test(await page.locator("#app").innerText()) && !(await page.locator("[data-act=punto-fissa], [data-act=punto-fatto]").count()),
    "avviata senza gruppo: il punto con l'upline non c'è né in «Per iniziare» né in «La prossima cosa» (anche con un giorno salvato per oggi)");
  check(!(await page.locator(".oggi-lista .prossima-titolo", { hasText:"upline" }).count()), "avviata: «La prossima cosa» non è il punto con l'upline");
  check(await page.locator(".cruscotto .tessera.nomi-nuovi").isVisible(), "avviata: nel cruscotto la tessera dei nomi nuovi");
  await page.screenshot({ path: S + "/e2e/60-avviata.png", fullPage:true });
  await sync(page);
  check((p => p.punto_upline === giorniFa(0) && !p.punto_upline_fatto)(DB.partners.find(p => p.id === "av6")), "nel database: il punto con l'upline salvato prima resta com'era");
  // un nome nuovo con la fonte
  await page.click("button[data-act=vista-persone]");
  await page.click("button[data-act=persona-nuova]");
  check(await page.locator(".sheet input[name=fonte]").count() === 3, "avviata: «Come lo conosci?» (Lo conoscevo, Di recente, Dai social)");
  await page.fill(".sheet input[name=nome]", "Nome Dal Vivo");
  await page.check(".sheet input[name=fonte][value=dal_vivo]", { force:true });
  await page.click(".sheet button.primary");
  await page.getByText("Nome Dal Vivo nella tua lista").waitFor();
  await page.click("button[data-act=vista-io]");
  check((await page.locator(".cruscotto .tessera.nomi-nuovi b").innerText()).trim() === "1" && (await page.locator(".cruscotto .fonti-riga").innerText()).includes("1 incontrato di recente"),
    "il cruscotto conta il nome nuovo e la sua fonte");
  await sync(page);
  check(DB.persone.some(x => x.nome === "Nome Dal Vivo" && x.fonte === "dal_vivo"), "nel database la fonte del nome");
  check(!errori.length, "consegna 6: nessun errore nella pagina");
  await ctx.close();
  // l'avviata con un gruppo: «Per iniziare · 1 di 2» con il perché e la mappa, senza il punto con l'upline
  ({ ctx, page } = await apri({}, "#chiave=" + "d6".repeat(16)));
  await page.getByText("Ciao Gea").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  const pi = page.locator(".card.per-iniziare");
  check(await pi.isVisible() && (await pi.locator(".eyebrow").textContent()).trim() === "Per iniziare · 1 di 2", "avviata con gruppo: «Per iniziare · 1 di 2» (perché fatto, mappa da importare)");
  check(await pi.locator("li.fatto", { hasText:"Il mio perché" }).count() === 1 && await pi.locator("li:not(.fatto)", { hasText:"Importa la tua mappa" }).count() === 1
    && await pi.locator("li").count() === 2, "avviata con gruppo: solo il perché e la mappa");
  check(!/punto con la tua upline/i.test(await page.locator("#app").innerText()) && !(await page.locator("[data-act=punto-fissa], [data-act=punto-fatto]").count()),
    "avviata con gruppo: niente punto con l'upline (anche con un giorno passato salvato)");
  check(!errori.length, "avviata con gruppo: nessun errore nella pagina");
  await ctx.close();
  // il nuovo (iscritto da 5 giorni): niente «Per iniziare» né nomi nuovi (avrà il suo percorso); «Come lo conosci?» sì, come per tutti
  ({ ctx, page } = await apri({}, "#chiave=" + "b6".repeat(16)));
  await page.getByText("Ciao Nino").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  check(!(await page.locator(".card.per-iniziare").count()) && !(await page.locator(".tessera.nomi-nuovi").count()), "nuovo: niente «Per iniziare» né nomi nuovi");
  await page.click("button[data-act=vista-persone]");
  await page.click("button[data-act=persona-nuova]");
  check(await page.locator(".sheet input[name=fonte]").count() === 3, "nuovo: anche lui ha «Come lo conosci?»");
  await ctx.close();
  DB.partners = DB.partners.filter(p => !["av6", "nu6", "pe6", "ag6", "ag6u"].includes(p.id));
}

// 61. Consegna 7: il percorso di partenza di un nuovo, fase per fase, fino alla festa
{
  const giorniFa = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10), ora = new Date().toISOString();
  DB.partners.push({ id:"np7", nome:"Nora Partenza", sponsor_id:"R", stato:"attivo", chiave:"d7".repeat(16), codice_invito:"NP7NP7", codice_amway:"7910001",
    data_iscrizione:giorniFa(3), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true });
  DB.seguimi = (DB.seguimi || []).filter(x => x.partner_id !== "np7");
  const entra = async () => { ({ ctx, page } = await apri({}, "#chiave=" + "d7".repeat(16)));
    await page.getByText("Ciao Nora").waitFor(); if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]"); };
  await entra();
  const pc = page.locator(".card.percorso-partenza");
  check(await pc.isVisible() && !(await page.locator(".card.cruscotto:not(.percorso-partenza)").count()) && !(await page.locator(".primi-passi").count()),
    "nuovo: il percorso al posto del cruscotto e dei Primi passi");
  check((await pc.locator(".spread .small").first().innerText()).trim() === "Fase 2 di 5" && (await pc.locator(".fase-titolo").innerText()).trim() === "Partenza con lo sponsor",
    "fase 2: Partenza con lo sponsor");
  check(await pc.locator("ol.fasi li.poi .lucchetto").count() === 3, "le fasi dopo hanno il lucchetto");
  check((await page.locator(".oggi-lista .prossima-titolo").innerText()).trim() === "Fissa l'incontro con il tuo sponsor", "la prossima cosa viene dal percorso");
  await page.screenshot({ path: S + "/e2e/61-percorso.png", fullPage:true });
  await page.click(".oggi-lista button[data-act=incontro-fissa]");
  await page.locator(".sheet h2", { hasText:"Il primo incontro con il tuo sponsor" }).waitFor();
  const domaniG = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.check(`.sheet input[name=quando][value="${domaniG}"]`, { force:true });
  await page.click(".sheet button.primary");
  await page.getByText("Primo incontro con lo sponsor: domani").waitFor();
  const incontro = pc.locator(".percorso-l li", { hasText:"Primo incontro con il tuo sponsor" });
  check(!(await incontro.evaluate(e => e.classList.contains("fatto"))) && (await incontro.innerText()).includes("fissato per domani")
    && await incontro.locator("button[data-act=incontro-fissa]", { hasText:"Cambia" }).count() === 1, "incontro fissato per domani: niente spunta, «fissato per domani» e «Cambia»");
  check((await pc.locator(".percorso-l li", { hasText:"30 nomi" }).innerText()).includes("0 / 30"), "i 30 nomi: il contatore");
  await sync(page); await ctx.close();
  check(DB.partners.find(p => p.id === "np7").incontro_sponsor === domaniG, "nel database il giorno del primo incontro");
  // 30 nomi → fase 3, il primo ordine
  DB.persone = (DB.persone || []).concat(Array.from({ length:30 }, (_, i) => ({ id:"np7n" + i, proprietario:"np7", nome:"Nome Nora " + (i + 1), fase:"lista", esito:null, creato_il:ora })));
  await entra();
  check((await page.locator(".percorso-partenza .fase-titolo").innerText()).trim() === "Il primo ordine" && (await page.locator(".percorso-ordine").innerText()).includes("0 / 50 VP"),
    "fase 3: il primo ordine, 0 su 50 VP");
  check((await page.locator(".percorso-ordine").innerText()).includes("restano 27 giorni"), "fase 3: i giorni che restano dei 30");
  await ctx.close();
  // 063: un ordine scritto non basta, serve la mappa: la mappa con 60 VP → fase 4, i due binari
  DB.activities.push({ id:"np7o", partner_id:"np7", tipo:"ordine", quantita:1, vp:60, data:giorniFa(1), inserito_il:ora, inserito_da:"np7" });
  await entra();
  check((await page.locator(".percorso-partenza .fase-titolo").innerText()).trim() === "Il primo ordine", "063: un ordine scritto a mano non fa il primo ordine");
  check(!(await page.locator(".ordine-attesa").count()), "063: senza bozza confermata niente «in attesa della mappa»");
  await ctx.close();
  // 063: una bozza confermata che la mappa non mostra ancora: «Ordine confermato · in attesa della mappa», con «!», non spuntato
  DB.ordiniMiei = (DB.ordiniMiei || []).concat([{ id:"np7b", proprietario:"np7", stato:"confermato", data:giorniFa(0), vp:60, attivita_id:null, nome:null,
    persona_id:null, ordine_cliente_id:null, creato_il:ora, confermato_il:ora }]);
  await entra();
  check((await page.locator(".percorso-partenza .fase-titolo").innerText()).trim() === "I due binari"
    && (await page.locator(".percorso-partenza .ordine-attesa").innerText()).replace(/\s+/g, " ").trim() === "! Ordine confermato · in attesa della mappa"
    && await page.locator(".percorso-partenza ol.fasi li.con-attesa:not(.fatta)", { hasText:"Ordine" }).count() === 1,
    "063: bozza confermata: «Ordine confermato · in attesa della mappa» con «!», non spuntato; il percorso va avanti ai due binari (13 novembre)");
  await page.locator(".percorso-partenza").screenshot({ path: S + "/e2e/61-in-attesa-mappa.png" });
  await ctx.close();
  // la mappa mostra il primo ordine, sotto i 50 VP: il passo è fatto, con la nota (scelta di Stefano); niente più 30 giorni
  mappa("np7", 30);
  await entra();
  check((await page.locator(".percorso-partenza .fase-titolo").innerText()).trim() === "I due binari"
    && (await page.locator(".percorso-partenza").innerText()).includes("✓ primo ordine · 30 VP, sotto i 50: iscrizione a pagamento"),
    "fase 4: i due binari, con il primo ordine fatto dalla mappa (30 VP, sotto i 50: con la nota)");
  check(await page.locator(".binari .binario:not(.ok)").count() === 2, "fase 4: primo piano e primo cliente ancora da fare");
  await ctx.close();
  // primo piano e primo cliente → la festa, una volta sola
  DB.activities.push({ id:"np7p", partner_id:"np7", tipo:"piano", quantita:1, data:giorniFa(0), inserito_il:ora },
    { id:"np7c", partner_id:"np7", tipo:"cliente", quantita:1, data:giorniFa(0), inserito_il:ora });
  await entra();
  const festa = page.locator(".festa");
  await festa.waitFor();
  check((await festa.locator("h1").innerText()).replace(/\s+/g, " ").trim() === "Si parte, Nora!" && await festa.locator(".festa-l li").count() === 3, "la festa: i tre passi che contano");
  await page.screenshot({ path: S + "/e2e/61-festa.png" });
  check(await festa.locator("button").count() === 1 && (await festa.locator("button").innerText()).trim() === "Vai al cruscotto"
    && (await festa.innerText()).includes("lo togli dal Profilo"), "la festa: un solo pulsante, il Seguimi si toglie dal Profilo");
  check(await festa.locator(".festa-tutta-app").innerText() === "Ora hai tutta l'app.", "84: la festa dice anche «Ora hai tutta l'app.»");
  await festa.locator("button[data-act=festa-fine]").click();
  await festa.waitFor({ state:"detached" });
  await page.getByText("Seguimi attivo").waitFor();
  check(await page.locator(".card.cruscotto:not(.percorso-partenza)").isVisible() && !(await page.locator(".percorso-partenza").count()), "dopo la festa: il cruscotto di tutti");
  check(await page.locator("button[data-act=sez-io][data-sez=guida]").isVisible(), "84: dopo la festa tutta l'app (la linguetta Verifica c'è)");
  await sync(page);
  check(!!DB.partners.find(p => p.id === "np7").partenza_completata_il && DB.seguimi.some(x => x.partner_id === "np7" && x.attivo), "nel database: partenza completata e Seguimi acceso da solo");
  check(!errori.length, "percorso: nessun errore nella pagina");
  await ctx.close();
  await entra();
  check(!(await page.locator(".festa").count()), "la festa si vede una volta sola");
  await ctx.close();
  DB.partners = DB.partners.filter(p => p.id !== "np7"); DB.persone = DB.persone.filter(x => x.proprietario !== "np7");
  DB.activities = DB.activities.filter(a => a.partner_id !== "np7"); DB.numeri = DB.numeri.filter(x => x.partner_id !== "np7");
  DB.ordiniMiei = (DB.ordiniMiei || []).filter(x => x.proprietario !== "np7");
}

// 62. Consegna 8: lo sponsor e i suoi nuovi (in partenza, etichetta Nuovo, filtro, scheda con e senza app)
{
  const giorniFa = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10), ora = new Date().toISOString();
  DB.partners.push({ id:"sp8n", nome:"Sara Nuova", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"e8".repeat(16), codice_invito:"SP8NNN", codice_amway:"7920001",
    data_iscrizione:giorniFa(3), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true });
  DB.partners.push({ id:"sp8a", nome:"Aldo Avviato", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"f8".repeat(16), codice_invito:"SP8AAA", codice_amway:"7920002",
    data_iscrizione:giorniFa(200), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true });
  DB.partners.push({ id:"sp8g", nome:"Gino Mappa", sponsor_id:"R", stato:"gestito", gestore_id:"R", codice_invito:"SP8GGG", codice_amway:"7920003",
    data_iscrizione:giorniFa(6), creato_il:ora, conPercorso:true });
  // Aldo ha un gruppo (Carlo); Silvio è avviato senza gruppo, con un punto con l'upline salvato prima e non fatto
  DB.partners.push({ id:"sp8c", nome:"Carlo Sottoaldo", sponsor_id:"sp8a", stato:"gestito", gestore_id:"sp8a", codice_invito:"SP8CCC", codice_amway:"7920004",
    data_iscrizione:giorniFa(500), creato_il:ora });
  DB.partners.push({ id:"sp8s", nome:"Silvio Senzagruppo", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"g8".repeat(16), codice_invito:"SP8SSS", codice_amway:"7920005",
    data_iscrizione:giorniFa(200), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true, punto_upline:giorniFa(2) });
  mappa("sp8g", 0);   // 063: nella mappa del mese, ancora senza ordine
  DB.obiettivi = (DB.obiettivi || []).filter(o => !["sp8n", "sp8a", "sp8s"].includes(o.partner_id))
    .concat(["sp8n", "sp8a", "sp8s"].map(id => ({ partner_id:id, cifra_mese:300, entro:"2027-06-01", perche:"Segreto suo" })));
  DB.persone = (DB.persone || []).concat(Array.from({ length:12 }, (_, i) => ({ id:"sp8p" + i, proprietario:"sp8n", nome:"Nome Sara " + i, fase:"lista", esito:null, creato_il:ora })));
  DB.partenzaTolti = [];
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-gruppo]");
  const np = page.locator(".card.nuovi-partenza");
  await np.waitFor();
  const riga = n => np.locator(".partenze-l li", { hasText:n });
  check(await riga("Sara Nuova").count() === 1 && await riga("Aldo Avviato").count() === 1 && !(await riga("Gino Mappa").count()),
    "sponsor: i nuovi in partenza, solo chi ha invitato e usa l'app");
  check((await riga("Sara Nuova").innerText()).includes("Fase 2 di 5") && (await riga("Sara Nuova").innerText()).includes("Manca: la data del vostro primo incontro · Lista 12 / 30"),
    "il nuovo: fase 2 di 5 e cosa manca");
  check((await riga("Aldo Avviato").innerText()).includes("Per iniziare 1 di 2") && await riga("Aldo Avviato").locator(".barre-partenza i").count() === 2,
    "l'avviato con gruppo: per iniziare 1 di 2 (perché e mappa)");
  check(!(await riga("Silvio Senzagruppo").count()), "l'avviato senza gruppo con il perché: non è tra i nuovi in partenza (il punto con l'upline non conta più)");
  check(!/punto con la sua upline/i.test(await np.innerText()), "nei nuovi in partenza niente punto con l'upline");
  check(!(await np.innerText()).includes("Segreto suo") && !(await np.innerText()).includes("Nome Sara"), "mai il perché né i nomi della sua Lista");
  await page.screenshot({ path: S + "/e2e/62-sponsor.png", fullPage:true });
  // la × con Annulla, poi di nuovo
  await riga("Aldo Avviato").locator("button[data-act=togli-partenza]").click();
  await page.locator("#toast button[data-act=annulla]").click();
  await riga("Aldo Avviato").waitFor(); check(true, "×: Annulla lo rimette");
  await riga("Aldo Avviato").locator("button[data-act=togli-partenza]").click();
  await page.getByText("non è più tra i nuovi in partenza").waitFor();
  check(!(await riga("Aldo Avviato").count()), "× lo toglie dai nuovi in partenza");
  await sync(page);
  check(DB.partenzaTolti.some(x => x.partner_id === "R" && x.nuovo_id === "sp8a" && x.fase === 1), "nel database: chi è stato tolto e a che punto era");
  // l'etichetta Nuovo e il filtro Nuovi
  const struttura = page.locator(".albero.struttura").first();
  check((await struttura.locator("li", { hasText:"Sara Nuova" }).locator(".pill.nuovo").innerText()).trim() === "Nuovo · 27 gg"
    && (await struttura.locator("li", { hasText:"Gino Mappa" }).locator(".pill.nuovo").innerText()).trim() === "Nuovo · 24 gg"
    && !(await struttura.locator("li", { hasText:"Aldo Avviato" }).locator(".pill.nuovo").count()), "struttura: «Nuovo · N gg» per gli iscritti da meno di 30 giorni");
  await page.click("button[data-act=filtro-gruppo][data-filtro=nuovi]");
  check((await page.locator(".elenco-filtro li").allInnerTexts()).filter(t => /Sara Nuova|Gino Mappa|Aldo Avviato/.test(t)).length === 2, "filtro Nuovi: gli iscritti da meno di 30 giorni");
  await page.click("button[data-act=filtro-gruppo][data-filtro=tutti]");
  // la scheda del nuovo con l'app: il percorso
  await np.locator("button[data-act=apri-scheda][data-id=sp8n]").click();
  const ps = page.locator(".card.partenza-scheda");
  await ps.waitFor();
  check((await ps.locator(".eyebrow").innerText()).toLowerCase().includes("fase 2 di 5") && await ps.locator(".percorso-scheda li").count() === 5
    && await ps.locator(".percorso-scheda li.fatto", { hasText:"Il suo perché" }).count() === 1, "scheda del nuovo: il percorso, fase per fase");
  await page.screenshot({ path: S + "/e2e/62-scheda-nuovo.png", fullPage:true });
  // la scheda del nuovo senza app: il primo ordine dalla mappa e l'invito
  await page.click("button[data-act=vista-gruppo]");
  await page.locator(".albero.struttura li", { hasText:"Gino Mappa" }).locator("button[data-act=apri-scheda]").click();
  await ps.waitFor();
  check((await ps.innerText()).includes("0 / 50 VP") && (await ps.innerText()).includes("restano 24 giorni") && await ps.locator("button[data-act=invita]").isVisible(),
    "scheda senza app: il primo ordine e «Invitalo in Growup»");
  check(!errori.length, "sponsor: nessun errore nella pagina");
  await ctx.close();
  // l'avviato tolto torna se va avanti: importa la sua mappa, e ha finito «Per iniziare»
  mappa("sp8c", 0, null, { visto_da:"sp8a" });
  DB.partners.find(p => p.id === "sp8n").incontro_sponsor = giorniFa(-1);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-gruppo]");
  check(!(await page.locator(".nuovi-partenza li", { hasText:"Aldo Avviato" }).count()), "l'avviato che ha finito «Per iniziare» non c'è più");
  check((await page.locator(".nuovi-partenza li", { hasText:"Sara Nuova" }).innerText()).includes("Manca: Lista 12 / 30"), "incontro fissato: manca solo la Lista");
  await ctx.close();
  // 063: la mappa mostra il primo ordine di Sara (30 VP, sotto i 50): «ordine ✓», niente più giorni; nella scheda la nota
  mappa("sp8n", 30);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-gruppo]");
  check((await page.locator(".albero.struttura").first().locator("li", { hasText:"Sara Nuova" }).locator(".pill.nuovo").innerText()).trim() === "Nuovo · ordine ✓",
    "063: struttura: il primo ordine dalla mappa (anche sotto i 50) → «Nuovo · ordine ✓»");
  await page.locator(".card.nuovi-partenza button[data-act=apri-scheda][data-id=sp8n]").click();
  await page.locator(".card.partenza-scheda").waitFor();
  check((await page.locator(".percorso-scheda li", { hasText:"Il primo ordine" }).innerText()).includes("fatto · 30 VP, sotto i 50: iscrizione a pagamento")
    && await page.locator(".percorso-scheda li.fatto", { hasText:"Il primo ordine" }).count() === 1, "063: scheda del nuovo: il primo ordine fatto, con la nota");
  await ctx.close();
  DB.numeri = DB.numeri.filter(x => !["sp8n", "sp8g", "sp8c"].includes(x.partner_id));
  DB.partners = DB.partners.filter(p => !["sp8n", "sp8a", "sp8g", "sp8c", "sp8s"].includes(p.id)); DB.persone = DB.persone.filter(x => x.proprietario !== "sp8n");
}

// 63. Consegna 9: i traguardi grandi a tutto schermo (il primo cliente e la nuova tappa, dall'app)
{
  DB.traguardiAperti = true;
  const ora = new Date().toISOString();
  DB.partners.push({ id:"tr9", nome:"Tea Traguardo", sponsor_id:"R", stato:"attivo", chiave:"a9".repeat(16), codice_invito:"TR9TR9", codice_amway:"7930001",
    data_iscrizione:new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora });
  ({ ctx, page } = await apri({}, "#chiave=" + "a9".repeat(16)));
  await page.getByText("Ciao Tea").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]");
  await page.click("button[data-sez=clienti]");
  await page.click("button[data-act=cliente-nuovo]");
  await page.fill(".sheet input[name=nome]", "Lucia Cliente");
  await page.click(".sheet button.primary");
  const tr = page.locator(".festa.traguardo");
  await tr.waitFor();
  check((await tr.locator("h1").innerText()).replace(/\s+/g, " ").trim() === "Il tuo primo cliente!" && (await tr.innerText()).includes("Lucia Cliente")
    && await tr.locator("button").count() === 1, "il primo cliente: a tutto schermo, con il nome e un solo pulsante");
  await page.screenshot({ path: S + "/e2e/63-primo-cliente.png" });
  await tr.locator("button[data-act=traguardo-chiudi]").click();
  await tr.waitFor({ state:"detached" }); check(true, "Continua chiude il traguardo");
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "a9".repeat(16)));
  await page.getByText("Ciao Tea").waitFor();
  await page.waitForTimeout(400);
  check(!(await page.locator(".festa.traguardo").count()), "il traguardo si vede una volta sola");
  // la tappa raggiunta: la mappa con il primo ordine da 60 VP chiude «Primo ordine», a tutto schermo con la prossima (Primi clienti)
  const tr2 = page.locator(".festa.traguardo");
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await mappaIn(page, "tr9", 60);
  await tr2.waitFor();
  check((await tr2.locator("h1").innerText()).trim() === "Primo ordine" && (await tr2.innerText()).includes("Il tuo percorso va avanti, Tea")
    && (await tr2.locator(".eyebrow").first().textContent()).trim().startsWith("Tappa raggiunta") && (await tr2.innerText()).includes("Primi clienti"),
    "la tappa raggiunta a tutto schermo, con la prossima");
  await page.screenshot({ path: S + "/e2e/63-tappa.png" });
  await tr2.locator("button").click();
  await tr2.waitFor({ state:"detached" });
  check(!errori.length, "traguardi: nessun errore nella pagina");
  await ctx.close();
  DB.partners = DB.partners.filter(p => p.id !== "tr9"); DB.persone = (DB.persone || []).filter(x => x.proprietario !== "tr9");
  DB.numeri = (DB.numeri || []).filter(x => x.partner_id !== "tr9");
  DB.traguardiAperti = false;
}

// 64. «Da riprendere» (061): il contatto avviato fermo da 14 giorni, «Ricordamelo tra 30 giorni», «Chiudi contatto»
{
  DB.partners.push({ id:"dr61", nome:"Riprendi Prova", sponsor_id:"R", stato:"attivo", chiave:"d6".repeat(16), codice_invito:"DR61DR",
    confermato_il:new Date().toISOString(), privacy_accettata_il:"2026-10-01T00:00:00Z", partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
  const giorniFa = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10), piu = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const vecchio = new Date(Date.now() - 60 * 86400000).toISOString();
  DB.persone.push({ id:"dr1", proprietario:"dr61", nome:"Fermo Sedici", fase:"invitato", esito:null, creato_il:vecchio },
    { id:"dr2", proprietario:"dr61", nome:"Fresco Cinque", fase:"contattato", esito:null, creato_il:vecchio },
    { id:"dr3", proprietario:"dr61", nome:"Mai Contattato", fase:"lista", esito:null, creato_il:vecchio },
    { id:"dr4", proprietario:"dr61", nome:"Fermo Con Agenda", fase:"piano", esito:null, creato_il:vecchio, prossima_data:piu(3), prossima_per:"followup" },
    { id:"dr5", proprietario:"dr61", nome:"Chiuso Da Risentire", fase:"contattato", esito:"senza_risposta", creato_il:vecchio, prossima_data:giorniFa(0), prossima_per:"contatto" });
  DB.passi = (DB.passi || []).concat([
    { id:"drp1", proprietario:"dr61", persona_id:"dr1", tipo:"contatto", data:giorniFa(25), creato_il:vecchio },
    { id:"drp2", proprietario:"dr61", persona_id:"dr1", tipo:"invito", data:giorniFa(16), creato_il:vecchio },
    { id:"drp3", proprietario:"dr61", persona_id:"dr2", tipo:"contatto", data:giorniFa(5), creato_il:vecchio },
    { id:"drp4", proprietario:"dr61", persona_id:"dr4", tipo:"piano", data:giorniFa(30), creato_il:vecchio },
    { id:"drp5", proprietario:"dr61", persona_id:"dr5", tipo:"contatto", data:giorniFa(200), creato_il:vecchio },
    { id:"drp6", proprietario:"dr61", persona_id:"dr5", tipo:"chiusura", esito:"senza_risposta", data:giorniFa(183), creato_il:vecchio }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "d6".repeat(16)));
  await page.getByText("Ciao Riprendi").waitFor(); await apriTappa(page);
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]");
  const riga = nome => page.locator(".persone li", { has:page.locator("button[data-act=apri-persona]", { hasText:nome }) });
  check(await riga("Fermo Sedici").evaluate(e => e.classList.contains("fermo")) && (await riga("Fermo Sedici").innerText()).includes("fermo da 16 giorni"),
    "Lista: il contatto avviato senza passi da 16 giorni ha la riga ambra, «fermo da 16 giorni»");
  check(!await riga("Fresco Cinque").evaluate(e => e.classList.contains("fermo")) && !await riga("Mai Contattato").evaluate(e => e.classList.contains("fermo"))
    && !await riga("Fermo Con Agenda").evaluate(e => e.classList.contains("fermo")),
    "Lista: non sono fermi chi ha un passo recente, chi non è mai stato contattato e chi ha una data in agenda");
  await page.click("button[data-filtro=riprendere]");
  const nomi = async () => (await page.locator(".persone button[data-act=apri-persona] b").allInnerTexts()).map(t => t.trim()).sort().join();
  check(await nomi() === "Chiuso Da Risentire,Fermo Sedici", "Da riprendere: i fermi e i chiusi senza risposta con il promemoria arrivato");
  check((await riga("Chiuso Da Risentire").innerText()).includes("Chiuso senza risposta"), "Da riprendere: il chiuso senza risposta lo dice");
  await page.screenshot({ path: S + "/e2e/64-da-riprendere.png" });
  // la scheda del contatto fermo: il riquadro ambra e «Ricordamelo tra 30 giorni»
  await page.click("button[data-act=apri-persona]:has-text('Fermo Sedici')");
  const box = page.locator(".fermo-box");
  check((await box.innerText()).replace(/\s+/g, " ").includes("Nessun passo da 16 giorni. L'ultimo è «Invito» del"),
    "scheda: il riquadro dice da quanti giorni è fermo e qual è l'ultimo passo");
  await page.screenshot({ path: S + "/e2e/64-scheda-ferma.png" });
  await box.locator("button[data-act=ricordamelo]").click();
  await page.getByText("è in agenda").waitFor();
  await sync(page);
  check(DB.persone.find(x => x.id === "dr1").prossima_data === piu(30) && DB.persone.find(x => x.id === "dr1").prossima_per === "piano",
    "Ricordamelo: in agenda tra 30 giorni, per il passo che viene dopo");
  check(!await page.locator(".fermo-box").count() && await page.locator(".prossima .agenda-testo").isVisible(), "Ricordamelo: niente più riquadro ambra, la data è in agenda");
  await page.click("button[data-act=torna-lista]");
  check(await nomi() === "Chiuso Da Risentire", "Ricordamelo: esce da «Da riprendere» fino a quel giorno");
  // chiudi contatto: senza risposta, con il promemoria tra 6 mesi
  await page.click("button[data-filtro=tutti]");
  DB.persone.find(x => x.id === "dr2").prossima_data = null;
  DB.passi.find(x => x.id === "drp3").data = giorniFa(20);
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "d6".repeat(16)));
  await page.getByText("Ciao Riprendi").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=apri-dopo]");
  check((await page.locator("#app").innerText()).includes("fermo da 20 giorni") && await page.locator(".persone li.fermo").count() >= 1, "su Io anche il contatto fermo è in ambra");
  await page.click("button[data-act=vista-persone]");
  await page.click("button[data-act=apri-persona]:has-text('Fresco Cinque')");
  await page.click(".fermo-box button[data-act=chiudi-contatto]");
  await page.locator(".sheet h2", { hasText:"Chiudi il contatto con Fresco" }).waitFor();
  check(await page.locator(".sheet input[name=ricorda][value=si]").isChecked() && (await page.locator(".sheet").innerText()).includes("non è un «No»"),
    "Chiudi contatto: spiega che non è un No, e propone il promemoria tra 6 mesi");
  await page.screenshot({ path: S + "/e2e/64-chiudi.png" });
  await page.click(".sheet button:has-text('Chiudi contatto')");
  await page.getByText("Chiuso senza risposta: te lo ricordo il").waitFor();
  await sync(page);
  const sei = (() => { const d = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 6); return d.toISOString().slice(0, 10); })();
  const fr = DB.persone.find(x => x.id === "dr2");
  check(fr.esito === "senza_risposta" && fr.prossima_data === sei && fr.prossima_per === "contatto"
    && DB.passi.some(x => x.persona_id === "dr2" && x.tipo === "chiusura" && x.esito === "senza_risposta"), "Chiudi contatto: esito «senza risposta» e promemoria in agenda tra 6 mesi");
  check(await page.locator(".card .pill", { hasText:"Chiuso senza risposta" }).isVisible() && await page.locator(".card", { hasText:"I passi" }).getByText("Chiusura · Chiuso senza risposta").isVisible(),
    "la scheda dice «Chiuso senza risposta», anche tra i passi");
  await page.click("button[data-act=torna-lista]");
  await page.click("button[data-filtro=chiusi]");
  check((await nomi()).includes("Fresco Cinque"), "il chiuso senza risposta è tra i Chiusi");
  // anche dalla chiusura normale, senza promemoria
  await page.click("button[data-filtro=tutti]");
  await page.click("button[data-act=apri-persona]:has-text('Fermo Con Agenda')");
  await page.click("button[data-act=passo]"); await page.click(".sheet button[data-tipo=chiusura]");
  await page.click(".sheet label.chip:has-text('Chiuso senza risposta')");
  check(await page.locator(".sheet [data-per-esito=senza_risposta]").isVisible(), "chiusura normale: con «Chiuso senza risposta» la domanda dei 6 mesi");
  await page.click(".sheet [data-per-esito=senza_risposta] label.chip:has-text('Non serve')");
  await page.click(".sheet button:has-text('Salva')");
  await page.getByText("Chiusura · Chiuso senza risposta segnato").waitFor();
  await sync(page);
  check(DB.persone.find(x => x.id === "dr4").esito === "senza_risposta" && !DB.persone.find(x => x.id === "dr4").prossima_data, "chiusura senza promemoria: nessuna data in agenda");
  await page.setViewportSize({ width:360, height:780 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= 360), "a 360 px niente scorrimento laterale");
  check(!errori.length, "Da riprendere: nessun errore nella pagina");
  await ctx.close();
  DB.partners = DB.partners.filter(p => p.id !== "dr61"); DB.persone = DB.persone.filter(x => x.proprietario !== "dr61");
  DB.passi = DB.passi.filter(x => x.proprietario !== "dr61");
}

// 65. Leggibilità (grafica 7, punto 1): i testi grigi, l'ambra e il verde almeno 4,5:1 nei due temi, su tutti i fondi
{
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  const misura = async tema => page.evaluate(t => {
    const r = document.documentElement; if(t) r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
    const v = n => getComputedStyle(r).getPropertyValue(n).trim();
    const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const testi = t === "dark" ? ["--ink2", "--ink3"] : ["--ink2", "--ink3", "--giallo", "--verde"], fondi = ["--bg", "--card", "--traccia", "--accent-wash"];
    const out = [];
    for(const a of testi) for(const b of fondi) out.push([a, b, Math.round(cr(v(a), v(b)) * 100) / 100]);
    r.removeAttribute("data-theme"); return out; }, tema);
  for(const tema of [null, "dark"]){
    const m = await misura(tema), sotto = m.filter(x => x[2] < 4.5);
    check(!sotto.length, `tema ${tema ? "scuro" : "chiaro"}: testi grigi, ambra e verde almeno 4,5:1 su tutti i fondi${sotto.length ? " (" + sotto.map(x => x.join(" ")).join("; ") + ")" : ""}`);
  }
  await ctx.close();
}

// 66. Leggibilità (grafica 7, punto 2): a 360 px nessun pulsante, filtro o etichetta va a capo, in tutte le pagine
{
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  /* un pulsante (o un'etichetta) va a capo se il suo testo sta su più righe; i pulsanti fatti di più righe di proposito
     (nome + numeri sotto) hanno un <br> o un figlio a blocco e non contano */
  const aCapo = async dove => page.evaluate(dove => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    const out = [];
    for(const e of document.querySelectorAll("#app button, #app .btn, #app .pill, .barra button, nav button")){
      if(!vis(e) || e.closest(".sheet") || e.querySelector("br, .small, small, b + span, span.grow, div")) continue;
      if([...e.children].some(c => ["block", "flex", "grid"].includes(getComputedStyle(c).display))) continue;
      const rg = document.createRange(); rg.selectNodeContents(e);
      /* le righe del testo: un pezzo che inizia sotto la fine del precedente è una riga nuova */
      const rr = [...rg.getClientRects()].filter(r => r.width > 1).sort((x, y) => x.top - y.top);
      let righe = rr.length ? 1 : 0, fondo = rr.length ? rr[0].bottom : 0;
      for(const r of rr){ if(r.top >= fondo - 2){ righe++; fondo = r.bottom; } else fondo = Math.max(fondo, r.bottom); }
      if(righe > 1) out.push(dove + ": «" + e.textContent.replace(/\s+/g, " ").trim().slice(0, 40) + "»");
    }
    if(document.documentElement.scrollWidth > 360) out.push(dove + ": la pagina scorre di lato");
    /* il nome nelle righe della struttura e degli inviti non si stringe sotto i 100 px */
    for(const n of document.querySelectorAll("#app .albero li .nome, #app .oggi.inviti li>.grow"))
      if(vis(n) && n.getBoundingClientRect().width < 100) out.push(dove + ": nome stretto «" + n.textContent.replace(/\s+/g, " ").trim().slice(0, 30) + "»");
    return out; }, dove);
  const trovati = [];
  const giro = async (dove, fai) => { await fai(); await page.waitForTimeout(150); const t = await aCapo(dove); trovati.push(...t);
    if(t.length || /^(Gruppo|Persone · Target|Io · il mio giorno)$/.test(dove)) await page.screenshot({ path: S + "/e2e/66-" + dove.replace(/[^a-z]+/gi, "-") + ".png", fullPage:true }); };
  await giro("Io · il mio giorno", async () => {});
  { const xs = await page.locator("#app button.x").evaluateAll(l => l.map(b => { const c = getComputedStyle(b); return c.borderRadius + " " + c.width; }));
    check(!xs.length || xs.every(x => x === "50% 38px"), "le × sono tutte rotonde e uguali (" + [...new Set(xs)].join(", ") + ")"); }
  await giro("Io · Verifica", async () => page.click(".sezioni-io button[data-sez=guida]"));
  await giro("Obiettivo", async () => page.click("button[data-act=vista-obiettivo]"));
  await giro("Persone · Lista", async () => { await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]"); });
  if(await page.locator("button[data-act=apri-persona]").count())
    await giro("Persone · scheda", async () => page.locator("button[data-act=apri-persona]").first().click());
  await giro("Persone · Clienti", async () => { if(await page.locator("button[data-act=torna-lista]").count()) await page.click("button[data-act=torna-lista]");
    await page.click("button[data-sez=clienti]"); });
  if(await page.locator("button[data-act=apri-cliente]").count())
    await giro("Clienti · scheda", async () => page.locator("button[data-act=apri-cliente]").first().click());
  await giro("Persone · Target", async () => { if(await page.locator("button[data-act=torna-clienti]").count()) await page.click("button[data-act=torna-clienti]");
    await page.click("button[data-sez=target]"); });
  await giro("Gruppo", async () => page.locator("button[data-act=vista-gruppo]").first().click());
  if(await page.locator("button[data-act=apri-scheda]").count())
    await giro("Gruppo · scheda", async () => page.locator("button[data-act=apri-scheda]").first().click());
  await giro("Profilo", async () => page.click("button[data-act=vista-profilo]"));
  console.log("A CAPO A 360 PX:\n" + [...new Set(trovati)].join("\n"));
  check(!trovati.length, "a 360 px niente va a capo (" + [...new Set(trovati)].length + ")");
  await ctx.close();
}

// 67. I campi non si svuotano più quando l'app ridisegna lo schermo (tornando sull'app, o cambiando una scelta nel foglio)
{
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.click("button[data-act=persona-nuova]");
  await page.fill(".sheet input[name=nome]", "Prova Campo");
  await page.fill(".sheet input[name=contatto]", "333 1234567");
  await page.focus(".sheet input[name=contatto]");
  /* si va su WhatsApp e si torna: l'app ricarica i dati e ridisegna */
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(1200);
  check(await page.inputValue(".sheet input[name=nome]") === "Prova Campo" && await page.inputValue(".sheet input[name=contatto]") === "333 1234567",
    "tornando sull'app quello che si stava scrivendo resta");
  check(await page.evaluate(() => document.activeElement && document.activeElement.name) === "contatto", "e il cursore resta nel campo dove si scriveva");
  await page.click(".sheet [data-act=chiudi]");
  /* nel foglio del passo: scritta la nota, cambiando il tipo di passo il foglio si ridisegna e la nota resta */
  await page.locator("button[data-act=apri-persona]").first().click();
  await page.click("button[data-act=passo]");
  await page.fill(".sheet input[name=nota]", "nota che resta");
  const tipi = await page.locator(".sheet button[data-act=tipo-passo]:not(.on)").evaluateAll(l => l.map(b => b.dataset.tipo).filter(t => t !== "nota"));
  await page.click(`.sheet button[data-act=tipo-passo][data-tipo=${tipi[0]}]`);
  await page.locator(`.sheet button[data-act=tipo-passo][data-tipo=${tipi[0]}].on`).waitFor();
  check(await page.inputValue(".sheet input[name=nota]") === "nota che resta", "cambiando il tipo di passo la nota scritta resta");
  await page.click(".sheet [data-act=chiudi]");
  /* riaprendo il foglio, invece, è vuoto: si riparte da capo */
  await page.click("button[data-act=passo]");
  check(await page.inputValue(".sheet input[name=nota]") === "", "riaprendo il foglio i campi ripartono vuoti");
  check(!errori.length, "campi: nessun errore nella pagina");
  await ctx.close();
}

// 68. La versione di prova (prova/): l'app vera con dati inventati, senza database; l'app vera sullo stesso telefono resta intatta
{
  const c = await browser.newContext({ viewport:{ width:390, height:844 }, locale:"it-IT", timezoneId:"Europe/Rome", reducedMotion:"reduce" });
  const pg = await c.newPage();
  const fuori = [], err = [];
  pg.on("request", r => { if(!r.url().startsWith("http://127.0.0.1:8765/")) fuori.push(r.url()); });
  pg.on("pageerror", e => err.push(String(e))); pg.on("console", m => { if(m.type() === "error") err.push(m.text()); });
  pg.on("dialog", d => d.accept());
  await pg.addLocatorHandler(pg.locator(".festa.traguardo"), async t => { await t.locator("button[data-act=traguardo-chiudi]").click(); });
  /* sullo stesso telefono c'è l'app vera: il suo link personale, la sua sessione */
  await pg.goto(BASE + "favicon-32.png");
  await pg.evaluate(() => { localStorage.setItem("growup-team.chiave", "f".repeat(32)); localStorage.setItem("growup-team.chiave-salvata", "1");
    localStorage.setItem("mock.session", JSON.stringify({ user:{ id:"telefono-vero" } })); });
  const tutte = () => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  const prima = await tutte();
  await pg.goto(BASE + "prova/");
  await pg.locator(".prova-scelta").waitFor();
  check(await pg.locator(".prova-scelta button.chi[data-prova=come]").count() === 2 && (await pg.locator(".prova-scelta").innerText()).includes("Dati inventati"),
    "prova: si sceglie chi essere (due persone), con l'avviso dei dati inventati");
  const sceltaT = (await pg.locator(".prova-scelta").innerText()).replace(/\s+/g, " ");
  check(sceltaT.includes("Sono appena entrato Il primo ingresso di un nuovo partner e il percorso di partenza, fase per fase, fino alla festa.")
    && sceltaT.includes("Sono in attività da tempo Il primo ingresso di chi è già in attività, l'import della mappa e dei clienti, poi l'app dopo due mesi.")
    && /Luca Bassi/i.test(sceltaT) && /Giulia Martini/i.test(sceltaT) && !/Sara Conti|Stefano e Alessia/i.test(sceltaT),
    "prova: «Sono appena entrato» → Luca, «Sono in attività da tempo» → Giulia; né Sara né Stefano e Alessia");
  check(await pg.locator(".prova-scelta button.chi[data-prova=mappa]").count() === 1 && await pg.locator(".prova-scelta button.chi[data-prova=clienti]").count() === 1
    && await pg.locator(".prova-scelta button.chi").count() === 4 && !/ordini dei clienti|Stefano e Alessia ·/i.test(sceltaT)
    && await pg.locator(".prova-scelta [data-prova=ricomincia]").count() === 1,
    "prova: solo due file (la mappa e i clienti di Giulia), niente file degli ordini né di Stefano e Alessia; «Ricomincia da capo» c'è");
  await pg.screenshot({ path: S + "/e2e/68-prova-scelta.png", fullPage:true });
  /* l'anteprima a 360 px, in chiaro e in scuro */
  for(const tema of ["light", "dark"]){
    const c2 = await browser.newContext({ viewport:{ width:360, height:780 }, locale:"it-IT", timezoneId:"Europe/Rome", reducedMotion:"reduce", colorScheme:tema, deviceScaleFactor:2 });
    const p2 = await c2.newPage(); await p2.goto(BASE + "prova/"); await p2.locator(".prova-scelta").waitFor();
    check(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `prova (${tema}), pagina di scelta a 360 px: niente scroll orizzontale`);
    await p2.screenshot({ path: S + `/e2e/68-prova-scelta-${tema}.png`, fullPage:true });
    await c2.close();
  }
  /* Luca entra con l'invito di Giulia (il percorso intero è nella sezione 94) */
  await pg.click("[data-prova=come][data-k=luca]");
  await pg.getByText("ti diamo il benvenuto in Growup").waitFor();
  check(await pg.locator(".prova-barra", { hasText:"Versione di prova · dati inventati" }).isVisible(), "prova: la barra «Versione di prova» in cima");
  check((await pg.locator(".chi-invita").innerText()).replace(/\s+/g, " ").includes("Ti ha invitato Giulia Martini"), "prova: Luca riceve l'invito di Giulia");
  check(!(await pg.locator(".prova-barra [data-prova=due-mesi]").count()), "prova: «Due mesi dopo» non c'è per Luca");
  await pg.fill("input[name=data]", new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10));
  await pg.check("input[name=privacy]");
  await pg.click("form button.primary");
  await perche(pg);
  await pg.locator(".card.percorso-partenza").waitFor();
  check(true, "prova: Luca entra e inizia il percorso di partenza");
  /* rientrando come Luca si torna nel suo profilo (l'invito non si rifà) */
  await pg.click("[data-prova=scegli]"); await pg.locator(".prova-scelta").waitFor();
  await pg.click("[data-prova=come][data-k=luca]");
  await pg.getByText("Ciao Luca").waitFor(); check(true, "prova: rientrando come Luca si torna nel suo profilo");
  /* i due file del sito Amway: la mappa di Giulia e i suoi clienti */
  await pg.click("[data-prova=scegli]"); await pg.locator(".prova-scelta").waitFor();
  const scaricaP = async (sel, nome) => { const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click(sel)]);
    const f = S + "/e2e/" + nome; await dl.saveAs(f); return f; };
  const mappaG = await scaricaP("[data-prova=mappa]", "prova-mappa-giulia.csv");
  const cliG = await scaricaP("[data-prova=clienti]", "prova-clienti.csv");
  /* Giulia, in attività da due anni: il primo ingresso con l'invito di Stefano e Alessia */
  await pg.click("[data-prova=come][data-k=giulia]");
  await pg.getByText("ti diamo il benvenuto in Growup").waitFor();
  check((await pg.locator(".chi-invita").innerText()).replace(/\s+/g, " ").includes("Stefano e Alessia"), "prova Giulia: l'invito di Stefano e Alessia");
  check(await pg.locator(".prova-barra [data-prova=due-mesi]").isVisible() && !(await pg.locator(".prova-barra [data-prova=arriva]").count()),
    "prova Giulia: nella barra «Due mesi dopo» (solo per Giulia), anche prima di entrare");
  check(await pg.locator("form[data-form=ingresso] .field", { hasText:"La tua qualifica attuale" }).count() === 1, "prova Giulia: «La tua qualifica attuale»");
  await pg.selectOption("select[name=qualifica]", { label:"21%" });
  const dueAnni = new Date(); dueAnni.setFullYear(dueAnni.getFullYear() - 2); dueAnni.setDate(dueAnni.getDate() - 20);
  await pg.fill("input[name=data]", dueAnni.toISOString().slice(0, 10));
  await pg.check("input[name=privacy]");
  await pg.click("form button.primary");
  await perche(pg);
  await pg.locator(".card.per-iniziare").waitFor();
  const pi = (await pg.locator(".card.per-iniziare").innerText()).replace(/\s+/g, " ");
  check(pi.includes("Importa la tua mappa") && /Per iniziare · 1 di 2/i.test(pi), "prova Giulia: «Per iniziare» con «Importa la tua mappa» (" + pi.slice(0, 60) + ")");
  check(await pg.locator(".domanda-condividi").isVisible() && !(await pg.locator(".card.percorso-partenza").count()), "prova Giulia: avviata, la domanda sulla condivisione, niente percorso");
  check(await pg.locator("button[data-act=sez-io][data-sez=guida]").isVisible(), "prova Giulia: l'app completa (la Verifica c'è)");
  const dg = await pg.evaluate(() => { const d = window.__DB; return { seg:d.seguimi.find(x => x.partner_id === "G"), persone:d.persone.filter(x => x.proprietario === "G").length,
    q:d.partners.find(p => p.id === "G").percentuale_iniziale }; });
  check(dg.seg && dg.seg.attivo && !dg.seg.condividi && dg.persone === 0 && dg.q === 21, "prova Giulia: Seguimi acceso da solo, Lista vuota, qualifica 21%");
  /* l'anteprima a 360 px: Io con «Per iniziare», in chiaro e in scuro */
  await pg.waitForFunction(() => !document.querySelector(".toast"), null, { timeout:8000 }).catch(() => {});
  await pg.setViewportSize({ width:360, height:Math.min(4000, await pg.evaluate(() => document.documentElement.scrollHeight)) });
  for(const tema of ["light", "dark"]){ await pg.emulateMedia({ colorScheme:tema }); await pg.waitForTimeout(150);
    check(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `prova Giulia (${tema}), primo ingresso a 360 px: niente scroll orizzontale`);
    await pg.screenshot({ path: S + `/e2e/68-giulia-primo-ingresso-${tema}.png` }); }
  await pg.emulateMedia({ colorScheme:"light" }); await pg.setViewportSize({ width:390, height:844 });
  /* la Lista vuota, come per chiunque entri */
  await pg.click("button[data-act=vista-persone]"); await pg.click("button[data-sez=lista]");
  check(await pg.getByText("La tua lista è vuota").isVisible(), "prova Giulia: la Lista è vuota");
  /* il Gruppo: le persone dalla mappa del mese scorso di Stefano e Alessia, senza i VP di questo mese; Luca tra i nuovi */
  await pg.locator("button[data-act=vista-gruppo]").first().click();
  const gr = async () => (await pg.locator("#app").innerText()).replace(/\s+/g, " ");
  check((await gr()).includes("Marco Ferri") && !(await gr()).includes("Lia Conte") && await pg.locator(".nuovi-partenza", { hasText:"Luca Bassi" }).isVisible(),
    "prova Giulia: il Gruppo ha già le sue persone (senza i due nuovi) e Luca tra i nuovi in partenza");
  check(await pg.evaluate(() => { const d = window.__DB, m = new Date().toISOString().slice(0, 7);
      return !d.numeri.some(n => n.mese === m && ["G", "p-mf", "p-pg"].includes(n.partner_id)); }), "prova Giulia: prima dell'import, nessun VP di questo mese per il suo gruppo");
  /* l'import della mappa da «Per iniziare» */
  await pg.click("button[data-act=vista-io]");
  await pg.locator(".card.per-iniziare input.file-amway").setInputFiles(mappaG);
  await pg.locator(".sheet h2", { hasText:"importata" }).waitFor();
  check((await pg.locator(".sheet").innerText()).includes("Nuove nella tua struttura · 2"), "prova Giulia: la mappa si importa da «Per iniziare», con due iscritti nuovi");
  await pg.locator(".sheet [data-act=chiudi]").first().click();
  check(!(await pg.locator(".card.per-iniziare").count()), "prova Giulia: dopo l'import «Per iniziare» sparisce");
  await pg.locator("button[data-act=vista-gruppo]").first().click();
  check((await gr()).includes("Lia Conte") && (await gr()).includes("Elio Fanti"), "prova Giulia: il Gruppo si riempie, con i due iscritti nuovi");
  check(await pg.evaluate(() => { const d = window.__DB, l = d.partners.find(p => p.codice_amway === d._prova.codiceLuca); return !!l.confermato_il; }),
    "prova Giulia: con la sua mappa anche Luca è al suo posto (non più in attesa)");
  /* l'import dei clienti */
  await pg.click("button[data-act=vista-persone]"); await pg.click("button[data-sez=clienti]");
  await pg.locator("input.file-amway").first().setInputFiles([cliG]);
  await pg.locator(".sheet form[data-form=importa-ordini]").waitFor();
  check((await pg.locator(".sheet").innerText()).includes("8 clienti nei file"), "prova Giulia: i clienti si leggono (senza il file degli ordini)");
  await pg.click(".sheet button:has-text('Importa')");
  await pg.getByText("6 nuovi clienti, 2 in Lista (mai comprato)").waitFor();
  check(await pg.locator(".persone button[data-act=apri-cliente]").count() === 6, "prova Giulia: dopo l'import compaiono i 6 clienti");
  /* «Due mesi dopo»: Luca resta com'è, Giulia lo vede tra i nuovi con la sua fase */
  await pg.click(".prova-barra [data-prova=due-mesi]");
  await pg.getByText("Ciao Giulia").waitFor();
  check(!(await pg.locator(".prova-barra [data-prova=due-mesi]").count()), "prova Giulia: dopo «Due mesi dopo» il pulsante non c'è più");
  await pg.locator("button[data-act=vista-gruppo]").first().click();
  const lucaRiga = pg.locator(".nuovi-partenza .partenze-l li", { hasText:"Luca Bassi" });
  check((await lucaRiga.innerText()).includes("Fase 2 di 5"), "prova Giulia, due mesi dopo: Luca tra i nuovi in partenza, con la sua fase (fase 2)");
  /* l'app vera non si tocca: le sue chiavi restano uguali, le altre sono tutte «prova.» */
  const dopo = await tutte();
  check(Object.entries(prima).every(([k, v]) => dopo[k] === v) && Object.keys(dopo).every(k => k in prima || k.startsWith("prova.")),
    "prova: il link personale e la sessione dell'app vera restano intatti; la prova scrive solo chiavi «prova.»");
  check(!fuori.length, "prova: nessuna richiesta fuori dal sito, niente database (" + fuori.slice(0, 3).join(", ") + ")");
  /* Ricomincia: tutto da capo, l'invito di Luca torna aperto */
  await pg.click("[data-prova=scegli]"); await pg.locator(".prova-scelta").waitFor();
  await pg.click("[data-prova=ricomincia]"); await pg.locator(".prova-scelta").waitFor();
  check(await pg.evaluate(() => { const d = JSON.parse(localStorage.getItem("prova.dati"));
      return !d.partners.some(p => p.codice_amway === d._prova.codiceLuca) && !d.invitiP.find(i => i.id === "inv-luca").usato_il; })
    && Object.keys(await tutte()).filter(k => k.startsWith("prova.")).join() === "prova.dati", "prova: «Ricomincia» rimette i dati inventati come all'inizio (l'invito di Luca torna aperto)");
  check(!err.length, "prova: nessun errore nella pagina (" + err.slice(0, 2).join(" | ") + ")");
  await c.close();
}

// 69. Il campo «Social» (062): nel modulo «Telefono» e «Social» separati, salvati e mostrati nella scheda
{
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.click("button[data-act=persona-nuova]");
  const tel = page.locator(".sheet input[name=contatto]"), soc = page.locator(".sheet input[name=social]");
  check((await page.locator(".sheet label.field:has(input[name=contatto]) > span:first-child").innerText()).replace(/\s+/g, " ").trim() === "Telefono (facoltativo)"
    && await tel.getAttribute("type") === "tel" && await tel.getAttribute("autocomplete") === "tel", "social: il campo «Telefono (facoltativo)», di tipo tel");
  check((await page.locator(".sheet label.field:has(input[name=social]) > span").innerText()).replace(/\s+/g, " ").trim() === "Social (facoltativo)"
    && await soc.getAttribute("placeholder") === "es. @nome su Instagram" && await soc.getAttribute("autocomplete") === "off"
    && await soc.getAttribute("autocapitalize") === "off", "social: sotto il telefono il campo «Social (facoltativo)»");
  await page.screenshot({ path: S + "/e2e/69-modulo-chiaro.png" });
  await page.fill(".sheet input[name=nome]", "Nome Con Social");
  await tel.fill("+39 333 0000001");
  await soc.fill("@nome_prova");
  await page.click(".sheet button.primary");
  await page.getByText("Nome Con Social nella tua lista").waitFor();
  await sync(page);
  const ps = DB.persone.find(x => x.nome === "Nome Con Social");
  check(ps && ps.contatto === "+39 333 0000001" && ps.social === "@nome_prova", "social: telefono e social salvati così come sono scritti");
  await page.locator("button[data-act=apri-persona]", { hasText:"Nome Con Social" }).click();
  check((await page.locator("#app").innerText()).includes("+39 333 0000001 · @nome_prova"), "social: nella scheda della persona telefono e social");
  await page.click("button[data-act=persona-modifica]");
  check(await soc.inputValue() === "@nome_prova", "social: in «Modifica i dati» il social già scritto");
  await soc.fill("@nome_nuovo");
  await page.click(".sheet button.primary");
  await page.locator(".sheet").waitFor({ state:"detached" });
  await sync(page);
  check(DB.persone.find(x => x.id === ps.id).social === "@nome_nuovo", "social: si modifica");
  check(!errori.length, "social: nessun errore nella pagina");
  await ctx.close();
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.click("button[data-act=persona-nuova]");
  await page.screenshot({ path: S + "/e2e/69-modulo-scuro.png" });
  await ctx.close();
}

// 70. «Come lo conosci?»: una domanda sola (tre scelte e il dettaglio), per tutti e anche per i nuovi clienti
{
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.click("button[data-act=persona-nuova]");
  const cc = page.locator(".sheet fieldset.come-conosci");
  check((await cc.locator("legend").innerText()).replace(/\s+/g, " ").trim() === "Come lo conosci? (facoltativo)"
    && (await cc.locator(".chip span").allInnerTexts()).join("|") === "Lo conoscevo|Di recente|Dai social"
    && (await cc.locator("input").evaluateAll(l => l.map(i => i.value))).join() === "conoscenza,dal_vivo,social",
    "come lo conosci: tre scelte con gli stessi valori di prima");
  check(!(await page.locator(".sheet legend", { hasText:"Fonte" }).count()), "come lo conosci: niente più «Fonte»");
  check((await page.locator(".sheet label.field:has(input[name=origine]) > span").innerText()).replace(/\s+/g, " ").trim() === "Dettaglio (facoltativo)"
    && await page.getAttribute(".sheet input[name=origine]", "placeholder") === "es. collega, palestra, cugino", "come lo conosci: sotto, il «Dettaglio»");
  const righe = await cc.locator(".chip span").evaluateAll(l => l.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; }));
  check(new Set(righe.map(r => r[0])).size === 1 && righe.every(r => r[1] < 40), "come lo conosci: a 360 px i tre chip su una riga, senza a capo");
  check(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, "come lo conosci: la pagina non scorre di lato");
  await page.screenshot({ path: S + "/e2e/70-come-chiaro.png" });
  await cc.locator("label.chip", { hasText:"Dai social" }).click();
  check(await page.evaluate(() => document.activeElement && document.activeElement.name) === "social", "«Dai social»: il cursore va al campo Social");
  await cc.locator("label.chip", { hasText:"Di recente" }).click();
  check(await page.evaluate(() => document.activeElement && document.activeElement.name) !== "social", "le altre scelte non spostano il cursore");
  await page.fill(".sheet input[name=nome]", "Nome Di Recente");
  await page.fill(".sheet input[name=origine]", "palestra");
  await page.click(".sheet button.primary");
  await page.getByText("Nome Di Recente nella tua lista").waitFor();
  await sync(page);
  check(DB.persone.some(x => x.nome === "Nome Di Recente" && x.fonte === "dal_vivo" && x.origine === "palestra"), "nel database la scelta e il dettaglio");
  // i nuovi clienti: la stessa domanda
  await page.click("button[data-sez=clienti]");
  await page.click("button[data-act=cliente-nuovo]");
  check(await page.locator(".sheet fieldset.come-conosci input[name=fonte]").count() === 3, "nuovo cliente: anche lui ha «Come lo conosci?»");
  await page.fill(".sheet input[name=nome]", "Cliente Conosciuto");
  await page.locator(".sheet fieldset.come-conosci label.chip", { hasText:"Lo conoscevo" }).click();
  await page.click(".sheet button.primary");
  await page.getByText("Cliente Conosciuto tra i tuoi clienti").waitFor();
  await sync(page);
  const cl = DB.persone.find(x => x.nome === "Cliente Conosciuto");
  check(cl && cl.fonte === "conoscenza", "nuovo cliente: la scelta è salvata");
  // in «Modifica i dati» la scelta di prima resta e si può cambiare
  /* salvato il cliente nuovo si apre già la sua scheda */
  if(!(await page.locator("button[data-act=persona-modifica]").count())) await page.locator("button[data-act=apri-cliente]", { hasText:"Cliente Conosciuto" }).click();
  await page.click("button[data-act=persona-modifica]");
  check(await page.isChecked(".sheet input[name=fonte][value=conoscenza]"), "modifica: la scelta di prima è già segnata");
  await page.click(".sheet button.primary");
  await page.locator(".sheet").waitFor({ state:"detached" });
  await sync(page);
  check(DB.persone.find(x => x.id === cl.id).fonte === "conoscenza", "modifica: salvando senza toccarla la scelta resta");
  check(!errori.length, "come lo conosci: nessun errore nella pagina");
  await ctx.close();
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.click("button[data-act=persona-nuova]");
  await page.locator(".sheet fieldset.come-conosci label.chip", { hasText:"Di recente" }).click();
  await page.screenshot({ path: S + "/e2e/70-come-scuro.png" });
  await ctx.close();
}

// 71. «Rubrica» (Contact Picker API): solo per un nome nuovo e solo dove il telefono la offre; prende nome e telefono
{
  /* una rubrica finta: risponde con window.__contatti (vuoto = l'utente annulla) e si segna cosa le chiede l'app */
  const finta = () => { window.ContactsManager = function(){};
    Object.defineProperty(navigator, "contacts", { configurable:true, value:{ select:async (props, opz) => { window.__chiesto = { props, opz }; return window.__contatti || []; } } }); };
  for(const tema of ["light", "dark"]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
    if(tema === "light"){
      await page.click("button[data-act=persona-nuova]");
      check(!(await page.locator(".sheet button[data-act=rubrica]").count()), "rubrica: dove il browser non la offre il pulsante non c'è");
      await page.click(".sheet [data-act=chiudi]");
    }
    await page.evaluate(finta);
    await page.click("button[data-act=persona-nuova]");
    const rb = page.locator(".sheet button[data-act=rubrica]");
    check(await rb.count() === 1 && (await rb.innerText()).trim() === "Rubrica" && await rb.locator("svg").count() === 1, "rubrica: il pulsante «Rubrica» con l'icona, in cima al modulo");
    const st1 = await rb.evaluate(b => { const c = getComputedStyle(b), r = b.getBoundingClientRect(); return { bg:c.backgroundColor, h:r.height,
      azione:getComputedStyle(document.querySelector(".sheet button.primary")).backgroundColor, prima:b.compareDocumentPosition(b.form.nome) & Node.DOCUMENT_POSITION_FOLLOWING }; });
    check(st1.bg !== st1.azione && st1.h < 50 && st1.prima, "rubrica: stile secondario (contorno), su una riga, prima del nome");
    if(tema === "light"){
      // un contatto con un solo numero
      await page.evaluate(() => { window.__contatti = [{ name:["Mario Rubrica"], tel:["333 000-0001"], email:["non@serve.it"] }]; });
      await rb.click();
      await page.waitForFunction(() => document.querySelector(".sheet input[name=contatto]").value);
      check(await page.inputValue(".sheet input[name=nome]") === "Mario Rubrica" && await page.inputValue(".sheet input[name=contatto]") === "+393330000001",
        "rubrica: nome e telefono nei campi, il numero pulito con +39");
      check(await page.evaluate(() => JSON.stringify(window.__chiesto)) === JSON.stringify({ props:["name", "tel"], opz:{ multiple:true } }),
        "rubrica: si chiedono solo nome e telefono (si possono scegliere più contatti)");
      // i campi restano modificabili a mano
      await page.fill(".sheet input[name=contatto]", "333 000 0009");
      // se si annulla non cambia niente
      await page.evaluate(() => { window.__contatti = []; });
      await rb.click(); await page.waitForTimeout(200);
      check(await page.inputValue(".sheet input[name=nome]") === "Mario Rubrica" && await page.inputValue(".sheet input[name=contatto]") === "333 000 0009",
        "rubrica: annullando i campi restano come sono");
      await page.click(".sheet button.primary");
      await page.getByText("Mario Rubrica nella tua lista").waitFor();
      await sync(page);
      check(DB.persone.some(x => x.nome === "Mario Rubrica" && x.contatto === "333 000 0009" && !("email" in x)),
        "rubrica: si salva quello che c'è nel campo (scritto a mano: non trasformato), niente email");
      await page.click("button[data-act=persona-nuova]");
    }
    // un contatto con più numeri: si sceglie quale
    await page.evaluate(() => { window.__contatti = [{ name:["Lucia Due Numeri"], tel:["(0039) 333 0000002", "02 0000003", "02 0000003"] }]; });
    await page.click(".sheet button[data-act=rubrica]");
    await page.locator(".sheet .scegli-numero button").first().waitFor();
    check((await page.locator(".sheet .scegli-numero button").allInnerTexts()).join("|") === "+393330000002|+39020000003"
      && await page.inputValue(".sheet input[name=contatto]") === "", "rubrica: più numeri → «Quale numero?», senza doppioni, campo ancora vuoto");
    await page.screenshot({ path: S + `/e2e/71-rubrica-${tema}.png` });
    if(tema === "light"){
      await page.click(".sheet .scegli-numero button:has-text('+39020000003')");
      check(await page.inputValue(".sheet input[name=contatto]") === "+39020000003" && !(await page.locator(".sheet .scegli-numero button").count()),
        "rubrica: scelto il numero, va nel campo e l'elenco sparisce");
      await page.click(".sheet [data-act=chiudi]");
      // non in «Modifica i dati», non nel contatto rapido; sì nel nuovo cliente
      await page.locator("button[data-act=apri-persona]", { hasText:"Mario Rubrica" }).click();
      await page.click("button[data-act=persona-modifica]");
      check(!(await page.locator(".sheet button[data-act=rubrica]").count()), "rubrica: non in «Modifica i dati»");
      await page.click(".sheet [data-act=chiudi]");
      await page.click("button[data-act=vista-io]");
      await page.click("button[data-act=contatto-rapido]");
      check(!(await page.locator(".sheet button[data-act=rubrica]").count()), "rubrica: non nel contatto rapido di Io");
      await page.click(".sheet [data-act=chiudi]");
      await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]");
      await page.click("button[data-act=cliente-nuovo]");
      check(await page.locator(".sheet button[data-act=rubrica]").count() === 1, "rubrica: c'è anche per un nuovo cliente");
      check(!errori.length, "rubrica: nessun errore nella pagina");
    }
    await ctx.close();
  }
  /* la pulizia dei numeri, vista dall'elenco «Quale numero?» (i numeri uguali dopo la pulizia compaiono una volta) */
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.evaluate(finta);
  await page.click("button[data-act=persona-nuova]");
  await page.evaluate(() => { window.__contatti = [{ name:["Prova Numeri"], tel:["333 123 4567", "+39 333-123-4567", "0039 (333) 1234567", "0044 20 7946 0000",
    "+41 79 000 00 00", "06 1234567", "333.123.4567", "ciao", "12", "*31#"] }]; });
  await page.click(".sheet button[data-act=rubrica]");
  await page.locator(".sheet .scegli-numero button").first().waitFor();
  const pul = await page.locator(".sheet .scegli-numero button").allInnerTexts();
  check(pul.join() === "+393331234567,+442079460000,+41790000000,+39061234567",
    "numeri: spazi, trattini e parentesi via; 00 → +; +39 se manca il prefisso; scartato chi non è un numero (" + pul.join() + ")");
  await ctx.close();
}

// 72. «Incolla» accanto al telefono: legge gli appunti solo al tocco, mette il numero se c'è
{
  /* appunti finti: readText risponde con window.__appunti (o rifiuta se window.__appuntiNo) */
  const appunti = () => Object.defineProperty(navigator, "clipboard", { configurable:true, value:{ readText:async () => {
    window.__letti = (window.__letti || 0) + 1; if(window.__appuntiNo) throw new Error("NotAllowedError"); return window.__appunti || ""; } } });
  for(const tema of ["light", "dark"]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
    if(tema === "light"){
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable:true, value:undefined }));
      await page.click("button[data-act=persona-nuova]");
      check(!(await page.locator(".sheet button[data-act=incolla-numero]").count()), "incolla: se il browser non legge gli appunti il pulsante non c'è");
      await page.click(".sheet [data-act=chiudi]");
    }
    await page.evaluate(appunti);
    await page.click("button[data-act=persona-nuova]");
    const inc = page.locator(".sheet button[data-act=incolla-numero]");
    const pos = await inc.evaluate(b => { const i = b.form.contatto.getBoundingClientRect(), r = b.getBoundingClientRect();
      return { accanto:Math.abs(i.top - r.top) < 2 && r.left > i.right, h:r.height, testo:b.textContent.trim() }; });
    check(pos.accanto && pos.testo === "Incolla" && pos.h < 50, "incolla: il pulsante «Incolla» accanto al campo Telefono, su una riga");
    check(await page.evaluate(() => window.__letti || 0) === 0, "incolla: aprendo il modulo gli appunti non si leggono");
    if(tema === "light"){
      await page.evaluate(() => { window.__appunti = "Ciao, sono Gino! Il mio numero è 333 000 0004, ci sentiamo il 12/05/2026"; });
      await inc.click();
      await page.waitForFunction(() => document.querySelector(".sheet input[name=contatto]").value);
      check(await page.inputValue(".sheet input[name=contatto]") === "+393330000004" && await page.evaluate(() => window.__letti) === 1,
        "incolla: dal testo copiato solo il numero, pulito con +39");
      await page.evaluate(() => { window.__appunti = "ci vediamo il 12/05/2026 alle 18"; });
      await inc.click();
      await page.locator(".toast", { hasText:"Negli appunti non c'è un numero" }).waitFor();
      check(await page.inputValue(".sheet input[name=contatto]") === "+393330000004", "incolla: senza numero l'avviso e il campo resta com'è");
      await page.evaluate(() => { window.__appuntiNo = true; });
      await inc.click();
      await page.locator(".toast", { hasText:"Non riesco a leggere gli appunti" }).waitFor();
      check(await page.inputValue(".sheet input[name=contatto]") === "+393330000004", "incolla: se il telefono nega gli appunti, niente cambia");
      await page.evaluate(() => { window.__appuntiNo = false; window.__appunti = "0039 333 000 0005"; });
      await inc.click();
      await page.waitForFunction(() => document.querySelector(".sheet input[name=contatto]").value === "+393330000005");
      check(true, "incolla: 00 → +");
      await page.fill(".sheet input[name=contatto]", "333-000-0006 ufficio");
      await page.fill(".sheet input[name=nome]", "Gino Incolla");
      await page.click(".sheet button.primary");
      await page.getByText("Gino Incolla nella tua lista").waitFor();
      await sync(page);
      check(DB.persone.some(x => x.nome === "Gino Incolla" && x.contatto === "333-000-0006 ufficio"), "incolla: il campo resta scrivibile, a mano non si trasforma");
      await page.locator("button[data-act=apri-persona]", { hasText:"Gino Incolla" }).click();
      await page.click("button[data-act=persona-modifica]");
      check(!(await page.locator(".sheet button[data-act=incolla-numero]").count()) && await page.inputValue(".sheet input[name=contatto]") === "333-000-0006 ufficio",
        "incolla: non in «Modifica i dati»");
      await page.click(".sheet [data-act=chiudi]");
      await page.click("button[data-act=torna-lista]");
      await page.click("button[data-sez=clienti]");
      await page.click("button[data-act=cliente-nuovo]");
      check(await page.locator(".sheet button[data-act=incolla-numero]").count() === 1, "incolla: c'è anche per un nuovo cliente");
      check(!errori.length, "incolla: nessun errore nella pagina");
    } else {
      await page.screenshot({ path: S + "/e2e/72-incolla-dark.png" });
    }
    if(tema === "light"){ await page.click(".sheet [data-act=chiudi]"); await page.click("button[data-sez=lista]"); await page.click("button[data-act=persona-nuova]");
      await page.screenshot({ path: S + "/e2e/72-incolla-light.png" }); }
    await ctx.close();
  }
}

// 73. Doppioni: lo stesso numero già nella lista → avviso ambra con la scheda da aprire; si può comunque salvare
{
  for(const tema of ["light", "dark"]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
    const avviso = page.locator(".sheet .avviso-doppione");
    const nuovo = async (nome, tel) => { await page.click("button[data-act=persona-nuova]"); await page.fill(".sheet input[name=nome]", nome);
      if(tel) await page.fill(".sheet input[name=contatto]", tel); };
    if(tema === "light"){
      await nuovo("Primo Numero", "333 000 0010");
      await page.click(".sheet button.primary");
      await page.getByText("Primo Numero nella tua lista").waitFor();
      // scritto a mano, con +39 e trattini: all'uscita dal campo l'avviso
      await nuovo("Secondo Numero", "+39 333-000-0010");
      check(await avviso.isHidden(), "doppioni: mentre si scrive nessun avviso");
      await page.locator(".sheet input[name=contatto]").press("Tab");
      await avviso.locator("button[data-act=apri-doppione]").waitFor();
      check((await avviso.innerText()).includes("È già nella tua lista: Primo Numero"), "doppioni: uscendo dal campo «È già nella tua lista: Primo Numero»");
      const amb = await avviso.evaluate(e => getComputedStyle(e.querySelector("b")).color === getComputedStyle(document.documentElement).getPropertyValue("--giallo").trim()
        || getComputedStyle(e.querySelector("b")).color);
      check(amb === true || /rgb/.test(String(amb)), "doppioni: avviso ambra");
      // cambiando il numero l'avviso sparisce; un numero estero con le stesse cifre non è un doppione
      await page.fill(".sheet input[name=contatto]", "+41 333 000 0010");
      await page.locator(".sheet input[name=contatto]").press("Tab");
      check(await avviso.isHidden(), "doppioni: un numero diverso (anche +41 con le stesse cifre) non dà l'avviso");
      // al salvataggio: il primo tocco mostra l'avviso, il secondo salva
      await page.fill(".sheet input[name=contatto]", "0039 3330000010");
      await page.click(".sheet button.primary");
      await avviso.locator("button[data-act=apri-doppione]").waitFor();
      check(await page.locator(".sheet").count() === 1, "doppioni: al primo «Salva» l'avviso, il modulo resta aperto");
      await page.waitForTimeout(800);
      await page.click(".sheet button.primary");
      await page.getByText("Secondo Numero nella tua lista").waitFor();
      await sync(page);
      check(DB.persone.some(x => x.nome === "Secondo Numero" && x.contatto === "0039 3330000010"), "doppioni: si può comunque salvare, il numero com'era scritto");
      // dagli appunti e dalla rubrica
      await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable:true, value:{ readText:async () => "chiama 333 000 0010" } });
        window.ContactsManager = function(){}; Object.defineProperty(navigator, "contacts", { configurable:true, value:{ select:async () => [{ name:["Terzo Rubrica"], tel:["3330000010"] }] } }); });
      await nuovo("Terzo Incolla");
      await page.click(".sheet button[data-act=incolla-numero]");
      await avviso.locator("button[data-act=apri-doppione]").waitFor();
      check((await avviso.innerText()).includes("Primo Numero"), "doppioni: anche con «Incolla»");
      await page.click(".sheet [data-act=chiudi]");
      await page.click("button[data-act=persona-nuova]");
      await page.click(".sheet button[data-act=rubrica]");
      await avviso.locator("button[data-act=apri-doppione]").waitFor();
      check(await page.inputValue(".sheet input[name=nome]") === "Terzo Rubrica", "doppioni: anche con «Rubrica»");
      // «Apri la sua scheda»
      await avviso.locator("button[data-act=apri-doppione]").click();
      await page.locator(".sheet").waitFor({ state:"detached" });
      check(await page.locator("#app h2", { hasText:"Primo Numero" }).count() === 1, "doppioni: «Apri la sua scheda» chiude il modulo e apre quella scheda");
      // «Modifica i dati»: salvare senza cambiare il numero non dà avvisi; cambiandolo in uno già presente sì
      const primo = DB.persone.find(x => x.nome === "Primo Numero");
      await page.click("button[data-act=persona-modifica]");
      await page.fill(".sheet [name=note]", "nota");
      await page.click(".sheet button.primary");
      await page.locator(".sheet").waitFor({ state:"detached" });
      check(true, "doppioni: in modifica, numero non toccato → si salva subito");
      await page.click("button[data-act=persona-modifica]");
      await page.fill(".sheet input[name=contatto]", "+39 333 000 0006");
      await page.locator(".sheet input[name=contatto]").press("Tab");
      await avviso.locator("button[data-act=apri-doppione]").waitFor();
      check((await avviso.innerText()).includes("Gino Incolla"), "doppioni: in modifica, un numero di un altro → l'avviso");
      await page.click(".sheet [data-act=chiudi]");
      await sync(page);
      check(DB.persone.find(x => x.id === primo.id).contatto === "333 000 0010", "doppioni: chiudendo senza salvare non cambia niente");
      check(!errori.length, "doppioni: nessun errore nella pagina");
    } else {
      await nuovo("Altro Numero", "333 000 0010");
      await page.locator(".sheet input[name=contatto]").press("Tab");
      await avviso.locator("button[data-act=apri-doppione]").waitFor();
    }
    if(tema === "light"){ await page.click("button[data-act=torna-lista]"); await nuovo("Altro Numero", "333 000 0010"); await page.locator(".sheet input[name=contatto]").press("Tab");
      await avviso.locator("button[data-act=apri-doppione]").waitFor(); }
    await page.screenshot({ path: S + `/e2e/73-doppione-${tema}.png` });
    await ctx.close();
  }
}

// 74. iPhone: il campo «Nome» con autocomplete="name"; il «+ Contatto» rapido trova ancora il nome uguale
{
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  const ac = () => page.getAttribute(".sheet input[name=nome]", "autocomplete");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.click("button[data-act=persona-nuova]");
  const a1 = await ac(); await page.click(".sheet [data-act=chiudi]");
  await page.locator("button[data-act=apri-persona]", { hasText:"Primo Numero" }).click();
  await page.click("button[data-act=persona-modifica]");
  const a2 = await ac(); await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-io]");
  await page.click("button[data-act=contatto-rapido]");
  const a3 = await ac();
  check(a1 === "name" && a2 === "name" && a3 === "name", "nome: autocomplete «name» (nuovo, modifica, contatto rapido)");
  await sync(page);
  const prima = DB.persone.length, primo = DB.persone.find(x => x.nome === "Primo Numero");
  const passiPrima = (DB.passi || []).filter(x => x.persona_id === primo.id && x.tipo === "contatto").length;
  await page.fill(".sheet input[name=nome]", "primo numero");
  await page.click(".sheet button.primary");
  await page.getByText("Contatto con Primo registrato").or(page.getByText("Contatto con primo registrato")).waitFor();
  await sync(page);
  check(DB.persone.length === prima && (DB.passi || []).filter(x => x.persona_id === primo.id && x.tipo === "contatto").length === passiPrima + 1,
    "contatto rapido: con il nome uguale (anche minuscolo) il contatto si segna su chi c'è già, nessun nome nuovo");
  await page.click("button[data-act=contatto-rapido]");
  await page.fill(".sheet input[name=nome]", "Nome Rapido Nuovo");
  await page.click(".sheet button.primary");
  await page.getByText("Contatto con Nome registrato").waitFor();
  await sync(page);
  check(DB.persone.length === prima + 1 && DB.persone.some(x => x.nome === "Nome Rapido Nuovo" && x.fase === "contattato"), "contatto rapido: un nome nuovo entra già Contattato");
  check(!errori.length, "nome: nessun errore nella pagina");
  await ctx.close();
}

// 75. «Rubrica» con più contatti: l'elenco da controllare e «Aggiungi N nomi»; con uno solo il modulo si compila anche se
//     l'app lo ha ridisegnato mentre la rubrica era aperta
{
  const finta = () => { window.ContactsManager = function(){};
    Object.defineProperty(navigator, "contacts", { configurable:true, value:{ select:async () => {
      /* come Android: mentre la rubrica è aperta l'app va in secondo piano e, tornando, può ridisegnare il modulo */
      if(window.__ridisegna){ const f = document.querySelector("#sheet form"); f.replaceWith(f.cloneNode(true)); }
      return window.__contatti || []; } } }); };
  for(const tema of ["light", "dark"]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
    await page.evaluate(finta);
    await page.click("button[data-act=persona-nuova]");
    if(tema === "light"){
      // un contatto solo, con il modulo ridisegnato mentre la rubrica è aperta
      await page.evaluate(() => { window.__ridisegna = true; window.__contatti = [{ name:["Uno Solo"], tel:["333 000 0020"] }]; });
      await page.click(".sheet button[data-act=rubrica]");
      await page.waitForFunction(() => document.querySelector(".sheet input[name=nome]").value);
      check(await page.inputValue(".sheet input[name=nome]") === "Uno Solo" && await page.inputValue(".sheet input[name=contatto]") === "+393330000020",
        "rubrica: un contatto solo entra nei campi anche se il modulo è stato ridisegnato");
      await page.evaluate(() => { window.__ridisegna = false; });
    }
    // tre contatti: uno già in lista (numero di Primo Numero), uno con due numeri, uno senza nome
    await page.evaluate(() => { window.__contatti = [
      { name:["Anna Rubrica"], tel:["333 000 0030"] },
      { name:["Bruno Due"], tel:["333 000 0031", "02 000 0032"] },
      { name:["Primo Doppio"], tel:["+39 333 000 0010"] },
      { name:[], tel:["333 000 0033"] }]; });
    await page.click(".sheet button[data-act=rubrica]");
    await page.locator(".sheet .rubrica-molti").waitFor();
    if(tema === "light"){
      const righe = page.locator(".sheet .rubrica-molti li");
      check(await righe.count() === 4 && await page.locator(".sheet .rubrica-molti input[name=r-sel]:checked").count() === 4
        && (await page.locator(".sheet h2").innerText()) === "Nomi dalla rubrica", "rubrica: più contatti → l'elenco, tutti spuntati");
      check(await page.locator(".sheet input[name=r-nome-0]").inputValue() === "Anna Rubrica" && await page.locator(".sheet input[name=r-tel-0]").inputValue() === "+393330000030",
        "rubrica: nome e numero pulito in ogni riga");
      check(await righe.nth(2).evaluate(e => e.classList.contains("doppione")) && (await righe.nth(2).innerText()).includes("È già nella tua lista: Primo Numero"),
        "rubrica: chi ha un numero già in lista è segnato in ambra");
      check((await page.locator(".sheet .aggiungi-molti").innerText()).trim() === "Aggiungi 4 nomi", "rubrica: «Aggiungi 4 nomi»");
      await page.uncheck(".sheet input[name=r-sel][value='2']");
      check((await page.locator(".sheet .aggiungi-molti").innerText()).trim() === "Aggiungi 3 nomi", "rubrica: togliendo una spunta il numero scende");
      await page.click(".sheet .rubrica-molti button[data-act=rubrica-altro-numero][data-numero='+39020000032']");
      check(await page.locator(".sheet input[name=r-tel-1]").inputValue() === "+39020000032", "rubrica: con due numeri si sceglie quale");
      // senza nome: si chiede di scriverlo
      await page.click(".sheet .aggiungi-molti");
      await page.locator(".sheet .errore", { hasText:"Scrivi il nome di tutti quelli spuntati" }).waitFor();
      check(true, "rubrica: senza nome non si aggiunge, lo chiede");
      await page.fill(".sheet input[name=r-nome-3]", "Carla Senza Nome");
      await page.locator(".sheet fieldset.come-conosci label.chip", { hasText:"Lo conoscevo" }).click();
      await page.fill(".sheet input[name=origine]", "colleghi");
      await page.click(".sheet .aggiungi-molti");
      await page.getByText("3 nomi nella tua lista").waitFor();
      await sync(page);
      const nuovi = ["Anna Rubrica", "Bruno Due", "Carla Senza Nome"].map(n => DB.persone.find(x => x.nome === n));
      check(nuovi.every(x => x && x.fonte === "conoscenza" && x.origine === "colleghi" && x.esito == null)
        && nuovi[1].contatto === "+39020000032" && !DB.persone.some(x => x.nome === "Primo Doppio"),
        "rubrica: entrano i tre spuntati, con la stessa risposta e lo stesso dettaglio; il doppione tolto no");
      // nuovi clienti dalla rubrica
      await page.click("button[data-sez=clienti]");
      await page.click("button[data-act=cliente-nuovo]");
      await page.evaluate(() => { window.__contatti = [{ name:["Cliente Uno R"], tel:["333 000 0041"] }, { name:["Cliente Due R"], tel:["333 000 0042"] }]; });
      await page.click(".sheet button[data-act=rubrica]");
      await page.locator(".sheet .rubrica-molti").waitFor();
      check((await page.locator(".sheet h2").innerText()) === "Nuovi clienti dalla rubrica" && (await page.locator(".sheet .aggiungi-molti").innerText()).trim() === "Aggiungi 2 clienti",
        "rubrica: anche per i nuovi clienti");
      await page.click(".sheet .aggiungi-molti");
      await page.getByText("2 nuovi clienti").waitFor();
      await sync(page);
      check(["Cliente Uno R", "Cliente Due R"].every(n => (DB.persone.find(x => x.nome === n) || {}).esito === "cliente"), "rubrica: i clienti entrano come Cliente");
      // annullando, si riparte dal modulo di un nome
      await page.click("button[data-sez=lista]");
      await page.click("button[data-act=persona-nuova]");
      check(await page.locator(".sheet input[name=nome]").count() === 1 && !(await page.locator(".sheet .rubrica-molti").count()), "rubrica: riaprendo, il modulo di un nome");
      check(!errori.length, "rubrica, più contatti: nessun errore nella pagina");
    } else {
      await page.uncheck(".sheet input[name=r-sel][value='2']");
      await page.screenshot({ path: S + "/e2e/75-rubrica-molti-dark.png" });
    }
    if(tema === "light"){ await page.evaluate(() => { window.__contatti = [{ name:["Anna Rubrica"], tel:["333 000 0030"] },
        { name:["Bruno Due"], tel:["333 000 0031", "02 000 0032"] }, { name:["Primo Doppio"], tel:["+39 333 000 0010"] }]; });
      await page.click(".sheet button[data-act=rubrica]");
      await page.locator(".sheet .rubrica-molti").waitFor(); await page.uncheck(".sheet input[name=r-sel][value='2']");
      await page.screenshot({ path: S + "/e2e/75-rubrica-molti-light.png" }); }
    await ctx.close();
  }
}

// 76. «Rubrica»: se non entra niente l'app dice perché (solo quanti, mai nomi o numeri); il contatto resta anche ridisegnando
{
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.evaluate(() => { window.ContactsManager = function(){};
    Object.defineProperty(navigator, "contacts", { configurable:true, value:{ select:async () => {
      if(window.__rubricaErrore){ const e = new Error("x"); e.name = window.__rubricaErrore; throw e; }
      if(window.__lenta) await new Promise(r => setTimeout(r, 2300));
      return window.__contatti; } } }); });
  await page.click("button[data-act=persona-nuova]");
  const prova = async (contatti, errore, testo, msg) => {
    await page.evaluate(([c, e]) => { window.__contatti = c; window.__rubricaErrore = e; }, [contatti, errore]);
    await page.click(".sheet button[data-act=rubrica]");
    await page.locator(".toast", { hasText:testo }).waitFor();
    check(await page.inputValue(".sheet input[name=nome]") === "" && await page.inputValue(".sheet input[name=contatto]") === "", msg);
  };
  // Android 17: «0 contatti» subito, prima della scelta → il riquadro con l'altra strada (Contatti → Condividi → Growup)
  await page.evaluate(() => { window.__contatti = []; window.__rubricaErrore = null; });
  await page.click(".sheet button[data-act=rubrica]");
  await page.locator(".sheet .rubrica-guida").waitFor();
  check((await page.locator(".sheet .rubrica-guida").innerText()).replace(/\s+/g, " ").includes("apri l'app Contatti, spunta uno o più nomi, tocca Condividi e scegli Growup"),
    "rubrica: «0 contatti» subito → il riquadro che spiega Contatti → Condividi → Growup");
  await page.screenshot({ path: S + "/e2e/76-rubrica-guida.png" });
  // se la risposta vuota arriva dopo (chi annulla dopo aver guardato) → solo l'avviso
  await page.evaluate(() => { window.__lenta = true; });
  await prova([], null, "Dalla rubrica non è arrivato nessun contatto", "rubrica: annullando dopo un po' → l'avviso");
  await page.evaluate(() => { window.__lenta = false; });
  await prova([{ name:[], tel:[] }], null, "Il contatto è arrivato senza nome e senza numero", "rubrica: contatto vuoto → lo dice");
  await prova(null, "SecurityError", "La rubrica non ha risposto (SecurityError)", "rubrica: errore → lo dice, con il tipo di errore");
  // nome e numero arrivati anche come testo semplice; restano tornando sull'app (l'app ridisegna)
  await page.evaluate(() => { window.__rubricaErrore = null; window.__contatti = [{ name:"Ugo Testo", tel:"333 000 0050" }]; });
  await page.click(".sheet button[data-act=rubrica]");
  await page.waitForFunction(() => document.querySelector(".sheet input[name=nome]").value === "Ugo Testo");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(1200);
  check(await page.inputValue(".sheet input[name=nome]") === "Ugo Testo" && await page.inputValue(".sheet input[name=contatto]") === "+393330000050",
    "rubrica: il contatto resta nel modulo anche quando l'app ridisegna");
  // un nome scritto prima viene sostituito da quello della rubrica; dopo, si corregge a mano
  await page.fill(".sheet input[name=nome]", "Scritto a mano");
  await page.evaluate(() => { window.__contatti = [{ name:["Vera Rubrica"], tel:["333 000 0051", "333 000 0052"] }]; });
  await page.click(".sheet button[data-act=rubrica]");
  await page.locator(".sheet .scegli-numero button").first().waitFor();
  check(await page.inputValue(".sheet input[name=nome]") === "Vera Rubrica", "rubrica: il nome della rubrica prende il posto di quello scritto");
  await page.click(".sheet .scegli-numero button:has-text('+393330000052')");
  check(await page.inputValue(".sheet input[name=contatto]") === "+393330000052" && !(await page.locator(".sheet .scegli-numero button").count()),
    "rubrica: scelto il numero, l'elenco sparisce");
  await page.fill(".sheet input[name=nome]", "Vera Corretta");
  await page.click(".sheet button.primary");
  await page.getByText("Vera Corretta nella tua lista").waitFor();
  await sync(page);
  check(DB.persone.some(x => x.nome === "Vera Corretta" && x.contatto === "+393330000052"), "rubrica: si salva quello che c'è nei campi");
  await page.click("button[data-act=persona-nuova]");
  check(await page.inputValue(".sheet input[name=nome]") === "" && await page.inputValue(".sheet input[name=contatto]") === "", "rubrica: riaprendo, il modulo è vuoto");
  check(!errori.length, "rubrica, avvisi: nessun errore nella pagina");
  await ctx.close();
}

// 77. «Condividi → Growup» dall'app Contatti (Android 17): il manifest, il service worker che tiene solo nomi e numeri,
//     l'app che apre l'elenco «Nomi dalla rubrica»
{
  const man = JSON.parse(fs.readFileSync(S + "/../manifest.webmanifest", "utf8")), sh = man.share_target || {};
  check(sh.action === "./condividi" && sh.method === "POST" && sh.enctype === "multipart/form-data"
    && (sh.params.files || []).some(f => f.name === "contatti" && f.accept.includes("text/x-vcard") && f.accept.includes(".vcf")),
    "condividi: Growup tra le app di «Condividi» per i file dei contatti");
  /* il lettore del service worker, provato da solo */
  const vm = await import("node:vm");
  const cx = { self:{ addEventListener(){}, registration:{ scope:"https://x/growup-team/" } }, location:{ origin:"https://x" }, caches:{}, URL, Response:class{}, TextDecoder, Uint8Array };
  vm.createContext(cx); vm.runInContext(fs.readFileSync(S + "/../sw.js", "utf8"), cx);
  const vc = ["BEGIN:VCARD", "VERSION:2.1", "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Ross=C3=AC;Nicol=C3=B2;;;",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Nicol=C3=B2 Ross=C3=AC", "TEL;CELL:+39 333 000 0060", "TEL;HOME:02 000 0061", "EMAIL;HOME:non@serve.it", "END:VCARD",
    "BEGIN:VCARD", "VERSION:3.0", "N:Bianchi;Luca;;;", "TEL;TYPE=CELL:333-000-0062", "ADR;TYPE=HOME:;;Via Prova 1;Città;;;Italia", "PHOTO;ENCODING=b;TYPE=JPEG:AAAA", " BBBB==", "NOTE:segreto", "END:VCARD",
    "BEGIN:VCARD", "VERSION:4.0", "FN:Anna\\, la cugina", "TEL;VALUE=uri;TYPE=cell:tel:+39-333-000-0063", "END:VCARD"].join("\r\n");
  const letti = JSON.parse(JSON.stringify(cx.contattiDaVcard(vc)));
  check(JSON.stringify(letti) === JSON.stringify([{ nome:"Nicolò Rossì", tel:["+39 333 000 0060", "02 000 0061"] }, { nome:"Luca Bianchi", tel:["333-000-0062"] },
    { nome:"Anna, la cugina", tel:["+39-333-000-0063"] }]) && !/serve|Prova 1|segreto|AAAA/.test(JSON.stringify(letti)),
    "condividi: dal file vCard solo nomi e numeri (2.1 con accenti, 3.0, 4.0); niente email, indirizzi, foto, note (" + JSON.stringify(letti) + ")");
  /* l'app: si apre con ?condivisi=1 e trova nella cache quello che il service worker ha messo da parte */
  const entraCondivisi = async (contatti, tema) => {
    const c = await browser.newContext({ viewport:{ width:360, height:780 }, colorScheme:tema || "light", locale:"it-IT", timezoneId:"Europe/Rome", bypassCSP:true, reducedMotion:"reduce" });
    await c.route(/cdn\.jsdelivr\.net/, r => r.abort());
    await c.route(/challenges\.cloudflare\.com/, r => r.fulfill({ contentType:"text/javascript", body:
      "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('tok-prova')},50)}};" }));
    await c.addInitScript(dati => { window.__cachePronta = caches.open("growup-condivisi").then(x => x.put(new URL("condivisi", location.href.replace(/[?#].*$/, "")).href,
      new Response(JSON.stringify(dati), { headers:{ "Content-Type":"application/json" } }))); }, contatti);
    await c.addInitScript(([db, m]) => { window.__DB = db; eval(m); }, [DB, mock]);
    const pg = await c.newPage(); pg.on("dialog", d => d.accept()); pg.on("pageerror", e => errori.push(String(e)));
    await pg.addLocatorHandler(pg.locator(".festa.traguardo"), async t => { await t.locator("button[data-act=traguardo-chiudi]").click(); });
    await pg.goto(BASE + "?condivisi=1#chiave=" + "a".repeat(32));
    return { c, pg };
  };
  let { c, pg } = await entraCondivisi([{ nome:"Ines Condivisa", tel:["347 555 0170"] }, { nome:"Oreste Condiviso", tel:["347 555 0171", "02 555 0172"] }, { nome:"", tel:[] }]);
  await pg.locator(".sheet .rubrica-molti").waitFor();
  check(await pg.locator(".sheet .rubrica-molti li").count() === 2 && await pg.locator(".sheet input[name=r-tel-0]").inputValue() === "+393475550170"
    && (await pg.locator(".sheet .aggiungi-molti").innerText()).trim() === "Aggiungi 2 nomi" && !(await pg.evaluate(() => location.search)),
    "condividi: Growup si apre con l'elenco «Nomi dalla rubrica» (numeri puliti) e l'indirizzo torna pulito");
  check(await pg.evaluate(async () => !(await (await caches.open("growup-condivisi")).match(new URL("condivisi", location.href).href))),
    "condividi: nomi e numeri messi da parte si cancellano appena letti");
  await pg.click(".sheet .aggiungi-molti");
  await pg.getByText("2 nomi nella tua lista").waitFor();
  await sync(pg);
  check(["Ines Condivisa", "Oreste Condiviso"].every(n => DB.persone.some(x => x.nome === n)), "condividi: «Aggiungi 2 nomi» li mette nella Lista");
  await c.close();
  // un contatto solo: il modulo di un nome già compilato
  ({ c, pg } = await entraCondivisi([{ nome:"Pia Sola", tel:["347 555 0180"] }], "dark"));
  await pg.locator(".sheet input[name=nome]").waitFor();
  check(await pg.inputValue(".sheet input[name=nome]") === "Pia Sola" && await pg.inputValue(".sheet input[name=contatto]") === "+393475550180",
    "condividi: un contatto solo → il modulo di un nome già compilato");
  await pg.screenshot({ path: S + "/e2e/77-condividi-uno-dark.png" });
  await c.close();
  // niente contatti nel file
  ({ c, pg } = await entraCondivisi([]));
  await pg.locator(".toast", { hasText:"In quello che hai condiviso non ho trovato contatti" }).waitFor();
  check(!(await pg.locator(".sheet").count()), "condividi: senza contatti l'avviso, nessun modulo");
  await c.close();
  check(!errori.length, "condividi: nessun errore nella pagina");
}

// 78. Il tasto Indietro del telefono: chiude il foglio o torna alla schermata di prima, senza uscire dall'app; i pulsanti
//     dell'app tolgono la stessa voce della cronologia (niente fogli che si riaprono, niente doppio Indietro)
for(const tema of ["light", "dark"]){
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  const livello = () => page.evaluate(() => (history.state && history.state.growup) || 0);
  const aspetta = n => page.waitForFunction(x => ((history.state && history.state.growup) || 0) === x, n);
  const indietro = async n => { await page.goBack({ waitUntil:"commit" }); await aspetta(n); };
  const titolo = () => page.locator("#app h1").first().innerText();
  const foglio = () => page.locator(".sheet").count();
  const base = await page.evaluate(() => history.length);
  /* Chrome su Android salta con Indietro le voci aggiunte senza un tocco (e la schermata da cui sono state aggiunte):
     l'app ne deve aggiungere solo subito dopo un tocco o un tasto. Qui si segna ogni pushState e se c'era il tocco. */
  await page.evaluate(() => { window.__senzaTocco = 0; window.__voci = 0; const ps = history.pushState.bind(history);
    history.pushState = (a, b, c) => { window.__voci++; if(!navigator.userActivation.isActive) window.__senzaTocco++; return ps(a, b, c); }; });
  check(await livello() === 0, `indietro ${tema}: sulla schermata principale nessuna voce in più`);
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  check(await livello() === 0 && await page.evaluate(() => history.length) === base, `indietro ${tema}: le schede principali non aggiungono voci`);
  // una scheda: Indietro torna alla Lista
  const persona = page.locator("button[data-act=apri-persona]", { hasText:"Primo Numero" });
  await persona.click();
  await aspetta(1);
  check(await titolo() === "La mia lista" && await page.locator("#app h2", { hasText:"Primo Numero" }).count() === 1, `indietro ${tema}: la scheda aggiunge una voce`);
  await indietro(0);
  check(await titolo() === "Persone" && !(await page.locator("#app h2", { hasText:"Primo Numero" }).count()), `indietro ${tema}: Indietro dalla scheda torna alla Lista`);
  // «‹ La mia lista» toglie la stessa voce: dopo, un foglio aperto e Indietro non riaprono la scheda
  await persona.click(); await aspetta(1);
  await page.click("button[data-act=torna-lista]"); await aspetta(0);
  await page.click("button[data-act=persona-nuova]"); await aspetta(1);
  check(await foglio() === 1, `indietro ${tema}: «+ Nome» apre il foglio con una voce`);
  await indietro(0);
  check(!(await foglio()) && await titolo() === "Persone", `indietro ${tema}: Indietro chiude il foglio e non riapre la scheda chiusa con «‹ La mia lista»`);
  // «Annulla» toglie la voce del foglio
  await page.click("button[data-act=persona-nuova]"); await aspetta(1);
  await page.click(".sheet [data-act=chiudi]"); await aspetta(0);
  check(!(await foglio()) && await page.evaluate(() => history.length) <= base + 1, `indietro ${tema}: «Annulla» chiude il foglio e toglie la voce`);
  // foglio sopra una scheda: Indietro chiude il foglio, il secondo Indietro la scheda
  await persona.click(); await aspetta(1);
  await page.click("button[data-act=persona-modifica]"); await aspetta(2);
  await indietro(1);
  check(!(await foglio()) && await page.locator("#app h2", { hasText:"Primo Numero" }).count() === 1, `indietro ${tema}: Indietro chiude il foglio e lascia la scheda aperta`);
  await indietro(0);
  check(await titolo() === "Persone", `indietro ${tema}: il secondo Indietro torna alla Lista`);
  // campi compilati: «Uscire senza salvare?» (finestra dell'app); con «Annulla» il foglio resta com'era e un altro Indietro
  // chiede di nuovo, senza uscire dall'app (sul telefono la finestra di sistema non contava come tocco e Chrome saltava la voce)
  const domanda = page.locator(".domanda-uscita");
  let nativa = 0; page.on("dialog", () => { nativa++; });
  await page.click("button[data-act=persona-nuova]"); await aspetta(1);
  await page.click(".sheet input[name=nome]");
  await page.locator(".sheet input[name=nome]").pressSequentially("Nome Da Non Perdere");
  await aspetta(2);
  check(true, `indietro ${tema}: scrivendo nel foglio si aggiunge la voce di guardia`);
  await page.goBack({ waitUntil:"commit" }); await aspetta(1);
  await domanda.waitFor();
  check(await foglio() === 1 && await page.inputValue(".sheet input[name=nome]") === "Nome Da Non Perdere"
    && (await domanda.innerText()).includes("Uscire senza salvare?") && nativa === 0,
    `indietro ${tema}: con campi compilati chiede «Uscire senza salvare?» nella finestra dell'app`);
  if(tema === "light") await page.screenshot({ path: S + `/e2e/78-uscire-light.png` });
  await domanda.locator("button[data-act=uscita-annulla]").click();
  await aspetta(2);
  check(!(await domanda.count()) && await page.inputValue(".sheet input[name=nome]") === "Nome Da Non Perdere", `indietro ${tema}: «Annulla» lascia il foglio com'era e rimette la voce`);
  await page.goBack({ waitUntil:"commit" }); await aspetta(1);
  await domanda.waitFor();
  check(await foglio() === 1 && await titolo() === "Persone", `indietro ${tema}: dopo «Annulla» un altro Indietro chiede di nuovo (non esce dall'app)`);
  if(tema === "dark") await page.screenshot({ path: S + `/e2e/78-uscire-dark.png` });
  // Indietro ancora, con la domanda aperta: si esce dal foglio senza salvare ma si resta nell'app
  await page.goBack({ waitUntil:"commit" }); await aspetta(0);
  check(!(await foglio()) && !(await domanda.count()) && await titolo() === "Persone" && page.url().startsWith(BASE), `indietro ${tema}: Indietro sulla domanda chiude il foglio, l'app resta aperta`);
  // «Esci» chiude il foglio senza salvare
  await page.click("button[data-act=persona-nuova]"); await aspetta(1);
  await page.click(".sheet input[name=nome]"); await page.locator(".sheet input[name=nome]").pressSequentially("Altro Da Perdere"); await aspetta(2);
  await page.goBack({ waitUntil:"commit" }); await domanda.waitFor();
  await domanda.locator("button[data-act=uscita-esci]").click(); await aspetta(0);
  await sync(page);
  check(!(await foglio()) && !DB.persone.some(x => x.nome === "Altro Da Perdere"), `indietro ${tema}: «Esci» chiude il foglio senza salvare`);
  // cancellando quello che si è scritto la voce di guardia si toglie
  await page.click("button[data-act=persona-nuova]"); await aspetta(1);
  await page.click(".sheet input[name=nome]"); await page.locator(".sheet input[name=nome]").pressSequentially("X"); await aspetta(2);
  await page.locator(".sheet input[name=nome]").press("Backspace"); await aspetta(1);
  // un foglio vuoto si chiude senza domande
  await indietro(0);
  check(!(await foglio()) && !(await domanda.count()) && nativa === 0, `indietro ${tema}: un foglio vuoto si chiude senza domande`);
  // il salvataggio che chiude il foglio toglie la voce
  if(tema === "light"){
    await page.click("button[data-act=persona-nuova]"); await aspetta(1);
    await page.fill(".sheet input[name=nome]", "Nome Indietro");
    await page.click(".sheet button.primary");
    await page.getByText("Nome Indietro nella tua lista").waitFor(); await aspetta(0);
    await persona.click(); await aspetta(1);
    await indietro(0);
    check(!(await foglio()) && await titolo() === "Persone", `indietro ${tema}: dopo «Salva» Indietro non riapre il foglio`);
  }
  // il Profilo: da Io e da una scheda
  await page.click("button[data-act=vista-io]");
  await page.click("button[data-act=vista-profilo]"); await aspetta(1);
  await indietro(0);
  check(await titolo() === "Ciao Stefano e Alessia", `indietro ${tema}: Indietro dal Profilo torna a Io`);
  await page.click("button[data-act=vista-profilo]"); await aspetta(1);
  await page.click("button[data-act=profilo-indietro]"); await aspetta(0);
  check(await titolo() === "Ciao Stefano e Alessia", `indietro ${tema}: «‹ Indietro» del Profilo toglie la voce`);
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await persona.click(); await aspetta(1);
  await page.click("button[data-act=vista-profilo]"); await aspetta(2);
  await indietro(1);
  check(await page.locator("#app h2", { hasText:"Primo Numero" }).count() === 1, `indietro ${tema}: dal Profilo aperto da una scheda si torna alla scheda`);
  await page.click("button[data-act=vista-profilo]"); await aspetta(2);
  await page.click("button[data-act=vista-gruppo]"); await aspetta(0);
  check(await titolo() === "Il mio gruppo", `indietro ${tema}: una scheda principale toglie tutte le voci`);
  // la scheda di un partner
  await page.locator("button[data-act=apri-scheda]").first().click(); await aspetta(1);
  check(await titolo() === "Scheda partner", `indietro ${tema}: la scheda partner aggiunge una voce`);
  await indietro(0);
  check(await titolo() === "Il mio gruppo", `indietro ${tema}: Indietro dalla scheda partner torna al Gruppo`);
  // l'Obiettivo aperto da Io è una sotto-pagina; dalla scheda «Obiettivo» no
  await page.click("button[data-act=vista-io]");
  const riga = page.locator("button[data-act=obiettivo-da-io]");
  if(await riga.count()){
    await riga.click(); await aspetta(1);
    check(await titolo() === "Il mio obiettivo", `indietro ${tema}: l'Obiettivo da Io aggiunge una voce`);
    await indietro(0);
    check(await titolo() === "Ciao Stefano e Alessia", `indietro ${tema}: Indietro dall'Obiettivo torna a Io`);
  }
  await page.click("button[data-act=vista-obiettivo]");
  check(await livello() === 0, `indietro ${tema}: la scheda «Obiettivo» non aggiunge voci`);
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  check(await page.evaluate(() => window.__voci) > 10 && await page.evaluate(() => window.__senzaTocco) === 0,
    `indietro ${tema}: ogni voce della cronologia è aggiunta subito dopo un tocco (${await page.evaluate(() => window.__voci)} voci)`);
  await page.screenshot({ path: S + `/e2e/78-indietro-${tema}.png` });
  check(!errori.length, `indietro ${tema}: nessun errore nella pagina`);
  await ctx.close();
}

// 79. Doppioni e «+ Contatto»: i nomi suggeriti mentre si scrive (Lista e Clienti, senza accenti, fino a 5) e l'avviso ambra
//     anche per il nome uguale in «+ Nome» (Lista, Clienti, Rubrica); gli omonimi si possono salvare lo stesso
for(const tema of ["light", "dark"]){
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  const sugg = page.locator(".sheet #suggerimenti-contatto li");
  const avviso = page.locator(".sheet .avviso-doppione");
  const conta = (nome, tipo) => DB.persone.filter(x => x.nome === nome).length;
  if(tema === "light"){
    // un nome con gli accenti nella Lista
    await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
    await page.click("button[data-act=persona-nuova]");
    await page.fill(".sheet input[name=nome]", "Agnès Càruso");
    await page.click(".sheet button.primary");
    await page.getByText("Agnès Càruso nella tua lista").waitFor();
    await page.click("button[data-act=vista-io]");
  }
  // «+ Contatto»: la frase di prima non c'è più; i suggerimenti compaiono solo scrivendo
  await page.click("button[data-act=contatto-rapido]");
  check(!(await page.locator(".sheet").innerText()).includes("scrivi il nome uguale") && await sugg.count() === 0,
    `contatto ${tema}: niente frase «scrivi il nome uguale», nessun suggerimento a campo vuoto`);
  await page.fill(".sheet input[name=nome]", "caruso");
  /* nel tema scuro c'è anche l'omonimo salvato nel tema chiaro: il primo è già contattato (in corso), l'altro in lista */
  const n1 = tema === "light" ? 1 : 2, testi = (await sugg.allInnerTexts()).map(x => x.replace(/\s+/g, " "));
  check(await sugg.count() === n1 && testi.some(x => x.includes(tema === "light" ? "Agnès Càruso · in lista" : "Agnès Càruso · in corso")),
    `contatto ${tema}: scrivendo il cognome senza accenti compare «Agnès Càruso · ${tema === "light" ? "in lista" : "in corso"}»`);
  await page.fill(".sheet input[name=nome]", "AGNES");
  check(await sugg.count() === n1, `contatto ${tema}: anche solo il nome, in maiuscolo e senza accenti`);
  await page.fill(".sheet input[name=nome]", "o");
  const quanti = await sugg.count();
  check(quanti === 5 && DB.persone.filter(x => /o/i.test(x.nome.normalize("NFD"))).length > 5, `contatto ${tema}: al massimo 5 suggerimenti (${quanti})`);
  await page.fill(".sheet input[name=nome]", "Ines");
  check((await sugg.allInnerTexts()).some(x => x.includes("Ines Condivisa")), `contatto ${tema}: suggerisce anche i nomi presi dalla rubrica`);
  // anche i clienti
  const cliente = DB.persone.find(x => x.esito === "cliente" && x.proprietario === "R");
  if(cliente){ await page.fill(".sheet input[name=nome]", cliente.nome.split(" ")[0]);
    check((await sugg.allInnerTexts()).some(x => x.replace(/\s+/g, " ").includes(cliente.nome + " · cliente")), `contatto ${tema}: suggerisce anche i Clienti, con «· cliente»`); }
  if(tema === "light"){
    // toccando un suggerimento il contatto si segna su quella persona
    await page.fill(".sheet input[name=nome]", "agnes car");
    await sync(page);
    const prima = DB.persone.length, ag = DB.persone.find(x => x.nome === "Agnès Càruso");
    const passi = () => (DB.passi || []).filter(x => x.persona_id === ag.id && x.tipo === "contatto").length, p0 = passi();
    await page.screenshot({ path: S + `/e2e/79-suggerimenti-${tema}.png` });
    await sugg.first().click();
    await page.getByText("Contatto con Agnès registrato").waitFor();
    await sync(page);
    check(!(await page.locator(".sheet").count()) && DB.persone.length === prima && passi() === p0 + 1,
      "contatto: dal suggerimento il contatto si segna su quella persona, nessun nome nuovo");
  } else {
    await page.fill(".sheet input[name=nome]", "car");
    await page.screenshot({ path: S + `/e2e/79-suggerimenti-${tema}.png` });
    await page.click(".sheet [data-act=chiudi]");
  }
  // «+ Nome»: il nome uguale (senza accenti e maiuscole) → avviso ambra con la scheda da aprire
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=lista]");
  await page.click("button[data-act=persona-nuova]");
  await page.fill(".sheet input[name=nome]", "agnes  CARUSO");
  check(await avviso.isHidden(), `nome ${tema}: mentre si scrive nessun avviso`);
  await page.locator(".sheet input[name=nome]").press("Tab");
  await avviso.locator("button[data-act=apri-doppione]").waitFor();
  check((await avviso.innerText()).includes("È già nella tua lista: Agnès Càruso"), `nome ${tema}: nome con accenti e maiuscole diversi → «È già nella tua lista: Agnès Càruso»`);
  await page.screenshot({ path: S + `/e2e/79-nome-doppio-${tema}.png` });
  if(tema === "light"){
    // cambiando il nome l'avviso sparisce
    await page.fill(".sheet input[name=nome]", "Agnese Caruso");
    await page.locator(".sheet input[name=nome]").press("Tab");
    check(await avviso.isHidden(), "nome: un nome diverso non dà l'avviso");
    // l'omonimo si salva lo stesso: il primo «Salva» mostra l'avviso, il secondo salva
    await page.fill(".sheet input[name=nome]", "Agnès Càruso");
    await page.click(".sheet button.primary");
    await avviso.locator("button[data-act=apri-doppione]").waitFor();
    check(await page.locator(".sheet").count() === 1, "nome: nome identico, al primo «Salva» l'avviso e il modulo resta aperto");
    await page.waitForTimeout(800);
    await page.click(".sheet button.primary");
    await page.getByText("Agnès Càruso nella tua lista").waitFor();
    await sync(page);
    check(conta("Agnès Càruso") === 2, "nome: l'omonimo si può salvare lo stesso");
    // nome e telefono uguali: un solo avviso
    await page.click("button[data-act=persona-nuova]");
    await page.fill(".sheet input[name=nome]", "Primo Numero");
    await page.fill(".sheet input[name=contatto]", "333 000 0010");
    await page.locator(".sheet input[name=contatto]").press("Tab");
    await avviso.locator("button[data-act=apri-doppione]").waitFor();
    const t = await avviso.innerText();
    check(await page.locator(".sheet .avviso-doppione:visible").count() === 1 && t.split("È già nella tua lista").length === 2 && t.includes("Primo Numero"),
      "nome: se coincidono nome e telefono, un solo avviso");
    // «Apri la sua scheda»
    await avviso.locator("button[data-act=apri-doppione]").click();
    await page.locator(".sheet").waitFor({ state:"detached" });
    check(await page.locator("#app h2", { hasText:"Primo Numero" }).count() === 1, "nome: «Apri la sua scheda» apre la scheda");
    await page.click("button[data-act=torna-lista]");
    // nei Clienti
    if(cliente){
      await page.click("button[data-sez=clienti]");
      await page.click("button[data-act=cliente-nuovo]");
      await page.fill(".sheet input[name=nome]", cliente.nome.toUpperCase());
      await page.locator(".sheet input[name=nome]").press("Tab");
      await avviso.locator("button[data-act=apri-doppione]").waitFor();
      check((await avviso.innerText()).includes(cliente.nome), "nome: anche in «+ Nome» dei Clienti");
      await page.click(".sheet [data-act=chiudi]");
      await page.click("button[data-sez=lista]");
    }
    // dalla Rubrica: un contatto con lo stesso nome (senza numero)
    await page.evaluate(() => { window.ContactsManager = function(){}; Object.defineProperty(navigator, "contacts", { configurable:true,
      value:{ select:async () => [{ name:["PRIMO NUMERO"], tel:[] }] } }); });
    await page.click("button[data-act=persona-nuova]");
    await page.click(".sheet button[data-act=rubrica]");
    await avviso.locator("button[data-act=apri-doppione]").waitFor();
    check((await avviso.innerText()).includes("Primo Numero"), "nome: anche con il nome preso dalla Rubrica");
    await page.click(".sheet [data-act=chiudi]");
    // dalla Rubrica, più contatti: il nome uguale è segnato nell'elenco
    await page.evaluate(() => { Object.defineProperty(navigator, "contacts", { configurable:true,
      value:{ select:async () => [{ name:["primo numero"], tel:[] }, { name:["Nome Mai Visto"], tel:["347 555 0199"] }] } }); });
    await page.click("button[data-act=persona-nuova]");
    await page.click(".sheet button[data-act=rubrica]");
    await page.locator(".sheet .rubrica-molti").waitFor();
    check(await page.locator(".sheet .rubrica-molti li.doppione").count() === 1
      && (await page.locator(".sheet .rubrica-molti li.doppione").innerText()).includes("È già nella tua lista: Primo Numero"),
      "nome: nell'elenco della Rubrica il nome uguale ha l'avviso");
    await page.click(".sheet [data-act=chiudi]");
  } else await page.click(".sheet [data-act=chiudi]");
  check(!errori.length, `doppioni ${tema}: nessun errore nella pagina`);
  await ctx.close();
}

// 80. Persone: le linguette in ordine Lista | Clienti | Target; all'inizio è aperta la Lista
for(const tema of ["light", "dark"]){
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]");
  const sez = page.locator(".sezioni-persone button");
  check(JSON.stringify(await sez.allInnerTexts()) === JSON.stringify(["Lista", "Clienti", "Target"]), `persone ${tema}: linguette Lista | Clienti | Target`);
  check(await page.getAttribute(".sezioni-persone button[data-sez=lista]", "aria-pressed") === "true" && await page.locator(".testa-sezione", { hasText:"La mia lista" }).count() === 1,
    `persone ${tema}: all'inizio è aperta la Lista`);
  await page.screenshot({ path: S + `/e2e/80-linguette-${tema}.png`, clip:{ x:0, y:0, width:360, height:260 } });
  await page.click("button[data-sez=target]");
  check(await page.getAttribute(".sezioni-persone button[data-sez=target]", "aria-pressed") === "true", `persone ${tema}: Target si apre dall'ultima linguetta`);
  check(!errori.length, `persone ${tema}: nessun errore nella pagina`);
  await ctx.close();
}

// 81. Il primo incontro con lo sponsor (e «Partenza con te» vista dallo sponsor): data nel futuro →
//     «fissato per» senza spunta; data di oggi o passata → ✓ «fatto [giorno mese]». Lo sblocco della fase non cambia.
//     «Da dove parti?» subito dopo il passo 1: «Passo 2 di 2» sopra il titolo.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  const MESI_T = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const it = d => `${Number(d.slice(8))} ${MESI_T[Number(d.slice(5, 7)) - 1]}`;
  DB.partners.push({ id:"ni81", nome:"Nina Incontro", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"b1".repeat(16), codice_invito:"NI81NI", codice_amway:"7981001",
    data_iscrizione:giorno(-2), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true });
  DB.partners.push({ id:"pu81", nome:"Pio Upline", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"c1".repeat(16), codice_invito:"PU81PU", codice_amway:"7981002",
    data_iscrizione:giorno(-300), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true, punto_upline:giorno(-2) });
  const ni = DB.partners.find(p => p.id === "ni81");
  for(const [n, tema] of [[2, "light"], [0, "dark"], [-3, "light"]]){
    ni.incontro_sponsor = giorno(n);
    const fatto = n <= 0, quando = fatto ? `fatto ${it(giorno(n))}` : "fissato per ";
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "b1".repeat(16)));
    await page.getByText("Ciao Nina").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    const pc = page.locator(".card.percorso-partenza"), r = pc.locator(".percorso-l li", { hasText:"Primo incontro con il tuo sponsor" });
    const testo = await r.innerText(), spuntata = await r.evaluate(e => e.classList.contains("fatto"));
    check(spuntata === fatto && testo.includes(quando) && (await r.locator("button[data-act=incontro-fissa]").count() === (fatto ? 0 : 1)),
      `incontro ${n > 0 ? "nel futuro" : n === 0 ? "di oggi" : "passato"}: ${fatto ? "✓ «" + quando + "»" : "niente spunta, «fissato per», «Cambia»"} (${testo.replace(/\s+/g, " ")})`);
    check((await pc.locator(".fase-titolo").innerText()).trim() === "Partenza con lo sponsor", `incontro ${n}: la fase resta «Partenza con lo sponsor» (mancano i 30 nomi)`);
    await pc.screenshot({ path: S + `/e2e/81-incontro-${n > 0 ? "futuro" : n === 0 ? "oggi" : "passato"}-${tema}.png` });
    await ctx.close();
    // lo sponsor, nella scheda di Nina: «Partenza con te»
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    await page.click("button[data-act=vista-gruppo]");
    await page.locator(".albero.struttura button[data-act=apri-scheda]", { hasText:"Nina Incontro" }).first().click();
    const ps = page.locator(".partenza-scheda li", { hasText:"Partenza con te" });
    await ps.waitFor();
    const t2 = (await ps.innerText()).replace(/\s+/g, " ");
    check(t2.includes(fatto ? `Incontro fatto ${it(giorno(n))}` : "Incontro fissato per ") && !(await ps.evaluate(e => e.classList.contains("fatto"))),
      `sponsor, incontro ${n}: «${fatto ? "Incontro fatto" : "Incontro fissato per"}», la spunta resta della fase (${t2})`);
    await ctx.close();
  }
  // con i 30 nomi la fase si sblocca come prima (anche con l'incontro nel futuro)
  DB.persone = (DB.persone || []).concat(Array.from({ length:30 }, (_, i) => ({ id:"ni81n" + i, proprietario:"ni81", nome:"Nome Nina " + (i + 1), fase:"lista", esito:null, creato_il:ora })));
  ni.incontro_sponsor = giorno(3);
  ({ ctx, page } = await apri({}, "#chiave=" + "b1".repeat(16)));
  await page.getByText("Ciao Nina").waitFor();
  check((await page.locator(".percorso-partenza .fase-titolo").innerText()).trim() === "Il primo ordine", "incontro fissato + 30 nomi: la fase si sblocca come prima");
  await ctx.close();
  // il punto con l'upline di un avviato (tolto il 12 novembre 2026): anche con un giorno salvato (passato o futuro) non si vede
  for(const n of [-2, 4]){
    DB.partners.find(p => p.id === "pu81").punto_upline = giorno(n);
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "c1".repeat(16)));
    await page.getByText("Ciao Pio").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    check(!(await page.locator(".card.per-iniziare").count()) && !/punto con la tua upline/i.test(await page.locator("#app").innerText())
      && !(await page.locator("[data-act=punto-fissa], [data-act=punto-fatto]").count()), `punto con l'upline ${n < 0 ? "passato" : "nel futuro"}: non c'è più (né «Per iniziare» né «La prossima cosa»)`);
    await ctx.close();
  }
  // lo sponsor, nella scheda di Pio: niente «Per iniziare» (ha il perché e non ha un gruppo), niente punto con la sua upline
  Object.assign(DB.partners.find(p => p.id === "pu81"), { punto_upline:giorno(-1), punto_upline_fatto:null });
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-gruppo]");
  check(!(await page.locator(".nuovi-partenza li", { hasText:"Pio Upline" }).count()), "sponsor: Pio (avviato senza gruppo) non è tra i nuovi in partenza");
  await page.locator(".albero.struttura button[data-act=apri-scheda]", { hasText:"Pio Upline" }).first().click();
  await page.locator("button[data-act=scheda-tab]").first().waitFor();
  await page.waitForTimeout(300);
  check(!(await page.locator(".partenza-scheda").count()) && !/punto con la sua upline/i.test(await page.locator("#app").innerText()),
    "sponsor, scheda di Pio: niente «Per iniziare» né punto con la sua upline");
  await ctx.close();
  // «Passo 2 di 2»: chi ha appena fatto il passo 1; chi è nell'app da tempo senza perché no
  for(const [id, nome, privacy, si, tema, k] of [["ob81", "Olga Passo", ora, true, "light", "9a"], ["ob82", "Otto Vecchio", "2026-01-01T00:00:00Z", false, "dark", "8b"]]){
    DB.partners.push({ id, nome, sponsor_id:"R", stato:"attivo", chiave:k.repeat(16), codice_invito:id.toUpperCase() + "XX", codice_amway:"79810" + id.slice(-2),
      privacy_accettata_il:privacy, confermato_il:ora, creato_il:ora, senzaObiettivo:true });
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + k.repeat(16)));
    await page.locator("h1", { hasText:"Da dove parti?" }).waitFor();
    const passo = page.locator(".passo-ingresso .eyebrow", { hasText:"Passo 2 di 2" });
    check(await passo.count() === (si ? 1 : 0) && (!si || await passo.evaluate(e => e.compareDocumentPosition(document.querySelector("h1")) & Node.DOCUMENT_POSITION_FOLLOWING)),
      `«Da dove parti?»: ${si ? "«Passo 2 di 2» sopra il titolo dopo il passo 1" : "niente «Passo 2 di 2» per chi è nell'app da tempo"}`);
    if(si) for(const t of ["light", "dark"]){ await page.emulateMedia({ colorScheme:t }); await page.screenshot({ path: S + `/e2e/81-passo2-${t}.png`, clip:{ x:0, y:0, width:360, height:300 } }); }
    await ctx.close();
  }
  check(!errori.length, "incontro: nessun errore nella pagina");
}

// 82. «Da fare oggi» (Seguimi): sotto il nome di ogni azione con una persona il motivo, calcolato quando si disegna la riga
//     (nelle azioni salvate c'è solo l'id). Contatto: solo l'azione, «Da contattare» o in agenda l'appuntamento
//     (e nella Lista «In lista dal … (N giorni)» per chi è ancora in lista senza agenda); Follow-up: il testo
//     della lista di oggi (in ritardo dal … · prossimo passo; in agenda il suo «per cosa»); Cliente: il motivo dei clienti da
//     sentire. Motivo cambiato: si vede quello di adesso; senza motivo solo il nome. A 360 px il motivo va a capo nella card.
{
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Rome" }), oggiG = fmt.format(new Date());
  const giorno = n => fmt.format(new Date(Date.now() + n * 864e5)), anno = oggiG.slice(0, 4);
  const MESI_T = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const it = d => `${Number(d.slice(8))} ${MESI_T[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) !== anno ? " " + d.slice(0, 4) : ""}`;
  const gg = d => Math.round((Date.parse(oggiG + "T00:00:00Z") - Date.parse(d + "T00:00:00Z")) / 864e5);
  const p82 = (id, nome, extra) => Object.assign({ id, proprietario:"R", nome, fase:"lista", esito:null, creato_il:`${anno}-01-05T10:00:00Z` }, extra);
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat([
    p82("c82a", "Nora Contattodalla Listadiprova", { fonte:"conoscenza" }),
    p82("c82b", "Ugo Giàcontattato", { fase:"contattato", creato_il:`${anno}-01-06T10:00:00Z` }),
    p82("c82c", "Ivo Senzafonte", { creato_il:`${anno}-01-07T10:00:00Z` }),
    p82("c82d", "Dora Inagenda", { creato_il:`${anno}-01-08T10:00:00Z`, prossima_data:giorno(1), prossima_come:"telefono", prossima_per:"contatto" }),
    p82("c82e", "Elio Nuovo", { creato_il:new Date().toISOString() }),
    p82("c82f", "Febo Ieri", { creato_il:giorno(-1) + "T10:00:00Z" }),
    p82("f82a", "Fede Ritardo", { fase:"piano", prossima_data:giorno(-2) }),
    p82("f82b", "Gino Agenda", { fase:"invitato", prossima_data:oggiG, prossima_ora:"18:30", prossima_come:"telefono", prossima_per:"piano" }),
    p82("f82c", "Lia Spostata", { fase:"followup", prossima_data:giorno(5) }),
    p82("k82a", "Bea Compleanno", { fase:"contattato", esito:"cliente", lasciati:[], compleanno:giorno(3).slice(5), creato_il:giorno(-60) + "T10:00:00Z" }),
    p82("k82b", "Carlo Tranquillo", { fase:"contattato", esito:"cliente", lasciati:[], creato_il:giorno(-60) + "T10:00:00Z" })]);
  const azioni82 = [["contatto", "c82a"], ["contatto", "c82b"], ["contatto", "c82c"], ["contatto", "c82d"], ["followup", "f82a"], ["followup", "f82b"], ["followup", "f82c"],
    ["cliente", "k82a"], ["cliente", "k82b"]].map(([tipo, id]) => ({ tipo, id })).concat([{ tipo:"formazione" }]);
  DB.seguimi = (DB.seguimi || []).filter(x => x.partner_id !== "R").concat([{ partner_id:"R", attivo:true, condividi:false }]);
  DB.seguimiGiorni = (DB.seguimiGiorni || []).filter(x => x.partner_id !== "R").concat([{ partner_id:"R", giorno:oggiG, azioni:azioni82, proposte:azioni82.length, fatte:0, per_tipo:{} }]);
  const prima82 = JSON.stringify(azioni82);
  for(const tema of ["light", "dark"]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema }, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    const dfo = page.locator(".da-fare-oggi"); await dfo.waitFor();
    const motivo = async id => { const li = dfo.locator(":scope > ul > li", { has:page.locator(`button[data-id="${id}"]`) });
      return (await li.locator(".motivo-oggi").count()) ? (await li.locator(".motivo-oggi").innerText()).trim() : null; };
    if(tema === "light"){
      check(await motivo("c82a") === "Da contattare", "contatto: solo l'azione, senza data né giorni in lista né come la conosci (" + await motivo("c82a") + ")");
      check(await motivo("c82c") === "Da contattare", "contatto senza «Come lo conosci?»: lo stesso testo");
      check(await motivo("c82d") === `Domani · ${it(giorno(1))} · telefono · contatto`, "contatto in agenda: solo l'appuntamento, non da quanto è in lista (" + await motivo("c82d") + ")");
      check(await motivo("c82b") === null, "contatto già fatto (non più «In lista»): solo il nome");
      check(await motivo("f82a") === `In ritardo dal ${it(giorno(-2))} · Follow-up`, "follow-up in ritardo: lo stesso testo della lista di oggi (" + await motivo("f82a") + ")");
      check(await motivo("f82b") === `Oggi · ${it(oggiG)} · 18:30 · telefono · piano`, "follow-up in agenda: il suo «per cosa» (" + await motivo("f82b") + ")");
      check(await motivo("f82c") === `${it(giorno(5))} · Chiusura`, "follow-up spostato: si vede la data di adesso (" + await motivo("f82c") + ")");
      check(/^Compleanno il \d+ \w+$/.test(await motivo("k82a") || ""), "cliente: il motivo dei clienti da sentire (" + await motivo("k82a") + ")");
      check(await motivo("k82b") === null, "cliente che non è più da sentire: solo il nome");
      check(await dfo.locator(":scope > ul button[data-act=apri-persona]", { hasText:"Lista" }).count() === 1
        && (await dfo.locator(":scope > ul button[data-act=apri-persona][data-id=c82a]").innerText()).trim() === "Nora Contattodalla Listadiprova",
        "il nome resta il pulsante, il motivo sta fuori");
      check(await dfo.locator("li", { hasText:"15 minuti" }).locator(".motivo-oggi").count() === 0, "formazione: niente motivo");
    }
    // a 360 px: il motivo resta nella card, la spunta resta al suo posto e della sua misura
    const geo = await page.evaluate(() => { const card = document.querySelector(".da-fare-oggi").getBoundingClientRect();
      return [...document.querySelectorAll(".da-fare-oggi > ul > li")].map(li => { const m = li.querySelector(".motivo-oggi"), s = li.querySelector(".spunta-oggi").getBoundingClientRect();
        const r = m ? m.getBoundingClientRect() : null;
        return { dentro:!r || (r.left >= card.left - 0.5 && r.right <= card.right + 0.5),
          spunta:Math.round(s.width) === 26 && Math.round(s.height) === 26 && Math.abs(s.left - li.getBoundingClientRect().left) < 1 }; }); });
    check(geo.every(x => x.dentro), `${tema}, 360 px: ogni motivo resta dentro la card`);
    check(geo.every(x => x.spunta), `${tema}, 360 px: la spunta non si sposta e non si stringe`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tema}, 360 px: niente scorrimento orizzontale`);
    /* le barre fisse (linguette in alto, pulsanti in basso) coprirebbero la card nello screenshot */
    await page.evaluate(() => document.querySelectorAll("body *").forEach(e => { const p = getComputedStyle(e).position;
      if((p === "fixed" || p === "sticky") && !e.closest(".da-fare-oggi")) e.style.visibility = "hidden"; }));
    await dfo.screenshot({ path: S + `/e2e/82-motivi-${tema}.png` });
    await new Promise(r => setTimeout(r, 400)); await sync(page);
    await ctx.close();
  }
  // nella Lista: chi è ancora «In lista» senza agenda mostra da quando (data e giorni); in agenda solo l'appuntamento
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await page.click("button[data-act=vista-persone]"); await page.click("button[data-filtro=tutti]");
  const sotto = async id => (await page.locator(`ul.persone button[data-act=apri-persona][data-id="${id}"] .grow > .small:last-child`).innerText()).trim();
  check(await sotto("c82a") === `In lista dal ${it(anno + "-01-05")} (${gg(anno + "-01-05")}\u00a0giorni)`, "Lista: «In lista dal … (N giorni)» (" + await sotto("c82a") + ")");
  check(await sotto("c82e") === "In lista da oggi", "Lista: scritto oggi, «In lista da oggi» (" + await sotto("c82e") + ")");
  check(await sotto("c82f") === `In lista dal ${it(giorno(-1))} (1\u00a0giorno)`, "Lista: scritto ieri, «(1 giorno)» (" + await sotto("c82f") + ")");
  check(await sotto("c82d") === `In lista · Domani · ${it(giorno(1))} · telefono · contatto`, "Lista: in agenda solo l'appuntamento, come prima (" + await sotto("c82d") + ")");
  check(/^Contattato · fermo da \d+ giorni$/.test(await sotto("c82b")), "Lista: chi ha già fatto un passo ha «fermo da», non da quando è in lista (" + await sotto("c82b") + ")");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Lista a 360 px: niente scorrimento orizzontale");
  await page.evaluate(() => document.querySelectorAll("body *").forEach(e => { const p = getComputedStyle(e).position;
    if(p === "fixed" || p === "sticky") e.style.visibility = "hidden"; }));
  for(const tema of ["light", "dark"]){ await page.emulateMedia({ colorScheme:tema });
    const l = page.locator("ul.persone").first(); await l.screenshot({ path: S + `/e2e/82-lista-${tema}.png` }); }
  await ctx.close();
  const g82 = DB.seguimiGiorni.find(x => x.partner_id === "R" && x.giorno === oggiG);
  check(JSON.stringify(g82.azioni) === prima82 && !JSON.stringify(g82).includes("motivo") && !JSON.stringify(g82).includes("Da contattare"),
    "nelle azioni salvate restano solo tipo e id: nessun motivo nel database");
  DB.persone = DB.persone.filter(x => !/^[cfk]82/.test(String(x.id)));
  DB.seguimiGiorni = DB.seguimiGiorni.filter(x => x.partner_id !== "R"); DB.seguimi = DB.seguimi.filter(x => x.partner_id !== "R");
  check(!errori.length, "motivi in «Da fare oggi»: nessun errore nella pagina");
}

// 83. Avviati (12 novembre 2026): Seguimi acceso da solo al primo ingresso, dopo «Da dove parti?», solo senza una riga in
//     «seguimi»; «condividi» spento. Chi l'ha spento resta spento; il nuovo nel percorso come prima (Seguimi alla festa).
//     Anteprima di Io di un avviato appena entrato a 360 px, chiaro e scuro.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  const MSG = "Ogni mattina trovi le azioni del giorno in «Il mio giorno». Lo togli dal Profilo.";
  const nuovo83 = (id, nome, k, extra) => DB.partners.push(Object.assign({ id, nome, sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:k.repeat(16),
    codice_invito:id.toUpperCase() + "XX", codice_amway:"7983" + id.slice(-3), data_iscrizione:giorno(-200), privacy_accettata_il:ora, confermato_il:ora,
    partenza_confermata_il:ora, creato_il:ora, conPercorso:true, senzaObiettivo:true }, extra || {}));
  nuovo83("as83", "Alba Senzagruppo", "a3");
  nuovo83("ag83", "Gilda Congruppo", "b3");
  DB.partners.push({ id:"ag83u", nome:"Ugo Gilda", sponsor_id:"ag83", stato:"gestito", gestore_id:"ag83", codice_invito:"AG83UU", codice_amway:"7983901",
    data_iscrizione:giorno(-500), creato_il:ora });
  nuovo83("sp83", "Spina Spento", "c3");
  nuovo83("nu83", "Nora Nuova", "d3", { data_iscrizione:giorno(-3) });
  nuovo83("vc83", "Vito Vecchio", "e3", { privacy_accettata_il:"2026-01-01T00:00:00Z" });
  DB.seguimi = (DB.seguimi || []).filter(x => !["as83", "ag83", "sp83", "nu83", "vc83"].includes(x.partner_id))
    .concat([{ partner_id:"sp83", attivo:false, condividi:false }]);
  const riga = id => JSON.stringify((DB.seguimi || []).filter(x => x.partner_id === id).map(x => ({ attivo:x.attivo, condividi:x.condividi })));
  const entra83 = async (k, tema) => {
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema || "light" }, "#chiave=" + k.repeat(16)));
    await perche(page);
  };
  // l'avviata senza gruppo, appena entrata
  await entra83("a3");
  await page.getByText("Ciao Alba").waitFor();
  check(await page.locator("#toast .toast", { hasText:MSG }).isVisible(), "avviata senza gruppo: dopo «Da dove parti?» il messaggio del Seguimi");
  check(await page.locator(".da-fare-oggi").count() === 1, "avviata senza gruppo: «Da fare oggi» in «Il mio giorno»");
  check(!(await page.locator(".card.per-iniziare").count()) && !/punto con la tua upline|nomi nella tua Lista/i.test(await page.locator("#app").innerText()),
    "avviata appena entrata: niente «Per iniziare», niente punto con l'upline, niente «Scrivi 30 nomi»");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "avviata appena entrata, 360 px: niente scroll orizzontale");
  await page.screenshot({ path: S + "/e2e/83-io-avviato-light.png", fullPage:true });
  await sync(page);
  check(riga("as83") === JSON.stringify([{ attivo:true, condividi:false }]), "nel database: Seguimi acceso, «condividi» spento");
  await page.click("button[data-act=vista-profilo]"); await page.locator(".guida-seguimi").waitFor();
  check(await page.locator("button[data-act=seguimi-attivo]").getAttribute("aria-checked") === "true"
    && await page.locator("button[data-act=seguimi-condividi]").getAttribute("aria-checked") === "false", "Profilo: Seguimi acceso (si toglie da qui), condividi spento");
  check(!errori.length, "avviata appena entrata: nessun errore nella pagina");
  await ctx.close();
  // la stessa Io in tema scuro (si rientra: il Seguimi resta acceso, nessun messaggio)
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:"dark" }, "#chiave=" + "a3".repeat(16)));
  await page.getByText("Ciao Alba").waitFor();
  check(await page.locator(".da-fare-oggi").count() === 1 && !(await page.locator("#toast .toast", { hasText:MSG }).count()), "rientrando: Seguimi acceso, il messaggio non torna");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "avviata, tema scuro a 360 px: niente scroll orizzontale");
  await page.screenshot({ path: S + "/e2e/83-io-avviato-dark.png", fullPage:true });
  await ctx.close();
  // l'avviata con un gruppo: Seguimi acceso e «Per iniziare · 1 di 2» (perché e mappa)
  await entra83("b3");
  await page.getByText("Ciao Gilda").waitFor();
  check(await page.locator("#toast .toast", { hasText:MSG }).isVisible() && await page.locator(".da-fare-oggi").count() === 1, "avviata con gruppo: Seguimi acceso e il messaggio");
  check((await page.locator(".card.per-iniziare .eyebrow").textContent()).trim() === "Per iniziare · 1 di 2"
    && await page.locator(".card.per-iniziare li", { hasText:"Importa la tua mappa" }).count() === 1, "avviata con gruppo: «Per iniziare · 1 di 2» con la mappa");
  await page.screenshot({ path: S + "/e2e/83-io-avviato-gruppo-light.png", fullPage:true });
  await sync(page); await ctx.close();
  check(riga("ag83") === JSON.stringify([{ attivo:true, condividi:false }]), "avviata con gruppo, nel database: Seguimi acceso, «condividi» spento");
  // l'avviata che l'aveva spento: resta spento
  await entra83("c3");
  await page.getByText("Ciao Spina").waitFor();
  check(await page.locator("#toast .toast", { hasText:"Obiettivo salvato" }).isVisible() && !(await page.locator("#toast .toast", { hasText:MSG }).count())
    && !(await page.locator(".da-fare-oggi").count()), "avviata che l'ha spento: niente Seguimi, solo «Obiettivo salvato»");
  await sync(page); await ctx.close();
  check(riga("sp83") === JSON.stringify([{ attivo:false, condividi:false }]), "avviata che l'ha spento, nel database: resta spento");
  // il nuovo nel percorso: come prima, niente Seguimi (si accende alla festa)
  await entra83("d3");
  await page.getByText("Ciao Nora").waitFor();
  check(await page.locator(".card.percorso-partenza").isVisible() && !(await page.locator(".da-fare-oggi").count())
    && !(await page.locator("#toast .toast", { hasText:MSG }).count()), "nuovo nel percorso: il percorso di partenza, niente Seguimi");
  await sync(page); await ctx.close();
  check(riga("nu83") === "[]", "nuovo nel percorso, nel database: nessuna riga del Seguimi");
  // chi è nell'app da tempo e scrive il perché solo ora: non è il primo ingresso, niente Seguimi
  await entra83("e3");
  await page.getByText("Ciao Vito").waitFor();
  check(!(await page.locator(".da-fare-oggi").count()) && !(await page.locator("#toast .toast", { hasText:MSG }).count()), "avviato nell'app da tempo senza perché: niente Seguimi");
  await sync(page); await ctx.close();
  check(riga("vc83") === "[]", "avviato nell'app da tempo, nel database: nessuna riga del Seguimi");
  check(!errori.length, "Seguimi degli avviati: nessun errore nella pagina");
  DB.seguimi = DB.seguimi.filter(x => !["as83", "ag83", "sp83", "nu83", "vc83"].includes(x.partner_id));
  DB.seguimiGiorni = (DB.seguimiGiorni || []).filter(x => !["as83", "ag83"].includes(x.partner_id));
  DB.obiettivi = DB.obiettivi.filter(o => !["as83", "ag83", "sp83", "nu83", "vc83"].includes(o.partner_id));
  DB.partners = DB.partners.filter(p => !["as83", "ag83", "ag83u", "sp83", "nu83", "vc83"].includes(p.id));
}

// 84. Versione semplificata per chi inizia (12 novembre 2026): UNA regola (versioneSemplice) usata da tutte le pagine.
//     Attiva con il percorso di partenza attivo, nei primi 30 giorni dal primo ingresso e con «Mostra tutta l'app» spento;
//     admin, avviati, partenza completata e chi è oltre i 30 giorni vedono tutto. Si nasconde e basta.
//     Punto 1, Io: restano percorso, «La prossima cosa», la lista di oggi e la serie; niente Verifica, niente Storico in
//     «Il mio mese», niente promemoria dell'import.
//     Punto 2, Obiettivo: restano l'obiettivo, la riga della tappa che vale la cifra e «La prossima tappa»; il percorso
//     fino a Diamante e «Come arrivarci» dietro «Vedi tutto il percorso». Persone non cambia.
//     Punto 3, Gruppo: restano «Invita» e «Qui vedrai le persone che inviterai.»; con almeno un partner sotto (nella mappa,
//     in attesa o un suo nuovo in partenza) il Gruppo si vede intero.
//     Punto 4, Profilo e uscita: l'interruttore «Mostra tutta l'app» (preferenza del telefono) solo per chi ha dichiarato
//     almeno il 3% (anche Path to Bronze); dopo i 30 giorni, una volta sola, «Da oggi vedi tutta l'app.». La festa: sez. 61.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  const quando = n => new Date(Date.now() + n * 864e5).toISOString();
  const ID84 = ["in84", "ig84", "ig84u", "tr84", "co84", "av84", "pc84", "ia84", "ia84a", "pb84"];
  const p84 = (id, nome, k, extra) => DB.partners.push(Object.assign({ id, nome, sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:k.repeat(16),
    codice_invito:id.toUpperCase() + "XX", codice_amway:"79840" + (ID84.indexOf(id) + 10), data_iscrizione:giorno(-3), privacy_accettata_il:ora,
    confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true }, extra || {}));
  p84("in84", "Ivo Inizio", "a4");                                                      // nuovo, «Inizio»
  p84("ig84", "Ida Gruppo", "b4");                                                      // nuovo con un partner sotto e la mappa importata 8 giorni fa
  DB.partners.push({ id:"ig84u", nome:"Ugo Ida", sponsor_id:"ig84", stato:"gestito", gestore_id:"ig84", codice_invito:"IG84UU", codice_amway:"7984901",
    data_iscrizione:giorno(-500), creato_il:ora });
  mappa("ig84", 60, 160, { visto_da:"ig84", dati_al:quando(-8) });
  mappa("ig84u", 100, 100, { visto_da:"ig84", dati_al:quando(-8) });
  p84("tr84", "Teo Trenta", "c4", { data_iscrizione:giorno(-40), privacy_accettata_il:quando(-35), creato_il:quando(-35) });   // percorso non finito, 35 giorni
  p84("co84", "Cora Completa", "d4", { data_iscrizione:giorno(-10), privacy_accettata_il:quando(-5), partenza_completata_il:quando(-1) });
  p84("av84", "Alvise Avviato", "e4", { data_iscrizione:giorno(-200) });
  p84("ia84", "Iris Attesa", "f4");
  p84("pc84", "Pia Tre", "1a", { percentuale_iniziale:3 });                              // nuovo che ha dichiarato il 3%
  p84("pb84", "Bruno Path", "1b", { qualifica_iniziale:"path_to_bronze" });               // nuovo che ha dichiarato Path to Bronze                                                     // nuovo: chi ha invitato è entrato, in attesa della mappa
  p84("ia84a", "Aldo Iris", "g4", { sponsor_id:"ia84", invitato_da:"ia84", confermato_il:null, partenza_completata_il:quando(-1), conPercorso:false });
  const entra84 = async (k, nome, opz) => {
    ({ ctx, page } = await apri(Object.assign({ viewport:{ width:360, height:780 } }, opz || {}), "#chiave=" + k.repeat(16)));
    await page.getByText("Ciao " + nome).waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  };
  /* anteprima a pagina intera: i pulsanti fissi in basso vanno in fondo alla pagina, così non coprono niente */
  const foto84 = async nome => { await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll(".azioni").forEach(e => e.style.position = "static"); });
    await page.screenshot({ path: S + `/e2e/84-${nome}.png`, fullPage:true });
    await page.evaluate(() => document.querySelectorAll(".azioni").forEach(e => e.style.position = "")); };
  const ioSemplice = async chi => {
    check(!(await page.locator(".sezioni-io").count()) && !(await page.locator("button[data-act=sez-io][data-sez=guida]").count()), chi + ": niente linguetta Verifica");
    check(await page.locator(".card.percorso-partenza").isVisible(), chi + ": il riquadro del percorso di partenza");
    check(await page.locator(".card .eyebrow", { hasText:"La prossima cosa" }).count() === 1, chi + ": «La prossima cosa»");
    check(await page.locator(".card.serie").isVisible(), chi + ": la serie");
    check(!(await page.locator(".promemoria-import").count()), chi + ": niente promemoria dell'import");
    await apriMese(page);
    check(await page.locator(".mio-mese .blocco-numeri").isVisible() && !(await page.locator("button[data-act=storico]").count()), chi + ": «Il mio mese» senza Storico");
  };
  const ioIntera = async (chi, percorso) => {
    check(await page.locator("button[data-act=sez-io][data-sez=guida]").isVisible(), chi + ": la linguetta Verifica c'è");
    await apriMese(page);
    check(await page.locator("button[data-act=storico]").isVisible(), chi + ": «Il mio mese» con lo Storico");
    if(percorso != null) check(await page.locator(".card.percorso-partenza").count() === (percorso ? 1 : 0), chi + (percorso ? ": il percorso resta in cima" : ": niente percorso"));
  };
  const DIAMANTE = "Il tuo percorso fino a Diamante";
  const obiettivoSemplice = async (chi, foto) => {
    await page.click("button[data-act=vista-obiettivo]"); await page.locator(".card.visione").waitFor();
    check(await page.locator(".card.tappa-cifra", { hasText:"La tappa che vale la tua cifra" }).isVisible()
      && await page.locator(".card.tappa-cifra .nota").isVisible(), chi + ", Obiettivo: la riga della tappa che vale la cifra, con la nota delle cifre");
    const pt = page.locator(".card.prossima-tappa");
    check(await pt.isVisible() && (await pt.locator("h2").innerText()).trim() === "Primo ordine" && await pt.locator(".req li").count() >= 1,
      chi + ", Obiettivo: «La prossima tappa» con i requisiti (" + (await pt.locator("h2").count() ? await pt.locator("h2").innerText() : "–") + ")");
    check(!(await page.getByText(DIAMANTE).count()) && !(await page.locator("details.consigli").count()), chi + ", Obiettivo: percorso fino a Diamante e «Come arrivarci» non in vista");
    const vt = page.locator("button[data-act=percorso-tutto]");
    check(await vt.getAttribute("aria-expanded") === "false" && (await vt.innerText()).includes("Vedi tutto il percorso"), chi + ", Obiettivo: «Vedi tutto il percorso» chiuso");
    if(foto) await foto84(foto);
    await vt.click();
    check(await page.getByText(DIAMANTE).isVisible() && await page.locator("details.consigli").count() === 1
      && await vt.getAttribute("aria-expanded") === "true", chi + ", Obiettivo: «Vedi tutto il percorso» apre il percorso fino a Diamante e «Come arrivarci»");
    await vt.click();
    check(!(await page.getByText(DIAMANTE).count()), chi + ", Obiettivo: si richiude");
    await page.click("button[data-act=vista-persone]"); await page.locator("button[data-act=sez-persone][data-sez=target]").waitFor();
    check(await page.locator("button[data-act=sez-persone]").count() === 3, chi + ", Persone: Lista, Clienti e Target come per tutti");
    await page.click("button[data-act=vista-io]");
  };
  const obiettivoIntero = async chi => {
    await page.click("button[data-act=vista-obiettivo]"); await page.locator(".card.visione").waitFor();
    check(await page.getByText(DIAMANTE).isVisible() && !(await page.locator("button[data-act=percorso-tutto]").count())
      && !(await page.locator(".card.prossima-tappa").count()), chi + ", Obiettivo: tutto il percorso in vista, come prima");
    await page.click("button[data-act=vista-io]");
  };
  const FRASE = "Qui vedrai le persone che inviterai.";
  const gruppoSemplice84 = async (chi, foto) => {
    await page.click("button[data-act=vista-gruppo]"); await page.locator(".card.invita").waitFor();
    check(await page.locator(".card.gruppo-semplice", { hasText:FRASE }).isVisible(), chi + ", Gruppo: la frase «" + FRASE + "»");
    check(!(await page.locator(".albero.struttura").count()) && !(await page.locator(".card .eyebrow", { hasText:"Preferiti" }).count())
      && !(await page.locator(".card.in-attesa, .nuovi-partenza").count()) && !(await page.getByText("Storico del gruppo").count())
      && !(await page.locator(".mappa-gruppo").count()), chi + ", Gruppo: niente struttura, preferiti, in attesa, storico del gruppo");
    check(await page.locator(".card.invita").count() === 1, chi + ", Gruppo: «Invita» c'è");
    if(foto) await foto84(foto);
    await page.click("button[data-act=vista-io]");
  };
  const gruppoIntero = async (chi, cosa) => {
    await page.click("button[data-act=vista-gruppo]"); await page.locator(".card.invita").waitFor();
    check(!(await page.locator(".card.gruppo-semplice").count()) && await page.locator(".card .eyebrow", { hasText:"Preferiti" }).count() === 1
      && await page.locator(".mappa-gruppo").count() === 1 && (!cosa || await page.locator(cosa).count() > 0), chi + ", Gruppo intero, come prima");
    await page.click("button[data-act=vista-io]");
  };
  const AVVISO = "Da oggi vedi tutta l'app.";
  const avviso = () => page.locator("#toast .toast", { hasText:AVVISO }).count();
  const profilo84 = async () => { await page.click("button[data-act=vista-profilo]"); await page.locator(".card.voci-profilo").waitFor(); };
  const senzaInterruttore = async chi => { await profilo84();
    check(!(await page.locator(".card.tutta-app, button[data-act=tutta-app]").count()), chi + ", Profilo: niente interruttore «Mostra tutta l'app»");
    await page.click("button[data-act=profilo-indietro]"); };
  // il nuovo con «Inizio»: Io semplificata, a 360 px in chiaro e scuro
  for(const tema of ["light", "dark"]){
    await entra84("a4", "Ivo", { colorScheme:tema });
    await ioSemplice("nuovo «Inizio» (" + tema + ")");
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Io semplificata a 360 px (${tema}): niente scroll orizzontale`);
    await foto84(`io-semplice-${tema}`);
    await obiettivoSemplice("nuovo «Inizio» (" + tema + ")", `obiettivo-semplice-${tema}`);
    await gruppoSemplice84("nuovo «Inizio» (" + tema + ")", `gruppo-semplice-${tema}`);
    if(tema === "light"){ check(!(await avviso()), "nuovo «Inizio» nei 30 giorni: nessun avviso"); await senzaInterruttore("nuovo «Inizio»"); }
    await ctx.close();
  }
  // il nuovo con un partner sotto: Io resta semplificata (anche senza il promemoria dell'import, che altrimenti vedrebbe)
  await entra84("b4", "Ida");
  await ioSemplice("nuovo con un partner sotto");
  await gruppoIntero("nuovo con un partner nella mappa", ".albero.struttura li:has-text('Ugo Ida')");
  await ctx.close();
  await entra84("f4", "Iris");
  await gruppoIntero("nuovo con un invitato in attesa della mappa", ".card.in-attesa");
  await ctx.close();
  // il nuovo che ha dichiarato il 3%: l'interruttore c'è, spento; acceso → tutta l'app (anche ricaricando); spento → di nuovo semplice
  for(const tema of ["light", "dark"]){
    await entra84("1a", "Pia", { colorScheme:tema });
    await profilo84();
    const sw = page.locator(".card.tutta-app button[data-act=tutta-app]");
    check(await sw.isVisible() && await sw.getAttribute("aria-checked") === "false" && (await sw.innerText()).includes("Mostra tutta l'app"),
      `nuovo con il 3% (${tema}), Profilo: l'interruttore «Mostra tutta l'app», spento`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Profilo a 360 px (${tema}): niente scroll orizzontale`);
    await foto84(`profilo-semplice-${tema}`);
    await ctx.close();
  }
  await entra84("1a", "Pia");
  await ioSemplice("nuovo con il 3%, interruttore spento");
  await profilo84();
  await page.click("button[data-act=tutta-app]");
  check(await page.locator("button[data-act=tutta-app]").getAttribute("aria-checked") === "true", "nuovo con il 3%: l'interruttore si accende");
  await page.click("button[data-act=profilo-indietro]");
  await ioIntera("nuovo con il 3%, interruttore acceso", true);
  await obiettivoIntero("nuovo con il 3%, interruttore acceso");
  await gruppoIntero("nuovo con il 3%, interruttore acceso");
  await page.goto("about:blank"); await page.goto(BASE + "#chiave=" + "1a".repeat(16)); await page.getByText("Ciao Pia").waitFor();   // stesso telefono, si riapre
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  check(await page.locator("button[data-act=sez-io][data-sez=guida]").isVisible(), "nuovo con il 3%: ricaricando l'interruttore resta acceso (preferenza del telefono)");
  // dalla Verifica al Profilo, si spegne, Indietro: si torna sulla Verifica, che si apre comunque (con le linguette per uscirne)
  await page.click("button[data-act=sez-io][data-sez=guida]"); await page.getByText("Stabilità della tua rete").waitFor();
  await profilo84();
  await page.click("button[data-act=tutta-app]");
  check(await page.locator("button[data-act=tutta-app]").getAttribute("aria-checked") === "false", "nuovo con il 3%: l'interruttore si spegne");
  await page.click("button[data-act=profilo-indietro]");
  check(await page.getByText("Stabilità della tua rete").isVisible() && await page.locator("button[data-act=sez-io][data-sez=giorno]").isVisible(),
    "pagina nascosta raggiunta con Indietro: la Verifica si apre comunque, con «Il mio giorno» per uscirne");
  await page.click("button[data-act=sez-io][data-sez=giorno]");
  await ioSemplice("nuovo con il 3%, interruttore di nuovo spento");
  await sync(page);
  const pia = DB.partners.find(p => p.id === "pc84");
  check(!Object.keys(pia).some(k => /tutta/i.test(k)) && !JSON.stringify(DB.seguimi || []).includes("pc84"), "interruttore: niente nel database");
  await ctx.close();
  await entra84("1b", "Bruno"); await profilo84();
  check(await page.locator("button[data-act=tutta-app]").isVisible(), "nuovo con Path to Bronze: l'interruttore c'è");
  await ctx.close();
  // dopo 30 giorni con il percorso non finito: l'app tutta, il percorso ancora in cima
  await entra84("c4", "Teo");
  await page.locator("#toast .toast").first().waitFor({ timeout:3000 }).catch(() => {});
  check(await avviso() === 1, "nuovo dopo 30 giorni: l'avviso «" + AVVISO + "»");
  await senzaInterruttore("nuovo dopo 30 giorni");
  await ioIntera("nuovo dopo 30 giorni", true);
  await obiettivoIntero("nuovo dopo 30 giorni");
  await gruppoIntero("nuovo dopo 30 giorni");
  const primaCard = await page.evaluate(() => [...document.querySelectorAll("#app .card")].find(c => !c.classList.contains("domanda-notifiche")).className);
  check(/percorso-partenza/.test(primaCard), "nuovo dopo 30 giorni: il percorso è il primo riquadro di Io (" + primaCard + ")");
  await page.goto("about:blank"); await page.goto(BASE + "#chiave=" + "c4".repeat(16)); await page.getByText("Ciao Teo").waitFor(); await page.waitForTimeout(500);
  check(!(await avviso()), "nuovo dopo 30 giorni: l'avviso si vede una volta sola");
  await ctx.close();
  // partenza completata, avviato, admin: tutto come prima
  for(const [k, nome, chi] of [["d4", "Cora", "partenza completata"], ["e4", "Alvise", "avviato"]]){
    await entra84(k, nome); await page.waitForTimeout(300);
    check(!(await avviso()), chi + ": nessun avviso");
    await ioIntera(chi, false); await obiettivoIntero(chi); await gruppoIntero(chi); await senzaInterruttore(chi);
    await ctx.close();
  }
  const R84 = DB.partners.find(p => p.id === "R");
  if(!R84.privacy_accettata_il) R84.privacy_accettata_il = ora;   // solo se la sezione gira da sola
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "a".repeat(32)));
  await page.locator("button[data-act=sez-io]").first().waitFor();
  if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  await ioIntera("admin");
  await page.click("button[data-act=vista-obiettivo]"); await page.locator(".card.visione, button[data-act=obiettivo-modifica]").first().waitFor();
  check(!(await page.locator("button[data-act=percorso-tutto]").count()) && !(await page.locator(".card.prossima-tappa").count()), "admin, Obiettivo: come prima");
  await page.click("button[data-act=vista-io]"); await gruppoIntero("admin", ".albero.struttura");
  check(!(await avviso()), "admin: nessun avviso"); await senzaInterruttore("admin");
  await ctx.close();
  check(!errori.length, "versione semplificata (Io, Obiettivo, Gruppo, Profilo): nessun errore nella pagina");
  DB.numeri = DB.numeri.filter(x => !["ig84", "ig84u"].includes(x.partner_id));
  DB.obiettivi = DB.obiettivi.filter(o => !ID84.includes(o.partner_id));
  DB.partners = DB.partners.filter(p => !ID84.includes(p.id));
}

// 85. «La prossima cosa» dal percorso (13 novembre 2026): sempre quello che manca nella fase in corso, con i dati del percorso.
//     Fase 2 con l'incontro fissato: i nomi (12 di 30, entro…) → Lista; fase 3: il primo ordine (VP e giorni) → Ordini;
//     ordine confermato in attesa della mappa: si va avanti (sezione 87); fase 4: il primo piano → + Piano, poi il primo cliente →
//     Clienti. Gli avviati non hanno niente dal percorso.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  DB.partners.push({ id:"pn85", nome:"Pina Prossima", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"2a".repeat(16), codice_invito:"PN85XX",
    codice_amway:"7985001", data_iscrizione:giorno(-3), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora,
    conPercorso:true, incontro_sponsor:giorno(1) });
  DB.partners.push({ id:"av85", nome:"Aldo Avviato", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"2b".repeat(16), codice_invito:"AV85XX",
    codice_amway:"7985002", data_iscrizione:giorno(-200), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true });
  const nomi85 = n => { DB.persone = (DB.persone || []).filter(x => x.proprietario !== "pn85")
    .concat(Array.from({ length:n }, (_, i) => ({ id:"pn85n" + i, proprietario:"pn85", nome:"Nome Pina " + (i + 1), fase:"lista", esito:null, creato_il:ora }))); };
  const entra85 = async (k, nome, opz) => {
    ({ ctx, page } = await apri(Object.assign({ viewport:{ width:360, height:780 } }, opz || {}), "#chiave=" + k.repeat(16)));
    await page.getByText("Ciao " + nome).waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  };
  const card = () => page.locator(".card.oggi-lista");
  const dalPercorso = async () => await card().locator(".small", { hasText:"dal tuo percorso" }).count() === 1;
  const titolo = async () => (await card().locator(".prossima-titolo").innerText()).trim();
  const motivo = async () => (await card().locator(".prossima-titolo + p.small").innerText()).replace(/\s+/g, " ").trim();
  const tocca = () => card().locator(".prossima-azioni button.primary").click();
  // fase 2, incontro fissato, 12 nomi su 30
  nomi85(12);
  for(const tema of ["light", "dark"]){
    await entra85("2a", "Pina", { colorScheme:tema });
    check(await dalPercorso() && await titolo() === "Scrivi i prossimi nomi nella Lista" && /^12 di 30 nomi · entro \S+/.test(await motivo()),
      `fase 2 (${tema}): «Scrivi i prossimi nomi nella Lista · 12 di 30 nomi · entro …» (${await motivo()})`);
    await card().screenshot({ path: S + `/e2e/85-prossima-nomi-${tema}.png` });
    if(tema === "light"){ await tocca();
      check(await page.locator("button[data-act=sez-persone][data-sez=lista][aria-pressed=true]").isVisible(), "fase 2: il pulsante apre la Lista"); }
    await ctx.close();
  }
  // fase 3: il primo ordine
  nomi85(30);
  await entra85("2a", "Pina");
  check(await titolo() === "Il tuo primo ordine" && await motivo() === "0 di 50 VP · restano 27 giorni", "fase 3: «Il tuo primo ordine · 0 di 50 VP · restano 27 giorni» (" + await motivo() + ")");
  await card().screenshot({ path: S + "/e2e/85-prossima-ordine-light.png" });
  await tocca();
  check(await page.locator(".sheet").isVisible() && await page.locator(".sheet", { hasText:"bozz" }).count() === 1, "fase 3: il pulsante apre gli Ordini");
  await ctx.close();
  // ordine confermato, in attesa della mappa: niente dal percorso
  DB.ordiniMiei = (DB.ordiniMiei || []).concat([{ id:"pn85b", proprietario:"pn85", stato:"confermato", data:giorno(0), vp:60, attivita_id:null, nome:null,
    persona_id:null, ordine_cliente_id:null, creato_il:ora, confermato_il:ora }]);
  await entra85("2a", "Pina");
  check(await page.locator(".percorso-partenza .ordine-attesa").isVisible() && await titolo() === "Il tuo primo piano",
    "ordine in attesa della mappa: il ritmo non si ferma, «La prossima cosa» è il primo piano (sezione 87)");
  await ctx.close();
  // fase 4: la mappa mostra l'ordine → il primo piano
  mappa("pn85", 60);
  await entra85("2a", "Pina");
  check(await titolo() === "Il tuo primo piano" && await motivo() === "I due binari · mancano il primo piano e il primo cliente", "fase 4: il primo piano, mancano tutti e due (" + await motivo() + ")");
  await tocca();
  check(await page.locator(".sheet").isVisible() && await page.locator(".sheet", { hasText:"con chi?" }).count() === 1, "fase 4: il pulsante apre «+ Piano»");
  await ctx.close();
  // con il primo piano: il primo cliente
  DB.activities.push({ id:"pn85p", partner_id:"pn85", tipo:"piano", quantita:1, data:giorno(0), inserito_il:ora });
  await entra85("2a", "Pina");
  check(await titolo() === "Il tuo primo cliente" && await motivo() === "I due binari · manca solo il primo cliente", "fase 4: con il piano, il primo cliente (" + await motivo() + ")");
  await tocca();
  check(await page.locator("button[data-act=sez-persone][data-sez=clienti][aria-pressed=true]").isVisible(), "fase 4: il pulsante apre i Clienti");
  await ctx.close();
  // con il cliente ma senza piano: solo il primo piano
  DB.activities = DB.activities.filter(a => a.id !== "pn85p");
  DB.activities.push({ id:"pn85c", partner_id:"pn85", tipo:"cliente", quantita:1, data:giorno(0), inserito_il:ora });
  await entra85("2a", "Pina");
  check(await titolo() === "Il tuo primo piano" && await motivo() === "I due binari · manca solo il primo piano", "fase 4: con il cliente, manca solo il piano (" + await motivo() + ")");
  await ctx.close();
  // l'avviato: niente dal percorso
  await entra85("2b", "Aldo");
  check(!(await page.locator(".card.oggi-lista .small", { hasText:"dal tuo percorso" }).count()), "avviato: niente «La prossima cosa» dal percorso");
  await ctx.close();
  check(!errori.length, "«La prossima cosa» dal percorso: nessun errore nella pagina");
  DB.persone = DB.persone.filter(x => x.proprietario !== "pn85");
  DB.activities = DB.activities.filter(a => a.partner_id !== "pn85");
  DB.ordiniMiei = DB.ordiniMiei.filter(x => x.proprietario !== "pn85");
  DB.numeri = DB.numeri.filter(x => x.partner_id !== "pn85");
  DB.obiettivi = (DB.obiettivi || []).filter(o => !["pn85", "av85"].includes(o.partner_id));
  DB.partners = DB.partners.filter(p => !["pn85", "av85"].includes(p.id));
}

// 86. La domanda sulla condivisione (13 novembre 2026): quando il Seguimi si accende, una volta sola in cima a Io.
//     Nuovo dopo la festa («Vai al cruscotto») → «Sì, condividi»; avviato al primo ingresso → «Non ora» (non torna, anche
//     ricaricando). Non a chi condivide già, a chi ha il Seguimi spento, né nella versione semplificata. Nell'informativa la
//     riga sulla condivisione. Anteprima della card a 360 px, chiaro e scuro.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  const nuovo86 = (id, nome, k, extra) => DB.partners.push(Object.assign({ id, nome, sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:k.repeat(16),
    codice_invito:id.toUpperCase() + "XX", codice_amway:"7986" + id.slice(-3), data_iscrizione:giorno(-200), privacy_accettata_il:ora, confermato_il:ora,
    partenza_confermata_il:ora, creato_il:ora, conPercorso:true }, extra || {}));
  // i nuovi con le fasi 1-4 fatte: la festa
  const pronto86 = id => { DB.persone = (DB.persone || []).concat(Array.from({ length:30 }, (_, i) => ({ id:id + "n" + i, proprietario:id, nome:"Nome " + (i + 1),
      fase:"lista", esito:null, creato_il:ora })));
    mappa(id, 60);
    DB.activities.push({ id:id + "p", partner_id:id, tipo:"piano", quantita:1, data:giorno(0), inserito_il:ora },
      { id:id + "c", partner_id:id, tipo:"cliente", quantita:1, data:giorno(0), inserito_il:ora }); };
  nuovo86("fl86", "Flora Festa", "a8", { data_iscrizione:giorno(-5), incontro_sponsor:giorno(-1) }); pronto86("fl86");
  nuovo86("fd86", "Fido Festa", "b8", { data_iscrizione:giorno(-5), incontro_sponsor:giorno(-1) }); pronto86("fd86");
  nuovo86("av86", "Ada Avviata", "c8", { senzaObiettivo:true });
  nuovo86("cd86", "Cico Condivide", "d8");
  nuovo86("sp86", "Spino Spento", "e8");
  nuovo86("ns86", "Nina Semplice", "f8", { data_iscrizione:giorno(-3), incontro_sponsor:giorno(1) });
  nuovo86("pr86", "Pio Profilo", "7c");
  DB.seguimi = (DB.seguimi || []).filter(x => !x.partner_id.endsWith("86")).concat([
    { partner_id:"cd86", attivo:true, condividi:true }, { partner_id:"sp86", attivo:false, condividi:false },
    { partner_id:"ns86", attivo:true, condividi:false }, { partner_id:"pr86", attivo:true, condividi:false }]);
  const riga = id => JSON.stringify((DB.seguimi || []).filter(x => x.partner_id === id).map(x => ({ attivo:x.attivo, condividi:x.condividi })));
  const entra86 = async (k, nome, tema) => {
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema || "light", deviceScaleFactor:2 }, "#chiave=" + k.repeat(16)));
    await page.getByText("Ciao " + nome).waitFor();
  };
  const card = () => page.locator(".card.domanda-condividi");
  const TESTO = "Vuoi che il tuo sponsor e la tua upline vedano come va il tuo Seguimi? Così possono aiutarti quando ti fermi. Vedono i numeri, mai i nomi.";
  // il nuovo: dopo la festa, «Vai al cruscotto» → la domanda in cima a Io (chiaro e scuro)
  for(const [k, nome, id, tema] of [["a8", "Flora", "fl86", "light"], ["b8", "Fido", "fd86", "dark"]]){
    await entra86(k, nome, tema);
    await page.locator(".festa").waitFor();
    check(!(await card().count()), `nuovo (${tema}): durante la festa niente domanda`);
    await page.click(".festa button[data-act=festa-fine]");
    await page.locator(".festa").waitFor({ state:"detached" });
    await card().waitFor();
    check((await card().locator("h3, p").allInnerTexts()).join(" ").replace(/\s+/g, " ").trim() === TESTO, `nuovo (${tema}): il testo della domanda`);
    const primo = await page.evaluate(() => { const c = document.querySelector("#app .card"); return c && c.classList.contains("domanda-condividi"); });
    check(primo, `nuovo (${tema}): la domanda è in cima a Io`);
    check(await card().locator("button").count() === 2 && (await card().locator("button.primary").innerText()).trim() === "Sì, condividi"
      && (await card().locator("button:not(.primary)").innerText()).trim() === "Non ora" && !(await card().locator("[role=switch], .toggle, input").count()),
      `nuovo (${tema}): «Sì, condividi» e «Non ora», nessun interruttore già acceso`);
    const misure = await card().locator("button").evaluateAll(l => l.map(b => { const r = b.getBoundingClientRect(), c = getComputedStyle(b);
      return { w:Math.round(r.width), h:Math.round(r.height), bordo:c.borderTopWidth, peso:c.fontWeight, colore:c.borderTopColor, fondo:c.backgroundColor }; }));
    check(Math.abs(misure[0].w - misure[1].w) <= 2 && misure[0].h === misure[1].h && misure[0].bordo === misure[1].bordo && misure[0].peso === misure[1].peso
      && misure[1].colore !== misure[1].fondo, `nuovo (${tema}): i due pulsanti hanno lo stesso peso (larghezza, altezza, bordo, carattere) e «Non ora» si vede`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `nuovo (${tema}), 360 px: niente scroll orizzontale`);
    await page.locator(".annuncio-festa").waitFor({ state:"detached" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: S + `/e2e/86-domanda-${tema}.png` });
    if(tema === "light"){
      await page.click(".domanda-condividi button[data-act=condividi-si]");
      await card().waitFor({ state:"detached" });
      await sync(page);
      check(riga("fl86") === JSON.stringify([{ attivo:true, condividi:true }]), "«Sì, condividi»: nel database «condividi» acceso");
      await page.click("button[data-act=vista-profilo]"); await page.locator(".guida-condividi").waitFor();
      check(await page.locator("button[data-act=seguimi-condividi]").getAttribute("aria-checked") === "true", "«Sì, condividi»: nel Profilo l'interruttore è acceso");
    }
    await ctx.close();
  }
  // da un altro telefono, con «condividi» acceso: niente domanda
  await entra86("a8", "Flora");
  check(!(await card().count()), "nuovo che ha condiviso, da un altro telefono: niente domanda");
  await ctx.close();
  // l'avviato al primo ingresso: Seguimi acceso da solo e la domanda; «Non ora» la toglie per sempre su questo telefono
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "c8".repeat(16)));
  await perche(page);
  await page.getByText("Ciao Ada").waitFor();
  await card().waitFor();
  check(await page.locator(".da-fare-oggi").count() === 1, "avviato al primo ingresso: Seguimi acceso e la domanda");
  await page.click(".domanda-condividi button[data-act=condividi-no]");
  await card().waitFor({ state:"detached" });
  await sync(page);
  check(riga("av86") === JSON.stringify([{ attivo:true, condividi:false }]), "«Non ora»: nel database «condividi» resta spento");
  // lo stesso telefono (la memoria del telefono resta), riaprendo l'app
  const stato86 = await ctx.storageState(); await ctx.close();
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, storageState:stato86 }, "#chiave=" + "c8".repeat(16)));
  await page.getByText("Ciao Ada").waitFor();
  check(await page.locator(".da-fare-oggi").count() === 1 && !(await card().count()), "«Non ora»: riaprendo l'app sullo stesso telefono la domanda non torna");
  await page.click("button[data-act=vista-profilo]"); await page.locator(".guida-condividi").waitFor();
  check(await page.locator("button[data-act=seguimi-condividi]").getAttribute("aria-checked") === "false", "«Non ora»: nel Profilo l'interruttore resta, spento");
  await ctx.close();
  // chi condivide già, chi ha il Seguimi spento, il nuovo nella versione semplificata: niente domanda
  for(const [k, nome, perche] of [["d8", "Cico", "condivide già"], ["e8", "Spino", "Seguimi spento"], ["f8", "Nina", "versione semplificata"]]){
    await entra86(k, nome);
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    check(!(await card().count()), `${perche}: niente domanda`);
    await ctx.close();
  }
  // una scelta dall'interruttore del Profilo vale come risposta: acceso e rispento, la domanda non torna
  await entra86("7c", "Pio");
  await card().waitFor();
  await page.click("button[data-act=vista-profilo]"); await page.locator(".guida-condividi").waitFor();
  await page.click("button[data-act=seguimi-condividi]");
  await page.locator("button[data-act=seguimi-condividi][aria-checked=true]").waitFor();
  await page.click("button[data-act=seguimi-condividi]");
  await page.locator("button[data-act=seguimi-condividi][aria-checked=false]").waitFor();
  await page.click("button[data-act=vista-io]");
  await page.getByText("Ciao Pio").waitFor();
  check(!(await card().count()), "scelta dal Profilo (acceso e poi spento): la domanda non torna");
  // l'informativa: la riga sulla condivisione
  await page.evaluate(() => { const b = document.createElement("button"); b.dataset.act = "privacy"; document.querySelector("#app").append(b); b.click(); });
  await page.locator(".sheet h2", { hasText:"Informativa privacy" }).waitFor();
  const priv = (await page.locator(".sheet").innerText()).replace(/\s+/g, " ");
  check(priv.includes("Se scegli di condividere. Se lo scegli tu, dal Profilo, il tuo sponsor e la tua upline vedono anche i numeri del Seguimi, i numeri che scrivi a mano (app CumLaude21, Training Day, Convention) e le tue abitudini. Mai i nomi. Lo spegni quando vuoi."),
    "informativa: la riga sulla condivisione");
  await ctx.close();
  check(!errori.length, "domanda sulla condivisione: nessun errore nella pagina");
  const tutti86 = ["fl86", "fd86", "av86", "cd86", "sp86", "ns86", "pr86"];
  DB.seguimi = DB.seguimi.filter(x => !tutti86.includes(x.partner_id));
  DB.seguimiGiorni = (DB.seguimiGiorni || []).filter(x => !tutti86.includes(x.partner_id));
  DB.persone = DB.persone.filter(x => !tutti86.includes(x.proprietario));
  DB.activities = DB.activities.filter(a => !tutti86.includes(a.partner_id));
  DB.numeri = DB.numeri.filter(x => !tutti86.includes(x.partner_id));
  DB.obiettivi = (DB.obiettivi || []).filter(o => !tutti86.includes(o.partner_id));
  DB.partners = DB.partners.filter(p => !tutti86.includes(p.id));
}

// 87. Il primo ordine non ferma il ritmo (13 novembre 2026): confermato ma non ancora nella mappa, la fase 3 resta non fatta
//     con «!» e la fase in corso è la 4 («I due binari»); «La prossima cosa» indica il primo piano o il primo cliente. Con i
//     due binari fatti manca solo la mappa: fase 3 e «Manca solo la mappa del primo ordine», senza pulsante, niente festa.
//     Lo sponsor in «I tuoi nuovi in partenza» e nella scheda vede la stessa fase e lo stesso «!». La festa arriva con la mappa.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  DB.partners.push({ id:"pn87", nome:"Olga Ordine", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"3c".repeat(16), codice_invito:"PN87XX",
    codice_amway:"7987001", data_iscrizione:giorno(-4), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora,
    conPercorso:true, incontro_sponsor:giorno(-1) });
  DB.persone = (DB.persone || []).concat(Array.from({ length:30 }, (_, i) => ({ id:"pn87n" + i, proprietario:"pn87", nome:"Nome Olga " + (i + 1), fase:"lista",
    esito:null, creato_il:ora })));
  DB.ordiniMiei = (DB.ordiniMiei || []).concat([{ id:"pn87o", proprietario:"pn87", stato:"confermato", data:giorno(0), vp:60, attivita_id:null, nome:null,
    persona_id:null, ordine_cliente_id:null, creato_il:ora, confermato_il:ora }]);
  DB.partenzaTolti = (DB.partenzaTolti || []).filter(x => x.nuovo_id !== "pn87");
  const radice = DB.partners.find(p => p.id === "R"); if(!radice.privacy_accettata_il) radice.privacy_accettata_il = ora;   // anche lanciata da sola
  const entra87 = async (tema, k, nome) => {
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema || "light", deviceScaleFactor:2 }, "#chiave=" + (k || "3c".repeat(16))));
    await page.getByText("Ciao " + (nome || "Olga")).waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
  };
  const pc = () => page.locator(".card.percorso-partenza"), pr = () => page.locator(".card.oggi-lista");
  const fase = async () => (await pc().locator(".spread .small").first().innerText()).trim();
  const titoloFase = async () => (await pc().locator(".fase-titolo").innerText()).trim();
  const prossima = async () => (await pr().locator(".prossima-titolo").innerText()).trim();
  const motivo = async () => (await pr().locator(".prossima-titolo + p.small").innerText()).replace(/\s+/g, " ").trim();
  const ordineConAttesa = async () => { const li = pc().locator("ol.fasi li", { hasText:"Ordine" });
    return !(await li.getAttribute("class")).includes("fatta") && await li.locator(".segno-attesa").count() === 1 && !(await li.locator(".lucchetto").count()); };
  // fase 4: i due binari, con il «!» sulla fase 3
  for(const tema of ["light", "dark"]){
    await entra87(tema);
    check(await fase() === "Fase 4 di 5" && await titoloFase() === "I due binari", `ordine in attesa (${tema}): la fase in corso è la 4, «I due binari»`);
    check(await ordineConAttesa() && await pc().locator(".ordine-attesa", { hasText:"Ordine confermato · in attesa della mappa" }).isVisible()
      && await pc().locator(".binari").isVisible(), `ordine in attesa (${tema}): la fase 3 non fatta con «!», sopra i numeri dei due binari`);
    check(await prossima() === "Il tuo primo piano" && await motivo() === "I due binari · mancano il primo piano e il primo cliente",
      `ordine in attesa (${tema}): «La prossima cosa» è il primo piano`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `ordine in attesa (${tema}), 360 px: niente scroll orizzontale`);
    await pc().screenshot({ path: S + `/e2e/87-percorso-attesa-${tema}.png` });
    await ctx.close();
  }
  // con il primo piano: il primo cliente
  DB.activities.push({ id:"pn87p", partner_id:"pn87", tipo:"piano", quantita:1, data:giorno(0), inserito_il:ora });
  await entra87();
  check(await fase() === "Fase 4 di 5" && await prossima() === "Il tuo primo cliente" && await motivo() === "I due binari · manca solo il primo cliente",
    "ordine in attesa, con il piano: «La prossima cosa» è il primo cliente");
  await ctx.close();
  // i due binari fatti: manca solo la mappa (fase 3), niente festa
  DB.activities.push({ id:"pn87c", partner_id:"pn87", tipo:"cliente", quantita:1, data:giorno(0), inserito_il:ora });
  for(const tema of ["light", "dark"]){
    await entra87(tema);
    check(!(await page.locator(".festa").count()), `manca solo la mappa (${tema}): niente festa`);
    check(await fase() === "Fase 3 di 5" && await titoloFase() === "Il primo ordine" && await ordineConAttesa()
      && (await pc().locator(".solo-mappa").innerText()).trim() === "Manca solo la mappa del primo ordine"
      && await pc().locator("ol.fasi .lucchetto").count() === 1,
      `manca solo la mappa (${tema}): la fase in corso dice «Manca solo la mappa del primo ordine»`);
    check(await prossima() === "Manca solo la mappa del primo ordine" && await motivo() === "Ordine confermato · in attesa della mappa"
      && !(await pr().locator(".prossima-azioni").count()), `manca solo la mappa (${tema}): «La prossima cosa» lo dice, senza pulsante`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `manca solo la mappa (${tema}), 360 px: niente scroll orizzontale`);
    await pc().screenshot({ path: S + `/e2e/87-solo-mappa-${tema}.png` });
    await pr().screenshot({ path: S + `/e2e/87-prossima-solo-mappa-${tema}.png` });
    await ctx.close();
  }
  // lo sponsor: la stessa fase e lo stesso «!», nei nuovi in partenza e nella scheda
  const sponsor = async (tema) => {
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema || "light", deviceScaleFactor:2 }, "#chiave=" + "a".repeat(32)));
    await page.getByText("Ciao Stefano e Alessia").waitFor();
    if(await page.locator(".sheet").count()) await page.click(".sheet [data-act=chiudi]");
    await page.click("button[data-act=vista-gruppo]");
    await page.locator(".card.nuovi-partenza").waitFor();
    return page.locator(".card.nuovi-partenza .partenze-l li", { hasText:"Olga Ordine" });
  };
  DB.activities = DB.activities.filter(a => a.id !== "pn87c");   // prima con il solo piano: fase 4
  let riga = await sponsor();
  check((await riga.innerText()).includes("Fase 4 di 5") && await riga.locator(".ordine-attesa", { hasText:"Ordine confermato · in attesa della mappa" }).count() === 1
    && await riga.locator(".barre-partenza i.attesa").count() === 1 && (await riga.innerText()).includes("Manca: primo piano fatto · primo cliente"),
    "sponsor: fase 4 di 5, il «!» del primo ordine in attesa e cosa manca");
  await riga.locator("button[data-act=apri-scheda]").click();
  const ps = page.locator(".card.partenza-scheda");
  await ps.locator(".percorso-scheda li.attesa", { hasText:"Il primo ordine" }).waitFor();
  check((await ps.locator(".eyebrow").innerText()).toLowerCase().includes("fase 4 di 5")
    && (await ps.locator(".percorso-scheda li.attesa .segno").innerText()).trim() === "!"
    && (await ps.locator(".percorso-scheda li.attesa").innerText()).includes("Ordine confermato · in attesa della mappa"),
    "sponsor, scheda: fase 4 di 5 e il primo ordine con «!»");
  check(!(await page.locator("#app").innerText()).includes("Nome Olga") && !/60 VP/.test(await ps.innerText()), "sponsor: né i nomi della sua Lista né i VP dell'ordine");
  await ctx.close();
  DB.activities.push({ id:"pn87c", partner_id:"pn87", tipo:"cliente", quantita:1, data:giorno(0), inserito_il:ora });
  for(const tema of ["light", "dark"]){
    riga = await sponsor(tema);
    check((await riga.innerText()).includes("Fase 3 di 5") && (await riga.innerText()).includes("Manca solo la mappa del primo ordine")
      && await riga.locator(".ordine-attesa").count() === 1 && await riga.locator(".barre-partenza i").nth(2).getAttribute("class") === "qui",
      `sponsor (${tema}): con i due binari fatti, fase 3 di 5 e «Manca solo la mappa del primo ordine»`);
    await page.locator(".card.nuovi-partenza").screenshot({ path: S + `/e2e/87-sponsor-${tema}.png` });
    await ctx.close();
  }
  // la mappa mostra l'ordine: per il nuovo la festa, per lo sponsor il primo ordine fatto, niente più «!»
  mappa("pn87", 60);
  await entra87();
  check(await page.locator(".festa").isVisible(), "la mappa mostra il primo ordine: la festa");
  await ctx.close();
  riga = await sponsor();
  check(!(await riga.count()) || (!(await riga.locator(".ordine-attesa").count()) && !(await riga.innerText()).includes("in attesa della mappa")),
    "sponsor, con la mappa: niente più ordine in attesa");
  await ctx.close();
  check(!errori.length, "primo ordine in attesa della mappa: nessun errore nella pagina");
  DB.persone = DB.persone.filter(x => x.proprietario !== "pn87");
  DB.activities = DB.activities.filter(a => a.partner_id !== "pn87");
  DB.ordiniMiei = DB.ordiniMiei.filter(x => x.proprietario !== "pn87");
  DB.numeri = DB.numeri.filter(x => x.partner_id !== "pn87");
  DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id !== "pn87");
  DB.partners = DB.partners.filter(p => p.id !== "pn87");
}

// 88. Il tocco sugli avvisi del gruppo (13 novembre 2026, 065): «./?partner=<id>» apre la scheda di quella persona, con
//     l'app chiusa e con l'app già aperta su un'altra pagina (il service worker la ricarica con l'indirizzo). Se la scheda
//     non si può aprire (persona che non vedo, in attesa della mappa, id inventato) si apre il Gruppo su «I tuoi nuovi in
//     partenza», senza errori. L'indirizzo si ripulisce subito.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  DB.partners.push({ id:"88888888-0000-4000-8000-000000000001", nome:"Nadia Notifica", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"4d".repeat(16), codice_invito:"PN88XX",
    codice_amway:"7988001", data_iscrizione:giorno(-4), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora,
    conPercorso:true, incontro_sponsor:giorno(-1) });
  DB.partners.push({ id:"88888888-0000-4000-8000-000000000002", nome:"Attilio Attesa", sponsor_id:"R", invitato_da:"R", stato:"attivo", chiave:"5e".repeat(16), codice_invito:"AT88XX",
    codice_amway:"7988002", data_iscrizione:giorno(-2), privacy_accettata_il:ora, confermato_il:null, creato_il:ora, conPercorso:true });
  const radice = DB.partners.find(p => p.id === "R"); if(!radice.privacy_accettata_il) radice.privacy_accettata_il = ora;   // anche lanciata da sola
  const sid = "88888888-0000-4000-8000-000000000001";
  const scheda = async () => { await page.locator(".testata h1", { hasText:"Scheda partner" }).waitFor();
    return (await page.locator(".card.partenza-scheda").count()) === 1 || (await page.locator("#app").innerText()).includes("Nadia Notifica"); };
  // l'app chiusa: il tocco apre la scheda della persona
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "?partner=" + sid + "#chiave=" + "a".repeat(32)));
  check(await scheda() && (await page.locator("#app").innerText()).includes("Nadia Notifica"), "avviso, app chiusa: si apre la scheda della persona");
  check(!(await page.evaluate(() => location.search)), "avviso: l'indirizzo si ripulisce (niente ?partner=)");
  // l'app già aperta su un'altra pagina (Persone): il service worker la porta all'indirizzo dell'avviso
  await page.click("button[data-act=vista-persone]"); await page.locator("button[data-act=sez-persone]").first().waitFor();
  // il service worker ricarica la finestra aperta con l'indirizzo dell'avviso (stessa memoria del telefono, senza #chiave)
  await sync(page); const stato88 = await ctx.storageState(); await ctx.close();
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, storageState:stato88 }, "?partner=" + sid));
  check(await scheda() && (await page.locator("#app").innerText()).includes("Nadia Notifica"), "avviso, app già aperta su un'altra pagina: si apre la scheda");
  await ctx.close();
  // la persona non si vede (un id che non è nel mio gruppo), è in attesa della mappa, o l'id è inventato: il Gruppo
  for(const [id, cosa] of [["88888888-0000-4000-8000-000000000002", "in attesa della mappa"], ["00000000-0000-4000-8000-000000000088", "persona non visibile"]]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "?partner=" + id + "#chiave=" + "a".repeat(32)));
    await page.locator(".testata h1", { hasText:"Il mio gruppo" }).waitFor();
    check(await page.locator(".card.nuovi-partenza").isVisible() && !(await page.locator(".testata h1", { hasText:"Scheda partner" }).count())
      && !(await page.evaluate(() => location.search)), `avviso, ${cosa}: si apre il Gruppo con «I tuoi nuovi in partenza»`);
    await ctx.close();
  }
  // un altro partner che vede l'avviso di una persona di un'altra linea: il Gruppo, nessun errore
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "?partner=" + sid + "#chiave=" + "4d".repeat(16)));
  await page.locator(".testata h1", { hasText:"Il mio gruppo" }).waitFor();
  check(!(await page.locator(".testata h1", { hasText:"Scheda partner" }).count()), "avviso su sé stessi o una persona che non si vede: niente scheda, il Gruppo");
  await ctx.close();
  check(!errori.length, "tocco sugli avvisi: nessun errore nella pagina");
  DB.obiettivi = (DB.obiettivi || []).filter(o => !["88888888-0000-4000-8000-000000000001", "88888888-0000-4000-8000-000000000002"].includes(o.partner_id));
  DB.partners = DB.partners.filter(p => !["88888888-0000-4000-8000-000000000001", "88888888-0000-4000-8000-000000000002"].includes(p.id));
}

// 89. La qualifica dichiarata (13 novembre 2026): l'etichetta «La tua qualifica attuale» (il significato resta «oggi») e sotto
//     la riga piccola su quale percentuale e qualifica. All'ingresso con l'invito e nel «Mio punto di partenza». A 360 px
//     l'etichetta sta su una riga; la riga piccola (12 px) al massimo su due, con «(settembre–agosto)» intero. Anteprima dell'ingresso in chiaro e scuro.
{
  const NOTA = "Percentuale: del mese scorso. Da Platino in su: dell'ultimo anno fiscale (settembre–agosto).";
  const misura = sel => page.locator(sel).first().evaluate(el => { const lh = parseFloat(getComputedStyle(el).lineHeight) || 18;
    return { righe:Math.round(el.getBoundingClientRect().height / lh), testo:el.textContent.replace(/\s+/g, " ").trim() }; });
  for(const tema of ["light", "dark"]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema, deviceScaleFactor:2 }, invitoPer("R", "Quinto Qualifica", "7989001")));
    await page.locator("form[data-form=ingresso]").waitFor();
    const et = await misura("form[data-form=ingresso] label.field:has(select[name=qualifica]) > span:first-child");
    const nota = await misura("form[data-form=ingresso] .nota-qualifica");
    check(et.testo === "La tua qualifica attuale" && et.righe === 1, `ingresso (${tema}): «La tua qualifica attuale» su una riga a 360 px`);
    check(nota.testo === NOTA && nota.righe <= 2 && (await page.locator("form[data-form=ingresso] .nota-qualifica .nowrap").innerText()) === "(settembre–agosto).", `ingresso (${tema}): sotto la riga piccola su percentuale e Platino (${nota.righe} righe)`);
    check(!(await page.getByText("La tua qualifica oggi").count()) && !(await page.getByText("Il livello più alto").count()), `ingresso (${tema}): niente etichette vecchie`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `ingresso (${tema}), 360 px: niente scroll orizzontale`);
    const campo = page.locator("form[data-form=ingresso] label.field:has(select[name=qualifica])");
    await campo.scrollIntoViewIfNeeded();
    await page.screenshot({ path: S + `/e2e/89-qualifica-${tema}.png` });
    await ctx.close();
  }
  check(!errori.length, "qualifica: nessun errore nella pagina");
}

// 90. «Da seguire oggi» (13 novembre 2026), punto 1: il calcolo (daSeguireOggi). Un upline con: nuovi invitati da lui fermi
//     (obiettivo, incontro, primo ordine a meno di 7 giorni dalla fine dei 30), uno con l'ordine in attesa della mappa, uno
//     ancora lontano dalla scadenza, uno oltre i 30 giorni; partner fermi («Non aggiorna»); la profondità (sotto uno sponsor
//     attivo no, sotto uno fermo da più di 14 giorni o senza app sì, chi ho invitato io sempre); il traguardo negli ultimi
//     10 giorni del mese; i complimenti (percentuale più alta, primo ordine nella mappa, partenza completata); nessun limite
//     di persone, nell'ordine dei criteri; «Fatto» per 7 giorni salvo un motivo nuovo; la memoria del telefono che non va.
{
  const id = n => "90000000-0000-4000-8000-0000000000" + String(n).padStart(2, "0");
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), quando = n => new Date(Date.now() + n * 864e5).toISOString();
  const ora = new Date().toISOString(), U = id(1);
  const mesePrima = (() => { const [y, m] = meseOra().split("-").map(Number), t = y * 12 + m - 2; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, "0")}`; })();
  const app = (n, nome, sponsor, extra) => DB.partners.push(Object.assign({ id:id(n), nome, sponsor_id:sponsor, stato:"attivo", codice_invito:"DS" + n + "XX",
    codice_amway:"7990" + String(n).padStart(3, "0"), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:quando(-200), ultimo_aggiornamento:ora }, extra));
  const gestito = (n, nome, sponsor, extra) => DB.partners.push(Object.assign({ id:id(n), nome, sponsor_id:sponsor, stato:"gestito", gestore_id:U, codice_invito:"DS" + n + "XX",
    codice_amway:"7990" + String(n).padStart(3, "0"), partenza_confermata_il:ora, creato_il:quando(-200) }, extra));
  const nuovo = (iscritto, entrato) => ({ invitato_da:U, data_iscrizione:giorno(-iscritto), privacy_accettata_il:quando(-entrato), creato_il:quando(-entrato), ultimo_aggiornamento:ora, conPercorso:true });
  const perche = n => { DB.obiettivi = (DB.obiettivi || []).concat([{ partner_id:id(n), cifra_mese:300, entro:"2027-06-01", perche:"Per la famiglia" }]); };
  app(1, "Ugo Upline", "R", { chiave:"c9".repeat(16), data_iscrizione:giorno(-400) }); perche(1);
  app(2, "Anna Avvio", U, nuovo(5, 4));                                                            // 1: obiettivo e incontro
  app(3, "Bruno Binario", U, Object.assign(nuovo(25, 24), { incontro_sponsor:giorno(-20) })); perche(3);   // 1: primo ordine, restano 5
  app(4, "Carla Conferma", U, Object.assign(nuovo(25, 24), { incontro_sponsor:giorno(-20) })); perche(4);  // ordine in attesa: niente
  DB.ordiniMiei = (DB.ordiniMiei || []).concat([{ id:"o90", proprietario:id(4), stato:"confermato", data:giorno(-2), persona_id:null }]);
  app(17, "Nino Nuovo", U, Object.assign(nuovo(15, 14), { incontro_sponsor:giorno(-10) })); perche(17);    // restano 15: niente
  app(18, "Olga Oltre", U, Object.assign(nuovo(35, 28), { incontro_sponsor:giorno(-20) })); perche(18);    // oltre i 30: niente
  app(5, "Dario Dormiente", U, { ultimo_aggiornamento:quando(-10) });                             // 2, ma attivo (10 ≤ 14)
  app(6, "Elio Esterno", id(5), { ultimo_aggiornamento:quando(-30) });                            // sotto uno sponsor attivo: no
  app(7, "Franco Fermo", U, { ultimo_aggiornamento:quando(-20) });                                // 2, non attivo
  app(8, "Gino Giù", id(7), { ultimo_aggiornamento:quando(-9) });                                 // sotto uno fermo: 2 + complimento
  mappa(id(8), 60, 250, { percentuale:3 });
  gestito(9, "Ezio Senza App", U);                                                                 // senza app e senza motivo
  gestito(10, "Ivo Vicino", id(9)); mappa(id(10), 100, 1150, { percentuale:6 });                   // sotto chi non usa l'app: 3
  gestito(11, "Jole Salita", U); mappa(id(11), 100, 1300, { percentuale:9 }); mappa(id(11), 100, 700, { percentuale:6, mese:mesePrima });  // 4
  gestito(12, "Katia Primo", U, { data_iscrizione:giorno(-3) }); mappa(id(12), 60, 60);            // 4: primo ordine nella mappa
  app(13, "Lia Lanciata", U, { invitato_da:U, data_iscrizione:giorno(-20), privacy_accettata_il:quando(-19), partenza_completata_il:quando(-2) });  // 4
  app(14, "Pia Invitata", id(5), nuovo(6, 5));                                                     // invitata da me, sotto uno attivo: 1
  app(15, "Quinto Attesa", U, Object.assign(nuovo(4, 3), { confermato_il:null }));                 // in attesa della mappa: 1, senza scheda
  app(16, "Nora Nascosta", U, { ultimo_aggiornamento:quando(-12) });                               // nascosta: no
  DB.nascosti = (DB.nascosti || []).concat([{ partner_id:U, nascosto_id:id(16) }]);

  ({ ctx, page } = await apri({}, "#chiave=" + "c9".repeat(16)));
  await page.locator(".testata h1").waitFor();
  const calcola = g => page.evaluate(g => GROWUP_TEST.daSeguireOggi(g), g || null);
  const nomi = l => l.map(r => r.nome);
  const riga = (l, nome) => l.find(r => r.nome === nome);
  const [aa, mm, dd] = await page.evaluate(() => GROWUP_TEST.oggi().split("-").map(Number));
  const ultimoGiorno = new Date(Date.UTC(aa, mm, 0)).getUTCDate(), fineMese = ultimoGiorno - dd < 10;
  const ultimo = `${meseOra()}-${String(ultimoGiorno).padStart(2, "0")}`;
  let l = await calcola();
  const attesi = ["Anna Avvio", "Bruno Binario", "Pia Invitata", "Quinto Attesa", "Dario Dormiente", "Franco Fermo", "Gino Giù"]
    .concat(fineMese ? ["Ivo Vicino"] : [], ["Jole Salita", "Katia Primo", "Lia Lanciata"]);
  check(JSON.stringify(nomi(l)) === JSON.stringify(attesi), `da seguire: tutte le persone con un motivo, nell'ordine dei criteri (${nomi(l).join(", ")})`);
  check(l.length > 3, "da seguire: nessun limite di persone");
  check(l.every((r, i) => !i || l[i - 1].criterio <= r.criterio), "da seguire: prima il criterio 1, poi 2, 3 e 4");
  // criterio 1
  check(riga(l, "Anna Avvio").k === "obiettivo" && riga(l, "Anna Avvio").motivo === "Obiettivo non ancora scritto · nell'app da 4 giorni"
    && riga(l, "Anna Avvio").chiavi.includes("incontro") && riga(l, "Anna Avvio").tipo === "aiuto", "criterio 1: obiettivo non scritto da 3 giorni (e incontro non fissato)");
  check(riga(l, "Bruno Binario").k === "ordine" && riga(l, "Bruno Binario").motivo === "Primo ordine non ancora fatto · restano 5 giorni dei 30",
    "criterio 1: meno di 7 giorni alla fine dei 30, senza ordine");
  check(!riga(l, "Carla Conferma"), "criterio 1: ordine confermato in attesa della mappa: niente");
  check(!riga(l, "Nino Nuovo") && !riga(l, "Olga Oltre"), "criterio 1: ancora 15 giorni, oppure oltre i 30 giorni: niente");
  check(riga(l, "Quinto Attesa").scheda === false && riga(l, "Anna Avvio").scheda === true, "criterio 1: chi è in attesa della mappa non ha la scheda");
  // criterio 2 e profondità
  check(riga(l, "Dario Dormiente").motivo === "Non aggiorna da 10 giorni" && riga(l, "Franco Fermo").motivo === "Non aggiorna da 20 giorni",
    "criterio 2: «Non aggiorna» da più di 7 giorni");
  check(!riga(l, "Elio Esterno"), "profondità: sotto uno sponsor attivo (fermo da 10 giorni) non compare");
  check(riga(l, "Gino Giù").criterio === 2, "profondità: sotto uno sponsor fermo da più di 14 giorni compare");
  check(riga(l, "Pia Invitata").criterio === 1, "profondità: chi ho invitato io compare anche sotto uno sponsor attivo");
  check(!riga(l, "Ezio Senza App") && !riga(l, "Nora Nascosta"), "senza motivo, o nascosta: non compare");
  // criterio 3: negli ultimi 10 giorni del mese, con la data della mappa
  const fine = await calcola(ultimo), inizio = await calcola(meseOra() + "-01");
  check(riga(fine, "Ivo Vicino") && riga(fine, "Ivo Vicino").criterio === 3 && /^Mancano 50 VP di gruppo per il 9% · mappa del /.test(riga(fine, "Ivo Vicino").motivo),
    "criterio 3: a fine mese, mancano 50 VP per il 9%, con la data della mappa (sotto chi non usa l'app)");
  check(!riga(inizio, "Ivo Vicino"), "criterio 3: il primo del mese niente");
  check(!riga(fine, "Jole Salita") || riga(fine, "Jole Salita").criterio === 4, "criterio 3: lontano dalla percentuale successiva: niente");
  // criterio 4
  check(riga(l, "Jole Salita").tipo === "complimento" && /^Al 9% questo mese · a \S+ 6% · mappa del /.test(riga(l, "Jole Salita").motivo),
    "criterio 4: percentuale più alta del mese prima");
  check(/^Primo ordine nella mappa · 60 VP · mappa del /.test(riga(l, "Katia Primo").motivo), "criterio 4: primo ordine nella mappa");
  check(/^Ha completato la partenza · /.test(riga(l, "Lia Lanciata").motivo), "criterio 4: partenza completata negli ultimi 7 giorni");
  check(riga(l, "Gino Giù").anche === "Al 3% questo mese · all'ingresso 0% · " + riga(l, "Gino Giù").anche.split(" · ").pop(),
    "criterio 4: senza la mappa del mese prima, la percentuale dichiarata all'ingresso; il complimento resta accanto («anche»)");
  // privacy: mai il perché, mai nomi della Lista
  check(!JSON.stringify(l).includes("famiglia"), "da seguire: il testo del perché non c'è mai");
  // la profondità: lo sponsor fermo da più di 14 giorni non è più attivo
  check(await page.evaluate(() => { const { st, daSeguireOggi } = GROWUP_TEST; const d = st.struttura.find(p => p.nome === "Dario Dormiente"), prima = d.ultimo_aggiornamento;
    d.ultimo_aggiornamento = new Date(Date.now() - 15 * 864e5).toISOString(); const r = daSeguireOggi().some(x => x.nome === "Elio Esterno");
    d.ultimo_aggiornamento = prima; return r; }), "profondità: sponsor fermo da 15 giorni, chi sta sotto compare");
  // «Fatto»: fuori per 7 giorni
  await page.evaluate(() => GROWUP_TEST.segnaFattoDaSeguire(GROWUP_TEST.daSeguireOggi().find(r => r.nome === "Dario Dormiente")));
  check(!riga(await calcola(), "Dario Dormiente"), "Fatto: la persona non compare più oggi");
  check(!riga(await calcola(giorno(6)), "Dario Dormiente"), "Fatto: non compare dopo 6 giorni");
  check(riga(await calcola(giorno(7)), "Dario Dormiente"), "Fatto: dopo 7 giorni torna");
  // «Fatto» con un motivo nuovo: torna subito, con il motivo nuovo
  await page.evaluate(() => GROWUP_TEST.segnaFattoDaSeguire(GROWUP_TEST.daSeguireOggi().find(r => r.nome === "Gino Giù")));
  check(!riga(await calcola(), "Gino Giù"), "Fatto: tutti i suoi motivi di oggi (anche il complimento) sono segnati");
  const gino = await page.evaluate(() => { const { st, daSeguireOggi } = GROWUP_TEST; const r = st.riep.find(x => x.partner_id === st.struttura.find(p => p.nome === "Gino Giù").id);
    r.percentuale = 6; r.vp_gruppo = 700; return daSeguireOggi().find(x => x.nome === "Gino Giù"); });
  check(gino && gino.k === "percentuale-6" && gino.tipo === "complimento", "Fatto: un fatto nuovo (la percentuale sale ancora) e torna subito");
  // il complimento della mappa: 7 giorni da quando l'app lo vede la prima volta
  check(await page.evaluate(() => { const { st, daSeguireOggi, piuGiorni, oggi } = GROWUP_TEST; const k = "growup-team.da-seguire." + st.profilo.id, m = JSON.parse(localStorage.getItem(k));
    const c = Object.keys(m.visti).find(c => c.endsWith("|percentuale-9")); m.visti[c] = piuGiorni(oggi(), -8); localStorage.setItem(k, JSON.stringify(m));
    return !daSeguireOggi().some(x => x.nome === "Jole Salita"); }), "complimento: visto per la prima volta 8 giorni fa, non compare più");
  // la memoria del telefono non risponde: il calcolo va avanti
  check(await page.evaluate(() => { const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new Error("bloccato"); }; Storage.prototype.setItem = () => { throw new Error("bloccato"); };
    try{ return GROWUP_TEST.daSeguireOggi().length > 3; }finally{ Storage.prototype.getItem = g; Storage.prototype.setItem = s; } }),
    "memoria del telefono bloccata: il calcolo va avanti senza errori");
  await ctx.close();
  check(!errori.length, "da seguire, calcolo: nessun errore nella pagina");
  const tutti = Array.from({ length:18 }, (_, i) => id(i + 1));
  DB.partners = DB.partners.filter(p => !tutti.includes(p.id));
  DB.numeri = DB.numeri.filter(x => !tutti.includes(x.partner_id));
  DB.obiettivi = DB.obiettivi.filter(o => !tutti.includes(o.partner_id));
  DB.ordiniMiei = DB.ordiniMiei.filter(o => !tutti.includes(o.proprietario));
  DB.nascosti = DB.nascosti.filter(x => x.partner_id !== U);
}

// 91. «Da seguire oggi», punto 2: il riquadro in Io → Il mio giorno, sotto la lista di oggi. Tre righe (due da aiutare e
//     un complimento) con nome, motivo, «Apri scheda» e «Fatto»; colori ambra/verde sempre con parola e segno; niente
//     WhatsApp (il numero non è visibile). «Apri scheda» apre la scheda, o il Gruppo per chi è in attesa della mappa.
//     «Fatto» toglie la riga (Annulla la rimette) e resta anche ricaricando. Si vede anche nella versione semplificata,
//     con una persona sotto; chi non ha nessuno sotto non lo vede, e senza nomi il riquadro non c'è. Anteprime a 360 px.
{
  const id = n => "91000000-0000-4000-8000-0000000000" + String(n).padStart(2, "0");
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), quando = n => new Date(Date.now() + n * 864e5).toISOString();
  const ora = new Date().toISOString(), V = id(1);
  const app = (n, nome, sponsor, extra) => DB.partners.push(Object.assign({ id:id(n), nome, sponsor_id:sponsor, stato:"attivo", codice_invito:"DT" + n + "XX",
    codice_amway:"7991" + String(n).padStart(3, "0"), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:quando(-200), ultimo_aggiornamento:ora }, extra));
  const perche = n => { DB.obiettivi = (DB.obiettivi || []).concat([{ partner_id:id(n), cifra_mese:300, entro:"2027-06-01", perche:"Per la famiglia" }]); };
  const nuovo = (sponsor, iscritto, entrato) => ({ invitato_da:sponsor, data_iscrizione:giorno(-iscritto), privacy_accettata_il:quando(-entrato), creato_il:quando(-entrato), conPercorso:true });
  app(1, "Vera Upline", "R", { chiave:"71".repeat(16), data_iscrizione:giorno(-400) }); perche(1);
  app(2, "Alba Avvio", V, nuovo(V, 5, 4));                                         // da aiutare: obiettivo non scritto
  app(3, "Dino Dormiente", V, { ultimo_aggiornamento:quando(-10) });             // da aiutare: non aggiorna
  app(4, "Lina Lanciata", V, { chiave:"72".repeat(16), invitato_da:V, data_iscrizione:giorno(-20), privacy_accettata_il:quando(-19),
    partenza_completata_il:quando(-2) }); perche(4);                               // complimento: partenza completata
  const box = () => page.locator(".card.da-seguire");
  const righe = () => page.locator(".card.da-seguire .da-seguire-l > li");

  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "71".repeat(16)));
  await page.locator(".testata h1").waitFor();
  await box().waitFor();
  check(await righe().count() === 3, "da seguire: tre righe");
  check(JSON.stringify(await page.locator(".da-seguire-l .ds-nome").allInnerTexts()) === JSON.stringify(["Alba Avvio", "Dino Dormiente", "Lina Lanciata"]),
    "da seguire: nell'ordine dei criteri, il complimento in fondo");
  check(JSON.stringify(await page.locator(".da-seguire-l .ds-tag").allInnerTexts()) === JSON.stringify(["! Da sentire", "! Da sentire", "✓ Complimento"]),
    "da seguire: ambra con «! Da sentire», verde con «✓ Complimento» (parola e segno oltre al colore)");
  check(await righe().nth(0).locator(".ds-motivo").innerText() === "Obiettivo non ancora scritto · nell'app da 4 giorni"
    && await righe().nth(1).locator(".ds-motivo").innerText() === "Non aggiorna da 10 giorni"
    && /^Ha completato la partenza · /.test(await righe().nth(2).locator(".ds-motivo").innerText()), "da seguire: il motivo in piccolo sotto il nome");
  check(await righe().nth(2).evaluate(li => li.classList.contains("ds-complimento")) && await righe().nth(0).evaluate(li => li.classList.contains("ds-aiuto")),
    "da seguire: le classi del colore");
  check(await page.locator(".card.da-seguire button[data-act=ds-apri]").count() === 3 && await page.locator(".card.da-seguire button[data-act=ds-fatto]").count() === 3,
    "da seguire: «Apri scheda» e «Fatto» su ogni riga");
  check(!(await page.locator(".card.da-seguire a[href*='wa.me']").count()), "da seguire: niente WhatsApp (il numero non è visibile all'upline)");
  check(await page.evaluate(() => { const b = document.querySelector(".card.da-seguire"), o = document.querySelector(".card.oggi-lista, .card.oggi-per-te");
    return !o || !!(o.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); }), "da seguire: sotto la lista di oggi");
  check(!(await box().innerText()).includes("famiglia"), "da seguire: mai il testo del perché");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "da seguire, 360 px: niente scroll orizzontale");
  // «Apri scheda»: la stessa scheda del tocco sulle notifiche
  await righe().nth(1).locator("button[data-act=ds-apri]").click();
  await page.locator(".testata h1", { hasText:"Scheda partner" }).waitFor();
  check((await page.locator("#app").innerText()).includes("Dino Dormiente"), "Apri scheda: si apre la scheda della persona");
  await page.click("button[data-act=vista-io]"); await box().waitFor();
  // «Fatto»: la riga sparisce, Annulla la rimette; resta anche ricaricando
  await righe().nth(1).locator("button[data-act=ds-fatto]").click();
  check(await righe().count() === 2 && !(await box().innerText()).includes("Dino Dormiente"), "Fatto: la riga sparisce");
  check((await page.locator("#toast").innerText()).includes("Torna tra 7 giorni"), "Fatto: il messaggio dice per quanto");
  await page.click("#toast button[data-act=annulla]");
  check(await righe().count() === 3, "Fatto: Annulla la rimette");
  await righe().nth(1).locator("button[data-act=ds-fatto]").click();
  await sync(page); const memoria91 = await ctx.storageState(); await ctx.close();
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, storageState:memoria91 }));
  await box().waitFor();
  check(await righe().count() === 2 && !(await box().innerText()).includes("Dino Dormiente"), "Fatto: ricaricando la persona resta fuori (su questo telefono)");
  await ctx.close();
  // le anteprime a 360 px, tre righe, chiaro e scuro
  for(const tema of ["light", "dark"]){
    ({ ctx, page } = await apri({ viewport:{ width:360, height:780 }, colorScheme:tema, deviceScaleFactor:2 }, "#chiave=" + "71".repeat(16)));
    await box().waitFor();
    check(await righe().count() === 3, `da seguire (${tema}): tre righe nell'anteprima`);
    await box().scrollIntoViewIfNeeded();
    await box().screenshot({ path: S + `/e2e/91-da-seguire-${tema}.png` });
    await ctx.close();
  }
  // chi è in attesa della mappa: «Apri scheda» porta al Gruppo su «I tuoi nuovi in partenza»
  app(5, "Quinto Attesa", V, Object.assign(nuovo(V, 4, 3), { confermato_il:null }));
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "71".repeat(16)));
  await box().waitFor();
  await page.locator(".da-seguire-l > li", { hasText:"Quinto Attesa" }).locator("button[data-act=ds-apri]").click();
  await page.locator(".testata h1", { hasText:"Il mio gruppo" }).waitFor();
  check(await page.locator(".card.nuovi-partenza").isVisible(), "Apri scheda, in attesa della mappa: il Gruppo su «I tuoi nuovi in partenza»");
  await ctx.close();
  // chi non ha nessuno sotto non vede il riquadro
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "72".repeat(16)));
  await page.locator(".testata h1").waitFor();
  check(!(await box().count()), "da seguire: chi non ha nessuno sotto non vede il riquadro");
  await ctx.close();
  // nessun nome: nessun riquadro (le persone ci sono, ma oggi nessuna ha un motivo)
  for(const n of [2, 3, 5]) Object.assign(DB.partners.find(p => p.id === id(n)), { invitato_da:null, ultimo_aggiornamento:ora });
  Object.assign(DB.partners.find(p => p.id === id(4)), { partenza_completata_il:quando(-30) });
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "71".repeat(16)));
  await page.locator(".testata h1").waitFor();
  check(!(await box().count()), "da seguire: nessuno con un motivo, nessun riquadro (niente riquadro vuoto)");
  await ctx.close();
  // anche nella versione semplificata, con una persona sotto
  app(6, "Nadia Nuova", V, Object.assign(nuovo(V, 5, 4), { chiave:"73".repeat(16), incontro_sponsor:giorno(2) })); perche(6);
  app(7, "Paolo Partito", id(6), nuovo(id(6), 4, 3));
  ({ ctx, page } = await apri({ viewport:{ width:360, height:780 } }, "#chiave=" + "73".repeat(16)));
  await page.locator(".testata h1").waitFor();
  check(!(await page.getByRole("button", { name:"Verifica", exact:true }).count()), "versione semplificata: la Verifica non c'è");
  await box().waitFor({ timeout:5000 }).catch(() => {});
  check(await box().count() === 1 && (await box().innerText()).includes("Paolo Partito"), "da seguire: si vede anche nella versione semplificata, con una persona sotto");
  await ctx.close();
  check(!errori.length, "da seguire, riquadro: nessun errore nella pagina");
  const tutti = Array.from({ length:7 }, (_, i) => id(i + 1));
  DB.partners = DB.partners.filter(p => !tutti.includes(p.id));
  DB.obiettivi = DB.obiettivi.filter(o => !tutti.includes(o.partner_id));
}

// 92. «Da seguire oggi», punto 3: il «?» spiega in parole semplici chi compare e perché (le soglie dalle impostazioni),
//     si apre e si chiude sul riquadro; il testo non fa credere che contatti o piani facciano ottenere la percentuale.
//     Anteprime a 360 px, chiaro e scuro, con tre righe e la spiegazione aperta.
{
  const id = n => "92000000-0000-4000-8000-0000000000" + String(n).padStart(2, "0");
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), quando = n => new Date(Date.now() + n * 864e5).toISOString();
  const ora = new Date().toISOString(), W = id(1);
  const app = (n, nome, sponsor, extra) => DB.partners.push(Object.assign({ id:id(n), nome, sponsor_id:sponsor, stato:"attivo", codice_invito:"DU" + n + "XX",
    codice_amway:"7992" + String(n).padStart(3, "0"), privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:quando(-200), ultimo_aggiornamento:ora }, extra));
  DB.obiettivi = (DB.obiettivi || []).concat([{ partner_id:W, cifra_mese:300, entro:"2027-06-01", perche:"Per la famiglia" }]);
  app(1, "Walter Upline", "R", { chiave:"74".repeat(16), data_iscrizione:giorno(-400) });
  app(2, "Alba Avvio", W, { invitato_da:W, data_iscrizione:giorno(-5), privacy_accettata_il:quando(-4), creato_il:quando(-4), conPercorso:true });
  app(3, "Dino Dormiente", W, { ultimo_aggiornamento:quando(-10) });
  app(4, "Lina Lanciata", W, { invitato_da:W, data_iscrizione:giorno(-20), privacy_accettata_il:quando(-19), partenza_completata_il:quando(-2) });
  const box = () => page.locator(".card.da-seguire");
  for(const tema of ["light", "dark"]){
    // finestra alta: il riquadro intero sta tra le barre fisse in alto e in basso
    ({ ctx, page } = await apri({ viewport:{ width:360, height:2200 }, colorScheme:tema, deviceScaleFactor:2 }, "#chiave=" + "74".repeat(16)));
    await box().waitFor();
    const q = box().locator("button.aiuto-btn[data-k=da-seguire]");
    check(await q.count() === 1 && !(await box().locator(".aiuto-testo").count()), `da seguire (${tema}): il «?» c'è, la spiegazione è chiusa`);
    await q.click();
    const t = await box().locator(".aiuto-testo").innerText();
    check(t.includes("la tua prima linea e chi hai invitato tu") && t.includes("più di 14 giorni") && t.includes("non aggiorna da più di 7 giorni")
      && t.includes("ultimi 10 giorni del mese") && t.includes("percentuale più alta del mese prima") && t.split("\n").length >= 6 && t.includes("partenza completata")
      && t.includes("mai i nomi della sua Lista o dei suoi Clienti") && t.includes("«Fatto» toglie la persona per 7 giorni"), `da seguire (${tema}): la spiegazione dice chi compare e perché`);
    check(!/per (ottenere|raggiungere|arrivare)|se (lo )?(chiami|contatti|senti)|contatt\w+ (e|o) piani/i.test(t), `da seguire (${tema}): nessuna promessa che contatti o piani portino la percentuale`);
    check(await box().locator(".da-seguire-l > li").count() === 3, `da seguire (${tema}): tre righe con la spiegazione aperta`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `da seguire (${tema}), 360 px: niente scroll orizzontale`);
    await box().screenshot({ path: S + `/e2e/92-da-seguire-aiuto-${tema}.png` });
    await q.click();
    check(!(await box().locator(".aiuto-testo").count()), `da seguire (${tema}): il «?» la richiude`);
    await ctx.close();
  }
  check(!errori.length, "da seguire, «?»: nessun errore nella pagina");
  const tutti = Array.from({ length:4 }, (_, i) => id(i + 1));
  DB.partners = DB.partners.filter(p => !tutti.includes(p.id));
  DB.obiettivi = DB.obiettivi.filter(o => !tutti.includes(o.partner_id));
}

// 93. La festa a fine fase (13 novembre 2026): quando il nuovo chiude la fase 2 (incontro fissato e 30 nomi, qualunque dei due
//     arrivi per ultimo) e la fase 3 (il primo ordine nella mappa), un traguardo a tutto schermo come gli altri. Una volta
//     sola per fase, ricordata sul telefono; coriandoli solo senza «riduci animazioni»; anche nella versione semplificata.
{
  const giorno = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), ora = new Date().toISOString();
  DB.traguardiAperti = true;   // qui i traguardi si guardano e si chiudono a mano
  const nuovo = (id, k, nome, x) => { DB.partners = DB.partners.filter(p => p.id !== id).concat([Object.assign({ id, nome, sponsor_id:"R", invitato_da:"R",
    stato:"attivo", chiave:k.repeat(16), codice_invito:id.toUpperCase().padEnd(6, "X").slice(0, 6), codice_amway:"79930" + DB.partners.length, data_iscrizione:giorno(-3),
    privacy_accettata_il:ora, confermato_il:ora, partenza_confermata_il:ora, creato_il:ora, conPercorso:true }, x || {})]); };
  const nomi = (id, n) => { DB.persone = (DB.persone || []).filter(x => x.proprietario !== id)
    .concat(Array.from({ length:n }, (_, i) => ({ id:id + "n" + i, proprietario:id, nome:"Nome " + id + " " + (i + 1), fase:"lista", esito:null, creato_il:ora, fonte:"conoscenza" }))); };
  const tr = () => page.locator(".festa.traguardo");
  const testo = async () => (await tr().innerText()).replace(/\s+/g, " ").trim().replace(/^Percorso di partenza · fase (\d) di 5/i, "Percorso di partenza · fase $1 di 5");
  const chiudi = async () => { await tr().locator("button[data-act=traguardo-chiudi]").click(); await tr().waitFor({ state:"detached" }); };
  const entra = async (k, nome, opz) => {
    ({ ctx, page } = await apri(Object.assign({ viewport:{ width:360, height:780 } }, opz || {}), "#chiave=" + k.repeat(16)));
    await page.getByText("Ciao " + nome).waitFor();
  };
  // A. Fede: «Inizio» (versione semplificata), 29 nomi, incontro da fissare. Prima l'incontro, poi il trentesimo nome.
  nuovo("ff93", "3a", "Fede Fasi"); nomi("ff93", 29);
  await entra("3a", "Fede");
  check(await page.locator("button[data-act=sez-io][data-sez=guida]").count() === 0, "festa di fase: Fede è nella versione semplificata");
  check(!(await tr().count()), "festa di fase: con 29 nomi e l'incontro da fissare niente festa");
  await page.click(".oggi-lista button[data-act=incontro-fissa]");
  await page.locator(".sheet h2", { hasText:"Il primo incontro con il tuo sponsor" }).waitFor();
  await page.check(`.sheet input[name=quando][value="${giorno(1)}"]`, { force:true });
  await page.click(".sheet button.primary");
  await page.getByText("Primo incontro con lo sponsor: domani").waitFor();
  check(!(await tr().count()), "festa di fase: incontro fissato ma 29 nomi, niente festa");
  await page.click("button[data-act=vista-persone]");
  await page.click("button[data-act=persona-nuova]");
  await page.fill(".sheet input[name=nome]", "Trentesimo Nome");
  await page.click(".sheet button:has-text('Salva')");
  await tr().waitFor();
  check(await testo() === "Percorso di partenza · fase 2 di 5 Fase 2 completata! 30 nomi nella Lista e l'incontro con il tuo sponsor fissato. Ora il primo ordine. Continua",
    "festa di fase 2: il trentesimo nome con l'incontro già fissato (" + await testo() + ")");
  check(await tr().locator("button").count() === 1 && !(await page.locator("canvas.coriandoli").count()), "festa di fase 2: un solo pulsante; con «riduci animazioni» niente coriandoli");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "festa di fase 2, 360 px: niente scroll orizzontale");
  await chiudi();
  await riapri(page); await page.getByText("Ciao Fede").waitFor(); await page.waitForTimeout(400);
  check(!(await tr().count()), "festa di fase 2: una volta sola (riaprendo l'app sullo stesso telefono non torna)");
  // fase 3: arriva la mappa con il primo ordine (anche dopo una bozza confermata in attesa della mappa)
  await mappaIn(page, "ff93", 62);
  await tr().waitFor();
  check(await testo() === "Percorso di partenza · fase 3 di 5 Fase 3 completata! Il tuo primo ordine è nella mappa. Ora i due binari: il primo piano e il primo cliente. Continua",
    "festa di fase 3: all'apertura, con il primo ordine nella mappa (" + await testo() + ")");
  await chiudi();
  await riapri(page); await page.getByText("Ciao Fede").waitFor(); await page.waitForTimeout(400);
  check(!(await tr().count()), "festa di fase 3: una volta sola");
  check(!errori.length, "festa di fase: nessun errore nella pagina");
  await ctx.close();
  // B. Gino: 30 nomi prima, l'incontro per ultimo; con i coriandoli (senza «riduci animazioni»). Anteprime a 360 px.
  nuovo("gg93", "3b", "Gino Giro"); nomi("gg93", 30);
  for(const tema of ["light", "dark"]){
    await entra("3b", "Gino", { colorScheme:tema, deviceScaleFactor:2, reducedMotion:tema === "light" ? "no-preference" : "reduce" });
    if(tema === "light"){
      check(!(await tr().count()), "festa di fase: 30 nomi e incontro da fissare, niente festa");
      await page.click(".oggi-lista button[data-act=incontro-fissa]");
      await page.locator(".sheet h2", { hasText:"Il primo incontro con il tuo sponsor" }).waitFor();
      await page.locator(`.sheet input[name=quando][value="${giorno(1)}"]`).evaluate(e => e.click());
      await page.click(".sheet button.primary");
      await tr().waitFor();
      check(await page.locator("canvas.coriandoli").count() === 1, "festa di fase 2: l'incontro per ultimo; senza «riduci animazioni» i coriandoli");
      await page.waitForTimeout(2800);
      check(!(await page.locator("canvas.coriandoli").count()), "festa di fase 2: i coriandoli finiscono da soli");
    } else {
      /* un altro telefono: la festa non è ancora stata vista qui */
      await tr().waitFor();
    }
    check((await testo()).includes("Fase 2 completata!"), `festa di fase 2 (${tema})`);
    await page.screenshot({ path: S + `/e2e/93-festa-fase2-${tema}.png` });
    await chiudi();
    await sync(page); await ctx.close();
  }
  // C. Il primo ordine era già nella mappa quando si chiude la fase 2: una festa sola, con i due binari dopo
  nuovo("hh93", "3c", "Ugo Unasola", { incontro_sponsor:giorno(1) }); nomi("hh93", 29); mappa("hh93", 70);
  await entra("3c", "Ugo");
  check(!(await tr().count()), "festa di fase: primo ordine nella mappa ma fase 2 aperta: niente festa della fase 3");
  await page.click("button[data-act=vista-persone]");
  await page.click("button[data-act=persona-nuova]");
  await page.fill(".sheet input[name=nome]", "Ultimo Nome");
  await page.click(".sheet button:has-text('Salva')");
  await tr().waitFor();
  check((await testo()).includes("Fase 2 completata!") && (await testo()).includes("Ora i due binari: il primo piano e il primo cliente."),
    "festa di fase 2 con il primo ordine già nella mappa: «Ora i due binari»");
  await chiudi();
  await riapri(page); await page.getByText("Ciao Ugo").waitFor(); await page.waitForTimeout(400);
  check(!(await tr().count()), "festa di fase: la fase 3 non fa una seconda festa");
  await ctx.close();
  // D. Fase 4 chiusa: c'è solo la festa della partenza (come prima), niente festa di fase
  nuovo("ii93", "3d", "Ivo Insieme", { incontro_sponsor:giorno(-1) }); nomi("ii93", 30); mappa("ii93", 70);
  DB.activities.push({ id:"ii93p", partner_id:"ii93", tipo:"piano", quantita:1, data:giorno(0), inserito_il:ora },
    { id:"ii93c", partner_id:"ii93", tipo:"cliente", quantita:1, data:giorno(0), inserito_il:ora });
  await entra("3d", "Ivo");
  await page.locator(".festa:not(.traguardo)").waitFor(); await page.waitForTimeout(300);
  check(!(await tr().count()), "fase 4 chiusa: solo la festa della partenza, nessuna festa di fase");
  await ctx.close();
  // E. Un avviato e chi ha dichiarato la qualifica: nessuna festa di fase
  nuovo("jj93", "3e", "Lia Avviata", { data_iscrizione:giorno(-300) }); nomi("jj93", 30);
  await entra("3e", "Lia"); await page.waitForTimeout(400);
  check(!(await tr().count()), "avviato: nessuna festa di fase");
  await ctx.close();
  check(!errori.length, "festa di fase: nessun errore nella pagina");
  const tutti = ["ff93", "gg93", "hh93", "ii93", "jj93"];
  DB.partners = DB.partners.filter(p => !tutti.includes(p.id)); DB.persone = DB.persone.filter(x => !tutti.includes(x.proprietario));
  DB.activities = DB.activities.filter(a => !tutti.includes(a.partner_id)); DB.numeri = (DB.numeri || []).filter(x => !tutti.includes(x.partner_id));
  DB.obiettivi = (DB.obiettivi || []).filter(o => !tutti.includes(o.partner_id));
  DB.traguardiAperti = false;
}

// 94. La prova, Luca (il nuovo): entra con l'invito di Giulia («in attesa della mappa», non è ancora in una mappa importata),
//     trova 29 nomi nella Lista e l'incontro con lo sponsor da fissare; versione semplificata e «La prossima cosa»; fissa
//     l'incontro e scrive il trentesimo nome (festa della fase 2); bozza confermata → in attesa della mappa; «Arriva la
//     mappa con il primo ordine» nella barra (solo per Luca) → festa della fase 3; primo piano e primo cliente → festa
//     finale con «Ora hai tutta l'app» e poi la domanda sulla condivisione. Niente database.
{
  const c = await browser.newContext({ viewport:{ width:360, height:780 }, locale:"it-IT", timezoneId:"Europe/Rome", reducedMotion:"reduce", deviceScaleFactor:2 });
  const pg = await c.newPage();
  const fuori = [], err = [];
  pg.on("request", r => { if(!r.url().startsWith("http://127.0.0.1:8765/")) fuori.push(r.url()); });
  pg.on("pageerror", e => err.push(String(e))); pg.on("console", m => { if(m.type() === "error") err.push(m.text()); });
  pg.on("dialog", d => d.accept());
  const tr = pg.locator(".festa.traguardo");
  const trTesto = async () => (await tr.innerText()).replace(/\s+/g, " ").trim();
  /* l'anteprima a 360 px in chiaro e in scuro: la finestra alta quanto la pagina (le barre fisse non coprono niente) */
  const anteprima = async nome => { await pg.waitForFunction(() => !document.querySelector(".toast"), null, { timeout:8000 }).catch(() => {});
    const alta = await pg.evaluate(() => document.documentElement.scrollHeight);
    if(!(await tr.count())) await pg.setViewportSize({ width:360, height:Math.min(alta, 4000) });
    for(const tema of ["light", "dark"]){ await pg.emulateMedia({ colorScheme:tema }); await pg.waitForTimeout(150);
      check(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `prova Luca, ${nome} (${tema}) a 360 px: niente scroll orizzontale`);
      await pg.screenshot({ path: S + `/e2e/94-${nome}-${tema}.png` }); }
    await pg.emulateMedia({ colorScheme:"light" }); await pg.setViewportSize({ width:360, height:780 }); };
  await pg.goto(BASE + "prova/"); await pg.locator(".prova-scelta").waitFor();
  await pg.click("[data-prova=come][data-k=luca]");
  await pg.getByText("ti diamo il benvenuto in Growup").waitFor();
  check((await pg.locator(".chi-invita").innerText()).replace(/\s+/g, " ").includes("Ti ha invitato Giulia Martini"), "prova Luca: l'invito di Giulia");
  check(await pg.locator("form[data-form=ingresso] .field", { hasText:"La tua qualifica attuale" }).count() === 1, "prova Luca: all'ingresso «La tua qualifica attuale»");
  check(!(await pg.locator(".prova-barra [data-prova=arriva]").count()), "prova Luca: prima di entrare niente «Arriva la mappa»");
  await pg.selectOption("select[name=qualifica]", { label:"Inizio (nessuna qualifica)" });
  await pg.fill("input[name=data]", new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10));
  await pg.check("input[name=privacy]");
  await pg.click("form button.primary");
  await perche(pg);
  const pc = pg.locator(".card.percorso-partenza");
  await pc.waitFor();
  check((await pc.locator(".percorso-l li", { hasText:"30 nomi" }).innerText()).includes("29 / 30"), "prova Luca: dopo l'ingresso 29 nomi nella Lista");
  check((await pc.locator(".percorso-l li", { hasText:"Primo incontro" }).innerText()).includes("data da fissare"), "prova Luca: l'incontro con lo sponsor non è fissato");
  check(!(await pg.locator("button[data-act=sez-io][data-sez=guida]").count()) && !(await pg.locator(".domanda-condividi").count()), "prova Luca: la versione semplificata (niente Verifica)");
  check((await pg.locator(".oggi-lista .prossima-titolo").innerText()).trim() === "Fissa l'incontro con il tuo sponsor", "prova Luca: «La prossima cosa» lo guida");
  await pg.locator(".prova-barra [data-prova=arriva]").waitFor();
  check(true, "prova Luca: nella barra «Arriva la mappa con il primo ordine» (solo per Luca)");
  await anteprima("io-semplice");
  /* la Lista: 29 nomi inventati, vari, con «Come lo conosci?», nessuno «senza nome» */
  const d0 = await pg.evaluate(() => { const d = window.__DB, l = d.partners.find(p => p.codice_amway === d._prova.codiceLuca);
    return { l, persone:d.persone.filter(x => x.proprietario === l.id) }; });
  check(d0.l.confermato_il == null && d0.l.invitato_da === "G" && d0.persone.length === 29 && new Set(d0.persone.map(x => x.nome)).size === 29
    && d0.persone.every(x => x.nome && x.fonte && x.origine) && new Set(d0.persone.map(x => x.fonte)).size === 3,
    "prova Luca: in attesa della mappa, invitato da Giulia; 29 nomi diversi, tutti con «Come lo conosci?»");
  await pg.click("button[data-act=vista-persone]");
  check(!(await pg.locator("#app").innerText()).toLowerCase().includes("senza nome"), "prova Luca: nella Lista niente «senza nome»");
  await pg.click("button[data-act=vista-io]");
  /* fase 2: l'incontro, poi il trentesimo nome → la festa */
  await pg.click(".oggi-lista button[data-act=incontro-fissa]");
  await pg.locator(".sheet h2", { hasText:"Il primo incontro con il tuo sponsor" }).waitFor();
  await pg.locator(`.sheet input[name=quando][value="${new Date(Date.now() + 864e5).toISOString().slice(0, 10)}"]`).evaluate(e => e.click());
  await pg.click(".sheet button.primary");
  await pg.getByText("Primo incontro con lo sponsor: domani").waitFor();
  check(!(await tr.count()) && (await pg.locator(".oggi-lista .prossima-titolo").innerText()).trim() === "Scrivi i prossimi nomi nella Lista", "prova Luca: incontro fissato, ora il trentesimo nome");
  await pg.click(".oggi-lista .prossima-azioni button.primary");
  await pg.click("button[data-act=persona-nuova]");
  check(await pg.locator(".sheet button[data-act=rubrica], .sheet [data-act=incolla-numero]").count() >= 1, "prova Luca: nel modulo del nome Rubrica o Incolla");
  await pg.fill(".sheet input[name=nome]", "Gianna Trenta");
  await pg.click(".sheet button:has-text('Salva')");
  await tr.waitFor();
  check((await trTesto()).includes("Fase 2 completata! 30 nomi nella Lista e l'incontro con il tuo sponsor fissato. Ora il primo ordine."), "prova Luca: la festa della fase 2");
  await anteprima("festa-fase2");
  await tr.locator("button[data-act=traguardo-chiudi]").click();
  /* fase 3: la bozza confermata → in attesa della mappa */
  await pg.click("button[data-act=vista-io]");
  check((await pg.locator(".oggi-lista .prossima-titolo").innerText()).trim() === "Il tuo primo ordine", "prova Luca: «La prossima cosa»: il primo ordine");
  await pg.click(".oggi-lista .prossima-azioni button.primary");
  await pg.click(".sheet button[data-act=apri-bozze]");
  await pg.click(".sheet #le-mie-bozze button[data-act=bozza-nuova]");
  const bozza = pg.locator(".sheet #bozza-ordine"); await bozza.waitFor();
  for(const [i, cerca] of ["multivit", "proteine", "siero"].entries()){
    await pg.fill("#cerca-mio", cerca);
    await bozza.locator("button[data-act=mio-aggiungi]").first().click();
    await bozza.getByText(i ? `${i + 1} prodotti` : "1 prodotto").waitFor(); }
  await pg.click("#bozza-ordine button[data-act=mio-conferma]");
  await pg.click(".sheet button.primary");
  await pg.getByText("Ordine confermato").first().waitFor();
  await pg.click(".sheet #miei-ordini button[data-act=ordini]");
  await pg.locator(".sheet [data-act=chiudi]").last().click();
  await pg.locator(".percorso-partenza .ordine-attesa").waitFor();
  check((await pg.locator(".percorso-partenza .ordine-attesa").innerText()).replace(/\s+/g, " ").trim() === "! Ordine confermato · in attesa della mappa"
    && (await pg.locator(".percorso-partenza .fase-titolo").innerText()).trim() === "I due binari", "prova Luca: bozza confermata → «in attesa della mappa», si va ai due binari");
  /* arriva la mappa con il primo ordine → la festa della fase 3 */
  await pg.click(".prova-barra [data-prova=arriva]");
  await tr.waitFor();
  check((await trTesto()).includes("Fase 3 completata! Il tuo primo ordine è nella mappa. Ora i due binari: il primo piano e il primo cliente."), "prova Luca: arriva la mappa → la festa della fase 3");
  await tr.locator("button[data-act=traguardo-chiudi]").click();
  const d1 = await pg.evaluate(() => { const d = window.__DB, l = d.partners.find(p => p.codice_amway === d._prova.codiceLuca);
    return { conf:l.confermato_il, vp:d.numeri.filter(n => n.partner_id === l.id).map(n => n.vpp) }; });
  check(!!d1.conf && d1.vp.length === 1 && Math.abs(d1.vp[0] - 55.2) < 0.01, "prova Luca: nella mappa, con i VP della bozza confermata (" + d1.vp.join() + ")");
  check(!(await pg.locator(".prova-barra [data-prova=arriva]").count()) && !(await pg.locator(".percorso-partenza .ordine-attesa").count()), "prova Luca: niente più «Arriva la mappa» né «in attesa»");
  /* fase 4: il primo piano e il primo cliente → la festa finale, poi la domanda sulla condivisione */
  await pg.click("button[data-act=piano-rapido]");
  await pg.fill("#cerca-piano", "marco");
  await pg.locator("#risultati-piano button[data-act=piano-con]", { hasText:"Marco Sartori" }).click();
  await pg.click(".sheet button:has-text('Salva')");
  await pg.getByText("Piano segnato").waitFor();
  await pg.click("button[data-act=vista-persone]"); await pg.click("button[data-sez=clienti]");
  await pg.click("button[data-act=cliente-nuovo]");
  await pg.fill(".sheet input[name=nome]", "Rosa Prima");
  await pg.click(".sheet button.primary");
  await tr.waitFor(); await tr.locator("button[data-act=traguardo-chiudi]").click();
  await pg.click("button[data-act=vista-io]");
  const festa = pg.locator(".festa:not(.traguardo)"); await festa.waitFor();
  check((await festa.innerText()).includes("Ora hai tutta l'app."), "prova Luca: la festa finale con «Ora hai tutta l'app»");
  check(!(await pg.locator(".domanda-condividi").count()), "prova Luca: durante la festa niente domanda sulla condivisione");
  await festa.locator("button[data-act=festa-fine]").click();
  await pg.locator(".domanda-condividi").waitFor();
  check(true, "prova Luca: dopo la festa la domanda sulla condivisione");
  check(!fuori.length, "prova Luca: nessuna richiesta fuori dal sito, niente database (" + fuori.slice(0, 3).join(", ") + ")");
  check(!err.length, "prova Luca: nessun errore nella pagina (" + err.slice(0, 2).join(" | ") + ")");
  /* tornando su Luca: le feste già viste non tornano */
  await pg.click("[data-prova=scegli]"); await pg.locator(".prova-scelta").waitFor();
  await pg.click("[data-prova=come][data-k=luca]"); await pg.getByText("Ciao Luca").waitFor(); await pg.waitForTimeout(500);
  check(!(await pg.locator(".festa").count()), "prova Luca: rientrando, le feste già viste non tornano");
  await c.close();
}

// 95. La prova, Giulia «Due mesi dopo» (anche senza aver fatto il primo ingresso): Il mio giorno con il Seguimi e «Da fare oggi»
//     (i motivi sotto i nomi), la serie, «Da seguire oggi» con un nuovo fermo, uno che non aggiorna e un complimento; la Lista
//     con «Da riprendere», i clienti, il Target, la Verifica con la tabella Stabilità, il Gruppo con la struttura.
{
  const c = await browser.newContext({ viewport:{ width:390, height:844 }, locale:"it-IT", timezoneId:"Europe/Rome", reducedMotion:"reduce", deviceScaleFactor:2 });
  const pg = await c.newPage();
  const fuori = [], err = [];
  pg.on("request", r => { if(!r.url().startsWith("http://127.0.0.1:8765/")) fuori.push(r.url()); });
  pg.on("pageerror", e => err.push(String(e))); pg.on("console", m => { if(m.type() === "error") err.push(m.text()); });
  pg.on("dialog", d => d.accept());
  await pg.addLocatorHandler(pg.locator(".festa.traguardo"), async t => { await t.locator("button[data-act=traguardo-chiudi]").click(); });
  await pg.goto(BASE + "prova/"); await pg.locator(".prova-scelta").waitFor();
  await pg.click("[data-prova=come][data-k=giulia]");
  await pg.getByText("ti diamo il benvenuto in Growup").waitFor();
  await pg.click(".prova-barra [data-prova=due-mesi]");
  await pg.getByText("Ciao Giulia").waitFor();
  const app = async () => (await pg.locator("#app").innerText()).replace(/\s+/g, " ");
  check(!(await pg.locator(".primi-passi, .per-iniziare, .domanda-condividi, .card.percorso-partenza").count()), "prova Giulia, due mesi dopo: niente Primi passi, «Per iniziare» o domanda");
  /* Il mio giorno: «Da fare oggi» con i motivi sotto i nomi, la serie */
  const t0 = await app();
  check(/Da fare oggi/i.test(t0) && /\d settimane di fila/i.test(t0), "prova Giulia, due mesi dopo: «Da fare oggi» del Seguimi e la serie di settimane");
  const motiviSotto = await pg.evaluate(() => { const c = [...document.querySelectorAll("#app .card")].find(x => /Da fare oggi/i.test(x.innerText));
    return c ? [...c.querySelectorAll("li")].filter(li => li.querySelector(".small")).length : 0; });
  check(motiviSotto >= 3, "prova Giulia, due mesi dopo: in «Da fare oggi» i motivi sotto i nomi (" + motiviSotto + " righe)");
  const seg = await pg.evaluate(() => window.__DB.seguimi.find(x => x.partner_id === "G"));
  check(seg && seg.attivo && seg.condividi, "prova Giulia, due mesi dopo: Seguimi acceso e condiviso");
  /* «Da seguire oggi»: almeno tre motivi diversi */
  const ds = pg.locator(".card.da-seguire"); await ds.waitFor();
  const righe = (await ds.locator(".da-seguire-l > li").allInnerTexts()).map(x => x.replace(/\s+/g, " "));
  check(righe.length >= 3 && righe.some(r => r.includes("Sara Conti") && r.includes("Incontro con lo sponsor non ancora fissato"))
    && righe.some(r => r.includes("Paola Greco") && r.includes("Non aggiorna da 9 giorni"))
    && righe.some(r => r.includes("Valeria Testa") && /Complimento/i.test(r) && r.includes("Al 6% questo mese")),
    "prova Giulia, due mesi dopo: «Da seguire oggi» con un nuovo fermo, uno che non aggiorna e un complimento (" + righe.join(" | ") + ")");
  await pg.waitForFunction(() => !document.querySelector(".toast"), null, { timeout:8000 }).catch(() => {});
  await pg.setViewportSize({ width:360, height:Math.min(5000, await pg.evaluate(() => document.documentElement.scrollHeight)) });
  for(const tema of ["light", "dark"]){ await pg.emulateMedia({ colorScheme:tema }); await pg.waitForTimeout(150);
    check(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `prova Giulia, due mesi dopo (${tema}), 360 px: niente scroll orizzontale`);
    await pg.screenshot({ path: S + `/e2e/95-giulia-due-mesi-${tema}.png` });
    await ds.screenshot({ path: S + `/e2e/95-da-seguire-${tema}.png` }); }
  await pg.emulateMedia({ colorScheme:"light" }); await pg.setViewportSize({ width:390, height:844 });
  /* la Verifica con la tabella Stabilità */
  await pg.click("button[data-act=sez-io][data-sez=guida]");
  check(/Stabilità della tua rete/i.test(await app()), "prova Giulia, due mesi dopo: la Verifica con la tabella Stabilità");
  /* la Lista con «Da riprendere», i clienti (qualcuno da riordinare), il Target */
  await pg.click("button[data-act=vista-persone]"); await pg.click("button[data-sez=lista]");
  check(await pg.locator(".persone li.fermo").count() >= 2 && /Da riprendere/i.test(await app()), "prova Giulia, due mesi dopo: la Lista con alcuni «Da riprendere»");
  await pg.click("button[data-sez=clienti]");
  check(await pg.locator(".persone button[data-act=apri-cliente]").count() === 9, "prova Giulia, due mesi dopo: i 9 clienti");
  check(/riordin|finisc/i.test(await app()), "prova Giulia, due mesi dopo: qualche cliente da riordinare");
  await pg.click("button[data-sez=target]");
  check((await app()).includes("Carla Nuova"), "prova Giulia, due mesi dopo: il Target");
  /* il Gruppo con la struttura: i nuovi in partenza (Sara); Luca qui non è entrato */
  await pg.locator("button[data-act=vista-gruppo]").first().click();
  const g = await app();
  check(g.includes("Marco Ferri") && g.includes("Lia Conte") && await pg.locator(".nuovi-partenza", { hasText:"Sara Conti" }).isVisible()
    && !(await pg.locator(".nuovi-partenza", { hasText:"Luca Bassi" }).count()), "prova Giulia, due mesi dopo: il Gruppo con la struttura; Sara tra i nuovi (Luca non è entrato)");
  const agenda = await pg.evaluate(() => window.__DB.persone.filter(p => p.proprietario === "G" && p.prossima_data).length);
  check(agenda >= 3, "prova Giulia, due mesi dopo: l'agenda ha i suoi appuntamenti");
  check(!fuori.length, "prova Giulia, due mesi dopo: niente database (" + fuori.slice(0, 3).join(", ") + ")");
  check(!err.length, "prova Giulia, due mesi dopo: nessun errore nella pagina (" + err.slice(0, 2).join(" | ") + ")");
  await c.close();
}

// 96. La prova, controllo generale (13 novembre 2026): le date sono sempre relative a oggi, così la prova funziona in qualunque
//     giorno (inizio, metà e fine mese, a cavallo dell'anno); le notifiche restano finte (nessun permesso, nessun server);
//     nessun «senza nome»; nessun collegamento al database.
{
  const giorni = [new Date(2027, 2, 1, 9, 30), new Date(2026, 11, 31, 18, 0), new Date(2027, 1, 15, 12, 0)];
  for(const quando of giorni){
    const etichetta = quando.toISOString().slice(0, 10);
    const c = await browser.newContext({ viewport:{ width:390, height:844 }, locale:"it-IT", timezoneId:"Europe/Rome", reducedMotion:"reduce" });
    const pg = await c.newPage();
    await pg.clock.install({ time:quando });
    const fuori = [], err = [];
    pg.on("request", r => { if(!r.url().startsWith("http://127.0.0.1:8765/")) fuori.push(r.url()); });
    pg.on("pageerror", e => err.push(String(e))); pg.on("console", m => { if(m.type() === "error") err.push(m.text()); });
    pg.on("dialog", d => d.accept());
    await pg.addLocatorHandler(pg.locator(".festa.traguardo"), async t => { await t.locator("button[data-act=traguardo-chiudi]").click(); });
    await pg.goto(BASE + "prova/"); await pg.locator(".prova-scelta").waitFor();
    /* Luca: l'ingresso con i 29 nomi */
    await pg.click("[data-prova=come][data-k=luca]");
    await pg.getByText("ti diamo il benvenuto in Growup").waitFor();
    const fa4 = new Date(quando.getTime() - 4 * 864e5);
    await pg.fill("input[name=data]", `${fa4.getFullYear()}-${String(fa4.getMonth() + 1).padStart(2, "0")}-${String(fa4.getDate()).padStart(2, "0")}`);
    await pg.check("input[name=privacy]");
    await pg.click("form button.primary");
    await perche(pg);
    const pc = pg.locator(".card.percorso-partenza"); await pc.waitFor();
    check((await pc.locator(".percorso-l li", { hasText:"30 nomi" }).innerText()).includes("29 / 30"), `prova (${etichetta}): Luca con 29 nomi`);
    /* le notifiche sono finte: «Sì, attiva» non chiede niente al telefono e non va a nessun server */
    if(await pg.locator("button[data-act=notifiche-si]").count()){
      await pg.locator("button[data-act=notifiche-si]").first().click();
      await pg.waitForTimeout(500);
      check(await pg.evaluate(() => window.__DB.telefoni.length === 1 && window.__DB.telefoni[0].endpoint === "prova://questo-telefono"), `prova (${etichetta}): le notifiche restano finte`);
    }
    /* Giulia «Due mesi dopo» */
    await pg.click("[data-prova=scegli]"); await pg.locator(".prova-scelta").waitFor();
    await pg.click("[data-prova=come][data-k=giulia]");
    await pg.getByText("ti diamo il benvenuto in Growup").waitFor();
    await pg.click(".prova-barra [data-prova=due-mesi]");
    await pg.getByText("Ciao Giulia").waitFor();
    const ds = (await pg.locator(".card.da-seguire .da-seguire-l > li").allInnerTexts()).map(x => x.replace(/\s+/g, " "));
    check(ds.length >= 3 && ds.some(r => r.includes("Sara Conti") && r.includes("Incontro con lo sponsor non ancora fissato")) && ds.some(r => r.includes("Non aggiorna"))
      && ds.some(r => /Complimento/i.test(r)), `prova (${etichetta}): «Da seguire oggi» con un nuovo fermo, uno che non aggiorna e un complimento (${ds.join(" | ")})`);
    const t = (await pg.locator("#app").innerText()).replace(/\s+/g, " ");
    check(/Da fare oggi/i.test(t) && /settimane? di fila|La tua serie/i.test(t), `prova (${etichetta}): Il mio giorno con «Da fare oggi» e la serie`);
    await pg.locator("button[data-act=vista-gruppo]").first().click();
    check(await pg.locator(".nuovi-partenza", { hasText:"Luca Bassi" }).isVisible() && await pg.locator(".nuovi-partenza", { hasText:"Sara Conti" }).isVisible(),
      `prova (${etichetta}): Luca e Sara tra i nuovi in partenza di Giulia`);
    await pg.click("button[data-act=vista-persone]"); await pg.click("button[data-sez=lista]");
    check(!/senza nome/i.test(await pg.locator("#app").innerText()), `prova (${etichetta}): nella Lista di Giulia niente «senza nome»`);
    check(!fuori.length, `prova (${etichetta}): niente database (${fuori.slice(0, 3).join(", ")})`);
    check(!err.length, `prova (${etichetta}): nessun errore nella pagina (${err.slice(0, 2).join(" | ")})`);
    await c.close();
  }
  /* nessun collegamento al database: la pagina lo vieta (connect-src 'self') e non carica la libreria di Supabase */
  const html = fs.readFileSync(S + "/../prova/index.html", "utf8"), avvio = fs.readFileSync(S + "/../prova/avvio-prova.js", "utf8");
  check(/connect-src 'self'/.test(html) && !/supabase/i.test(html) && /s\.remove\(\)/.test(avvio) && !/config\.js|supabase/i.test(avvio.replace(/\/\*[\s\S]*?\*\//g, "")),
    "prova: la pagina vieta i collegamenti fuori dal sito e non carica né Supabase né config.js");
}

await browser.close();
console.log(`controlli superati: ${ok}`);
if(errori.length){ console.log("ERRORI CONSOLE:", errori); process.exitCode = 1; }
