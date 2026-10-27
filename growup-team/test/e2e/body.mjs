// 1. Ingresso dal link d'invito
let { ctx, page } = await apri({}, "#rrrr22");
await page.getByText("Ti ha invitato Stefano e Alessia").waitFor();
check(await page.getByText("A&S · Growup Team").first().isVisible(), "marchio A&S");
check(!(await page.content()).includes("CumLaude21"), "niente CumLaude21");
check(await page.getByText("Due informazioni e iniziamo").isVisible(), "nuovo testo d'ingresso");
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
await page.getByText("Due informazioni e iniziamo").waitFor(); check(true, "si torna all'invito");
await page.fill("input[name=nome]", "Anna Bianchi");
check(await page.getByText("Codice Amway Partner", { exact:true }).isVisible() && !(await page.getByText("Codice Amway Partner (facoltativo)").count()),
  "ingresso: codice Amway obbligatorio");
await page.fill("input[name=codice_amway]", "2000001"); await page.fill("input[name=codice_amway2]", "2000010");
check(await page.locator(".avviso-codice").getByText("Controlla bene il tuo codice Amway Partner.").isVisible(), "ingresso: l'avviso sul codice");
await page.click("form button.primary");
check(await page.locator(".errore").innerText() === "I due codici non sono uguali: controllali.", "ingresso: i due codici devono essere uguali");
await page.fill("input[name=codice_amway]", "2000001"); await page.fill("input[name=codice_amway2]", "2000001");
await page.click("form button.primary");
check(await page.getByText("serve la data di iscrizione").isVisible(), "data obbligatoria per chi inizia");
await page.fill("input[name=data]", "2026-10-01");
await page.check("input[name=privacy]");
check(await page.locator("form button.primary").innerText() === "Inizia", "pulsante Inizia");
await page.screenshot({ path: S + "/e2e/1-ingresso.png", fullPage:true });
await page.click("form button.primary");
// il primo obiettivo, subito dopo l'ingresso
await page.getByText("Il tuo primo obiettivo").waitFor(); check(true, "dopo l'ingresso: il primo obiettivo");
await page.click("form button.primary");
check(await page.locator(".errore").innerText() === "Scrivi quanto vorresti guadagnare al mese, per esempio 400.", "obiettivo: serve la cifra");
await page.fill("input[name=cifra]", "300");
await page.click("form button.primary");
check((await page.locator(".errore").innerText()).startsWith("Scegli il mese entro cui"), "obiettivo: serve il mese");
const entroAnna = (() => { const d = new Date(); return (d.getFullYear() + 1) + "-06"; })();
await page.fill("input[name=entro]", entroAnna);
await page.fill("textarea[name=perche]", "Per la famiglia");
await page.screenshot({ path: S + "/e2e/24-obiettivo-primo.png" });
await page.click("form button.primary");
await page.getByText("La tappa che vale la tua cifra").waitFor();
check(await page.locator(".card", { hasText:"La tappa che vale la tua cifra" }).locator("h2").innerText() === "Bronze Foundation 9%", "300 €/mese: Bronze Foundation 9%");
check(await page.getByText("Da qui: 4 tappe, compresa quella attuale.").isVisible(), "obiettivo: 4 tappe da qui");
check(await page.locator(".percorso li.attuale", { hasText:"Primo ordine" }).isVisible() && await page.locator(".percorso li.meta", { hasText:"Bronze Foundation 9%" }).isVisible(),
  "percorso: tappa attuale e tappa obiettivo");
check(await page.getByText("«Per la famiglia»").isVisible(), "il perché si vede a chi l'ha scritto");
await page.screenshot({ path: S + "/e2e/25-obiettivo.png", fullPage:true });
await page.click("button[data-act=vista-io]");
await page.getByText("Ciao Anna").waitFor(); await apriTappa(page);
check(await page.locator(".miei-numeri button[data-act=vista-obiettivo]").getByText("300 €").isVisible() && !(await page.locator(".obiettivo-breve").count()),
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
// senza nome: conta solo il piano, poi si annulla
await page.click("button[data-act=piano-rapido]");
await page.click(".sheet button[data-act=senza-nome]");
await page.getByText("Piano mostrato registrato").waitFor();
check(await page.locator("button[data-act=piano-rapido] b").innerText() === "2 questa sett.", "senza nome: piano +1");
await page.getByRole("button", { name:"Annulla" }).last().click();
await page.getByText("Annullato").waitFor();
check(await page.locator("button[data-act=piano-rapido] b").innerText() === "1 questa sett.", "annullato: di nuovo 1");
check(!(await page.locator("ul.oggi").count()), "Diario di oggi chiuso di base");
await apriDiario(page);
const oggiCard = page.locator(".card.diario");
check(await oggiCard.getByText("Contatto: Paolo Rapido").isVisible() && await oggiCard.getByText("Piano mostrato: Paolo Rapido").isVisible(),
  "Oggi: contatto e piano con il nome della persona");
await apriOrdini(page);
check(await page.locator(".sheet .scelta-ordini").allInnerTexts().then(l => l.map(t => t.split("\n")[0])).then(l => l.join("|"))
  === "Ordine veloce|Bozza ordine|I miei ordini|Aggiorna il totale del mese|Importa da Amway", "+ Ordine apre il foglio Ordini con le 5 scelte");
await page.click(".sheet button[data-act=ordine]");
check(await page.inputValue(".sheet input[name=vp]") === "" && await page.getAttribute(".sheet input[name=vp]", "placeholder") === "0", "ordine: campo vuoto con lo 0 grigio");
await page.click(".sheet button:has-text('Salva')");
await page.locator(".sheet .errore").waitFor();
check(await page.inputValue(".sheet input[name=vp]") === "", "ordine senza VP: errore e il campo resta vuoto");
await page.fill("input[name=vp]", "62,5");
await page.click(".sheet button:has-text('Salva')"); await page.getByText("Ordine da 62,5 VP registrato").waitFor();
check(await page.getByText("Primi clienti").first().isVisible(), "primo ordine fatto -> tappa 2");

// 2b. Il mio mese: + VP e niente struttura nella pagina Io
check(!(await page.locator(".miei-numeri button[data-act=ordine], .miei-numeri button[data-act=totale-mese], .miei-numeri button[data-act=importa]").count()),
  "nel mio mese niente più + Ordine, Aggiorna il totale, Importa");
// Aggiorna il totale del mese: su a 100, poi giù a 80
await apriOrdini(page, "totale-mese");
check(await page.inputValue(".sheet input[name=vp]") === "" && await page.getAttribute(".sheet input[name=vp]", "placeholder") === "62,5", "totale proposto in grigio = VP già registrati");
await page.fill(".sheet input[name=vp]", "100");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("aggiornato: 100 VP").waitFor();
check(await page.locator("button[data-act=ordini] b").first().innerText() === "100 VP nel mese", "totale del mese a 100");
await apriOrdini(page, "totale-mese");
await page.fill(".sheet input[name=vp]", "80");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("aggiornato: 80 VP").waitFor();
check(await page.locator(".oggi li", { hasText:"-20 VP" }).isVisible(), "correzione negativa nella lista di oggi");
check(await page.locator(".card", { hasText:"Il mio mese" }).getByText("/ 100").isVisible(), "obiettivo invariato");
await apriOrdini(page, "totale-mese");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Il totale era già questo").waitFor(); check(true, "nessuna correzione se il totale non cambia");
await page.locator(".card", { hasText:"Il mio mese" }).screenshot({ path: S + "/e2e/7-mese.png" });
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
const confermaCodice = async (pg, codice) => pg.evaluate(c => { const p = window.__DB.partners.find(x => x.codice_amway === c); p.confermato_il = new Date().toISOString(); }, codice);
await confermaCodice(page, "2000001");   // come dopo l'import della sua upline
await page.click("button[data-act=vista-gruppo]");
await page.getByText("Il mio gruppo").first().waitFor();
check(!(await page.locator(".azioni").count()), "niente barra azioni nella pagina Gruppo");
check(await page.getByText("Invita un nuovo partner").isVisible(), "invito nella pagina Gruppo");
check(await page.getByText("Ancora nessuno nel tuo gruppo").isVisible(), "gruppo vuoto");
check(!(await page.locator("button[data-act=aggiungi]").count()), "niente più + Aggiungi persona");
await scegliFile(page, "anna.csv", creaCsv(meseFile, [persona(1, "9", "2000001", "BIANCHI, ANNA", "80,00"),
  persona(2, "2000001", "1000001", "ROSSI, MARCO", "0,00"), persona(3, "1000001", "1000002", "VERDI, LUCA", "12,50")]), true);
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
check(await page.locator(".sheet .imp-sezione", { hasText:"Nuovi nel report · 2" }).isVisible(), "import: 2 persone nuove, entrano tutte");
check(await page.locator(".sheet input[name=nascondi]:checked").count() === 0, "import: nessuno nascosto all'inizio");
await page.click(".sheet .imp-da-scegliere button[data-act=nascondi-zero]");
check(await page.isChecked(".sheet input[name=nascondi][value='1000001']") && !(await page.isChecked(".sheet input[name=nascondi][value='1000002']")),
  "Nascondi chi ha 0 VP: solo Marco");
await page.click(".sheet .imp-da-scegliere button[data-act=nascondi-tutti]");
check(await page.locator(".sheet input[name=nascondi]:checked").count() === 2, "Nascondi tutti");
check(await page.getAttribute(".sheet .imp-da-scegliere button[data-act=nascondi-tutti]", "aria-pressed") === "true"
  && await page.getAttribute(".sheet .imp-da-scegliere button[data-act=nascondi-zero]", "aria-pressed") === "false", "il pulsante usato resta acceso, gli altri si spengono");
await page.uncheck(".sheet input[name=nascondi][value='1000001']");
check(!(await page.locator(".sheet .scelte-rapide .btn.on").count()), "una casella cambiata a mano spegne il pulsante");
await page.click(".sheet .imp-da-scegliere button[data-act=mostra-tutti]");
check(await page.locator(".sheet input[name=nascondi]:checked").count() === 0, "Mostra tutti");
check(await page.locator(".sheet label", { hasText:"Luca Verdi" }).getByText("sponsor Marco Rossi").isVisible(), "import: lo sponsor del report accanto al nome");
await page.screenshot({ path: S + "/e2e/26-importa.png", fullPage:true });
await page.click(".sheet button:has-text('Importa')");
check(await page.locator(".sheet .errore").innerText() === "Conferma di avere il consenso delle persone della tua linea.", "import: serve il consenso");
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/2 persone aggiunte/).waitFor(); check(true, "import: 2 persone aggiunte");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).getByText("senza app").isVisible(), "Marco senza app nella struttura");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).getByText("0 VP · gruppo 1.234,56").isVisible(), "numeri accanto al nome: VP di gruppo dal report");
check(await page.getByText("2 persone", { exact:true }).isVisible(), "conteggio persone del gruppo");
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
await page.locator(".griglia-azioni button[data-act=contatto]").click();
await page.getByText("Contatto registrato per Marco").waitFor();
await page.locator(".griglia-azioni button[data-act=totale-mese]").click();
check(await page.locator(".sheet h2", { hasText:"di Marco" }).isVisible(), "totale del mese di Marco");
await page.fill(".sheet input[name=vp]", "150");
await page.click(".sheet button:has-text('Salva')");
await page.getByText(/aggiornato per Marco: 150 VP/).waitFor();
check(await page.locator(".oggi li", { hasText:"Contatto" }).getByText("inserito da te").isVisible(), "ogni dato mostra chi l'ha inserito");
await sync(page);
check(DB.activities.filter(a => a.partner_id === marco.id).length === 2, "i dati sono di Marco, non miei");
await page.screenshot({ path: S + "/e2e/11-scheda-gestito.png", fullPage:true });
const invitoAnna = DB.partners.find(p => p.id === anna.id).codice_invito = "ANNA22";
await ctx.close();

// 4. Marco entra dal link d'invito di Anna con il suo codice: ritrova il suo profilo
({ ctx, page } = await apri({}, "#" + invitoAnna));
await page.getByText("Ti ha invitato Anna Bianchi").waitFor();
await page.fill("input[name=nome]", "Marco Rossi");
await page.selectOption("select[name=qualifica]", "pin:6");
await page.check("input[name=privacy]");
await page.click("form button.primary");
check(await page.locator(".errore").innerText() === "Scrivi il tuo codice Amway Partner.", "ingresso: il codice Amway è obbligatorio");
await page.fill("input[name=codice_amway]", "2000001"); await page.fill("input[name=codice_amway2]", "2000001");
await page.click("form button.primary");
check((await page.locator(".errore").innerText()).startsWith("Con questo codice Amway c'è già qualcuno che usa l'app"), "ingresso: codice di chi usa già l'app");
await page.fill("input[name=codice_amway]", "1000001"); await page.fill("input[name=codice_amway2]", "1000001");
await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor();
await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Marco").waitFor(); await apriTappa(page);
check(await page.getByText("Scrivi il tuo obiettivo").isVisible(), "obiettivo rimandato: su Io l'invito a scriverlo");
check(await page.getByText("6% raggiunto").isVisible(), "pin di Marco mostrato");
check(await page.getByText("Path to Bronze").first().isVisible(), "pin senza Bronze -> Path to Bronze");
check(await page.locator(".card", { hasText:"Il mio mese" }).locator(".vp-report").isVisible(), "033: Marco ha i VP del report importato da Anna (vincono su quelli scritti a mano)");
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).count() === 1, "033: Marco vede Luca sotto di sé, anche se l'ha importato Anna");
await page.click("button[data-act=vista-io]");
check(!(await page.getByText("3 nuove prime linee").count()) && !(await page.getByText("iscritte dal").count()), "Path to Bronze senza vincolo di data");
await page.screenshot({ path: S + "/e2e/4-marco.png", fullPage:true });
await sync(page); await ctx.close();
check(DB.partners.find(p => p.nome === "Marco Rossi").id === marco.id && DB.partners.find(p => p.nome === "Marco Rossi").stato === "attivo"
  && DB.partners.filter(p => p.nome === "Marco Rossi").length === 1, "Marco ha preso il suo profilo: ora usa l'app, nessun doppione");

// 5. Partner già avviato con pin 12%: niente data obbligatoria
({ ctx, page } = await apri({}, "#RRRR22"));
await page.getByText("Benvenuto in Growup").waitFor();
await page.fill("input[name=nome]", "Bea Verdi");
await page.fill("input[name=codice_amway]", "2000005"); await page.fill("input[name=codice_amway2]", "2000005");
await page.selectOption("select[name=qualifica]", "pin:12");
check(await page.getByText("(facoltativa)").isVisible(), "data facoltativa per chi ha già un pin");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Bea").waitFor(); await apriTappa(page);
check(await page.getByText("12% raggiunto").isVisible(), "pin 12% mostrato");
await sync(page); await ctx.close();

// 6. Bronze Foundation con pagamenti (regressione)
({ ctx, page } = await apri({}, "#RRRR22"));
await page.fill("input[name=nome]", "Ciro Neri");
await page.fill("input[name=codice_amway]", "2000006"); await page.fill("input[name=codice_amway2]", "2000006");
await page.selectOption("select[name=qualifica]", "foundation_9");
check(await page.locator("input[name=mese]").isVisible(), "campi pagamenti visibili");
await page.fill("input[name=mese]", "2026-07"); await page.fill("input[name=pagamenti]", "3");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Ciro").waitFor(); await apriTappa(page);
check(await page.getByText("Pagamenti 3 di 12, restano 15 mesi su 18").isVisible(), "pagamenti");
await page.screenshot({ path: S + "/e2e/5-avviato.png", fullPage:true });
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "niente scroll orizzontale");
await sync(page); await ctx.close();

// 7. Radice (privacy non ancora accettata) entra con il link personale
({ ctx, page } = await apri({ colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
await page.getByText("Il tuo profilo è già pronto").waitFor();
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isVisible()
  && await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).count() > 0, "033: la radice vede anche le persone importate da Anna (una sola struttura)");
// niente conferme: Bea (pin 12%) ha dichiarato un punto di partenza, lo sponsor lo vede soltanto
check(!(await page.locator("button[data-act=conferma]").count()), "nessuna conferma del punto di partenza");
check(await page.locator(".in-attesa li", { hasText:"Bea Verdi" }).isVisible() && !(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).count()),
  "033: chi è appena entrato è «In attesa della mappa», fuori dalla struttura");
await sync(page); await ctx.close();
DB.partners.find(p => p.nome === "Bea Verdi").confermato_il = new Date().toISOString();   // come dopo un import della mappa
({ ctx, page } = await apri({ colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
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
// la radice importa la sua rete: Paolo e Luca (con VPP) sì, Zeno (0 VP) no; Bea è di Ciro secondo il report
const reportRadice = creaCsv(meseFile, [persona(1, "9", "1111111", "ROSSI, MARIO", "120,00"),
  persona(2, "1111111", "2000001", "BIANCHI, ANNA", "80,00"), persona(3, "2000001", "1000003", "NERI, PAOLO", "10,00"),
  persona(3, "2000001", "1000001", "ROSSI, MARCO", "150,00"), persona(4, "1000001", "1000002", "VERDI, LUCA", "5,00"),
  persona(2, "1111111", "2000006", "NERI, CIRO", "0,00"), persona(3, "2000006", "2000005", "VERDI, BEA", "0,00"),
  persona(2, "1111111", "3000000", "ZERO, ZENO", "0,00")]);
await scegliFile(page, "radice.csv", reportRadice, true);
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
check(await page.locator(".sheet .imp-sezione", { hasText:"Usano l'app" }).getByText("Bea Verdi (da te a Ciro Neri)").isVisible(),
  "anteprima: Bea va sotto il suo sponsor del report");
await page.click(".sheet .imp-da-scegliere button[data-act=nascondi-zero]");
check(await page.locator(".sheet input[name=nascondi]:checked").count() === 1 && await page.isChecked(".sheet input[name=nascondi][value='3000000']"),
  "radice: Zeno (0 VP) da nascondere, Paolo e Luca visibili");
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/2 persone aggiunte/).waitFor(); check(true, "la radice importa tutta la sua rete (Luca c'è già: una sola struttura)");
await sync(page);
const idDi = n => DB.partners.find(p => p.nome === n).id;
check(DB.partners.find(p => p.nome === "Bea Verdi").sponsor_id === idDi("Ciro Neri"), "Bea sotto Ciro, come nel report");
check(DB.partners.filter(p => p.codice_amway === "1000002").length === 1, "033: Luca è uno solo, aggiornato dall'ultimo import");
const lucaR = DB.partners.find(p => p.codice_amway === "1000002");
check(lucaR.sponsor_id === marco.id && DB.partners.find(p => p.nome === "Paolo Neri").sponsor_id === anna.id,
  "chi usa l'app resta sotto chi usa l'app: Luca sotto Marco, Paolo sotto Anna");
const zeno = DB.partners.find(p => p.codice_amway === "3000000");
check(zeno && DB.nascosti.some(x => x.partner_id === "R" && x.nascosto_id === zeno.id), "Zeno importato e nascosto");
check(!(await page.locator(".albero.struttura li", { hasText:"Zeno Zero" }).count()) && await page.getByText("1 persona nascosta").isVisible(),
  "Zeno non si vede nella struttura: 1 persona nascosta");
// al secondo import non c'è niente da decidere
await scegliFile(page, "radice.csv", reportRadice, true);
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
check(!(await page.locator(".sheet .imp-sezione", { hasText:"Nuovi nel report" }).count()), "secondo import: nessuna persona nuova");
await page.click(".sheet button[data-act=chiudi]");
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
// la ricerca trova anche dentro un gruppo richiuso e mostra la linea fino a noi
await page.fill("#cerca-struttura", "lùca");
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isVisible()
  && await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isHidden(),
  "ricerca: Luca con la sua linea (Anna, Marco), gli altri nascosti");
check((await page.locator("#cerca-esito").innerText()).startsWith("1 persona trovata"), "ricerca: 1 persona trovata");
await page.screenshot({ path: S + "/e2e/23-ricerca.png" });
// durante la ricerca ▸ N apre anche il gruppo della persona trovata
await page.fill("#cerca-struttura", "anna");
const piegaAnna = page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator("button[data-act=piega]");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isHidden() && (await piegaAnna.innerText()).trim() === "▸ 3", "ricerca: Anna trovata, il suo gruppo chiuso (▸ 3)");
await piegaAnna.click();
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isHidden()
  && (await piegaAnna.innerText()).trim() === "▾ 3" && await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isHidden(), "ricerca: ▸ apre i frontali di Anna");
const piegaMarco = page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).locator("button[data-act=piega]");
check((await piegaMarco.innerText()).trim() === "▸ 1", "ricerca: anche Marco ha la sua freccia");
await piegaMarco.click();
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isVisible() && (await piegaMarco.innerText()).trim() === "▾ 1", "ricerca: la freccia di Marco apre Luca");
await piegaMarco.click();
check(await page.locator("#cerca-struttura").inputValue() === "anna", "ricerca: il testo cercato resta");
await piegaAnna.click();
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isHidden(), "ricerca: ▾ la richiude");
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
await page.getByText("Usa l'app: i suoi numeri li aggiorna lui.").waitFor();
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
const P = (id, nome, sponsor) => DB.partners.push({ id, nome, sponsor_id:sponsor, stato:"gestito", gestore_id:"R", codice_invito:id.toUpperCase() + "XXXX" });
P("l1", "Linea Uno", "R"); P("l1b", "Sotto Uno", "l1"); P("l2", "Linea Due", "R"); P("l3", "Linea Tre", "R");
const O = (pid, vp, tipo) => DB.activities.push({ id:"a" + DB.activities.length, partner_id:pid, tipo:tipo || "ordine", quantita:1, vp, data:oggiStr, inserito_il:new Date().toISOString() });
O("R", 120); O("l1", 150); O("l1b", 100); O("l2", 120); O("l3", 80);
for(let i = 0; i < 3; i++) DB.activities.push({ id:"c" + i, partner_id:"R", tipo:"cliente", quantita:1, data:oggiStr });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
check(await page.locator(".miei-numeri .riga-apri", { hasText:"Path to Bronze" }).isVisible(), "radice alla tappa Path to Bronze");
check(await page.locator(".req li", { hasText:"3 linee frontali" }).getByText("2 / 3").isVisible(), "linee attive vere: 2 su 3");
check(await page.locator(".spinta").innerText() === "Linee attive: 2 su 3. Manca 1 linea da 100 VP per il Path to Bronze.", "linee mancanti come dato, senza consiglio");
check(await page.locator(".linee li", { hasText:"Linea Uno" }).getByText("250 VP").isVisible(), "VP di gruppo della linea 1 (150 + 100)");
check(await page.getByText("3% questo mese").isVisible(), "percentuale del mese: 570 VP = 3%");
check(await page.locator(".card", { hasText:"Il mio mese" }).getByText("570").isVisible(), "VP di gruppo nel mio mese");
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
O("l3", 40, "rettifica"); O("l1b", 700);
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
check(await page.getByText("✓ Path to Bronze").isVisible(), "Path to Bronze riconosciuto dai numeri");
check(await page.getByText("9% questo mese").isVisible(), "1.310 VP di gruppo = 9%");
check(await page.getByText(/9% raggiunto · Bronze Foundation 9% non qualificato: mancano 2 linee da almeno 200 VP/).isVisible(), "percentuale e qualifica distinte");
await page.screenshot({ path: S + "/e2e/9-distinti.png", fullPage:true });
await sync(page); await ctx.close();
// storico: un mese chiuso da Bronze Foundation 9% -> tappa successiva e pagamenti
DB.storico = [{ partner_id:"R", mese:mesePrec + "-01", vp_personali:150, vp_gruppo:1300, linee_attive:3, percentuale:9, qualifica:"foundation_9" }];
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
check(await page.locator(".miei-numeri .riga-apri", { hasText:"Bronze Foundation 12%" }).isVisible(), "dopo un mese da Foundation 9% si punta al 12%");
check(await page.getByText(/Pagamenti 1 di 12, restano 17 mesi su 18/).isVisible(), "pagamenti contati dallo storico");
await page.click("button[data-act=storico]");
await page.getByText("Il mio storico").waitFor();
check(await page.locator(".storico li").count() >= 2, "storico: mese chiuso e mese in corso");
check(await page.locator(".storico li", { hasText:"chiuso" }).getByText("Bronze Foundation 9%").isVisible(), "qualifica del mese chiuso");
await page.screenshot({ path: S + "/e2e/10-storico.png" });
await page.click(".sheet button:has-text('Chiudi')");
// l'ordine non accetta date di mesi chiusi
await apriOrdini(page, "ordine");
check(await page.locator(".sheet input[name=data]").getAttribute("min") >= mesePrec + "-01", "data minima dell'ordine nel mese aperto");
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
A("fede", "contatto", 22); A("fede", "piano", 6); A("fede", "ordine", 1, 20);
A("cri", "contatto", 25); A("cri", "piano", 6); A("cri", "ordine", 2, 60);
/* 034: di chi usa l'app la upline vede solo i VP del report (gli ordini a mano no) */
DB.numeri = [{ visto_da:"R", partner_id:"cri", mese:oggiStr.slice(0, 7), vpp:120, vpg:120, percentuale:null, linee:[], dati_al:new Date().toISOString() }];
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
check(await prefGino.getByText("senza app · numeri inseriti dallo sponsor").isVisible() && await prefGino.locator(".obiettivo.debole").count() === 0
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
const fineMese = Number(oggiStr.slice(8, 10)) >= Number(ultimoPrec.slice(8, 10));
const rc = await riga("Contatti");
check(rc[1] === "▼ 2" && rc[2] === (fineMese ? "8" : "5") && rc[3] === "8", "contatti: 2 ora, 5 allo stesso giorno, 8 totale (" + rc.join("|") + ")");
const rp = await riga("Piani");
check(rp[1] === "1" && rp[3] === "0", "piani sopra il mese prima: nessun ▼");
const rv = await riga("VP personali");
check(rv[1] === "0" && rv[2] === "–" && rv[3] === "80", "034: VP personali di chi ha l'app dal report: questo mese e il mese prima (" + rv.join("|") + ")");
check(!(await riga("Ordini")).length, "034: gli ordini a mano di chi ha l'app non si vedono");
check((await riga("VP di gruppo"))[2] === "–", "VP di gruppo: solo il totale del mese prima");
check(await page.locator(".confronto td.sotto").count() >= 1, "valori sotto evidenziati");
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
DB.storico = [
  { partner_id:"R", mese:mese2 + "-01", vp_personali:100, vp_gruppo:300, linee_attive:1, percentuale:3, qualifica:null },
  { partner_id:"R", mese:mesePrec + "-01", vp_personali:0, vp_gruppo:80, linee_attive:0, percentuale:null, qualifica:null }];
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
check(lino.includes("▼ 0") && lino.includes("50 VP"), "dettaglio: Lino sotto il mese prima (50 VP)");
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
check(await page.locator(".voci-passi li.fatta", { hasText:"Installa l'app" }).isVisible() && !(await page.getByText("Aggiungi alla schermata Home").count()),
  "Non ora: la guida si chiude e la voce è fatta");
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
check(await page.locator(".voci-passi li.fatta", { hasText:"Installa l'app" }).isVisible(), "installata: la voce è fatta");
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
const waInvito = decodeURIComponent((await page.locator(".card", { hasText:"Invita un nuovo partner" }).locator("a.wa").getAttribute("href")).split("text=")[1]);
check(waInvito.startsWith("Ciao! Siamo Stefano e Alessia: ti mandiamo Growup") && waInvito.includes("3. Installa l'app") && waInvito.endsWith("\n\nhttp://127.0.0.1:8765/growup-team/#RRRR22"),
  "invito: nome, tre passi e link (" + waInvito.slice(0, 60) + "…)");
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
DB.obiettivi = [{ partner_id:"cri", cifra_mese:1000, entro:(new Date().getFullYear() + 1) + "-03-01", perche:"Segreto di Cri" }];
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
DB.partners.find(p => p.id === "R").codice_amway = null; DB.esclusi = [];
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
await mettiFile(page, { name:"altri.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(meseFile, [persona(1, "1", "1234567", "ROSSI, MARIO", "1"), persona(2, "1234567", "9999999", "ALTRO, ALDO", "1")])) });
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
await page.click(".sheet button[data-act=chiudi]");
const meseVecchio = (() => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 7).replace("-", ""); })();
await scegliFile(page, "vecchio.csv", creaCsv(meseVecchio, righeCsv));
await page.locator(".sheet .errore, .sheet button:has-text('Salva i numeri')").first().waitFor();
check(await page.getByText("Prima importa il report del mese in corso").isVisible() || await page.getByText("È un mese chiuso: salvo solo i numeri").isVisible(),
  "import: un mese chiuso salva solo i numeri (serve prima il codice dal mese in corso)");
await mettiFile(page, { name:"report.xlsx", mimeType:"application/octet-stream", buffer:Buffer.from("PK") });
check(await page.locator(".sheet").getByText("sul sito Amway scegli il formato CSV").isVisible(), "import: il file Excel non va, serve il CSV");
await mettiFile(page, { name:"los.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(meseFile, righeCsv)) });
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
const sez = t => page.locator(".sheet .imp-sezione", { hasText:t });
check(await sez("Si aggiornano i numeri").locator("li", { hasText:"Stefano e Alessia (tu)" }).getByText("400 VP").isVisible()
  && await sez("Si aggiornano i numeri").getByText("il tuo codice 1234567 viene salvato").isVisible(), "anteprima: i miei VPP e il mio codice dalla prima riga");
check(await sez("Si aggiornano i numeri").locator("li", { hasText:"Gino Gestito" }).getByText("1.055,5 VP").isVisible(), "anteprima: Gino, abbinato per codice");
check(!(await sez("Nome uguale, codice diverso").count()) && !(await sez("trovati per nome").count()), "niente più abbinamenti per nome");
check(await sez("Non più nel report").getByText("Ugo Uscito (3000004)").isVisible() && !(await page.locator(".sheet input[name=cancella]").count()),
  "anteprima: Ugo non più nel report, nessuna cancellazione");
check(await sez("Usano l'app").isVisible(), "anteprima: chi usa l'app non viene toccato");
check(await page.isChecked(".sheet input[name=modo][value=tieni]") && !(await page.locator(".sheet .imp-esistenti").isVisible()),
  "reimport: di base lascia tutto com'è");
check(await sez("Nuovi nel report · 1").isVisible() && !(await page.isChecked(".sheet input[name=nascondi]")), "anteprima: Nino entra, non nascosto");
await page.screenshot({ path: S + "/e2e/27-importa-conferme.png", fullPage:true });
await page.click(".sheet button:has-text('Importa')");
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/persone aggiornate.*1 persona non più nel report/).waitFor(); check(true, "import fatto");
await sync(page);
const vppDi = id => DB.activities.filter(a => a.partner_id === id && ["ordine","rettifica"].includes(a.tipo) && a.data.slice(0, 7) === oggiStr.slice(0, 7))
  .reduce((t, a) => t + Number(a.vp), 0);
/* 033: i VPP ufficiali stanno nei numeri del report (vincono sugli ordini scritti a mano) */
const numDi = id => (DB.numeri || []).filter(x => x.partner_id === id && x.mese === oggiStr.slice(0, 7)).pop() || {};
check(DB.partners.find(p => p.id === "R").codice_amway === "1234567" && Math.abs(numDi("R").vpp - 400) < 0.001, "i miei VPP del mese sono quelli del report");
check(numDi("imp-gino").vpp === 1055.5, "VPP delle persone importate");
check(DB.nascosti.some(x => x.nascosto_id === "imp-gino"), "Lascia tutto com'è: Gino resta nascosto anche se ha fatto VP");
check(DB.partners.find(p => p.id === "imp-ugo").fuori_report_dal && DB.nascosti.some(x => x.nascosto_id === "imp-ugo"), "Ugo resta, segnato e nascosto");
check(!DB.activities.some(a => a.tipo === "rettifica" && a.inserito_da === "R" && usanoApp.some(p => p.id === a.partner_id)), "nessun dato di chi usa l'app toccato");
const nRett = DB.activities.filter(a => a.tipo === "rettifica").length;
await scegliFile(page, "los.csv", creaCsv(meseFile, righeCsv));
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
check(!(await sez("Non più nel report").count()) && !(await page.getByText("viene salvato").count()) && !(await sez("Nuovi nel report").count()),
  "reimport: niente più da confermare");
// riapplica i filtri a tutti: Gino (con VP) torna visibile, Nino lo nascondo io
await page.check(".sheet input[name=modo][value=filtri]");
await page.click(".sheet .imp-filtri button[data-act=nascondi-zero]");
check(!(await page.isChecked(".sheet .imp-esistenti input[value=imp-gino]")), "filtro 0 VP riapplicato: Gino con VP non è spuntato");
check(await page.locator(".sheet .imp-esistenti label", { hasText:"Gino Gestito" }).getByText("Livello 2 · sotto te").isVisible(), "anteprima: dove sta ognuno");
await page.locator(".sheet .imp-esistenti label", { hasText:"Nino" }).locator("input").check();
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/1 nascosta, 1 di nuovo visibile/).waitFor();
await sync(page);
check(!DB.nascosti.some(x => x.nascosto_id === "imp-gino") && DB.nascosti.some(x => x.nascosto_id === idDi("Nino Nuovo")), "Riapplica i filtri: Gino visibile, Nino nascosto");
check(DB.activities.filter(a => a.tipo === "rettifica").length === nRett, "reimport dello stesso file: nessun dato nuovo");
await scegliFile(page, "di-altri.csv", creaCsv(meseFile, [persona(1, "1", "7777777", "ALTRO, ALDO", "1")]));
await page.locator(".sheet .errore").waitFor();
check(await page.locator(".sheet .errore").getByText("il tuo codice nell'app è 1234567").isVisible()
  && await page.locator(".sheet .errore").getByText("correggilo in fondo alla pagina Io").isVisible(), "import: il report di un altro partner è rifiutato (admin: correggi)");
await page.click(".sheet button[data-act=chiudi]");
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Gino Gestito" }).locator("button[data-act=apri-scheda]").click();
await page.getByText("Scheda partner").waitFor();
const testoScheda = await page.locator("#app").innerText();
check(testoScheda.includes("Codice Amway 3000001") && !(await page.locator(".card button[data-act=codice]").count()), "scheda: codice Amway, senza modifica per chi è importato");
await page.click("button.link[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Ivo Attivo" }).locator("button[data-act=apri-scheda]").click();
await page.click(".card button[data-act=codice]");
await page.fill(".sheet input[name=codice_amway]", "1234567");
await page.click(".sheet button:has-text('Salva')");
check(await page.locator(".sheet .errore").innerText() === "Questo codice Amway è già di un'altra persona nell'app.", "codice già usato: rifiutato");
await page.click(".sheet button[data-act=chiudi]");
// ricerca per nome o per codice tra le persone da scegliere
await page.click("button.link[data-act=vista-gruppo]");
const molti = Array.from({ length:12 }, (_, i) => persona(2, "1234567", String(7000000 + i), "PROVA, PERSONA" + i, "0,00"));
await scegliFile(page, "molti.csv", creaCsv(meseFile, [persona(1, "1", "1234567", "ROSSI, MARIO", "1")].concat(molti)), true);
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
await page.fill(".sheet input[data-cerca='.imp-nuovi']", "7000005");
check(await page.locator(".sheet .imp-nuovi label:visible").count() === 1, "ricerca per codice tra le persone da scegliere");
await page.fill(".sheet input[data-cerca='.imp-nuovi']", "persona1");
check(await page.locator(".sheet .imp-nuovi label:visible").count() === 3, "ricerca per nome (Persona1, Persona10, Persona11)");
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
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/3 persone aggiunte/).waitFor();
check(await page.locator(".albero.struttura li", { hasText:"Bianca Platini" }).getByText("gruppo 5.300").isVisible(), "Platino: VP di gruppo dal report");
await page.locator(".albero.struttura li", { hasText:"Bianca Platini" }).locator("button[data-act=apri-scheda]").click();
check(await page.getByText("Linee non visibili nel report").isVisible() && await page.locator(".dati-scheda").getByText("15%").isVisible(), "scheda del Platino: 15%, linee non visibili");
await azioniScheda(page);
check(await page.locator(".card", { hasText:"Inviti · solo admin" }).isVisible(), "admin: inviti nella scheda");
await sync(page);
const bianca = DB.partners.find(p => p.codice_amway === "4100001");
check((await page.locator(".card", { hasText:"Inviti · solo admin" }).locator(".linkbox").innerText()).endsWith("#" + bianca.codice_invito), "link d'invito sotto Bianca");
await page.screenshot({ path: S + "/e2e/28-platino.png", fullPage:true });
await page.click("button[data-act=vista-io]");
check(await page.getByText("dal report Amway").first().isVisible() && await page.getByText("18% questo mese").isVisible(), "pagina Io: percentuale ufficiale dal report");
await ctx.close();
// Nora entra con il link sotto Bianca
({ ctx, page } = await apri({}, "#" + bianca.codice_invito));
await page.getByText("Ti ha invitato Bianca Platini").waitFor();
await page.fill("input[name=nome]", "Nora Sotto"); await page.fill("input[name=codice_amway]", "4000002"); await page.fill("input[name=codice_amway2]", "4000002");
await page.fill("input[name=data]", oggiStr); await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor();
await sync(page); await ctx.close();
const nora = DB.partners.find(p => p.nome === "Nora Sotto");
check(nora.sponsor_id === bianca.id && nora.stato === "attivo", "Nora sotto Bianca, usa l'app");
nora.confermato_il = new Date().toISOString();   // 033: come dopo un import della mappa che la mostra
// la radice crea il link per chi manca tra Bianca e Nora
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Nora Sotto" }).locator(".livello").innerText() === "3", "Nora sotto Bianca nella struttura della radice");
await page.locator(".albero.struttura li", { hasText:"Nora Sotto" }).locator("button[data-act=apri-scheda]").click();
await azioniScheda(page);
await page.click("button[data-act=invito-sopra]");
await page.click(".sheet button:has-text('Crea il link')");
const linkSopra = await page.locator(".sheet .linkbox").innerText();
check(/#S[A-Z0-9]{5}$/.test(linkSopra), "link speciale creato");
await sync(page); await ctx.close();
({ ctx, page } = await apri({}, "#" + linkSopra.split("#")[1]));
await page.getByText("Ti ha invitato Bianca Platini").waitFor();
await page.fill("input[name=nome]", "Mirco Mezzo"); await page.fill("input[name=codice_amway]", "4000003"); await page.fill("input[name=codice_amway2]", "4000003");
await page.fill("input[name=data]", oggiStr); await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor();
await sync(page); await ctx.close();
const mirco = DB.partners.find(p => p.nome === "Mirco Mezzo");
check(mirco.sponsor_id === bianca.id && DB.partners.find(p => p.nome === "Nora Sotto").sponsor_id === mirco.id, "Mirco entra tra Bianca e Nora");
({ ctx, page } = await apri({}, "#" + linkSopra.split("#")[1]));
await page.getByText(/link d'invito non è valido|Entra in Growup|Benvenuto/).first().waitFor();
check(!(await page.getByText("Ti ha invitato Bianca Platini").count()), "il link speciale vale una volta sola");
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
const cardIo = page.locator(".card", { hasText:"Il tuo percorso con la lista" });
check(await cardIo.getByText("Luigi Verdi").isVisible(), "Io: Luigi, contattato, compare come promemoria");
await cardIo.locator("button[data-act=togli-da-io]").click();
await page.getByText("Luigi tolto da Io").waitFor();
check(!(await page.locator(".card", { hasText:"Il tuo percorso con la lista" }).count()), "tolto da Io: non compare più");
await page.click("button[data-act=vista-persone]");
await page.locator("button[data-act=apri-persona]", { hasText:"Luigi Verdi" }).click();
check(await page.locator("button[data-act=rimetti-in-io]").isVisible(), "nella scheda: Rimetti in Io");
await page.click("button[data-act=prossima]");
await page.click(".sheet label.chip:has-text('Domani')");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Prossima cosa salvata").waitFor();
check(await page.locator("button[data-act=togli-da-io]").isVisible(), "fissando una data la persona torna su Io da sola");
await page.click("button[data-act=vista-io]");
check(await cardIo.getByText("Luigi Verdi").isVisible(), "dalla scheda si rimette in Io");
await cardIo.locator("button[data-act=apri-persona]").click();
await page.getByText("Prossima cosa", { exact:true }).waitFor();
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
check(await page.getByText("Mandagli il tuo link d'invito").isVisible(), "Partner: si manda il link d'invito di Growup");
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
check(!await page.locator("button[data-act=apri-persona]", { hasText:"Nina Nonora" }).count(), "Non ora: non è tra gli Aperti");
await page.click("button[data-filtro=riprendere]");
check(await page.locator("button[data-act=apri-persona]", { hasText:"Nina Nonora" }).isVisible(), "Non ora: è in Da riprendere");
await page.click("button[data-filtro=aperti]");
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
await page.click("button[data-filtro=aperti]");
await page.click("button[data-act=persone-tante]");
await page.fill(".sheet textarea[name=righe]", "Marta Neri, 333 999, palestra\nLuigi Verdi");
await page.click(".sheet button:has-text('Aggiungi')");
await page.getByText("1 nome aggiunto").waitFor();
check(await page.getByText("Chiusi · 2").isVisible() && await page.getByText("In lista · 1").isVisible(), "filtri con i conteggi (il cliente non è tra i chiusi)");
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
pc.on("pageerror", e => errori.push(String(e)));
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
const pc2 = await ctxC2.newPage();
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
const cardCli = page.locator(".card", { hasText:"I tuoi clienti da sentire" });
check(await cardCli.getByText("Sta finendo: Prodotto Ugo").isVisible(), "Io: Ugo da sentire, il prodotto sta finendo");
check(await cardCli.getByText("Come si è trovato con Prodotto Vera").isVisible(), "Io: Vera, come si è trovata (prodotto nuovo da 10 giorni)");
check(await cardCli.getByText(/Compleanno il/).isVisible(), "Io: il compleanno di Bea tra 3 giorni");
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
const cardSentire = page.locator(".card", { hasText:"I tuoi clienti da sentire" });
await cardSentire.locator("li", { hasText:"Bea Compleanno" }).locator("button[data-act=togli-da-io]").click();
await page.getByText("Bea tolto da Io").waitFor();
check(!(await page.locator(".card", { hasText:"I tuoi clienti da sentire" }).locator("li", { hasText:"Bea Compleanno" }).count()), "Io: il cliente tolto non compare più");
await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]"); await page.click("button[data-filtro=tutti]");
await page.locator("button[data-act=apri-cliente]", { hasText:"Bea Compleanno" }).click();
await page.click("button[data-act=rimetti-in-io]");
await page.getByText("Di nuovo in Io").waitFor();
await page.click("button[data-act=vista-io]");
check(await page.locator(".card", { hasText:"I tuoi clienti da sentire" }).locator("li", { hasText:"Bea Compleanno" }).isVisible(), "dalla scheda del cliente: Rimetti in Io");
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
check(await page.locator(".card", { hasText:"I tuoi clienti da sentire" }).getByText("di solito ordina ogni 40 giorni").isVisible(), "Io: Lia da sentire, ordina ogni 40 giorni");
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
({ ctx, page } = await apri({}, "#RRRR22"));
await page.getByText("Benvenuto in Growup").waitFor();
await page.fill("input[name=nome]", "Dino Prova");
await page.fill("input[name=codice_amway]", "2000099"); await page.fill("input[name=codice_amway2]", "2000099");
await page.selectOption("select[name=qualifica]", "pin:6");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
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
await page.click(".sheet button[data-act=senza-nome]");
await page.locator(".annuncio-festa", { hasText:"Obiettivo contatti raggiunto!" }).waitFor();
check(await page.locator("canvas.coriandoli").count() === 1, "al traguardo i coriandoli su tutto lo schermo");
await page.locator("canvas.coriandoli").waitFor({ state:"detached", timeout:6000 });
await page.click("button[data-act=contatto-rapido]");
await page.click(".sheet button[data-act=senza-nome]");
await page.getByText("Contatto registrato").waitFor();
await page.waitForTimeout(400);
check(!(await page.locator("canvas.coriandoli").count()) && !(await page.locator(".annuncio-festa").count()), "lo stesso traguardo si festeggia una volta sola");
await ctx.close();

// 31. "Come arrivarci": i consigli a richiesta, in Obiettivo (per me) e nella scheda partner (per lo sponsor)
{
  const R = DB.partners.find(p => p.id === "R");
  Object.assign(R, { qualifica_iniziale:"path_to_bronze", codice_amway:"7000000" });
  DB.partners = [R]; DB.activities = []; DB.numeri = []; DB.storico = []; DB.nascosti = []; DB.obiettivi = [];
  const G = (id, nome, sponsor, codice) => DB.partners.push({ id, nome, sponsor_id:sponsor, stato:"gestito", gestore_id:"R", codice_invito:id.toUpperCase() + "QQQQ", codice_amway:codice || null });
  const V = (pid, vp) => DB.activities.push({ id:"ca" + DB.activities.length, partner_id:pid, tipo:"ordine", quantita:1, vp, data:oggiStr, inserito_il:new Date().toISOString() });
  G("ca", "Linea Alfa", "R", "7000001"); G("cb", "Linea Beta", "R", "7000002"); G("cb1", "Beta Uno", "cb"); G("cb2", "Beta Due", "cb"); G("cb3", "Beta Tre", "cb");
  G("cc", "Linea Gamma", "R", "7000003");
  V("R", 120); V("cb2", 5); V("cb3", 55); V("cc", 150);
  const report = linee => { DB.numeri = [{ visto_da:"R", partner_id:"R", mese:oggiStr.slice(0, 7), vpp:120, vpg:120 + linee.reduce((t, l) => t + l.vpg, 0), percentuale:null, linee }]; };
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
    && await lui.getByText("Calcolato sui numeri del mese fino a oggi. Sono spunti: la strada la decidete voi.").isVisible(), "sotto la tabellina solo la nota finale");
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
({ ctx, page } = await apri({}, "#RRRR22"));
await page.getByText("Benvenuto in Growup").waitFor();
await page.fill("input[name=nome]", "Pia Prova"); await page.fill("input[name=codice_amway]", "7100001"); await page.fill("input[name=codice_amway2]", "7100001");
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
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
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
  ({ ctx, page } = await apri({}, "#RRRR22"));
  await page.getByText("Benvenuto in Growup").waitFor();
  await page.fill("input[name=nome]", "Gaia Prova"); await page.fill("input[name=codice_amway]", "7200001"); await page.fill("input[name=codice_amway2]", "7200001");
  await page.selectOption("select[name=qualifica]", "argento");
  check(await page.locator("[data-etichetta-mese]").innerText() === "Mese della prima qualifica Argento" && await page.locator("[data-mostra=pagamenti]").isHidden(),
    "Argento: si chiede il mese della prima qualifica Argento (senza pagamenti)");
  await page.fill("input[name=mese]", mm(-3));
  await page.check("input[name=privacy]"); await page.click("form button.primary");
  await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
  await page.getByText("Ciao Gaia").waitFor(); await apriTappa(page);
  const reqOro = page.locator(".req li", { hasText:"Mesi da Argento (21%)" });
  check(await page.locator(".miei-numeri .riga-apri b", { hasText:/^Oro$/ }).isVisible() && (await reqOro.locator(".num").innerText()) === "0 / 3", "dopo Argento la tappa è Oro: 0 mesi su 3");
  check(await page.locator(".report-da-importare .mesi-report li").count() === 3 && !(await page.locator(".report-da-importare li.ok").count()),
    "report da importare: i 3 mesi dalla prima qualifica Argento");
  // il report di un mese chiuso: solo numeri (033: chi è nella mappa può importare)
  await confermaCodice(page, "7200001");
  const gaia = persona(1, "1000000", "7200001", "PROVA, GAIA", "120"); gaia[10] = "'10.500,00"; gaia[13] = "'21%";
  await scegliFile(page, "passato.csv", creaCsv(mm(-3).replace("-", ""), [gaia]));
  await page.locator(".sheet button", { hasText:"Salva i numeri" }).waitFor();
  check(await page.getByText("È un mese chiuso: salvo solo i numeri").isVisible(), "report di un mese chiuso: si salvano solo i numeri");
  await page.click(".sheet button:has-text('Salva i numeri')");
  await page.getByText(/Numeri di .* salvati/).waitFor();
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
  check(await page.locator(".sheet .field span", { hasText:"La tua qualifica oggi" }).isVisible(), "l'etichetta: La tua qualifica oggi");
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
  await page.locator(".sheet h2", { hasText:"Report di più mesi" }).waitFor();
  check(await page.locator(".sheet ul.imp li").count() === 2 && await page.getByText("sbagliato.csv:").isVisible()
    && await page.getByText("(mese in corso): l'import completo").isVisible(), "anteprima: 2 mesi chiusi, il mese in corso dopo, il file sbagliato segnalato con il nome");
  await page.click(".sheet button:has-text('Salva i numeri')");
  await page.getByText(/Numeri salvati: .*, /).waitFor();
  await sync(page);
  check(DB.numeri.filter(x => x.visto_da === "lea" && x.partner_id === "lea" && [mm(-3), mm(-2)].includes(x.mese)).length === 2, "salvati i numeri dei due mesi chiusi");
  // il file sbagliato è segnalato subito e non entra nell'import: dopo i mesi chiusi si passa al mese in corso
  await page.locator(".sheet h2", { hasText:`Report di ` }).filter({ hasNotText:"più mesi" }).waitFor();
  check(await page.locator(".sheet button.primary", { hasText:"Importa" }).isVisible(), "poi l'import completo del mese in corso");
  await ctx.close();
}

// 37. La cifra porta anche oltre Argento: sempre la qualifica senza "Fondatore", Oro mai
{
  const obiettivoDi = async cifra => {
    DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id !== "R").concat([{ partner_id:"R", cifra_mese:cifra, entro:"2027-12-01", perche:null }]);
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
  const conFile = async (pg, nome, testo, ms) => pg.evaluate(([n, t, m]) => {
    const f = new File([t], n, { type:"text/csv", lastModified:m }), dt = new DataTransfer(); dt.items.add(f);
    const i = document.querySelector(".sheet #file-report") || document.querySelector("input.file-amway"); i.files = dt.files; i.dispatchEvent(new Event("change", { bubbles:true })); }, [nome, testo, ms]);
  const codR = DB.partners.find(p => p.id === "R").codice_amway;
  DB.numeri = DB.numeri.filter(x => !(x.partner_id === "R" && x.mese === oggiStr.slice(0, 7)))
    .concat([{ visto_da:"R", partner_id:"R", mese:oggiStr.slice(0, 7), vpp:300, vpg:5000, percentuale:15, linee:[], dati_al:new Date().toISOString() }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await page.click("button[data-act=vista-gruppo]");
  await conFile(page, "vecchio.csv", creaCsv(meseFile, [persona(1, "9", codR, "ROSSI, MARIO", "120,00")]), Date.now() - 5 * 86400000);
  await page.locator(".sheet .data-report").waitFor();
  check((await page.locator(".sheet .data-report").innerText()).startsWith("File del ") && await page.locator(".sheet .data-report").getByText("più vecchio dell'ultimo importato").isVisible(),
    "anteprima: la data del file e l'avviso che è più vecchio");
  await page.click(".sheet button:has-text('Importa')");
  await page.getByText(/già più aggiornat/).waitFor();
  await sync(page); await ctx.close();
  check((DB.numeri.filter(x => x.partner_id === "R" && x.mese === oggiStr.slice(0, 7)).pop() || {}).vpp === 300, "un file più vecchio non cambia i miei numeri");
  // chi è appena entrato (in attesa) non può importare
  ({ ctx, page } = await apri({}, "#RRRR22"));
  await page.getByText("Benvenuto in Growup").waitFor();
  await page.fill("input[name=nome]", "Quinto Prova"); await page.fill("input[name=codice_amway]", "7500001"); await page.fill("input[name=codice_amway2]", "7500001");
  await page.selectOption("select[name=qualifica]", "pin:3");
  await page.check("input[name=privacy]"); await page.click("form button.primary");
  await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
  await page.getByText("Ciao Quinto").waitFor(); await apriTappa(page);
  check(await page.locator(".primi-passi .stato-attesa").isVisible(), "Quinto: in attesa della mappa");
  await scegliFile(page, "quinto.csv", creaCsv(meseFile, [persona(1, "9", "7500001", "PROVA, QUINTO", "50,00")]));
  await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
  await page.click(".sheet button:has-text('Importa')");
  await page.locator(".sheet .errore").waitFor();
  check((await page.locator(".sheet .errore").innerText()).startsWith("Sei ancora in attesa della mappa"), "chi è in attesa non cambia la struttura degli altri");
  await ctx.close();
}

// 39. I miei ordini (034): report + i miei ordini scritti dopo (solo per me), la bozza d'ordine e lo storico
{
  DB.listino = [{ codice:"9100001", nome:"Crema Prova", formato:"50 ml", categoria:"Bellezza", prezzo_cliente:52.9, prezzo_partner:41.3, vp:18.2, attivo:true },
    { codice:"9100002", nome:"Detersivo Prova", formato:"1 l", categoria:"Casa", prezzo_cliente:17.6, prezzo_partner:13.7, vp:6.1, attivo:true }];
  DB.ordiniMiei = []; DB.righeMie = [];
  const unOraFa = new Date(Date.now() - 3600000).toISOString();
  DB.numeri = DB.numeri.filter(x => !(x.partner_id === "R" && x.mese === oggiStr.slice(0, 7)))
    .concat([{ visto_da:"R", partner_id:"R", mese:oggiStr.slice(0, 7), vpp:300, vpg:5000, percentuale:15, linee:[], dati_al:unOraFa }]);
  DB.activities = DB.activities.filter(a => a.partner_id !== "R")
    .concat([{ id:"prima1", partner_id:"R", tipo:"ordine", quantita:1, vp:40, data:oggiStr, inserito_da:"R", inserito_il:new Date(Date.now() - 7200000).toISOString() }]);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  const mese = page.locator(".card", { hasText:"Il mio mese" });
  const vpFatti = async () => (await mese.locator(".obiettivo", { hasText:"VP personali" }).locator(".num").innerText()).split("/")[0].trim();
  check(await vpFatti() === "300", "034: l'ordine scritto prima del report non si somma (300 VP)");
  check((await mese.locator(".vp-report").innerText()).startsWith("300 VP dal report del "), "034: la riga dice da dove viene il numero");
  // la bozza: dal foglio «Ordini»; cerco, aggiungo, cambio le quantità
  check(!(await page.locator("#bozza-ordine").count()) && !(await page.locator("#miei-ordini").count()), "bozza e storico non sono più nella pagina Io");
  await apriOrdini(page, "apri-bozza");
  const bozza = page.locator(".sheet #bozza-ordine");
  check(await bozza.getByText("Vuota").isVisible() && await bozza.getByText("La bozza la vedi solo tu.").isVisible(), "bozza ordine vuota nel foglio Ordini");
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
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/39-bozza-ordine.png" });
  await page.click(".sheet #bozza-ordine button[data-act=ordini]");
  check((await page.locator(".sheet .scelta-ordini", { hasText:"Bozza ordine" }).innerText()).includes("2 prodotti · salvata"), "Indietro: il foglio Ordini dice quanti prodotti ha la bozza");
  await sync(page);
  check(DB.ordiniMiei.length === 1 && DB.ordiniMiei[0].stato === "bozza" && DB.righeMie.length === 2, "la bozza è salvata nel database");
  await ctx.close();
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await apriOrdini(page, "apri-bozza");
  check(await page.locator("#bozza-ordine").getByText("2 prodotti").isVisible(), "riaprendo l'app la bozza c'è ancora");
  // confermo: i VP vanno nel mese, solo per me
  await page.click("#bozza-ordine button[data-act=mio-conferma]");
  await page.locator(".sheet").getByText("Confermi l'ordine?").waitFor();
  check((await page.locator("#testo-conferma-mio").innerText()).includes("Li vedi solo tu finché non arriva il report Amway"), "conferma: i VP li vedo solo io");
  await page.click(".sheet button[data-act=apri-bozza]");
  check(await page.locator(".sheet #bozza-ordine").getByText("2 prodotti").isVisible(), "conferma, Indietro: si torna alla bozza");
  await page.click("#bozza-ordine button[data-act=mio-conferma]");
  await page.click(".sheet button.primary");
  await page.getByText("Ordine confermato: 42,50 VP nel mese").waitFor();
  const storico = page.locator(".sheet #miei-ordini");
  check(await storico.isVisible(), "dopo la conferma si vede «I miei ordini»");
  const mese2 = page.locator(".card", { hasText:"Il mio mese" });
  check((await mese2.locator(".obiettivo", { hasText:"VP personali" }).locator(".num").innerText()).startsWith("342,5"), "034: report + il mio ordine dopo il report (342,5 VP)");
  check((await mese2.locator(".vp-report").innerText()).includes("+ 42,5 VP dei tuoi ordini scritti dopo: li vedi solo tu"), "034: la parte scritta da me si vede a parte");
  check(await mese2.locator(".bar.doppia > i.rep").count() === 1, "la barra divide report e ordini scritti dopo");
  check((await storico.innerText()).includes("2 prodotti") && (await storico.innerText()).includes("42,50 VP"), "l'ordine è nello storico");
  await storico.locator("button[data-act=mio-apri]").click();
  check((await storico.innerText()).includes("2 × Crema Prova"), "toccando l'ordine si vedono i prodotti");
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/39-miei-ordini.png" });
  await page.click(".sheet #miei-ordini button[data-act=ordini]");
  check((await page.locator(".sheet .scelta-ordini", { hasText:"Bozza ordine" }).innerText()).includes("Prepara l'ordine"), "dopo la conferma la bozza è vuota");
  await page.click(".sheet [data-act=chiudi]");
  await mese2.screenshot({ path: S + "/e2e/39-mio-mese.png" });
  // rifai: i prodotti tornano in una nuova bozza
  await apriOrdini(page, "apri-miei");
  await storico.locator("button[data-act=mio-rifai]").click();
  await page.getByText("Prodotti copiati nella bozza ordine").waitFor();
  await page.click(".sheet #miei-ordini button[data-act=ordini]");
  await page.click(".sheet button[data-act=apri-bozza]");
  check(await page.locator("#bozza-ordine").getByText("2 prodotti").isVisible()
    && (await page.locator("#bozza-ordine .tot-mio").innerText()).startsWith("42,50"), "Rifai: stessi prodotti e quantità nella bozza");
  await page.click("#bozza-ordine button[data-act=mio-svuota]");
  await page.getByText("Bozza svuotata").waitFor();
  // togli l'ordine: chiede conferma, poi i VP escono dal mese
  await page.click(".sheet #bozza-ordine button[data-act=ordini]");
  await page.click(".sheet button[data-act=apri-miei]");
  await storico.locator("button[data-act=mio-togli]").click();
  await page.locator(".sheet h2", { hasText:"Togli l'ordine del" }).waitFor();
  check((await page.locator(".sheet").innerText()).includes("I 42,50 VP escono dal tuo mese di"), "togli: la conferma dice quanti VP escono dal mese");
  await page.click(".sheet [data-act=apri-miei]");
  check(await page.locator("#miei-ordini button[data-act=mio-togli]").count() === 1, "Indietro: l'ordine resta");
  await page.locator("#miei-ordini button[data-act=mio-togli]").click();
  await page.click(".sheet [data-act=mio-togli-ok]");
  await page.getByText("Ordine tolto").waitFor();
  check(await page.locator("#miei-ordini").getByText("Ancora nessun ordine confermato").isVisible()
    && (await page.locator(".card", { hasText:"Il mio mese" }).locator(".obiettivo", { hasText:"VP personali" }).locator(".num").innerText()).startsWith("300"),
    "ordine tolto: via dallo storico e i VP tornano al report");
  await sync(page);
  check(!DB.ordiniMiei.length && !DB.righeMie.length && !DB.activities.some(a => a.partner_id === "R" && a.vp === 42.5), "nel database: via l'ordine, i prodotti e i VP del mese");
  await ctx.close();
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
    await page.click(".card button[data-act=storico]");
    await page.locator(".sheet .storico li").first().waitFor();
    return (await page.locator(".sheet .storico li").first().innerText()).replace(/\s+/g, " ");
  };
  let t = await storicoR();
  check(!/Diamante|Fondatore/.test(t), "storico: niente più Diamante Fondatore inventato (" + t + ")");
  await page.click(".sheet [data-act=chiudi]");
  const parti = await page.locator(".card", { hasText:"Il mio mese" }).locator(".bar.doppia > i").evaluateAll(l => l.map(i => parseFloat(i.style.width)));
  check(parti.length === 2 && parti[0] > 0 && parti[1] > 0 && parti[0] + parti[1] <= 100,
    "oltre l'obiettivo la barra si divide in proporzione: report e ordini scritti dopo (" + parti.join(" + ") + ")");
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
  DB.partners.push({ id:"g41a", nome:"Entrato Col Link", sponsor_id:"R", stato:"attivo", codice_invito:"G41AAA", codice_amway:"8800001",
    invitato_da:"R", invitato_il:ora, confermato_il:ora, creato_il:ora });
  DB.partners.push({ id:"g41b", nome:"Nuovo Nella Mappa", sponsor_id:"R", stato:"gestito", gestore_id:"R", codice_invito:"G41BBB", codice_amway:"8800002",
    in_mappa_dal:ora, creato_il:ora });
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  check(await page.locator(".sezioni-io button[data-sez=giorno]").getAttribute("aria-pressed") === "true", "Io: si apre su «Il mio giorno»");
  check(await page.locator(".guida-piano").count() === 0, "la Guida non è nella pagina di tutti i giorni");
  await page.click(".sezioni-io button[data-sez=guida]");
  await page.locator(".guida-piano").waitFor();
  check(await page.locator(".card", { hasText:"Il mio mese" }).count() === 0, "in «Guida» solo la Guida");
  check((await page.locator(".guida-piano h2").innerText()).startsWith("Verso "), "il piano parte dalla cifra dell'obiettivo");
  check((await page.locator(".guida-piano").innerText()).includes("Per un sì servono circa"), "il piano in attività (piani e contatti per un sì)");
  const stab = page.locator(".guida-stabilita");
  const attesi = DB.partners.filter(p => p.invitato_da === "R" && String(p.invitato_il || "").slice(0, 7) === ora.slice(0, 7)).length;
  check(attesi >= 1 && (await stab.locator("tr.personali").innerText()).replace(/\s+/g, " ").includes("I tuoi nuovi iscritti del mese entrati con il tuo link " + attesi),
    "Stabilità: i miei nuovi iscritti (entrati con il mio link)");
  check((await stab.locator("tr", { hasText:"Nuovi nel gruppo del mese" }).locator("td").nth(1).innerText()).trim() === "1", "Stabilità: i nuovi nel gruppo dagli import");
  await stab.locator("button[data-act=guida-cl21]").first().click();
  await page.locator(".sheet h2", { hasText:"I tuoi numeri Cum Laude 21" }).waitFor();
  await page.fill(".sheet input[name=app_cl21]", "9"); await page.fill(".sheet input[name=training_day]", "10"); await page.fill(".sheet input[name=convention]", "40");
  await page.click(".sheet button.primary");
  await page.getByText("Numeri salvati").waitFor();
  check((await stab.locator("tr", { hasText:"Codici alla Convention" }).innerText()).includes("✓"), "Stabilità: un numero scritto oltre la soglia ha la spunta");
  check(await page.locator(".guida-passi ol.passi li").count() >= 3, "Cosa fare adesso: i passi della tappa");
  // abitudini: spunto oggi la formazione e cambio l'obiettivo
  const oggiG = new Date().toISOString().slice(0, 10);
  await page.locator(`.guida-abitudini [data-k=formazione] button[data-giorno="${oggiG}"]`).click();
  await page.locator(`.guida-abitudini [data-k=formazione] button[data-giorno="${oggiG}"][aria-pressed=true]`).waitFor();
  await page.click(".guida-abitudini button[data-act=guida-obiettivo][data-k=formazione]");
  await page.fill(".sheet input[name=n]", "3"); await page.click(".sheet button.primary");
  await page.getByText("Obiettivo salvato").waitFor();
  check((await page.locator(".guida-abitudini [data-k=formazione] .spread").innerText()).replace(/\s+/g, " ").includes("1 / 3 giorni"), "abitudini: 1 giorno su 3, obiettivo scelto da me");
  check((await page.locator(".guida-abitudini").innerText()).includes("(risentire chi ha visto il piano"), "follow-up con la spiegazione");
  await page.screenshot({ path: S + "/e2e/41-guida.png", fullPage:true });
  await sync(page);
  check(DB.guidaFatti.length === 1 && DB.guidaObiettivi.some(x => x.chiave === "formazione" && x.a_settimana === 3)
    && DB.numeriCl21.some(x => x.convention === 40), "nel database: spunta, obiettivo e numeri scritti");
  await page.click(".sezioni-io button[data-sez=giorno]");
  await page.locator(".card", { hasText:"Il mio mese" }).waitFor(); check(true, "si torna a «Il mio giorno»");
  await ctx.close();
  DB.partners = DB.partners.filter(p => !["g41a", "g41b"].includes(p.id));
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
  await page.click(".sezioni-io button[data-sez=guida]");
  await page.click("button[data-act=seguimi-attivo]");
  await page.getByText("Seguimi attivo").waitFor();
  check(await page.locator("button[data-act=seguimi-condividi]").getAttribute("aria-checked") === "false", "condividere con l'upline è spento di base");
  await page.click("button[data-act=seguimi-condividi]");
  await page.getByText("Il tuo sponsor e la tua upline vedono i tuoi dati (mai i nomi)").waitFor();
  await page.click(".sezioni-io button[data-sez=giorno]");
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
  // dalla Guida alla Lista con un collegamento, e indietro con il dito
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click(".sezioni-io button[data-sez=guida]");
  await page.locator(".guida-passi").waitFor();
  await page.locator(".guida-passi button[data-act=guida-vai]").first().click();
  await page.locator(".schede button.on", { hasText:/Persone|Gruppo/ }).waitFor();
  await dito(60, 320);
  await page.locator(".guida-passi").waitFor();
  check(await page.locator(".sezioni-io button[data-sez=guida]").getAttribute("aria-pressed") === "true", "indietro con il dito: torna alla Guida da cui si era partiti");
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
  // la mia analisi dalla Guida, e l'interruttore unico per condividere
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor(); await apriTappa(page);
  await page.click(".sezioni-io button[data-sez=guida]");
  check(await page.locator(".guida-condividi button[data-act=seguimi-condividi]").count() === 1, "nella Guida un solo interruttore per condividere");
  await page.click(".guida-condividi button[data-act=apri-analisi]");
  await page.locator(".analisi-riep").waitFor();
  check((await page.locator(".testata h1").innerText()).trim() === "La mia analisi", "la mia analisi dalla Guida");
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
  check(ordineBlocchi === "import,fare,numeri,diario", "Il mio giorno: promemoria, Da fare oggi, I miei numeri, Diario (" + ordineBlocchi + ")");
  check((await page.locator(".promemoria-import").innerText()).includes("8 giorni fa"), "promemoria: l'ultimo report ha 8 giorni");
  check(!(await page.locator(".tappa-aperta").count()) && !(await page.locator("ul.oggi").count()), "tappa e diario chiusi di base");
  await page.click("button[data-act=apri-tappa]");
  check(await page.locator(".tappa-aperta .req li").count() > 0, "toccando la tappa si vedono i requisiti");
  await page.click("button[data-act=apri-tappa]");
  check(!(await page.locator(".tappa-aperta").count()), "toccando di nuovo si richiude");
  await page.screenshot({ path: S + "/e2e/45-il-mio-giorno.png", fullPage:true });
  await apriOrdini(page);
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/45-ordini.png" });
  check(await page.locator(".sheet label.scelta-ordini", { hasText:"Importa da Amway" }).locator("input.file-amway").count() === 1,
    "dal foglio Ordini: «Importa da Amway» apre subito la scelta dei file");
  await page.click(".sheet [data-act=chiudi]");
  await dfo.locator("button.riga-apri", { hasText:"Altri 3 in corso" }).click();
  check(await page.locator("button[data-act=vista-persone][aria-selected=true]").isVisible(), "la riga apre la Lista");
  // dopo aver aperto l'ordine di un cliente, «Ordine veloce» apre sempre il suo foglio (solo VP), mai l'ordine del cliente
  await page.click("button[data-sez=clienti]"); await page.click("button[data-filtro=tutti]");
  await page.locator("button[data-act=apri-cliente]", { hasText:"Cliente Quarantacinque" }).click();
  await page.click("button[data-act=ordine-nuovo]");
  await page.locator(".sheet h2", { hasText:"Ordine di" }).waitFor();
  await page.click(".sheet button:has-text('Annulla')");
  await page.click("button[data-act=vista-io]");
  await apriOrdini(page, "ordine");
  check((await page.locator(".sheet h2").innerText()).trim() === "Nuovo ordine" && await page.locator(".sheet input[name=vp]").isVisible(),
    "dopo un cliente aperto, «Ordine veloce» apre il foglio dei soli VP");
  await page.click(".sheet button:has-text('Annulla')");
  await ctx.close();
  // senza Seguimi: i due riquadri di prima; report di 3 giorni fa: niente promemoria
  DB.seguimi.find(x => x.partner_id === "R").attivo = false;
  DB.numeri.find(x => x.partner_id === "R" && x.mese === oggiG.slice(0, 7)).dati_al = giorniFa(3);
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  check(!(await page.locator(".da-fare-oggi").count()) && await page.locator(".card", { hasText:"Il tuo percorso con la lista" }).isVisible(),
    "senza Seguimi: niente «Da fare oggi», resta il percorso con la lista");
  check(!(await page.locator(".promemoria-import").count()), "report di 3 giorni fa: niente promemoria");
  await ctx.close();
  DB.persone = DB.persone.filter(x => !String(x.id).startsWith("p45"));
}

// 46. Ottimizzazione 2: «Primi passi» (30 nomi, × per nasconderlo) e le spiegazioni dietro il «?»
{
  const oggiG = new Date().toISOString().slice(0, 10);
  const nomi46 = n => Array.from({ length:n }, (_, i) => ({ id:"n46" + i, proprietario:"R", nome:"Nome " + (i + 1), fase:"lista", esito:null, creato_il:oggiG + "T09:00:00Z" }));
  DB.persone = (DB.persone || []).filter(x => x.proprietario !== "R").concat(nomi46(12));
  DB.obiettivi = (DB.obiettivi || []).filter(o => o.partner_id !== "R").concat([{ partner_id:"R", cifra_mese:3000, entro:(Number(oggiG.slice(0, 4)) + 1) + "-06-01", perche:"" }]);
  DB.seguimi = (DB.seguimi || []).filter(x => x.partner_id !== "R");
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  const pp = page.locator(".primi-passi");
  check(await pp.isVisible() && await pp.getByText("Fatto, l'ho salvato").isVisible(), "Primi passi: il link da salvare è aperto");
  check(!(await pp.locator("button[data-act=primi-passi-no]").count()), "finché il link non è salvato, niente ×");
  check((await pp.locator("li", { hasText:"Scrivi 30 nomi nella tua Lista" }).innerText()).includes("12 / 30"), "Lista: il contatore dei 30 nomi");
  check(await pp.locator("li.fatta", { hasText:"Scrivi il tuo obiettivo" }).isVisible(), "obiettivo scritto: voce fatta");
  await page.screenshot({ path: S + "/e2e/46-primi-passi.png", fullPage:true });
  await pp.getByText("Fatto, l'ho salvato").click();
  check((await pp.locator(".pill").innerText()).startsWith("3 su"), "dopo il link: 3 su 4 (link, obiettivo, import)");
  await pp.locator("button[data-act=passo-apri][data-k=lista]").click();
  check(await pp.getByText("Senza decidere tu chi potrebbe essere interessato").isVisible(), "la voce della Lista si apre con la frase della Guida");
  await pp.locator("button[data-act=primi-passi-no]").click();
  check(!(await page.locator(".primi-passi").count()), "× nasconde Primi passi");
  await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor();
  check(!(await page.locator(".primi-passi").count()) && await page.evaluate(() => localStorage.getItem("growup-team.primi-passi-no.R")) === "1",
    "resta nascosto (salvato su questo telefono)");
  // il «?»: si apre e si richiude
  await page.click("button[data-act=vista-gruppo]");
  check(!(await page.getByText("Il numero a sinistra è il livello").count()), "Struttura: la spiegazione è chiusa");
  await page.click("button[data-act=aiuto][data-k=struttura]");
  check(await page.getByText("Il numero a sinistra è il livello").isVisible(), "il «?» apre la spiegazione");
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
  // con 30 nomi e tutto fatto, il riquadro non c'è
  DB.persone = DB.persone.filter(x => x.proprietario !== "R").concat(nomi46(30));
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
  await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor();
  check(!(await page.locator(".primi-passi").count()), "tutto fatto (30 nomi, obiettivo, link, import): Primi passi sparisce");
  await ctx.close();
  DB.persone = DB.persone.filter(x => !String(x.id).startsWith("n46"));
}

// 47. Ottimizzazione 3: «Il mio profilo» dall'omino, la scheda partner in «Numeri» e «Azioni», «VP personali»
{
  ({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
  await page.getByText("Ciao Stefano e Alessia").waitFor();
  check(!(await page.locator(".fondo").count()) && await page.locator(".testata button.omino").isVisible(), "niente più fondo pagina: l'omino in alto a destra");
  check(await page.locator(".miei-numeri .obiettivo", { hasText:"VP personali" }).count() === 1 && !(await page.getByText("VP fatturati").count()), "«VP personali» al posto di «VP fatturati»");
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
  await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
  check(true, "mappa e ordini insieme: prima l'anteprima della mappa");
  if(await page.locator(".sheet input[name=consenso]").count()) await page.check(".sheet input[name=consenso]");
  await page.click(".sheet button:has-text('Importa')");
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
  await page.click("button[data-act=prossima]");
  check(await page.locator(".sheet input[name=prossima_ora]").isVisible() && await page.locator(".sheet").getByText("Ora (facoltativa)").isVisible(),
    "prossimo passo: c'è l'ora facoltativa accanto al giorno");
  await page.fill(".sheet input[name=prossima_data]", oggiG);
  await page.fill(".sheet input[name=prossima_ora]", "18:30");
  await page.locator(".sheet-box").screenshot({ path: S + "/e2e/50-ora.png" });
  await page.click(".sheet button.primary");
  await page.getByText("Prossima cosa salvata").waitFor();
  await sync(page);
  check(String((DB.persone.find(x => x.id === pid) || {}).prossima_ora || "").startsWith("18:30"), "l'ora è salvata");
  check(await page.getByText(/Oggi · .* · 18:30/).first().isVisible(), "l'ora si vede con il giorno");
  await ctx.close();
  ({ ctx, page } = await apri({}, "?persona=" + pid + "#chiave=" + "a".repeat(32)));
  await page.locator(".testata h1", { hasText:"La mia lista" }).waitFor();
  check(await page.getByText("Prova Ora").first().isVisible() && !/persona=/.test(page.url()), "il tocco sull'avviso apre la scheda della persona");
  await ctx.close();
  DB.persone = DB.persone.filter(x => x.id !== pid);
}

await browser.close();
console.log(`controlli superati: ${ok}`);
if(errori.length){ console.log("ERRORI CONSOLE:", errori); process.exitCode = 1; }
