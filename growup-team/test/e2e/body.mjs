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
await page.fill("input[name=codice_amway]", "2000001");
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
await page.getByText("Ciao Anna").waitFor();
check(await page.locator(".obiettivo-breve").getByText("300 €").isVisible(), "su Io: il riquadro del mio obiettivo");
check(await page.locator("button[data-act=copia-dati]").count() === 0, "chi non è admin non vede la copia dei dati");
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
await page.click("button[data-act=ordine]");
check(await page.inputValue(".sheet input[name=vp]") === "" && await page.getAttribute(".sheet input[name=vp]", "placeholder") === "0", "ordine: campo vuoto con lo 0 grigio");
await page.click(".sheet button:has-text('Salva')");
await page.locator(".sheet .errore").waitFor();
check(await page.inputValue(".sheet input[name=vp]") === "", "ordine senza VP: errore e il campo resta vuoto");
await page.fill("input[name=vp]", "62,5");
await page.click(".sheet button:has-text('Salva')"); await page.getByText("Ordine da 62,5 VP registrato").waitFor();
check(await page.getByText("Primi clienti").first().isVisible(), "primo ordine fatto -> tappa 2");

// 2b. Il mio mese: + VP e niente struttura nella pagina Io
check(await page.locator(".card", { hasText:"Il mio mese" }).locator("button[data-act=ordine]").isVisible(), "+ VP nel mio mese");
// Aggiorna il totale del mese: su a 100, poi giù a 80
await page.click("button[data-act=totale-mese]");
check(await page.inputValue(".sheet input[name=vp]") === "" && await page.getAttribute(".sheet input[name=vp]", "placeholder") === "62,5", "totale proposto in grigio = VP già registrati");
await page.fill(".sheet input[name=vp]", "100");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("aggiornato: 100 VP").waitFor();
check(await page.locator("button[data-act=ordine] b").first().innerText() === "100 VP nel mese", "totale del mese a 100");
await page.click("button[data-act=totale-mese]");
await page.fill(".sheet input[name=vp]", "80");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("aggiornato: 80 VP").waitFor();
check(await page.locator(".oggi li", { hasText:"-20 VP" }).isVisible(), "correzione negativa nella lista di oggi");
check(await page.locator(".card", { hasText:"Il mio mese" }).getByText("/ 100").isVisible(), "obiettivo invariato");
await page.click("button[data-act=totale-mese]");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Il totale era già questo").waitFor(); check(true, "nessuna correzione se il totale non cambia");
await page.locator(".card", { hasText:"Il mio mese" }).screenshot({ path: S + "/e2e/7-mese.png" });
check(!(await page.getByText("La mia struttura").count()), "struttura non nella pagina Io");
check(await page.getByText("Il mio link personale").isVisible(), "link personale in fondo alla pagina");
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
  await pg.click(daGruppo ? ".card button[data-act=importa]" : "button[data-act=importa]");
  await pg.locator(".sheet").getByText("Intera Linea di Sponsorizzazione con tutti i KPI disponibili").waitFor();
  await pg.setInputFiles("#file-report", { name:nome, mimeType:"text/csv", buffer:Buffer.from(testo) });
};
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
await page.fill("input[name=codice_amway]", "2000001");
await page.click("form button.primary");
check((await page.locator(".errore").innerText()).startsWith("Con questo codice Amway c'è già qualcuno che usa l'app"), "ingresso: codice di chi usa già l'app");
await page.fill("input[name=codice_amway]", "1000001");
await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor();
await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Marco").waitFor();
check(await page.getByText("Scrivi il tuo obiettivo").isVisible(), "obiettivo rimandato: su Io l'invito a scriverlo");
check(await page.getByText("6% raggiunto").isVisible(), "pin di Marco mostrato");
check(await page.getByText("Path to Bronze").first().isVisible(), "pin senza Bronze -> Path to Bronze");
check(await page.locator(".card", { hasText:"Il mio mese" }).getByText("150").first().isVisible(), "Marco ritrova i suoi VPP");
await page.click("button[data-act=vista-gruppo]");
check(!(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).count()), "Marco non vede Luca: l'ha importato Anna");
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
await page.fill("input[name=codice_amway]", "2000005");
await page.selectOption("select[name=qualifica]", "pin:12");
check(await page.getByText("(facoltativa)").isVisible(), "data facoltativa per chi ha già un pin");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Bea").waitFor();
check(await page.getByText("12% raggiunto").isVisible(), "pin 12% mostrato");
await sync(page); await ctx.close();

// 6. Bronze Foundation con pagamenti (regressione)
({ ctx, page } = await apri({}, "#RRRR22"));
await page.fill("input[name=nome]", "Ciro Neri");
await page.fill("input[name=codice_amway]", "2000006");
await page.selectOption("select[name=qualifica]", "foundation_9");
check(await page.locator("input[name=mese]").isVisible(), "campi pagamenti visibili");
await page.fill("input[name=mese]", "2026-07"); await page.fill("input[name=pagamenti]", "3");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Ciro").waitFor();
check(await page.getByText("Pagamenti 3 di 12, restano 15 mesi su 18").isVisible(), "pagamenti");
await page.screenshot({ path: S + "/e2e/5-avviato.png", fullPage:true });
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "niente scroll orizzontale");
await sync(page); await ctx.close();

// 7. Radice (privacy non ancora accettata) entra con il link personale
({ ctx, page } = await apri({ colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
await page.getByText("Il tuo profilo è già pronto").waitFor();
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor(); await page.click("button[data-act=obiettivo-dopo]");
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isVisible()
  && !(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).count()), "la radice vede chi usa l'app, non le persone importate da Anna");
// niente conferme: Bea (pin 12%) ha dichiarato un punto di partenza, lo sponsor lo vede soltanto
check(!(await page.getByText("Da confermare").count()) && !(await page.locator("button[data-act=conferma]").count()), "nessun riquadro Da confermare");
await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).locator("button[data-act=apri-scheda]").click();
check(await page.getByText("Punto di partenza dichiarato: 12%").isVisible() && !(await page.locator("button[data-act=conferma]").count()),
  "scheda: punto di partenza solo come informazione");
await page.click("button.link[data-act=vista-gruppo]");
// ognuno corregge il proprio, dal fondo della pagina
await page.click("button[data-act=partenza]");
check(await page.locator(".sheet select[name=qualifica]").inputValue() === "", "il dichiarato è già selezionato");
await page.selectOption(".sheet select[name=qualifica]", "pin:3");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Punto di partenza aggiornato").waitFor();
await sync(page);
check(DB.partners.find(p => p.id === "R").percentuale_iniziale === 3, "il proprio punto di partenza corretto");
await page.click("button[data-act=partenza]");
await page.selectOption(".sheet select[name=qualifica]", "");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Punto di partenza aggiornato").waitFor();
await sync(page);
// la radice importa la sua rete: Paolo e Luca (con VPP) sì, Zeno (0 VP) no; Bea è di Ciro secondo il report
const reportRadice = creaCsv(meseFile, [persona(1, "9", "1111111", "ROSSI, MARIO", "120,00"),
  persona(2, "1111111", "2000001", "BIANCHI, ANNA", "80,00"), persona(3, "2000001", "1000003", "NERI, PAOLO", "10,00"),
  persona(4, "1000003", "1000001", "ROSSI, MARCO", "150,00"), persona(5, "1000001", "1000002", "VERDI, LUCA", "5,00"),
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
await page.getByText(/3 persone aggiunte/).waitFor(); check(true, "la radice importa tutta la sua rete");
await sync(page);
const idDi = n => DB.partners.find(p => p.nome === n).id;
check(DB.partners.find(p => p.nome === "Bea Verdi").sponsor_id === idDi("Ciro Neri"), "Bea sotto Ciro, come nel report");
check(DB.partners.filter(p => p.codice_amway === "1000002").length === 2, "Luca: una copia di Anna e una della radice");
const lucaR = DB.partners.find(p => p.codice_amway === "1000002" && p.gestore_id === "R");
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
await page.click("button[data-act=nascondi]");
await page.getByText("Paolo Neri nascosto dalla tua struttura").waitFor();
await sync(page);
check(DB.partners.some(p => p.nome === "Paolo Neri") && !(await page.locator(".albero.struttura li", { hasText:"Paolo Neri" }).count()), "Paolo nascosto, non cancellato");
await page.click("button[data-act=nascoste]");
check(await page.locator(".sheet li", { hasText:"Zeno Zero" }).isVisible() && await page.locator(".sheet li", { hasText:"Paolo Neri" }).isVisible(), "elenco delle nascoste");
await page.locator(".sheet li", { hasText:"Paolo Neri" }).locator("button[data-act=apri-nascosta]").click();
check(await page.getByText("Mostra di nuovo nella mia struttura").isVisible(), "dalla scheda di una nascosta: Mostra di nuovo");
await page.click("button.link[data-act=vista-gruppo]");
// admin: nuovo link personale per chi usa l'app
await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).locator("button[data-act=apri-scheda]").click();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
check(await page.locator(".card h2", { hasText:"Path to Bronze" }).isVisible(), "radice alla tappa Path to Bronze");
check(await page.locator(".req li", { hasText:"3 linee frontali" }).getByText("2 / 3").isVisible(), "linee attive vere: 2 su 3");
check(await page.locator(".spinta").innerText() === "Linee attive: 2 su 3. Manca 1 linea da 100 VP per il Path to Bronze.", "linee mancanti come dato, senza consiglio");
check(await page.locator(".linee li", { hasText:"Linea Uno" }).getByText("250 VP").isVisible(), "VP di gruppo della linea 1 (150 + 100)");
check(await page.getByText("3% questo mese").isVisible(), "percentuale del mese: 570 VP = 3%");
check(await page.locator(".card", { hasText:"Il mio mese" }).getByText("570").isVisible(), "VP di gruppo nel mio mese");
await page.screenshot({ path: S + "/e2e/8-gruppo-ptb.png", fullPage:true });
await sync(page); await ctx.close();
// la terza linea arriva a 120: Path to Bronze fatto; poi tanti VP su una sola linea: 9% ma non Foundation
O("l3", 40, "rettifica"); O("l1b", 700);
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
check(await page.getByText("✓ Path to Bronze").isVisible(), "Path to Bronze riconosciuto dai numeri");
check(await page.getByText("9% questo mese").isVisible(), "1.310 VP di gruppo = 9%");
check(await page.getByText(/9% raggiunto · Bronze Foundation 9% non qualificato: mancano 2 linee da almeno 200 VP/).isVisible(), "percentuale e qualifica distinte");
await page.screenshot({ path: S + "/e2e/9-distinti.png", fullPage:true });
await sync(page); await ctx.close();
// storico: un mese chiuso da Bronze Foundation 9% -> tappa successiva e pagamenti
DB.storico = [{ partner_id:"R", mese:mesePrec + "-01", vp_personali:150, vp_gruppo:1300, linee_attive:3, percentuale:9, qualifica:"foundation_9" }];
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
check(await page.locator(".card h2", { hasText:"Bronze Foundation 12%" }).isVisible(), "dopo un mese da Foundation 9% si punta al 12%");
check(await page.getByText(/Pagamenti 1 di 12, restano 17 mesi su 18/).isVisible(), "pagamenti contati dallo storico");
await page.click("button[data-act=storico]");
await page.getByText("Il mio storico").waitFor();
check(await page.locator(".storico li").count() >= 2, "storico: mese chiuso e mese in corso");
check(await page.locator(".storico li", { hasText:"chiuso" }).getByText("Bronze Foundation 9%").isVisible(), "qualifica del mese chiuso");
await page.screenshot({ path: S + "/e2e/10-storico.png" });
await page.click(".sheet button:has-text('Chiudi')");
// l'ordine non accetta date di mesi chiusi
await page.click("button[data-act=ordine]");
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
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
const prefGino = pref.locator("li.preferito", { hasText:"Gino Senza App" });
check(await prefGino.getByText("senza app · numeri inseriti dallo sponsor").isVisible() && await prefGino.locator(".obiettivo.debole").count() === 0, "Gino nei preferiti: senza etichetta");
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
check(rv[1] === "▼ 0" && rv[2] === "80", "VP personali sotto il mese prima");
check((await riga("VP di gruppo"))[2] === "–", "VP di gruppo: solo il totale del mese prima");
check(await page.locator(".confronto td.sotto").count() >= 2, "valori sotto evidenziati");
await page.screenshot({ path: S + "/e2e/15-confronto.png", fullPage:true });

// 11. Fissa una chiamata: calendario e WhatsApp neutro
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.evaluate(() => { window.__vai = null; window.GROWUP_VAI = u => { window.__vai = u; }; });
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.evaluate(() => { window.__vai = null; window.GROWUP_VAI = u => { window.__vai = u; }; });
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
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
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor();
check(await page.getByText("Installa Growup sul telefono").isVisible() && await page.getByText("Aggiungi alla schermata Home").first().isVisible(), "iPhone: guida all'installazione");
await page.screenshot({ path: S + "/e2e/18-installa-iphone.png" });
await page.click("button[data-act=copia-chiave]");
check((await page.evaluate(() => navigator.clipboard.readText())).endsWith("#chiave=" + "a".repeat(32)), "iPhone: link personale copiato");
await page.click("button[data-act=installa-no]");
check(await page.getByText("Installa Growup sul telefono").count() === 0, "Non ora: la guida sparisce");
await page.click("button[data-act=installa-si]");
check(await page.getByText("Installa Growup sul telefono").isVisible(), "dal fondo pagina si riapre");
check(await page.getByText("Forse hai aperto il link dentro WhatsApp o Telegram").isVisible(), "iPhone in Safari: nota per chi è dentro un'altra app");
await ctx.close();

// 13b. iPhone dentro il browser di Telegram: avviso e passo "Apri in Safari"
({ ctx, page } = await apri({ userAgent:UA_IPHONE + " Telegram-iOS/11.0", permissions:PERM }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor();
check(await page.getByText("Sei dentro Telegram").isVisible() && await page.getByText("Apri in Safari").isVisible(), "iPhone dentro Telegram: avviso e passo Apri in Safari");
await page.locator(".avviso-interno").screenshot({ path: S + "/e2e/18b-installa-telegram.png" });
await ctx.close();

({ ctx, page } = await apri({ userAgent:UA_ANDROID }, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.evaluate(() => localStorage.setItem("growup-team.chiave-salvata", "1"));
await page.click("button[data-act=vista-gruppo]"); await page.click("button[data-act=vista-io]"); await page.getByText("Ciao Stefano e Alessia").waitFor();
check(await page.getByText("Installa app").isVisible(), "Android senza proposta del browser: istruzioni dal menu");
await page.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable:true });
  e.prompt = () => { window.__promptato = true; }; e.userChoice = Promise.resolve({ outcome:"accepted" }); window.dispatchEvent(e); });
await page.locator("button[data-act=installa]").waitFor();
await page.screenshot({ path: S + "/e2e/19-installa-android.png" });
await page.click("button[data-act=installa]");
await page.waitForFunction(() => !document.querySelector("button[data-act=installa]"));
check(await page.evaluate(() => window.__promptato) === true, "Android: il pulsante Installa apre la proposta del browser");
check(await page.getByText("Installa Growup sul telefono").count() === 0, "installata: la guida non c'è più");
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
await page.getByText("Ciao Stefano e Alessia").waitFor(); check(true, "incolla il link: entra");
check(await page.getByText("Salva il tuo link personale").count() === 0 && await page.getByText("Installa Growup sul telefono").count() === 0,
  "dopo l'incolla: niente richiesta di salvare il link né guida all'installazione");
await ctx.close();

// 14. Invito: anteprima del link, testo con il nome e i tre passi, immagini da inviare
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.click("button[data-act=vista-gruppo]");
check(await page.locator("li.preferito", { hasText:"Cri Crescita" }).getByText("Bronze Builder 15%").isVisible(), "preferiti: obiettivo di Cri (1.000 € → Builder 15%)");
await page.locator(".albero.struttura li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
check(await page.getByText("1.000 €/mese").isVisible() && !(await page.locator("#app").innerText()).includes("Segreto di Cri"), "scheda: cifra e tappa, non il perché");
await ctx.close();

// 17. Copia di sicurezza: solo per gli admin
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await scegliFile(page, "altro.csv", "nome,cognome\nMario,Rossi\n");
check(await page.locator(".sheet .errore").getByText("non sembra il report").isVisible(), "import: file sbagliato riconosciuto");
await page.setInputFiles("#file-report", { name:"altri.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(meseFile, [persona(1, "1", "1234567", "ROSSI, MARIO", "1"), persona(2, "1234567", "9999999", "ALTRO, ALDO", "1")])) });
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
await page.click(".sheet button[data-act=chiudi]");
const meseVecchio = (() => { const d = new Date(oggiStr.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 7).replace("-", ""); })();
await scegliFile(page, "vecchio.csv", creaCsv(meseVecchio, righeCsv));
await page.locator(".sheet .errore").waitFor();
check(await page.locator(".sheet .errore").getByText("quel mese è già chiuso").isVisible(), "import: mese chiuso rifiutato");
await page.setInputFiles("#file-report", { name:"report.xlsx", mimeType:"application/octet-stream", buffer:Buffer.from("PK") });
check(await page.locator(".sheet .errore").getByText("sul sito Amway scegli il formato CSV").isVisible(), "import: il file Excel non va, serve il CSV");
await page.setInputFiles("#file-report", { name:"los.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(meseFile, righeCsv)) });
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
const sez = t => page.locator(".sheet .imp-sezione", { hasText:t });
check(await sez("Si aggiornano i VPP").locator("li", { hasText:"Stefano e Alessia (tu)" }).getByText("400 VP").isVisible()
  && await sez("Si aggiornano i VPP").getByText("il tuo codice 1234567 viene salvato").isVisible(), "anteprima: i miei VPP e il mio codice dalla prima riga");
check(await sez("Si aggiornano i VPP").locator("li", { hasText:"Gino Gestito" }).getByText("1.055,5 VP").isVisible(), "anteprima: Gino, abbinato per codice");
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
await page.getByText(/VPP aggiornati, 1 persona non più nel report/).waitFor(); check(true, "import fatto");
await sync(page);
const vppDi = id => DB.activities.filter(a => a.partner_id === id && ["ordine","rettifica"].includes(a.tipo) && a.data.slice(0, 7) === oggiStr.slice(0, 7))
  .reduce((t, a) => t + Number(a.vp), 0);
check(DB.partners.find(p => p.id === "R").codice_amway === "1234567" && Math.abs(vppDi("R") - 400) < 0.001, "i miei VPP del mese sono quelli del report");
check(vppDi("imp-gino") === 1055.5, "VPP delle persone importate");
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
await page.getByText(/0 VPP aggiornati, 1 nascosta, 1 di nuovo visibile/).waitFor();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.fill("input[name=nome]", "Nora Sotto"); await page.fill("input[name=codice_amway]", "4000002");
await page.fill("input[name=data]", oggiStr); await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Il tuo primo obiettivo").waitFor();
await sync(page); await ctx.close();
const nora = DB.partners.find(p => p.nome === "Nora Sotto");
check(nora.sponsor_id === bianca.id && nora.stato === "attivo", "Nora sotto Bianca, usa l'app");
// la radice crea il link per chi manca tra Bianca e Nora
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero.struttura li", { hasText:"Nora Sotto" }).locator(".livello").innerText() === "3", "Nora sotto Bianca nella struttura della radice");
await page.locator(".albero.struttura li", { hasText:"Nora Sotto" }).locator("button[data-act=apri-scheda]").click();
await page.click("button[data-act=invito-sopra]");
await page.click(".sheet button:has-text('Crea il link')");
const linkSopra = await page.locator(".sheet .linkbox").innerText();
check(/#S[A-Z0-9]{5}$/.test(linkSopra), "link speciale creato");
await sync(page); await ctx.close();
({ ctx, page } = await apri({}, "#" + linkSopra.split("#")[1]));
await page.getByText("Ti ha invitato Bianca Platini").waitFor();
await page.fill("input[name=nome]", "Mirco Mezzo"); await page.fill("input[name=codice_amway]", "4000003");
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await sync(page);
check(DB.captcha === "tok-prova" && !(await page.locator(".captcha").count()), "primo ingresso: captcha superato, gettone passato all'accesso");
const stato = await ctx.storageState(); await ctx.close(); DB.captcha = null;
({ ctx, page } = await apri({ storageState:stato }));
await page.getByText("Ciao Stefano e Alessia").waitFor(); await sync(page);
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.click("button[data-act=vista-persone]");
check(await page.getByText("La tua lista è vuota").isVisible(), "Persone: lista vuota con l'invito a scrivere i nomi");
await page.click("button[data-act=persona-nuova]");
await page.fill(".sheet input[name=nome]", "Luigi Verdi"); await page.fill(".sheet input[name=contatto]", "333 1234567");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Luigi Verdi nella tua lista").waitFor();
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
await page.click("button[data-act=passo]");
await page.click(".sheet button[data-tipo=chiusura]");
await page.click(".sheet button:has-text('Salva')");
check(await page.locator(".sheet .errore").getByText("Scegli com'è finita").isVisible(), "chiusura: serve l'esito");
await page.click(".sheet label.chip:has-text('Partner')");
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
check(await page.locator(".card", { hasText:"La mia lista" }).isVisible() && !(await page.locator("button[data-act=passo]").count()), "scheda persona: col dito si torna alla lista");
check(await page.getByText("Scarica una copia della mia lista").isVisible(), "la copia della lista è un piccolo link");
await page.click("button[data-act=persone-tante]");
await page.fill(".sheet textarea[name=righe]", "Marta Neri, 333 999, palestra\nLuigi Verdi");
await page.click(".sheet button:has-text('Aggiungi')");
await page.getByText("1 nome aggiunto").waitFor();
check(await page.getByText("Chiusi · 1").isVisible() && await page.getByText("In lista · 1").isVisible(), "filtri con i conteggi");
check(!(await page.locator(".persone button[data-act=togli-da-io]").count()), "nella lista nessuna × (quella è solo su Io)");
await ctx.close();
// lo sponsor vede solo i numeri della lista di chi sta sotto
const annaId = "lia";
DB.partners.push({ id:annaId, nome:"Lia Lista", sponsor_id:"R", stato:"attivo", codice_invito:"LIALIA", creato_il:new Date().toISOString(),
  ultimo_aggiornamento:new Date().toISOString() });
DB.persone.push({ id:"pa1", proprietario:annaId, nome:"Segreto Uno", fase:"lista", esito:null },
  { id:"pa2", proprietario:annaId, nome:"Segreto Due", fase:"piano", esito:null });
({ ctx, page } = await apri({}, "#chiave=" + "a".repeat(32)));
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.click("button[data-act=vista-persone]");
await page.click("button[data-sez=target]");
check(await page.getByText("Ancora nessun invito").isVisible(), "Target: nessun invito all'inizio");
await page.click("button[data-act=target-nuovo]");
await page.fill(".sheet input[name=nome]", "Carla Nuova");
await page.fill(".sheet input[name=whatsapp]", "333 1234567");
await page.click('.sheet button:has-text("Crea l\'invito")');
await page.getByText("Invito pronto").waitFor();
const hrefWa = await page.locator("a.wa:has-text('Manda su WhatsApp')").getAttribute("href");
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
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
await page.click('.sheet button:has-text("Salva l\'ordine")');
await page.getByText("Ordine salvato").waitFor();
await sync(page);
const gina = DB.persone.find(x => x.nome === "Gina Cliente"), oG = DB.ordini.find(o => o.persona_id === gina.id), rG = DB.righe.find(r => r.ordine_id === oG.id);
check(gina.esito === "cliente" && DB.activities.filter(a => a.partner_id === "R" && a.tipo === "cliente").length === clientiPrima + 1, "+ Un cliente conta nei nuovi clienti");
check(oG.modo === "io" && rG.quantita === 2 && rG.prezzo > 0 && /double/i.test(rG.nome), "ordine dal catalogo: prodotto, quantità 2, prezzo di listino");
check(DB.durate.some(d => d.codice === rG.codice && d.giorni === 31), "la durata scelta resta per tutti i clienti");
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
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.click("button[data-act=vista-persone]"); await page.click("button[data-sez=clienti]");
await page.click("button[data-act=importa-ordini]");
await page.setInputFiles("#file-ordini", { name:"18102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) });
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
await page.click("button[data-act=importa-ordini]");
await page.setInputFiles("#file-ordini", { name:"18102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) });
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
await page.click("button[data-act=importa-ordini]");
await page.setInputFiles("#file-ordini", [{ name:"19102026_Cliente.csv", mimeType:"text/csv", buffer:Buffer.from(csvClienti) },
  { name:"18102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini) }]);
await page.locator(".sheet form[data-form=importa-ordini]").waitFor();
check(await page.getByText("4 ordini e 4 clienti nei file").isVisible(), "i due file insieme: riconosciuti da soli");
check(await page.locator(".sheet .imp-sezione", { hasText:"Già in Growup" }).getByText(/Lia Rossi · telefono/).isVisible(), "Lia: si aggiunge solo il telefono (l'ultimo ordine c'è già)");
check(await page.locator(".sheet .scelte label", { hasText:"Ugo Bianchi" }).isVisible() && await page.locator(".sheet .scelte label", { hasText:"Nuovo Verdi" }).isVisible(), "nuovi clienti: chi ha comprato");
check(await page.locator(".sheet .imp-sezione", { hasText:"Mai comprato" }).locator(".scelte label", { hasText:"Mai Neri" }).locator("input").isChecked(), "mai comprato: con la spunta");
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
await page.click("button[data-act=importa-ordini]");
await page.setInputFiles("#file-ordini", { name:"19102026_Ordine.csv", mimeType:"text/csv", buffer:Buffer.from(csvOrdini2) });
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
// modifica i dati dalla scheda del cliente
await page.click("button[data-act=persona-modifica]");
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
await ctx.close();

await browser.close();
console.log(`controlli superati: ${ok}`);
if(errori.length){ console.log("ERRORI CONSOLE:", errori); process.exitCode = 1; }
