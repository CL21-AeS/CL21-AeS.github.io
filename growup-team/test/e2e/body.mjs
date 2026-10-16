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
await page.click("form button.primary");
check(await page.getByText("serve la data di iscrizione").isVisible(), "data obbligatoria per chi inizia");
await page.fill("input[name=data]", "2026-10-01");
await page.check("input[name=privacy]");
check(await page.locator("form button.primary").innerText() === "Inizia", "pulsante Inizia");
await page.screenshot({ path: S + "/e2e/1-ingresso.png", fullPage:true });
await page.click("form button.primary");
await page.getByText("Ciao Anna").waitFor();
await sync(page);
const anna = DB.partners.find(p => p.nome === "Anna Bianchi");
check(anna.sponsor_id === "R", "Anna sotto Stefano e Alessia");
await page.click("text=Fatto, l'ho salvato");
check(await page.getByText(/Mancano \d+ giorni per non pagare/).isVisible(), "conto alla rovescia");

// 2. Attività (regressione)
await page.click("button[data-act=contatto]"); await page.getByText("Contatto registrato").waitFor();
check(await page.locator("button[data-act=contatto] b").innerText() === "1 questa sett.", "contatto +1");
await page.click("button[data-act=ordine]"); await page.fill("input[name=vp]", "62,5");
await page.click(".sheet button:has-text('Salva')"); await page.getByText("Ordine da 62,5 VP registrato").waitFor();
check(await page.getByText("Primi clienti").first().isVisible(), "primo ordine fatto -> tappa 2");

// 2b. Il mio mese: + VP e niente struttura nella pagina Io
check(await page.locator(".card", { hasText:"Il mio mese" }).locator("button[data-act=ordine]").isVisible(), "+ VP nel mio mese");
// Aggiorna il totale del mese: su a 100, poi giù a 80
await page.click("button[data-act=totale-mese]");
check(await page.inputValue(".sheet input[name=vp]") === "62,5", "totale proposto = VP già registrati");
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

// 3. Struttura: aggiunta manuale e link (pagina Gruppo)
await page.click("button[data-act=vista-gruppo]");
await page.getByText("Il mio gruppo").first().waitFor();
check(!(await page.locator(".azioni").count()), "niente barra azioni nella pagina Gruppo");
check(await page.getByText("Invita un nuovo partner").isVisible(), "invito nella pagina Gruppo");
check(await page.getByText("Ancora nessuno nel tuo gruppo").isVisible(), "gruppo vuoto");
check(!(await page.content()).includes("sotto di te"), "niente 'sotto di te'");
await page.click("button[data-act=aggiungi]");
await page.getByText("Aggiungi una persona").waitFor();
await page.fill(".sheet input[name=nome]", "Marco Rossi");
await page.selectOption(".sheet select[name=qualifica]", "pin:6");
await page.click(".sheet button:has-text('Salva')");
check(await page.getByText("Serve il suo consenso").isVisible(), "consenso obbligatorio");
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Marco Rossi aggiunto al tuo gruppo").waitFor();
check(await page.locator(".albero:not(.seguire) li", { hasText:"Marco Rossi" }).getByText("senza app").isVisible(), "Marco senza app nella struttura");
check(await page.locator(".albero:not(.seguire) li", { hasText:"Marco Rossi" }).getByText("0 VP · gruppo 0").isVisible(), "numeri accanto al nome");
// seconda persona sotto Marco
await page.click("button[data-act=aggiungi]");
const posti = await page.locator(".sheet select[name=sponsor] option").allInnerTexts();
check(posti[0] === "Io" && posti.some(x => x === "1 · Marco Rossi"), "sponsor: io o qualcuno del mio gruppo, con il livello");
await page.fill(".sheet input[name=nome]", "Luca Verdi");
await page.selectOption(".sheet select[name=sponsor]", { label: posti.find(x => x.includes("Marco")) });
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Luca Verdi aggiunto al gruppo di Marco Rossi").waitFor();
check(await page.getByText("2 persone", { exact:true }).isVisible(), "conteggio persone del gruppo");
await sync(page);
const marco = DB.partners.find(p => p.nome === "Marco Rossi"), luca = DB.partners.find(p => p.nome === "Luca Verdi");
check(marco.sponsor_id === anna.id && luca.sponsor_id === marco.id && marco.percentuale_iniziale === 6, "posizioni e pin salvati");
await page.screenshot({ path: S + "/e2e/2-struttura.png", fullPage:true });
// scheda di Marco: inserisco i suoi numeri
await page.locator(".albero:not(.seguire) li", { hasText:"Marco Rossi" }).locator("button[data-act=apri-scheda]").click();
await page.getByText("Scheda partner").waitFor();
check(await page.getByText("non usa l'app: i suoi numeri li aggiorni tu").isVisible(), "scheda di chi è senza app");
check(!(await page.locator(".azioni").count()), "niente barra delle mie azioni nella scheda");
await page.locator(".griglia-azioni button[data-act=contatto]").click();
await page.getByText("Contatto registrato per Marco").waitFor();
await page.locator(".griglia-azioni button[data-act=totale-mese]").click();
check(await page.getByText("VP di ottobre di Marco").isVisible() || await page.locator(".sheet h2", { hasText:"di Marco" }).isVisible(), "totale del mese di Marco");
await page.fill(".sheet input[name=vp]", "150");
await page.click(".sheet button:has-text('Salva')");
await page.getByText(/aggiornato per Marco: 150 VP/).waitFor();
check(await page.locator(".oggi li", { hasText:"Contatto" }).getByText("inserito da te").isVisible(), "ogni dato mostra chi l'ha inserito");
await sync(page);
check(DB.activities.filter(a => a.partner_id === DB.partners.find(p => p.nome === "Marco Rossi").id).length === 2, "i dati sono di Marco, non miei");
check(DB.activities.some(a => a.partner_id === DB.partners.find(p => p.nome === "Marco Rossi").id && a.tipo === "rettifica" && Number(a.vp) === 150), "il totale è finito sul profilo di Marco");
await page.screenshot({ path: S + "/e2e/11-scheda-gestito.png", fullPage:true });
await page.click("button[data-act=manda-link]");
await page.getByText("Il link di Marco Rossi").waitFor();
await sync(page);
const chiaveMarco = DB.partners.find(p => p.nome === "Marco Rossi").chiave;
const waMarco = decodeURIComponent(await page.locator(".sheet a.wa").getAttribute("href"));
check(waMarco.includes("Ciao Marco") && waMarco.includes("#chiave=" + chiaveMarco), "link di Marco su WhatsApp");
await page.screenshot({ path: S + "/e2e/3-link-gestito.png" });
await ctx.close();

// 4. Marco apre il suo link: privacy e poi dentro
({ ctx, page } = await apri({}, "#chiave=" + chiaveMarco));
await page.getByText("Il tuo profilo è già pronto").waitFor();
await page.click("form button.primary");
check(await page.getByText("serve accettare l'informativa").isVisible(), "privacy obbligatoria per chi è stato aggiunto");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Ciao Marco").waitFor();
check(await page.getByText("6% raggiunto").isVisible(), "pin di Marco mostrato");
check(await page.getByText("Path to Bronze").first().isVisible(), "pin senza Bronze -> Path to Bronze");
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero:not(.seguire) li", { hasText:"Luca Verdi" }).isVisible(), "Marco vede Luca nel suo gruppo");
await page.click("button[data-act=vista-io]");
check(!(await page.getByText("3 nuove prime linee").count()) && !(await page.getByText("iscritte dal").count()), "Path to Bronze senza vincolo di data");
await page.screenshot({ path: S + "/e2e/4-marco.png", fullPage:true });
await sync(page); await ctx.close();
check(DB.partners.find(p => p.nome === "Marco Rossi").stato === "attivo", "Marco ora è attivo");

// 5. Partner già avviato con pin 12%: niente data obbligatoria
({ ctx, page } = await apri({}, "#RRRR22"));
await page.getByText("Benvenuto in Growup").waitFor();
await page.fill("input[name=nome]", "Bea Verdi");
await page.selectOption("select[name=qualifica]", "pin:12");
check(await page.getByText("(facoltativa)").isVisible(), "data facoltativa per chi ha già un pin");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Ciao Bea").waitFor();
check(await page.getByText("12% raggiunto").isVisible(), "pin 12% mostrato");
await sync(page); await ctx.close();

// 6. Bronze Foundation con pagamenti (regressione)
({ ctx, page } = await apri({}, "#RRRR22"));
await page.fill("input[name=nome]", "Ciro Neri");
await page.selectOption("select[name=qualifica]", "foundation_9");
check(await page.locator("input[name=mese]").isVisible(), "campi pagamenti visibili");
await page.fill("input[name=mese]", "2026-07"); await page.fill("input[name=pagamenti]", "3");
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Ciao Ciro").waitFor();
check(await page.getByText("Pagamenti 3 di 12, restano 15 mesi su 18").isVisible(), "pagamenti");
await page.screenshot({ path: S + "/e2e/5-avviato.png", fullPage:true });
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "niente scroll orizzontale");
await sync(page); await ctx.close();

// 7. Radice (privacy non ancora accettata) entra con il link personale
({ ctx, page } = await apri({ colorScheme:"dark" }, "#chiave=" + "a".repeat(32)));
await page.getByText("Il tuo profilo è già pronto").waitFor();
await page.check("input[name=privacy]"); await page.click("form button.primary");
await page.getByText("Ciao Stefano e Alessia").waitFor();
await page.click("button[data-act=vista-gruppo]");
check(await page.locator(".albero:not(.seguire) li", { hasText:"Luca Verdi" }).isVisible(), "la radice vede tutta la struttura");
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
// inserisci in mezzo: tra Anna e Marco mancava Paolo
await page.locator(".albero:not(.seguire) li", { hasText:"Marco Rossi" }).locator("button[data-act=apri-scheda]").click();
await page.click("button[data-act=in-mezzo]");
await page.getByText("Manca qualcuno sopra Marco?").waitFor();
check(await page.getByText("Marco Rossi e tutto il suo gruppo passano sotto questa persona").isVisible(), "spiegazione chiara: il gruppo passa da solo");
check(await page.locator(".sheet input[name=sotto]:checked").count() === 0, "niente da spuntare di default");
await page.fill(".sheet input[name=nome]", "Paolo Neri");
await page.check(".sheet input[name=consenso]");
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Paolo Neri inserito: ora Marco è nel suo gruppo").waitFor();
await sync(page);
const paolo = DB.partners.find(p => p.nome === "Paolo Neri");
check(paolo.sponsor_id === anna.id && DB.partners.find(p => p.nome === "Marco Rossi").sponsor_id === paolo.id, "Paolo tra Anna e Marco");
const ordineAlbero = await page.locator(".albero:not(.seguire) li .nome > span:first-child").allInnerTexts();
check(ordineAlbero.findIndex(t => t.includes("Paolo")) < ordineAlbero.findIndex(t => t.includes("Marco")), "nell'albero Paolo viene prima di Marco");
check(await page.locator(".albero:not(.seguire) li", { hasText:"Paolo Neri" }).getByText("senza app").isVisible(), "Paolo entra senza app");
await page.screenshot({ path: S + "/e2e/13-in-mezzo.png", fullPage:true });
// cambia sponsor (admin): Bea passa sotto Ciro
await page.locator(".albero:not(.seguire) li", { hasText:"Bea Verdi" }).locator("button[data-act=apri-scheda]").click();
await page.click("button[data-act=cambia-sponsor]");
await sync(page);
await page.selectOption(".sheet select[name=sponsor]", DB.partners.find(p => p.nome === "Ciro Neri").id);
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Bea Verdi ora è nel gruppo di Ciro Neri").waitFor();
await sync(page);
check(DB.partners.find(p => p.nome === "Bea Verdi").sponsor_id === DB.partners.find(p => p.nome === "Ciro Neri").id, "Bea sotto Ciro");
// cambia sponsor verso il proprio gruppo: Paolo (Anna → Paolo → Marco → Luca) va sotto Luca
await page.click("button.link[data-act=vista-gruppo]");
await page.locator(".albero:not(.seguire) li", { hasText:"Paolo Neri" }).locator("button[data-act=apri-scheda]").click();
await page.click("button[data-act=cambia-sponsor]");
const opzSponsor = await page.locator(".sheet select[name=sponsor] option").allInnerTexts();
check(opzSponsor.some(o => o.includes("Luca Verdi (sponsor Marco) · nel suo gruppo")) && opzSponsor.some(o => o.includes("Marco Rossi (sponsor Paolo) · nel suo gruppo")), "si può scegliere anche chi è nel suo gruppo");
await page.selectOption(".sheet select[name=sponsor]", DB.partners.find(p => p.nome === "Luca Verdi").id);
await page.click(".sheet button:has-text('Salva')");
await page.getByText("Paolo Neri ora è nel gruppo di Luca Verdi, che è salito al suo posto").waitFor();
await sync(page);
const idDi = n => DB.partners.find(p => p.nome === n).id;
check(DB.partners.find(p => p.nome === "Luca Verdi").sponsor_id === anna.id && DB.partners.find(p => p.nome === "Paolo Neri").sponsor_id === idDi("Luca Verdi")
  && DB.partners.find(p => p.nome === "Marco Rossi").sponsor_id === idDi("Paolo Neri"), "Luca sale sotto Anna, Paolo sotto Luca, Marco resta con Paolo");
// e si rimette com'era: Paolo sotto Anna, poi Luca sotto Marco
await page.click("button[data-act=cambia-sponsor]");
await page.selectOption(".sheet select[name=sponsor]", anna.id);
await page.click(".sheet button:has-text('Salva')"); await page.getByText("Paolo Neri ora è nel gruppo di Anna Bianchi").waitFor();
await page.click("button.link[data-act=vista-gruppo]");
await page.locator(".albero:not(.seguire) li", { hasText:"Luca Verdi" }).locator("button[data-act=apri-scheda]").click();
await page.click("button[data-act=cambia-sponsor]");
await page.selectOption(".sheet select[name=sponsor]", idDi("Marco Rossi"));
await page.click(".sheet button:has-text('Salva')"); await page.getByText("Luca Verdi ora è nel gruppo di Marco Rossi").waitFor();
await sync(page);
check(DB.partners.find(p => p.nome === "Luca Verdi").sponsor_id === idDi("Marco Rossi") && DB.partners.find(p => p.nome === "Paolo Neri").sponsor_id === anna.id, "struttura rimessa com'era");
// livelli come nei report Amway, sponsor accanto al nome, gruppi richiudibili
await page.click("button.link[data-act=vista-gruppo]");
const rigaLuca = page.locator(".albero:not(.seguire) li", { hasText:"Luca Verdi" });
check(await rigaLuca.locator(".livello").innerText() === "4" && await rigaLuca.getByText("sponsor Marco").isVisible(), "Luca: livello 4, sponsor Marco");
check(await page.locator(".albero:not(.seguire) li", { hasText:"Anna Bianchi" }).locator(".livello").innerText() === "1", "Anna: livello 1");
await page.screenshot({ path: S + "/e2e/22-livelli.png", fullPage:true });
await page.locator(".albero:not(.seguire) li", { hasText:"Paolo Neri" }).locator("button[data-act=piega]").click();
check(await page.locator(".albero:not(.seguire) li", { hasText:"Luca Verdi" }).isHidden() && await page.locator(".albero:not(.seguire) li", { hasText:"Marco Rossi" }).isHidden(),
  "gruppo di Paolo richiuso: Marco e Luca nascosti");
check((await page.locator(".albero:not(.seguire) li", { hasText:"Paolo Neri" }).locator("button[data-act=piega]").innerText()).trim() === "▸ 2", "Paolo: ▸ 2");
check(await page.locator(".albero:not(.seguire) li", { hasText:"Luca Verdi" }).isHidden(), "ancora richiuso");
// la ricerca trova anche dentro un gruppo richiuso e mostra la linea fino a noi
await page.fill("#cerca-struttura", "lùca");
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Paolo Neri" }).isVisible()
  && await page.locator(".albero.struttura li", { hasText:"Anna Bianchi" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isHidden(),
  "ricerca: Luca con la sua linea (Anna, Paolo, Marco), gli altri nascosti");
check((await page.locator("#cerca-esito").innerText()).startsWith("1 persona trovata"), "ricerca: 1 persona trovata");
await page.screenshot({ path: S + "/e2e/23-ricerca.png" });
// durante la ricerca ▸ N apre anche il gruppo della persona trovata
await page.fill("#cerca-struttura", "paolo");
const piegaPaolo = page.locator(".albero.struttura li", { hasText:"Paolo Neri" }).locator("button[data-act=piega]");
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isHidden() && (await piegaPaolo.innerText()).trim() === "▸ 2", "ricerca: Paolo trovato, il suo gruppo chiuso (▸ 2)");
await piegaPaolo.click();
check(await page.locator(".albero.struttura li", { hasText:"Marco Rossi" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isVisible()
  && (await piegaPaolo.innerText()).trim() === "▾ 2" && await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isHidden(), "ricerca: ▸ apre la downline di Paolo (Marco, Luca)");
check(await page.locator("#cerca-struttura").inputValue() === "paolo", "ricerca: il testo cercato resta");
await piegaPaolo.click();
check(await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isHidden(), "ricerca: ▾ la richiude");
await page.fill("#cerca-struttura", "zzz");
check(await page.getByText("Nessuno con questo nome nel tuo gruppo.").isVisible(), "ricerca senza risultati");
await page.fill("#cerca-struttura", "");
check(await page.locator(".albero.struttura li", { hasText:"Ciro Neri" }).isVisible() && await page.locator(".albero.struttura li", { hasText:"Luca Verdi" }).isHidden(), "ricerca vuota: torna com'era");
await page.locator(".albero:not(.seguire) li", { hasText:"Paolo Neri" }).locator("button[data-act=piega]").click();
check(await page.locator(".albero:not(.seguire) li", { hasText:"Luca Verdi" }).isVisible(), "gruppo riaperto");
await page.locator(".albero:not(.seguire) li", { hasText:"Paolo Neri" }).locator("button[data-act=apri-scheda]").click();
// cancella: Paolo non rinnova, Marco (con Luca) torna sotto Anna
await page.click("button.link[data-act=vista-gruppo]");
await page.locator(".albero:not(.seguire) li", { hasText:"Paolo Neri" }).locator("button[data-act=apri-scheda]").click();
await page.click("button[data-act=cancella]");
await page.getByText("Paolo Neri cancellato: il suo gruppo ora è di Anna Bianchi").waitFor();
await sync(page);
check(!DB.partners.some(p => p.nome === "Paolo Neri"), "Paolo cancellato");
check(DB.partners.find(p => p.nome === "Marco Rossi").sponsor_id === anna.id, "Marco risale sotto Anna");
check(DB.partners.find(p => p.nome === "Luca Verdi").sponsor_id === DB.partners.find(p => p.nome === "Marco Rossi").id, "il gruppo di Marco resta intatto");
// admin: nuovo link personale per chi usa l'app
await page.locator(".albero:not(.seguire) li", { hasText:"Anna Bianchi" }).locator("button[data-act=apri-scheda]").click();
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
const P = (id, nome, sponsor) => DB.partners.push({ id, nome, sponsor_id:sponsor, stato:"gestito", codice_invito:id.toUpperCase() + "XXXX" });
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
await page.getByText("Situazione per persona").waitFor();
const etich = await page.locator(".card", { hasText:"Situazione per persona" }).locator("li").allInnerTexts();
const etichettaDi = nome => (etich.find(t => t.includes(nome)) || "");
check(etichettaDi("Rosa").includes("Non aggiorna") && etichettaDi("Rosa").includes("ultimo aggiornamento 20 giorni fa"), "Rosa: Non aggiorna");
check(etichettaDi("Lino").includes("Contatti sotto soglia"), "Lino: Contatti sotto soglia");
check(etichettaDi("Ivo").includes("Piani sotto soglia") && etichettaDi("Ivo").includes("25 contatti, 2 piani: 1 piano ogni 13 contatti"), "Ivo: Invito, con i dati");
check(etichettaDi("Fede").includes("VP sotto soglia"), "Fede: VP sotto soglia");
check(etichettaDi("Cri").includes("In crescita"), "Cri: In crescita");
check(!etich.some(t => t.includes("Gino")), "chi è senza app non ha etichetta");
check(await page.locator(".card", { hasText:"Situazione per persona" }).getByText("1 persona senza app non ha l'etichetta").isVisible(), "nota sulle persone senza app");
check(await page.locator(".albero:not(.seguire) li", { hasText:"Gino Senza App" }).isVisible(), "Gino resta nella struttura");
check(etich[0].includes("Rosa") && etich[etich.length - 1].includes("Cri"), "ordinati per urgenza");
check(await page.locator(".imbuto li", { hasText:"Contatti" }).getByText("75", { exact:true }).isVisible(), "imbuto: 75 contatti");
check(await page.locator(".imbuto li", { hasText:"dei contatti" }).getByText("14", { exact:true }).isVisible(), "imbuto: 14 piani");
check(await page.locator(".imbuto li", { hasText:"dei contatti" }).getByText("19% dei contatti").isVisible(), "imbuto: tasso di passaggio");
check(await page.locator(".imbuto li.collo", { hasText:"Contatti" }).getByText("sotto soglia").isVisible(), "passaggio sotto soglia evidenziato");
check(await page.locator(".card", { hasText:"Imbuto del gruppo" }).locator(".avviso").innerText() === "Contatti: 75 su 240 di obiettivo del gruppo (31%), sotto la soglia del 50%.", "imbuto: solo dati e soglia");
check(!/allenate|lavorate|costruisci|da chiamare|collo di bottiglia|seguire/i.test(await page.locator("#app").innerText()), "nessun consiglio nella pagina Gruppo");
await page.locator(".card", { hasText:"Situazione per persona" }).locator("button[data-act=apri-scheda]").first().click();
await page.getByText("Scheda partner").waitFor(); check(true, "dall'elenco si apre la scheda");
await page.click("button.link[data-act=vista-gruppo]");
await page.screenshot({ path: S + "/e2e/14-imbuto.png", fullPage:true });
await ctx.close();

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
await page.locator(".albero:not(.seguire) li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
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
await page.locator(".albero:not(.seguire) li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
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
await page.locator(".albero:not(.seguire) li", { hasText:"Cri Crescita" }).locator("button[data-act=apri-scheda]").click();
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

await browser.close();
console.log(`controlli superati: ${ok}`);
if(errori.length){ console.log("ERRORI CONSOLE:", errori); process.exitCode = 1; }
