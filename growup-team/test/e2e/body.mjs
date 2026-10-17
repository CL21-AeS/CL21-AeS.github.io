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
await page.click("button[data-act=contatto]"); await page.getByText("Contatto registrato").waitFor();
check(await page.locator("button[data-act=contatto] b").innerText() === "1 questa sett.", "contatto +1");
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
check(await page.locator(".sheet .imp-sezione", { hasText:"Non ancora nell'app · 2" }).isVisible(), "import: 2 persone non ancora nell'app");
check(await page.locator(".sheet input[name=aggiungi]:checked").count() === 0, "import: nessuno spuntato all'inizio");
await page.click(".sheet button[data-act=spunta-vpp]");
check(await page.isChecked(".sheet input[name=aggiungi][value='1000002']") && !(await page.isChecked(".sheet input[name=aggiungi][value='1000001']")),
  "Spunta chi ha VPP: solo Luca (12,5 VP)");
await page.click(".sheet button[data-act=spunta-tutti]");
check(await page.locator(".sheet input[name=aggiungi]:checked").count() === 2, "Spunta tutti");
check(await page.locator(".sheet label", { hasText:"Luca Verdi" }).getByText("sponsor Marco Rossi").isVisible(), "import: lo sponsor del report accanto al nome");
await page.screenshot({ path: S + "/e2e/26-importa.png", fullPage:true });
await page.click(".sheet button:has-text('Importa')");
check(await page.locator(".sheet .errore").innerText() === "Conferma di avere il consenso delle persone che aggiungi.", "import: serve il consenso");
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/2 persone aggiunte/).waitFor(); check(true, "import: 2 persone aggiunte");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).getByText("senza app").isVisible(), "Marco senza app nella struttura");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).getByText("0 VP · gruppo 12,5").isVisible(), "numeri accanto al nome");
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
// da confermare: Bea (pin 12%) e Ciro (Foundation 9%) hanno dichiarato un punto di partenza
check(await page.locator(".card", { hasText:"Da confermare" }).getByText("Bea Verdi").isVisible(), "Bea da confermare");
await page.locator(".card", { hasText:"Da confermare" }).locator("li", { hasText:"Bea Verdi" }).locator("button[data-act=conferma]").click();
check(await page.locator(".sheet select[name=qualifica]").inputValue() === "pin:12", "il dichiarato è già selezionato");
await page.selectOption(".sheet select[name=qualifica]", "pin:9");
await page.click(".sheet button:has-text('Conferma')");
await page.getByText("Punto di partenza confermato").waitFor();
check(!(await page.locator(".card", { hasText:"Da confermare" }).locator("li", { hasText:"Bea Verdi" }).count()), "Bea confermata");
await sync(page);
check(DB.partners.find(p => p.nome === "Bea Verdi").percentuale_iniziale === 9, "correzione salvata (12% -> 9%)");
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
await page.click(".sheet button[data-act=spunta-vpp]");
check(await page.locator(".sheet input[name=aggiungi]:checked").count() === 2 && !(await page.isChecked(".sheet input[name=aggiungi][value='3000000']")),
  "radice: Paolo e Luca spuntati, Zeno no");
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/2 persone aggiunte/).waitFor(); check(true, "la radice importa la sua rete");
await sync(page);
const idDi = n => DB.partners.find(p => p.nome === n).id;
check(DB.partners.find(p => p.nome === "Bea Verdi").sponsor_id === idDi("Ciro Neri"), "Bea sotto Ciro, come nel report");
check(DB.partners.filter(p => p.codice_amway === "1000002").length === 2, "Luca: una copia di Anna e una della radice");
const lucaR = DB.partners.find(p => p.codice_amway === "1000002" && p.gestore_id === "R");
check(lucaR.sponsor_id === marco.id && DB.partners.find(p => p.nome === "Paolo Neri").sponsor_id === anna.id,
  "chi usa l'app resta sotto chi usa l'app: Luca sotto Marco, Paolo sotto Anna");
check((DB.esclusi || []).some(x => x.partner_id === "R" && x.codice === "3000000"), "Zeno escluso");
// al secondo import Zeno non viene riproposto
await scegliFile(page, "radice.csv", reportRadice, true);
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
check(!(await page.locator(".sheet .imp-sezione", { hasText:"Non ancora nell'app" }).count())
  && await page.locator(".sheet .imp-sezione", { hasText:"Escluse · 1" }).isVisible(), "secondo import: niente da scegliere, Zeno tra le escluse");
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
// nascondi: Ciro (con Bea) sparisce solo per la radice, e si rimette
await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).locator("button[data-act=apri-scheda]").click();
await page.click("button[data-act=nascondi]");
await page.getByText("Ciro Neri nascosto dalla tua struttura").waitFor();
check(!(await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).count()) && !(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).count()),
  "Ciro nascosto con il suo gruppo");
await page.click("button[data-act=nascoste]");
await page.click(".sheet button[data-act=mostra]");
await page.getByText("Ciro Neri di nuovo nella tua struttura").waitFor();
check(await page.locator(".albero.struttura li", { hasText:"Bea Verdi" }).isVisible(), "Ciro e Bea di nuovo visibili");
// cancella: Paolo (importato dalla radice) non rinnova
await page.locator(".albero.struttura li", { hasText:"Paolo Neri" }).locator("button[data-act=apri-scheda]").click();
check(!(await page.locator("button[data-act=nascondi]").count()), "le persone importate si cancellano, non si nascondono");
await page.click("button[data-act=cancella]");
await page.getByText("Paolo Neri cancellato").waitFor();
await sync(page);
check(!DB.partners.some(p => p.nome === "Paolo Neri") && DB.esclusi.some(x => x.partner_id === "R" && x.codice === "1000003"), "Paolo cancellato ed escluso");
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
DB.accessi = []; DB.activities = []; DB.goals = []; DB.mgoals = []; DB.storico = []; DB.anonDisattivo = false;
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
check(await page.getByText("Installa Growup sul telefono").isVisible() && await page.getByText("Aggiungi alla schermata Home").isVisible(), "iPhone: guida all'installazione");
await page.screenshot({ path: S + "/e2e/18-installa-iphone.png" });
await page.click("button[data-act=copia-chiave]");
check((await page.evaluate(() => navigator.clipboard.readText())).endsWith("#chiave=" + "a".repeat(32)), "iPhone: link personale copiato");
await page.click("button[data-act=installa-no]");
check(await page.getByText("Installa Growup sul telefono").count() === 0, "Non ora: la guida sparisce");
await page.click("button[data-act=installa-si]");
check(await page.getByText("Installa Growup sul telefono").isVisible(), "dal fondo pagina si riapre");
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
check((await page.locator(".schede button").allInnerTexts()).join(" | ") === "Obiettivo | Io | Gruppo", "pagine in ordine: Obiettivo | Io | Gruppo");
await trascina(320, 80);
check(await page.getByText("Il mio gruppo").first().isVisible(), "verso sinistra: da Io a Gruppo");
await trascina(80, 320);
check(await page.getByText("Ciao Stefano e Alessia").isVisible(), "verso destra: da Gruppo a Io");
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
for(const [id, nome, codice] of [["imp-gino","Gino Gestito","3000001"],["imp-dora","Dora Diversa","3000002"],["imp-nadia","Nadia Nocodice",null],["imp-ugo","Ugo Uscito","3000004"],["imp-ivo","Ivo Attivo","3000005"]])
  DB.partners.push({ id, nome, sponsor_id:"R", stato:id === "imp-ivo" ? "attivo" : "gestito", gestore_id:"R", codice_amway:codice, codice_invito:"X" + id.toUpperCase(),
    partenza_confermata_il:new Date().toISOString(), creato_il:new Date().toISOString() });
const altriGestiti = DB.partners.filter(p => p.stato === "gestito" && p.gestore_id === "R" && p.codice_amway && !["imp-gino","imp-dora","imp-ugo"].includes(p.id));
const usanoApp = DB.partners.filter(p => p.stato !== "gestito" && p.codice_amway);
const righeCsv = [persona(1, "7654321", "1234567", "ROSSI, MARIO", "400,00"), persona(2, "1234567", "3000001", "GESTITO, GINO", "1.055,50"),
  persona(2, "1234567", "3000020", "DIVERSA, DORA", "12,00"), persona(2, "1234567", "3000003", "NOCODICE, NADIA", "5,00"),
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
check(await page.locator(".sheet .errore").getByText("quel mese è già chiuso").isVisible(), "import: mese chiuso rifiutato");
await page.setInputFiles("#file-report", { name:"report.xlsx", mimeType:"application/octet-stream", buffer:Buffer.from("PK") });
check(await page.locator(".sheet .errore").getByText("sul sito Amway scegli il formato CSV").isVisible(), "import: il file Excel non va, serve il CSV");
await page.setInputFiles("#file-report", { name:"los.csv", mimeType:"text/csv", buffer:Buffer.from(creaCsv(meseFile, righeCsv)) });
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
const sez = t => page.locator(".sheet .imp-sezione", { hasText:t });
check(await sez("Si aggiornano i VPP").locator("li", { hasText:"Stefano e Alessia (tu)" }).getByText("400,00 VP").isVisible()
  && await sez("Si aggiornano i VPP").getByText("il tuo codice 1234567 viene salvato").isVisible(), "anteprima: i miei VPP e il mio codice dalla prima riga");
check(await sez("Si aggiornano i VPP").locator("li", { hasText:"Gino Gestito" }).getByText("1.055,5 VP").isVisible(), "anteprima: Gino, abbinato per codice");
check(await sez("Nome uguale, codice diverso").getByText("nell'app 3000002, nel report 3000020").isVisible()
  && !(await page.isChecked(".sheet input[name=correggi]")), "anteprima: Dora, codice diverso da confermare (non spuntata)");
check(await sez("Senza codice, trovati per nome").getByText("Nadia Nocodice = Nadia Nocodice 3000003 · 5 VP").isVisible()
  && await page.isChecked(".sheet input[name=abbina]"), "anteprima: Nadia senza codice, trovata per nome");
check(await sez("Non più nel report").getByText("Ugo Uscito · 3000004").isVisible() && await page.isChecked(".sheet input[name=cancella]"),
  "anteprima: Ugo non più nel report, già spuntato");
check(await sez("Usano l'app").isVisible(), "anteprima: chi usa l'app non viene toccato");
check(await sez("Non ancora nell'app · 1").isVisible() && !(await page.isChecked(".sheet input[name=aggiungi]")), "anteprima: Nino da scegliere, non spuntato");
await page.screenshot({ path: S + "/e2e/27-importa-conferme.png", fullPage:true });
await page.check(".sheet input[name=correggi]");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/4 VPP aggiornati, 1 persona cancellata/).waitFor(); check(true, "import fatto");
await sync(page);
const vppDi = id => DB.activities.filter(a => a.partner_id === id && ["ordine","rettifica"].includes(a.tipo) && a.data.slice(0, 7) === oggiStr.slice(0, 7))
  .reduce((t, a) => t + Number(a.vp), 0);
check(DB.partners.find(p => p.id === "R").codice_amway === "1234567" && Math.abs(vppDi("R") - 400) < 0.001, "i miei VPP del mese sono quelli del report");
check(vppDi("imp-gino") === 1055.5 && vppDi("imp-dora") === 12 && DB.partners.find(p => p.id === "imp-dora").codice_amway === "3000020", "VPP dei gestiti e codice di Dora corretto");
check(DB.partners.find(p => p.id === "imp-nadia").codice_amway === "3000003", "codice di Nadia salvato");
check(!DB.partners.some(p => p.id === "imp-ugo"), "Ugo cancellato");
check(!DB.activities.some(a => a.tipo === "rettifica" && a.inserito_da === "R" && usanoApp.some(p => p.id === a.partner_id)), "nessun dato di chi usa l'app toccato");
const nRett = DB.activities.filter(a => a.tipo === "rettifica").length;
await scegliFile(page, "los.csv", creaCsv(meseFile, righeCsv));
await page.locator(".sheet h2", { hasText:"Report di" }).waitFor();
check(!(await sez("Non più nel report").count()) && !(await page.getByText("viene salvato").count()) && !(await sez("Non ancora nell'app").count()),
  "reimport: niente più da confermare, Nino escluso");
await page.click(".sheet button:has-text('Importa')");
await page.getByText(/0 VPP aggiornati/).waitFor();
await sync(page);
check(DB.activities.filter(a => a.tipo === "rettifica").length === nRett, "reimport dello stesso file: nessun dato nuovo");
await scegliFile(page, "di-altri.csv", creaCsv(meseFile, [persona(1, "1", "7777777", "ALTRO, ALDO", "1")]));
check(await page.locator(".sheet .errore").getByText("non il tuo (1234567)").isVisible(), "import: il report di un altro partner è rifiutato");
await page.click(".sheet button[data-act=chiudi]");
await page.click("button[data-act=vista-gruppo]");
await page.locator(".albero.struttura li", { hasText:"Gino Gestito" }).locator("button[data-act=apri-scheda]").click();
await page.getByText("Scheda partner").waitFor();
const testoScheda = await page.locator("#app").innerText();
check(testoScheda.includes("Codice Amway 3000001"), "scheda: codice Amway");
await page.click("button[data-act=codice]");
await page.fill(".sheet input[name=codice_amway]", "3000020");
await page.click(".sheet button:has-text('Salva')");
check(await page.locator(".sheet .errore").innerText() === "Questo codice Amway è già di un'altra persona nell'app.", "codice già usato: rifiutato");
await ctx.close();

await browser.close();
console.log(`controlli superati: ${ok}`);
if(errori.length){ console.log("ERRORI CONSOLE:", errori); process.exitCode = 1; }
